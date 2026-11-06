import mongoose from 'mongoose';
import { BOOKING_STATUS, PAYMENT_STATUS } from '../../config/constants.js';

const bookingPricingSchema = new mongoose.Schema(
  {
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const bookingPaymentSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.SUCCESS,
    },
    method: {
      type: String,
      enum: ['upi', 'card', 'cash', 'wallet', 'online', 'free', 'razorpay'],
      default: 'online',
    },
    transactionId: {
      type: String,
      default: '',
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const bookingCancellationSchema = new mongoose.Schema(
  {
    isCancelled: {
      type: Boolean,
      default: false,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      default: '',
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const bookingCheckInSchema = new mongoose.Schema(
  {
    isCheckedIn: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
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
    bookingNumber: {
      type: String,
      required: [true, 'Booking number is required'],
      uppercase: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      required: [true, 'Resource ID is required'],
      index: true,
    },
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      required: [true, 'Sport ID is required'],
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Booking date is required (YYYY-MM-DD)'],
      trim: true,
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required (HH:MM)'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required (HH:MM)'],
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.CONFIRMED,
      index: true,
    },
    pricing: {
      type: bookingPricingSchema,
      required: true,
    },
    payment: {
      type: bookingPaymentSchema,
      default: () => ({}),
    },
    cancellation: {
      type: bookingCancellationSchema,
      default: () => ({}),
    },
    checkIn: {
      type: bookingCheckInSchema,
      default: () => ({}),
    },
    accessCode: {
      type: String,
      default: '',
    },
    qrCodeUrl: {
      type: String,
      default: '',
    },
    readerId: {
      type: String,
      default: '',
    },
    groupId: {
      type: String,
      default: null,
      index: true,
    },
    groupBookingNumber: {
      type: String,
      default: null,
      index: true,
    },
    isMultiSlot: {
      type: Boolean,
      default: false,
      index: true,
    },
    totalGroupSlots: {
      type: Number,
      default: 1,
    },
    slotIndex: {
      type: Number,
      default: 1,
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

// Unique bookingNumber within tenant
bookingSchema.index({ tenantId: 1, bookingNumber: 1 }, { unique: true });

// Prevent double booking at database level for active bookings
bookingSchema.index(
  { tenantId: 1, resourceId: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          BOOKING_STATUS.CONFIRMED,
          BOOKING_STATUS.CHECKED_IN,
          BOOKING_STATUS.IN_PROGRESS,
          BOOKING_STATUS.RESERVED,
        ],
      },
    },
  }
);

bookingSchema.index({ tenantId: 1, userId: 1, date: -1 });
bookingSchema.index({ tenantId: 1, groupId: 1 });
bookingSchema.index({ tenantId: 1, status: 1, date: 1 });
bookingSchema.index({ tenantId: 1, branchId: 1, status: 1, date: 1 });

export const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
