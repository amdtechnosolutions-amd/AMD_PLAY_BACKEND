import mongoose from 'mongoose';

const relayChannelSchema = new mongoose.Schema(
  {
    channelNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 32,
    },
    target: {
      type: String,
      enum: ['light', 'fan', 'ac', 'lock', 'other'],
      default: 'light',
    },
    state: {
      type: String,
      enum: ['on', 'off'],
      default: 'off',
    },
    label: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const deviceSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: [true, 'Device name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Device unique code is required (e.g. DEV-RELAY-01)'],
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['relay', 'door_lock', 'turnstile', 'biometric', 'biometric_terminal', 'access_control', 'sensor', 'gateway'],
      required: [true, 'Device type is required'],
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      default: null,
      index: true,
      set: (v) => (v === '' || !v ? null : v),
    },
    resourceIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
      default: [],
      index: true,
      set: (v) => (Array.isArray(v) ? v.filter((x) => x && x !== '') : []),
    },
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      default: null,
      index: true,
      set: (v) => (v === '' || !v ? null : v),
    },
    sportIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sport' }],
      default: [],
      index: true,
      set: (v) => (Array.isArray(v) ? v.filter((x) => x && x !== '') : []),
    },
    accessScope: {
      type: String,
      enum: ['court', 'sport', 'multi_sport', 'branch_entrance', 'global'],
      default: 'sport',
    },
    ipAddress: {
      type: String,
      default: '',
      trim: true,
    },
    port: {
      type: Number,
      default: 80,
    },
    protocol: {
      type: String,
      enum: ['http', 'https', 'mqtt', 'modbus_tcp', 'tcp'],
      default: 'http',
    },
    username: {
      type: String,
      default: 'admin',
      trim: true,
    },
    password: {
      type: String,
      default: '',
      trim: true,
    },
    doorNo: {
      type: Number,
      default: 1,
    },
    isDefaultEntrance: {
      type: Boolean,
      default: false,
    },
    macAddress: {
      type: String,
      default: '',
      trim: true,
    },
    mqttTopic: {
      type: String,
      default: '',
      trim: true,
    },
    relayChannels: {
      type: [relayChannelSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'maintenance', 'error'],
      default: 'offline',
      index: true,
    },
    lastHeartbeat: {
      type: Date,
      default: null,
    },
    apiKey: {
      type: String,
      default: '',
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save synchronization hook
deviceSchema.pre('save', function (next) {
  // Sanitize empty strings
  if (this.sportId === '' || !this.sportId) this.sportId = null;
  if (this.resourceId === '' || !this.resourceId) this.resourceId = null;
  if (Array.isArray(this.sportIds)) {
    this.sportIds = this.sportIds.filter((x) => x && x !== '');
  }
  if (Array.isArray(this.resourceIds)) {
    this.resourceIds = this.resourceIds.filter((x) => x && x !== '');
  }

  // Sync sportIds & sportId
  if (Array.isArray(this.sportIds) && this.sportIds.length > 0) {
    if (!this.sportId) {
      this.sportId = this.sportIds[0];
    }
  } else if (this.sportId) {
    this.sportIds = [this.sportId];
  }

  // Sync resourceIds & resourceId
  if (Array.isArray(this.resourceIds) && this.resourceIds.length > 0) {
    if (!this.resourceId) {
      this.resourceId = this.resourceIds[0];
    }
  } else if (this.resourceId) {
    this.resourceIds = [this.resourceId];
  }

  // Determine accessScope if not explicitly set
  if (!this.accessScope || this.accessScope === 'sport') {
    if (this.isDefaultEntrance) {
      this.accessScope = 'branch_entrance';
    } else if (this.sportIds && this.sportIds.length > 1) {
      this.accessScope = 'multi_sport';
    } else if (this.resourceIds && this.resourceIds.length > 0) {
      this.accessScope = 'court';
    }
  }

  next();
});

// Compound Unique Index: device code must be unique within a branch
deviceSchema.index({ tenantId: 1, branchId: 1, code: 1 }, { unique: true });
deviceSchema.index({ tenantId: 1, type: 1 });
deviceSchema.index({ tenantId: 1, branchId: 1, type: 1 });
deviceSchema.index({ tenantId: 1, branchId: 1, sportIds: 1 });
deviceSchema.index({ tenantId: 1, branchId: 1, resourceIds: 1 });

export const Device = mongoose.models.Device || mongoose.model('Device', deviceSchema);
