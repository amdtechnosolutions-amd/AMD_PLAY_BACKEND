import { tenantController } from './tenant.controller.js';
import {
  createTenantSchema,
  updateTenantSchema,
  getTenantSchema,
  lookupTenantBySlugSchema,
  lookupTenantByEmailSchema,
} from './tenant.schema.js';
import { requirePermissions } from '../../middleware/permission.middleware.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';
import { PERMISSIONS } from '../../config/constants.js';

export default async function tenantRoutes(fastify) {
  // Public lookup by email (Discovers tenant slug for login when user forgets/doesn't know slug)
  fastify.get('/academies/lookup-by-email', {
    schema: lookupTenantByEmailSchema,
    handler: tenantController.lookupByEmail.bind(tenantController),
  });
  fastify.get('/tenants/lookup-by-email', {
    schema: { hide: true },
    handler: tenantController.lookupByEmail.bind(tenantController),
  });
  fastify.get('/auth/discover-tenant', {
    schema: lookupTenantByEmailSchema,
    handler: tenantController.lookupByEmail.bind(tenantController),
  });

  // Public lookup for Mobile Apps / Customer web by slug
  fastify.get('/academies/lookup/:slug', {
    schema: lookupTenantBySlugSchema,
    handler: tenantController.lookupBySlug.bind(tenantController),
  });
  fastify.get('/tenants/lookup/:slug', {
    schema: { hide: true },
    handler: tenantController.lookupBySlug.bind(tenantController),
  });

  const sanitizeTenantPayload = async (request) => {
    if (request.body && typeof request.body === 'object') {
      if (typeof request.body.contactEmail === 'string' && request.body.contactEmail.trim() === '') {
        delete request.body.contactEmail;
      }
      if (typeof request.body.slug === 'string' && request.body.slug.trim() === '') {
        delete request.body.slug;
      }
      if (typeof request.body.domain === 'string' && request.body.domain.trim() === '') {
        delete request.body.domain;
      }
      if (typeof request.body.contactPhone === 'string' && request.body.contactPhone.trim() === '') {
        delete request.body.contactPhone;
      }
      if (request.body.adminUser && typeof request.body.adminUser === 'object') {
        if (typeof request.body.adminUser.email === 'string' && request.body.adminUser.email.trim() === '') {
          delete request.body.adminUser.email;
        }
        if (typeof request.body.adminUser.password === 'string' && request.body.adminUser.password.trim() === '') {
          delete request.body.adminUser.password;
        }
        if (!request.body.adminUser.email) {
          delete request.body.adminUser;
        }
      }
    }
  };

  // Authenticated academy management routes (Super Admin only for create/list/delete)
  fastify.post('/academies', {
    schema: {
      ...createTenantSchema,
      description: 'Create and Onboard a new Sports Academy (Super Admin only). Auto-assigns databaseName, tenantId, slug, and MAIN branch with payment gateways.',
    },
    preValidation: [sanitizeTenantPayload],
    preHandler: [fastify.authenticate, requirePermissions(PERMISSIONS.TENANT_CREATE)],
    handler: tenantController.createTenant.bind(tenantController),
  });
  fastify.post('/tenants', {
    schema: { hide: true },
    preValidation: [sanitizeTenantPayload],
    preHandler: [fastify.authenticate, requirePermissions(PERMISSIONS.TENANT_CREATE)],
    handler: tenantController.createTenant.bind(tenantController),
  });

  fastify.get('/academies', {
    schema: {
      description: 'List all onboarded sports academies (Platform Super Admin)',
      tags: ['SuperAdmin Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requirePermissions(PERMISSIONS.TENANT_VIEW)],
    handler: tenantController.list.bind(tenantController),
  });
  fastify.get('/tenants', {
    schema: { hide: true },
    preHandler: [fastify.authenticate, requirePermissions(PERMISSIONS.TENANT_VIEW)],
    handler: tenantController.list.bind(tenantController),
  });

  fastify.get('/academies/:id', {
    schema: {
      ...getTenantSchema,
      description: 'Get sports academy details by ID',
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: tenantController.getById.bind(tenantController),
  });
  fastify.get('/tenants/:id', {
    schema: { hide: true },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: tenantController.getById.bind(tenantController),
  });

  fastify.patch('/academies/:id', {
    schema: {
      ...updateTenantSchema,
      description: 'Update sports academy organization settings and details',
    },
    preValidation: [sanitizeTenantPayload],
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.TENANT_EDIT),
    ],
    handler: tenantController.update.bind(tenantController),
  });
  fastify.patch('/tenants/:id', {
    schema: { hide: true },
    preValidation: [sanitizeTenantPayload],
    preHandler: [
      fastify.authenticate,
      requireTenantContext,
      requirePermissions(PERMISSIONS.TENANT_EDIT),
    ],
    handler: tenantController.update.bind(tenantController),
  });

  fastify.delete('/academies/:id', {
    schema: {
      description: 'Delete / Decommission a sports academy (Platform Super Admin)',
      tags: ['SuperAdmin Management'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
    preHandler: [
      fastify.authenticate,
      requirePermissions(PERMISSIONS.TENANT_EDIT),
    ],
    handler: tenantController.delete.bind(tenantController),
  });
  fastify.delete('/tenants/:id', {
    schema: { hide: true },
    preHandler: [
      fastify.authenticate,
      requirePermissions(PERMISSIONS.TENANT_EDIT),
    ],
    handler: tenantController.delete.bind(tenantController),
  });
}


