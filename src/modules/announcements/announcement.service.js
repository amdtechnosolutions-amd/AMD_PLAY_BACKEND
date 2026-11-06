import { BaseService } from '../../core/BaseService.js';
import { announcementRepository } from './announcement.repository.js';
import { notificationService } from '../notifications/notification.service.js';

export class AnnouncementService extends BaseService {
  constructor() {
    super(announcementRepository, 'Announcement');
  }

  async createAnnouncement(data, context = {}) {
    const tenantId = context.tenantId;
    const userId = context.user?.id || context.user?.sub;

    const announcement = await this.repository.create({
      ...data,
      tenantId,
      createdBy: userId,
    });

    // Broadcast push notification if configured
    try {
      if (data.sendPushNotification) {
        await notificationService.broadcastAnnouncement({
          tenantId,
          title: `📢 ${data.title}`,
          message: data.description,
          targetType: data.targetType,
        });
      }
    } catch (pushErr) {
      console.warn('[Announcement] Push broadcast warning:', pushErr.message);
    }

    return announcement;
  }
}

export const announcementService = new AnnouncementService();
