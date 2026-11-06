import { BaseRepository } from '../../core/BaseRepository.js';
import { Event } from './event.model.js';
import { EventRegistration } from './event-registration.model.js';

export class EventRepository extends BaseRepository {
  constructor() {
    super(Event);
  }

  async findActiveEvents(tenantId, branchId = null) {
    const query = { tenantId, active: true };
    if (branchId) query.branchId = branchId;
    return await this.model.find(query).populate('sportId', 'name icon').sort({ startDate: 1 });
  }

  async createRegistration(data) {
    return await EventRegistration.create(data);
  }

  async findRegistrations(eventId, tenantId) {
    return await EventRegistration.find({ eventId, tenantId }).sort({ createdAt: -1 });
  }

  async countRegistrations(eventId) {
    return await EventRegistration.countDocuments({ eventId, paymentStatus: 'paid' });
  }
}

export const eventRepository = new EventRepository();
