import { BaseRepository } from '../../core/BaseRepository.js';
import { MembershipPlan } from './membershipPlan.model.js';
import { MemberSubscription } from './memberSubscription.model.js';

export class MembershipPlanRepository extends BaseRepository {
  constructor() {
    super(MembershipPlan);
  }

  async findByCode(code, tenantId) {
    return await this.model.findOne({
      code: code.toUpperCase(),
      tenantId,
    });
  }

  async findActivePlans(tenantId) {
    return await this.model
      .find({ tenantId, status: 'active' })
      .populate('sportId', 'name slug type')
      .populate('courtId', 'name code surface type')
      .populate('courtIds', 'name code surface type')
      .sort({ price: 1 })
      .lean();
  }
}

export class MemberSubscriptionRepository extends BaseRepository {
  constructor() {
    super(MemberSubscription);
  }

  async findActiveUserSubscription(userId, tenantId) {
    return await this.model
      .findOne({
        tenantId,
        userId,
        status: 'active',
        endDate: { $gte: new Date() },
      })
      .populate('planId')
      .populate('sportId', 'name slug')
      .populate('branchId', 'name')
      .populate('courtId', 'name code surface type')
      .populate('courtIds', 'name code surface type')
      .lean();
  }

  async findUserSubscriptions(userId, tenantId) {
    return await this.model
      .find({ tenantId, userId })
      .populate('planId')
      .populate('sportId', 'name slug')
      .populate('branchId', 'name')
      .populate('courtId', 'name code surface type')
      .populate('courtIds', 'name code surface type')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findAllSubscriptions(tenantId) {
    return await this.model
      .find({ tenantId })
      .populate('userId', 'firstName lastName email phone employeeNo cardNo pin')
      .populate('planId', 'name code durationDays price timeSlot courtId courtIds')
      .populate('sportId', 'name slug')
      .populate('branchId', 'name')
      .populate('courtId', 'name code surface type')
      .populate('courtIds', 'name code surface type')
      .sort({ createdAt: -1 })
      .lean();
  }
}

export const membershipPlanRepository = new MembershipPlanRepository();
export const memberSubscriptionRepository = new MemberSubscriptionRepository();
