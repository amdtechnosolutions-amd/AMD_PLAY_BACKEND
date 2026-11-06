import { BaseService } from '../../core/BaseService.js';
import { sportRepository } from './sport.repository.js';
import { ConflictError, NotFoundError, AuthorizationError } from '../../errors/AppError.js';
import { ROLES } from '../../config/constants.js';

export class SportService extends BaseService {
  constructor() {
    super(sportRepository, 'Sport');
  }

  async create(data, context = {}) {
    const isSuperAdmin = context.user?.role === ROLES.SUPER_ADMIN;
    const tenantId = isSuperAdmin ? null : context.tenantId || null;

    const existing = await sportRepository.findBySlug(data.slug, tenantId);
    if (existing && (!tenantId || existing.tenantId?.toString() === tenantId.toString())) {
      throw new ConflictError(`Sport with slug '${data.slug}' already exists in catalog`);
    }

    return await super.create({ ...data, tenantId }, context);
  }

  async getById(id, context = {}) {
    const sport = await sportRepository.model.findById(id);
    if (!sport) {
      throw new NotFoundError(`Sport with ID '${id}' not found`);
    }
    // If sport is tenant-specific, verify it belongs to user's tenant (unless superadmin)
    if (
      sport.tenantId &&
      context.tenantId &&
      sport.tenantId.toString() !== context.tenantId.toString() &&
      context.user?.role !== ROLES.SUPER_ADMIN
    ) {
      throw new NotFoundError(`Sport with ID '${id}' not found`);
    }
    return sport;
  }

  async update(id, updateData, context = {}) {
    const sport = await this.getById(id, context);
    const isSuperAdmin = context.user?.role === ROLES.SUPER_ADMIN;
    const isAdmin = [ROLES.TENANT_OWNER, ROLES.TENANT_ADMIN, ROLES.BRANCH_ADMIN].includes(context.user?.role);
    const isOwner = sport.tenantId && context.tenantId && sport.tenantId.toString() === context.tenantId.toString();
    const isGlobal = !sport.tenantId;

    if (!isSuperAdmin && !isOwner && !(isAdmin && isGlobal)) {
      throw new AuthorizationError('You do not have permission to update this sport');
    }

    return await sportRepository.model.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  }

  async delete(id, context = {}) {
    const sport = await this.getById(id, context);
    const isSuperAdmin = context.user?.role === ROLES.SUPER_ADMIN;
    const isAdmin = [ROLES.TENANT_OWNER, ROLES.TENANT_ADMIN, ROLES.BRANCH_ADMIN].includes(context.user?.role);
    const isOwner = sport.tenantId && context.tenantId && sport.tenantId.toString() === context.tenantId.toString();
    const isGlobal = !sport.tenantId;

    if (!isSuperAdmin && !isOwner && !(isAdmin && isGlobal)) {
      throw new AuthorizationError('You do not have permission to delete this sport');
    }

    return await sportRepository.model.findByIdAndDelete(id);
  }

  async listForTenant(tenantId, filter = {}) {
    return await sportRepository.findSportsForTenant(tenantId, filter);
  }
}

export const sportService = new SportService();
