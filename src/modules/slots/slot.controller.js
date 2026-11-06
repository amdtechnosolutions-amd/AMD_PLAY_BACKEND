import { slotService } from './slot.service.js';
import { apiSuccess } from '../../utils/response.js';

export class SlotController {
  _extractContext(request) {
    return {
      user: request.user,
      tenantId: request.tenantId || request.user?.tenantId || request.headers['x-tenant-id'] || request.headers['x-tenant-slug'],
      branchId: request.branchId || request.user?.branchId || request.headers['x-branch-id'],
      ip: request.ip,
    };
  }

  async getSlots(request, reply) {
    const context = this._extractContext(request);
    const { resourceId, branchId, sportId, date, duration } = request.query;

    const data = await slotService.generateSlots({ resourceId, branchId, sportId, date, duration }, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Slots retrieved successfully',
        data,
      })
    );
  }

  async holdSlot(request, reply) {
    const context = this._extractContext(request);
    const holdData = await slotService.holdSlot(request.body, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Slot successfully held for 5 minutes',
        data: holdData,
      })
    );
  }

  async releaseSlot(request, reply) {
    const context = this._extractContext(request);
    const result = await slotService.releaseSlot(request.body, context);

    return reply.status(200).send(
      apiSuccess({
        message: result.message,
        data: result,
      })
    );
  }

  async calculatePrice(request, reply) {
    const context = this._extractContext(request);
    const result = await slotService.calculatePrice(request.body, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Slot price calculated successfully',
        data: result,
      })
    );
  }
}

export const slotController = new SlotController();
