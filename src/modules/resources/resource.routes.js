import { resourceController } from './resource.controller.js';
import {
  createResourceSchema,
  updateResourceSchema,
  setMaintenanceSchema,
  resourceParamSchema,
} from './resource.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';
import { requirePermissions } from '../../middleware/permission.middleware.js';
import { PERMISSIONS } from '../../config/constants.js';

export default async function resourceRoutes(fastify) {
  fastify.post('/resources', {
    schema: createResourceSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_CREATE),
    ],
    handler: resourceController.create.bind(resourceController),
  });

  fastify.get('/resources', {
    schema: {
      description: 'List courts and resources for authenticated tenant',
      tags: ['Sports & Resources Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_VIEW),
    ],
    handler: resourceController.list.bind(resourceController),
  });

  fastify.get('/resources/active', {
    schema: {
      description: 'List active courts and resources for booking discovery',
      tags: ['Sports & Resources Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticateOptional],
    handler: resourceController.listActive.bind(resourceController),
  });

  fastify.get('/resources/:id', {
    schema: resourceParamSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_VIEW),
    ],
    handler: resourceController.getById.bind(resourceController),
  });

  fastify.patch('/resources/:id', {
    schema: updateResourceSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_EDIT),
    ],
    handler: resourceController.update.bind(resourceController),
  });

  fastify.put('/resources/:id', {
    schema: updateResourceSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_EDIT),
    ],
    handler: resourceController.update.bind(resourceController),
  });

  fastify.post('/resources/:id/maintenance', {
    schema: setMaintenanceSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_EDIT),
    ],
    handler: resourceController.setMaintenance.bind(resourceController),
  });

  fastify.delete('/resources/:id', {
    schema: resourceParamSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_EDIT),
    ],
    handler: resourceController.delete.bind(resourceController),
  });

  // =========================================================================
  // Court API Aliases (/courts -> identical to /resources)
  // =========================================================================
  fastify.post('/courts', {
    schema: createResourceSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_CREATE),
    ],
    handler: resourceController.create.bind(resourceController),
  });

  fastify.get('/courts', {
    schema: {
      description: 'List courts for authenticated tenant (alias to /resources)',
      tags: ['Sports & Resources Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_VIEW),
    ],
    handler: resourceController.list.bind(resourceController),
  });

  fastify.get('/courts/active', {
    schema: {
      description: 'List active courts for booking discovery (alias to /resources/active)',
      tags: ['Sports & Resources Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticateOptional],
    handler: resourceController.listActive.bind(resourceController),
  });

  fastify.get('/courts/:id', {
    schema: resourceParamSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_VIEW),
    ],
    handler: resourceController.getById.bind(resourceController),
  });

  fastify.patch('/courts/:id', {
    schema: updateResourceSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_EDIT),
    ],
    handler: resourceController.update.bind(resourceController),
  });

  fastify.put('/courts/:id', {
    schema: updateResourceSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_EDIT),
    ],
    handler: resourceController.update.bind(resourceController),
  });

  fastify.post('/courts/:id/maintenance', {
    schema: setMaintenanceSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_EDIT),
    ],
    handler: resourceController.setMaintenance.bind(resourceController),
  });

  fastify.delete('/courts/:id', {
    schema: resourceParamSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.RESOURCE_EDIT),
    ],
    handler: resourceController.delete.bind(resourceController),
  });
}
