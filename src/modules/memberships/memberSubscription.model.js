import mongoose from 'mongoose';
import { PAYMENT_STATUS } from '../../config/constants.js';

const memberSubscriptionSchema = new mongoose.Schema(
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
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      required: [true, 'Plan ID is required'],
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      default: null,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    pricePaid: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.SUCCESS,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
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
      default: 1, // 1 = 24/7 all day, 2+ = slot-specific week plan
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
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

memberSubscriptionSchema.index({ tenantId: 1, userId: 1, status: 1 });
memberSubscriptionSchema.index({ tenantId: 1, status: 1, endDate: 1 });
memberSubscriptionSchema.index({ tenantId: 1, branchId: 1, status: 1 });

export const MemberSubscription =
  mongoose.models.MemberSubscription ||
  mongoose.model('MemberSubscription', memberSubscriptionSchema);
