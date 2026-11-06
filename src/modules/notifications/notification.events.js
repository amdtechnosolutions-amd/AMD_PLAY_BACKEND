import { EventEmitter } from 'node:events';
import { logger } from '../../utils/logger.js';

export const NOTIFICATION_EVENTS = {
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_CANCELLED: 'booking.cancelled',
  MEMBERSHIP_SUBSCRIBED: 'membership.subscribed',
  COACHING_ATTENDANCE: 'coaching.attendance',
  GENERAL_ALERT: 'general.alert',
};

class NotificationEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.dispatchedEvents = [];
  }

  emit(event, data) {
    const record = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    this.dispatchedEvents.push(record);
    logger.debug({ event, data }, 'Notification event emitted');
    return super.emit(event, data);
  }

  getDispatchedEvents(filterEvent = null) {
    if (!filterEvent) return [...this.dispatchedEvents];
    return this.dispatchedEvents.filter((e) => e.event === filterEvent);
  }

  clearDispatchedEvents() {
    this.dispatchedEvents = [];
  }
}

export const notificationEvents = new NotificationEventEmitter();
