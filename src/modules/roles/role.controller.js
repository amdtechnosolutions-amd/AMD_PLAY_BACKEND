import { BaseController } from '../../core/BaseController.js';
import { roleService } from './role.service.js';
import { apiSuccess } from '../../utils/response.js';

export class RoleController extends BaseController {
  constructor() {
    super(roleService);
  }

  async getPermissions(request, reply) {
    const permissions = roleService.getAvailablePermissions();
    return reply.status(200).send(
      apiSuccess({
        message: 'Available granular system permissions retrieved',
        data: permissions,
      })
    );
  }

  async listRoles(request, reply) {
    const context = this._extractContext(request);
    const roles = await roleService.listForTenant(context.tenantId);
    return reply.status(200).send(
      apiSuccess({
        message: 'Roles list retrieved',
        data: roles,
      })
    );
  }
}

export const roleController = new RoleController();
