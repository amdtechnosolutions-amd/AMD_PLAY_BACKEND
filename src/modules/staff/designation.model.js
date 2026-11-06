import mongoose from 'mongoose';
import { STAFF_ROLES } from './staff.schema.js';

const designationSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Designation name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Designation code is required'],
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    defaultRole: {
      type: String,
      enum: STAFF_ROLES,
      default: 'staff',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

designationSchema.index({ tenantId: 1, code: 1 }, { unique: true });
designationSchema.index({ tenantId: 1, departmentId: 1 });
designationSchema.index({ tenantId: 1, status: 1, order: 1 });

export const Designation = mongoose.models.Designation || mongoose.model('Designation', designationSchema);
