export const createSportSchema = {
  description: 'Create a new sport entry in the sports master catalog',
  tags: ['Sports & Resources Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['name', 'slug'],
    properties: {
      name: { type: 'string', minLength: 2 },
      slug: { type: 'string', minLength: 2 },
      type: {
        type: 'string',
        enum: ['court', 'turf', 'pitch', 'table', 'pool', 'gym', 'generic'],
      },
      icon: { type: 'string' },
      defaultDurationMinutes: { type: 'number', minimum: 15, maximum: 240 },
      minPlayers: { type: 'number', minimum: 1 },
      maxPlayers: { type: 'number', minimum: 1 },
      active: { type: 'boolean' },
    },
  },
};

export const updateSportSchema = {
  description: 'Update sport metadata in the catalog',
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
    properties: {
      name: { type: 'string' },
      type: {
        type: 'string',
        enum: ['court', 'turf', 'pitch', 'table', 'pool', 'gym', 'generic'],
      },
      icon: { type: 'string' },
      defaultDurationMinutes: { type: 'number' },
      minPlayers: { type: 'number' },
      maxPlayers: { type: 'number' },
      active: { type: 'boolean' },
    },
  },
};

export const sportParamSchema = {
  description: 'Sport ID parameter',
  tags: ['Sports & Resources Management'],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
};
