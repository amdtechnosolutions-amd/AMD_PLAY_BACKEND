import { BaseRepository } from '../../core/BaseRepository.js';
import { Role } from './role.model.js';

export class RoleRepository extends BaseRepository {
  constructor() {
    super(Role);
  }

  async findRolesForTenant(tenantId) {
    return await this.model.find({
      slug: { $ne: 'super_admin' },
      $or: [{ tenantId: null }, { tenantId }],
    }).sort({ isSystem: -1, name: 1 }).lean();
  }

  async findBySlug(slug, tenantId = null) {
    return await this.model.findOne({
      slug: slug.toLowerCase(),
      $or: [{ tenantId: null }, { tenantId }],
    }).lean();
  }
}

export const roleRepository = new RoleRepository();
