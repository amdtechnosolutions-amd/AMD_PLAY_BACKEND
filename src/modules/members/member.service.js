import { User } from '../users/user.model.js';
import { MemberSubscription } from '../memberships/memberSubscription.model.js';
import { MembershipPlan } from '../memberships/membershipPlan.model.js';
import { Resource } from '../resources/resource.model.js';
import { membershipService } from '../memberships/membership.service.js';
import { NotFoundError, ValidationError } from '../../errors/AppError.js';
import { ROLES } from '../../config/constants.js';
import { HikvisionService, hikvisionService } from '../iot/hikvision.service.js';
import { Device } from '../iot/device.model.js';

export class MemberService {
  /**
   * Create / Onboard a new Member
   */
  async createMember(data, context = {}) {
    if (data.planId) {
      return await membershipService.registerMember(data, context);
    }

    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    // Direct Member creation without immediate plan
    const email = (data.email || `member_${Date.now()}@amdplay.local`).toLowerCase().trim();
    const phone = (data.phone || '').trim();

    let finalEmployeeNo = (data.employeeNo || '').trim();
    if (!finalEmployeeNo) {
      const existingCount = await User.countDocuments({
        tenantId,
        role: ROLES.MEMBER,
      });
      finalEmployeeNo = `isamem${String(existingCount + 1).padStart(3, '0')}`;
    }

    const pin = (data.pin || String(Math.floor(100000 + Math.random() * 900000))).trim();
    const cardNo = (data.cardNo || pin).trim();

    const user = await User.create({
      tenantId,
      branchId: data.branchId || null,
      firstName: data.firstName.trim(),
      lastName: (data.lastName || '').trim(),
      email,
      phone,
      password: 'Member123!',
      role: ROLES.MEMBER,
      status: 'active',
      employeeNo: finalEmployeeNo,
      cardNo,
    });

    // Sync newly created member to active biometric/access devices
    try {
      const accessDeviceTypes = ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'];
      const targetDevices = await Device.find({
        tenantId,
        $or: [
          { type: { $in: accessDeviceTypes } },
          { code: /ACCESS|BIOMETRIC|HIK/i },
          { name: /ACCESS|BIOMETRIC|FACE|TURF/i },
        ],
      });

      for (const dev of targetDevices) {
        const client = dev.ipAddress
          ? HikvisionService.forDevice({
              ip: dev.ipAddress,
              port: dev.port || (dev.code === 'DEV-ISA-ACCESS' ? 4231 : 80),
              username: dev.username || 'admin',
              password: dev.password || 'Amd@737373',
              protocol: dev.protocol || 'http',
            })
          : hikvisionService;

        try {
          await client.recordPerson({
            employeeNo: user.employeeNo,
            name: `${user.firstName} ${user.lastName || ''}`.trim(),
            role: 'member',
            userType: 'normal',
            pin: user.pin,
            cardNo: user.cardNo,
            planTemplateNo: 1,
          });

          if (user.cardNo) {
            await client.recordCard({
              employeeNo: user.employeeNo,
              cardNo: user.cardNo,
            });
          }
        } catch (devErr) {
          console.warn(`[Member Direct Sync] Device upload warning for ${dev.name}:`, devErr.message);
        }
      }
    } catch (syncErr) {
      console.warn('[Member Direct Sync] Biometric sync warning:', syncErr.message);
    }

    return {
      member: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        email: user.email,
        phone: user.phone,
        role: user.role,
        employeeNo: user.employeeNo,
        cardNo: user.cardNo,
        pin: user.pin,
      },
      subscription: null,
    };
  }

  /**
   * List Members with search, filters, pagination, and active subscriptions
   */
  async listMembers(filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = {
      tenantId,
      role: ROLES.MEMBER,
    };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.branchId) {
      query.branchId = filters.branchId;
    }

    if (filters.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { firstName: regex },
        { lastName: regex },
        { phone: regex },
        { email: regex },
        { employeeNo: regex },
        { cardNo: regex },
        { pin: regex },
      ];
    }

    // Filter by Plan ID if supplied
    if (filters.planId) {
      const activeSubs = await MemberSubscription.find({
        tenantId,
        planId: filters.planId,
        status: 'active',
      }).select('userId');
      const userIds = activeSubs.map((s) => s.userId);
      query._id = { $in: userIds };
    }

    const [items, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query),
    ]);

    // Attach active subscription and court info for each member
    const userIds = items.map((u) => u._id);
    const subscriptions = await MemberSubscription.find({
      tenantId,
      userId: { $in: userIds },
      status: 'active',
    })
      .populate('planId', 'name code durationDays price timeSlot')
      .populate('courtId', 'name code surface type')
      .populate('courtIds', 'name code surface type')
      .populate('sportId', 'name slug')
      .lean();

    const subsByUserId = new Map();
    for (const sub of subscriptions) {
      subsByUserId.set(sub.userId.toString(), sub);
    }

    const enhancedItems = items.map((member) => {
      const sub = subsByUserId.get(member._id.toString()) || null;
      return {
        ...member,
        name: `${member.firstName} ${member.lastName || ''}`.trim(),
        activeSubscription: sub,
        plan: sub?.planId || null,
        court: sub?.courtId || null,
        courtIds: sub?.courtIds || [],
        timeSlot: sub?.timeSlot || null,
        validUntil: sub?.endDate || null,
        hikvisionPlanTemplateNo: sub?.hikvisionPlanTemplateNo || null,
      };
    });

    return {
      items: enhancedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get Member by ID with complete details
   */
  async getMemberById(id, context = {}) {
    const tenantId = context.tenantId;
    const member = await User.findOne({ _id: id, tenantId }).select('-password').lean();
    if (!member) {
      throw new NotFoundError(`Member with ID '${id}' not found`);
    }

    const subscriptions = await MemberSubscription.find({ tenantId, userId: id })
      .populate('planId')
      .populate('courtId', 'name code surface type')
      .populate('courtIds', 'name code surface type')
      .populate('sportId', 'name slug')
      .sort({ createdAt: -1 })
      .lean();

    const activeSub = subscriptions.find((s) => s.status === 'active') || null;

    return {
      ...member,
      name: `${member.firstName} ${member.lastName || ''}`.trim(),
      activeSubscription: activeSub,
      plan: activeSub?.planId || null,
      court: activeSub?.courtId || null,
      subscriptions,
    };
  }

  /**
   * Update Member profile and biometric credentials
   */
  async updateMember(id, data, context = {}) {
    const tenantId = context.tenantId;
    const member = await User.findOne({ _id: id, tenantId });
    if (!member) {
      throw new NotFoundError(`Member with ID '${id}' not found`);
    }

    if (data.firstName !== undefined) member.firstName = data.firstName.trim();
    if (data.lastName !== undefined) member.lastName = data.lastName.trim();
    if (data.phone !== undefined) member.phone = data.phone.trim();
    if (data.email !== undefined) member.email = data.email.toLowerCase().trim();
    if (data.branchId !== undefined) member.branchId = data.branchId;
    if (data.status !== undefined) member.status = data.status;

    let credsChanged = false;
    if (data.employeeNo !== undefined && data.employeeNo !== member.employeeNo) {
      member.employeeNo = data.employeeNo.trim();
      credsChanged = true;
    }
    if (data.pin !== undefined && data.pin !== member.pin) {
      member.pin = data.pin.trim();
      credsChanged = true;
    }
    if (data.cardNo !== undefined && data.cardNo !== member.cardNo) {
      member.cardNo = data.cardNo.trim();
      credsChanged = true;
    }

    await member.save();

    // If credentials updated, re-sync to active biometric devices
    if (credsChanged) {
      try {
        const activeSub = await MemberSubscription.findOne({ tenantId, userId: id, status: 'active' });
        const planTemplateNo = activeSub?.hikvisionPlanTemplateNo || 1;

        const accessDeviceTypes = ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'];
        const targetDevices = await Device.find({
          tenantId,
          $or: [
            { type: { $in: accessDeviceTypes } },
            { code: /ACCESS|BIOMETRIC|HIK/i },
            { name: /ACCESS|BIOMETRIC|FACE|TURF/i },
          ],
        });

        for (const dev of targetDevices) {
          const client = dev.ipAddress
            ? HikvisionService.forDevice({
                ip: dev.ipAddress,
                port: dev.port || (dev.code === 'DEV-ISA-ACCESS' ? 4231 : 80),
                username: dev.username || 'admin',
                password: dev.password || 'Amd@737373',
                protocol: dev.protocol || 'http',
              })
            : hikvisionService;

          await client.recordPerson({
            employeeNo: member.employeeNo,
            name: `${member.firstName} ${member.lastName || ''}`.trim(),
            role: 'member',
            userType: 'normal',
            pin: member.pin,
            cardNo: member.cardNo,
            planTemplateNo,
          });

          if (member.cardNo) {
            await client.recordCard({
              employeeNo: member.employeeNo,
              cardNo: member.cardNo,
            });
          }
        }
      } catch (syncErr) {
        console.warn('[Member Update] Biometric re-sync warning:', syncErr.message);
      }
    }

    return await this.getMemberById(id, context);
  }

  /**
   * Deactivate Member
   */
  async deleteMember(id, context = {}) {
    const tenantId = context.tenantId;
    const member = await User.findOne({ _id: id, tenantId });
    if (!member) {
      throw new NotFoundError(`Member with ID '${id}' not found`);
    }

    member.status = 'inactive';
    await member.save();

    // Cancel active subscriptions
    await MemberSubscription.updateMany({ tenantId, userId: id, status: 'active' }, { status: 'cancelled' });

    return {
      success: true,
      message: `Member '${member.firstName} ${member.lastName || ''}' deactivated successfully`,
    };
  }

  /**
   * Get all subscriptions for a member
   */
  async getMemberSubscriptions(id, context = {}) {
    const tenantId = context.tenantId;
    return await MemberSubscription.find({ tenantId, userId: id })
      .populate('planId')
      .populate('courtId', 'name code surface type')
      .populate('courtIds', 'name code surface type')
      .populate('sportId', 'name slug')
      .sort({ createdAt: -1 });
  }
}

export const memberService = new MemberService();
