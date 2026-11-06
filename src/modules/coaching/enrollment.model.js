import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: [true, 'Batch ID is required'],
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required'],
      index: true,
    },
    enrollmentDate: {
      type: Date,
      default: Date.now,
    },
    monthlyFee: {
      type: Number,
      required: true,
      min: 0,
    },
    feeStatus: {
      type: String,
      enum: ['paid', 'pending', 'overdue'],
      default: 'paid',
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'dropped'],
      default: 'active',
      index: true,
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

enrollmentSchema.index({ tenantId: 1, batchId: 1, studentId: 1 }, { unique: true });
enrollmentSchema.index({ tenantId: 1, studentId: 1, status: 1 });
enrollmentSchema.index({ tenantId: 1, batchId: 1, status: 1 });
enrollmentSchema.index({ tenantId: 1, status: 1 });

export const Enrollment =
  mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);
