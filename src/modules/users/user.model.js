import mongoose from 'mongoose';
import { ROLES } from '../../config/constants.js';
import { normalizeRole } from '../../utils/role-normalizer.js';

const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: function () {
        // Required for all roles except platform super admin
        const currentRole = normalizeRole(this.role);
        return currentRole !== ROLES.SUPER_ADMIN;
      },
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      index: true,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // Never return password hash in queries
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.CUSTOMER,
      set: normalizeRole,
      index: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'pending_verification'],
      default: 'active',
    },
    employeeNo: {
      type: String,
      trim: true,
      default: '',
    },
    cardNo: {
      type: String,
      trim: true,
      default: '',
    },
    pin: {
      type: String,
      trim: true,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes ensuring email uniqueness per tenant and fast phone/tenant lookup
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, phone: 1 });
userSchema.index({ tenantId: 1, role: 1, status: 1 });
userSchema.index({ tenantId: 1, branchId: 1, role: 1 });
userSchema.index({ tenantId: 1, employeeNo: 1 });
userSchema.index({ tenantId: 1, cardNo: 1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);

