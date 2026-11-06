import { analyticsController } from './analytics.controller.js';
import { analyticsFilterSchema } from './analytics.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function analyticsRoutes(fastify) {
  // Executive Dashboard Summary KPIs
  fastify.get('/analytics/dashboard', {
    schema: analyticsFilterSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: analyticsController.getDashboardSummary.bind(analyticsController),
  });

  // Court Utilization Rates & Peak Hours
  fastify.get('/analytics/court-utilization', {
    schema: analyticsFilterSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: analyticsController.getCourtUtilization.bind(analyticsController),
  });

  // Revenue Analytics & Breakdown by Module & Payment Method
  fastify.get('/analytics/revenue', {
    schema: analyticsFilterSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: analyticsController.getRevenueAnalytics.bind(analyticsController),
  });

  // Coaching Attendance Metrics & Session Completion Rates
  fastify.get('/analytics/attendance', {
    schema: analyticsFilterSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: analyticsController.getAttendanceMetrics.bind(analyticsController),
  });
}
