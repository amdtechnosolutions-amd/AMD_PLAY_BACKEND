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
    required: ['password'],
    properties: {
      email: { type: 'string', description: 'Registered user email address or mobile phone' },
      identifier: { type: 'string', description: 'User email, mobile phone number, or staff employee ID' },
      phone: { type: 'string', description: 'Registered mobile phone number' },
      role: { type: 'string', description: 'Optional role filter (e.g. coach)' },
      password: { type: 'string', minLength: 1, description: 'User password' },
      tenantSlug: { type: 'string', description: 'Optional academy slug (e.g. apex-sports, inertia-sports-academy). Auto-resolved from email/phone if omitted.' },
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
  description: 'Dedicated Academy Admin, Coach & Staff authentication. If tenantSlug is omitted, the academy is automatically resolved and returned in the response with full tenant details.',
  tags: ['Admin Management', 'Authentication'],
  body: {
    type: 'object',
    required: ['password'],
    properties: {
      email: { type: 'string', description: 'Registered academy user email or phone' },
      identifier: { type: 'string', description: 'User email, mobile phone number, or employee ID' },
      phone: { type: 'string', description: 'Registered mobile phone number' },
      password: { type: 'string', minLength: 1, description: 'User account password' },
      tenantSlug: { type: 'string', description: 'Optional: Academy unique slug (e.g. apex-sports). If omitted, tenant will be auto-resolved.' },
    },
  },
};

export const coachLoginSchema = {
  description: '[Roles: coach] Dedicated Coach & Trainer Authentication by email, phone, or employee ID',
  tags: ['Admin Management', 'Authentication', 'Coaching Management'],
  body: {
    type: 'object',
    required: ['password'],
    properties: {
      email: { type: 'string', description: 'Coach registered email or identifier' },
      identifier: { type: 'string', description: 'Coach email, mobile phone number, or employee ID' },
      phone: { type: 'string', description: 'Coach registered mobile phone number' },
      employeeNo: { type: 'string', description: 'Coach employee number (e.g. isacoch001)' },
      password: { type: 'string', minLength: 1, description: 'Coach account password' },
      tenantSlug: { type: 'string', description: 'Optional: Academy unique slug (e.g. inertia-sports-academy)' },
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
    properties: {
      targetStudentId: { type: 'string', minLength: 24, maxLength: 24, description: 'Sibling Student ID to switch session into' },
      studentId: { type: 'string', minLength: 24, maxLength: 24, description: 'Alias for targetStudentId' },
    },
    additionalProperties: true,
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

export const forgotPasswordSchema = {
  description: '[Public] Request a 6-digit verification OTP via WhatsApp / SMS for password reset (Coach, Admin, or Student)',
  tags: ['Authentication'],
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email', description: 'Registered email' },
      identifier: { type: 'string', description: 'Email, mobile phone number, or student regNo' },
      phone: { type: 'string', description: 'Registered 10-digit mobile number' },
      regNo: { type: 'string', description: 'Student registration / admission number' },
      employeeNo: { type: 'string' },
      tenantSlug: { type: 'string', description: 'Optional academy slug' },
    },
  },
};

export const resetPasswordSchema = {
  description: '[Public] Reset password for Coach, Academy Admin, or Students by registered email, phone, or admission regNo (with optional OTP)',
  tags: ['Authentication'],
  body: {
    type: 'object',
    required: ['newPassword'],
    properties: {
      email: { type: 'string', format: 'email', description: 'Registered email address (for Coach / Admin / Student)' },
      identifier: { type: 'string', description: 'Alternative identifier: email, phone, regNo, or employeeNo' },
      phone: { type: 'string', description: 'Registered mobile phone number' },
      regNo: { type: 'string', description: 'Student admission / registration number (e.g. 1001)' },
      employeeNo: { type: 'string', description: 'Staff or Student employee number' },
      tenantSlug: { type: 'string', description: 'Optional academy slug (e.g. gba, apex-sports)' },
      role: { type: 'string', description: 'Optional role filter (e.g. coach, student, tenant_admin)' },
      otp: { type: 'string', description: 'Optional 6-digit OTP received via WhatsApp / SMS' },
      newPassword: { type: 'string', minLength: 6, description: 'New password (minimum 6 characters)' },
    },
  },
};

export const studentResetPasswordSchema = {
  description: '[Public] Dedicated Student / Trainee Password Reset by registration number, phone, or email',
  tags: ['Authentication', 'Students Management'],
  body: {
    type: 'object',
    required: ['newPassword'],
    properties: {
      regNo: { type: 'string', description: 'Student registration / admission number (e.g. 1001, STU-1001)' },
      identifier: { type: 'string', description: 'Student regNo, phone, or email' },
      phone: { type: 'string', description: 'Registered parent or student mobile number' },
      email: { type: 'string', format: 'email', description: 'Registered email address' },
      employeeNo: { type: 'string' },
      studentId: { type: 'string', minLength: 24, maxLength: 24, description: 'Optional specific sibling student ID' },
      tenantSlug: { type: 'string', description: 'Optional academy slug' },
      otp: { type: 'string', description: 'Optional 6-digit OTP received via WhatsApp / SMS' },
      newPassword: { type: 'string', minLength: 6, description: 'New student password (minimum 6 characters)' },
    },
  },
};

export const changePasswordSchema = {
  description: '[Authenticated] Change password for currently logged-in user (Admin, Coach, Staff, or Student)',
  tags: ['Authentication'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string', minLength: 1, description: 'Current password' },
      newPassword: { type: 'string', minLength: 6, description: 'New password (minimum 6 characters)' },
    },
  },
};

export const adminResetPasswordSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach, super_admin] Directly reset a user or student password by ID',
  tags: ['Admin Management', 'Authentication'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Target User ID' },
    },
  },
  body: {
    type: 'object',
    required: ['newPassword'],
    properties: {
      newPassword: { type: 'string', minLength: 6, description: 'New password (minimum 6 characters)' },
    },
  },
};



