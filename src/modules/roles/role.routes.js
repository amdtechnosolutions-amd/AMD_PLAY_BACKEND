import { roleController } from './role.controller.js';
import { createRoleSchema, updateRoleSchema } from './role.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function roleRoutes(fastify) {
  fastify.get('/roles/permissions', {
    schema: {
      description: 'List all available granular system permissions',
      tags: ['SuperAdmin Management', 'Admin Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate],
    handler: roleController.getPermissions.bind(roleController),
  });

  fastify.get('/roles', {
    schema: {
      description: 'List system and custom roles available to the tenant',
      tags: ['SuperAdmin Management', 'Admin Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: roleController.listRoles.bind(roleController),
  });

  fastify.post('/roles', {
    schema: createRoleSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: roleController.create.bind(roleController),
  });

  fastify.get('/roles/:id', {
    schema: {
      description: 'Get role details by ID',
      tags: ['SuperAdmin Management', 'Admin Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: roleController.getById.bind(roleController),
  });

  fastify.patch('/roles/:id', {
    schema: updateRoleSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: roleController.update.bind(roleController),
  });

  fastify.delete('/roles/:id', {
    schema: {
      description: 'Delete custom role by ID',
      tags: ['SuperAdmin Management', 'Admin Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: roleController.delete.bind(roleController),
  });
}

