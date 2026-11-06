import { notificationRepository } from './notification.repository.js';
import { notificationEvents, NOTIFICATION_EVENTS } from './notification.events.js';
import { ValidationError, NotFoundError } from '../../errors/AppError.js';

export class NotificationService {
  constructor() {
    this.notificationRepository = notificationRepository;
  }

  async sendNotification(
    { tenantId, userId, title, message, channels = ['in_app'], type = 'system', metadata = {} },
    context = {}
  ) {
    const activeTenantId = context.tenantId || tenantId;
    if (!activeTenantId) {
      throw new ValidationError('Tenant context is required');
    }
    if (!userId) {
      throw new ValidationError('User ID is required');
    }
    if (!title || !message) {
      throw new ValidationError('Title and message are required');
    }

    const selectedChannels = Array.isArray(channels) && channels.length > 0 ? channels : ['in_app'];
    const createdNotifications = [];

    for (const channel of selectedChannels) {
      const notification = await this.notificationRepository.create({
        tenantId: activeTenantId,
        userId,
        title,
        message,
        channel,
        type,
        status: 'sent',
        metadata,
        sentAt: new Date(),
      });

      createdNotifications.push(notification);

      // Emit event for real-time dispatchers / websocket / push listeners
      notificationEvents.emit('notification.sent', {
        id: notification._id,
        tenantId: activeTenantId,
        userId,
        channel,
        type,
        title,
        message,
        metadata,
      });
    }

    return createdNotifications;
  }

  async getUserNotifications(filters = {}, pagination = {}, context = {}) {
    if (!context.userId) {
      throw new ValidationError('Authentication context is required');
    }

    const query = {};
    if (filters.channel) query.channel = filters.channel;
    if (filters.type) query.type = filters.type;
    if (filters.status) query.status = filters.status;
    if (filters.unreadOnly === 'true' || filters.unreadOnly === true) {
      query.readAt = null;
    }

    return await this.notificationRepository.paginateUserNotifications(
      context.userId,
      query,
      pagination,
      context.tenantId
    );
  }

  async markNotificationAsRead(id, context = {}) {
    if (!context.userId) {
      throw new ValidationError('Authentication context is required');
    }

    const updated = await this.notificationRepository.markAsRead(
      id,
      context.userId,
      context.tenantId
    );

    if (!updated) {
      throw new NotFoundError(`Notification with ID '${id}' not found`);
    }

    return updated;
  }

  async markAllNotificationsAsRead(context = {}) {
    if (!context.userId) {
      throw new ValidationError('Authentication context is required');
    }

    return await this.notificationRepository.markAllAsRead(context.userId, context.tenantId);
  }

  async getUnreadCount(context = {}) {
    if (!context.userId) {
      throw new ValidationError('Authentication context is required');
    }

    const unreadCount = await this.notificationRepository.countUnread(
      context.userId,
      context.tenantId
    );

    return { unreadCount };
  }

  // --- Predefined Event-Driven Templates ---

  async sendBookingConfirmation(booking, user, court = null) {
    const courtName = court?.name || 'Court';
    const title = `Booking Confirmed: ${booking.bookingNumber}`;
    const message = `Your booking for ${courtName} on ${booking.date} (${booking.startTime}-${booking.endTime}) is confirmed! Your 6-digit door access PIN is: ${booking.accessCode}.`;

    const notifications = await this.sendNotification({
      tenantId: booking.tenantId,
      userId: user._id || booking.userId,
      title,
      message,
      channels: ['in_app', 'email', 'sms'],
      type: 'booking',
      metadata: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        accessCode: booking.accessCode,
        courtName,
      },
    });

    notificationEvents.emit(NOTIFICATION_EVENTS.BOOKING_CONFIRMED, {
      bookingId: booking._id,
      userId: user._id || booking.userId,
      accessCode: booking.accessCode,
    });

    return notifications;
  }

  async sendBookingCancellation(booking, user) {
    const title = `Booking Cancelled: ${booking.bookingNumber}`;
    const refund = booking.cancellation?.refundAmount || 0;
    const message = `Your booking for ${booking.date} (${booking.startTime}-${booking.endTime}) has been cancelled. Refund of INR ${refund} has been processed.`;

    const notifications = await this.sendNotification({
      tenantId: booking.tenantId,
      userId: user._id || booking.userId,
      title,
      message,
      channels: ['in_app', 'email'],
      type: 'booking',
      metadata: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        refundAmount: refund,
      },
    });

    notificationEvents.emit(NOTIFICATION_EVENTS.BOOKING_CANCELLED, {
      bookingId: booking._id,
      userId: user._id || booking.userId,
    });

    return notifications;
  }
}

export const notificationService = new NotificationService();
