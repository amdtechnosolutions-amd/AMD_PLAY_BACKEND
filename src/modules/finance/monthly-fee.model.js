import mongoose from 'mongoose';

const monthlyFeeSchema = new mongoose.Schema(
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
    feeType: {
      type: String,
      enum: ['coaching_student', 'court_member'],
      default: 'coaching_student',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    // Coaching Student Specific
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
    },
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      default: null,
    },

    // Court Member Specific
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MemberSubscription',
      default: null,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      default: null,
    },

    // Billing Period
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },

    // Option A: Pro-rata Details
    isProrated: {
      type: Boolean,
      default: false,
    },
    proratedDays: {
      type: Number,
      default: 0,
    },
    dailyRate: {
      type: Number,
      default: 0,
    },
    joinDate: {
      type: Date,
      default: null,
    },
    billingPeriodStart: {
      type: Date,
      default: null,
    },
    billingPeriodEnd: {
      type: Date,
      default: null,
    },

    // Fee Pricing
    baseFee: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'waived', 'partially_paid'],
      default: 'pending',
      index: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    receiptNo: {
      type: String,
      default: null,
      sparse: true,
      trim: true,
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save synchronization hook
monthlyFeeSchema.pre('save', function (next) {
  if (!this.userId && this.studentId) {
    this.userId = this.studentId;
  }
  if (!this.studentId && this.userId && this.feeType === 'coaching_student') {
    this.studentId = this.userId;
  }

  // Auto-generate official Receipt Number when marked as paid
  if (this.status === 'paid' && !this.receiptNo) {
    const monthStr = String(this.month).padStart(2, '0');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const prefix = this.feeType === 'court_member' ? 'REC-MEM' : 'REC-STU';
    this.receiptNo = `${prefix}-${this.year}${monthStr}-${randomSuffix}`;
  }

  next();
});

// Partial Unique Indexes:
// 1. One invoice per Student per Batch per Month
monthlyFeeSchema.index(
  { tenantId: 1, studentId: 1, batchId: 1, month: 1, year: 1 },
  {
    unique: true,
    partialFilterExpression: {
      studentId: { $type: 'objectId' },
      batchId: { $type: 'objectId' },
    },
  }
);

// 2. One invoice per Member per Subscription per Month
monthlyFeeSchema.index(
  { tenantId: 1, subscriptionId: 1, month: 1, year: 1 },
  {
    unique: true,
    partialFilterExpression: {
      subscriptionId: { $type: 'objectId' },
    },
  }
);

// 3. Fast queries by tenant, feeType, and status
monthlyFeeSchema.index({ tenantId: 1, feeType: 1, status: 1, month: 1, year: 1 });
monthlyFeeSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
monthlyFeeSchema.index({ tenantId: 1, status: 1, paidAt: -1 });

export const MonthlyFee =
  mongoose.models.MonthlyFee || mongoose.model('MonthlyFee', monthlyFeeSchema);

