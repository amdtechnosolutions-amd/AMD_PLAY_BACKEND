import { Booking } from '../bookings/booking.model.js';
import { Resource } from '../resources/resource.model.js';
import { Device } from './device.model.js';
import { iotService } from './iot.service.js';
import { BOOKING_STATUS } from '../../config/constants.js';
import { mqttClient } from '../../config/mqtt.js';

export class IotSchedulerService {
  constructor() {
    this.timer = null;
    this.intervalMs = 60000; // Check every 60 seconds
    this.bufferBeforeMinutes = 15; // 15 min grace time in (turn on 15 mins before slot starts)
    this.bufferAfterMinutes = 15;  // 15 min grace time out (turn off 15 mins after slot ends)
  }

  /**
   * Start the background scheduler for automated court lighting & appliance control
   */
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.evaluateCourtSchedules().catch((err) => {
        console.error('[IoT Scheduler] Error evaluating court schedules:', err.message);
      });
    }, this.intervalMs);
    console.log(`⚡ [IoT Scheduler] Court lighting & appliance automation worker started (${this.bufferBeforeMinutes}m grace in / ${this.bufferAfterMinutes}m grace out)`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Helper to format a Date as YYYY-MM-DD in local time
   */
  _formatDateStr(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /**
   * Check if a given booking is currently active within the grace period [start - 15m, end + 15m]
   */
  isBookingActive(booking, now = new Date()) {
    if (!booking?.date || !booking?.startTime || !booking?.endTime) return false;

    const [by, bm, bd] = booking.date.split('-').map(Number);
    const [sh, sm] = booking.startTime.split(':').map(Number);
    const [eh, em] = booking.endTime.split(':').map(Number);

    if (isNaN(by) || isNaN(bm) || isNaN(bd) || isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) {
      return false;
    }

    const slotStart = new Date(by, bm - 1, bd, sh, sm, 0, 0);
    let slotEnd = new Date(by, bm - 1, bd, eh, em, 0, 0);

    // Cross-midnight handling (e.g. 23:00 to 01:00)
    if (slotEnd <= slotStart) {
      slotEnd.setDate(slotEnd.getDate() + 1);
    }

    const slotStartBuffered = new Date(slotStart.getTime() - this.bufferBeforeMinutes * 60 * 1000);
    const slotEndBuffered = new Date(slotEnd.getTime() + this.bufferAfterMinutes * 60 * 1000);

    return now >= slotStartBuffered && now <= slotEndBuffered;
  }

  /**
   * Hook called immediately when slot(s) are booked
   * Assigns time window and immediately powers ON the device channel if the slot starts within the 15-min grace window
   */
  async onBookingCreated(createdDocs, context = {}) {
    const now = new Date();
    const docs = Array.isArray(createdDocs) ? createdDocs : [createdDocs];

    for (const item of docs) {
      const doc = item.doc || item;
      const resource = item.resource || doc.resourceId;
      const resourceId = resource?._id?.toString() || doc.resourceId?.toString();
      if (!resourceId) continue;

      const isActiveNow = this.isBookingActive(doc, now);
      const courtName = resource?.name || `Court ${resourceId}`;

      const [by, bm, bd] = doc.date.split('-').map(Number);
      const [sh, sm] = doc.startTime.split(':').map(Number);
      const [eh, em] = doc.endTime.split(':').map(Number);
      const slotStart = new Date(by, bm - 1, bd, sh, sm, 0, 0);
      let slotEnd = new Date(by, bm - 1, bd, eh, em, 0, 0);
      if (slotEnd <= slotStart) slotEnd.setDate(slotEnd.getDate() + 1);
      const bufferedStart = new Date(slotStart.getTime() - this.bufferBeforeMinutes * 60 * 1000);
      const bufferedEnd = new Date(slotEnd.getTime() + this.bufferAfterMinutes * 60 * 1000);

      const pad = (n) => String(n).padStart(2, '0');
      const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

      if (isActiveNow) {
        console.log(
          `⚡ [IoT Auto-Schedule] Slot booked for '${courtName}' (${doc.date} ${doc.startTime}-${doc.endTime}) starts within 15m grace window. Powering ON device channel immediately.`
        );
        try {
          await iotService.triggerCourtLighting(resourceId, 'on', {
            tenantId: context.tenantId || doc.tenantId,
            branchId: resource?.branchId || doc.branchId,
          });
        } catch (err) {
          console.warn(`[IoT Auto-Schedule] Immediate power-on warning for '${courtName}':`, err.message);
        }
      } else {
        console.log(
          `📅 [IoT Auto-Schedule] Slot booked for '${courtName}' (${doc.date} ${doc.startTime}-${doc.endTime}). Power window scheduled: ${formatTime(bufferedStart)} to ${formatTime(bufferedEnd)} (15m grace in/out).`
        );
      }
    }

    // Run full schedule evaluation to synchronize devices across the facility
    await this.evaluateCourtSchedules().catch((err) => {
      console.error('[IoT Scheduler] Error evaluating court schedules after booking creation:', err.message);
    });
  }

  /**
   * Evaluate active bookings and switch lights / fans ON or OFF based on court slot schedule with 15-min grace in & out
   */
  async evaluateCourtSchedules() {
    const now = new Date();

    // Query date boundaries (local & UTC today, yesterday, and tomorrow) to catch midnight edge cases
    const localDateStr = this._formatDateStr(now);
    const utcDateStr = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const yesterdayStr = this._formatDateStr(yesterday);
    const tomorrowStr = this._formatDateStr(tomorrow);

    const datesToQuery = Array.from(new Set([localDateStr, utcDateStr, yesterdayStr, tomorrowStr]));

    // 1. Fetch all bookings that are confirmed, checked in, or in progress
    const activeBookings = await Booking.find({
      date: { $in: datesToQuery },
      status: {
        $in: [
          BOOKING_STATUS.CONFIRMED,
          BOOKING_STATUS.CHECKED_IN,
          BOOKING_STATUS.IN_PROGRESS,
        ],
      },
    }).populate('resourceId');

    // Group bookings by court resource ID
    const courtBookingsMap = new Map();
    for (const b of activeBookings) {
      if (!b.resourceId) continue;
      const rId = b.resourceId._id.toString();
      if (!courtBookingsMap.has(rId)) {
        courtBookingsMap.set(rId, []);
      }
      courtBookingsMap.get(rId).push(b);
    }

    // 2. Fetch all active court resources
    const activeResources = await Resource.find({
      status: 'active',
    });

    for (const res of activeResources) {
      const rId = res._id.toString();
      const bookingsForCourt = courtBookingsMap.get(rId) || [];

      // Determine if this court should be powered ON based on active bookings + 15m grace in and out
      let shouldBeOn = false;
      for (const b of bookingsForCourt) {
        if (this.isBookingActive(b, now)) {
          shouldBeOn = true;
          break;
        }
      }

      const targetState = shouldBeOn ? 'on' : 'off';

      try {
        let device = null;
        let lightChannel = res.iotMapping?.lightRelayChannel || null;
        let fanChannel = res.iotMapping?.fanRelayChannel || null;

        // Check explicit resource iotMapping first
        if (res.iotMapping?.deviceId) {
          device = await Device.findById(res.iotMapping.deviceId);
        }

        // Fallback: Check if device directly references resourceId
        if (!device) {
          device = await Device.findOne({
            tenantId: res.tenantId,
            type: 'relay',
            $or: [{ resourceId: res._id }, { resourceIds: res._id }],
          });
          if (device && !lightChannel && Array.isArray(device.relayChannels) && device.relayChannels.length > 0) {
            lightChannel = device.relayChannels[0].channelNumber || 1;
          }
        }

        if (!device) continue;

        // Collect all light channels for this court (supporting single, dual, or multi-light rows)
        const lightChannels = new Set();
        if (Array.isArray(res.iotMapping?.lightRelayChannels)) {
          res.iotMapping.lightRelayChannels.forEach((ch) => ch && lightChannels.add(Number(ch)));
        }
        if (Array.isArray(res.iotMapping?.row1Lights)) {
          res.iotMapping.row1Lights.forEach((ch) => ch && lightChannels.add(Number(ch)));
        }
        if (Array.isArray(res.iotMapping?.lights)) {
          res.iotMapping.lights.forEach((ch) => ch && lightChannels.add(Number(ch)));
        }
        if (Array.isArray(res.iotMapping?.lightRelayChannel)) {
          res.iotMapping.lightRelayChannel.forEach((ch) => ch && lightChannels.add(Number(ch)));
        } else if (res.iotMapping?.lightRelayChannel && !isNaN(Number(res.iotMapping.lightRelayChannel))) {
          lightChannels.add(Number(res.iotMapping.lightRelayChannel));
        }
        if (res.iotMapping?.lightRelayChannel2 && !isNaN(Number(res.iotMapping.lightRelayChannel2))) {
          lightChannels.add(Number(res.iotMapping.lightRelayChannel2));
        }
        if (lightChannels.size === 0 && lightChannel) {
          lightChannels.add(Number(lightChannel));
        }

        let anyLightStateChanged = false;
        // Actuate all light relay channels (dual lights) if state changed
        for (const ch of lightChannels) {
          const lightCh = device.relayChannels.find((c) => c.channelNumber === ch);
          if (!lightCh || lightCh.state !== targetState) {
            anyLightStateChanged = true;
            await iotService.toggleRelayChannel(
              device._id,
              { channelNumber: ch, state: targetState },
              { tenantId: res.tenantId, branchId: res.branchId }
            );
            console.log(`💡 [IoT Auto-Schedule] Court '${res.name}' Light CH${ch} set to ${targetState.toUpperCase()} (15m grace window)`);
          }
        }

        // If court is currently active, ensure retained state on hardware MQTT command topic
        // so that any rebooted or reconnected relay controller catches up immediately
        if (shouldBeOn && !anyLightStateChanged && device.mqttTopic) {
          const channelData = {};
          for (const ch of lightChannels) {
            channelData[`CH${ch}`] = 1;
          }
          await mqttClient.publish(device.mqttTopic, JSON.stringify({ data: channelData }), { retain: true, qos: 1 });
        }

        // Actuate fan relay channel if state changed
        if (fanChannel && !lightChannels.has(Number(fanChannel))) {
          const fanCh = device.relayChannels.find((c) => c.channelNumber === fanChannel);
          if (!fanCh || fanCh.state !== targetState) {
            await iotService.toggleRelayChannel(
              device._id,
              { channelNumber: fanChannel, state: targetState },
              { tenantId: res.tenantId, branchId: res.branchId }
            );
            console.log(`🌀 [IoT Auto-Schedule] Court '${res.name}' Fans set to ${targetState.toUpperCase()} (15m grace window)`);
          }
        }
      } catch (err) {
        console.error(`[IoT Scheduler] Failed to toggle court ${res.name}:`, err.message);
      }
    }
  }
}

export const iotSchedulerService = new IotSchedulerService();
