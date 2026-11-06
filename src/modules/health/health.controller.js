import { healthService } from './health.service.js';
import { apiSuccess } from '../../utils/response.js';

export class HealthController {
  async getOverallHealth(request, reply) {
    const health = await healthService.getOverallHealth();
    const statusCode = health.success ? 200 : 503;
    return reply.status(statusCode).send(
      apiSuccess({
        message: 'System health check completed',
        data: health,
      })
    );
  }

  async getDatabaseHealth(request, reply) {
    const health = await healthService.getDatabaseHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    return reply.status(statusCode).send(
      apiSuccess({
        message: 'Database health status',
        data: health,
      })
    );
  }

  async getRedisHealth(request, reply) {
    const health = await healthService.getRedisHealth();
    return reply.status(200).send(
      apiSuccess({
        message: 'Redis health status',
        data: health,
      })
    );
  }

  async getMqttHealth(request, reply) {
    const health = await healthService.getMqttHealth();
    return reply.status(200).send(
      apiSuccess({
        message: 'MQTT broker status',
        data: health,
      })
    );
  }
}

export const healthController = new HealthController();
