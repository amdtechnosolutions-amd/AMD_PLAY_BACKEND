import { notificationController } from './notification.controller.js';
import {
  sendNotificationSchema,
  queryNotificationsSchema,
  notificationParamSchema,
} from './notification.schema.js';
import { requireTenantContext, attachTenantContext } from '../../middleware/tenant.middleware.js';

export default async function notificationRoutes(fastify) {
  // Send notification (Admin / System)
  fastify.post('/notifications/send', {
    schema: sendNotificationSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: notificationController.sendNotification.bind(notificationController),
  });

  // Get notification inbox (Both /notifications and /notifications/my)
  fastify.get('/notifications', {
    schema: queryNotificationsSchema,
    preHandler: [fastify.authenticate, attachTenantContext],
    handler: notificationController.getMyNotifications.bind(notificationController),
  });

  fastify.get('/notifications/my', {
    schema: queryNotificationsSchema,
    preHandler: [fastify.authenticate, attachTenantContext],
    handler: notificationController.getMyNotifications.bind(notificationController),
  });

  // Get unread notification badge count (Both /notifications/unread-count and /notifications/my/unread-count)
  fastify.get('/notifications/unread-count', {
    schema: {
      description: 'Get count of unread notifications for current user',
      tags: ['Notifications & Alerts'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, attachTenantContext],
    handler: notificationController.getUnreadCount.bind(notificationController),
  });

  fastify.get('/notifications/my/unread-count', {
    schema: {
      description: 'Get count of unread notifications for current user',
      tags: ['Notifications & Alerts'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, attachTenantContext],
    handler: notificationController.getUnreadCount.bind(notificationController),
  });

  // Mark a single notification as read
  fastify.patch('/notifications/:id/read', {
    schema: notificationParamSchema,
    preHandler: [fastify.authenticate, attachTenantContext],
    handler: notificationController.markAsRead.bind(notificationController),
  });

  // Mark all user notifications as read in bulk
  fastify.patch('/notifications/read-all', {
    schema: {
      description: 'Mark all notifications as read for current user',
      tags: ['Notifications & Alerts'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, attachTenantContext],
    handler: notificationController.markAllAsRead.bind(notificationController),
  });
}
