export const createTenantSchema = {
  description: 'Onboard a new sports academy / organization tenant (Super Admin only). Automatically creates databaseName, tenantId, slug, and assigns the default MAIN branch with payment settings.',
  tags: ['SuperAdmin Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2, description: 'Name of the sports academy' },
      slug: {
        anyOf: [
          { type: 'string', minLength: 2 },
          { type: 'string', maxLength: 0 },
          { type: 'null' },
        ],
        description: 'Optional unique URL slug. Auto-generated from name if omitted.',
      },
      domain: {
        anyOf: [
          { type: 'string', minLength: 2 },
          { type: 'string', maxLength: 0 },
          { type: 'null' },
        ],
        description: 'Optional custom domain',
      },
      plan: { type: 'string', enum: ['free', 'basic', 'professional', 'enterprise'], default: 'basic' },
      contactEmail: {
        anyOf: [
          { type: 'string', format: 'email' },
          { type: 'string', maxLength: 0 },
          { type: 'null' },
        ],
        description: 'Contact email. Auto-generated if omitted.',
      },
      contactPhone: {
        anyOf: [
          { type: 'string' },
          { type: 'null' },
        ],
        description: 'Contact phone number',
      },
      dbStrategy: { type: 'string', enum: ['A', 'B'], default: 'B', description: 'A: Multi-tenant shared DB, B: Isolated per-tenant DB' },
      databaseName: {
        anyOf: [
          { type: 'string' },
          { type: 'null' },
        ],
        description: 'Auto-generated dedicated database name if omitted',
      },
      adminUser: {
        anyOf: [
          {
            type: 'object',
            properties: {
              firstName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              lastName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              email: {
                anyOf: [
                  { type: 'string', format: 'email' },
                  { type: 'string', maxLength: 0 },
                  { type: 'null' },
                ],
              },
              password: {
                anyOf: [
                  { type: 'string', minLength: 6 },
                  { type: 'string', maxLength: 0 },
                  { type: 'null' },
                ],
              },
              phone: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
          },
          { type: 'null' },
        ],
      },
      settings: {
        type: 'object',
        properties: {
          currency: { type: 'string', default: 'INR' },
          timezone: { type: 'string', default: 'Asia/Kolkata' },
          taxPercentage: { type: 'number' },
          cancellationCutoffHours: { type: 'number' },
        },
      },
      branding: {
        type: 'object',
        properties: {
          logoUrl: { type: 'string' },
          primaryColor: { type: 'string' },
          accentColor: { type: 'string' },
        },
      },
    },
  },
};

export const updateTenantSchema = {
  description: 'Update academy / tenant organization settings and details',
  tags: ['Admin Management', 'SuperAdmin Management'],
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
      contactEmail: {
        anyOf: [
          { type: 'string', format: 'email' },
          { type: 'string', maxLength: 0 },
          { type: 'null' },
        ],
      },
      contactPhone: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      status: { type: 'string', enum: ['active', 'suspended', 'trial', 'cancelled'] },
      plan: { type: 'string', enum: ['free', 'basic', 'professional', 'enterprise'] },
      settings: { type: 'object' },
      branding: { type: 'object' },
      limits: { type: 'object' },
    },
  },
};

export const getTenantSchema = {
  description: 'Get academy / tenant details by ID',
  tags: ['Admin Management', 'SuperAdmin Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
};

export const lookupTenantBySlugSchema = {
  description: 'Public lookup for mobile apps & web to get academy branding, sports, and branch locations by academy slug',
  tags: ['Authentication', 'Admin Management'],
  params: {
    type: 'object',
    required: ['slug'],
    properties: {
      slug: { type: 'string', description: 'Unique academy slug (e.g. apex-sports)' },
    },
  },
};

export const lookupTenantByEmailSchema = {
  description: 'Public lookup to automatically discover academy tenant slug, branding, and status by registered user email (when user does not know their slug)',
  tags: ['Authentication', 'Admin Management', 'SuperAdmin Management'],
  querystring: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', description: 'Registered user email address' },
    },
  },
};


