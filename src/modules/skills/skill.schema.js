export const createSkillSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach, super_admin] Create a new dynamic coaching skill level or trainee progression stage',
  tags: ['Skills & Levels Management'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        description: 'Skill or level name (e.g. "Beginner", "Intermediate", "Advanced", "Level 1 - Foundation")',
      },
      code: {
        type: 'string',
        description: 'Unique slug code (e.g. "beginner", "intermediate", "advanced", "elite"). Auto-generated if omitted.',
      },
      level: {
        type: 'number',
        minimum: 1,
        default: 1,
        description: 'Numerical progression rank order (1, 2, 3, 4...)',
      },
      sportId: {
        type: 'string',
        description: 'Sport ID (optional, links this skill level to a specific sport like Badminton)',
      },
      branchId: {
        type: 'string',
        description: 'Branch ID (optional, limits skill level to a specific facility)',
      },
      category: {
        type: 'string',
        enum: ['level', 'technique', 'fitness', 'tactical', 'general'],
        default: 'level',
        description: 'Skill classification category',
      },
      description: {
        type: 'string',
        description: 'Detailed description of coaching expectations and training goals',
      },
      criteria: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of benchmark criteria required to pass/certify this level',
      },
      color: {
        type: 'string',
        default: '#3B82F6',
        description: 'Hex color code for UI badges (e.g. #10B981, #3B82F6, #F59E0B, #EF4444)',
      },
      order: {
        type: 'number',
        default: 0,
        description: 'Display ordering priority in dropdown menus',
      },
      active: {
        type: 'boolean',
        default: true,
        description: 'Active status of the skill level',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            code: { type: 'string' },
            level: { type: 'number' },
            sportId: { type: 'string' },
            category: { type: 'string' },
            description: { type: 'string' },
            criteria: { type: 'array', items: { type: 'string' } },
            color: { type: 'string' },
            order: { type: 'number' },
            active: { type: 'boolean' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
          },
        },
      },
    },
  },
};

export const querySkillsSchema = {
  description: 'List all dynamic coaching skill levels and criteria with optional sport, branch & status filters',
  tags: ['Skills & Levels Management'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      sportId: {
        type: 'string',
        description: 'Filter skill levels applicable to a specific sport ID (e.g. 6ad6bdead33a91a36c41ff5b)',
      },
      branchId: {
        type: 'string',
        description: 'Filter skill levels applicable to a specific branch ID',
      },
      category: {
        type: 'string',
        enum: ['level', 'technique', 'fitness', 'tactical', 'general'],
        description: 'Filter by skill classification category',
      },
      active: {
        type: 'boolean',
        description: 'Filter by active status (true/false)',
      },
      search: {
        type: 'string',
        description: 'Search by skill name, code, or description keyword',
      },
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 50,
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              name: { type: 'string' },
              code: { type: 'string' },
              level: { type: 'number' },
              sportId: {
                anyOf: [
                  { type: 'string' },
                  {
                    type: 'object',
                    properties: {
                      _id: { type: 'string' },
                      name: { type: 'string' },
                      slug: { type: 'string' },
                      type: { type: 'string' },
                    },
                  },
                  { type: 'null' },
                ],
              },
              branchId: {
                anyOf: [
                  { type: 'string' },
                  {
                    type: 'object',
                    properties: {
                      _id: { type: 'string' },
                      name: { type: 'string' },
                      code: { type: 'string' },
                    },
                  },
                  { type: 'null' },
                ],
              },
              category: { type: 'string' },
              description: { type: 'string' },
              criteria: { type: 'array', items: { type: 'string' } },
              color: { type: 'string' },
              order: { type: 'number' },
              active: { type: 'boolean' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
  },
};

export const skillParamSchema = {
  description: 'Get coaching skill level details and benchmarks by ID',
  tags: ['Skills & Levels Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'Skill Level MongoDB ObjectId' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            code: { type: 'string' },
            level: { type: 'number' },
            sportId: {
              anyOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: {
                    _id: { type: 'string' },
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    type: { type: 'string' },
                  },
                },
                { type: 'null' },
              ],
            },
            branchId: {
              anyOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: {
                    _id: { type: 'string' },
                    name: { type: 'string' },
                    code: { type: 'string' },
                  },
                },
                { type: 'null' },
              ],
            },
            category: { type: 'string' },
            description: { type: 'string' },
            criteria: { type: 'array', items: { type: 'string' } },
            color: { type: 'string' },
            order: { type: 'number' },
            active: { type: 'boolean' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
          },
        },
      },
    },
  },
};

export const updateSkillSchema = {
  description: '[Roles: tenant_admin, branch_manager, coach, super_admin] Update an existing coaching skill level or criteria',
  tags: ['Skills & Levels Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'Skill Level MongoDB ObjectId' },
    },
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2 },
      code: { type: 'string' },
      level: { type: 'number', minimum: 1 },
      sportId: { type: 'string' },
      branchId: { type: 'string' },
      category: {
        type: 'string',
        enum: ['level', 'technique', 'fitness', 'tactical', 'general'],
      },
      description: { type: 'string' },
      criteria: { type: 'array', items: { type: 'string' } },
      color: { type: 'string' },
      order: { type: 'number' },
      active: { type: 'boolean' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            code: { type: 'string' },
            level: { type: 'number' },
            sportId: { type: 'string' },
            category: { type: 'string' },
            description: { type: 'string' },
            criteria: { type: 'array', items: { type: 'string' } },
            color: { type: 'string' },
            order: { type: 'number' },
            active: { type: 'boolean' },
            updatedAt: { type: 'string' },
          },
        },
      },
    },
  },
};

export const deleteSkillSchema = {
  description: '[Roles: tenant_admin, branch_manager, super_admin] Delete a coaching skill level',
  tags: ['Skills & Levels Management'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'Skill Level MongoDB ObjectId' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
};
