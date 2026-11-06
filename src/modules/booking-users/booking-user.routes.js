import { bookingUserController } from './booking-user.controller.js';
import {
  createBookingUserSchema,
  queryBookingUsersSchema,
  bookingUserParamSchema,
  updateBookingUserSchema,
  queryUserBookingsSchema,
} from './booking-user.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function bookingUserRoutes(fastify) {
  fastify.post('/booking-users', {
    schema: createBookingUserSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingUserController.createBookingUser.bind(bookingUserController),
  });

  fastify.get('/booking-users', {
    schema: queryBookingUsersSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingUserController.listBookingUsers.bind(bookingUserController),
  });

  fastify.get('/booking-users/:id', {
    schema: bookingUserParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingUserController.getBookingUserById.bind(bookingUserController),
  });

  fastify.patch('/booking-users/:id', {
    schema: updateBookingUserSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingUserController.updateBookingUser.bind(bookingUserController),
  });

  fastify.delete('/booking-users/:id', {
    schema: bookingUserParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingUserController.deleteBookingUser.bind(bookingUserController),
  });

  fastify.get('/booking-users/:id/bookings', {
    schema: queryUserBookingsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: bookingUserController.getUserBookings.bind(bookingUserController),
  });
}
