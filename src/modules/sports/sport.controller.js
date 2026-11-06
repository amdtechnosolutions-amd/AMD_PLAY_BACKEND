import { BaseController } from '../../core/BaseController.js';
import { sportService } from './sport.service.js';
import { apiSuccess } from '../../utils/response.js';

export class SportController extends BaseController {
  constructor() {
    super(sportService);
  }

  async list(request, reply) {
    const context = this._extractContext(request);
    const { type, ..._rest } = request.query || {};
    const filter = {};
    if (type) filter.type = type;

    const sports = await sportService.listForTenant(context.tenantId, filter);
    return reply.status(200).send(
      apiSuccess({
        message: 'Sports catalog retrieved',
        data: sports,
      })
    );
  }
}

export const sportController = new SportController();
