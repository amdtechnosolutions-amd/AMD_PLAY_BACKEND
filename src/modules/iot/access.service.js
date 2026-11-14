import { deviceRepository } from './iot.repository.js';
import { Booking } from '../bookings/booking.model.js';
import { iotSchedulerService } from './iot-scheduler.service.js';
import { BOOKING_STATUS } from '../../config/constants.js';
import { mqttClient } from '../../config/mqtt.js';
import { NotFoundError, ValidationError } from '../../errors/AppError.js';

export class AccessService {
  /**
   * Verify PIN or QR code at a gate or door access device
   */
  async verifyAccess({ deviceId, pin, qrCode, simulatedTime = null }) {
    if (!deviceId) {
      throw new ValidationError('Device ID is required');
    }
    if (!pin && !qrCode) {
      throw new ValidationError('Either PIN or QR code is required');
    }

    const device = await deviceRepository.findById(deviceId);
    if (!device) {
      throw new NotFoundError(`Access control device '${deviceId}' not found`);
    }

    // Current time to compare against
    const now = simulatedTime ? new Date(simulatedTime) : new Date();

    // Query active bookings for this branch and tenant
    const query = {
      tenantId: device.tenantId,
      branchId: device.branchId,
      status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN] },
    };

    // Determine assigned resources & sports for this access device
    const assignedResources = Array.isArray(device.resourceIds) && device.resourceIds.length > 0
      ? device.resourceIds
      : (device.resourceId ? [device.resourceId] : []);

    const assignedSports = Array.isArray(device.sportIds) && device.sportIds.length > 0
      ? device.sportIds
      : (device.sportId ? [device.sportId] : []);

    if (assignedResources.length > 0) {
      query.resourceId = { $in: assignedResources };
    }
    if (assignedSports.length > 0) {
      query.sportId = { $in: assignedSports };
    }

    if (pin) {
      query.accessCode = pin.trim();
    } else if (qrCode) {
      const trimmedQr = qrCode.trim();
      const orClauses = [{ bookingNumber: trimmedQr }];
      if (trimmedQr.length === 24) {
        orClauses.push({ _id: trimmedQr });
      }
      query.$or = orClauses;
    }

    const bookings = await Booking.find(query)
      .populate('resourceId', 'name code')
      .populate('userId', 'firstName lastName phone')
      .exec();

    if (!bookings || bookings.length === 0) {
      return {
        accessGranted: false,
        reason: 'Invalid access PIN or QR code for this facility',
      };
    }

    // Check time window for matching bookings:
    // Slot window: [startTime - 15min, endTime + 15min]
    let matchingBooking = null;
    let timingError = null;

    for (const b of bookings) {
      const [startHour, startMin] = b.startTime.split(':').map(Number);
      const [endHour, endMin] = b.endTime.split(':').map(Number);

      const bookingStart = new Date(`${b.date}T00:00:00`);
      bookingStart.setHours(startHour, startMin - 15, 0, 0); // 15 min buffer before

      const bookingEnd = new Date(`${b.date}T00:00:00`);
      bookingEnd.setHours(endHour, endMin + 15, 0, 0); // 15 min buffer after

      if (now >= bookingStart && now <= bookingEnd) {
        matchingBooking = b;
        break;
      } else if (now < bookingStart) {
        timingError = 'Too early. Access opens 15 minutes before booking start time.';
      } else if (now > bookingEnd) {
        timingError = 'Access expired. Booking time slot has already passed.';
      }
    }

    if (!matchingBooking) {
      return {
        accessGranted: false,
        reason: timingError || 'No active booking valid for the current time slot',
      };
    }

    // Mark check-in if not already checked in
    if (!matchingBooking.checkIn?.isCheckedIn) {
      matchingBooking.status = BOOKING_STATUS.CHECKED_IN;
      matchingBooking.checkIn = {
        isCheckedIn: true,
        checkedInAt: now,
      };
      await matchingBooking.save();

      // Ensure court lighting/power is activated immediately for this checked-in session
      iotSchedulerService.evaluateCourtSchedules().catch((err) => {
        console.warn('[Access] IoT evaluation warning on gate check-in:', err.message);
      });
    }

    // Send MQTT unlock command to EM Lock relay topic
    const topic = `tenants/${device.tenantId}/branches/${device.branchId}/access/${device.code.toLowerCase()}/command`;
    const unlockPayload = {
      action: 'unlock',
      durationSeconds: 5,
      bookingId: matchingBooking._id,
      bookingNumber: matchingBooking.bookingNumber,
      customerName: matchingBooking.userId
        ? `${matchingBooking.userId.firstName} ${matchingBooking.userId.lastName}`
        : 'Guest',
      timestamp: now.toISOString(),
    };

    await mqttClient.publish(topic, unlockPayload);

    // Update device status & heartbeat
    device.status = 'online';
    device.lastHeartbeat = now;
    await device.save();

    return {
      accessGranted: true,
      message: 'Access granted. Welcome to your session!',
      booking: {
        id: matchingBooking._id,
        bookingNumber: matchingBooking.bookingNumber,
        court: matchingBooking.resourceId?.name || 'Court',
        courtCode: matchingBooking.resourceId?.code,
        date: matchingBooking.date,
        startTime: matchingBooking.startTime,
        endTime: matchingBooking.endTime,
        isCheckedIn: true,
      },
      unlockCommand: {
        topic,
        durationSeconds: 5,
      },
    };
  }
}

export const accessService = new AccessService();
