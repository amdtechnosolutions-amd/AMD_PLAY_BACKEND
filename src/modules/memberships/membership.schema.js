export const createPlanSchema = {
  description: '[Roles: tenant_admin, branch_manager] Create a new academy membership plan',
  tags: ['Members Management & Subscriptions'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['name', 'durationDays', 'price'],
    properties: {
      name: { type: 'string', minLength: 2, description: 'Plan name (e.g. Gold All-Sports Annual)' },
      code: { type: 'string', maxLength: 30, description: 'Unique code (auto-generated if omitted, e.g. ISA-BD-MORN-30)' },
      description: { type: 'string' },
      sportId: { type: 'string', minLength: 24, maxLength: 24, description: 'Optional specific Sport ID (null = all-sports academy access)' },
      durationDays: { type: 'integer', minimum: 1, description: 'Duration in days (e.g. 30, 90, 365)' },
      price: { type: 'number', minimum: 0, description: 'Plan price' },
      discountPercentage: { type: 'number', minimum: 0, maximum: 100, default: 10, description: 'Slot booking discount %' },
      timeSlot: {
        type: 'object',
        description: 'Allowed operating time slot for this membership plan',
        properties: {
          startTime: { type: 'string', description: 'Start time in HH:mm (e.g. 06:00)' },
          endTime: { type: 'string', description: 'End time in HH:mm (e.g. 22:00)' },
          daysOfWeek: {
            type: 'array',
            items: { type: 'integer', minimum: 1, maximum: 7 },
            description: 'Days of week (1=Monday...7=Sunday)',
          },
          slotName: { type: 'string', description: 'Slot title (e.g. Morning Access)' },
        },
      },
      hikvisionPlanTemplateNo: { type: 'integer', minimum: 1, maximum: 1024, description: 'Biometric terminal access plan template index' },
      courtId: { type: 'string', minLength: 24, maxLength: 24, description: 'Assigned Court / Resource ID (e.g. Court 1)' },
      courtIds: {
        type: 'array',
        items: { type: 'string', minLength: 24, maxLength: 24 },
        description: 'List of assigned Courts / Resource IDs for multi-court access',
      },
      resourceId: { type: 'string', minLength: 24, maxLength: 24, description: 'Alias for courtId' },
    },
  },
};

export const subscribeUserSchema = {
  description: '[Roles: customer, member, tenant_admin, branch_manager] Subscribe user to a membership plan and sync biometric access',
  tags: ['Members Management & Subscriptions'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['planId'],
    properties: {
      planId: { type: 'string', minLength: 24, maxLength: 24, description: 'Membership Plan ID' },
      userId: { type: 'string', minLength: 24, maxLength: 24, description: 'User ID (defaults to current user if omitted)' },
      branchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Branch ID' },
      sportId: { type: 'string', minLength: 24, maxLength: 24, description: 'Sport ID' },
      courtId: { type: 'string', minLength: 24, maxLength: 24, description: 'Assigned Court / Resource ID' },
      courtIds: {
        type: 'array',
        items: { type: 'string', minLength: 24, maxLength: 24 },
        description: 'List of assigned Courts',
      },
      resourceId: { type: 'string', minLength: 24, maxLength: 24, description: 'Alias for courtId' },
      pin: { type: 'string', description: 'Keypad 6-digit access PIN' },
      cardNo: { type: 'string', description: 'RFID / NFC Smartcard number' },
      timeSlot: {
        type: 'object',
        properties: {
          startTime: { type: 'string', description: 'e.g. 06:00' },
          endTime: { type: 'string', description: 'e.g. 22:00' },
          daysOfWeek: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 7 } },
          slotName: { type: 'string' },
        },
      },
      startTime: { type: 'string', description: 'e.g. 06:00' },
      endTime: { type: 'string', description: 'e.g. 22:00' },
      daysOfWeek: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 7 } },
      slotName: { type: 'string' },
      paymentMethod: {
        type: 'string',
        enum: ['upi', 'card', 'cash', 'wallet', 'online', 'free', 'razorpay'],
        default: 'upi',
      },
      startDate: { type: 'string', description: 'YYYY-MM-DD' },
      notes: { type: 'string' },
    },
  },
};

export const registerMemberSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff] Onboard a member, activate membership, assign time slot, and sync biometrics to sport terminals',
  tags: ['Members Management & Subscriptions'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['planId', 'firstName', 'phone'],
    properties: {
      planId: { type: 'string', minLength: 24, maxLength: 24, description: 'Membership Plan ID' },
      userId: { type: 'string', minLength: 24, maxLength: 24, description: 'Existing User ID (optional)' },
      branchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Branch ID' },
      sportId: { type: 'string', minLength: 24, maxLength: 24, description: 'Sport ID' },
      courtId: { type: 'string', minLength: 24, maxLength: 24, description: 'Assigned Court / Resource ID (e.g. Court 1)' },
      courtIds: {
        type: 'array',
        items: { type: 'string', minLength: 24, maxLength: 24 },
        description: 'List of assigned Courts / Resource IDs for multi-court access',
      },
      resourceId: { type: 'string', minLength: 24, maxLength: 24, description: 'Alias for courtId' },
      firstName: { type: 'string', minLength: 2, description: 'Member first name' },
      lastName: { type: 'string', description: 'Member last name' },
      email: { type: 'string', format: 'email', description: 'Member email address' },
      phone: { type: 'string', description: 'Member phone number' },
      employeeNo: { type: 'string', description: 'Biometric employee number (auto-generated if omitted, e.g. inembd001)' },
      pin: { type: 'string', description: 'Keypad 6-digit access PIN (auto-generated if omitted)' },
      cardNo: { type: 'string', description: 'RFID / NFC Smartcard number (defaults to PIN if omitted)' },
      timeSlot: {
        type: 'object',
        description: 'Assigned member access time slot',
        properties: {
          startTime: { type: 'string', description: 'Start time in HH:mm (e.g. 06:00)' },
          endTime: { type: 'string', description: 'End time in HH:mm (e.g. 08:00)' },
          daysOfWeek: {
            type: 'array',
            items: { type: 'integer', minimum: 1, maximum: 7 },
          },
          slotName: { type: 'string', description: 'Slot title (e.g. Morning Slot)' },
        },
      },
      startTime: { type: 'string', description: 'Direct start time shorthand (e.g. 06:00)' },
      endTime: { type: 'string', description: 'Direct end time shorthand (e.g. 08:00)' },
      daysOfWeek: {
        type: 'array',
        items: { type: 'integer', minimum: 1, maximum: 7 },
      },
      slotName: { type: 'string', description: 'Slot name (e.g. Morning Slot)' },
      paymentMethod: {
        type: 'string',
        enum: ['upi', 'card', 'cash', 'wallet', 'online', 'free', 'razorpay'],
        default: 'upi',
      },
      startDate: { type: 'string', description: 'YYYY-MM-DD' },
      notes: { type: 'string' },
    },
  },
};

export const queryPlansSchema = {
  description: '[Roles: All] List active membership plans available for subscription',
  tags: ['Members Management & Subscriptions'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['active', 'inactive'] },
      sportId: { type: 'string' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

export const planParamSchema = {
  description: '[Roles: All] Membership plan ID parameter',
  tags: ['Members Management & Subscriptions'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Plan ID' },
    },
  },
};

export const updatePlanSchema = {
  description: '[Roles: tenant_admin, branch_manager] Update an existing academy membership plan',
  tags: ['Members Management & Subscriptions'],
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
      name: { type: 'string', minLength: 2 },
      description: { type: 'string' },
      sportId: { type: 'string', minLength: 24, maxLength: 24 },
      durationDays: { type: 'integer', minimum: 1 },
      price: { type: 'number', minimum: 0 },
      discountPercentage: { type: 'number', minimum: 0, maximum: 100 },
      status: { type: 'string', enum: ['active', 'inactive', 'archived'] },
      timeSlot: {
        type: 'object',
        properties: {
          startTime: { type: 'string', description: 'e.g. 06:00' },
          endTime: { type: 'string', description: 'e.g. 22:00' },
          daysOfWeek: {
            type: 'array',
            items: { type: 'integer', minimum: 1, maximum: 7 },
          },
          slotName: { type: 'string' },
        },
      },
      hikvisionPlanTemplateNo: { type: 'integer', minimum: 1, maximum: 1024 },
      courtId: { type: 'string', minLength: 24, maxLength: 24 },
      courtIds: {
        type: 'array',
        items: { type: 'string', minLength: 24, maxLength: 24 },
      },
      resourceId: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
};

export const createMembershipRazorpayOrderSchema = {
  description: '[Roles: All authenticated] Generate a Razorpay order ID to subscribe to a membership plan via gateway',
  tags: ['Members Management & Subscriptions'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['planId'],
    properties: {
      planId: { type: 'string', minLength: 24, maxLength: 24, description: 'Membership Plan ID' },
      userId: { type: 'string', minLength: 24, maxLength: 24, description: 'Optional target User ID (defaults to authenticated user)' },
    },
  },
};

export const verifyMembershipRazorpayPaymentSchema = {
  description: '[Roles: All authenticated] Verify Razorpay signature and activate membership subscription',
  tags: ['Members Management & Subscriptions'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['planId', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'],
    properties: {
      planId: { type: 'string', minLength: 24, maxLength: 24, description: 'Membership Plan ID' },
      userId: { type: 'string', minLength: 24, maxLength: 24, description: 'Optional target User ID' },
      razorpay_order_id: { type: 'string', description: 'Razorpay order ID returned from order initiation' },
      razorpay_payment_id: { type: 'string', description: 'Razorpay payment ID from client checkout handler' },
      razorpay_signature: { type: 'string', description: 'Razorpay HMAC-SHA256 signature from client checkout handler' },
    },
  },
};

export const assignSubscriptionTimeSlotSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff] Assign or update member access time slot and sync biometric gate schedule',
  tags: ['Members Management & Subscriptions'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Member Subscription ID' },
    },
  },
  body: {
    type: 'object',
    required: ['startTime', 'endTime'],
    properties: {
      startTime: { type: 'string', description: 'Slot start time in HH:mm format (e.g. 06:00)' },
      endTime: { type: 'string', description: 'Slot end time in HH:mm format (e.g. 08:00)' },
      daysOfWeek: {
        type: 'array',
        items: { type: 'integer', minimum: 1, maximum: 7 },
        description: 'Days of week (1=Monday ... 7=Sunday)',
      },
      slotName: { type: 'string', description: 'Slot name (e.g. Morning Slot)' },
      courtId: { type: 'string', minLength: 24, maxLength: 24, description: 'Updated Court ID' },
      courtIds: {
        type: 'array',
        items: { type: 'string', minLength: 24, maxLength: 24 },
      },
    },
  },
};
