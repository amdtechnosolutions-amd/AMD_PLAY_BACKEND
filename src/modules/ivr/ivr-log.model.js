import mongoose from 'mongoose';

const ivrLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    callerPhone: {
      type: String,
      required: true,
      index: true,
    },
    callSid: {
      type: String,
      default: '',
      index: true,
    },
    callStatus: {
      type: String,
      enum: ['ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer'],
      default: 'completed',
    },
    callDurationSeconds: {
      type: Number,
      default: 0,
    },
    dtmfSelection: {
      type: String,
      default: '',
    },
    recordingUrl: {
      type: String,
      default: '',
    },
    provider: {
      type: String,
      default: 'custom',
    },
    actionTaken: {
      type: String,
      default: 'Lead Enquiry Created',
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

ivrLogSchema.index({ callerPhone: 1, createdAt: -1 });

export const IvrLog = mongoose.models.IvrLog || mongoose.model('IvrLog', ivrLogSchema);
