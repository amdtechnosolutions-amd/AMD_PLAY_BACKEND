export const createStudentSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach] Register a new Student / Trainee into the academy, enroll in batch, and sync biometrics to sport terminal',
  tags: ['Students Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['firstName', 'phone'],
    properties: {
      branchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Branch ID' },
      batchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Batch ID to enroll student' },
      sportId: { type: 'string', minLength: 24, maxLength: 24, description: 'Sport ID' },
      firstName: { type: 'string', minLength: 2, description: 'Student first name' },
      lastName: { type: 'string', description: 'Student last name' },
      phone: { type: 'string', minLength: 10, maxLength: 15, description: 'Student phone number' },
      email: { type: 'string', format: 'email', description: 'Student email address' },
      dateOfBirth: { type: 'string', description: 'YYYY-MM-DD' },
      gender: { type: 'string', enum: ['Male', 'Female', 'Other'] },
      employeeNo: { type: 'string', description: 'Biometric terminal employee number (Auto-generated like isabd001 if omitted)' },
      cardNo: { type: 'string', description: 'RFID / NFC Smartcard number (Auto-generated if omitted)' },
      pin: { type: 'string', description: '6-digit device keypad access PIN (Auto-generated if omitted)' },
      monthlyFee: { type: 'number', minimum: 0, description: 'Monthly fee amount (Automatically batchwise if omitted)' },
      customDiscount: { type: 'number', minimum: 0, description: 'Monthly fee discount' },
      parentName: { type: 'string', description: 'Parent / Guardian name' },
      parentPhone: { type: 'string', description: 'Parent phone number for attendance WhatsApp notifications' },
      address: { type: 'string' },
      skillLevel: { type: 'string', default: 'beginner', description: 'Dynamic skill level (e.g. beginner, intermediate, advanced, elite, Level 1)' },
      faceImageBase64: { type: 'string', description: 'Optional face photo for biometric terminal sync' },
      notes: { type: 'string' },
    },
  },
};

export const queryStudentsSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach] List all enrolled students with search, batch, sport, and pagination filters',
  tags: ['Students Management'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Search by name, phone, email, employeeNo, cardNo' },
      branchId: { type: 'string', description: 'Filter by Branch ID' },
      batchId: { type: 'string', description: 'Filter by Batch ID' },
      sportId: { type: 'string', description: 'Filter by Sport ID' },
      status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

export const updateStudentSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach] Update student profile, contacts, batch assignment, or status',
  tags: ['Students Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Student User ID' },
    },
  },
  body: {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string', format: 'email' },
      status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
      employeeNo: { type: 'string' },
      cardNo: { type: 'string' },
      pin: { type: 'string', description: '6-digit device keypad access PIN' },
      parentName: { type: 'string' },
      parentPhone: { type: 'string' },
      skillLevel: { type: 'string' },
      batchId: { type: 'string' },
      monthlyFee: { type: 'number' },
      customDiscount: { type: 'number' },
    },
  },
};

export const studentParamSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach, student] Student ID parameter to view profile 360, fees & attendance',
  tags: ['Students Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Student User ID' },
    },
  },
};

export const uploadStudentFaceSchema = {
  description: '[Roles: tenant_admin, coach] Upload student face photo (Base64) and sync directly to sport ISAPI biometric terminal',
  tags: ['Students Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Student User ID' },
    },
  },
  body: {
    type: 'object',
    required: ['faceImageBase64'],
    properties: {
      faceImageBase64: { type: 'string', description: 'Base64 encoded JPEG/PNG facial image' },
    },
  },
};

export const markStudentAttendanceSchema = {
  description: '[Roles: tenant_admin, coach, staff] Mark batch session attendance for students (Mobile App Coach Screen)',
  tags: ['Students Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['batchId', 'date', 'records'],
    properties: {
      batchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Batch ID' },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Session Date (YYYY-MM-DD)' },
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

export const getMyAttendanceSchema = {
  description: '[Roles: student, member, customer] Get personal attendance history and monthly punch logs (Mobile App Student Dashboard)',
  tags: ['Students Management'],
  security: [{ bearerAuth: [] }],
};

export const getMySiblingsSchema = {
  description: '[Roles: student] Retrieve all sibling profiles enrolled under the same family mobile number for easy mobile switching',
  tags: ['Students Management'],
  security: [{ bearerAuth: [] }],
};



