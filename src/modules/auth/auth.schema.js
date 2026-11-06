export const registerSchema = {
  description: 'Register a new user under a tenant academy',
  tags: ['Authentication'],
  body: {
    type: 'object',
    required: ['firstName', 'email', 'password'],
    properties: {
      tenantId: { type: 'string' },
      tenantSlug: { type: 'string', description: 'Unique academy slug (e.g. apex-sports)' },
      branchId: { type: 'string' },
      firstName: { type: 'string', minLength: 2 },
      lastName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      password: { type: 'string', minLength: 6 },
      role: { type: 'string' },
    },
  },
};

export const loginSchema = {
  description: 'Universal login for academy staff, coaches, members, and customers. Automatically discovers and returns tenant details (slug, name, branding, database) in the response.',
  tags: ['Authentication'],
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', description: 'Registered user email address' },
      password: { type: 'string', minLength: 1, description: 'User password' },
      tenantSlug: { type: 'string', description: 'Optional academy slug (e.g. apex-sports). Auto-resolved from email if omitted.' },
    },
  },
};

export const superAdminLoginSchema = {
  description: 'Dedicated Platform Super Admin authentication',
  tags: ['SuperAdmin Management', 'Authentication'],
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', description: 'Superadmin email (e.g. admin@amdtechno.in)' },
      password: { type: 'string', minLength: 1 },
    },
  },
};

export const tenantLoginSchema = {
  description: 'Dedicated Academy Admin, Coach & Staff authentication. If tenantSlug is omitted, the academy is automatically resolved from the user email and returned in the response with full tenant details.',
  tags: ['Admin Management', 'Authentication'],
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', description: 'Registered academy user email' },
      password: { type: 'string', minLength: 1, description: 'User account password' },
      tenantSlug: { type: 'string', description: 'Optional: Academy unique slug (e.g. apex-sports). If omitted, tenant will be auto-resolved from email.' },
    },
  },
};

export const studentLoginSchema = {
  description: '[Roles: student] Dedicated Student / Trainee Login by regNo, employeeNo, phone, cardNo or email (No tenantSlug or studentId required)',
  tags: ['Authentication', 'Students Management'],
  body: {
    type: 'object',
    required: ['password'],
    properties: {
      regNo: { type: 'string', description: 'Student registration number / admission ID (e.g. 1001, STU-1001)' },
      identifier: { type: 'string', description: 'Student regNo, email, phone, employeeNo, or cardNo' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      employeeNo: { type: 'string' },
      cardNo: { type: 'string' },
      studentId: { type: 'string', description: 'Optional specific sibling student ID if multiple profiles match the phone' },
      password: { type: 'string', minLength: 1, description: 'Student password (Default: Isa@123 or Student123!)' },
      tenantSlug: { type: 'string', description: 'Optional academy slug' },
    },
  },
};

export const switchStudentProfileSchema = {
  description: '[Roles: student] Seamlessly switch active student session to a registered sibling under the same family mobile number',
  tags: ['Authentication', 'Students Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['targetStudentId'],
    properties: {
      targetStudentId: { type: 'string', minLength: 24, maxLength: 24, description: 'Sibling Student ID to switch session into' },
    },
  },
};


export const memberLoginSchema = {
  description: '[Roles: member] Dedicated Club Member Login (by email, phone, or membership card number)',
  tags: ['Authentication', 'Members Management & Subscriptions'],
  body: {
    type: 'object',
    required: ['password'],
    properties: {
      identifier: { type: 'string', description: 'Member email, phone, cardNo, or employeeNo' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      cardNo: { type: 'string' },
      password: { type: 'string', minLength: 1, description: 'Member password (Default: Member123!)' },
      tenantSlug: { type: 'string', description: 'Optional academy slug' },
    },
  },
};

export const registerAndBookSchema = {
  description: '[Roles: Public / New User] Seamless instant user registration + court booking checkout (single or multi-slot across dates) in a single request',
  tags: ['Authentication', 'Bookings Management'],
  body: {
    type: 'object',
    required: ['firstName', 'phone'],
    properties: {
      firstName: { type: 'string', minLength: 2, description: 'Player first name' },
      lastName: { type: 'string', description: 'Player last name' },
      phone: { type: 'string', minLength: 10, description: 'Player phone number' },
      email: {
        type: 'string',
        description: 'Player email address (optional)',
        nullable: true,
      },
      password: { type: 'string', minLength: 6, default: 'Player123!' },
      tenantSlug: { type: 'string' },
      tenantId: { type: 'string' },
      resourceId: { type: 'string', minLength: 24, maxLength: 24, description: 'Court / Turf Resource ID (for single slot)' },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Booking date YYYY-MM-DD (for single slot)' },
      startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'HH:mm (e.g. 18:00)' },
      endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'HH:mm (e.g. 19:00)' },
      paymentMethod: {
        type: 'string',
        enum: ['upi', 'card', 'cash', 'wallet', 'online', 'free'],
        default: 'upi',
      },
      notes: { type: 'string' },
      slots: {
        type: 'array',
        items: {
          type: 'object',
          required: ['resourceId', 'date', 'startTime', 'endTime'],
          properties: {
            resourceId: { type: 'string', minLength: 24, maxLength: 24 },
            date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
            endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
            notes: { type: 'string' },
          },
        },
        description: 'Array of slots to book simultaneously for multi-slot / multi-date booking',
      },
    },
  },
};

export const guestRegisterSchema = {
  description: '[Roles: Public] Quick customer registration or instant auto-match by phone for seamless Pay and Play booking',
  tags: ['Authentication'],
  body: {
    type: 'object',
    required: ['phone'],
    properties: {
      phone: { type: 'string', minLength: 10, description: '10-digit player mobile number' },
      name: { type: 'string', description: 'Player full name' },
      firstName: { type: 'string', description: 'Player first name' },
      lastName: { type: 'string', description: 'Player last name' },
      email: {
        type: 'string',
        description: 'Optional player email address',
        nullable: true,
      },
      tenantSlug: { type: 'string' },
      tenantId: { type: 'string' },
    },
  },
};


