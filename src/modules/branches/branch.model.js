import mongoose from 'mongoose';

const operatingHourSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0, // 0 = Sunday
      max: 6, // 6 = Saturday
    },
    openTime: {
      type: String,
      default: '00:00',
      match: /^([01]\d|2[0-4]):([0-5]\d)$/,
    },
    closeTime: {
      type: String,
      default: '24:00',
      match: /^([01]\d|2[0-4]):([0-5]\d)$/,
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const branchSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Branch location name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Branch code is required'],
      uppercase: true,
      trim: true,
    },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: 'Bengaluru' },
      state: { type: String, default: 'Karnataka' },
      postalCode: { type: String, default: '' },
      country: { type: String, default: 'India' },
      coordinates: {
        lat: { type: Number, default: 0 },
        lng: { type: Number, default: 0 },
      },
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    is24Hours: {
      type: Boolean,
      default: true,
    },
    operatingHours: {
      type: [operatingHourSchema],
      default: () => [
        { dayOfWeek: 0, openTime: '00:00', closeTime: '24:00', isOpen: true },
        { dayOfWeek: 1, openTime: '00:00', closeTime: '24:00', isOpen: true },
        { dayOfWeek: 2, openTime: '00:00', closeTime: '24:00', isOpen: true },
        { dayOfWeek: 3, openTime: '00:00', closeTime: '24:00', isOpen: true },
        { dayOfWeek: 4, openTime: '00:00', closeTime: '24:00', isOpen: true },
        { dayOfWeek: 5, openTime: '00:00', closeTime: '24:00', isOpen: true },
        { dayOfWeek: 6, openTime: '00:00', closeTime: '24:00', isOpen: true },
      ],
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active',
      index: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    paymentSettings: {
      razorpay: {
        enabled: { type: Boolean, default: false },
        keyId: { type: String, default: '' },
        keySecret: { type: String, default: '' },
        webhookSecret: { type: String, default: '' },
      },
      upi: {
        enabled: { type: Boolean, default: false },
        upiId: { type: String, default: '' },
        merchantName: { type: String, default: '' },
        qrImageUrl: { type: String, default: '' },
      },
      bankAccount: {
        accountNumber: { type: String, default: '' },
        ifscCode: { type: String, default: '' },
        bankName: { type: String, default: '' },
        accountHolder: { type: String, default: '' },
      },
      cashAccepted: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index: unique branch code per tenant
branchSchema.index({ tenantId: 1, code: 1 }, { unique: true });
branchSchema.index({ tenantId: 1, status: 1 });

export const Branch = mongoose.models.Branch || mongoose.model('Branch', branchSchema);
