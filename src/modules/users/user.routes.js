import { userController } from './user.controller.js';
import {
  createUserSchema,
  updateUserSchema,
  userParamSchema,
} from './user.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function userRoutes(fastify) {
  fastify.post('/users', {
    schema: createUserSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: userController.create.bind(userController),
  });

  fastify.get('/users', {
    schema: {
      description: 'List users under authenticated tenant with pagination and role filtering',
      tags: ['Admin Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: userController.list.bind(userController),
  });

  fastify.get('/users/:id', {
    schema: userParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: userController.getById.bind(userController),
  });

  fastify.patch('/users/:id', {
    schema: updateUserSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: userController.update.bind(userController),
  });

  fastify.delete('/users/:id', {
    schema: userParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: userController.deactivate.bind(userController),
  });

  // Direct user password reset by Admin
  fastify.post('/users/:id/reset-password', {
    schema: {
      tags: ['Admin Management'],
      description: '[Roles: tenant_admin, branch_manager, super_admin] Directly reset a staff or coach password',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 24, maxLength: 24 },
        },
      },
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          newPassword: { type: 'string', minLength: 6 },
        },
      },
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: async (request, reply) => {
      const { AuthService } = await import('../auth/auth.service.js');
      const authService = new AuthService(fastify.jwt.sign.bind(fastify.jwt));
      const result = await authService.adminResetUserPassword(request.params.id, request.body, {
        tenantId: request.tenantId,
        user: request.user,
      });
      return reply.status(200).send({
        success: true,
        message: 'Password reset successfully',
        data: result,
      });
    },
  });
}
