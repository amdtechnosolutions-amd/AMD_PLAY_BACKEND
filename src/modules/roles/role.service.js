import { BaseService } from '../../core/BaseService.js';
import { roleRepository } from './role.repository.js';
import { PERMISSIONS } from '../../config/constants.js';
import { ConflictError, ValidationError } from '../../errors/AppError.js';

export class RoleService extends BaseService {
  constructor() {
    super(roleRepository, 'Role');
  }

  getAvailablePermissions() {
    return Object.entries(PERMISSIONS).map(([key, value]) => ({
      key,
      permission: value,
      category: value.split('.')[0] || 'general',
    }));
  }

  async create(data, context = {}) {
    const tenantId = context.tenantId || null;

    const existing = await roleRepository.findBySlug(data.slug, tenantId);
    if (existing && existing.tenantId?.toString() === tenantId?.toString()) {
      throw new ConflictError(`Role with slug '${data.slug}' already exists in this academy`);
    }

    // Validate that provided permissions are known system permissions
    const validPermissionValues = new Set(Object.values(PERMISSIONS));
    const invalidPermissions = (data.permissions || []).filter((p) => !validPermissionValues.has(p));

    if (invalidPermissions.length > 0) {
      throw new ValidationError(`Unknown permissions provided: ${invalidPermissions.join(', ')}`);
    }

    return await super.create({ ...data, tenantId, isSystem: false }, context);
  }

  async listForTenant(tenantId) {
    return await roleRepository.findRolesForTenant(tenantId);
  }
}

export const roleService = new RoleService();
