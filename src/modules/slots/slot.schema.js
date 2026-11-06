export const getSlotsSchema = {
  description: 'Retrieve dynamic slots and availability grid for a court/turf on a specific date. Supports both Hourly Discrete Slots and Shift / Session Flat-Rate Models (Day & Night Shift).',
  tags: ['Slots & Dynamic Pricing'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    required: ['date'],
    properties: {
      resourceId: { type: 'string', description: 'Court/Resource ID' },
      branchId: { type: 'string', description: 'Optional Branch ID' },
      sportId: { type: 'string', description: 'Optional Sport ID' },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Date in YYYY-MM-DD' },
      duration: { type: 'integer', minimum: 15, maximum: 720, description: 'Slot duration in minutes (e.g. 60 min for hourly or up to 720 for full shifts)' },
    },
  },
};

export const slotItemSchema = {
  type: 'object',
  required: ['resourceId', 'date', 'startTime', 'endTime'],
  properties: {
    resourceId: { type: 'string', minLength: 24, maxLength: 24, description: 'Court / Turf Resource ID' },
    date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Booking date YYYY-MM-DD' },
    startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Slot start time e.g. 06:00' },
    endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Slot end time e.g. 07:00' },
  },
};

export const holdSlotSchema = {
  description: 'Atomically hold/lock one or multiple slots across dates for 5 minutes during checkout to prevent double-booking',
  tags: ['Slots & Dynamic Pricing'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    properties: {
      resourceId: { type: 'string', minLength: 24, maxLength: 24, description: 'Court / Turf Resource ID (for single slot)' },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Booking date YYYY-MM-DD (for single slot)' },
      startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Slot start time e.g. 06:00 (for single slot)' },
      endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Slot end time e.g. 07:00 (for single slot)' },
      slots: {
        type: 'array',
        items: slotItemSchema,
        description: 'Array of slots to hold simultaneously for multi-slot / multi-date booking',
      },
    },
  },
};

export const releaseSlotSchema = {
  description: 'Release an existing slot hold or multiple slot holds before the 5-minute TTL expires',
  tags: ['Slots & Dynamic Pricing'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    properties: {
      resourceId: { type: 'string', minLength: 24, maxLength: 24 },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
      holdId: { type: 'string', description: 'Optional Hold UUID' },
      slots: {
        type: 'array',
        items: {
          type: 'object',
          required: ['resourceId', 'date', 'startTime'],
          properties: {
            resourceId: { type: 'string', minLength: 24, maxLength: 24 },
            date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
            holdId: { type: 'string' },
          },
        },
        description: 'Array of slots to release simultaneously',
      },
    },
  },
};

export const calculatePriceSchema = {
  description: 'Calculate multi-tier pricing breakdown for a single slot or multiple slots across dates',
  tags: ['Slots & Dynamic Pricing'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    properties: {
      resourceId: { type: 'string', minLength: 24, maxLength: 24, description: 'Court / Turf Resource ID' },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Booking date YYYY-MM-DD' },
      startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Slot / Shift start time' },
      endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Slot / Shift end time' },
      slots: {
        type: 'array',
        items: slotItemSchema,
        description: 'Array of slots to calculate combined pricing for multi-slot / multi-date checkout',
      },
    },
  },
};
