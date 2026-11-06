import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['booking', 'membership', 'coaching', 'other'],
      required: [true, 'Payment type is required'],
      index: true,
    },
    referenceId: {
      type: String,
      default: '',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['upi', 'card', 'cash', 'netbanking', 'wallet'],
      default: 'upi',
    },
    gateway: {
      type: String,
      enum: ['razorpay', 'stripe', 'manual', 'cash'],
      default: 'manual',
    },
    gatewayOrderId: {
      type: String,
      default: '',
      trim: true,
    },
    gatewayPaymentId: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    refund: {
      amount: { type: Number, default: 0 },
      refundedAt: { type: Date, default: null },
      gatewayRefundId: { type: String, default: '' },
      reason: { type: String, default: '' },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ tenantId: 1, createdAt: -1 });
paymentSchema.index({ tenantId: 1, branchId: 1, status: 1 });
paymentSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ tenantId: 1, branchId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ tenantId: 1, type: 1, status: 1, createdAt: -1 });
paymentSchema.index({ gatewayPaymentId: 1 });

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
