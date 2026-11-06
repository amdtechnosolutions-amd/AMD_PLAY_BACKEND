export const createUserSchema = {
  description: 'Create a new staff, coach, or member user under the tenant',
  tags: ['Admin Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['firstName', 'email', 'password'],
    properties: {
      firstName: { type: 'string', minLength: 2 },
      lastName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      password: { type: 'string', minLength: 6 },
      role: { type: 'string' },
      branchId: { type: 'string' },
      permissions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
};

export const updateUserSchema = {
  description: 'Update user profile, branch assignment, status, or role',
  tags: ['Admin Management'],
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
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      phone: { type: 'string' },
      role: { type: 'string' },
      branchId: { type: 'string' },
      status: { type: 'string', enum: ['active', 'inactive', 'suspended', 'pending_verification'] },
      permissions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
};

export const userParamSchema = {
  description: 'User ID parameter',
  tags: ['Admin Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
};
