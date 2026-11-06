import { BaseRepository } from '../../core/BaseRepository.js';
import { Skill } from './skill.model.js';

export class SkillRepository extends BaseRepository {
  constructor() {
    super(Skill);
  }

  async findSkills(tenantId = null, filter = {}) {
    const query = {
      $or: [{ tenantId: null }, ...(tenantId ? [{ tenantId }] : [])],
      ...filter,
    };
    return await this.model
      .find(query)
      .populate('sportId', 'name slug type')
      .populate('branchId', 'name code')
      .sort({ level: 1, order: 1, name: 1 });
  }

  async findByCode(code, sportId = null, tenantId = null) {
    return await this.model.findOne({
      code: code.toLowerCase(),
      sportId: sportId || null,
      $or: [{ tenantId: null }, ...(tenantId ? [{ tenantId }] : [])],
    });
  }
}

export const skillRepository = new SkillRepository();
