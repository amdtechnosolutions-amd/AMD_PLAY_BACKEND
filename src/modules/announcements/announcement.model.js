import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Announcement description is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['general', 'exam', 'event', 'maintenance', 'holiday', 'coaching'],
      default: 'general',
    },
    icon: {
      type: String,
      default: 'bell',
    },
    image: {
      type: String,
      default: null,
    },
    targetType: {
      type: String,
      enum: ['all', 'sport', 'students', 'members', 'coaches'],
      default: 'all',
    },
    targetSportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

announcementSchema.index({ tenantId: 1, active: 1, createdAt: -1 });

export const Announcement =
  mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
