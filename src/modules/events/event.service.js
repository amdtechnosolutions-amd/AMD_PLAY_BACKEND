import { BaseService } from '../../core/BaseService.js';
import { eventRepository } from './event.repository.js';
import { NotFoundError, ValidationError } from '../../errors/AppError.js';

export class EventService extends BaseService {
  constructor() {
    super(eventRepository, 'Event');
  }

  async listEvents(filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    const filter = { tenantId };
    if (filters.branchId) filter.branchId = filters.branchId;
    if (filters.sportId) filter.sportId = filters.sportId;
    if (filters.active !== undefined) filter.active = filters.active;

    return await this.repository.paginate(
      filter,
      {
        ...pagination,
        populate: [{ path: 'sportId', select: 'name icon' }],
        sort: pagination.sort || { startDate: 1 },
      },
      tenantId
    );
  }

  async registerParticipant(eventId, data, context = {}) {
    const tenantId = context.tenantId || data.tenantId;
    const event = await this.repository.findById(eventId, tenantId);
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' not found`);
    }

    if (!event.active) {
      throw new ValidationError('Registrations for this tournament are currently closed');
    }

    if (new Date() > new Date(event.registrationLastDate)) {
      throw new ValidationError('Registration deadline has passed for this event');
    }

    const currentCount = await eventRepository.countRegistrations(eventId);
    if (event.maxParticipants && currentCount >= event.maxParticipants) {
      throw new ValidationError('Maximum participant capacity has been reached for this event');
    }

    let age = data.age;
    if (data.dateOfBirth) {
      const birth = new Date(data.dateOfBirth);
      const diffMs = Date.now() - birth.getTime();
      age = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
    }

    const registration = await eventRepository.createRegistration({
      ...data,
      eventId,
      tenantId,
      branchId: event.branchId,
      amount: event.registrationAmount || 0,
      age,
      paymentStatus: 'paid',
      transactionId: data.transactionId || `EVT-${Date.now()}`,
    });

    event.enrolledCount = currentCount + 1;
    await event.save();

    return registration;
  }

  async getRegistrations(eventId, context = {}) {
    const tenantId = context.tenantId;
    return await eventRepository.findRegistrations(eventId, tenantId);
  }
}

export const eventService = new EventService();
