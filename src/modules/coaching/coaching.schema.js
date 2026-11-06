export const createBatchSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach] Create a coaching batch / program for a sport and branch',
  tags: ['Coaching & Batches'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['branchId', 'sportId', 'coachId', 'name', 'schedule', 'maxStudents', 'monthlyFee'],
    properties: {
      branchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Branch ID' },
      sportId: { type: 'string', minLength: 24, maxLength: 24, description: 'Sport ID' },
      resourceId: { type: 'string', minLength: 24, maxLength: 24, description: 'Optional specific court / resource ID' },
      courtId: { type: 'string', minLength: 24, maxLength: 24, description: 'Assigned Court ID (alias for resourceId, e.g. Court 1)' },
      courtIds: {
        type: 'array',
        items: { type: 'string', minLength: 24, maxLength: 24 },
        description: 'Assigned Court IDs for multi-court batch',
      },
      coachId: { type: 'string', minLength: 24, maxLength: 24, description: 'Coach User ID' },
      name: { type: 'string', minLength: 2, description: 'Batch name (e.g. Badminton Morning Elite)' },
      code: { type: 'string', maxLength: 30, description: 'Unique code (auto-generated if omitted, e.g. BAT-BD-0600)' },
      level: {
        type: 'string',
        enum: ['beginner', 'intermediate', 'advanced', 'all_levels'],
        default: 'all_levels',
      },
      schedule: {
        type: 'object',
        required: ['daysOfWeek', 'startTime', 'endTime'],
        properties: {
          daysOfWeek: {
            type: 'array',
            items: { type: 'integer', minimum: 0, maximum: 6 },
            description: '0=Sun, 1=Mon, ..., 6=Sat',
          },
          startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'HH:mm (e.g. 06:30)' },
          endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'HH:mm (e.g. 08:00)' },
        },
      },
      maxStudents: { type: 'integer', minimum: 1, default: 20 },
      monthlyFee: { type: 'number', minimum: 0, description: 'Monthly fee in INR' },
    },
  },
};

export const enrollStudentSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach] Enroll an existing student into a coaching batch with capacity enforcement',
  tags: ['Coaching & Batches'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['batchId', 'studentId'],
    properties: {
      batchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Batch ID' },
      studentId: { type: 'string', minLength: 24, maxLength: 24, description: 'Student User ID' },
      monthlyFee: { type: 'number', minimum: 0 },
      notes: { type: 'string' },
    },
  },
};

export const registerStudentSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach] Register a new student trainee and enroll them into a coaching cohort',
  tags: ['Coaching & Batches'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['batchId'],
    properties: {
      batchId: { type: 'string', minLength: 24, maxLength: 24 },
      studentId: { type: 'string', minLength: 24, maxLength: 24 },
      firstName: { type: 'string', minLength: 2 },
      lastName: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      employeeNo: { type: 'string', description: 'Biometric terminal employee number (e.g. isabd001)' },
      cardNo: { type: 'string', description: 'RFID / Smartcard number' },
      pin: { type: 'string', description: '6-digit device keypad access PIN' },
      parentName: { type: 'string' },
      parentPhone: { type: 'string' },
      skillLevel: { type: 'string' },
      monthlyFee: { type: 'number', minimum: 0 },
      notes: { type: 'string' },
    },
  },
};

export const markAttendanceSchema = {
  description: '[Roles: tenant_admin, coach] Log or update daily session attendance for students in a batch',
  tags: ['Coaching & Batches'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['batchId', 'date', 'records'],
    properties: {
      batchId: { type: 'string', minLength: 24, maxLength: 24 },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      records: {
        type: 'array',
        items: {
          type: 'object',
          required: ['studentId', 'status'],
          properties: {
            studentId: { type: 'string', minLength: 24, maxLength: 24 },
            status: { type: 'string', enum: ['present', 'absent', 'excused'] },
            remarks: { type: 'string' },
          },
        },
      },
    },
  },
};

export const queryBatchesSchema = {
  description: '[Roles: All] List coaching batches with filtering and pagination',
  tags: ['Coaching & Batches'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      branchId: { type: 'string' },
      sportId: { type: 'string' },
      coachId: { type: 'string' },
      status: { type: 'string', enum: ['active', 'paused', 'completed', 'cancelled'] },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

export const batchParamSchema = {
  description: '[Roles: All] Batch ID parameter',
  tags: ['Coaching & Batches'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
};

export const updateBatchSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach] Update a coaching batch details',
  tags: ['Coaching & Batches'],
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
      resourceId: { type: 'string', minLength: 24, maxLength: 24 },
      courtId: { type: 'string', minLength: 24, maxLength: 24 },
      courtIds: {
        type: 'array',
        items: { type: 'string', minLength: 24, maxLength: 24 },
      },
      coachId: { type: 'string', minLength: 24, maxLength: 24 },
      level: {
        type: 'string',
        enum: ['beginner', 'intermediate', 'advanced', 'all_levels'],
      },
      schedule: {
        type: 'object',
        properties: {
          daysOfWeek: {
            type: 'array',
            items: { type: 'integer', minimum: 0, maximum: 6 },
          },
          startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
        },
      },
      maxStudents: { type: 'integer', minimum: 1 },
      monthlyFee: { type: 'number', minimum: 0 },
      status: { type: 'string', enum: ['active', 'paused', 'completed', 'cancelled'] },
    },
  },
};

export const automatedAttendanceStatusSchema = {
  description: '[Roles: tenant_admin, coach] Get real-time status of automated biometric ACS terminal attendance sync',
  tags: ['Coaching & Batches'],
  security: [{ bearerAuth: [] }],
};

export const automatedAttendanceLogsSchema = {
  description: '[Roles: tenant_admin, coach] Get biometric punch logs from Hikvision ACS edge terminals',
  tags: ['Coaching & Batches'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'integer', default: 50 },
    },
  },
};


