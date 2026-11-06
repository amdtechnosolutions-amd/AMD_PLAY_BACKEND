import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { BaseService } from '../../core/BaseService.js';
import { bookingRepository } from './booking.repository.js';
import { resourceRepository } from '../resources/resource.repository.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { userRepository } from '../users/user.repository.js';
import { sportRepository } from '../sports/sport.repository.js';
import { batchRepository } from '../coaching/coaching.repository.js';
import { slotService } from '../slots/slot.service.js';
import { settingsService } from '../settings/settings.service.js';
import { wabridgeService } from '../notifications/wabridge.service.js';
import { razorpayService } from '../finance/razorpay.service.js';
import { HikvisionService } from '../iot/hikvision.service.js';
import { Device } from '../iot/device.model.js';
import { deviceSyncQueueService } from '../iot/device-sync-queue.service.js';
import { iotSchedulerService } from '../iot/iot-scheduler.service.js';
import { getLock, releaseLock } from '../../config/redis.js';
import { NotFoundError, ConflictError, ValidationError, AuthorizationError } from '../../errors/AppError.js';
import { BOOKING_STATUS, PAYMENT_STATUS, ROLES } from '../../config/constants.js';
import { hashPassword } from '../../utils/password.js';
import { User } from '../users/user.model.js';

const ACCESS_DEVICE_TYPES = ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'];

export class BookingService extends BaseService {
  constructor() {
    super(bookingRepository, 'Booking');
  }

  /**
   * Helper to resolve tenant and user context resiliently (supports guest, unauthenticated, and expired token sessions)
   */
  async _resolveUserAndTenant(data, context = {}, slotsList = []) {
    let resolvedTenantId = context.tenantId;
    let primaryResource = null;

    const firstResourceId = data.resourceId || slotsList[0]?.resourceId;
    if (firstResourceId) {
      primaryResource = await resourceRepository.findById(firstResourceId, resolvedTenantId);
      if (!primaryResource) {
        primaryResource = await resourceRepository.findById(firstResourceId);
      }
      if (primaryResource?.tenantId) {
        resolvedTenantId = primaryResource.tenantId;
      }
    }

    if (!resolvedTenantId) {
      const defaultTenant = await tenantRepository.findOne({ status: 'active' });
      if (defaultTenant) {
        resolvedTenantId = defaultTenant._id;
      }
    }

    let userId = context.user?.id || context.user?.sub;
    let user = null;

    if (userId) {
      user = await userRepository.findById(userId, resolvedTenantId);
      if (!user) {
        user = await userRepository.findById(userId);
      }
    }

    if (!user) {
      const customerPhone = data.phone || data.customer?.phone;
      const customerEmail = data.email || data.customer?.email;
      const customerName = data.name || data.customer?.name || 'Player';

      if (customerPhone) {
        user = await User.findOne({
          tenantId: resolvedTenantId,
          phone: customerPhone.trim(),
        });
        if (!user) {
          user = await User.findOne({ phone: customerPhone.trim() });
        }
      }

      if (!user && customerEmail) {
        user = await User.findOne({
          tenantId: resolvedTenantId,
          email: customerEmail.trim().toLowerCase(),
        });
      }

      if (!user && resolvedTenantId) {
        const cleanPhone = (customerPhone || '9999999999').trim();
        const guestEmail = customerEmail
          ? customerEmail.trim().toLowerCase()
          : (customerPhone ? `player_${cleanPhone.replace(/\D/g, '')}@amdplay.local` : `guest_${Date.now()}@amdplay.local`);

        user = await User.findOne({
          tenantId: resolvedTenantId,
          email: guestEmail,
        });

        if (!user) {
          const hashedPassword = await hashPassword('Player123!');
          const nameParts = customerName.trim().split(/\s+/);
          user = await User.create({
            tenantId: resolvedTenantId,
            branchId: primaryResource?.branchId || null,
            firstName: nameParts[0] || 'Player',
            lastName: nameParts.slice(1).join(' ') || '',
            email: guestEmail,
            phone: cleanPhone,
            password: hashedPassword,
            role: ROLES.CUSTOMER,
            status: 'active',
          });
        }
      }

      if (user) {
        userId = user._id;
      }
    }

    if (user && !context.user) {
      context.user = {
        id: user._id.toString(),
        sub: user._id.toString(),
        email: user.email,
        phone: user.phone,
        role: user.role,
        tenantId: user.tenantId,
      };
    }

    return {
      resolvedTenantId,
      primaryResource,
      userId,
      user,
    };
  }

  /**
   * Create Confirmed Booking (Checkout)
   * Supports both single slot and multi-slot / multi-date batches
   */
  async createBooking(data, context = {}) {
    const isMulti = Array.isArray(data.slots) && data.slots.length > 0;
    const slotsList = isMulti ? data.slots : [data];

    if (slotsList.length === 0) {
      throw new ValidationError('At least one slot is required to create a booking');
    }

    const { resolvedTenantId: initialTenantId, primaryResource, userId } =
      await this._resolveUserAndTenant(data, context, slotsList);

    if (!initialTenantId) {
      throw new ValidationError('Tenant context is required to create a booking');
    }

    if (!userId) {
      throw new ValidationError('Authenticated user is required to book a court');
    }

    let tenantId = initialTenantId;

    // =========================================================================
    // 1. Validate all slots (Resources, Maintenance, Batch Conflict, Double-Booking, Holds)
    // =========================================================================
    const validatedSlots = [];
    let resolvedTenantId = tenantId;

    for (let i = 0; i < slotsList.length; i++) {
      const slotItem = slotsList[i];
      if (!slotItem.resourceId || !slotItem.date || !slotItem.startTime || !slotItem.endTime) {
        throw new ValidationError(`Slot ${i + 1} requires resourceId, date, startTime, and endTime`);
      }

      let resource = await resourceRepository.findById(slotItem.resourceId, resolvedTenantId);
      if (!resource) {
        resource = await resourceRepository.findById(slotItem.resourceId);
        if (resource) {
          resolvedTenantId = resource.tenantId;
        } else {
          throw new NotFoundError(`Court/Resource with ID '${slotItem.resourceId}' not found`);
        }
      }

      if (resource.status === 'maintenance' || resource.maintenance?.isUnderMaintenance) {
        throw new ConflictError(`Court '${resource.name}' is currently under maintenance and cannot be booked`);
      }

      const sportsToCheck = Array.isArray(resource.sportIds) && resource.sportIds.length > 0
        ? resource.sportIds
        : [resource.sportId];

      const batchArrays = await Promise.all(
        sportsToCheck.map((sId) => batchRepository.findActiveByBranchAndSport(resource.branchId, sId, resolvedTenantId))
      );
      const activeBatches = batchArrays.flat();
      const targetDate = new Date(`${slotItem.date}T00:00:00.000Z`);
      const dayOfWeek = targetDate.getUTCDay();
      const batchConflict = slotService._isBatchConflicting(activeBatches, dayOfWeek, slotItem.startTime, slotItem.endTime, resource._id);
      if (batchConflict.conflicting) {
        throw new ConflictError(
          `Slot ${slotItem.startTime} - ${slotItem.endTime} on ${slotItem.date} is reserved for coaching batch '${batchConflict.batch.name}' (${batchConflict.batch.code})`
        );
      }

      const isBooked = await bookingRepository.isSlotBooked(
        resource._id,
        slotItem.date,
        slotItem.startTime,
        resolvedTenantId
      );
      if (isBooked) {
        throw new ConflictError(`Slot ${slotItem.startTime} - ${slotItem.endTime} on ${slotItem.date} is already booked`);
      }

      const lockKey = `lock:slot:${resolvedTenantId}:${resource._id}:${slotItem.date}:${slotItem.startTime}`;
      const activeLock = await getLock(lockKey);
      if (activeLock) {
        const lockUserId = activeLock.userId?.toString();
        const matchesHold = data.holdId && activeLock.holdId && activeLock.holdId === data.holdId;
        const isGuestOrSame = !lockUserId || lockUserId === 'guest' || lockUserId === userId.toString();
        if (!matchesHold && !isGuestOrSame) {
          throw new ConflictError(
            `Slot ${slotItem.startTime} - ${slotItem.endTime} on ${slotItem.date} is currently held by another user during checkout. Please try again shortly.`
          );
        }
      }

      validatedSlots.push({
        slotItem,
        resource,
        lockKey,
      });
    }

    const tenant = await tenantRepository.findById(resolvedTenantId);
    const taxRate = tenant?.settings?.taxPercentage ?? 18;

    // =========================================================================
    // 2. Pricing Calculation across all slots
    // =========================================================================
    let totalBasePrice = 0;
    const pricedSlots = validatedSlots.map(({ slotItem, resource, lockKey }) => {
      const pricingDetails = slotService._calculateSlotPrice(
        resource.pricing,
        slotItem.date,
        slotItem.startTime,
        context.user
      );
      const slotBasePrice = pricingDetails.finalPrice ?? pricingDetails.basePrice ?? 0;
      totalBasePrice += slotBasePrice;
      const slotTax = Math.round((slotBasePrice * taxRate) / 100);
      const slotTotal = slotBasePrice + slotTax;

      return {
        slotItem,
        resource,
        lockKey,
        pricing: {
          basePrice: slotBasePrice,
          taxRate,
          taxAmount: slotTax,
          discountAmount: 0,
          totalAmount: slotTotal,
        },
      };
    });

    const totalTaxAmount = Math.round((totalBasePrice * taxRate) / 100);
    const totalDiscountAmount = 0;
    const grandTotalAmount = totalBasePrice + totalTaxAmount - totalDiscountAmount;

    // =========================================================================
    // 3. Generate Master Group Identifiers & Access PIN
    // =========================================================================
    const primaryDate = pricedSlots[0].slotItem.date;
    const dateClean = primaryDate.replace(/-/g, '');
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const groupId = crypto.randomUUID();
    const groupBookingNumber = `BK-${dateClean}-${randomHex}`;
    const sharedAccessCode = Math.floor(100000 + Math.random() * 900000).toString();

    // =========================================================================
    // 4. Create Individual Booking Records & Calculate Global Time Boundaries
    // =========================================================================
    const allSlotDates = pricedSlots.map(({ slotItem }) => ({
      start: new Date(`${slotItem.date}T${slotItem.startTime}:00`),
      end: new Date(`${slotItem.date}T${slotItem.endTime}:00`),
    }));
    const minStart = new Date(Math.min(...allSlotDates.map((s) => s.start.getTime())));
    const maxEnd = new Date(Math.max(...allSlotDates.map((s) => s.end.getTime())));

    const pad = (n) => String(n).padStart(2, '0');
    const formatLocal = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const globalBufferedStart = formatLocal(new Date(minStart.getTime() - 15 * 60000));
    const globalBufferedEnd = formatLocal(new Date(maxEnd.getTime() + 15 * 60000));

    const createdDocs = [];
    const paymentMethod = data.paymentMethod || (data.razorpay_payment_id ? 'razorpay' : 'online');
    const transactionId = data.razorpay_payment_id || data.transactionId || `TXN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    for (let i = 0; i < pricedSlots.length; i++) {
      const { slotItem, resource, lockKey, pricing } = pricedSlots[i];
      const slotBookingNumber = isMulti ? `${groupBookingNumber}-${i + 1}` : groupBookingNumber;
      const accessCode = sharedAccessCode;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(
        `PIN:${accessCode};BK:${slotBookingNumber};DATE:${slotItem.date};SLOT:${slotItem.startTime}-${slotItem.endTime}`
      )}`;

      // Resolve hardware reader
      let assignedDevice = await Device.findOne({
        tenantId: resolvedTenantId,
        branchId: resource.branchId,
        $or: [{ resourceId: resource._id }, { resourceIds: resource._id }],
        type: { $in: ACCESS_DEVICE_TYPES },
      });

      if (!assignedDevice && (resource.sportId || resource.sportIds?.length > 0)) {
        const sportsToCheck = Array.isArray(resource.sportIds) && resource.sportIds.length > 0
          ? resource.sportIds
          : [resource.sportId];
        assignedDevice = await Device.findOne({
          tenantId: resolvedTenantId,
          branchId: resource.branchId,
          $or: [
            { sportId: { $in: sportsToCheck } },
            { sportIds: { $in: sportsToCheck } },
          ],
          type: { $in: ACCESS_DEVICE_TYPES },
        });
      }

      if (!assignedDevice) {
        assignedDevice = await Device.findOne({
          tenantId: resolvedTenantId,
          branchId: resource.branchId,
          isDefaultEntrance: true,
          type: { $in: ACCESS_DEVICE_TYPES },
        });
      }

      if (!assignedDevice) {
        assignedDevice = await Device.findOne({
          tenantId: resolvedTenantId,
          branchId: resource.branchId,
          accessScope: { $in: ['branch_entrance', 'global'] },
          type: { $in: ACCESS_DEVICE_TYPES },
        });
      }

      if (!assignedDevice) {
        assignedDevice = await Device.findOne({
          tenantId: resolvedTenantId,
          branchId: resource.branchId,
          type: { $in: ACCESS_DEVICE_TYPES },
        });
      }

      const bookingDoc = await bookingRepository.create({
        tenantId: resolvedTenantId,
        branchId: resource.branchId,
        resourceId: resource._id,
        sportId: data.sportId || slotItem.sportId || resource.sportId,
        userId,
        bookingNumber: slotBookingNumber,
        groupId,
        groupBookingNumber,
        isMultiSlot: isMulti,
        totalGroupSlots: pricedSlots.length,
        slotIndex: i + 1,
        date: slotItem.date,
        startTime: slotItem.startTime,
        endTime: slotItem.endTime,
        status: BOOKING_STATUS.CONFIRMED,
        pricing,
        payment: {
          status: PAYMENT_STATUS.SUCCESS,
          method: paymentMethod,
          transactionId,
          paidAt: new Date(),
        },
        accessCode,
        qrCodeUrl,
        readerId: assignedDevice?.code || assignedDevice?._id?.toString() || 'reader_main',
        notes: slotItem.notes || data.notes || '',
      });

      createdDocs.push({
        doc: bookingDoc,
        resource,
        slotItem,
        assignedDevice,
        lockKey,
        accessCode,
        bookingNumber: slotBookingNumber,
      });

      // Release slot hold lock
      await releaseLock(lockKey, userId, true);
    }

    // Provision hardware PIN across assigned devices (deduplicated)
    const provisionedDevices = new Set();
    const user = await userRepository.findById(userId, resolvedTenantId);
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Guest';

    // Collect all candidate access devices: court/sport gates from createdDocs + any entrance/biometric gates in branch
    const allCandidateDevices = [];
    for (const item of createdDocs) {
      if (item.assignedDevice && item.assignedDevice.ipAddress) {
        allCandidateDevices.push(item.assignedDevice);
      }
    }

    const branchIds = [...new Set(createdDocs.map((d) => d.resource?.branchId || d.doc?.branchId).filter(Boolean))];
    const entranceDevices = await Device.find({
      tenantId: resolvedTenantId,
      branchId: { $in: branchIds },
      type: { $in: ACCESS_DEVICE_TYPES },
      $or: [
        { isDefaultEntrance: true },
        { accessScope: { $in: ['branch_entrance', 'global'] } },
      ],
    });
    for (const ed of entranceDevices) {
      if (ed.ipAddress && !allCandidateDevices.some((d) => d._id.toString() === ed._id.toString())) {
        allCandidateDevices.push(ed);
      }
    }

    // Fallback: If still no device found, grab any active biometric device in branch
    if (allCandidateDevices.length === 0) {
      const fallbackDevices = await Device.find({
        tenantId: resolvedTenantId,
        branchId: { $in: branchIds },
        type: { $in: ACCESS_DEVICE_TYPES },
      });
      for (const fd of fallbackDevices) {
        if (fd.ipAddress) allCandidateDevices.push(fd);
      }
    }

    for (const dev of allCandidateDevices) {
      const deviceKey = dev.code || dev._id.toString();
      if (provisionedDevices.has(deviceKey)) continue;
      provisionedDevices.add(deviceKey);

      try {
        const client = HikvisionService.forDevice({
          ip: dev.ipAddress,
          port: dev.port || (dev.protocol === 'https' ? 443 : 80),
          username: dev.username || 'admin',
          password: dev.password || '',
          protocol: dev.protocol || (Number(dev.port) === 443 ? 'https' : 'http'),
        });

        const pinResult = await client.assignPin({
          employeeNo: sharedAccessCode,
          pin: sharedAccessCode,
          beginTime: globalBufferedStart,
          endTime: globalBufferedEnd,
          userName: `${userName} (${groupBookingNumber})`,
          doorNo: dev.doorNo || 1,
        });

        console.log(`[Booking] Successfully provisioned PIN ${sharedAccessCode} on device ${dev.code}:`, pinResult?.statusString || 'OK');
      } catch (readerErr) {
        console.warn(`[Booking] Hikvision PIN assignment warning for ${dev.code}:`, readerErr.message);
        const lockDelayMs = readerErr.isLocked && readerErr.unlockTime ? (Number(readerErr.unlockTime) + 10) * 1000 : null;
        await deviceSyncQueueService.enqueueJob({
          tenantId: resolvedTenantId,
          branchId: dev.branchId,
          deviceId: dev._id,
          action: 'ASSIGN_PIN',
          employeeNo: sharedAccessCode,
          nextAttemptAt: lockDelayMs ? new Date(Date.now() + lockDelayMs) : null,
          payload: {
            employeeNo: sharedAccessCode,
            pin: sharedAccessCode,
            beginTime: globalBufferedStart,
            endTime: globalBufferedEnd,
            userName: `${userName} (${groupBookingNumber})`,
            doorNo: dev.doorNo || 1,
          },
        }).catch((qErr) => console.warn('[Booking] Could not enqueue sync job:', qErr.message));
      }
    }

    // =========================================================================
    // 5. IoT Court Lighting & Appliance Automation: Power ON & Assign Schedule (15m grace)
    // =========================================================================
    try {
      await iotSchedulerService.onBookingCreated(createdDocs, { tenantId: resolvedTenantId });
    } catch (iotErr) {
      console.warn('[Booking] IoT Court schedule actuation warning:', iotErr.message);
    }

    // =========================================================================
    // 6. Record Unified Ledger Payment
    // =========================================================================
    try {
      const rawMethod = (paymentMethod || 'upi').toLowerCase();
      const method = ['upi', 'card', 'cash', 'netbanking', 'wallet'].includes(rawMethod) ? rawMethod : 'upi';
      const gateway = data.razorpay_payment_id || data.razorpay_order_id ? 'razorpay' : (method === 'cash' ? 'cash' : 'manual');

      await razorpayService.recordPayment({
        tenantId: resolvedTenantId,
        branchId: createdDocs[0].resource.branchId,
        userId,
        amount: grandTotalAmount,
        currency: 'INR',
        type: 'booking',
        referenceId: groupBookingNumber,
        paymentMethod: method,
        gateway,
        gatewayOrderId: data.razorpay_order_id || '',
        gatewayPaymentId: data.razorpay_payment_id || transactionId,
        status: 'success',
        notes: data.notes || (isMulti ? `Multi-Slot Booking (${pricedSlots.length} slots)` : `Court Booking: ${createdDocs[0].resource.name} (${pricedSlots[0].slotItem.startTime} - ${pricedSlots[0].slotItem.endTime})`),
        metadata: {
          groupId,
          groupBookingNumber,
          isMultiSlot: isMulti,
          totalSlots: pricedSlots.length,
          bookingIds: createdDocs.map((c) => c.doc._id.toString()),
          dates: [...new Set(pricedSlots.map((c) => c.slotItem.date))],
        },
      });
    } catch (payErr) {
      console.warn('[Booking] Ledger payment record warning:', payErr.message);
    }

    // =========================================================================
    // 6. WhatsApp Dispatch
    // =========================================================================
    try {
      const user = await userRepository.findById(userId, resolvedTenantId);
      const recipientPhone = user?.phone || context.user?.phone;
      const tenantSettings = await settingsService.getSettings(resolvedTenantId);

      if (recipientPhone && tenantSettings?.whatsapp?.enabled) {
        let sessionLines = '';
        pricedSlots.forEach(({ slotItem, resource }, idx) => {
          sessionLines += `• Slot ${idx + 1}: ${slotItem.date} | ${slotItem.startTime} - ${slotItem.endTime} (${resource.name})\n`;
        });

        const messageText =
          `🏆 *${isMulti ? 'Multi-Slot Court Booking Confirmed!' : 'Booking Confirmed!'} - ${tenant?.name || 'Apex Sports Academy'}*\n\n` +
          `📋 *Booking ID:* ${groupBookingNumber}\n` +
          `🎾 *Total Sessions:* ${pricedSlots.length}\n` +
          `📅 *Reserved Sessions:*\n${sessionLines}\n` +
          `🔑 *YOUR ACCESS PIN:* *${sharedAccessCode}*\n` +
          `🚪 *Access Terminal:* ${createdDocs[0].assignedDevice?.name || 'Turnstile / Access Gate'}\n\n` +
          `📲 *Access QR Pass:* Please scan your QR pass at the entrance terminal or enter your 6-digit PIN on the keypad to enter.\n\n` +
          `Enjoy your game!`;

        await wabridgeService.sendTextMessage({
          destinationNumber: recipientPhone,
          message: messageText,
          mediaLink: createdDocs[0].doc.qrCodeUrl,
          mediaType: 'image',
          credentials: {
            appKey: tenantSettings.whatsapp.appKey,
            authKey: tenantSettings.whatsapp.authKey,
            deviceId: tenantSettings.whatsapp.deviceId,
          },
        });
      }
    } catch (waErr) {
      console.warn('WhatsApp dispatch warning:', waErr.message);
    }

    // If single slot: return standard single booking response for 100% backward compatibility
    if (!isMulti) {
      return await bookingRepository.findByIdWithDetails(createdDocs[0].doc._id, resolvedTenantId);
    }

    // Multi-slot: return group summary + all populated booking records
    const populatedBookings = await Promise.all(
      createdDocs.map((c) => bookingRepository.findByIdWithDetails(c.doc._id, resolvedTenantId))
    );

    return {
      _id: createdDocs[0].doc._id,
      groupId,
      groupBookingNumber,
      bookingNumber: groupBookingNumber,
      isMultiSlot: true,
      totalSlots: populatedBookings.length,
      status: BOOKING_STATUS.CONFIRMED,
      accessCode: sharedAccessCode,
      qrCodeUrl: createdDocs[0].doc.qrCodeUrl,
      pricing: {
        basePrice: totalBasePrice,
        taxRate,
        taxAmount: totalTaxAmount,
        discountAmount: totalDiscountAmount,
        totalAmount: grandTotalAmount,
      },
      payment: createdDocs[0].doc.payment,
      bookings: populatedBookings,
      slots: populatedBookings.map((b) => ({
        id: b._id,
        bookingNumber: b.bookingNumber,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        courtName: b.resourceId?.name,
        courtCode: b.resourceId?.code,
        sport: b.sportId?.name,
        accessCode: b.accessCode,
        qrCodeUrl: b.qrCodeUrl,
        pricing: b.pricing,
      })),
    };
  }

  /**
   * List Bookings with Role-based Filtering & Search
   */
  async listBookings(filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    const userRole = context.user?.role;
    const userId = context.user?.id || context.user?.sub;

    const queryFilter = {};

    // Copy valid filters only
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '' && key !== 'tenantId' && key !== 'search') {
        queryFilter[key] = value;
      }
    }

    // Global Search across booking #, access PIN, customer details, and courts
    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      const term = filters.search.trim();
      const searchRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const [matchingUsers, matchingResources] = await Promise.all([
        userRepository.model
          .find({
            $or: [
              { firstName: searchRegex },
              { lastName: searchRegex },
              { email: searchRegex },
              { phone: searchRegex },
            ],
          })
          .select('_id')
          .limit(25)
          .exec(),
        resourceRepository.model
          .find({
            $or: [{ name: searchRegex }, { code: searchRegex }],
          })
          .select('_id')
          .limit(25)
          .exec(),
      ]);

      queryFilter.$or = [
        { bookingNumber: searchRegex },
        { accessCode: term },
        { groupBookingNumber: searchRegex },
        { 'payment.transactionId': searchRegex },
        ...(matchingUsers.length ? [{ userId: { $in: matchingUsers.map((u) => u._id) } }] : []),
        ...(matchingResources.length ? [{ resourceId: { $in: matchingResources.map((r) => r._id) } }] : []),
      ];
    }

    // Regular customers/members only see their own reservations
    if ([ROLES.CUSTOMER, ROLES.MEMBER, ROLES.STUDENT, ROLES.PARENT].includes(userRole)) {
      queryFilter.userId = userId;
    }

    return await bookingRepository.paginateBookings(queryFilter, pagination, tenantId);
  }

  /**
   * Get Booking Details
   */
  async getBookingById(id, context = {}) {
    const tenantId = context.tenantId;
    const booking = await bookingRepository.findByIdWithDetails(id, tenantId);

    if (!booking) {
      throw new NotFoundError(`Booking with ID '${id}' not found`);
    }

    const userRole = context.user?.role;
    const userId = context.user?.id || context.user?.sub;

    if (
      [ROLES.CUSTOMER, ROLES.MEMBER, ROLES.STUDENT, ROLES.PARENT].includes(userRole) &&
      booking.userId?._id?.toString() !== userId?.toString()
    ) {
      throw new AuthorizationError('You are not authorized to view this booking');
    }

    return booking;
  }

  /**
   * Cancel Booking
   */
  async cancelBooking(id, reason = '', context = {}) {
    const tenantId = context.tenantId;
    const booking = await bookingRepository.findById(id, tenantId);

    if (!booking) {
      throw new NotFoundError(`Booking with ID '${id}' not found`);
    }

    const userRole = context.user?.role;
    const userId = context.user?.id || context.user?.sub;

    if (
      [ROLES.CUSTOMER, ROLES.MEMBER, ROLES.STUDENT, ROLES.PARENT].includes(userRole) &&
      booking.userId?.toString() !== userId?.toString()
    ) {
      throw new AuthorizationError('You are not authorized to cancel this booking');
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new ConflictError('Booking is already cancelled');
    }

    if (booking.status === BOOKING_STATUS.COMPLETED) {
      throw new ConflictError('Completed bookings cannot be cancelled');
    }

    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancellation = {
      isCancelled: true,
      cancelledAt: new Date(),
      reason: reason || 'Customer requested cancellation',
      refundAmount: booking.pricing.totalAmount,
    };
    booking.payment.status = PAYMENT_STATUS.REFUNDED;

    await booking.save();

    // Trigger IoT court schedule evaluation to immediately turn off court relays if no active booking remains
    iotSchedulerService.evaluateCourtSchedules().catch((err) => {
      console.warn('[Booking] Error evaluating court schedules on booking cancellation:', err.message);
    });

    return await bookingRepository.findByIdWithDetails(id, tenantId);
  }

  /**
   * Front-desk / QR Code Check-in
   */
  async checkInBooking(id, context = {}) {
    const tenantId = context.tenantId;
    const booking = await bookingRepository.findById(id, tenantId);

    if (!booking) {
      throw new NotFoundError(`Booking with ID '${id}' not found`);
    }

    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      throw new ConflictError(`Cannot check in booking with status '${booking.status}'`);
    }

    booking.status = BOOKING_STATUS.CHECKED_IN;
    booking.checkIn = {
      isCheckedIn: true,
      checkedInAt: new Date(),
    };

    await booking.save();

    // Ensure court lights are powered ON upon front-desk check-in
    iotSchedulerService.evaluateCourtSchedules().catch((err) => {
      console.warn('[Booking] Error evaluating court schedules on booking check-in:', err.message);
    });

    return await bookingRepository.findByIdWithDetails(id, tenantId);
  }

  /**
   * Generate Itemized Invoice Payload
   */
  async getInvoice(id, context = {}) {
    const tenantId = context.tenantId;
    const booking = await bookingRepository.findByIdWithDetails(id, tenantId);

    if (!booking) {
      throw new NotFoundError(`Booking with ID '${id}' not found`);
    }

    const userRole = context.user?.role;
    const userId = context.user?.id || context.user?.sub;

    if (
      [ROLES.CUSTOMER, ROLES.MEMBER, ROLES.STUDENT, ROLES.PARENT].includes(userRole) &&
      booking.userId?._id?.toString() !== userId?.toString()
    ) {
      throw new AuthorizationError('You are not authorized to access this invoice');
    }

    const tenant = await tenantRepository.findById(tenantId);

    return {
      invoiceNumber: `INV-${booking.bookingNumber}`,
      bookingNumber: booking.bookingNumber,
      issuedAt: booking.createdAt,
      tenant: {
        name: tenant?.name || 'Sports Academy',
        slug: tenant?.slug,
        contactEmail: tenant?.contactEmail,
        contactPhone: tenant?.contactPhone,
      },
      branch: {
        name: booking.branchId?.name,
        code: booking.branchId?.code,
        timezone: booking.branchId?.timezone,
      },
      customer: {
        name: `${booking.userId?.firstName || ''} ${booking.userId?.lastName || ''}`.trim(),
        email: booking.userId?.email,
        phone: booking.userId?.phone,
      },
      bookingDetails: {
        courtName: booking.resourceId?.name,
        courtCode: booking.resourceId?.code,
        sport: booking.sportId?.name,
        date: booking.date,
        timeSlot: `${booking.startTime} - ${booking.endTime}`,
        accessPin: booking.accessCode,
      },
      lineItems: [
        {
          description: `Court Reservation: ${booking.resourceId?.name} (${booking.startTime} - ${booking.endTime})`,
          date: booking.date,
          amount: booking.pricing.basePrice,
        },
      ],
      pricing: booking.pricing,
      payment: booking.payment,
    };
  }

  /**
   * Initialize a Razorpay Payment Order for Court Slot Booking
   * Supports both single slot and multi-slot / multi-date batches
   */
  async createRazorpayOrder(data, context = {}) {
    const isMulti = Array.isArray(data.slots) && data.slots.length > 0;
    const slotsList = isMulti ? data.slots : [data];

    if (slotsList.length === 0) {
      throw new ValidationError('At least one slot is required to create a payment order');
    }

    const { resolvedTenantId: initialTenantId, primaryResource: initResource, userId, user: initialUser } =
      await this._resolveUserAndTenant(data, context, slotsList);

    if (!initialTenantId) {
      throw new ValidationError('Tenant context is required to create a payment order');
    }

    if (!userId) {
      throw new ValidationError('Authenticated user or customer details are required');
    }

    let tenantId = initialTenantId;
    let user = initialUser;
    let totalBasePrice = 0;
    const slotSummaries = [];
    let primaryResource = initResource;
    let resolvedTenantId = tenantId;

    for (let i = 0; i < slotsList.length; i++) {
      const slotItem = slotsList[i];
      if (!slotItem.resourceId || !slotItem.date || !slotItem.startTime || !slotItem.endTime) {
        throw new ValidationError(`Slot ${i + 1} requires resourceId, date, startTime, and endTime`);
      }

      let resource = await resourceRepository.findById(slotItem.resourceId, resolvedTenantId);
      if (!resource) {
        resource = await resourceRepository.findById(slotItem.resourceId);
        if (resource) {
          resolvedTenantId = resource.tenantId;
        } else {
          throw new NotFoundError(`Court/Resource with ID '${slotItem.resourceId}' not found`);
        }
      }

      if (!primaryResource) primaryResource = resource;

      if (resource.status === 'maintenance' || resource.maintenance?.isUnderMaintenance) {
        throw new ConflictError(`Court '${resource.name}' is currently under maintenance and cannot be booked`);
      }

      const isBooked = await bookingRepository.isSlotBooked(resource._id, slotItem.date, slotItem.startTime, resolvedTenantId);
      if (isBooked) {
        throw new ConflictError(`Slot ${slotItem.startTime} - ${slotItem.endTime} on ${slotItem.date} is already booked`);
      }

      const pricingDetails = slotService._calculateSlotPrice(
        resource.pricing,
        slotItem.date,
        slotItem.startTime,
        context.user
      );
      const slotBasePrice = pricingDetails.finalPrice ?? pricingDetails.basePrice ?? 0;
      totalBasePrice += slotBasePrice;

      slotSummaries.push({
        resourceId: resource._id,
        resourceName: resource.name,
        code: resource.code,
        date: slotItem.date,
        startTime: slotItem.startTime,
        endTime: slotItem.endTime,
        basePrice: slotBasePrice,
      });
    }

    const tenant = await tenantRepository.findById(resolvedTenantId);
    const taxRate = tenant?.settings?.taxPercentage ?? 18;
    const taxAmount = Math.round((totalBasePrice * taxRate) / 100);
    const discountAmount = 0;
    const totalAmount = totalBasePrice + taxAmount - discountAmount;

    // Create Razorpay Order
    const receipt = `bk_${Date.now().toString().slice(-8)}`;
    const rzpOrder = await razorpayService.createOrder({
      amount: totalAmount,
      currency: 'INR',
      receipt,
      notes: {
        type: 'booking',
        tenantId: resolvedTenantId.toString(),
        userId: userId.toString(),
        isMultiSlot: isMulti ? 'true' : 'false',
        slotsCount: slotSummaries.length.toString(),
        resourceId: primaryResource._id.toString(),
        resourceName: primaryResource.name,
        date: slotSummaries[0].date,
        startTime: slotSummaries[0].startTime,
        endTime: slotSummaries[0].endTime,
      },
      branchId: primaryResource.branchId,
      tenantId: resolvedTenantId,
    });

    if (!user) {
      user = (await userRepository.findById(userId, resolvedTenantId)) || (await userRepository.findById(userId));
    }

    const customerDetails = {
      name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : (data.name || data.customer?.name || 'Player'),
      email: user?.email || data.email || data.customer?.email || context.user?.email || '',
      phone: user?.phone || data.phone || data.customer?.phone || context.user?.phone || '',
    };

    // Single-slot backward compatible
    if (!isMulti) {
      return {
        orderId: rzpOrder.orderId,
        keyId: rzpOrder.keyId,
        amount: totalAmount,
        amountInPaise: rzpOrder.amountInPaise,
        currency: 'INR',
        receipt,
        pricing: {
          basePrice: totalBasePrice,
          taxRate,
          taxAmount,
          discountAmount,
          totalAmount,
        },
        slot: slotSummaries[0],
        customer: customerDetails,
      };
    }

    return {
      orderId: rzpOrder.orderId,
      keyId: rzpOrder.keyId,
      amount: totalAmount,
      amountInPaise: rzpOrder.amountInPaise,
      currency: 'INR',
      receipt,
      isMultiSlot: true,
      totalSlots: slotSummaries.length,
      pricing: {
        basePrice: totalBasePrice,
        taxRate,
        taxAmount,
        discountAmount,
        totalAmount,
      },
      slots: slotSummaries,
      customer: customerDetails,
    };
  }

  /**
   * Verify Razorpay payment and finalize court booking confirmation (single or multi-slot)
   */
  async verifyRazorpayPayment(data, context = {}) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = data;
    if (!razorpay_payment_id) {
      throw new ValidationError('Razorpay payment ID (razorpay_payment_id) is required');
    }

    const firstResourceId = data.resourceId || data.slots?.[0]?.resourceId;
    if (!firstResourceId) {
      throw new ValidationError('resourceId or slots array is required');
    }

    let resource = await resourceRepository.findById(firstResourceId, context.tenantId);
    if (!resource) {
      resource = await resourceRepository.findById(firstResourceId);
      if (resource) {
        context.tenantId = resource.tenantId;
      } else {
        throw new NotFoundError(`Court/Resource with ID '${firstResourceId}' not found`);
      }
    }

    // Verify HMAC-SHA256 signature
    await razorpayService.verifySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      branchId: resource.branchId,
      tenantId: context.tenantId,
    });

    // Idempotency check: If booking is already confirmed for this payment ID, return it immediately
    const existingBookings = await bookingRepository.model.find({
      'payment.transactionId': razorpay_payment_id,
    });

    if (existingBookings && existingBookings.length > 0) {
      const resolvedTenantId = existingBookings[0].tenantId;
      const populatedBookings = await Promise.all(
        existingBookings.map((b) => bookingRepository.findByIdWithDetails(b._id, resolvedTenantId))
      );
      if (existingBookings.length === 1 && !existingBookings[0].isMultiSlot) {
        return populatedBookings[0];
      }
      const first = existingBookings[0];
      return {
        _id: first._id,
        groupId: first.groupId,
        groupBookingNumber: first.groupBookingNumber || first.bookingNumber,
        bookingNumber: first.groupBookingNumber || first.bookingNumber,
        isMultiSlot: true,
        totalSlots: populatedBookings.length,
        status: first.status,
        accessCode: first.accessCode,
        qrCodeUrl: first.qrCodeUrl,
        pricing: first.pricing,
        payment: first.payment,
        bookings: populatedBookings,
        slots: populatedBookings.map((b) => ({
          id: b._id,
          bookingNumber: b.bookingNumber,
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
          courtName: b.resourceId?.name,
          courtCode: b.resourceId?.code,
          sport: b.sportId?.name,
          accessCode: b.accessCode,
          qrCodeUrl: b.qrCodeUrl,
          pricing: b.pricing,
        })),
      };
    }

    // Create confirmed booking with razorpay payment details
    return await this.createBooking(
      {
        ...data,
        paymentMethod: 'razorpay',
        razorpay_payment_id,
        razorpay_order_id,
      },
      context
    );
  }

  /**
   * Get all bookings belonging to a multi-slot group
   */
  async getBookingsByGroupId(groupId, context = {}) {
    const tenantId = context.tenantId;
    const bookings = await bookingRepository.findByGroupId(groupId, tenantId);

    if (!bookings || bookings.length === 0) {
      throw new NotFoundError(`No bookings found for group '${groupId}'`);
    }

    const userRole = context.user?.role;
    const userId = context.user?.id || context.user?.sub;

    if (
      [ROLES.CUSTOMER, ROLES.MEMBER, ROLES.STUDENT, ROLES.PARENT].includes(userRole) &&
      bookings[0].userId?._id?.toString() !== userId?.toString()
    ) {
      throw new AuthorizationError('You are not authorized to view this booking group');
    }

    return bookings;
  }

  /**
   * Generate Invoice for an entire multi-slot booking group
   */
  async getGroupInvoice(groupId, context = {}) {
    const tenantId = context.tenantId;
    const bookings = await bookingRepository.findByGroupId(groupId, tenantId);

    if (!bookings || bookings.length === 0) {
      throw new NotFoundError(`No bookings found for group '${groupId}'`);
    }

    const firstBooking = bookings[0];
    const userRole = context.user?.role;
    const userId = context.user?.id || context.user?.sub;

    if (
      [ROLES.CUSTOMER, ROLES.MEMBER, ROLES.STUDENT, ROLES.PARENT].includes(userRole) &&
      firstBooking.userId?._id?.toString() !== userId?.toString()
    ) {
      throw new AuthorizationError('You are not authorized to access this invoice');
    }

    const tenant = await tenantRepository.findById(tenantId);
    let totalBasePrice = 0;
    let totalTaxAmount = 0;
    let grandTotal = 0;

    const lineItems = bookings.map((b) => {
      totalBasePrice += b.pricing?.basePrice || 0;
      totalTaxAmount += b.pricing?.taxAmount || 0;
      grandTotal += b.pricing?.totalAmount || 0;

      return {
        bookingNumber: b.bookingNumber,
        description: `Court Reservation: ${b.resourceId?.name || 'Court'} (${b.startTime} - ${b.endTime})`,
        courtName: b.resourceId?.name,
        date: b.date,
        timeSlot: `${b.startTime} - ${b.endTime}`,
        amount: b.pricing?.basePrice || 0,
        taxAmount: b.pricing?.taxAmount || 0,
        totalAmount: b.pricing?.totalAmount || 0,
      };
    });

    return {
      invoiceNumber: `INV-${firstBooking.groupBookingNumber || firstBooking.bookingNumber}`,
      groupBookingNumber: firstBooking.groupBookingNumber || firstBooking.bookingNumber,
      groupId,
      issuedAt: firstBooking.createdAt,
      tenant: {
        name: tenant?.name || 'Sports Academy',
        slug: tenant?.slug,
        contactEmail: tenant?.contactEmail,
        contactPhone: tenant?.contactPhone,
      },
      branch: {
        name: firstBooking.branchId?.name,
        code: firstBooking.branchId?.code,
        timezone: firstBooking.branchId?.timezone,
      },
      customer: {
        name: `${firstBooking.userId?.firstName || ''} ${firstBooking.userId?.lastName || ''}`.trim(),
        email: firstBooking.userId?.email,
        phone: firstBooking.userId?.phone,
      },
      lineItems,
      pricing: {
        basePrice: totalBasePrice,
        taxRate: firstBooking.pricing?.taxRate ?? 18,
        taxAmount: totalTaxAmount,
        discountAmount: 0,
        totalAmount: grandTotal,
      },
      payment: firstBooking.payment,
    };
  }

  /**
   * Reprovision or verify hardware PIN for a confirmed booking
   */
  async reprovisionPin(bookingIdOrCode, context = {}) {
    let booking = await bookingRepository.model.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(bookingIdOrCode) ? bookingIdOrCode : null },
        { bookingNumber: bookingIdOrCode },
        { accessCode: bookingIdOrCode },
      ],
    });

    if (!booking) {
      throw new NotFoundError(`Booking '${bookingIdOrCode}' not found`);
    }

    // Find all bookings in group if multi-slot
    let groupBookings = [booking];
    if (booking.groupId) {
      groupBookings = await bookingRepository.model.find({ groupId: booking.groupId });
    }

    const allSlotDates = groupBookings.map((b) => ({
      start: new Date(`${b.date}T${b.startTime}:00`),
      end: new Date(`${b.date}T${b.endTime}:00`),
    }));
    const minStart = new Date(Math.min(...allSlotDates.map((s) => s.start.getTime())));
    const maxEnd = new Date(Math.max(...allSlotDates.map((s) => s.end.getTime())));

    const pad = (n) => String(n).padStart(2, '0');
    const formatLocal = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const bufferedStart = formatLocal(new Date(minStart.getTime() - 15 * 60000));
    const bufferedEnd = formatLocal(new Date(maxEnd.getTime() + 15 * 60000));

    // Resolve assigned device
    let assignedDevice = await Device.findOne({
      tenantId: booking.tenantId,
      branchId: booking.branchId,
      $or: [{ resourceId: booking.resourceId }, { resourceIds: booking.resourceId }],
      type: { $in: ACCESS_DEVICE_TYPES },
    });

    if (!assignedDevice && booking.sportId) {
      assignedDevice = await Device.findOne({
        tenantId: booking.tenantId,
        branchId: booking.branchId,
        $or: [{ sportId: booking.sportId }, { sportIds: booking.sportId }],
        type: { $in: ACCESS_DEVICE_TYPES },
      });
    }

    if (!assignedDevice) {
      assignedDevice = await Device.findOne({
        tenantId: booking.tenantId,
        branchId: booking.branchId,
        isDefaultEntrance: true,
        type: { $in: ACCESS_DEVICE_TYPES },
      });
    }

    if (!assignedDevice) {
      assignedDevice = await Device.findOne({
        tenantId: booking.tenantId,
        branchId: booking.branchId,
        accessScope: { $in: ['branch_entrance', 'global'] },
        type: { $in: ACCESS_DEVICE_TYPES },
      });
    }

    if (!assignedDevice) {
      assignedDevice = await Device.findOne({
        tenantId: booking.tenantId,
        branchId: booking.branchId,
        type: { $in: ACCESS_DEVICE_TYPES },
      });
    }

    if (!assignedDevice || !assignedDevice.ipAddress) {
      throw new ValidationError(`No active biometric reader or device found for booking ${booking.bookingNumber}`);
    }

    const user = await userRepository.findById(booking.userId, booking.tenantId);
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Guest';

    const client = HikvisionService.forDevice({
      ip: assignedDevice.ipAddress,
      port: assignedDevice.port || (assignedDevice.protocol === 'https' ? 443 : 80),
      username: assignedDevice.username || 'admin',
      password: assignedDevice.password || '',
      protocol: assignedDevice.protocol || (Number(assignedDevice.port) === 443 ? 'https' : 'http'),
    });

    try {
      const result = await client.assignPin({
        employeeNo: booking.accessCode,
        pin: booking.accessCode,
        beginTime: bufferedStart,
        endTime: bufferedEnd,
        userName: `${userName} (${booking.groupBookingNumber || booking.bookingNumber})`,
        doorNo: assignedDevice.doorNo || 1,
      });

      return {
        success: true,
        bookingNumber: booking.bookingNumber,
        accessCode: booking.accessCode,
        deviceName: assignedDevice.name,
        deviceCode: assignedDevice.code,
        deviceIp: assignedDevice.ipAddress,
        validFrom: bufferedStart,
        validUntil: bufferedEnd,
        deviceResponse: result,
      };
    } catch (syncErr) {
      const nextAttemptAt =
        syncErr.isLocked && syncErr.unlockTime
          ? new Date(Date.now() + (Number(syncErr.unlockTime) + 10) * 1000)
          : null;

      await deviceSyncQueueService
        .enqueueJob({
          tenantId: booking.tenantId,
          branchId: booking.branchId,
          deviceId: assignedDevice._id,
          action: 'ASSIGN_PIN',
          employeeNo: booking.accessCode,
          payload: {
            employeeNo: booking.accessCode,
            pin: booking.accessCode,
            beginTime: bufferedStart,
            endTime: bufferedEnd,
            userName: `${userName} (${booking.groupBookingNumber || booking.bookingNumber})`,
            doorNo: assignedDevice.doorNo || 1,
          },
        })
        .then(async (job) => {
          if (nextAttemptAt) {
            job.nextAttemptAt = nextAttemptAt;
            job.lastError = syncErr.message;
            await job.save();
          }
        })
        .catch(() => {});

      if (syncErr.isLocked) {
        const mins = Math.ceil((syncErr.unlockTime || 1800) / 60);
        return {
          success: false,
          queued: true,
          isLocked: true,
          unlockTime: syncErr.unlockTime,
          message: `Biometric terminal is temporarily locked for security. Sync is queued and will execute automatically in ~${mins} minutes when the lock releases.`,
          bookingNumber: booking.bookingNumber,
          accessCode: booking.accessCode,
          deviceName: assignedDevice.name,
          deviceCode: assignedDevice.code,
        };
      }
      throw syncErr;
    }
  }
}

export const bookingService = new BookingService();
