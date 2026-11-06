export const createMemberSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff] Onboard a new member with membership plan, assigned court, PIN, and biometric credentials',
  tags: ['Members Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['firstName', 'phone'],
    properties: {
      planId: { type: 'string', minLength: 24, maxLength: 24, description: 'Membership Plan ID' },
      firstName: { type: 'string', minLength: 2, description: 'Member first name' },
      lastName: { type: 'string', description: 'Member last name' },
      phone: { type: 'string', minLength: 10, description: 'Member 10-digit mobile number' },
      email: { type: 'string', format: 'email', description: 'Member email address (auto-generated if omitted)' },
      branchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Academy Branch ID' },
      sportId: { type: 'string', minLength: 24, maxLength: 24, description: 'Sport ID (defaults to plan sport)' },
      courtId: { type: 'string', minLength: 24, maxLength: 24, description: 'Assigned Court ID (e.g. Court 1)' },
      courtIds: {
        type: 'array',
        items: { type: 'string', minLength: 24, maxLength: 24 },
        description: 'Assigned Court IDs for multi-court access',
      },
      employeeNo: { type: 'string', description: 'Biometric employee number (auto-generated if omitted, e.g. inembd005)' },
      pin: { type: 'string', description: 'Keypad 6-digit access PIN (auto-generated if omitted)' },
      cardNo: { type: 'string', description: 'RFID / Smartcard number (defaults to PIN if omitted)' },
      paymentMethod: {
        type: 'string',
        enum: ['upi', 'card', 'cash', 'wallet', 'online', 'free', 'razorpay'],
        default: 'upi',
      },
      timeSlot: {
        type: 'object',
        description: 'Operating time slot (defaults to plan schedule if omitted)',
        properties: {
          startTime: { type: 'string', description: 'HH:mm (e.g. 06:00)' },
          endTime: { type: 'string', description: 'HH:mm (e.g. 08:00)' },
          daysOfWeek: {
            type: 'array',
            items: { type: 'integer', minimum: 1, maximum: 7 },
          },
          slotName: { type: 'string' },
        },
      },
      startDate: { type: 'string', description: 'Subscription start date (YYYY-MM-DD)' },
      notes: { type: 'string' },
    },
  },
};

export const queryMembersSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff] List all members with filtering, search, and pagination',
  tags: ['Members Management'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Search by name, phone, email, employeeNo, or cardNo' },
      branchId: { type: 'string', description: 'Filter by Branch ID' },
      sportId: { type: 'string', description: 'Filter by Sport ID' },
      planId: { type: 'string', description: 'Filter by Membership Plan ID' },
      status: { type: 'string', enum: ['active', 'inactive', 'suspended'], default: 'active' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

export const memberParamSchema = {
  description: 'Member ID parameter',
  tags: ['Members Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Member User ID' },
    },
  },
};

export const updateMemberSchema = {
  description: '[Roles: tenant_admin, branch_manager] Update member profile and biometric credentials',
  tags: ['Members Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
  body: {
    type: 'object',
    properties: {
      firstName: { type: 'string', minLength: 2 },
      lastName: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string', format: 'email' },
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
      status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
      employeeNo: { type: 'string' },
      pin: { type: 'string' },
      cardNo: { type: 'string' },
      notes: { type: 'string' },
    },
  },
};
