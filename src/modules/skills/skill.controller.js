import { BaseController } from '../../core/BaseController.js';
import { skillService } from './skill.service.js';
import { apiSuccess } from '../../utils/response.js';

export class SkillController extends BaseController {
  constructor() {
    super(skillService);
  }

  async list(request, reply) {
    const context = this._extractContext(request);
    const { sportId, branchId, category, active, search, page, limit } = request.query || {};
    const filter = {};
    if (sportId) filter.sportId = sportId;
    if (branchId) filter.branchId = branchId;
    if (category) filter.category = category;
    if (active !== undefined) filter.active = active;
    if (search) filter.search = search;

    const result = await skillService.list(filter, { page, limit }, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Skills and coaching levels retrieved successfully',
        data: result.items,
        meta: result.pagination,
      })
    );
  }
}

export const skillController = new SkillController();
