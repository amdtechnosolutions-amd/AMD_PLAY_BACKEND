import { BaseController } from '../../core/BaseController.js';
import { notificationService } from './notification.service.js';
import { apiSuccess } from '../../utils/response.js';

export class NotificationController extends BaseController {
  constructor() {
    super(notificationService);
  }

  async sendNotification(request, reply) {
    const context = this._extractContext(request);
    const notifications = await notificationService.sendNotification(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Notification(s) dispatched successfully',
        data: notifications,
      })
    );
  }

  async getMyNotifications(request, reply) {
    const context = this._extractContext(request);
    const { page, limit, ...filters } = request.query || {};
    const pagination = { page, limit };

    const result = await notificationService.getUserNotifications(filters, pagination, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'User notifications retrieved',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async getUnreadCount(request, reply) {
    const context = this._extractContext(request);
    const result = await notificationService.getUnreadCount(context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Unread notification count retrieved',
        data: result,
      })
    );
  }

  async markAsRead(request, reply) {
    const context = this._extractContext(request);
    const notification = await notificationService.markNotificationAsRead(
      request.params.id,
      context
    );

    return reply.status(200).send(
      apiSuccess({
        message: 'Notification marked as read',
        data: notification,
      })
    );
  }

  async markAllAsRead(request, reply) {
    const context = this._extractContext(request);
    const result = await notificationService.markAllNotificationsAsRead(context);

    return reply.status(200).send(
      apiSuccess({
        message: 'All notifications marked as read',
        data: result,
      })
    );
  }
}

export const notificationController = new NotificationController();
