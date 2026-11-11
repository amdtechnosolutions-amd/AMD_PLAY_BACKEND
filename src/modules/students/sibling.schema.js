export const listSiblingGroupsSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach, staff] List all sibling families enrolled in the academy',
  tags: ['Students Management', 'Sibling Profiles'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Search by student name, phone, or regNo' },
      q: { type: 'string' },
      branchId: { type: 'string' },
      page: { type: ['integer', 'string'], default: 1 },
      limit: { type: ['integer', 'string'], default: 20 },
    },
    additionalProperties: true,
  },
};

export const studentSiblingsParamSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach, student] Get full sibling records for a specific student',
  tags: ['Students Management', 'Sibling Profiles'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'Student User ID' },
    },
  },
};

export const linkSiblingsSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach] Link existing students as siblings manually using Master Student ID and New Student ID',
  tags: ['Students Management', 'Sibling Profiles'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    properties: {
      masterStudentId: { type: 'string', description: 'Master / Primary Student User ID' },
      newStudentId: { type: 'string', description: 'New / Sibling Student User ID to link with master student' },
      studentId: { type: 'string', description: 'Alias for masterStudentId' },
      siblingStudentId: { type: 'string', description: 'Alias for newStudentId' },
      studentIds: { type: 'array', items: { type: 'string' }, description: 'Optional array of student IDs to link into the family group' },
    },
    additionalProperties: true,
  },
};

export const assignSiblingPhoneSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach] Assign or update a different mobile number for a sibling student while keeping them in the family sibling group',
  tags: ['Students Management', 'Sibling Profiles'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'Student User ID whose mobile number is being assigned or updated' },
    },
  },
  body: {
    type: 'object',
    required: ['phone'],
    properties: {
      phone: { type: 'string', description: 'New mobile number to assign to this sibling student' },
      parentPhone: { type: 'string', description: 'Optional primary family/parent phone to preserve in family link' },
      parentName: { type: 'string', description: 'Optional parent/guardian name' },
    },
    additionalProperties: true,
  },
};

