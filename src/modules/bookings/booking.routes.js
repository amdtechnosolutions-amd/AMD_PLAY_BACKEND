import { bookingController } from './booking.controller.js';
import {
  createBookingSchema,
  createRazorpayBookingOrderSchema,
  verifyRazorpayBookingPaymentSchema,
  queryBookingsSchema,
  getMyBookingsSchema,
  cancelBookingSchema,
  bookingParamSchema,
  groupParamSchema,
} from './booking.schema.js';
import { requireTenantContext, attachTenantContext } from '../../middleware/tenant.middleware.js';

export default async function bookingRoutes(fastify) {
  fastify.post('/bookings', {
    schema: createBookingSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingController.create.bind(bookingController),
  });

  // Explicit Multi-Slot Booking Endpoint
  fastify.post('/bookings/multi', {
    schema: createBookingSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingController.create.bind(bookingController),
  });

  // Razorpay Gateway Order Initialization for Court Bookings (Single or Multi-Slot)
  fastify.post('/bookings/razorpay/order', {
    schema: createRazorpayBookingOrderSchema,
    preHandler: [fastify.authenticateOptional, attachTenantContext],
    handler: bookingController.createRazorpayOrder.bind(bookingController),
  });

  // Razorpay Gateway Payment Verification & Booking Confirmation (Single or Multi-Slot)
  fastify.post('/bookings/razorpay/verify', {
    schema: verifyRazorpayBookingPaymentSchema,
    preHandler: [fastify.authenticateOptional, attachTenantContext],
    handler: bookingController.verifyRazorpayPayment.bind(bookingController),
  });

  fastify.get('/bookings', {
    schema: queryBookingsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingController.list.bind(bookingController),
  });

  // Dedicated Mobile User Booking History & Access Passes
  fastify.get('/bookings/my', {
    schema: getMyBookingsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingController.listMy.bind(bookingController),
  });

  // Retrieve All Bookings in a Multi-Slot Group
  fastify.get('/bookings/group/:groupId', {
    schema: groupParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingController.getByGroupId.bind(bookingController),
  });

  // Multi-Slot Group Itemized Tax Invoice
  fastify.get('/bookings/group/:groupId/invoice', {
    schema: groupParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingController.getGroupInvoice.bind(bookingController),
  });

  fastify.get('/bookings/:id', {
    schema: bookingParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingController.getById.bind(bookingController),
  });

  fastify.post('/bookings/:id/cancel', {
    schema: cancelBookingSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingController.cancel.bind(bookingController),
  });

  fastify.post('/bookings/:id/check-in', {
    schema: bookingParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingController.checkIn.bind(bookingController),
  });

  fastify.get('/bookings/:id/invoice', {
    schema: bookingParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingController.getInvoice.bind(bookingController),
  });

  // Reprovision / Sync Biometric Hardware PIN on Terminal
  fastify.post('/bookings/:id/sync-pin', {
    schema: bookingParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingController.reprovisionPin.bind(bookingController),
  });
}
