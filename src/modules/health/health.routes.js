import { healthController } from './health.controller.js';

export default async function healthRoutes(fastify) {
  fastify.get('/health', {
    schema: {
      description: 'Overall system health check',
      tags: ['SuperAdmin Management', 'Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    handler: healthController.getOverallHealth.bind(healthController),
  });

  fastify.get('/health/database', {
    schema: {
      description: 'MongoDB database connection status',
      tags: ['SuperAdmin Management', 'Health'],
    },
    handler: healthController.getDatabaseHealth.bind(healthController),
  });

  fastify.get('/health/redis', {
    schema: {
      description: 'Redis cache & lock status',
      tags: ['SuperAdmin Management', 'Health'],
    },
    handler: healthController.getRedisHealth.bind(healthController),
  });

  fastify.get('/health/mqtt', {
    schema: {
      description: 'MQTT IoT broker connection status',
      tags: ['SuperAdmin Management', 'Health'],
    },
    handler: healthController.getMqttHealth.bind(healthController),
  });
}
