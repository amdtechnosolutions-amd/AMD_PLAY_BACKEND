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

  // Self face photo upload for currently authenticated user (Student / Member / Coach)
  fastify.post('/users/me/face', {
    schema: {
      tags: ['Users & Profile'],
      description: '[All Authenticated Users] Upload personal face photo (Base64) and sync directly to academy biometric access terminals',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['faceImageBase64'],
        properties: {
          faceImageBase64: { type: 'string', description: 'Base64 encoded JPEG/PNG facial image' },
        },
      },
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: async (request, reply) => {
      const { faceUploadService } = await import('./face-upload.service.js');
      const userId = request.user?.id || request.user?.sub;
      const result = await faceUploadService.uploadAndSyncFace(userId, request.body, {
        tenantId: request.tenantId || request.user?.tenantId,
        user: request.user,
      });
      return reply.status(200).send({
        success: true,
        message: 'Personal face photo uploaded and synced to biometric terminals successfully',
        data: result,
      });
    },
  });

  // Face photo upload by User ID
  fastify.post('/users/:id/face', {
    schema: {
      tags: ['Users & Profile'],
      description: '[Roles: tenant_admin, branch_manager, staff, coach] Upload user face photo (Base64) and sync directly to biometric access terminals',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 24, maxLength: 24, description: 'User ID' },
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
    handler: async (request, reply) => {
      const { faceUploadService } = await import('./face-upload.service.js');
      const result = await faceUploadService.uploadAndSyncFace(request.params.id, request.body, {
        tenantId: request.tenantId || request.user?.tenantId,
        user: request.user,
      });
      return reply.status(200).send({
        success: true,
        message: 'User face photo uploaded and synced to biometric terminals successfully',
        data: result,
      });
    },
  });

  // Direct streaming of uploaded avatars
  fastify.get('/uploads/avatars/:filename', {
    schema: {
      tags: ['Users & Profile'],
      description: 'Stream uploaded user avatar/face image file directly from disk',
      params: {
        type: 'object',
        required: ['filename'],
        properties: {
          filename: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const filename = path.basename(request.params.filename);
      const filePath = path.join(process.cwd(), 'uploads', 'avatars', filename);
      if (!fs.existsSync(filePath)) {
        return reply.code(404).send({ success: false, message: 'Avatar image not found' });
      }
      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
      const stream = fs.createReadStream(filePath);
      return reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=604800, must-revalidate')
        .send(stream);
    },
  });
}
