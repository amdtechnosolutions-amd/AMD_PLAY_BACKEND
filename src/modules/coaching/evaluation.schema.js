export const createEvaluationSchema = {
  description: '[Roles: coach, tenant_admin, branch_manager] Submit player feedback and performance assessment ratings',
  tags: ['Coaching & Evaluations'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    properties: {
      studentId: { type: 'string', minLength: 24, maxLength: 24, description: 'Student User ID' },
      coachId: { type: 'string', minLength: 24, maxLength: 24, description: 'Optional Coach ID (defaults to authenticated coach)' },
      batchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Optional Batch ID' },
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
      sportId: { type: 'string', minLength: 24, maxLength: 24 },
      academyName: { type: 'string', default: 'GIRISH BADMINTON ACADEMY' },
      title: { type: 'string', default: 'Coach Performance Assessment & Feedback' },
      period: { type: 'string', description: 'Evaluation cycle / term (e.g. November 2026)' },
      evaluationDate: { type: 'string', format: 'date-time' },
      ratings: {
        type: 'object',
        properties: {
          physical: {
            type: 'object',
            properties: {
              agility: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              speed: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              stamina: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              strength: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              flexibility: { type: 'number', minimum: 0, maximum: 10, default: 10 },
            },
          },
          mental: {
            type: 'object',
            properties: {
              focus: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              confidence: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              composure: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              resilience: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              sportsmanship: { type: 'number', minimum: 0, maximum: 10, default: 10 },
            },
          },
          skill: {
            type: 'object',
            properties: {
              forehandStrokes: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              backhandStrokes: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              serve: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              smash: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              dropShots: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              footwork: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              netPlay: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              defensiveSkills: { type: 'number', minimum: 0, maximum: 10, default: 10 },
            },
          },
          attitude: {
            type: 'object',
            properties: {
              punctuality: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              effort: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              teamwork: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              coachability: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              discipline: { type: 'number', minimum: 0, maximum: 10, default: 10 },
              positiveAttitude: { type: 'number', minimum: 0, maximum: 10, default: 10 },
            },
          },
        },
      },
      strengths: { type: 'array', items: { type: 'string' } },
      areasForImprovement: { type: 'array', items: { type: 'string' } },
      coachRemarks: { type: 'string', description: 'Overall coach feedback / comments' },
      feedback: { type: 'string', description: 'Alias for coachRemarks' },
      status: { type: 'string', enum: ['published', 'draft', 'archived'], default: 'published' },
    },
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
      id: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
  body: createEvaluationSchema.body,
};

export const evaluationParamSchema = {
  description: 'Evaluation ID Parameter',
  tags: ['Coaching & Evaluations'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24 },
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
      studentId: { type: 'string', minLength: 24, maxLength: 24 },
      coachId: { type: 'string', minLength: 24, maxLength: 24 },
      batchId: { type: 'string', minLength: 24, maxLength: 24 },
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
      status: { type: 'string', enum: ['published', 'draft', 'archived'] },
      dateFrom: { type: 'string', format: 'date' },
      dateTo: { type: 'string', format: 'date' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};
