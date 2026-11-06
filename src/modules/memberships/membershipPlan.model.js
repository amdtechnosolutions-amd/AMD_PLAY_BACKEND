import mongoose from 'mongoose';

const membershipPlanSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Membership plan name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: false,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      default: null, // null denotes multi-sport / all-sports academy access
      index: true,
    },
    durationDays: {
      type: Number,
      required: [true, 'Duration in days is required'],
      min: 1,
    },
    price: {
      type: Number,
      required: [true, 'Plan price is required'],
      min: 0,
    },
    discountPercentage: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    timeSlot: {
      startTime: {
        type: String,
        default: '06:00',
        trim: true,
      },
      endTime: {
        type: String,
        default: '22:00',
        trim: true,
      },
      daysOfWeek: {
        type: [Number],
        default: [1, 2, 3, 4, 5, 6, 7],
      },
      slotName: {
        type: String,
        default: '',
        trim: true,
      },
    },
    hikvisionPlanTemplateNo: {
      type: Number,
      default: null,
    },
    courtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      default: null,
      index: true,
    },
    courtIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

membershipPlanSchema.index({ tenantId: 1, code: 1 }, { unique: true });
membershipPlanSchema.index({ tenantId: 1, status: 1, price: 1 });

export const MembershipPlan =
  mongoose.models.MembershipPlan || mongoose.model('MembershipPlan', membershipPlanSchema);
