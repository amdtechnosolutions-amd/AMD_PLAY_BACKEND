import { BaseController } from '../../core/BaseController.js';
import { eventService } from './event.service.js';
import { apiSuccess } from '../../utils/response.js';

export class EventController extends BaseController {
  constructor() {
    super(eventService);
  }

  async listEvents(req, reply) {
    const context = this._extractContext(req);
    const filters = req.query || {};
    const pagination = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
    };
    const result = await eventService.listEvents(filters, pagination, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Events list retrieved',
        data: result.items,
        pagination: result.pagination,
        meta: result.pagination,
      })
    );
  }

  async register(req, reply) {
    const context = this._extractContext(req);
    const { eventId } = req.params;
    const result = await eventService.registerParticipant(eventId, req.body, context);
    return reply.status(201).send(
      apiSuccess({
        message: 'Participant registered successfully',
        data: result,
      })
    );
  }

  async getRegistrations(req, reply) {
    const context = this._extractContext(req);
    const { eventId } = req.params;
    const result = await eventService.getRegistrations(eventId, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Registrations retrieved successfully',
        data: result,
      })
    );
  }
}

export const eventController = new EventController();
