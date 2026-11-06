import { BaseService } from '../../core/BaseService.js';
import { userRepository } from './user.repository.js';
import { branchRepository } from '../branches/branch.repository.js';
import { hashPassword } from '../../utils/password.js';
import { ConflictError, NotFoundError, ValidationError } from '../../errors/AppError.js';
import { ROLES } from '../../config/constants.js';
import { normalizeRole } from '../../utils/role-normalizer.js';

export class UserService extends BaseService {
  constructor() {
    super(userRepository, 'User');
  }

  async create(data, context = {}) {
    const role = normalizeRole(data.role);
    const tenantId = context.tenantId || data.tenantId;
    if (!tenantId && role !== ROLES.SUPER_ADMIN) {
      throw new ValidationError('Tenant context is required to create a user');
    }

    // 1. Check duplicate email under this tenant
    const existing = await userRepository.findByEmailWithPassword(data.email, tenantId);
    if (existing) {
      throw new ConflictError(`User with email '${data.email}' already exists in this academy`);
    }

    // 2. Validate branch assignment if provided
    if (data.branchId) {
      const branch = await branchRepository.findById(data.branchId, tenantId);
      if (!branch) {
        throw new NotFoundError(`Branch with ID '${data.branchId}' not found in this academy`);
      }
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await userRepository.create({
      ...data,
      tenantId,
      password: hashedPassword,
      role,
    });

    const userObj = user.toObject();
    delete userObj.password;
    return userObj;
  }

  async update(id, updateData, context = {}) {
    if (updateData.branchId) {
      const branch = await branchRepository.findById(updateData.branchId, context.tenantId);
      if (!branch) {
        throw new NotFoundError(`Branch with ID '${updateData.branchId}' not found in this academy`);
      }
    }

    if (updateData.role) {
      updateData.role = normalizeRole(updateData.role);
    }

    // Never update password directly via update endpoint (dedicated endpoint in future auth)
    delete updateData.password;

    const updated = await userRepository.updateById(id, updateData, context.tenantId);
    if (!updated) {
      throw new NotFoundError(`User with ID '${id}' not found`);
    }

    const userObj = updated.toObject();
    delete userObj.password;
    return userObj;
  }

  async list(filter = {}, pagination = {}, context = {}) {
    const queryFilter = { ...filter };
    if (context.tenantId || context.user?.role !== ROLES.SUPER_ADMIN) {
      queryFilter.role = { $ne: ROLES.SUPER_ADMIN };
    }
    return await super.list(queryFilter, pagination, context);
  }

  async deactivate(id, context = {}) {
    return await this.update(id, { status: 'inactive' }, context);
  }
}

export const userService = new UserService();
