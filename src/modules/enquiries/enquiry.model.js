import mongoose from 'mongoose';

const enquirySchema = new mongoose.Schema(
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
      required: [true, 'Prospect name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
    },
    interest: {
      type: String,
      enum: ['Coaching', 'Court Booking', 'Membership', 'Tournament', 'General', 'Events', 'Other'],
      default: 'Coaching',
    },
    message: {
      type: String,
      default: '',
      trim: true,
    },
    source: {
      type: String,
      enum: [
        'Walk-in',
        'Website',
        'Website Form',
        'Phone Call',
        'Phone',
        'IVR',
        'IVR / Phone Call',
        'WhatsApp',
        'Social Media',
        'Referral',
        'Campaign',
        'Other',
      ],
      default: 'Walk-in',
    },
    status: {
      type: String,
      enum: ['Pending', 'Contacted', 'Trial Scheduled', 'Converted', 'Lost', 'Closed'],
      default: 'Pending',
      index: true,
    },
    followUpDate: {
      type: Date,
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: [
      {
        content: String,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

enquirySchema.index({ tenantId: 1, branchId: 1, status: 1 });

export const Enquiry = mongoose.models.Enquiry || mongoose.model('Enquiry', enquirySchema);
