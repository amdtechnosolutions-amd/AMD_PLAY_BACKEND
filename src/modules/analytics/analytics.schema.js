export const analyticsFilterSchema = {
  description: 'Filter analytics and reports by branch and date range',
  tags: ['Analytics & Reporting'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      tenantId: { type: 'string' },
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
      date: { type: 'string', pattern: '^(\\d{4}-\\d{2}-\\d{2}|all|overall)?$' },
      startDate: { type: 'string', pattern: '^(\\d{4}-\\d{2}-\\d{2}|all|overall)?$' },
      endDate: { type: 'string', pattern: '^(\\d{4}-\\d{2}-\\d{2}|all|overall)?$' },
      range: { type: 'string' },
    },
  },
};
