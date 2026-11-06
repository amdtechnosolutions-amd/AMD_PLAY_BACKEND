import { BaseController } from '../../core/BaseController.js';
import { branchService } from './branch.service.js';
import { apiSuccess } from '../../utils/response.js';

export class BranchController extends BaseController {
  constructor() {
    super(branchService);
  }

  async listActive(request, reply) {
    const context = this._extractContext(request);
    const branches = await branchService.listActive(context.tenantId);
    return reply.status(200).send(
      apiSuccess({
        message: 'Active branches list retrieved',
        data: branches,
      })
    );
  }
}

export const branchController = new BranchController();
