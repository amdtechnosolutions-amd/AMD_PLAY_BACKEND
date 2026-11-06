import mongoose from 'mongoose';

const attendanceRecordSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'excused'],
      default: 'present',
    },
    remarks: {
      type: String,
      default: '',
    },
    verificationMode: {
      type: String,
      default: 'face',
      trim: true,
    },
    checkInTime: {
      type: Date,
      default: null,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    punches: [
      {
        time: { type: Date, required: true },
        mode: { type: String, default: 'face' },
        serialNo: { type: Number, default: null },
        deviceCode: { type: String, default: '' },
      },
    ],
    serialNo: {
      type: Number,
      default: null,
    },
    deviceCode: {
      type: String,
      default: '',
    },
    deviceLogId: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
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
    date: {
      type: String,
      required: [true, 'Attendance date is required (YYYY-MM-DD)'],
      trim: true,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Marker User ID is required'],
    },
    records: {
      type: [attendanceRecordSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index({ tenantId: 1, batchId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ tenantId: 1, 'records.studentId': 1, date: -1 });

export const Attendance =
  mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
