import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null, // null indicates system-wide default role
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Role name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Role slug is required'],
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    permissions: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index: role slug unique per tenant
roleSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

export const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);
