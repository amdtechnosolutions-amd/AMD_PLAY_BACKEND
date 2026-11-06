import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    channel: {
      type: String,
      enum: ['in_app', 'email', 'sms', 'whatsapp', 'push'],
      default: 'in_app',
      index: true,
    },
    type: {
      type: String,
      enum: ['booking', 'membership', 'coaching', 'payment', 'system', 'iot'],
      default: 'system',
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'read'],
      default: 'sent',
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, userId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, userId: 1, readAt: 1 });

export const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
