import crypto from 'node:crypto';
import { resourceRepository } from '../resources/resource.repository.js';
import { branchRepository } from '../branches/branch.repository.js';
import { sportRepository } from '../sports/sport.repository.js';
import { bookingRepository } from '../bookings/booking.repository.js';
import { batchRepository } from '../coaching/coaching.repository.js';
import { acquireLock, releaseLock, getLock } from '../../config/redis.js';
import { NotFoundError, ConflictError, ValidationError } from '../../errors/AppError.js';
import { SLOT_STATUS, ROLES } from '../../config/constants.js';

export class SlotService {
  /**
   * Helper to format total minutes into "HH:MM"
   */
  _minutesToTime(totalMinutes) {
    if (totalMinutes >= 1440) {
      return '00:00';
    }
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  /**
   * Helper to parse "HH:MM" into total minutes from midnight
   */
  _timeToMinutes(timeStr, isClosingTime = false) {
    if (!timeStr) return isClosingTime ? 1440 : 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if ((isClosingTime || hours === 24) && (hours === 0 || hours === 24) && (minutes === 0 || isNaN(minutes))) {
      return 24 * 60; // 1440 mins (midnight / end of day)
    }
    if (isClosingTime && hours === 23 && (minutes === 0 || isNaN(minutes))) {
      // If facility closes at 23:00 or late evening, extend closing window through midnight (24:00)
      return 24 * 60;
    }
    if (!isClosingTime && hours === 24) {
      return 0;
    }
    return (hours || 0) * 60 + (minutes || 0);
  }

  /**
   * Helper to format "HH:MM" into 12-hour format e.g. "6:00 AM", "6:00 PM"
   */
  _formatTime12Hour(timeStr) {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  /**
   * Calculate duration in minutes between start and end times (handles overnight)
   */
  _getShiftDuration(startTime, endTime) {
    const startMins = this._timeToMinutes(startTime);
    const endMins = this._timeToMinutes(endTime);
    if (endMins > startMins) {
      return endMins - startMins;
    }
    return (1440 - startMins) + endMins;
  }

  /**
   * Helper to determine slot pricing tier (Day vs Night vs Weekend vs Member vs Shift Flat Rate)
   */
  _calculateSlotPrice(pricing = {}, date, startTime, user = {}) {
    const targetDate = new Date(`${date}T00:00:00.000Z`);
    const dayOfWeek = targetDate.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6

    const startMinutes = this._timeToMinutes(startTime);

    // 1. Shift / Session Flat-Rate Model (Day Shift & Night Shift custom dynamic timings and flat rates)
    const isShiftModel = ['session', 'shift', 'per_day'].includes(pricing.pricingModel);
    if (isShiftModel) {
      const dayStart = pricing.dayShiftStartTime || '06:00';
      const dayEnd = pricing.dayShiftEndTime || '18:00';
      const dayStartMins = this._timeToMinutes(dayStart);
      const dayEndMins = this._timeToMinutes(dayEnd);

      let isDayShift = false;
      if (dayStartMins < dayEndMins) {
        isDayShift = startMinutes >= dayStartMins && startMinutes < dayEndMins;
      } else {
        isDayShift = startMinutes >= dayStartMins || startMinutes < dayEndMins;
      }

      const dayPrice = pricing.dayShiftPrice ?? pricing.basePrice ?? 600;
      const nightPrice = pricing.nightShiftPrice ?? pricing.peakPrice ?? 1000;

      const finalPrice = isDayShift ? dayPrice : nightPrice;

      return {
        basePrice: finalPrice,
        finalPrice,
        rateType: isDayShift ? 'day_shift' : 'night_shift',
        pricingModel: 'shift_flat_rate',
        isDayShift,
        isNightShift: !isDayShift,
        isPeak: !isDayShift,
        isWeekend,
      };
    }

    // 2. Regular Hourly Pricing with Day / Night & Peak calculation (Night starts after 20:00)
    const peakStart = pricing.peakStartTime ? this._timeToMinutes(pricing.peakStartTime) : 20 * 60; // 20:00 (8:00 PM)
    const peakEnd = pricing.peakEndTime ? this._timeToMinutes(pricing.peakEndTime) : 6 * 60;     // 06:00 (6:00 AM)

    let isNightOrPeak = false;
    if (peakStart > peakEnd) {
      // Overnight window spanning midnight (e.g. 18:00 to 06:00)
      isNightOrPeak = startMinutes >= peakStart || startMinutes < peakEnd;
    } else {
      isNightOrPeak = startMinutes >= peakStart && startMinutes < peakEnd;
    }

    const isMember = user?.role === ROLES.MEMBER || user?.role === ROLES.STUDENT;

    let finalPrice = pricing.basePrice || 0;
    let rateType = 'base';

    if (isMember && pricing.memberPrice != null && pricing.memberPrice > 0) {
      finalPrice = pricing.memberPrice;
      rateType = 'member';
    } else if (isNightOrPeak && pricing.peakPrice != null && pricing.peakPrice > 0) {
      finalPrice = pricing.peakPrice;
      rateType = 'peak';
    } else if (isWeekend && pricing.weekendPrice != null && pricing.weekendPrice > 0) {
      finalPrice = pricing.weekendPrice;
      rateType = 'weekend';
    }

    return {
      basePrice: pricing.basePrice || 0,
      finalPrice,
      rateType,
      isNight: isNightOrPeak,
      isPeak: isNightOrPeak,
      isWeekend,
      isMember,
    };
  }

  /**
   * Check if a date/time falls within court maintenance
   */
  _isUnderMaintenance(resource, date, startTime) {
    if (resource.status === 'maintenance' || resource.maintenance?.isUnderMaintenance) {
      return { inMaintenance: true, reason: resource.maintenance?.reason || 'Scheduled maintenance' };
    }

    if (resource.maintenance?.startDate && resource.maintenance?.endDate) {
      const slotDateTime = new Date(`${date}T${startTime}:00.000Z`);
      const start = new Date(resource.maintenance.startDate);
      const end = new Date(resource.maintenance.endDate);

      if (slotDateTime >= start && slotDateTime <= end) {
        return { inMaintenance: true, reason: resource.maintenance.reason || 'Under scheduled maintenance window' };
      }
    }

    return { inMaintenance: false };
  }

  /**
   * Check if a slot time overlaps with any active coaching batch
   */
  _isBatchConflicting(batches = [], dayOfWeek, startTime, endTime, resourceId = null) {
    if (!batches || batches.length === 0) return { conflicting: false };
    const slotStartMins = this._timeToMinutes(startTime, false);
    const slotEndMins = this._timeToMinutes(endTime, true);

    for (const b of batches) {
      if (!b.schedule?.daysOfWeek?.includes(dayOfWeek)) continue;
      if (b.resourceId && resourceId && b.resourceId.toString() !== resourceId.toString()) continue;

      const batchStartMins = this._timeToMinutes(b.schedule.startTime, false);
      const batchEndMins = this._timeToMinutes(b.schedule.endTime, true);

      if (slotStartMins < batchEndMins && slotEndMins > batchStartMins) {
        return {
          conflicting: true,
          batch: {
            id: b._id,
            name: b.name,
            code: b.code,
            startTime: b.schedule.startTime,
            endTime: b.schedule.endTime,
          },
          reason: `Coaching Batch: ${b.name} (${b.code}) [${b.schedule.startTime} - ${b.schedule.endTime}]`,
        };
      }
    }
    return { conflicting: false };
  }

  /**
   * Dynamic Slot Generator
   */
  async generateSlots({ resourceId, branchId, sportId, date, duration }, context = {}) {
    let tenantId = context.tenantId;
    if (!tenantId && resourceId) {
      const resDoc = await resourceRepository.model.findById(resourceId);
      if (resDoc) tenantId = resDoc.tenantId;
    }
    if (!tenantId) {
      throw new ValidationError('Tenant context is required to query slots');
    }

    // 1. Fetch resource (or auto-resolve first active court if branchId provided)
    let resource = null;
    if (resourceId) {
      resource = await resourceRepository.findById(resourceId, tenantId);
      if (!resource) {
        throw new NotFoundError(`Court/Resource with ID '${resourceId}' not found`);
      }
    } else if (branchId) {
      const filter = { branchId, status: 'active' };
      if (sportId) {
        filter.$or = [{ sportId }, { sportIds: sportId }];
      }
      resource = await resourceRepository.findOne(filter, tenantId);
    }

    if (!resource) {
      if (!branchId) {
        throw new ValidationError('Court/Resource ID or Branch ID is required to query slots');
      }
      return {
        date,
        isOpen: false,
        reason: 'No court/resource available for the selected criteria',
        slots: [],
      };
    }

    // 2. Fetch branch and sport
    const resolvedSportId = sportId || resource.sportId;
    const [branch, sport] = await Promise.all([
      branchRepository.findById(resource.branchId, tenantId),
      sportRepository.findById(resolvedSportId),
    ]);

    if (!branch) {
      throw new NotFoundError(`Branch not found for resource '${resource.name}'`);
    }

    const slotDuration = duration || sport?.defaultDurationMinutes || 60;
    const targetDate = new Date(`${date}T00:00:00.000Z`);
    const dayOfWeek = targetDate.getUTCDay();

    // 3. Resolve operating hours (Resource specific or Branch fallback)
    const operatingHoursList = resource.operatingHours?.length > 0
      ? resource.operatingHours
      : branch.operatingHours || [];

    const daySchedule = operatingHoursList.find((h) => h.dayOfWeek === dayOfWeek);

    if (daySchedule && daySchedule.isOpen === false) {
      return {
        date,
        resource: {
          id: resource._id,
          name: resource.name,
          code: resource.code,
          type: resource.type,
        },
        branch: {
          id: branch._id,
          name: branch.name,
          timezone: branch.timezone,
        },
        isOpen: false,
        reason: 'Facility is closed on this day of week',
        slots: [],
      };
    }

    // 24 Hours Arena Operating Logic:
    // Facilities operate 24 hours (round the clock, from 00:00 to 24:00) by default.
    const is24Hours = resource.is24Hours ?? branch.is24Hours ?? true;
    let openMinutes = 0;
    let closeMinutes = 1440;

    if (!is24Hours && daySchedule?.openTime && daySchedule?.closeTime && daySchedule.openTime !== '06:00') {
      openMinutes = this._timeToMinutes(daySchedule.openTime, false);
      closeMinutes = this._timeToMinutes(daySchedule.closeTime, true);
    }

    // Fetch active bookings for this court and date
    const activeBookings = await bookingRepository.findActiveByResourceAndDate(
      resource._id,
      date,
      tenantId
    );
    const bookedStartTimes = new Set(activeBookings.map((b) => b.startTime));

    // Fetch active coaching batches for this branch and all sports supported by this resource
    const sportsToCheck = Array.isArray(resource.sportIds) && resource.sportIds.length > 0
      ? resource.sportIds
      : [resource.sportId];

    const batchArrays = await Promise.all(
      sportsToCheck.map((sId) => batchRepository.findActiveByBranchAndSport(resource.branchId, sId, tenantId))
    );
    const activeBatches = batchArrays.flat();

    // 4. Shift / Package Flat Rate Generator (Day Shift & Night Shift dynamic windows)
    const isShiftModel = ['session', 'shift', 'per_day'].includes(resource.pricing?.pricingModel);
    if (isShiftModel) {
      const dayStart = resource.pricing.dayShiftStartTime || '06:00';
      const dayEnd = resource.pricing.dayShiftEndTime || '18:00';
      const nightStart = resource.pricing.nightShiftStartTime || '18:00';
      const nightEnd = resource.pricing.nightShiftEndTime || '06:00';

      const dayPrice = resource.pricing.dayShiftPrice ?? resource.pricing.basePrice ?? 600;
      const nightPrice = resource.pricing.nightShiftPrice ?? resource.pricing.peakPrice ?? 1000;

      const dayFormatted = `${this._formatTime12Hour(dayStart)} – ${this._formatTime12Hour(dayEnd)}`;
      const nightFormatted = `${this._formatTime12Hour(nightStart)} – ${this._formatTime12Hour(nightEnd)}`;

      const sessions = [
        {
          startTime: dayStart,
          endTime: dayEnd,
          sessionName: `☀️ Day Shift (${dayFormatted})`,
          sessionType: 'day_shift',
          durationMinutes: this._getShiftDuration(dayStart, dayEnd),
          pricing: {
            basePrice: dayPrice,
            finalPrice: dayPrice,
            rateType: 'day_shift',
            pricingModel: 'shift_flat_rate',
          },
        },
        {
          startTime: nightStart,
          endTime: nightEnd,
          sessionName: `🌙 Night Shift (${nightFormatted})`,
          sessionType: 'night_shift',
          durationMinutes: this._getShiftDuration(nightStart, nightEnd),
          pricing: {
            basePrice: nightPrice,
            finalPrice: nightPrice,
            rateType: 'night_shift',
            pricingModel: 'shift_flat_rate',
          },
        },
      ];

      const currentUserId = context.user?.id?.toString() || context.user?.sub?.toString();

      const slots = await Promise.all(
        sessions.map(async (s) => {
          const batchConflict = this._isBatchConflicting(activeBatches, dayOfWeek, s.startTime, s.endTime, resource._id);
          if (batchConflict.conflicting) {
            return {
              startTime: s.startTime,
              endTime: s.endTime,
              sessionName: s.sessionName,
              sessionType: s.sessionType,
              status: SLOT_STATUS.COACHING_BATCH,
              isCoachingBatch: true,
              batch: batchConflict.batch,
              reason: batchConflict.reason,
              pricing: s.pricing,
            };
          }

          const isBooked = activeBookings.some((b) => b.startTime === s.startTime);
          if (isBooked) {
            return {
              startTime: s.startTime,
              endTime: s.endTime,
              sessionName: s.sessionName,
              sessionType: s.sessionType,
              status: SLOT_STATUS.BOOKED,
              pricing: s.pricing,
            };
          }

          const lockKey = `lock:slot:${tenantId}:${resource._id}:${date}:${s.startTime}`;
          const activeLock = await getLock(lockKey);
          if (activeLock) {
            const isHeldByMe = currentUserId && activeLock.userId === currentUserId;
            return {
              startTime: s.startTime,
              endTime: s.endTime,
              sessionName: s.sessionName,
              sessionType: s.sessionType,
              status: SLOT_STATUS.HELD,
              heldByYou: isHeldByMe,
              holdExpiresAt: activeLock.expiresAt,
              pricing: s.pricing,
            };
          }

          return {
            startTime: s.startTime,
            endTime: s.endTime,
            sessionName: s.sessionName,
            sessionType: s.sessionType,
            status: SLOT_STATUS.AVAILABLE,
            pricing: s.pricing,
          };
        })
      );

      return {
        date,
        resource: {
          id: resource._id,
          name: resource.name,
          code: resource.code,
          type: resource.type,
          pricingModel: 'shift_flat_rate',
        },
        branch: {
          id: branch._id,
          name: branch.name,
          timezone: branch.timezone,
        },
        sport: {
          id: sport?._id,
          name: sport?.name,
          slug: sport?.slug,
        },
        isOpen: true,
        pricingModel: 'shift_flat_rate',
        totalSlots: slots.length,
        availableSlots: slots.filter((s) => s.status === SLOT_STATUS.AVAILABLE).length,
        slots,
      };
    }

    // 5. Regular Hourly / Custom Discrete Slot windows
    const slots = [];
    const currentUserId = context.user?.id?.toString() || context.user?.sub?.toString();

    for (let cur = openMinutes; cur + slotDuration <= closeMinutes; cur += slotDuration) {
      const startTime = this._minutesToTime(cur);
      const endTime = this._minutesToTime(cur + slotDuration);

      // Check Maintenance
      const maint = this._isUnderMaintenance(resource, date, startTime);
      if (maint.inMaintenance) {
        slots.push({
          startTime,
          endTime,
          status: SLOT_STATUS.MAINTENANCE,
          reason: maint.reason,
          pricing: this._calculateSlotPrice(resource.pricing, date, startTime, context.user),
        });
        continue;
      }

      const priceInfo = this._calculateSlotPrice(resource.pricing, date, startTime, context.user);

      // Check Active Coaching Batch Conflict
      const batchConflict = this._isBatchConflicting(activeBatches, dayOfWeek, startTime, endTime, resource._id);
      if (batchConflict.conflicting) {
        slots.push({
          startTime,
          endTime,
          status: SLOT_STATUS.COACHING_BATCH,
          isCoachingBatch: true,
          reason: batchConflict.reason,
          batch: batchConflict.batch,
          pricing: priceInfo,
        });
        continue;
      }

      // Check Confirmed Booking Status
      if (bookedStartTimes.has(startTime)) {
        slots.push({
          startTime,
          endTime,
          status: SLOT_STATUS.BOOKED,
          pricing: priceInfo,
        });
        continue;
      }

      // Check Lock / Hold Status in Redis or LockManager
      const lockKey = `lock:slot:${tenantId}:${resource._id}:${date}:${startTime}`;
      const activeLock = await getLock(lockKey);

      if (activeLock) {
        const isHeldByMe = currentUserId && activeLock.userId === currentUserId;
        slots.push({
          startTime,
          endTime,
          status: SLOT_STATUS.HELD,
          heldByYou: isHeldByMe,
          holdExpiresAt: activeLock.expiresAt,
          pricing: priceInfo,
        });
      } else {
        slots.push({
          startTime,
          endTime,
          status: SLOT_STATUS.AVAILABLE,
          pricing: priceInfo,
        });
      }
    }

    return {
      date,
      resource: {
        id: resource._id,
        name: resource.name,
        code: resource.code,
        type: resource.type,
        surface: resource.surface,
        capacity: resource.capacity,
      },
      branch: {
        id: branch._id,
        name: branch.name,
        timezone: branch.timezone,
      },
      sport: {
        id: sport?._id,
        name: sport?.name,
        slug: sport?.slug,
      },
      isOpen: true,
      slotDuration,
      totalSlots: slots.length,
      availableSlots: slots.filter((s) => s.status === SLOT_STATUS.AVAILABLE).length,
      slots,
    };
  }

  /**
   * Atomic Slot Hold / Lock Engine (5-minute checkout reservation)
   * Supports both single slot and multi-slot / multi-date batches
   */
  async holdSlot(payload, context = {}) {
    const slotsToHold = Array.isArray(payload.slots) && payload.slots.length > 0
      ? payload.slots
      : (payload.resourceId && payload.date && payload.startTime ? [payload] : []);

    if (slotsToHold.length === 0) {
      throw new ValidationError('At least one slot is required to hold');
    }

    let tenantId = context.tenantId;
    if (!tenantId && slotsToHold[0]?.resourceId) {
      const resDoc = await resourceRepository.model.findById(slotsToHold[0].resourceId);
      if (resDoc) tenantId = resDoc.tenantId;
    }

    if (!tenantId) {
      throw new ValidationError('Tenant context is required to hold a slot');
    }

    const userId = context.user?.id?.toString() || context.user?.sub?.toString() || payload.userId || 'guest';

    // 1. Verify and pre-validate all requested slots
    const validatedSlots = [];
    for (const slotItem of slotsToHold) {
      const { resourceId, date, startTime, endTime } = slotItem;
      if (!resourceId || !date || !startTime || !endTime) {
        throw new ValidationError('Each slot must include resourceId, date, startTime, and endTime');
      }

      const resource = await resourceRepository.findById(resourceId, tenantId);
      if (!resource) {
        throw new NotFoundError(`Court/Resource with ID '${resourceId}' not found`);
      }

      // Verify court maintenance
      const maint = this._isUnderMaintenance(resource, date, startTime);
      if (maint.inMaintenance) {
        throw new ConflictError(`Cannot hold slot ${startTime}-${endTime} on ${date}: court is under maintenance (${maint.reason})`);
      }

      // Verify no coaching batch conflict across all sports supported by this resource
      const sportsToCheck = Array.isArray(resource.sportIds) && resource.sportIds.length > 0
        ? resource.sportIds
        : [resource.sportId];

      const batchArrays = await Promise.all(
        sportsToCheck.map((sId) => batchRepository.findActiveByBranchAndSport(resource.branchId, sId, tenantId))
      );
      const activeBatches = batchArrays.flat();
      const targetDate = new Date(`${date}T00:00:00.000Z`);
      const dayOfWeek = targetDate.getUTCDay();
      const batchConflict = this._isBatchConflicting(activeBatches, dayOfWeek, startTime, endTime, resource._id);
      if (batchConflict.conflicting) {
        throw new ConflictError(
          `Slot ${startTime} - ${endTime} on ${date} is reserved for coaching batch '${batchConflict.batch.name}' (${batchConflict.batch.code})`
        );
      }

      // Verify slot is not already booked in DB
      const isBooked = await bookingRepository.isSlotBooked(resource._id, date, startTime, tenantId);
      if (isBooked) {
        throw new ConflictError(`Slot ${startTime} - ${endTime} on ${date} is already booked`);
      }

      validatedSlots.push({ resource, date, startTime, endTime });
    }

    // 2. Acquire atomic holds with rollback if any fails
    const holdId = payload.holdId || crypto.randomUUID();
    const acquiredLocks = [];
    const heldSlotResults = [];
    let totalBasePrice = 0;

    try {
      for (const item of validatedSlots) {
        const { resource, date, startTime, endTime } = item;
        const lockKey = `lock:slot:${tenantId}:${resource._id}:${date}:${startTime}`;
        const metadata = {
          holdId,
          userId,
          tenantId: tenantId.toString(),
          resourceId: resource._id.toString(),
          date,
          startTime,
          endTime,
          userRole: context.user?.role,
          userEmail: context.user?.email,
        };

        const lockResult = await acquireLock(lockKey, 300, metadata);
        let actualHoldId = holdId;
        let actualExpiresAt = lockResult.expiresAt;

        if (!lockResult.acquired) {
          const isAlreadyMine = userId && lockResult.existing?.userId === userId;
          if (isAlreadyMine) {
            actualHoldId = lockResult.existing.holdId;
            actualExpiresAt = lockResult.existing.expiresAt;
          } else {
            throw new ConflictError(
              `Slot ${startTime} - ${endTime} on ${date} is currently held by another user or already booked. Please choose another slot or retry in a few moments.`
            );
          }
        }

        acquiredLocks.push({ key: lockKey, expiresAt: actualExpiresAt });

        const priceInfo = this._calculateSlotPrice(resource.pricing, date, startTime, context.user);
        totalBasePrice += (priceInfo.finalPrice ?? priceInfo.basePrice ?? 0);

        heldSlotResults.push({
          holdId: actualHoldId,
          key: lockKey,
          expiresAt: actualExpiresAt,
          pricing: priceInfo,
          slot: {
            resourceId: resource._id,
            resourceName: resource.name,
            code: resource.code,
            date,
            startTime,
            endTime,
          },
        });
      }
    } catch (holdErr) {
      // Rollback any acquired locks in this batch
      for (const lk of acquiredLocks) {
        await releaseLock(lk.key, userId, true);
      }
      throw holdErr;
    }

    const taxRate = 18;
    const taxAmount = Math.round(totalBasePrice * (taxRate / 100));
    const totalAmount = totalBasePrice + taxAmount;

    // Single-slot backward compatibility response format
    if (slotsToHold.length === 1 && !payload.slots) {
      return {
        holdId: heldSlotResults[0].holdId,
        key: heldSlotResults[0].key,
        expiresAt: heldSlotResults[0].expiresAt,
        ttlSeconds: 300,
        pricing: heldSlotResults[0].pricing,
        slot: heldSlotResults[0].slot,
      };
    }

    return {
      holdId,
      isMultiSlot: true,
      totalSlots: heldSlotResults.length,
      expiresAt: heldSlotResults[0]?.expiresAt,
      ttlSeconds: 300,
      totalPricing: {
        basePrice: totalBasePrice,
        taxRate,
        taxAmount,
        discountAmount: 0,
        totalAmount,
        currency: 'INR',
      },
      slots: heldSlotResults.map((h) => ({
        ...h.slot,
        pricing: h.pricing,
        key: h.key,
        expiresAt: h.expiresAt,
      })),
    };
  }

  /**
   * Release Slot Hold (single or multi-slot)
   */
  async releaseSlot(payload, context = {}) {
    const slotsToRelease = Array.isArray(payload.slots) && payload.slots.length > 0
      ? payload.slots
      : (payload.resourceId && payload.date && payload.startTime ? [payload] : []);

    if (slotsToRelease.length === 0) {
      return { released: true, message: 'No slots specified to release' };
    }

    let tenantId = context.tenantId;
    if (!tenantId && slotsToRelease[0]?.resourceId) {
      const resDoc = await resourceRepository.model.findById(slotsToRelease[0].resourceId);
      if (resDoc) tenantId = resDoc.tenantId;
    }

    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const userId = context.user?.id?.toString() || context.user?.sub?.toString() || payload.userId;
    const isAdmin = [ROLES.SUPER_ADMIN, ROLES.TENANT_OWNER, ROLES.TENANT_ADMIN, ROLES.BRANCH_ADMIN].includes(
      context.user?.role
    );

    let releasedCount = 0;
    for (const item of slotsToRelease) {
      const lockKey = `lock:slot:${tenantId}:${item.resourceId}:${item.date}:${item.startTime}`;
      const activeLock = await getLock(lockKey);
      if (!activeLock) continue;

      if (item.holdId && activeLock.holdId !== item.holdId) {
        throw new ValidationError('Hold ID does not match active slot hold');
      }

      const res = await releaseLock(lockKey, userId, isAdmin);
      if (!res.released) {
        throw new ConflictError('Cannot release slot held by another user');
      }
      releasedCount++;
    }

    if (slotsToRelease.length === 1 && !payload.slots) {
      return { released: true, message: 'Slot hold released successfully' };
    }

    return {
      released: true,
      releasedCount,
      message: `Released ${releasedCount} slot hold(s) successfully`,
    };
  }

  /**
   * Multi-Tier Price Calculation (single or multiple slots across dates)
   */
  async calculatePrice(payload, context = {}) {
    let tenantId = context.tenantId;
    const slotsToPrice = Array.isArray(payload.slots) && payload.slots.length > 0
      ? payload.slots
      : (payload.resourceId && payload.date && payload.startTime ? [payload] : []);

    if (slotsToPrice.length === 0) {
      throw new ValidationError('At least one slot is required to calculate pricing');
    }

    // Single-slot backward compatibility
    if (slotsToPrice.length === 1 && !payload.slots) {
      const { resourceId, date, startTime, endTime } = slotsToPrice[0];
      let resource = null;
      if (tenantId) {
        resource = await resourceRepository.findById(resourceId, tenantId);
      }
      if (!resource) {
        resource = await resourceRepository.model.findById(resourceId);
      }
      if (!resource) {
        throw new NotFoundError(`Resource with ID '${resourceId}' not found`);
      }

      const priceDetails = this._calculateSlotPrice(resource.pricing, date, startTime, context.user);
      const basePrice = priceDetails.finalPrice ?? priceDetails.basePrice ?? 0;
      const taxRate = 18;
      const taxAmount = Math.round(basePrice * (taxRate / 100));
      const discountAmount = 0;
      const totalAmount = basePrice + taxAmount - discountAmount;

      return {
        resourceId: resource._id,
        resourceName: resource.name,
        date,
        startTime,
        endTime,
        basePrice,
        taxRate,
        taxAmount,
        discountAmount,
        totalAmount,
        currency: 'INR',
        pricing: priceDetails,
      };
    }

    // Multi-slot pricing
    let totalBasePrice = 0;
    const itemizedSlots = [];

    for (const item of slotsToPrice) {
      const { resourceId, date, startTime, endTime } = item;
      let resource = null;
      if (tenantId) resource = await resourceRepository.findById(resourceId, tenantId);
      if (!resource) resource = await resourceRepository.model.findById(resourceId);
      if (!resource) throw new NotFoundError(`Resource with ID '${resourceId}' not found`);

      const priceDetails = this._calculateSlotPrice(resource.pricing, date, startTime, context.user);
      const slotBasePrice = priceDetails.finalPrice ?? priceDetails.basePrice ?? 0;
      totalBasePrice += slotBasePrice;

      itemizedSlots.push({
        resourceId: resource._id,
        resourceName: resource.name,
        code: resource.code,
        date,
        startTime,
        endTime,
        basePrice: slotBasePrice,
        pricing: priceDetails,
      });
    }

    const taxRate = 18;
    const taxAmount = Math.round(totalBasePrice * (taxRate / 100));
    const discountAmount = 0;
    const totalAmount = totalBasePrice + taxAmount - discountAmount;

    return {
      isMultiSlot: true,
      totalSlots: itemizedSlots.length,
      basePrice: totalBasePrice,
      taxRate,
      taxAmount,
      discountAmount,
      totalAmount,
      currency: 'INR',
      slots: itemizedSlots,
    };
  }
}

export const slotService = new SlotService();
