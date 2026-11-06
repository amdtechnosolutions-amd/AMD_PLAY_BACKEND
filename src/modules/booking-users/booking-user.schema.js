export const createBookingUserSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff, receptionist] Create a new booking user / casual player',
  tags: ['Booking Users & Customers'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['firstName', 'phone'],
    properties: {
      firstName: { type: 'string', minLength: 2, description: 'Player first name' },
      lastName: { type: 'string', description: 'Player last name' },
      phone: { type: 'string', minLength: 10, description: '10-digit mobile number' },
      email: { type: 'string', format: 'email', description: 'Email address (auto-generated if omitted)' },
      branchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Branch ID' },
      pin: { type: 'string', description: 'Access keypad PIN (e.g. 123456)' },
      cardNo: { type: 'string', description: 'RFID card number' },
      notes: { type: 'string' },
    },
  },
};

export const queryBookingUsersSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff, receptionist] List all booking users with booking stats & pagination',
  tags: ['Booking Users & Customers'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Search by name, phone, email, or employeeNo' },
      branchId: { type: 'string', description: 'Filter by Branch ID' },
      status: { type: 'string', enum: ['active', 'inactive', 'suspended'], default: 'active' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

export const bookingUserParamSchema = {
  description: 'Booking User ID parameter',
  tags: ['Booking Users & Customers'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'User ID' },
    },
  },
};

export const updateBookingUserSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff] Update booking user profile and biometric credentials',
  tags: ['Booking Users & Customers'],
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
      pin: { type: 'string' },
      cardNo: { type: 'string' },
      notes: { type: 'string' },
    },
  },
};

export const queryUserBookingsSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff, receptionist] Get booking history for a specific booking user',
  tags: ['Booking Users & Customers', 'Bookings & Reservations'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'Filter by booking status (confirmed, completed, cancelled)' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};
