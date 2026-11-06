import mongoose from 'mongoose';

const attendancePunchLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
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
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
      index: true,
    },
    batchName: {
      type: String,
      default: '',
      trim: true,
    },
    verificationMode: {
      type: String,
      default: 'face',
      trim: true,
    },
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      default: null,
      index: true,
    },
    sportName: {
      type: String,
      default: '',
      trim: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      default: null,
      index: true,
    },
    resourceName: {
      type: String,
      default: '',
      trim: true,
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      default: null,
      index: true,
    },
    deviceCode: {
      type: String,
      default: '',
      trim: true,
    },
    deviceIp: {
      type: String,
      default: '192.168.1.155',
    },
    deviceName: {
      type: String,
      default: 'Hikvision Face Terminal (ISAPI)',
    },
    punchTime: {
      type: Date,
      default: Date.now,
      index: true,
    },
    serialNo: {
      type: Number,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['verified', 'matched', 'unrecognized', 'unassigned', 'guest', 'outside_schedule'],
      default: 'verified',
    },
    rawEvent: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

attendancePunchLogSchema.index({ tenantId: 1, punchTime: -1 });
attendancePunchLogSchema.index({ tenantId: 1, serialNo: 1 });
attendancePunchLogSchema.index({ tenantId: 1, date: -1 });
attendancePunchLogSchema.index({ tenantId: 1, employeeNo: 1, punchTime: -1 });

export const AttendancePunchLog =
  mongoose.models.AttendancePunchLog ||
  mongoose.model('AttendancePunchLog', attendancePunchLogSchema);
