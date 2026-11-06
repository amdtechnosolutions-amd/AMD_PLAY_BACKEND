import { settingsController } from './settings.controller.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function settingsRoutes(fastify) {
  fastify.get('/settings', {
    schema: {
      description: 'Get academy configuration and integration settings',
      tags: ['Admin Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: settingsController.getSettings.bind(settingsController),
  });

  fastify.patch('/settings', {
    schema: {
      description: 'Update academy settings (WhatsApp, Razorpay, Branding)',
      tags: ['Admin Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: settingsController.updateSettings.bind(settingsController),
  });

  fastify.post('/settings/whatsapp/test', {
    schema: {
      description: 'Send a test WhatsApp notification message',
      tags: ['Admin Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: settingsController.testWhatsApp.bind(settingsController),
  });

  fastify.get('/settings/whatsapp/templates', {
    schema: {
      description: 'List available WhatsApp message templates',
      tags: ['Admin Management'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: settingsController.getWhatsAppTemplates.bind(settingsController),
  });

  fastify.post('/settings/payment-gateways/test', {
    schema: {
      description: 'Test payment gateway connectivity (Razorpay / Stripe) for the academy',
      tags: ['Admin Management', 'Finance & Monthly Fees'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          gateway: { type: 'string', enum: ['razorpay', 'stripe', 'phonepe', 'customUpi'], default: 'razorpay' },
          credentials: {
            type: 'object',
            properties: {
              keyId: { type: 'string' },
              keySecret: { type: 'string' },
              secretKey: { type: 'string' },
            },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: settingsController.testPaymentGateway.bind(settingsController),
  });
}
