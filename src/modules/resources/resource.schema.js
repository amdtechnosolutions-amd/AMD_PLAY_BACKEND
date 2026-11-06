export const createResourceSchema = {
  description: 'Create a new court, turf, or bookable sports resource',
  tags: ['Sports & Resources Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['branchId', 'sportId', 'name', 'code', 'pricing'],
    properties: {
      branchId: { type: 'string' },
      sportId: { type: 'string' },
      sportIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple sports supported by this resource (e.g. Cricket & Football on same turf)',
      },
      name: { type: 'string', minLength: 2 },
      code: { type: 'string', minLength: 2, maxLength: 10 },
      type: {
        type: 'string',
        enum: ['court', 'turf', 'pitch', 'table', 'pool', 'gym', 'generic'],
      },
      surface: { type: 'string' },
      capacity: { type: 'number', minimum: 1 },
      pricing: {
        type: 'object',
        required: ['basePrice'],
        properties: {
          pricingModel: { type: 'string', enum: ['hourly', 'session', 'shift', 'per_day'], description: 'hourly for regular courts/dynamic time pricing, shift/session for day/night flat rates' },
          basePrice: { type: 'number', minimum: 0, description: 'Base / Morning hourly rate (e.g. 300 for Badminton, 800 for Cricket/Football/Pickleball)' },
          dayShiftPrice: { type: 'number', minimum: 0, description: 'Flat rate for Morning Shift (e.g. 800)' },
          nightShiftPrice: { type: 'number', minimum: 0, description: 'Flat rate for Night Shift (e.g. 1000)' },
          dayShiftStartTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Day Shift start time (06:00)' },
          dayShiftEndTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Day Shift end time (20:00)' },
          nightShiftStartTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Night Shift start time (20:00)' },
          nightShiftEndTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Night Shift end time (06:00)' },
          peakPrice: { type: 'number', minimum: 0, description: 'Night / Floodlight slot price after 20:00 (e.g. 1000)' },
          peakStartTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Night start time (default: 20:00 / 8:00 PM)' },
          peakEndTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Night end time (default: 06:00 / 6:00 AM)' },
          weekendPrice: { type: 'number', minimum: 0 },
          memberPrice: { type: 'number', minimum: 0 },
        },
      },
      operatingHours: { type: 'array' },
      iotMapping: {
        type: 'object',
        additionalProperties: true,
        properties: {
          deviceId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          lightRelayChannel: {
            anyOf: [
              { type: 'number' },
              { type: 'string' },
              { type: 'array', items: { type: 'number' } },
              { type: 'null' },
            ],
          },
          lightRelayChannel2: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          lightRelayChannels: {
            anyOf: [
              { type: 'array', items: { type: 'number' } },
              { type: 'null' },
            ],
          },
          dualLights: { type: 'boolean' },
          row1: {
            anyOf: [
              { type: 'array', items: { type: 'number' } },
              { type: 'number' },
              { type: 'string' },
              { type: 'object', additionalProperties: true },
              { type: 'null' },
            ],
          },
          row2: {
            anyOf: [
              { type: 'array', items: { type: 'number' } },
              { type: 'number' },
              { type: 'string' },
              { type: 'object', additionalProperties: true },
              { type: 'null' },
            ],
          },
          row1Lights: {
            anyOf: [
              { type: 'array', items: { type: 'number' } },
              { type: 'null' },
            ],
          },
          row2Lights: {
            anyOf: [
              { type: 'array', items: { type: 'number' } },
              { type: 'null' },
            ],
          },
          row1LightRelayChannel: {
            anyOf: [
              { type: 'number' },
              { type: 'array', items: { type: 'number' } },
              { type: 'null' },
            ],
          },
          row2LightRelayChannel: {
            anyOf: [
              { type: 'number' },
              { type: 'array', items: { type: 'number' } },
              { type: 'null' },
            ],
          },
          lights: {
            anyOf: [
              { type: 'array', items: { type: 'number' } },
              { type: 'null' },
            ],
          },
          fanRelayChannel: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          fanRelayChannels: {
            anyOf: [
              { type: 'array', items: { type: 'number' } },
              { type: 'null' },
            ],
          },
        },
      },
      // Also allow root-level dual light parameters if passed outside iotMapping
      lightRelayChannel: { anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'array', items: { type: 'number' } }] },
      lightRelayChannel2: { type: 'number' },
      lightRelayChannels: { type: 'array', items: { type: 'number' } },
      row1: { anyOf: [{ type: 'array', items: { type: 'number' } }, { type: 'number' }, { type: 'string' }, { type: 'object', additionalProperties: true }] },
      row1Lights: { type: 'array', items: { type: 'number' } },
      dualLights: { type: 'boolean' },
    },
  },
};

export const updateResourceSchema = {
  description: 'Update court or resource details, pricing, and status',
  tags: ['Sports & Resources Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    additionalProperties: true,
    properties: {
      sportId: { type: 'string' },
      sportIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple sports supported by this resource (e.g. Cricket & Football on same turf)',
      },
      name: { type: 'string' },
      surface: { type: 'string' },
      capacity: { type: 'number' },
      status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
      pricing: {
        type: 'object',
        properties: {
          pricingModel: { type: 'string', enum: ['hourly', 'session', 'shift', 'per_day'] },
          basePrice: { type: 'number' },
          dayShiftPrice: { type: 'number' },
          nightShiftPrice: { type: 'number' },
          dayShiftStartTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          dayShiftEndTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          nightShiftStartTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          nightShiftEndTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          peakPrice: { type: 'number' },
          peakStartTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          peakEndTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          weekendPrice: { type: 'number' },
          memberPrice: { type: 'number' },
        },
      },
      operatingHours: { type: 'array' },
      iotMapping: {
        type: 'object',
        additionalProperties: true,
      },
      lightRelayChannel: { anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'array', items: { type: 'number' } }] },
      lightRelayChannel2: { type: 'number' },
      lightRelayChannels: { type: 'array', items: { type: 'number' } },
      row1: { anyOf: [{ type: 'array', items: { type: 'number' } }, { type: 'number' }, { type: 'string' }, { type: 'object', additionalProperties: true }] },
      row1Lights: { type: 'array', items: { type: 'number' } },
      dualLights: { type: 'boolean' },
    },
  },
};

export const setMaintenanceSchema = {
  description: 'Set or clear maintenance schedule for a court/resource',
  tags: ['Sports & Resources Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['isUnderMaintenance'],
    properties: {
      isUnderMaintenance: { type: 'boolean' },
      reason: { type: 'string' },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
    },
  },
};

export const resourceParamSchema = {
  description: 'Resource ID parameter',
  tags: ['Sports & Resources Management'],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
};
