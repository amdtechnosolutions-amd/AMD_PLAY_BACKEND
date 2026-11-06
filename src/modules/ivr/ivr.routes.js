import { ivrController } from './ivr.controller.js';

export default async function ivrRoutes(fastify) {
  // Public webhook for IVR telephony providers (Twilio, Exotel, custom PBX)
  fastify.post('/ivr/webhook', {
    schema: {
      description: 'Ingest inbound IVR telephony webhook events',
      tags: ['IVR Telephony'],
    },
    handler: ivrController.handleWebhook.bind(ivrController),
  });

  // Admin logs
  fastify.get('/ivr/logs', {
    schema: {
      description: 'List inbound IVR call logs',
      tags: ['IVR Telephony'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate],
    handler: ivrController.listLogs.bind(ivrController),
  });
}
