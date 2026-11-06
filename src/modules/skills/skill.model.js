import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null, // null for system-wide default skill levels
      index: true,
    },
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      default: null, // null for general or multi-sport skill levels
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Skill name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Skill code is required'],
      lowercase: true,
      trim: true,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
      index: true,
    },
    category: {
      type: String,
      enum: ['level', 'technique', 'fitness', 'tactical', 'general'],
      default: 'level',
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    criteria: {
      type: [String],
      default: [],
    },
    color: {
      type: String,
      default: '#3B82F6',
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index: unique code per sport within a tenant
skillSchema.index({ tenantId: 1, sportId: 1, code: 1 }, { unique: true });

export const Skill = mongoose.models.Skill || mongoose.model('Skill', skillSchema);
