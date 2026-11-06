import { BaseRepository } from '../../core/BaseRepository.js';
import { Branch } from './branch.model.js';

export class BranchRepository extends BaseRepository {
  constructor() {
    super(Branch);
  }

  async findByCode(code, tenantId) {
    return await this.model.findOne({
      code: code.toUpperCase(),
      tenantId,
    }).lean();
  }

  async listActiveBranches(tenantId) {
    return await this.model.find({
      tenantId,
      status: 'active',
    }).sort({ name: 1 }).lean();
  }
}

export const branchRepository = new BranchRepository();
