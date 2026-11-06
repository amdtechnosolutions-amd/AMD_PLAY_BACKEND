import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
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
      required: [true, 'Branch ID is required'],
      index: true,
    },
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Event / Tournament name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: 'Open Tournament',
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Event start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'Event end date is required'],
    },
    registrationLastDate: {
      type: Date,
      required: [true, 'Registration deadline is required'],
    },
    registrationAmount: {
      type: Number,
      required: [true, 'Registration fee is required'],
      min: 0,
      default: 0,
    },
    maxParticipants: {
      type: Number,
      default: 64,
    },
    enrolledCount: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    brochure: {
      type: String,
      default: null,
    },
    posterImage: {
      type: String,
      default: null,
    },
    liveStreamUrl: {
      type: String,
      default: null,
      trim: true,
    },
    rules: {
      type: String,
      default: '',
    },
    prizes: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

eventSchema.index({ tenantId: 1, branchId: 1, active: 1 });

export const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
