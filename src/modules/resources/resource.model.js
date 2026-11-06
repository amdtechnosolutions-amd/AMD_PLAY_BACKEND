import mongoose from 'mongoose';

const resourcePricingSchema = new mongoose.Schema(
  {
    pricingModel: {
      type: String,
      enum: ['hourly', 'session', 'shift', 'per_day'],
      default: 'hourly',
    },
    basePrice: {
      type: Number,
      required: [true, 'Base / Day price is required'],
      min: 0,
      default: 800,
    },
    dayShiftPrice: {
      type: Number,
      default: 800, // Flat rate for Morning Shift
      min: 0,
    },
    nightShiftPrice: {
      type: Number,
      default: 1000, // Flat rate for Night Shift
      min: 0,
    },
    dayShiftStartTime: {
      type: String,
      default: '06:00',
    },
    dayShiftEndTime: {
      type: String,
      default: '20:00',
    },
    nightShiftStartTime: {
      type: String,
      default: '20:00',
    },
    nightShiftEndTime: {
      type: String,
      default: '06:00',
    },
    peakPrice: {
      type: Number,
      default: 1000,
      min: 0,
    },
    peakStartTime: {
      type: String,
      default: '20:00', // 8:00 PM (Night pricing starts after 20:00)
    },
    peakEndTime: {
      type: String,
      default: '06:00', // 6:00 AM next morning
    },
    weekendPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    memberPrice: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  { _id: false }
);

const resourceMaintenanceSchema = new mongoose.Schema(
  {
    isUnderMaintenance: {
      type: Boolean,
      default: false,
    },
    reason: {
      type: String,
      default: '',
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const iotMappingSchema = new mongoose.Schema(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      default: null,
      set: (v) => (v === '' || !v ? null : v),
    },
    // Primary light relay channel (Number, String, or Array)
    lightRelayChannel: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Secondary light relay channel (dual lights)
    lightRelayChannel2: {
      type: Number,
      default: null,
    },
    // Array of light channels (dual/multiple lights: [1, 2])
    lightRelayChannels: {
      type: [Number],
      default: undefined,
    },
    // Dual lights indicator
    dualLights: {
      type: Boolean,
      default: false,
    },
    // Explicit row 1 / row 2 assignments (e.g. 2 lights in row one)
    row1: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    row2: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    row1Lights: {
      type: [Number],
      default: undefined,
    },
    row2Lights: {
      type: [Number],
      default: undefined,
    },
    row1LightRelayChannel: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    row2LightRelayChannel: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    lights: {
      type: [Number],
      default: undefined,
    },
    fanRelayChannel: {
      type: Number,
      default: null,
    },
    fanRelayChannels: {
      type: [Number],
      default: undefined,
    },
  },
  { _id: false, strict: false }
);

const resourceSchema = new mongoose.Schema(
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
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      required: [true, 'Sport ID is required'],
      index: true,
    },
    sportIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sport' }],
      default: [],
      index: true,
      set: (v) => (Array.isArray(v) ? v.filter((x) => x && x !== '') : []),
    },
    name: {
      type: String,
      required: [true, 'Resource court/ground name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Resource code is required (e.g. CRT-01)'],
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['court', 'turf', 'pitch', 'table', 'pool', 'gym', 'generic'],
      default: 'court',
    },
    surface: {
      type: String,
      default: 'Synthetic Mat',
      trim: true,
    },
    capacity: {
      type: Number,
      default: 4,
      min: 1,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active',
      index: true,
    },
    pricing: {
      type: resourcePricingSchema,
      required: [true, 'Resource pricing is required'],
    },
    is24Hours: {
      type: Boolean,
      default: true,
    },
    operatingHours: {
      type: Array,
      default: [], // If empty, inherits branch operating hours
    },
    maintenance: {
      type: resourceMaintenanceSchema,
      default: () => ({ isUnderMaintenance: false, reason: '', startDate: null, endDate: null }),
    },
    iotMapping: {
      type: iotMappingSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

// Pre-save hook to normalize dual lights & row 1 assignments across all representations
resourceSchema.pre('save', function (next) {
  if (this.iotMapping) {
    const iot = this.iotMapping;
    let list = [];

    if (Array.isArray(iot.lightRelayChannels)) {
      list.push(...iot.lightRelayChannels);
    }
    if (Array.isArray(iot.row1Lights)) {
      list.push(...iot.row1Lights);
    }
    if (Array.isArray(iot.row1)) {
      list.push(...iot.row1);
    }
    if (Array.isArray(iot.lights)) {
      list.push(...iot.lights);
    }
    if (Array.isArray(iot.lightRelayChannel)) {
      list.push(...iot.lightRelayChannel);
    }

    if (iot.lightRelayChannel && !Array.isArray(iot.lightRelayChannel) && !isNaN(Number(iot.lightRelayChannel))) {
      list.push(Number(iot.lightRelayChannel));
    }
    if (iot.lightRelayChannel2 && !isNaN(Number(iot.lightRelayChannel2))) {
      list.push(Number(iot.lightRelayChannel2));
    }

    const uniqueLights = Array.from(new Set(list.map(Number).filter((n) => !isNaN(n))));
    if (uniqueLights.length > 0) {
      this.iotMapping.lightRelayChannels = uniqueLights;
      this.iotMapping.lightRelayChannel = uniqueLights[0];
      if (uniqueLights.length > 1) {
        this.iotMapping.lightRelayChannel2 = uniqueLights[1];
        this.iotMapping.dualLights = true;
      }
      if (!this.iotMapping.row1Lights || this.iotMapping.row1Lights.length === 0) {
        this.iotMapping.row1Lights = uniqueLights;
      }
      if (!this.iotMapping.row1) {
        this.iotMapping.row1 = uniqueLights;
      }
    }
  }

  // Synchronize sportId and sportIds
  if (this.sportId && (!this.sportIds || this.sportIds.length === 0)) {
    this.sportIds = [this.sportId];
  } else if (Array.isArray(this.sportIds) && this.sportIds.length > 0 && !this.sportId) {
    this.sportId = this.sportIds[0];
  } else if (this.sportId && Array.isArray(this.sportIds)) {
    const sIdStr = this.sportId.toString();
    if (!this.sportIds.some((id) => id && id.toString() === sIdStr)) {
      this.sportIds.unshift(this.sportId);
    }
  }

  next();
});

// Compound Unique Index: resource code unique within a branch under a tenant
resourceSchema.index({ tenantId: 1, branchId: 1, code: 1 }, { unique: true });
resourceSchema.index({ tenantId: 1, branchId: 1, sportId: 1, status: 1 });
resourceSchema.index({ tenantId: 1, branchId: 1, sportIds: 1, status: 1 });
resourceSchema.index({ tenantId: 1, status: 1 });
resourceSchema.index({ tenantId: 1, branchId: 1, status: 1 });

export const Resource = mongoose.models.Resource || mongoose.model('Resource', resourceSchema);
