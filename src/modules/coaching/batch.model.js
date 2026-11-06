import mongoose from 'mongoose';

const batchScheduleSchema = new mongoose.Schema(
  {
    daysOfWeek: {
      type: [Number],
      required: true,
      default: [1, 3, 5], // Monday, Wednesday, Friday
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const batchSchema = new mongoose.Schema(
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
      required: [true, 'Sport ID is required'],
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      required: false,
      index: true,
    },
    courtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      required: false,
      index: true,
    },
    courtIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
      default: [],
    },
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Coach ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Batch name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: false,
      uppercase: true,
      trim: true,
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'all_levels'],
      default: 'all_levels',
    },
    schedule: {
      type: batchScheduleSchema,
      required: true,
    },
    maxStudents: {
      type: Number,
      required: [true, 'Maximum student capacity is required'],
      min: 1,
      default: 10,
    },
    enrolledCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    monthlyFee: {
      type: Number,
      required: [true, 'Monthly coaching fee is required'],
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
      index: true,
    },
    hikvisionPlanTemplateNo: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

batchSchema.index({ tenantId: 1, branchId: 1, code: 1 }, { unique: true });
batchSchema.index({ tenantId: 1, status: 1 });
batchSchema.index({ tenantId: 1, sportId: 1, status: 1 });
batchSchema.index({ tenantId: 1, branchId: 1, status: 1 });
batchSchema.index({ tenantId: 1, coachId: 1, status: 1 });
batchSchema.index({ tenantId: 1, courtId: 1, status: 1 });

export const Batch = mongoose.models.Batch || mongoose.model('Batch', batchSchema);
