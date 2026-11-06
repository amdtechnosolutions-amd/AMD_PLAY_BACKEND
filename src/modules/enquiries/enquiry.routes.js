import { enquiryController } from './enquiry.controller.js';
import { createEnquirySchema, updateEnquirySchema } from './enquiry.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function enquiryRoutes(fastify) {
  fastify.get('/enquiries', {
    schema: {
      description: 'List all CRM leads and enquiries',
      tags: ['CRM Enquiries & Leads'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: enquiryController.list.bind(enquiryController),
  });

  fastify.get('/enquiries/:id', {
    schema: {
      description: 'Get enquiry details by ID',
      tags: ['CRM Enquiries & Leads'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: enquiryController.getById.bind(enquiryController),
  });

  fastify.post('/enquiries', {
    schema: createEnquirySchema,
    preHandler: [fastify.authenticateOptional, requireTenantContext],
    handler: enquiryController.create.bind(enquiryController),
  });

  fastify.patch('/enquiries/:id', {
    schema: updateEnquirySchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: enquiryController.update.bind(enquiryController),
  });

  fastify.post('/enquiries/:id/notes', {
    schema: {
      description: 'Add an internal follow-up note to an enquiry',
      tags: ['CRM Enquiries & Leads'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: enquiryController.addNote.bind(enquiryController),
  });

  fastify.delete('/enquiries/:id', {
    schema: {
      description: 'Delete an enquiry by ID',
      tags: ['CRM Enquiries & Leads'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: enquiryController.delete.bind(enquiryController),
  });
}
