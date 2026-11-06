import { BaseController } from '../../core/BaseController.js';
import { resourceService } from './resource.service.js';
import { apiSuccess } from '../../utils/response.js';

export class ResourceController extends BaseController {
  constructor() {
    super(resourceService);
  }

  async listActive(request, reply) {
    const context = this._extractContext(request);
    const { branchId, sportId } = request.query || {};
    const resources = await this.service.listActive(branchId, sportId, context.tenantId);
    return reply.status(200).send(
      apiSuccess({
        message: 'Active resources retrieved successfully',
        data: resources,
      })
    );
  }

  async setMaintenance(request, reply) {
    const context = this._extractContext(request);
    const result = await this.service.setMaintenance(request.params.id, request.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Resource maintenance status updated successfully',
        data: result,
      })
    );
  }
}

export const resourceController = new ResourceController();
