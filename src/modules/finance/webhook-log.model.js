import mongoose from 'mongoose';

const webhookLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
      default: null,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      index: true,
      default: null,
    },
    gateway: {
      type: String,
      enum: ['cashfree', 'razorpay', 'stripe', 'manual', 'other'],
      default: 'cashfree',
      index: true,
    },
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      trim: true,
      index: true,
    },
    gatewayOrderId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    gatewayPaymentId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'cancelled', 'refunded', 'dropped', 'test', 'received', 'error'],
      default: 'received',
      index: true,
    },
    signatureValid: {
      type: Boolean,
      default: true,
    },
    customer: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    error: {
      type: String,
      default: null,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

webhookLogSchema.index({ tenantId: 1, receivedAt: -1 });
webhookLogSchema.index({ tenantId: 1, gateway: 1, receivedAt: -1 });
webhookLogSchema.index({ tenantId: 1, status: 1, receivedAt: -1 });
webhookLogSchema.index({ gateway: 1, receivedAt: -1 });
webhookLogSchema.index({ status: 1, receivedAt: -1 });
webhookLogSchema.index({ gatewayOrderId: 1 });
webhookLogSchema.index({ gatewayPaymentId: 1 });

export const WebhookLog = mongoose.models.WebhookLog || mongoose.model('WebhookLog', webhookLogSchema);

