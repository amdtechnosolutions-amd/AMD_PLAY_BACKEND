import { bookingService } from './booking.service.js';
import { apiSuccess } from '../../utils/response.js';
import { User } from '../users/user.model.js';
import { studentService } from '../students/student.service.js';

export class BookingController {
  _extractContext(request) {
    const user = request.user || request.decodedUser || null;
    return {
      user,
      tenantId: request.tenantId || user?.tenantId || null,
      branchId: request.branchId || user?.branchId || null,
      ip: request.ip,
    };
  }

  async create(request, reply) {
    const context = this._extractContext(request);
    const booking = await bookingService.createBooking(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Booking confirmed successfully',
        data: booking,
      })
    );
  }

  async list(request, reply) {
    const context = this._extractContext(request);
    const { page, limit, sort, ...filters } = request.query || {};

    const result = await bookingService.listBookings(filters, { page, limit, sort }, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Bookings retrieved successfully',
        data: result.items,
        meta: result.pagination,
      })
    );
  }

  async listMy(request, reply) {
    const context = this._extractContext(request);
    const { page, limit, sort, studentId, ...filters } = request.query || {};
    let targetUserId = context.user?.id || context.user?.sub;

    if (studentId) {
      const requestedId = studentId.toString();
      const currentUser = await User.findById(targetUserId).lean();
      if (currentUser) {
        const familyStudents = await studentService._resolveFamilyStudents(currentUser, context.tenantId);
        const isSibling = familyStudents.some((s) => s._id.toString() === requestedId);
        const role = context.user?.role;
        const isAdminOrCoach = ['tenant_admin', 'super_admin', 'manager', 'coach', 'trainer'].includes(role);

        if (isSibling || isAdminOrCoach) {
          targetUserId = requestedId;
        }
      }
    }

    filters.userId = targetUserId;
    const result = await bookingService.listBookings(filters, { page, limit, sort }, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Personal bookings retrieved successfully',
        data: result.items,
        meta: result.pagination,
      })
    );
  }

  async getById(request, reply) {
    const context = this._extractContext(request);
    const booking = await bookingService.getBookingById(request.params.id, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Booking details retrieved',
        data: booking,
      })
    );
  }

  async cancel(request, reply) {
    const context = this._extractContext(request);
    const reason = request.body?.reason;
    const cancelled = await bookingService.cancelBooking(request.params.id, reason, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Booking cancelled successfully',
        data: cancelled,
      })
    );
  }

  async checkIn(request, reply) {
    const context = this._extractContext(request);
    const checkedIn = await bookingService.checkInBooking(request.params.id, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Booking checked in successfully',
        data: checkedIn,
      })
    );
  }

  async getInvoice(request, reply) {
    const context = this._extractContext(request);
    const invoice = await bookingService.getInvoice(request.params.id, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Invoice retrieved successfully',
        data: invoice,
      })
    );
  }

  async createRazorpayOrder(request, reply) {
    const context = this._extractContext(request);
    const order = await bookingService.createRazorpayOrder(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Razorpay booking order created successfully',
        data: order,
      })
    );
  }

  async verifyRazorpayPayment(request, reply) {
    const context = this._extractContext(request);
    const booking = await bookingService.verifyRazorpayPayment(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Booking confirmed and payment verified successfully',
        data: booking,
      })
    );
  }
  async getByGroupId(request, reply) {
    const context = this._extractContext(request);
    const bookings = await bookingService.getBookingsByGroupId(request.params.groupId, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Group bookings retrieved successfully',
        data: bookings,
      })
    );
  }

  async getGroupInvoice(request, reply) {
    const context = this._extractContext(request);
    const invoice = await bookingService.getGroupInvoice(request.params.groupId, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Group invoice retrieved successfully',
        data: invoice,
      })
    );
  }

  async reprovisionPin(request, reply) {
    const context = this._extractContext(request);
    const result = await bookingService.reprovisionPin(request.params.id, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Biometric hardware PIN synchronized successfully',
        data: result,
      })
    );
  }
}

export const bookingController = new BookingController();
