import { bookingUserService } from './booking-user.service.js';
import { apiSuccess } from '../../utils/response.js';

export class BookingUserController {
  _extractContext(request) {
    return {
      tenantId: request.tenantId || request.user?.tenantId,
      branchId: request.user?.branchId,
      user: request.user,
    };
  }

  async createBookingUser(req, reply) {
    const context = this._extractContext(req);
    const result = await bookingUserService.createBookingUser(req.body, context);
    return reply.status(201).send(
      apiSuccess({
        message: 'Booking user registered successfully',
        data: result,
      })
    );
  }

  async listBookingUsers(req, reply) {
    const context = this._extractContext(req);
    const { page, limit, ...filters } = req.query || {};
    const pagination = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    };
    const result = await bookingUserService.listBookingUsers(filters, pagination, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Booking users retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async getBookingUserById(req, reply) {
    const context = this._extractContext(req);
    const user = await bookingUserService.getBookingUserById(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Booking user profile retrieved',
        data: user,
      })
    );
  }

  async updateBookingUser(req, reply) {
    const context = this._extractContext(req);
    const user = await bookingUserService.updateBookingUser(req.params.id, req.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Booking user updated successfully',
        data: user,
      })
    );
  }

  async deleteBookingUser(req, reply) {
    const context = this._extractContext(req);
    const result = await bookingUserService.deleteBookingUser(req.params.id, context);
    return reply.status(200).send(apiSuccess(result));
  }

  async getUserBookings(req, reply) {
    const context = this._extractContext(req);
    const { page, limit, ...filters } = req.query || {};
    const pagination = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    };
    const result = await bookingUserService.getUserBookings(req.params.id, filters, pagination, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'User bookings retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }
}

export const bookingUserController = new BookingUserController();
