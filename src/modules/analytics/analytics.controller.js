import { BaseController } from '../../core/BaseController.js';
import { analyticsService } from './analytics.service.js';
import { apiSuccess } from '../../utils/response.js';

export class AnalyticsController extends BaseController {
  constructor() {
    super(analyticsService);
  }

  async getDashboardSummary(request, reply) {
    const context = this._extractContext(request);
    const filters = request.query || {};
    const summary = await analyticsService.getDashboardSummary(filters, context);

    reply.header('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
    return reply.status(200).send(
      apiSuccess({
        message: 'Dashboard summary retrieved successfully',
        data: summary,
      })
    );
  }

  async getCourtUtilization(request, reply) {
    const context = this._extractContext(request);
    const filters = request.query || {};
    const utilization = await analyticsService.getCourtUtilization(filters, context);

    reply.header('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
    return reply.status(200).send(
      apiSuccess({
        message: 'Court utilization metrics retrieved successfully',
        data: utilization,
      })
    );
  }

  async getRevenueAnalytics(request, reply) {
    const context = this._extractContext(request);
    const filters = request.query || {};
    const revenue = await analyticsService.getRevenueAnalytics(filters, context);

    reply.header('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
    return reply.status(200).send(
      apiSuccess({
        message: 'Revenue analytics retrieved successfully',
        data: revenue,
      })
    );
  }

  async getAttendanceMetrics(request, reply) {
    const context = this._extractContext(request);
    const filters = request.query || {};
    const attendance = await analyticsService.getAttendanceMetrics(filters, context);

    reply.header('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
    return reply.status(200).send(
      apiSuccess({
        message: 'Attendance metrics retrieved successfully',
        data: attendance,
      })
    );
  }
}

export const analyticsController = new AnalyticsController();
