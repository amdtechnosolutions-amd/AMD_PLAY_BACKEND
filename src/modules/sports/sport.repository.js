import { BaseRepository } from '../../core/BaseRepository.js';
import { Sport } from './sport.model.js';

export class SportRepository extends BaseRepository {
  constructor() {
    super(Sport);
  }

  async findSportsForTenant(tenantId = null, filter = {}) {
    const query = {
      $or: [{ tenantId: null }, ...(tenantId ? [{ tenantId }] : [])],
      active: true,
      ...filter,
    };
    return await this.model.find(query).sort({ name: 1 }).lean();
  }

  async findBySlug(slug, tenantId = null) {
    return await this.model.findOne({
      slug: slug.toLowerCase(),
      $or: [{ tenantId: null }, ...(tenantId ? [{ tenantId }] : [])],
    }).lean();
  }
}

export const sportRepository = new SportRepository();
