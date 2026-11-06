export const STAFF_ROLES = [
  'coach',
  'trainer',
  'receptionist',
  'front_desk',
  'accountant',
  'manager',
  'branch_admin',
  'staff',
  'maintenance',
  'security',
];

// =========================================================================
// DEPARTMENTS SCHEMAS
// =========================================================================

export const createDepartmentSchema = {
  description: '[Roles: tenant_admin, branch_manager] Create a new dynamic department',
  tags: ['Staff & HR Management', 'Departments & Designations'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2, description: 'Department name (e.g. Coaching & Academy)' },
      code: { type: 'string', description: 'Department code (auto-generated from name if omitted, e.g. COACHING)' },
      branchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Optional Branch ID' },
      description: { type: 'string' },
      order: { type: 'integer', default: 0 },
      status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
    },
  },
};

export const queryDepartmentsSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff] List departments with search, branch filter, and staff counts',
  tags: ['Staff & HR Management', 'Departments & Designations'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Search by department name or code' },
      branchId: { type: 'string', description: 'Filter by Branch ID' },
      status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    },
  },
};

export const departmentParamSchema = {
  description: 'Department ID parameter',
  tags: ['Staff & HR Management', 'Departments & Designations'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Department ID' },
    },
  },
};

export const updateDepartmentSchema = {
  description: '[Roles: tenant_admin, branch_manager] Update department details',
  tags: ['Staff & HR Management', 'Departments & Designations'],
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
      code: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string', enum: ['active', 'inactive'] },
      order: { type: 'integer' },
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
};

// =========================================================================
// DESIGNATIONS SCHEMAS
// =========================================================================

export const createDesignationSchema = {
  description: '[Roles: tenant_admin, branch_manager] Create a new dynamic designation linked to a department',
  tags: ['Staff & HR Management', 'Departments & Designations'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2, description: 'Designation title (e.g. Senior Badminton Coach)' },
      code: { type: 'string', description: 'Designation code (auto-generated if omitted, e.g. SR_BD_COACH)' },
      departmentId: { type: 'string', minLength: 24, maxLength: 24, description: 'Linked Department ID' },
      defaultRole: { type: 'string', enum: STAFF_ROLES, default: 'staff', description: 'Recommended system role' },
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
      description: { type: 'string' },
      order: { type: 'integer', default: 0 },
      status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
    },
  },
};

export const queryDesignationsSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff] List designations with department filtering and search',
  tags: ['Staff & HR Management', 'Departments & Designations'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      departmentId: { type: 'string', description: 'Filter by Department ID' },
      defaultRole: { type: 'string', enum: STAFF_ROLES, description: 'Filter by system role' },
      search: { type: 'string', description: 'Search by designation name or code' },
      status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    },
  },
};

export const designationParamSchema = {
  description: 'Designation ID parameter',
  tags: ['Staff & HR Management', 'Departments & Designations'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Designation ID' },
    },
  },
};

export const updateDesignationSchema = {
  description: '[Roles: tenant_admin, branch_manager] Update designation title, department link, or role',
  tags: ['Staff & HR Management', 'Departments & Designations'],
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
      code: { type: 'string' },
      departmentId: { type: 'string', minLength: 24, maxLength: 24 },
      defaultRole: { type: 'string', enum: STAFF_ROLES },
      description: { type: 'string' },
      status: { type: 'string', enum: ['active', 'inactive'] },
      order: { type: 'integer' },
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
};

// =========================================================================
// STAFF SCHEMAS (UPDATED WITH DYNAMIC DEPARTMENT & DESIGNATION IDS)
// =========================================================================

export const createStaffSchema = {
  description: '[Roles: tenant_admin, branch_manager] Register academy staff or coach with dynamic department/designation and biometrics',
  tags: ['Staff & HR Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['firstName', 'phone', 'role'],
    properties: {
      firstName: { type: 'string', minLength: 2, description: 'Staff first name' },
      lastName: { type: 'string', description: 'Staff last name' },
      phone: { type: 'string', minLength: 10, description: 'Mobile number' },
      email: { type: 'string', format: 'email', description: 'Email address (auto-generated if omitted)' },
      role: {
        type: 'string',
        enum: STAFF_ROLES,
        description: 'Academy staff role',
      },
      branchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Assigned Branch ID' },
      departmentId: { type: 'string', minLength: 24, maxLength: 24, description: 'Dynamic Department ID' },
      designationId: { type: 'string', minLength: 24, maxLength: 24, description: 'Dynamic Designation ID' },
      department: { type: 'string', description: 'Department name override (auto-filled from departmentId if omitted)' },
      designation: { type: 'string', description: 'Designation name override (auto-filled from designationId if omitted)' },
      employeeNo: { type: 'string', description: 'Employee code (auto-generated if omitted, e.g. isastf001)' },
      pin: { type: 'string', description: 'Keypad access PIN (auto-generated if omitted)' },
      cardNo: { type: 'string', description: 'RFID card number' },
      sportIds: {
        type: 'array',
        items: { type: 'string', minLength: 24, maxLength: 24 },
        description: 'Assigned sport IDs for coaches/trainers',
      },
      salary: { type: 'number', minimum: 0, description: 'Monthly salary / payout' },
      joiningDate: { type: 'string', description: 'Joining date (YYYY-MM-DD)' },
      permissions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Custom permission overrides',
      },
      notes: { type: 'string' },
    },
  },
};

export const queryStaffSchema = {
  description: '[Roles: tenant_admin, branch_manager, staff] List academy staff members with dynamic department/designation filtering',
  tags: ['Staff & HR Management'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Search by name, phone, email, or employeeNo' },
      role: { type: 'string', enum: STAFF_ROLES, description: 'Filter by staff role' },
      branchId: { type: 'string', description: 'Filter by Branch ID' },
      status: { type: 'string', enum: ['active', 'inactive', 'suspended'], default: 'active' },
      departmentId: { type: 'string', description: 'Filter by Dynamic Department ID' },
      designationId: { type: 'string', description: 'Filter by Dynamic Designation ID' },
      department: { type: 'string', description: 'Filter by department name' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

export const staffParamSchema = {
  description: 'Staff ID parameter',
  tags: ['Staff & HR Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Staff User ID' },
    },
  },
};

export const updateStaffSchema = {
  description: '[Roles: tenant_admin, branch_manager] Update staff profile, dynamic department/designation, and biometric credentials',
  tags: ['Staff & HR Management'],
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
      role: { type: 'string', enum: STAFF_ROLES },
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
      departmentId: { type: 'string', minLength: 24, maxLength: 24 },
      designationId: { type: 'string', minLength: 24, maxLength: 24 },
      department: { type: 'string' },
      designation: { type: 'string' },
      status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
      employeeNo: { type: 'string' },
      pin: { type: 'string' },
      cardNo: { type: 'string' },
      salary: { type: 'number', minimum: 0 },
      sportIds: {
        type: 'array',
        items: { type: 'string', minLength: 24, maxLength: 24 },
      },
      permissions: {
        type: 'array',
        items: { type: 'string' },
      },
      notes: { type: 'string' },
    },
  },
};
