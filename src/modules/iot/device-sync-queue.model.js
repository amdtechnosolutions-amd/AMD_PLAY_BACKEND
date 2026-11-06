import mongoose from 'mongoose';

const deviceSyncQueueSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      default: null,
      index: true,
    },
    action: {
      type: String,
      enum: ['ADD_USER', 'MODIFY_USER', 'DELETE_USER', 'ASSIGN_PIN', 'UPLOAD_FACE', 'RECORD_CARD'],
      required: true,
      index: true,
    },
    employeeNo: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 15,
    },
    lastError: {
      type: String,
      default: null,
    },
    nextAttemptAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

deviceSyncQueueSchema.index({ status: 1, nextAttemptAt: 1, retryCount: 1, createdAt: 1 });

export const DeviceSyncQueue =
  mongoose.models.DeviceSyncQueue || mongoose.model('DeviceSyncQueue', deviceSyncQueueSchema);
