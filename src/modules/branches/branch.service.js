import { BaseService } from '../../core/BaseService.js';
import { branchRepository } from './branch.repository.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { ConflictError, ValidationError } from '../../errors/AppError.js';

export class BranchService extends BaseService {
  constructor() {
    super(branchRepository, 'Branch');
  }

  async create(data, context = {}) {
    const tenantId = context.tenantId || data.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required to create a branch');
    }

    // 1. Check duplicate branch code under tenant
    const existingCode = await branchRepository.findByCode(data.code, tenantId);
    if (existingCode) {
      throw new ConflictError(`Branch code '${data.code}' is already in use for this academy`);
    }

    // 2. Check tenant branch limit
    const tenant = await tenantRepository.findById(tenantId);
    if (tenant && tenant.limits?.maxBranches) {
      const currentBranchCount = await branchRepository.count({}, tenantId);
      if (currentBranchCount >= tenant.limits.maxBranches) {
        throw new ConflictError(
          `Academy branch limit reached (${tenant.limits.maxBranches}). Upgrade your plan to add more branches.`
        );
      }
    }

    return await super.create({ ...data, tenantId }, context);
  }

  async listActive(tenantId) {
    return await branchRepository.listActiveBranches(tenantId);
  }
}

export const branchService = new BranchService();
