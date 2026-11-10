export const createEvaluationSchema = {
  description: '[Roles: coach, tenant_admin, branch_manager] Submit player feedback and performance assessment ratings',
  tags: ['Coaching & Evaluations'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    properties: {
      studentId: { type: 'string', description: 'Student User ID' },
      coachId: { type: ['string', 'null'], nullable: true, description: 'Optional Coach ID (defaults to authenticated coach)' },
      batchId: { type: ['string', 'null'], nullable: true, description: 'Optional Batch ID' },
      branchId: { type: ['string', 'null'], nullable: true },
      sportId: { type: ['string', 'null'], nullable: true },
      academyName: { type: 'string', default: 'GIRISH BADMINTON ACADEMY' },
      title: { type: 'string', default: 'Coach Performance Assessment & Feedback' },
      period: { type: ['string', 'null'], nullable: true, description: 'Evaluation cycle / term (e.g. November 2026)' },
      evaluationDate: { type: ['string', 'number', 'null'], nullable: true },
      ratings: {
        type: ['object', 'number', 'string'],
        additionalProperties: true,
      },
      // Category level scores (direct or nested)
      physical: { type: ['number', 'object'] },
      mental: { type: ['number', 'object'] },
      skill: { type: ['number', 'object'] },
      attitude: { type: ['number', 'object'] },
      physicalScore: { type: 'number' },
      mentalScore: { type: 'number' },
      skillScore: { type: 'number' },
      attitudeScore: { type: 'number' },
      physicalCondition: { type: 'number' },
      mentalFocus: { type: 'number' },
      technicalSkill: { type: 'number' },
      physicalConditionAndStamina: { type: 'number' },
      mentalFocusAndResilience: { type: 'number' },
      technicalSkillAndExecution: { type: 'number' },
      attitudeAndDiscipline: { type: 'number' },
      strengths: { type: ['array', 'string', 'null'], nullable: true },
      areasForImprovement: { type: ['array', 'string', 'null'], nullable: true },
      coachRemarks: { type: ['string', 'null'], nullable: true, description: 'Overall coach feedback / comments' },
      feedback: { type: ['string', 'null'], nullable: true, description: 'Alias for coachRemarks' },
      remarks: { type: ['string', 'null'], nullable: true },
      status: { type: 'string', enum: ['published', 'draft', 'archived'], default: 'published' },
    },
    additionalProperties: true,
  },
};

export const updateEvaluationSchema = {
  description: '[Roles: coach, tenant_admin] Update existing student feedback / ratings',
  tags: ['Coaching & Evaluations'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      ...createEvaluationSchema.body.properties,
    },
    additionalProperties: true,
  },
};

export const evaluationParamSchema = {
  description: 'Evaluation ID Parameter',
  tags: ['Coaching & Evaluations'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
};

export const queryEvaluationsSchema = {
  description: '[Roles: coach, tenant_admin, branch_manager] List submitted evaluations with filters',
  tags: ['Coaching & Evaluations'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      studentId: { type: 'string' },
      coachId: { type: 'string' },
      batchId: { type: 'string' },
      branchId: { type: 'string' },
      status: { type: 'string' },
      dateFrom: { type: ['string', 'null'] },
      dateTo: { type: ['string', 'null'] },
      page: { type: ['integer', 'string'], default: 1 },
      limit: { type: ['integer', 'string'], default: 20 },
    },
    additionalProperties: true,
  },
};

