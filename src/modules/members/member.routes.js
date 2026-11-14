import { memberController } from './member.controller.js';
import {
  createMemberSchema,
  queryMembersSchema,
  memberParamSchema,
  updateMemberSchema,
} from './member.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function memberRoutes(fastify) {
  fastify.post('/members', {
    schema: createMemberSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: memberController.createMember.bind(memberController),
  });

  fastify.get('/members', {
    schema: queryMembersSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: memberController.listMembers.bind(memberController),
  });

  fastify.get('/members/:id', {
    schema: memberParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: memberController.getMemberById.bind(memberController),
  });

  fastify.patch('/members/:id', {
    schema: updateMemberSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: memberController.updateMember.bind(memberController),
  });

  fastify.delete('/members/:id', {
    schema: memberParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: memberController.deleteMember.bind(memberController),
  });

  fastify.get('/members/:id/subscriptions', {
    schema: {
      ...memberParamSchema,
      description: '[Roles: tenant_admin, branch_manager, staff] Get all membership subscriptions and history for a member',
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: memberController.getMemberSubscriptions.bind(memberController),
  });

  fastify.post('/members/:id/face', {
    schema: {
      description: '[Roles: tenant_admin, branch_manager, staff, member] Upload member face photo (Base64) and sync directly to biometric access terminal',
      tags: ['Members Management'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 24, maxLength: 24, description: 'Member User ID' },
        },
      },
      body: {
        type: 'object',
        required: ['faceImageBase64'],
        properties: {
          faceImageBase64: { type: 'string', description: 'Base64 encoded JPEG/PNG facial image' },
        },
      },
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: memberController.uploadFace.bind(memberController),
  });
}
