import { BaseRepository } from '../../core/BaseRepository.js';
import { Notification } from './notification.model.js';

export class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }

  async paginateUserNotifications(userId, filter = {}, pagination = {}, tenantId = null) {
    const sort = pagination.sort || { createdAt: -1 };
    return await this.paginate(
      { ...filter, userId },
      {
        ...pagination,
        sort,
        lean: true,
      },
      tenantId
    );
  }

  async markAsRead(id, userId, tenantId = null) {
    const filter = this._scopeFilter({ _id: id, userId }, tenantId);
    return await this.model.findOneAndUpdate(
      filter,
      { $set: { status: 'read', readAt: new Date() } },
      { new: true }
    );
  }

  async markAllAsRead(userId, tenantId = null) {
    const filter = this._scopeFilter({ userId, readAt: null }, tenantId);
    const result = await this.model.updateMany(
      filter,
      { $set: { status: 'read', readAt: new Date() } }
    );
    return {
      modifiedCount: result.modifiedCount,
    };
  }

  async countUnread(userId, tenantId = null) {
    const filter = this._scopeFilter({ userId, readAt: null }, tenantId);
    return await this.model.countDocuments(filter);
  }
}

export const notificationRepository = new NotificationRepository();
