import mongoose from 'mongoose';
import { BaseRepository } from '../../core/BaseRepository.js';
import { Sport } from './sport.model.js';

export class SportRepository extends BaseRepository {
  constructor() {
    super(Sport);
  }

  async findSportsForTenant(tenantId = null, filter = {}) {
    let tenantFilter = null;
    if (tenantId) {
      tenantFilter = mongoose.Types.ObjectId.isValid(tenantId)
        ? [tenantId, new mongoose.Types.ObjectId(tenantId)]
        : [tenantId];
    }

    const query = {
      ...(tenantFilter ? { $or: [{ tenantId: null }, { tenantId: { $in: tenantFilter } }] } : {}),
      active: true,
      ...filter,
    };
    return await this.model.find(query).sort({ name: 1 }).lean();
  }

  async findBySlug(slug, tenantId = null) {
    let tenantFilter = null;
    if (tenantId) {
      tenantFilter = mongoose.Types.ObjectId.isValid(tenantId)
        ? [tenantId, new mongoose.Types.ObjectId(tenantId)]
        : [tenantId];
    }

    const query = {
      slug: slug.toLowerCase(),
      ...(tenantFilter ? { $or: [{ tenantId: null }, { tenantId: { $in: tenantFilter } }] } : {}),
    };
    return await this.model.findOne(query).lean();
  }
}

export const sportRepository = new SportRepository();
