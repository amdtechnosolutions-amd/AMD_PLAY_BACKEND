import { BaseRepository } from '../../core/BaseRepository.js';
import { Tenant } from './tenant.model.js';

export class TenantRepository extends BaseRepository {
  constructor() {
    super(Tenant);
  }

  async findBySlug(slug) {
    return await this.model.findOne({ slug: slug.toLowerCase() });
  }

  async findByDomain(domain) {
    return await this.model.findOne({ domain: domain.toLowerCase() });
  }
}

export const tenantRepository = new TenantRepository();
