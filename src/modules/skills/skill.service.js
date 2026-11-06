import { BaseService } from '../../core/BaseService.js';
import { skillRepository } from './skill.repository.js';
import { ConflictError, NotFoundError, AuthorizationError } from '../../errors/AppError.js';
import { ROLES } from '../../config/constants.js';

export const DEFAULT_SKILL_LEVELS = [
  {
    name: 'Beginner',
    code: 'beginner',
    level: 1,
    category: 'level',
    description: 'Foundational training & rules',
    color: '#10B981',
    order: 1,
    criteria: ['Basic grip, stance & court movement', 'Understanding of rules and scoring', 'Simple rally consistency'],
  },
  {
    name: 'Intermediate',
    code: 'intermediate',
    level: 2,
    category: 'level',
    description: 'Stroke technique & footwork drills',
    color: '#3B82F6',
    order: 2,
    criteria: ['Controlled overhead clears & drop shots', 'Forehand & backhand net play', 'Coordinated multi-shuttle drills'],
  },
  {
    name: 'Advanced',
    code: 'advanced',
    level: 3,
    category: 'level',
    description: 'Competitive match strategy & high performance',
    color: '#F59E0B',
    order: 3,
    criteria: ['Deceptive smashes & fast recovery', 'Tactical shot variation under pressure', 'Match play stamina and set endurance'],
  },
  {
    name: 'Elite / Pro',
    code: 'elite',
    level: 4,
    category: 'level',
    description: 'State / National tournament squad',
    color: '#EF4444',
    order: 4,
    criteria: ['State/National tournament participation', 'Advanced spin, slice and deception', 'High-intensity conditioning & mental resilience'],
  },
];

export class SkillService extends BaseService {
  constructor() {
    super(skillRepository, 'Skill');
  }

  async create(data, context = {}) {
    const isSuperAdmin = context.user?.role === ROLES.SUPER_ADMIN || context.user?.role === ROLES.PLATFORM_ADMIN;
    const tenantId = isSuperAdmin ? (data.tenantId || null) : (context.tenantId || null);

    // Auto-generate slug code from name if omitted
    if (!data.code && data.name) {
      data.code = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    const existing = await skillRepository.findByCode(data.code, data.sportId, tenantId);
    if (existing && (!tenantId || existing.tenantId?.toString() === tenantId?.toString())) {
      throw new ConflictError(`Skill level with code '${data.code}' already exists`);
    }

    return await super.create({ ...data, tenantId }, context);
  }

  async list(filter = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId || null;
    const query = {};

    if (filter.sportId) {
      query.$or = [{ sportId: filter.sportId }, { sportId: null }];
    }
    if (filter.category) query.category = filter.category;
    if (filter.active !== undefined) query.active = filter.active === true || filter.active === 'true';
    if (filter.branchId) query.branchId = filter.branchId;

    if (filter.search) {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { name: { $regex: filter.search, $options: 'i' } },
            { code: { $regex: filter.search, $options: 'i' } },
            { description: { $regex: filter.search, $options: 'i' } },
          ],
        },
      ];
    }

    let items = await skillRepository.findSkills(tenantId, query);

    // If database has 0 skills, auto-seed defaults so dropdowns & UI have immediate rich data
    if (!items || items.length === 0) {
      await this.seedDefaults(tenantId);
      items = await skillRepository.findSkills(tenantId, query);
    }

    return {
      items,
      pagination: {
        total: items.length,
        page: 1,
        limit: items.length,
      },
    };
  }

  async getById(id, context = {}) {
    const skill = await skillRepository.model
      .findById(id)
      .populate('sportId', 'name slug type')
      .populate('branchId', 'name code');
    if (!skill) {
      throw new NotFoundError(`Skill with ID '${id}' not found`);
    }
    if (
      skill.tenantId &&
      context.tenantId &&
      skill.tenantId.toString() !== context.tenantId.toString() &&
      context.user?.role !== ROLES.SUPER_ADMIN
    ) {
      throw new NotFoundError(`Skill with ID '${id}' not found`);
    }
    return skill;
  }

  async update(id, updateData, context = {}) {
    const skill = await this.getById(id, context);
    const isSuperAdmin = context.user?.role === ROLES.SUPER_ADMIN || context.user?.role === ROLES.PLATFORM_ADMIN;
    const isOwner = skill.tenantId && context.tenantId && skill.tenantId.toString() === context.tenantId.toString();
    const isGlobal = !skill.tenantId;

    if (!isSuperAdmin && !isOwner && !isGlobal) {
      throw new AuthorizationError('You do not have permission to update this skill');
    }

    return await skillRepository.model.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  }

  async delete(id, context = {}) {
    const skill = await this.getById(id, context);
    const isSuperAdmin = context.user?.role === ROLES.SUPER_ADMIN || context.user?.role === ROLES.PLATFORM_ADMIN;
    const isOwner = skill.tenantId && context.tenantId && skill.tenantId.toString() === context.tenantId.toString();

    if (!isSuperAdmin && !isOwner) {
      throw new AuthorizationError('You do not have permission to delete this skill');
    }

    return await skillRepository.model.findByIdAndDelete(id);
  }

  async seedDefaults(tenantId = null) {
    for (const item of DEFAULT_SKILL_LEVELS) {
      const exists = await skillRepository.model.findOne({ code: item.code, tenantId: null });
      if (!exists) {
        await skillRepository.model.create({ ...item, tenantId: null, active: true });
      }
    }
  }
}

export const skillService = new SkillService();
