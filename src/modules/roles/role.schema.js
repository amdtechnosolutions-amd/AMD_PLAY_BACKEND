export const createRoleSchema = {
  description: 'Create a custom role with granular permissions under the authenticated tenant',
  tags: ['SuperAdmin Management', 'Admin Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['name', 'slug', 'permissions'],
    properties: {
      name: { type: 'string', minLength: 2 },
      slug: { type: 'string', minLength: 2 },
      description: { type: 'string' },
      permissions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
};

export const updateRoleSchema = {
  description: 'Update custom role permissions or description',
  tags: ['SuperAdmin Management', 'Admin Management'],
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
      description: { type: 'string' },
      permissions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
};
