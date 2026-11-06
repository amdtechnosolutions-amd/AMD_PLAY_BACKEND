import mongoose from 'mongoose';

const sportSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null, // null for system-wide default sports
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Sport name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Sport slug is required'],
      lowercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['court', 'turf', 'pitch', 'table', 'pool', 'gym', 'generic'],
      default: 'court',
    },
    icon: {
      type: String,
      default: '',
    },
    defaultDurationMinutes: {
      type: Number,
      default: 60,
    },
    minPlayers: {
      type: Number,
      default: 2,
    },
    maxPlayers: {
      type: Number,
      default: 4,
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

// Compound Unique Index: sport slug unique per tenant (or system)
sportSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
sportSchema.index({ tenantId: 1, active: 1 });

export const Sport = mongoose.models.Sport || mongoose.model('Sport', sportSchema);
