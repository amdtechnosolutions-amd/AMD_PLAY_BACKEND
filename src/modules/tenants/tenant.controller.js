import { BaseController } from '../../core/BaseController.js';
import { tenantService } from './tenant.service.js';
import { apiSuccess } from '../../utils/response.js';

export class TenantController extends BaseController {
  constructor() {
    super(tenantService);
  }

  async createTenant(request, reply) {
    const tenant = await tenantService.createTenant(request.body);
    return reply.status(201).send(
      apiSuccess({
        message: 'Academy tenant onboarded successfully',
        data: tenant,
      })
    );
  }

  async lookupBySlug(request, reply) {
    const academy = await tenantService.lookupBySlug(request.params.slug);
    return reply.status(200).send(
      apiSuccess({
        message: 'Academy details retrieved',
        data: academy,
      })
    );
  }

  async lookupByEmail(request, reply) {
    const email = request.query.email || request.body?.email;
    const academy = await tenantService.lookupByEmail(email);
    return reply.status(200).send(
      apiSuccess({
        message: 'Academy details resolved from email',
        data: academy,
      })
    );
  }
}

export const tenantController = new TenantController();
