export const createBranchSchema = {
  description: 'Create a new physical branch location under the authenticated tenant',
  tags: ['Branches Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['name', 'code'],
    properties: {
      name: { type: 'string', minLength: 2 },
      code: { type: 'string', minLength: 2, maxLength: 10 },
      address: {
        type: 'object',
        properties: {
          street: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          postalCode: { type: 'string' },
          country: { type: 'string' },
          coordinates: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lng: { type: 'number' },
            },
          },
        },
      },
      contactPhone: { type: 'string' },
      contactEmail: {
        anyOf: [
          { type: 'string', format: 'email' },
          { type: 'string', maxLength: 0 },
          { type: 'null' },
        ],
      },
      timezone: { type: 'string' },
      status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
      tenantId: { type: 'string' },
      paymentSettings: {
        type: 'object',
        properties: {
          razorpay: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              keyId: { type: 'string' },
              keySecret: { type: 'string' },
              webhookSecret: { type: 'string' },
            },
          },
          upi: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              upiId: { type: 'string' },
              merchantName: { type: 'string' },
              qrImageUrl: { type: 'string' },
            },
          },
          bankAccount: {
            type: 'object',
            properties: {
              accountNumber: { type: 'string' },
              ifscCode: { type: 'string' },
              bankName: { type: 'string' },
              accountHolder: { type: 'string' },
            },
          },
          cashAccepted: { type: 'boolean' },
        },
      },
      operatingHours: {
        type: 'array',
        items: {
          type: 'object',
          required: ['dayOfWeek', 'openTime', 'closeTime'],
          properties: {
            dayOfWeek: { type: 'number', minimum: 0, maximum: 6 },
            openTime: { type: 'string' },
            closeTime: { type: 'string' },
            isOpen: { type: 'boolean' },
          },
        },
      },
    },
  },
};

export const updateBranchSchema = {
  description: 'Update branch information or operating schedule',
  tags: ['Branches Management'],
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
      address: { type: 'object' },
      contactPhone: { type: 'string' },
      contactEmail: {
        anyOf: [
          { type: 'string', format: 'email' },
          { type: 'string', maxLength: 0 },
          { type: 'null' },
        ],
      },
      timezone: { type: 'string' },
      status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
      operatingHours: { type: 'array' },
      managerId: { type: 'string' },
    },
  },
};

export const branchParamSchema = {
  description: 'Branch ID parameter',
  tags: ['Branches Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
};
