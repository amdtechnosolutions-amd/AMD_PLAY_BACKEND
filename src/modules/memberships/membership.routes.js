import { membershipController } from './membership.controller.js';
import {
  createPlanSchema,
  updatePlanSchema,
  subscribeUserSchema,
  registerMemberSchema,
  queryPlansSchema,
  planParamSchema,
  createMembershipRazorpayOrderSchema,
  verifyMembershipRazorpayPaymentSchema,
  assignSubscriptionTimeSlotSchema,
} from './membership.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function membershipRoutes(fastify) {
  fastify.post('/memberships/plans', {
    schema: createPlanSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.createPlan.bind(membershipController),
  });

  fastify.get('/memberships/plans', {
    schema: queryPlansSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.list.bind(membershipController),
  });

  fastify.get('/memberships/plans/active', {
    schema: {
      description: '[Roles: All] List active membership plans available for mobile user subscription',
      tags: ['Members Management & Subscriptions'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.listActivePlans.bind(membershipController),
  });

  fastify.get('/memberships/plans/:id', {
    schema: planParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.getById.bind(membershipController),
  });

  fastify.patch('/memberships/plans/:id', {
    schema: updatePlanSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.update.bind(membershipController),
  });

  fastify.delete('/memberships/plans/:id', {
    schema: planParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.delete.bind(membershipController),
  });

  fastify.post('/memberships/razorpay/order', {
    schema: createMembershipRazorpayOrderSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.createRazorpayOrder.bind(membershipController),
  });

  fastify.post('/memberships/razorpay/verify', {
    schema: verifyMembershipRazorpayPaymentSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.verifyRazorpayPayment.bind(membershipController),
  });

  fastify.post('/memberships/subscribe', {
    schema: subscribeUserSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.subscribeUser.bind(membershipController),
  });

  fastify.post('/memberships/register-member', {
    schema: registerMemberSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.registerMember.bind(membershipController),
  });

  // Alias hidden in Swagger to avoid duplicates
  fastify.post('/memberships/members/register', {
    schema: { hide: true },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.registerMember.bind(membershipController),
  });

  fastify.get('/memberships/my', {
    schema: {
      description: '[Roles: member, customer] Retrieve current logged-in member active cards, plans, and validity',
      tags: ['Members Management & Subscriptions'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.getMySubscriptions.bind(membershipController),
  });

  fastify.get('/memberships/subscriptions', {
    schema: {
      description: '[Roles: tenant_admin, branch_manager] Retrieve all member subscriptions across academy',
      tags: ['Members Management & Subscriptions'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.listSubscriptions.bind(membershipController),
  });

  fastify.patch('/memberships/subscriptions/:id/time-slot', {
    schema: assignSubscriptionTimeSlotSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: membershipController.assignSubscriptionTimeSlot.bind(membershipController),
  });
}

