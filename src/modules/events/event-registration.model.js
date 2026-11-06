import mongoose from 'mongoose';

const eventRegistrationSchema = new mongoose.Schema(
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
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    fullName: {
      type: String,
      required: [true, 'Participant full name is required'],
      trim: true,
    },
    profilePhoto: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: [true, 'Gender is required'],
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    age: {
      type: Number,
    },
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    pincode: {
      type: String,
      default: '',
      trim: true,
    },
    parentName: {
      type: String,
      default: '',
      trim: true,
    },
    coachName: {
      type: String,
      default: '',
      trim: true,
    },
    academyName: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: 'Under-15 Singles',
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'paid',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['online', 'upi', 'cash', 'card', 'free'],
      default: 'online',
    },
    transactionId: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    seedNumber: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

eventRegistrationSchema.index({ tenantId: 1, eventId: 1, phone: 1 });
eventRegistrationSchema.index({ tenantId: 1, eventId: 1, paymentStatus: 1 });
eventRegistrationSchema.index({ tenantId: 1, userId: 1 });

export const EventRegistration =
  mongoose.models.EventRegistration || mongoose.model('EventRegistration', eventRegistrationSchema);
