import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
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
    category: {
      type: String,
      enum: [
        'maintenance',
        'electricity',
        'equipment',
        'salaries',
        'rent',
        'utilities',
        'marketing',
        'other',
      ],
      default: 'other',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Expense title is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Expense amount is required'],
      min: 0,
    },
    date: {
      type: String,
      required: [true, 'Expense date is required (YYYY-MM-DD)'],
      trim: true,
    },
    paidTo: {
      type: String,
      default: '',
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'upi', 'card', 'cheque'],
      default: 'bank_transfer',
    },
    receiptUrl: {
      type: String,
      default: '',
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
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

expenseSchema.index({ tenantId: 1, date: -1 });
expenseSchema.index({ tenantId: 1, branchId: 1, category: 1 });
expenseSchema.index({ tenantId: 1, status: 1, date: 1 });

export const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);
