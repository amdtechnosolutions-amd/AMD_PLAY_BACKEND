import { apiSuccess } from '../utils/response.js';

/**
 * Base Controller handling HTTP requests and delegating to services.
 */
export class BaseController {
  constructor(service) {
    this.service = service;
  }

  _extractContext(request) {
    return {
      user: request.user,
      userId: request.user?.id || request.user?._id || request.user?.sub,
      tenantId: request.tenantId || request.user?.tenantId,
      branchId: request.branchId || request.user?.branchId,
      ip: request.ip,
    };
  }

  async create(request, reply) {
    const context = this._extractContext(request);
    const result = await this.service.create(request.body, context);
    return reply.status(201).send(
      apiSuccess({
        message: `${this.service.entityName} created successfully`,
        data: result,
      })
    );
  }

  async getById(request, reply) {
    const context = this._extractContext(request);
    const result = await this.service.getById(request.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: `${this.service.entityName} retrieved successfully`,
        data: result,
      })
    );
  }

  async list(request, reply) {
    const context = this._extractContext(request);
    const { page, limit, sort, ...filters } = request.query || {};
    const result = await this.service.list(filters, { page, limit, sort }, context);
    return reply.status(200).send(
      apiSuccess({
        message: `${this.service.entityName} list retrieved`,
        data: result.items,
        meta: result.pagination,
      })
    );
  }

  async update(request, reply) {
    const context = this._extractContext(request);
    const result = await this.service.update(request.params.id, request.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: `${this.service.entityName} updated successfully`,
        data: result,
      })
    );
  }

  async delete(request, reply) {
    const context = this._extractContext(request);
    await this.service.delete(request.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: `${this.service.entityName} deleted successfully`,
      })
    );
  }
}
