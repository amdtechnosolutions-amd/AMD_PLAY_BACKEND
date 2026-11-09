import { BaseService } from '../../core/BaseService.js';
import {
  membershipPlanRepository,
  memberSubscriptionRepository,
} from './membership.repository.js';
import { userRepository } from '../users/user.repository.js';
import { hashPassword } from '../../utils/password.js';
import { NotFoundError, ConflictError, ValidationError } from '../../errors/AppError.js';
import { ROLES, PAYMENT_STATUS } from '../../config/constants.js';
import { settingsService } from '../settings/settings.service.js';
import { wabridgeService } from '../notifications/wabridge.service.js';
import { razorpayService } from '../finance/razorpay.service.js';
import { HikvisionService, hikvisionService } from '../iot/hikvision.service.js';
import { Device } from '../iot/device.model.js';
import { deviceSyncQueueService } from '../iot/device-sync-queue.service.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { sportRepository } from '../sports/sport.repository.js';
import { Batch } from '../coaching/batch.model.js';
import { MembershipPlan } from './membershipPlan.model.js';
import { MemberSubscription } from './memberSubscription.model.js';
import { Resource } from '../resources/resource.model.js';


export class MembershipService extends BaseService {
  constructor() {
    super(membershipPlanRepository, 'MembershipPlan');
  }

  async createPlan(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    // 1. Resolve TimeSlot
    const timeSlot = data.timeSlot || {
      startTime: '06:00',
      endTime: '22:00',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      slotName: 'All Day Access',
    };

    // 2. Resolve or auto-generate unique plan code
    let finalCode = (data.code || '').trim().toUpperCase();
    if (!finalCode) {
      const tenant = await tenantRepository.findById(tenantId);
      const academyPrefix = (tenant?.code || tenant?.name || 'ISA')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 3) || 'ISA';

      let sportCode = 'MEM';
      if (data.sportId) {
        try {
          const sport =
            (await sportRepository.findById(data.sportId, tenantId)) ||
            (await sportRepository.findById(data.sportId, null));
          if (sport) {
            const s = (sport.slug || sport.name || '').toLowerCase().replace(/[^a-z]/g, '');
            if (s.includes('badminton')) sportCode = 'BD';
            else if (s.includes('cricket')) sportCode = 'CR';
            else if (s.includes('football') || s.includes('soccer')) sportCode = 'FB';
            else if (s.includes('basketball')) sportCode = 'BB';
            else if (s.includes('pickle')) sportCode = 'PB';
            else if (s.includes('tennis')) sportCode = 'TN';
            else if (s.includes('swim')) sportCode = 'SW';
            else if (s.includes('archery')) sportCode = 'ARC';
            else if (s.includes('squash')) sportCode = 'SQ';
            else sportCode = s.slice(0, 2).toUpperCase() || 'SP';
          }
        } catch (_) {}
      }

      let slotCode = '';
      if (timeSlot?.startTime) {
        const [h] = timeSlot.startTime.split(':').map(Number);
        if (h >= 5 && h < 12) slotCode = 'MORN';
        else if (h >= 12 && h < 17) slotCode = 'AFT';
        else if (h >= 17 && h < 23) slotCode = 'EVE';
      }

      const durationStr = data.durationDays ? `${data.durationDays}` : '30';
      const baseCode = slotCode
        ? `${academyPrefix}-${sportCode}-${slotCode}-${durationStr}`
        : `${academyPrefix}-${sportCode}-${durationStr}`;

      finalCode = baseCode;
      let counter = 1;
      while (await membershipPlanRepository.findByCode(finalCode, tenantId)) {
        counter += 1;
        finalCode = `${baseCode}-${String(counter).padStart(2, '0')}`;
      }
    } else {
      const existing = await membershipPlanRepository.findByCode(finalCode, tenantId);
      if (existing) {
        throw new ConflictError(`Membership plan with code '${finalCode}' already exists`);
      }
    }

    // 3. Auto-generate Hikvision Plan Template ID if not explicitly specified
    let autoHikvisionId = data.hikvisionPlanTemplateNo;
    if (!autoHikvisionId) {
      const isAllDay =
        (timeSlot.startTime === '00:00' && (timeSlot.endTime === '23:59' || timeSlot.endTime === '24:00')) ||
        (timeSlot.startTime === '06:00' && timeSlot.endTime === '22:00' && timeSlot.daysOfWeek?.length === 7);

      if (isAllDay) {
        autoHikvisionId = 1;
      } else {
        const [maxBatch, maxPlan, maxSub] = await Promise.all([
          Batch.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
            .sort({ hikvisionPlanTemplateNo: -1 })
            .select('hikvisionPlanTemplateNo')
            .lean(),
          MembershipPlan.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
            .sort({ hikvisionPlanTemplateNo: -1 })
            .select('hikvisionPlanTemplateNo')
            .lean(),
          MemberSubscription.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
            .sort({ hikvisionPlanTemplateNo: -1 })
            .select('hikvisionPlanTemplateNo')
            .lean(),
        ]);

        const highestTemplate = Math.max(
          maxBatch?.hikvisionPlanTemplateNo || 1,
          maxPlan?.hikvisionPlanTemplateNo || 1,
          maxSub?.hikvisionPlanTemplateNo || 1,
          1
        );
        autoHikvisionId = highestTemplate + 1;
      }
    }

    // 4. Resolve Court(s)
    const rawCourtId = data.courtId || data.resourceId || null;
    let courtIds = [];
    if (Array.isArray(data.courtIds) && data.courtIds.length > 0) {
      courtIds = data.courtIds.filter(Boolean);
    } else if (rawCourtId) {
      courtIds = [rawCourtId];
    }
    const finalCourtId = rawCourtId || (courtIds.length > 0 ? courtIds[0] : null);

    if (finalCourtId) {
      const court = await Resource.findOne({ _id: finalCourtId, tenantId });
      if (!court) {
        throw new NotFoundError(`Court / Resource with ID '${finalCourtId}' not found`);
      }
    }

    const plan = await membershipPlanRepository.create({
      ...data,
      code: finalCode,
      courtId: finalCourtId,
      courtIds,
      timeSlot,
      hikvisionPlanTemplateNo: autoHikvisionId,
      tenantId,
    });

    // 4. Pre-program physical biometric terminal with 15-min grace window
    if (autoHikvisionId > 1 && timeSlot?.startTime && timeSlot?.endTime) {
      try {
      const accessDeviceTypes = ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'];
        const deviceQuery = {
          tenantId,
          $or: [
            { type: { $in: accessDeviceTypes } },
            { code: /ACCESS|BIOMETRIC|HIK/i },
            { name: /ACCESS|BIOMETRIC|FACE|TURF/i },
          ],
        };
        if (data.sportId) {
          deviceQuery.$and = [
            { $or: [{ sportId: data.sportId }, { sportIds: data.sportId }, { isDefaultEntrance: true }] },
          ];
        }
        const targetDevices = await Device.find(deviceQuery);
        for (const dev of targetDevices) {
          const client = dev.ipAddress
            ? HikvisionService.forDevice({
                ip: dev.ipAddress,
                port: dev.port || (dev.code === 'DEV-ISA-ACCESS' ? 4231 : 80),
                username: dev.username || 'admin',
                password: dev.password || 'Amd@737373',
                protocol: dev.protocol || 'http',
              })
            : hikvisionService;

          await client.syncBatchScheduleWeekPlan({
            templateNo: autoHikvisionId,
            schedule: timeSlot,
            name: (plan.code || `PLAN_${autoHikvisionId}`).slice(0, 32),
            bufferMinutes: 15,
          });
        }
      } catch (syncErr) {
        console.warn('[MembershipPlan] Hardware pre-sync notice:', syncErr.message);
      }
    }

    await plan.populate([
      { path: 'sportId', select: 'name slug type' },
      { path: 'courtId', select: 'name code surface type' },
      { path: 'courtIds', select: 'name code surface type' },
    ]);

    return plan;
  }

  async update(id, data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const plan = await membershipPlanRepository.findById(id, tenantId);
    if (!plan) {
      throw new NotFoundError(`Membership plan with ID '${id}' not found`);
    }

    let planTemplateNo = data.hikvisionPlanTemplateNo || plan.hikvisionPlanTemplateNo;
    const timeSlot = data.timeSlot || plan.timeSlot;

    if (!planTemplateNo && timeSlot?.startTime && timeSlot?.endTime) {
      const isAllDay =
        (timeSlot.startTime === '00:00' && (timeSlot.endTime === '23:59' || timeSlot.endTime === '24:00')) ||
        (timeSlot.startTime === '06:00' && timeSlot.endTime === '22:00' && timeSlot.daysOfWeek?.length === 7);

      if (isAllDay) {
        planTemplateNo = 1;
      } else {
        const [maxBatch, maxPlan, maxSub] = await Promise.all([
          Batch.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
            .sort({ hikvisionPlanTemplateNo: -1 })
            .select('hikvisionPlanTemplateNo')
            .lean(),
          MembershipPlan.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
            .sort({ hikvisionPlanTemplateNo: -1 })
            .select('hikvisionPlanTemplateNo')
            .lean(),
          MemberSubscription.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
            .sort({ hikvisionPlanTemplateNo: -1 })
            .select('hikvisionPlanTemplateNo')
            .lean(),
        ]);
        const highestTemplate = Math.max(
          maxBatch?.hikvisionPlanTemplateNo || 1,
          maxPlan?.hikvisionPlanTemplateNo || 1,
          maxSub?.hikvisionPlanTemplateNo || 1,
          1
        );
        planTemplateNo = highestTemplate + 1;
      }
    }

    // Resolve court updates
    let courtUpdate = {};
    if (data.courtId !== undefined || data.resourceId !== undefined || data.courtIds !== undefined) {
      const rawCourtId = data.courtId || data.resourceId || null;
      let courtIds = [];
      if (Array.isArray(data.courtIds)) {
        courtIds = data.courtIds.filter(Boolean);
      } else if (rawCourtId) {
        courtIds = [rawCourtId];
      }
      const finalCourtId = rawCourtId || (courtIds.length > 0 ? courtIds[0] : null);
      if (finalCourtId) {
        const court = await Resource.findOne({ _id: finalCourtId, tenantId });
        if (!court) {
          throw new NotFoundError(`Court / Resource with ID '${finalCourtId}' not found`);
        }
      }
      courtUpdate = { courtId: finalCourtId, courtIds };
    }

    const updatedPlan = await membershipPlanRepository.updateById(
      id,
      {
        ...data,
        ...courtUpdate,
        ...(planTemplateNo ? { hikvisionPlanTemplateNo: planTemplateNo } : {}),
      },
      tenantId
    );

    if (updatedPlan) {
      await updatedPlan.populate([
        { path: 'sportId', select: 'name slug type' },
        { path: 'courtId', select: 'name code surface type' },
        { path: 'courtIds', select: 'name code surface type' },
      ]);
    }

    if (planTemplateNo > 1 && timeSlot?.startTime && timeSlot?.endTime) {
      try {
      const accessDeviceTypes = ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'];
        const deviceQuery = {
          tenantId,
          $or: [
            { type: { $in: accessDeviceTypes } },
            { code: /ACCESS|BIOMETRIC|HIK/i },
            { name: /ACCESS|BIOMETRIC|FACE|TURF/i },
          ],
        };
        const sportId = updatedPlan.sportId || plan.sportId;
        if (sportId) {
          deviceQuery.$and = [
            { $or: [{ sportId }, { sportIds: sportId }, { isDefaultEntrance: true }] },
          ];
        }
        const targetDevices = await Device.find(deviceQuery);
        for (const dev of targetDevices) {
          const client = dev.ipAddress
            ? HikvisionService.forDevice({
                ip: dev.ipAddress,
                port: dev.port || (dev.code === 'DEV-ISA-ACCESS' ? 4231 : 80),
                username: dev.username || 'admin',
                password: dev.password || 'Amd@737373',
                protocol: dev.protocol || 'http',
              })
            : hikvisionService;

          await client.syncBatchScheduleWeekPlan({
            templateNo: planTemplateNo,
            schedule: timeSlot,
            name: (updatedPlan.code || plan.code).slice(0, 32),
            bufferMinutes: 15,
          });
        }
      } catch (syncErr) {
        console.warn('[MembershipPlan] Hardware update sync notice:', syncErr.message);
      }
    }

    return updatedPlan;
  }

  async listActivePlans(tenantId) {
    return await membershipPlanRepository.findActivePlans(tenantId);
  }

  async subscribeUser(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const targetUserId = data.userId || context.user?.id || context.user?.sub;
    if (!targetUserId) {
      throw new ValidationError('User ID is required for membership subscription');
    }

    // 1. Verify Plan
    const plan = await membershipPlanRepository.findById(data.planId, tenantId);
    if (!plan || plan.status !== 'active') {
      throw new NotFoundError(`Active membership plan with ID '${data.planId}' not found`);
    }

    // 2. Verify User
    const user = await userRepository.findById(targetUserId, tenantId);
    if (!user) {
      throw new NotFoundError(`User with ID '${targetUserId}' not found`);
    }

    // 3. Compute Dates
    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    // 4. Resolve Time Slot & Grace Window Buffer
    const rawSlot = data.timeSlot || {};
    const startTime = (rawSlot.startTime || data.startTime || plan.timeSlot?.startTime || '06:00').trim();
    const endTime = (rawSlot.endTime || data.endTime || plan.timeSlot?.endTime || '22:00').trim();
    const daysOfWeek = rawSlot.daysOfWeek || data.daysOfWeek || plan.timeSlot?.daysOfWeek || [1, 2, 3, 4, 5, 6, 7];
    const isAllDay =
      (startTime === '00:00' && (endTime === '23:59' || endTime === '24:00')) ||
      (startTime === '06:00' && endTime === '22:00' && daysOfWeek.length === 7);
    const slotName =
      rawSlot.slotName ||
      data.slotName ||
      plan.timeSlot?.slotName ||
      (isAllDay ? 'All Day Access' : `${startTime} - ${endTime}`);

    const resolvedTimeSlot = {
      startTime,
      endTime,
      daysOfWeek: Array.isArray(daysOfWeek) && daysOfWeek.length > 0 ? daysOfWeek : [1, 2, 3, 4, 5, 6, 7],
      slotName,
    };

    // 5. Resolve or Allocate Hikvision PlanTemplateNo (1 = 24/7 all day, 2+ = slot-specific week plan)
    let planTemplateNo = 1;
    if (!isAllDay) {
      if (
        plan.hikvisionPlanTemplateNo &&
        (!data.startTime ||
          (data.startTime === plan.timeSlot?.startTime && data.endTime === plan.timeSlot?.endTime))
      ) {
        planTemplateNo = plan.hikvisionPlanTemplateNo;
      } else {
        const existingSlotSub = await MemberSubscription.findOne({
          tenantId,
          'timeSlot.startTime': startTime,
          'timeSlot.endTime': endTime,
          hikvisionPlanTemplateNo: { $gt: 1 },
        });

        if (existingSlotSub && existingSlotSub.hikvisionPlanTemplateNo) {
          planTemplateNo = existingSlotSub.hikvisionPlanTemplateNo;
        } else {
          const [maxBatch, maxPlan, maxSub] = await Promise.all([
            Batch.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
              .sort({ hikvisionPlanTemplateNo: -1 })
              .select('hikvisionPlanTemplateNo')
              .lean(),
            MembershipPlan.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
              .sort({ hikvisionPlanTemplateNo: -1 })
              .select('hikvisionPlanTemplateNo')
              .lean(),
            MemberSubscription.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
              .sort({ hikvisionPlanTemplateNo: -1 })
              .select('hikvisionPlanTemplateNo')
              .lean(),
          ]);

          const highestTemplate = Math.max(
            maxBatch?.hikvisionPlanTemplateNo || 1,
            maxPlan?.hikvisionPlanTemplateNo || 1,
            maxSub?.hikvisionPlanTemplateNo || 1,
            1
          );
          planTemplateNo = highestTemplate + 1;

          if (
            !plan.hikvisionPlanTemplateNo &&
            (!data.startTime || data.startTime === plan.timeSlot?.startTime)
          ) {
            plan.hikvisionPlanTemplateNo = planTemplateNo;
            await plan.save();
          }
        }
      }
    }

    // 6. Resolve Court(s)
    const rawCourtId = data.courtId || data.resourceId || plan.courtId || null;
    let courtIds = [];
    if (Array.isArray(data.courtIds) && data.courtIds.length > 0) {
      courtIds = data.courtIds.filter(Boolean);
    } else if (rawCourtId) {
      courtIds = [rawCourtId];
    } else if (Array.isArray(plan.courtIds) && plan.courtIds.length > 0) {
      courtIds = plan.courtIds;
    }
    const finalCourtId = rawCourtId || (courtIds.length > 0 ? courtIds[0] : null);

    if (finalCourtId) {
      const court = await Resource.findOne({ _id: finalCourtId, tenantId });
      if (!court) {
        throw new NotFoundError(`Court / Resource with ID '${finalCourtId}' not found`);
      }
    }

    // 7. Create Subscription
    const subscription = await memberSubscriptionRepository.create({
      tenantId,
      userId: targetUserId,
      planId: plan._id,
      branchId: data.branchId || user.branchId || null,
      sportId: data.sportId || plan.sportId || null,
      courtId: finalCourtId,
      courtIds,
      startDate,
      endDate,
      pricePaid: plan.price,
      paymentStatus: PAYMENT_STATUS.SUCCESS,
      status: 'active',
      timeSlot: resolvedTimeSlot,
      hikvisionPlanTemplateNo: planTemplateNo,
      notes: data.notes || `Subscribed to ${plan.name} (${plan.durationDays} days) - Slot: ${slotName}`,
    });

    // 7. Record formal transaction in Ledger Payment collection
    try {
      const rawMethod = (data.paymentMethod || (data.razorpay_payment_id ? 'upi' : 'upi')).toLowerCase();
      const method = ['upi', 'card', 'cash', 'netbanking', 'wallet'].includes(rawMethod) ? rawMethod : 'upi';
      const gateway = data.razorpay_payment_id || data.razorpay_order_id ? 'razorpay' : (method === 'cash' ? 'cash' : 'manual');

      await razorpayService.recordPayment({
        tenantId,
        branchId: user.branchId || data.branchId || null,
        userId: targetUserId,
        amount: plan.price,
        currency: 'INR',
        type: 'membership',
        referenceId: subscription._id.toString(),
        paymentMethod: method,
        gateway,
        gatewayOrderId: data.razorpay_order_id || '',
        gatewayPaymentId: data.razorpay_payment_id || `MEM_TXN_${subscription._id}`,
        status: 'success',
        notes: `Membership Subscription: ${plan.name}`,
        metadata: {
          subscriptionId: subscription._id.toString(),
          planId: plan._id.toString(),
          planName: plan.name,
          durationDays: plan.durationDays,
          timeSlot: resolvedTimeSlot,
          planTemplateNo,
        },
      });
    } catch (payErr) {
      console.warn('[Membership] Ledger payment record warning:', payErr.message);
    }

    // 7.1 Create MonthlyFee invoice for the member (Option A prorated if joined after 20th)
    try {
      const { monthlyFeeGeneratorService } = await import('../finance/monthly-fee-generator.service.js');
      await monthlyFeeGeneratorService.createJoinerFee({
        tenantId,
        branchId: subscription.branchId,
        userId: targetUserId,
        feeType: 'court_member',
        subscriptionId: subscription._id,
        planId: plan._id,
        sportId: subscription.sportId,
        baseFee: plan.price,
        discount: 0,
        joinDate: startDate,
        status: subscription.paymentStatus === PAYMENT_STATUS.SUCCESS ? 'paid' : 'pending',
        notes: `Option A Member Fee: ${plan.name}`,
      });
    } catch (feeErr) {
      console.warn('[Membership] Joiner fee invoice creation notice:', feeErr.message);
    }

    // 8. Update User Credentials (PIN, Card, EmployeeNo, Role)
    let userNeedsSave = false;
    if (data.pin && (!user.pin || user.pin !== data.pin)) {
      user.pin = data.pin;
      userNeedsSave = true;
    }
    if (data.cardNo && String(data.cardNo).trim() && user.cardNo !== String(data.cardNo).trim()) {
      user.cardNo = String(data.cardNo).trim();
      userNeedsSave = true;
    }
    if (data.employeeNo && (!user.employeeNo || user.employeeNo !== data.employeeNo)) {
      user.employeeNo = data.employeeNo;
      userNeedsSave = true;
    }
    if (data.branchId && !user.branchId) {
      user.branchId = data.branchId;
      userNeedsSave = true;
    }
    if (user.role === ROLES.CUSTOMER) {
      user.role = ROLES.MEMBER;
      userNeedsSave = true;
    }
    if (userNeedsSave) {
      await user.save();
    }

    // 9. Sync Member credentials & Schedule WeekPlan to relevant Hikvision Biometric terminals
    try {
      const fullName = `${user.firstName} ${user.lastName || ''}`.trim();
      const empNo = user.employeeNo || data.employeeNo || user.phone || user._id.toString().slice(-6);
      const memberPin = user.pin || data.pin || user.cardNo || '';
      const cardNo = user.cardNo || data.cardNo || '';

      const resolvedBranchId = data.branchId || user.branchId;
      const resolvedSportId = data.sportId || plan.sportId;

      const accessDeviceTypes = ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'];
      const deviceQuery = {
        tenantId,
        $or: [
          { type: { $in: accessDeviceTypes } },
          { code: /ACCESS|BIOMETRIC|HIK/i },
          { name: /ACCESS|BIOMETRIC|FACE|TURF/i },
        ],
      };
      if (resolvedBranchId) {
        deviceQuery.branchId = resolvedBranchId;
      }
      if (resolvedSportId) {
        deviceQuery.$and = [
          {
            $or: [
              { sportId: resolvedSportId },
              { sportIds: resolvedSportId },
              { isDefaultEntrance: true },
            ],
          },
        ];
      }
      let targetDevices = await Device.find(deviceQuery);
      if (!targetDevices || targetDevices.length === 0) {
        targetDevices = await Device.find({
          tenantId,
          $or: [
            { type: { $in: accessDeviceTypes } },
            { code: /ACCESS|BIOMETRIC|HIK/i },
            { name: /ACCESS|BIOMETRIC|FACE|TURF/i },
          ],
        });
      }

      console.log(`[Member Sync] Found ${targetDevices.length} access device(s) to sync for ${empNo} (${fullName})`);

      for (const dev of targetDevices) {
        const client = dev.ipAddress
          ? HikvisionService.forDevice({
              ip: dev.ipAddress,
              port: dev.port || (dev.code === 'DEV-ISA-ACCESS' ? 4231 : 80),
              username: dev.username || 'admin',
              password: dev.password || 'Amd@737373',
              protocol: dev.protocol || 'http',
            })
          : hikvisionService;

        try {
          // Program slot week plan and plan template with 15-minute grace window buffer on device
          if (resolvedTimeSlot && planTemplateNo > 1) {
            try {
              await client.syncBatchScheduleWeekPlan({
                templateNo: planTemplateNo,
                schedule: resolvedTimeSlot,
                name: (plan.code || `MEM_SLOT_${planTemplateNo}`).slice(0, 32),
                bufferMinutes: 15,
              });
            } catch (schedErr) {
              console.warn(`[Hikvision Member Sync] Week plan sync notice for ${dev.name}:`, schedErr.message);
            }
          }

          // Program Person with Keypad PIN, Card, and PlanTemplateNo
          await client.recordPerson({
            employeeNo: empNo,
            name: fullName,
            role: 'member',
            userType: 'normal',
            pin: memberPin,
            cardNo,
            planTemplateNo,
            beginTime: subscription.startDate ? new Date(subscription.startDate).toISOString().slice(0, 19) : undefined,
            endTime: subscription.endDate ? new Date(subscription.endDate).toISOString().slice(0, 19) : undefined,
          });

          // Program Smartcard
          if (cardNo) {
            await client.recordCard({
              employeeNo: empNo,
              cardNo,
            });
          }
        } catch (uploadErr) {
          console.warn(`[Hikvision Member Sync] Non-blocking upload warning for ${dev.name}:`, uploadErr.message);
          await deviceSyncQueueService.enqueueJob({
            tenantId,
            branchId: dev.branchId,
            deviceId: dev._id,
            action: 'ADD_USER',
            employeeNo: empNo,
            payload: {
              employeeNo: empNo,
              name: fullName,
              role: 'member',
              userType: 'normal',
              cardNo,
              pin: memberPin,
              planTemplateNo,
            },
          });
        }
      }
    } catch (syncErr) {
      console.warn('[Hikvision Member Sync] Non-blocking warning:', syncErr.message);
    }

    return await memberSubscriptionRepository.findById(subscription._id, tenantId);
  }


  async registerMember(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    // 1. Verify Plan
    const plan = await membershipPlanRepository.findById(data.planId, tenantId);
    if (!plan || plan.status !== 'active') {
      throw new NotFoundError(`Active membership plan with ID '${data.planId}' not found`);
    }

    const sportId = data.sportId || plan.sportId || null;
    const branchId = data.branchId || null;

    // 2. Resolve or generate auto employeeNo (e.g. isamem001 or isambd001)
    let finalEmployeeNo = (data.employeeNo || '').trim();
    if (!finalEmployeeNo) {
      const tenant = await tenantRepository.findById(tenantId);
      const academyPrefix = (tenant?.code || tenant?.name || 'isa')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 3) || 'isa';

      let sportCode = 'mem';
      if (sportId) {
        try {
          const sport =
            (await sportRepository.findById(sportId, tenantId)) ||
            (await sportRepository.findById(sportId, null));
          if (sport) {
            const s = (sport.slug || sport.name || '').toLowerCase().replace(/[^a-z]/g, '');
            if (s.includes('badminton')) sportCode = 'bd';
            else if (s.includes('cricket')) sportCode = 'cr';
            else if (s.includes('football') || s.includes('soccer')) sportCode = 'fb';
            else if (s.includes('basketball')) sportCode = 'bb';
            else if (s.includes('pickle')) sportCode = 'pb';
            else if (s.includes('tennis')) sportCode = 'tn';
            else if (s.includes('swim')) sportCode = 'sw';
            else if (s.includes('archery')) sportCode = 'arc';
            else if (s.includes('rifle') || s.includes('shoot')) sportCode = 'rif';
            else if (s.includes('skat')) sportCode = 'ska';
            else sportCode = s.slice(0, 2) || 'bd';
          }
        } catch (_) {}
      }

      const prefix = sportCode !== 'mem'
        ? `${academyPrefix}m${sportCode}`.toLowerCase()
        : `${academyPrefix}mem`.toLowerCase();

      let nextSeq = 1;
      try {
        const latestMember = await userRepository.model
          .findOne({
            tenantId,
            role: ROLES.MEMBER,
            employeeNo: new RegExp(`^${prefix}\\d+$`, 'i'),
          })
          .sort({ employeeNo: -1 })
          .exec();

        if (latestMember && latestMember.employeeNo) {
          const numPart = parseInt(latestMember.employeeNo.replace(new RegExp(`^${prefix}`, 'i'), ''), 10);
          if (!isNaN(numPart)) {
            nextSeq = numPart + 1;
          }
        } else {
          const existingCount = await userRepository.count({
            tenantId,
            role: ROLES.MEMBER,
            employeeNo: new RegExp(`^${prefix}`, 'i'),
          });
          nextSeq = existingCount + 1;
        }
      } catch (_) {
        nextSeq = 1;
      }

      finalEmployeeNo = `${prefix}${String(nextSeq).padStart(3, '0')}`;
    }

    // 3. Resolve 6-digit keypad PIN and CardNo
    let finalPin = (data.pin || data.cardNo || '').trim();
    if (!finalPin) {
      finalPin = String(Math.floor(100000 + Math.random() * 900000));
    }

    let finalCardNo = (data.cardNo || finalPin).trim();
    if (!finalCardNo) {
      finalCardNo = finalPin;
    }

    let memberUser = null;
    if (data.userId) {
      memberUser = await userRepository.findById(data.userId, tenantId);
      if (!memberUser) {
        throw new NotFoundError(`User with ID '${data.userId}' not found`);
      }
      let needsSave = false;
      if (finalEmployeeNo && memberUser.employeeNo !== finalEmployeeNo) {
        memberUser.employeeNo = finalEmployeeNo;
        needsSave = true;
      }
      if (data.pin && data.pin.trim() && memberUser.pin !== data.pin.trim()) {
        memberUser.pin = data.pin.trim();
        needsSave = true;
      } else if (!memberUser.pin) {
        memberUser.pin = finalPin;
        needsSave = true;
      }
      if (data.cardNo && data.cardNo.trim() && memberUser.cardNo !== data.cardNo.trim()) {
        memberUser.cardNo = data.cardNo.trim();
        needsSave = true;
      } else if (!memberUser.cardNo) {
        memberUser.cardNo = finalCardNo;
        needsSave = true;
      }
      if (branchId && !memberUser.branchId) {
        memberUser.branchId = branchId;
        needsSave = true;
      }
      if (memberUser.role !== ROLES.MEMBER) {
        memberUser.role = ROLES.MEMBER;
        needsSave = true;
      }
      if (needsSave) {
        await memberUser.save();
      }
    } else {
      if (!data.firstName || !data.firstName.trim()) {
        throw new ValidationError('Member first name is required');
      }

      const email = (data.email || `member_${Date.now()}@amdplay.local`).toLowerCase().trim();
      const phoneOrVariants = [];
      if (data.phone && data.phone.trim()) {
        const cleanPhone = data.phone.trim();
        const digits = cleanPhone.replace(/\D/g, '');
        phoneOrVariants.push({ phone: cleanPhone });
        if (digits.length === 10) {
          phoneOrVariants.push({ phone: digits }, { phone: `+91${digits}` }, { phone: `91${digits}` });
        }
      }

      const existingUser = await userRepository.findOne({
        tenantId,
        $or: [
          { email },
          ...phoneOrVariants,
        ],
      });

      if (existingUser) {
        memberUser = existingUser;
        let needsSave = false;
        if (memberUser.role !== ROLES.MEMBER) {
          memberUser.role = ROLES.MEMBER;
          needsSave = true;
        }
        if (finalEmployeeNo && memberUser.employeeNo !== finalEmployeeNo) {
          memberUser.employeeNo = finalEmployeeNo;
          needsSave = true;
        }
        if (data.pin && data.pin.trim() && memberUser.pin !== data.pin.trim()) {
          memberUser.pin = data.pin.trim();
          needsSave = true;
        } else if (!memberUser.pin) {
          memberUser.pin = finalPin;
          needsSave = true;
        }
        if (data.cardNo && data.cardNo.trim() && memberUser.cardNo !== data.cardNo.trim()) {
          memberUser.cardNo = data.cardNo.trim();
          needsSave = true;
        } else if (!memberUser.cardNo) {
          memberUser.cardNo = finalCardNo;
          needsSave = true;
        }
        if (branchId && !memberUser.branchId) {
          memberUser.branchId = branchId;
          needsSave = true;
        }
        if (needsSave) {
          await memberUser.save();
        }
      } else {
        const hashedPassword = await hashPassword('Member123!');
        memberUser = await userRepository.create({
          tenantId,
          branchId: branchId || null,
          firstName: data.firstName.trim(),
          lastName: (data.lastName || '').trim(),
          email,
          phone: data.phone || '',
          password: hashedPassword,
          role: ROLES.MEMBER,
          status: 'active',
          employeeNo: finalEmployeeNo,
          cardNo: finalCardNo,
          pin: finalPin,
        });
      }
    }

    // 4. Activate subscription for this member with resolved credentials and time slot
    const subscription = await this.subscribeUser(
      {
        planId: data.planId,
        userId: memberUser._id.toString(),
        paymentMethod: data.paymentMethod || 'upi',
        branchId: branchId || memberUser.branchId,
        sportId,
        courtId: data.courtId || data.resourceId,
        courtIds: data.courtIds,
        pin: finalPin,
        cardNo: finalCardNo,
        employeeNo: finalEmployeeNo,
        timeSlot: data.timeSlot,
        startTime: data.startTime,
        endTime: data.endTime,
        daysOfWeek: data.daysOfWeek,
        slotName: data.slotName,
        startDate: data.startDate,
        notes: data.notes,
      },
      context
    );

    // 5. Send WhatsApp membership confirmation with biometric credentials & time slot
    try {
      const tenantSettings = await settingsService.getSettings(tenantId);
      if (tenantSettings?.whatsapp?.enabled && memberUser.phone) {
        const planName = subscription?.planId?.name || plan?.name || 'Sports Membership';
        const daysMap = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
        const slotDays =
          subscription?.timeSlot?.daysOfWeek?.map((d) => daysMap[d] || d).join(', ') || 'Mon - Sun';
        const slotWindow =
          subscription?.timeSlot?.startTime && subscription?.timeSlot?.endTime
            ? `${subscription.timeSlot.startTime} - ${subscription.timeSlot.endTime} (${slotDays})`
            : 'Full Day Access';

        const parseTime = (timeStr) => {
          const [h, m] = (timeStr || '06:00').split(':').map(Number);
          return h * 60 + (m || 0);
        };
        const formatTime = (totalMinutes) => {
          let clamped = Math.max(0, Math.min(1439, totalMinutes));
          const h = String(Math.floor(clamped / 60)).padStart(2, '0');
          const m = String(clamped % 60).padStart(2, '0');
          return `${h}:${m}`;
        };

        const bufferInfo = subscription?.timeSlot?.startTime
          ? ` (Gate Entry Window: ${formatTime(parseTime(subscription.timeSlot.startTime) - 15)} - ${formatTime(parseTime(subscription.timeSlot.endTime) + 15)})`
          : '';

        let courtInfoStr = '';
        if (subscription?.courtId) {
          const courtDoc = await Resource.findById(subscription.courtId).select('name code').lean();
          if (courtDoc) {
            courtInfoStr = `\n🏟️ *Court Assigned:* *${courtDoc.name} (${courtDoc.code})*`;
          }
        }

        const msg =
          `🏅 *Membership Activated! - ${tenantSettings?.academyName || 'Apex Sports Academy'}*\n\n` +
          `Dear ${memberUser.firstName},\n` +
          `Your membership for *${planName}* has been successfully activated.\n\n` +
          `🔑 *Biometric ID:* *${memberUser.employeeNo || finalEmployeeNo}*\n` +
          `🔢 *Keypad Access PIN:* *${memberUser.pin || finalPin}*\n` +
          `💳 *Member Card / NFC:* *${memberUser.cardNo || finalCardNo}*\n` +
          `⏰ *Assigned Slot:* *${slotWindow}*${bufferInfo}${courtInfoStr}\n` +
          `📅 *Valid Until:* ${subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : 'Active'}\n\n` +
          `Use your Keypad PIN, card or biometric scan at the entrance to access the court. Welcome!`;

        await wabridgeService.sendTextMessage({
          destinationNumber: memberUser.phone,
          message: msg,
          credentials: {
            appKey: tenantSettings.whatsapp.appKey,
            authKey: tenantSettings.whatsapp.authKey,
            deviceId: tenantSettings.whatsapp.deviceId,
          },
        });
      }
    } catch (waErr) {
      console.warn('WhatsApp member registration error:', waErr.message);
    }

    return {
      member: {
        _id: memberUser._id,
        firstName: memberUser.firstName,
        lastName: memberUser.lastName,
        name: `${memberUser.firstName} ${memberUser.lastName || ''}`.trim(),
        email: memberUser.email,
        phone: memberUser.phone,
        role: memberUser.role,
        employeeNo: memberUser.employeeNo || finalEmployeeNo,
        cardNo: memberUser.cardNo || finalCardNo,
        pin: memberUser.pin || finalPin,
      },
      subscription,
    };
  }

  async assignSubscriptionTimeSlot(subscriptionId, data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const subscription = await memberSubscriptionRepository.findById(subscriptionId, tenantId);
    if (!subscription) {
      throw new NotFoundError(`Member subscription with ID '${subscriptionId}' not found`);
    }

    const startTime = (data.startTime || subscription.timeSlot?.startTime || '06:00').trim();
    const endTime = (data.endTime || subscription.timeSlot?.endTime || '22:00').trim();
    const daysOfWeek = data.daysOfWeek || subscription.timeSlot?.daysOfWeek || [1, 2, 3, 4, 5, 6, 7];
    const isAllDay =
      (startTime === '00:00' && (endTime === '23:59' || endTime === '24:00')) ||
      (startTime === '06:00' && endTime === '22:00' && daysOfWeek.length === 7);
    const slotName = data.slotName || (isAllDay ? 'All Day Access' : `${startTime} - ${endTime}`);

    const resolvedTimeSlot = {
      startTime,
      endTime,
      daysOfWeek: Array.isArray(daysOfWeek) && daysOfWeek.length > 0 ? daysOfWeek : [1, 2, 3, 4, 5, 6, 7],
      slotName,
    };

    let planTemplateNo = subscription.hikvisionPlanTemplateNo;
    if (!isAllDay && (!planTemplateNo || planTemplateNo <= 1)) {
      const [maxBatch, maxPlan, maxSub] = await Promise.all([
        Batch.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
          .sort({ hikvisionPlanTemplateNo: -1 })
          .select('hikvisionPlanTemplateNo')
          .lean(),
        MembershipPlan.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
          .sort({ hikvisionPlanTemplateNo: -1 })
          .select('hikvisionPlanTemplateNo')
          .lean(),
        MemberSubscription.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
          .sort({ hikvisionPlanTemplateNo: -1 })
          .select('hikvisionPlanTemplateNo')
          .lean(),
      ]);

      const highestTemplate = Math.max(
        maxBatch?.hikvisionPlanTemplateNo || 1,
        maxPlan?.hikvisionPlanTemplateNo || 1,
        maxSub?.hikvisionPlanTemplateNo || 1,
        1
      );
      planTemplateNo = highestTemplate + 1;
    } else if (isAllDay) {
      planTemplateNo = 1;
    }

    if (data.courtId !== undefined || data.resourceId !== undefined || data.courtIds !== undefined) {
      const rawCourtId = data.courtId || data.resourceId || null;
      let courtIds = [];
      if (Array.isArray(data.courtIds)) {
        courtIds = data.courtIds.filter(Boolean);
      } else if (rawCourtId) {
        courtIds = [rawCourtId];
      }
      const finalCourtId = rawCourtId || (courtIds.length > 0 ? courtIds[0] : null);
      if (finalCourtId) {
        const court = await Resource.findOne({ _id: finalCourtId, tenantId });
        if (!court) {
          throw new NotFoundError(`Court / Resource with ID '${finalCourtId}' not found`);
        }
      }
      subscription.courtId = finalCourtId;
      subscription.courtIds = courtIds;
    }

    subscription.timeSlot = resolvedTimeSlot;
    subscription.hikvisionPlanTemplateNo = planTemplateNo;
    await subscription.save();

    // Sync to biometric terminals
    const user = await userRepository.findById(subscription.userId, tenantId);
    if (user) {
      const empNo = user.employeeNo || user.phone || user._id.toString().slice(-6);
      const memberPin = user.pin || user.cardNo || '';
      const fullName = `${user.firstName} ${user.lastName || ''}`.trim();

      const accessDeviceTypes = ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'];
      const deviceQuery = {
        tenantId,
        $or: [
          { type: { $in: accessDeviceTypes } },
          { code: /ACCESS|BIOMETRIC|HIK/i },
          { name: /ACCESS|BIOMETRIC|FACE|TURF/i },
        ],
      };
      if (subscription.branchId) deviceQuery.branchId = subscription.branchId;
      if (subscription.sportId) {
        deviceQuery.$and = [
          { $or: [{ sportId: subscription.sportId }, { sportIds: subscription.sportId }, { isDefaultEntrance: true }] },
        ];
      }

      let targetDevices = await Device.find(deviceQuery);
      if (!targetDevices || targetDevices.length === 0) {
        targetDevices = await Device.find({
          tenantId,
          $or: [
            { type: { $in: accessDeviceTypes } },
            { code: /ACCESS|BIOMETRIC|HIK/i },
            { name: /ACCESS|BIOMETRIC|FACE|TURF/i },
          ],
        });
      }

      for (const dev of targetDevices) {
        const client = dev.ipAddress
          ? HikvisionService.forDevice({
              ip: dev.ipAddress,
              port: dev.port || (dev.code === 'DEV-ISA-ACCESS' ? 4231 : 80),
              username: dev.username || 'admin',
              password: dev.password || 'Amd@737373',
              protocol: dev.protocol || 'http',
            })
          : hikvisionService;

        try {
          if (resolvedTimeSlot && planTemplateNo > 1) {
            await client.syncBatchScheduleWeekPlan({
              templateNo: planTemplateNo,
              schedule: resolvedTimeSlot,
              name: `MEM_${empNo}_Slot`.slice(0, 32),
              bufferMinutes: 15,
            });
          }

          await client.recordPerson({
            employeeNo: empNo,
            name: fullName,
            role: 'member',
            userType: 'normal',
            pin: memberPin,
            cardNo: user.cardNo,
            planTemplateNo,
            beginTime: subscription.startDate ? new Date(subscription.startDate).toISOString().slice(0, 19) : undefined,
            endTime: subscription.endDate ? new Date(subscription.endDate).toISOString().slice(0, 19) : undefined,
          });

          if (user.cardNo) {
            await client.recordCard({
              employeeNo: empNo,
              cardNo: user.cardNo,
            });
          }
        } catch (syncErr) {
          console.warn(`[Hikvision Slot Reassign] Warning for ${dev.name}:`, syncErr.message);
        }
      }
    }

    const updatedSub = await memberSubscriptionRepository.findById(subscription._id, tenantId);
    if (updatedSub) {
      await updatedSub.populate([
        { path: 'courtId', select: 'name code surface type' },
        { path: 'courtIds', select: 'name code surface type' },
        { path: 'planId', select: 'name code durationDays price timeSlot' },
        { path: 'userId', select: 'firstName lastName email phone employeeNo cardNo pin' },
      ]);
    }
    return updatedSub;
  }

  async getUserActiveMembership(userId, tenantId) {
    return await memberSubscriptionRepository.findActiveUserSubscription(userId, tenantId);
  }

  async getMySubscriptions(context = {}) {
    const tenantId = context.tenantId;
    const userId = context.user?.id || context.user?.sub;
    return await memberSubscriptionRepository.findUserSubscriptions(userId, tenantId);
  }

  async listAllSubscriptions(context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }
    return await memberSubscriptionRepository.findAllSubscriptions(tenantId);
  }

  /**
   * Initialize a Razorpay Payment Order for Membership Subscription
   */
  async createRazorpayOrder(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required to initialize payment');
    }

    const userId = data.userId || context.user?.id || context.user?.sub;
    if (!userId) {
      throw new ValidationError('User ID or authenticated user is required');
    }

    const plan = await membershipPlanRepository.findById(data.planId, tenantId);
    if (!plan || plan.status !== 'active') {
      throw new NotFoundError(`Active membership plan with ID '${data.planId}' not found`);
    }

    const user = await userRepository.findById(userId, tenantId);
    if (!user) {
      throw new NotFoundError(`User with ID '${userId}' not found`);
    }

    const totalAmount = plan.price;
    const receipt = `mem_${Date.now().toString().slice(-8)}`;

    const rzpOrder = await razorpayService.createOrder({
      amount: totalAmount,
      currency: 'INR',
      receipt,
      notes: {
        type: 'membership',
        tenantId: tenantId.toString(),
        userId: userId.toString(),
        planId: plan._id.toString(),
        planName: plan.name,
        durationDays: plan.durationDays,
      },
      branchId: user.branchId || null,
      tenantId,
    });

    return {
      orderId: rzpOrder.orderId,
      keyId: rzpOrder.keyId,
      amount: totalAmount,
      amountInPaise: rzpOrder.amountInPaise,
      currency: 'INR',
      receipt,
      plan: {
        id: plan._id,
        name: plan.name,
        code: plan.code,
        durationDays: plan.durationDays,
        price: plan.price,
        discountPercentage: plan.discountPercentage,
      },
      customer: {
        userId: user._id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email || '',
        phone: user.phone || '',
      },
    };
  }

  /**
   * Verify Razorpay Payment and finalize Membership Subscription
   */
  async verifyRazorpayPayment(data, context = {}) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, userId } = data;
    if (!razorpay_payment_id) {
      throw new ValidationError('Razorpay payment ID (razorpay_payment_id) is required');
    }

    const targetUserId = userId || context.user?.id || context.user?.sub;
    const user = await userRepository.findById(targetUserId, context.tenantId);

    // Verify HMAC-SHA256 signature
    await razorpayService.verifySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      branchId: user?.branchId || null,
      tenantId: context.tenantId,
    });

    // Activate subscription with payment details
    return await this.subscribeUser(
      {
        planId,
        userId: targetUserId,
        paymentMethod: 'razorpay',
        razorpay_order_id,
        razorpay_payment_id,
      },
      context
    );
  }
}

export const membershipService = new MembershipService();

