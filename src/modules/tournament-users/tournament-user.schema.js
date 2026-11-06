export const createTournamentUserSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff] Register a tournament player / participant for an event',
  tags: ['Tournament Users & Participants'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['fullName', 'phone', 'eventId', 'gender', 'dateOfBirth'],
    properties: {
      eventId: { type: 'string', minLength: 24, maxLength: 24, description: 'Tournament / Event ID' },
      fullName: { type: 'string', minLength: 2, description: 'Participant full name' },
      phone: { type: 'string', minLength: 10, description: 'Participant mobile number' },
      email: { type: 'string', format: 'email', description: 'Participant email address' },
      gender: { type: 'string', enum: ['Male', 'Female', 'Other'], description: 'Gender' },
      dateOfBirth: { type: 'string', description: 'Date of birth (YYYY-MM-DD)' },
      category: { type: 'string', description: 'Tournament category (e.g. Under-15 Singles, Open Doubles)' },
      seedNumber: { type: 'integer', minimum: 1, description: 'Seeding rank number' },
      academyName: { type: 'string', description: 'Representing academy / club / school' },
      coachName: { type: 'string', description: 'Coach name' },
      parentName: { type: 'string', description: 'Parent / Guardian name' },
      address: { type: 'string' },
      pincode: { type: 'string' },
      amount: { type: 'number', minimum: 0, description: 'Registration fee amount' },
      paymentMethod: {
        type: 'string',
        enum: ['online', 'upi', 'cash', 'card', 'free'],
        default: 'cash',
      },
      paymentStatus: {
        type: 'string',
        enum: ['paid', 'pending', 'failed', 'refunded'],
        default: 'paid',
      },
      transactionId: { type: 'string' },
      pin: { type: 'string', description: 'Gate / turnstile access PIN (auto-generated if omitted)' },
      cardNo: { type: 'string', description: 'RFID card number' },
      profilePhoto: { type: 'string' },
    },
  },
};

export const queryTournamentUsersSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff] List tournament participants with event filtering and search',
  tags: ['Tournament Users & Participants'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      eventId: { type: 'string', description: 'Filter by Tournament / Event ID' },
      category: { type: 'string', description: 'Filter by tournament category' },
      paymentStatus: { type: 'string', enum: ['paid', 'pending', 'failed', 'refunded'] },
      branchId: { type: 'string', description: 'Filter by Branch ID' },
      search: { type: 'string', description: 'Search by player name, phone, email, or academy name' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

export const tournamentUserParamSchema = {
  description: 'Tournament User / Participant ID parameter',
  tags: ['Tournament Users & Participants'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Participant Registration ID' },
    },
  },
};

export const updateTournamentUserSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff] Update tournament participant registration details',
  tags: ['Tournament Users & Participants'],
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
      fullName: { type: 'string', minLength: 2 },
      phone: { type: 'string' },
      email: { type: 'string', format: 'email' },
      category: { type: 'string' },
      seedNumber: { type: 'integer', minimum: 1 },
      academyName: { type: 'string' },
      coachName: { type: 'string' },
      parentName: { type: 'string' },
      paymentStatus: { type: 'string', enum: ['paid', 'pending', 'failed', 'refunded'] },
      paymentMethod: { type: 'string', enum: ['online', 'upi', 'cash', 'card', 'free'] },
      amount: { type: 'number', minimum: 0 },
      profilePhoto: { type: 'string' },
    },
  },
};
