import { branchController } from './branch.controller.js';
import {
  createBranchSchema,
  updateBranchSchema,
  branchParamSchema,
} from './branch.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';
import { requirePermissions } from '../../middleware/permission.middleware.js';
import { PERMISSIONS } from '../../config/constants.js';

export default async function branchRoutes(fastify) {
  fastify.post('/branches', {
    schema: createBranchSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.BRANCH_CREATE),
    ],
    handler: branchController.create.bind(branchController),
  });

  fastify.get('/branches', {
    schema: {
      description: 'List branches under authenticated tenant with pagination',
      tags: ['Branches Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.BRANCH_VIEW),
    ],
    handler: branchController.list.bind(branchController),
  });

  fastify.get('/branches/active', {
    schema: {
      description: 'List active branches for court discovery and booking',
      tags: ['Branches Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: branchController.listActive.bind(branchController),
  });

  fastify.get('/branches/:id', {
    schema: branchParamSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.BRANCH_VIEW),
    ],
    handler: branchController.getById.bind(branchController),
  });

  fastify.patch('/branches/:id', {
    schema: updateBranchSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.BRANCH_CREATE),
    ],
    handler: branchController.update.bind(branchController),
  });

  fastify.delete('/branches/:id', {
    schema: branchParamSchema,
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.BRANCH_CREATE),
    ],
    handler: branchController.delete.bind(branchController),
  });
}
