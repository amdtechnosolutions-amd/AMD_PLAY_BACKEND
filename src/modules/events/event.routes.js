import { eventController } from './event.controller.js';
import { createEventSchema, registerEventSchema } from './event.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function eventRoutes(fastify) {
  fastify.get('/events', {
    schema: {
      description: 'List active and upcoming events / tournaments',
      tags: ['Events & Tournaments'],
    },
    preHandler: [fastify.authenticateOptional, requireTenantContext],
    handler: eventController.listEvents.bind(eventController),
  });

  fastify.get('/events/:id', {
    preHandler: [fastify.authenticateOptional, requireTenantContext],
    handler: eventController.getById.bind(eventController),
  });

  fastify.post('/events', {
    schema: createEventSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: eventController.create.bind(eventController),
  });

  fastify.post('/events/:eventId/register', {
    schema: registerEventSchema,
    preHandler: [fastify.authenticateOptional, requireTenantContext],
    handler: eventController.register.bind(eventController),
  });

  fastify.get('/events/:eventId/registrations', {
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: eventController.getRegistrations.bind(eventController),
  });
}
