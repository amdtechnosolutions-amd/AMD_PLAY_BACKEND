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
}
