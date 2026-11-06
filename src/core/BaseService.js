import { NotFoundError } from '../errors/AppError.js';

/**
 * Base Service providing business logic orchestration over a repository.
 */
export class BaseService {
  constructor(repository, entityName = 'Resource') {
    this.repository = repository;
    this.entityName = entityName;
  }

  async create(data, context = {}) {
    if (context.tenantId && !data.tenantId) {
      data.tenantId = context.tenantId;
    }
    if (context.branchId && !data.branchId) {
      data.branchId = context.branchId;
    }
    return await this.repository.create(data);
  }

  async getById(id, context = {}) {
    const item = await this.repository.findById(id, context.tenantId, { lean: true });
    if (!item) {
      throw new NotFoundError(`${this.entityName} with ID '${id}' not found`);
    }
    return item;
  }

  async list(filter = {}, pagination = {}, context = {}) {
    return await this.repository.paginate(filter, pagination, context.tenantId);
  }

  async update(id, updateData, context = {}) {
    const updated = await this.repository.updateById(id, updateData, context.tenantId);
    if (!updated) {
      throw new NotFoundError(`${this.entityName} with ID '${id}' not found`);
    }
    return updated;
  }

  async delete(id, context = {}) {
    const deleted = await this.repository.deleteById(id, context.tenantId);
    if (!deleted) {
      throw new NotFoundError(`${this.entityName} with ID '${id}' not found`);
    }
    return deleted;
  }
}
