export const bookingSlotItemSchema = {
  type: 'object',
  required: ['resourceId', 'date', 'startTime', 'endTime'],
  properties: {
    resourceId: { type: 'string', minLength: 24, maxLength: 24, description: 'Court / Resource ID' },
    date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'YYYY-MM-DD' },
    startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'HH:mm (e.g. 18:00)' },
    endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'HH:mm (e.g. 19:00)' },
    notes: { type: 'string' },
  },
};

export const createBookingSchema = {
  description: '[Roles: customer, member, tenant_admin, branch_manager, staff] Create a confirmed court/sports facility booking (single or multi-slot across dates), generate 6-digit access PIN, QR Code, and provision biometric access',
  tags: ['Bookings Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    properties: {
      resourceId: { type: 'string', minLength: 24, maxLength: 24, description: 'Court / Resource ID (for single slot)' },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'YYYY-MM-DD (for single slot)' },
      startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'HH:mm (e.g. 18:00)' },
      endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'HH:mm (e.g. 19:00)' },
      holdId: { type: 'string', description: 'Optional Redis slot hold ID' },
      paymentMethod: {
        type: 'string',
        enum: ['upi', 'card', 'cash', 'wallet', 'online', 'free', 'razorpay'],
        default: 'upi',
      },
      userId: { type: 'string', description: 'Optional target user ID (for booking on behalf of another user/sibling)' },
      studentId: { type: 'string', description: 'Optional target student ID (for booking on behalf of a sibling)' },
      notes: { type: 'string' },
      slots: {
        type: 'array',
        items: bookingSlotItemSchema,
        description: 'Array of slots to book simultaneously for multi-slot / multi-date booking',
      },
    },
  },
};

export const queryBookingsSchema = {
  description: '[Roles: customer, member, tenant_admin, branch_manager, staff] List bookings with filtering, branch isolation, and pagination',
  tags: ['Bookings Management'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Search by booking number, PIN, customer name, phone, or court' },
      date: { type: 'string', description: 'YYYY-MM-DD' },
      status: { type: 'string', enum: ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'] },
      resourceId: { type: 'string', description: 'Filter by Court ID' },
      branchId: { type: 'string', description: 'Filter by Branch ID' },
      tenantId: { type: 'string', description: 'Filter by Tenant ID (super admin)' },
      userId: { type: 'string', description: 'Filter by Customer User ID' },
      groupId: { type: 'string', description: 'Filter by Multi-slot Group ID' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

export const cancelBookingSchema = {
  description: '[Roles: customer, member, tenant_admin, branch_manager] Cancel an existing confirmed booking and process refund if within cancellation window',
  tags: ['Bookings Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Booking ID' },
    },
  },
  body: {
    type: 'object',
    nullable: true,
    properties: {
      reason: { type: 'string', description: 'Cancellation reason' },
    },
  },
};

export const getMyBookingsSchema = {
  description: '[Roles: customer, member, student] Retrieve current logged-in mobile user booking history, active access PINs, and entry QR codes',
  tags: ['Bookings Management'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled'] },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

export const bookingParamSchema = {
  description: '[Roles: customer, member, tenant_admin, branch_manager, staff] Booking ID parameter for details, check-in, or receipt invoice',
  tags: ['Bookings Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Booking ID' },
    },
  },
};

export const groupParamSchema = {
  description: 'Group ID parameter for retrieving all bookings in a multi-slot group',
  tags: ['Bookings Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['groupId'],
    properties: {
      groupId: { type: 'string', description: 'Multi-slot Group UUID' },
    },
  },
};

export const createRazorpayBookingOrderSchema = {
  description: '[Roles: customer, member, tenant_admin] Initialize Razorpay Payment Order for Court Slot Booking (single or multi-slot)',
  tags: ['Bookings Management', 'Finance & Monthly Fees'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    properties: {
      resourceId: { type: 'string', minLength: 24, maxLength: 24, description: 'Court / Resource ID (for single slot)' },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'YYYY-MM-DD' },
      startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'HH:mm (e.g. 18:00)' },
      endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'HH:mm (e.g. 19:00)' },
      holdId: { type: 'string', description: 'Optional 5-min slot hold ID' },
      phone: { type: 'string', description: 'Customer phone number' },
      email: { type: 'string', description: 'Customer email address' },
      name: { type: 'string', description: 'Customer full name' },
      customer: {
        type: 'object',
        properties: {
          phone: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
        },
      },
      slots: {
        type: 'array',
        items: bookingSlotItemSchema,
        description: 'Array of slots to include in the Razorpay order',
      },
    },
  },
};

export const verifyRazorpayBookingPaymentSchema = {
  description: '[Roles: customer, member, tenant_admin] Verify Razorpay signature and finalize confirmed court booking with access PIN pass (single or multi-slot)',
  tags: ['Bookings Management', 'Finance & Monthly Fees'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['razorpay_payment_id'],
    properties: {
      resourceId: { type: 'string', minLength: 24, maxLength: 24, description: 'Court / Resource ID' },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'YYYY-MM-DD' },
      startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'HH:mm (e.g. 18:00)' },
      endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'HH:mm (e.g. 19:00)' },
      razorpay_order_id: { type: 'string', description: 'Razorpay Order ID' },
      razorpay_payment_id: { type: 'string', description: 'Razorpay Payment ID (e.g. pay_29QQoUBcx96muk)' },
      razorpay_signature: { type: 'string', description: 'Razorpay HMAC-SHA256 signature' },
      holdId: { type: 'string', description: 'Optional slot hold ID' },
      phone: { type: 'string', description: 'Customer phone number' },
      email: { type: 'string', description: 'Customer email address' },
      name: { type: 'string', description: 'Customer full name' },
      customer: {
        type: 'object',
        properties: {
          phone: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
        },
      },
      notes: { type: 'string', description: 'Booking notes / remarks' },
      slots: {
        type: 'array',
        items: bookingSlotItemSchema,
        description: 'Array of slots belonging to this verified payment',
      },
    },
  },
};



