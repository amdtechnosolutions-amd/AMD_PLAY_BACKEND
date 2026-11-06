import { announcementController } from './announcement.controller.js';
import { createAnnouncementSchema } from './announcement.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function announcementRoutes(fastify) {
  fastify.get('/announcements', {
    schema: {
      description: 'List active academy announcements',
      tags: ['Announcements'],
    },
    preHandler: [fastify.authenticateOptional, requireTenantContext],
    handler: announcementController.list.bind(announcementController),
  });

  fastify.get('/announcements/:id', {
    schema: {
      description: 'Get announcement details by ID',
      tags: ['Announcements'],
    },
    preHandler: [fastify.authenticateOptional, requireTenantContext],
    handler: announcementController.getById.bind(announcementController),
  });

  fastify.post('/announcements', {
    schema: createAnnouncementSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: announcementController.create.bind(announcementController),
  });

  fastify.delete('/announcements/:id', {
    schema: {
      description: 'Delete an announcement by ID',
      tags: ['Announcements'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: announcementController.delete.bind(announcementController),
  });
}
