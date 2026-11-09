import mongoose from 'mongoose';
import { User } from '../users/user.model.js';
import { Batch } from '../coaching/batch.model.js';
import { Department } from './department.model.js';
import { Designation } from './designation.model.js';
import { departmentService } from './department.service.js';
import { STAFF_ROLES } from './staff.schema.js';
import { ROLES, PERMISSIONS } from '../../config/constants.js';
import { NotFoundError, ValidationError, ConflictError } from '../../errors/AppError.js';
import { HikvisionService, hikvisionService } from '../iot/hikvision.service.js';
import { Device } from '../iot/device.model.js';

export class StaffService {
  /**
   * Return dynamic staff roles, departments, and designations for UI dropdowns
   */
  async getStaffRoles(context = {}) {
    const tenantId = context.tenantId;

    const baseRoles = [
      { role: 'coach', label: 'Coach / Instructor', department: 'Coaching & Academy' },
      { role: 'trainer', label: 'Fitness Trainer', department: 'Fitness & Conditioning' },
      { role: 'receptionist', label: 'Receptionist / Cashier', department: 'Front Desk' },
      { role: 'front_desk', label: 'Front Desk Executive', department: 'Front Desk' },
      { role: 'accountant', label: 'Accountant / Finance', department: 'Finance & Accounts' },
      { role: 'manager', label: 'Operations Manager', department: 'Management' },
      { role: 'branch_admin', label: 'Branch Administrator', department: 'Administration' },
      { role: 'staff', label: 'General Staff', department: 'Operations' },
      { role: 'maintenance', label: 'Court Maintenance', department: 'Facility' },
      { role: 'security', label: 'Security Guard', department: 'Security & Access' },
    ];

    if (!tenantId) {
      return {
        roles: baseRoles,
        departments: [],
        designations: [],
      };
    }

    // Auto-seed default departments and designations if tenant has none
    await departmentService.seedDefaultsIfEmpty(tenantId, context.branchId || null);

    const [departments, designations] = await Promise.all([
      Department.find({ tenantId, status: 'active' }).sort({ order: 1, name: 1 }).lean(),
      Designation.find({ tenantId, status: 'active' }).populate('departmentId', 'name code').sort({ order: 1, name: 1 }).lean(),
    ]);

    return {
      roles: baseRoles,
      departments,
      designations,
    };
  }

  /**
   * Create a new Staff / Coach with dynamic department & designation
   */
  async createStaff(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const role = (data.role || 'staff').toLowerCase();
    if (!STAFF_ROLES.includes(role)) {
      throw new ValidationError(`Invalid staff role '${role}'. Must be one of: ${STAFF_ROLES.join(', ')}`);
    }

    const phone = (data.phone || '').trim();
    if (!phone) {
      throw new ValidationError('Phone number is required');
    }

    const existing = await User.findOne({ tenantId, phone });
    let isUpgradingCustomer = false;
    if (existing) {
      if (existing.role === ROLES.CUSTOMER) {
        isUpgradingCustomer = true;
      } else {
        throw new ConflictError(`User with phone '${phone}' already exists in this academy with role '${existing.role}'`);
      }
    }

    const email = (data.email || `staff_${Date.now()}@amdplay.local`).toLowerCase().trim();

    // Auto-generate employeeNo: e.g. isacoch001 for coaches, isastf001 for general staff
    let finalEmployeeNo = (data.employeeNo || '').trim();
    if (!finalEmployeeNo) {
      const isCoach = role === 'coach' || role === 'trainer';
      const prefix = isCoach ? 'isacoch' : 'isastf';
      const count = await User.countDocuments({
        tenantId,
        role: isCoach ? { $in: ['coach', 'trainer'] } : { $in: STAFF_ROLES.filter((r) => r !== 'coach' && r !== 'trainer') },
      });
      finalEmployeeNo = `${prefix}${String(count + 1).padStart(3, '0')}`;
    }

    const pin = (data.pin || String(Math.floor(100000 + Math.random() * 900000))).trim();
    const cardNo = (data.cardNo || pin).trim();

    // Default permissions based on role
    let permissions = Array.isArray(data.permissions) ? data.permissions : [];
    if (permissions.length === 0) {
      if (role === 'coach' || role === 'trainer') {
        permissions = [
          PERMISSIONS.ATTENDANCE_MARK,
          PERMISSIONS.ATTENDANCE_VIEW,
          PERMISSIONS.STUDENT_VIEW,
        ];
      } else if (role === 'receptionist' || role === 'front_desk') {
        permissions = [
          PERMISSIONS.BOOKING_CREATE,
          PERMISSIONS.BOOKING_VIEW,
          PERMISSIONS.STUDENT_CREATE,
          PERMISSIONS.STUDENT_VIEW,
          PERMISSIONS.PAYMENT_CREATE,
        ];
      } else if (role === 'manager' || role === 'branch_admin') {
        permissions = Object.values(PERMISSIONS);
      }
    }

    // Resolve dynamic Department and Designation
    let resolvedDepartment = (data.department || '').trim();
    let resolvedDesignation = (data.designation || '').trim();
    let departmentId = data.departmentId ? new mongoose.Types.ObjectId(data.departmentId) : null;
    let designationId = data.designationId ? new mongoose.Types.ObjectId(data.designationId) : null;

    if (designationId) {
      const desig = await Designation.findOne({ _id: designationId, tenantId });
      if (desig) {
        resolvedDesignation = desig.name;
        if (!departmentId && desig.departmentId) {
          departmentId = desig.departmentId;
        }
      }
    }

    if (departmentId) {
      const dept = await Department.findOne({ _id: departmentId, tenantId });
      if (dept) {
        resolvedDepartment = dept.name;
      }
    }

    if (!resolvedDepartment) {
      resolvedDepartment = role === 'coach' ? 'Coaching & Academy' : 'Operations & Court Management';
    }

    let user;
    if (isUpgradingCustomer && existing) {
      existing.role = role;
      existing.firstName = data.firstName.trim();
      if (data.lastName !== undefined) existing.lastName = data.lastName.trim();
      if (data.email && data.email.trim()) existing.email = data.email.toLowerCase().trim();
      if (data.branchId) existing.branchId = data.branchId;
      existing.permissions = permissions;
      if (!existing.employeeNo) existing.employeeNo = finalEmployeeNo;
      if (pin && !existing.pin) existing.pin = pin;
      if (cardNo && !existing.cardNo) existing.cardNo = cardNo;
      existing.metadata = {
        ...(existing.metadata || {}),
        departmentId,
        designationId,
        department: resolvedDepartment,
        designation: resolvedDesignation,
        salary: data.salary || 0,
        joiningDate: data.joiningDate || new Date().toISOString().split('T')[0],
        sportIds: data.sportIds || [],
        notes: data.notes || '',
      };
      await existing.save();
      user = existing;
    } else {
      user = await User.create({
        tenantId,
        branchId: data.branchId || null,
        firstName: data.firstName.trim(),
        lastName: (data.lastName || '').trim(),
        email,
        phone,
        password: 'StaffPassword123!',
        role,
        permissions,
        status: 'active',
        employeeNo: finalEmployeeNo,
        pin,
        cardNo,
        metadata: {
          departmentId,
          designationId,
          department: resolvedDepartment,
          designation: resolvedDesignation,
          salary: data.salary || 0,
          joiningDate: data.joiningDate || new Date().toISOString().split('T')[0],
          sportIds: data.sportIds || [],
          notes: data.notes || '',
        },
      });
    }

    // Sync credentials to biometric access control devices
    try {
      const targetDevices = await Device.find({
        tenantId,
        type: { $in: ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'] },
      });

      for (const dev of targetDevices) {
        const client = dev.ipAddress
          ? HikvisionService.forDevice({
              ip: dev.ipAddress,
              port: dev.port || 80,
              username: dev.username || 'admin',
              password: dev.password || '',
              protocol: dev.protocol || 'http',
            })
          : hikvisionService;

        await client.recordPerson({
          employeeNo: user.employeeNo,
          name: `${user.firstName} ${user.lastName || ''}`.trim(),
          role: user.role,
          userType: 'normal',
          pin: user.pin,
        });

        if (user.cardNo) {
          await client.recordCard({
            employeeNo: user.employeeNo,
            cardNo: user.cardNo,
          });
        }
      }
    } catch (syncErr) {
      console.warn('[Staff Create] Biometric push warning:', syncErr.message);
    }

    return {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
      email: user.email,
      phone: user.phone,
      role: user.role,
      departmentId: user.metadata?.departmentId || null,
      designationId: user.metadata?.designationId || null,
      department: user.metadata?.department || '',
      designation: user.metadata?.designation || '',
      employeeNo: user.employeeNo,
      pin: user.pin,
      cardNo: user.cardNo,
      status: user.status,
      permissions: user.permissions,
      createdAt: user.createdAt,
    };
  }

  /**
   * List Staff with filtering by dynamic departmentId/designationId, coach batch stats, and pagination
   */
  async listStaff(filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = {
      tenantId,
      role: filters.role ? filters.role : { $in: STAFF_ROLES },
    };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.branchId) {
      query.branchId = filters.branchId;
    }

    if (filters.departmentId) {
      query['metadata.departmentId'] = new mongoose.Types.ObjectId(filters.departmentId);
    } else if (filters.department) {
      query['metadata.department'] = filters.department;
    }

    if (filters.designationId) {
      query['metadata.designationId'] = new mongoose.Types.ObjectId(filters.designationId);
    } else if (filters.designation) {
      query['metadata.designation'] = filters.designation;
    }

    if (filters.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { firstName: regex },
        { lastName: regex },
        { phone: regex },
        { email: regex },
        { employeeNo: regex },
        { 'metadata.department': regex },
        { 'metadata.designation': regex },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .populate('branchId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    // For coaches, attach assigned batch count
    const coachIds = items.filter((u) => u.role === 'coach' || u.role === 'trainer').map((u) => u._id);
    const batchCounts = coachIds.length
      ? await Batch.aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              coachId: { $in: coachIds },
              status: 'active',
            },
          },
          {
            $group: {
              _id: '$coachId',
              assignedBatchesCount: { $sum: 1 },
              totalStudentsCount: { $sum: '$enrolledCount' },
            },
          },
        ])
      : [];

    const batchMap = new Map();
    for (const b of batchCounts) {
      batchMap.set(b._id.toString(), b);
    }

    // Resolve dynamic Department and Designation details
    const deptIds = items.map((u) => u.metadata?.departmentId).filter(Boolean);
    const desigIds = items.map((u) => u.metadata?.designationId).filter(Boolean);

    const [deptDocs, desigDocs] = await Promise.all([
      deptIds.length ? Department.find({ _id: { $in: deptIds } }).lean() : [],
      desigIds.length ? Designation.find({ _id: { $in: desigIds } }).lean() : [],
    ]);

    const deptMap = new Map();
    for (const d of deptDocs) deptMap.set(d._id.toString(), d);

    const desigMap = new Map();
    for (const d of desigDocs) desigMap.set(d._id.toString(), d);

    const enhancedItems = items.map((staff) => {
      const coachStats = batchMap.get(staff._id.toString()) || {
        assignedBatchesCount: 0,
        totalStudentsCount: 0,
      };

      const deptIdStr = staff.metadata?.departmentId?.toString();
      const desigIdStr = staff.metadata?.designationId?.toString();

      const deptObj = deptIdStr ? deptMap.get(deptIdStr) || null : null;
      const desigObj = desigIdStr ? desigMap.get(desigIdStr) || null : null;

      return {
        ...staff,
        name: `${staff.firstName} ${staff.lastName || ''}`.trim(),
        departmentId: staff.metadata?.departmentId || null,
        designationId: staff.metadata?.designationId || null,
        department: deptObj ? deptObj.name : (staff.metadata?.department || ''),
        designation: desigObj ? desigObj.name : (staff.metadata?.designation || ''),
        departmentDetails: deptObj,
        designationDetails: desigObj,
        salary: staff.metadata?.salary || 0,
        assignedBatchesCount: coachStats.assignedBatchesCount,
        totalStudentsCount: coachStats.totalStudentsCount,
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
   * Get Staff member by ID with dynamic department/designation and assigned batches
   */
  async getStaffById(id, context = {}) {
    const tenantId = context.tenantId;
    const staff = await User.findOne({ _id: id, tenantId, role: { $in: STAFF_ROLES } })
      .select('-password')
      .populate('branchId', 'name code')
      .lean();

    if (!staff) {
      throw new NotFoundError(`Staff member with ID '${id}' not found`);
    }

    let assignedBatches = [];
    if (staff.role === 'coach' || staff.role === 'trainer') {
      assignedBatches = await Batch.find({ tenantId, coachId: id })
        .populate('sportId', 'name slug')
        .populate('resourceId', 'name code surface')
        .populate('courtId', 'name code surface')
        .lean();
    }

    let departmentDetails = null;
    if (staff.metadata?.departmentId) {
      departmentDetails = await Department.findOne({ _id: staff.metadata.departmentId, tenantId }).lean();
    }

    let designationDetails = null;
    if (staff.metadata?.designationId) {
      designationDetails = await Designation.findOne({ _id: staff.metadata.designationId, tenantId }).lean();
    }

    return {
      ...staff,
      name: `${staff.firstName} ${staff.lastName || ''}`.trim(),
      departmentId: staff.metadata?.departmentId || null,
      designationId: staff.metadata?.designationId || null,
      department: departmentDetails ? departmentDetails.name : (staff.metadata?.department || ''),
      designation: designationDetails ? designationDetails.name : (staff.metadata?.designation || ''),
      departmentDetails,
      designationDetails,
      salary: staff.metadata?.salary || 0,
      joiningDate: staff.metadata?.joiningDate || null,
      assignedBatches,
    };
  }

  /**
   * Update Staff profile and dynamic credentials
   */
  async updateStaff(id, data, context = {}) {
    const tenantId = context.tenantId;
    const staff = await User.findOne({ _id: id, tenantId, role: { $in: STAFF_ROLES } });
    if (!staff) {
      throw new NotFoundError(`Staff member with ID '${id}' not found`);
    }

    if (data.firstName !== undefined) staff.firstName = data.firstName.trim();
    if (data.lastName !== undefined) staff.lastName = data.lastName.trim();
    if (data.phone !== undefined) staff.phone = data.phone.trim();
    if (data.email !== undefined) staff.email = data.email.toLowerCase().trim();
    if (data.role !== undefined) {
      if (!STAFF_ROLES.includes(data.role)) {
        throw new ValidationError(`Invalid staff role '${data.role}'`);
      }
      staff.role = data.role;
    }
    if (data.branchId !== undefined) staff.branchId = data.branchId;
    if (data.status !== undefined) staff.status = data.status;
    if (Array.isArray(data.permissions)) staff.permissions = data.permissions;

    let credsChanged = false;
    if (data.employeeNo !== undefined && data.employeeNo !== staff.employeeNo) {
      staff.employeeNo = data.employeeNo.trim();
      credsChanged = true;
    }
    if (data.pin !== undefined && data.pin !== staff.pin) {
      staff.pin = data.pin.trim();
      credsChanged = true;
    }
    if (data.cardNo !== undefined && data.cardNo !== staff.cardNo) {
      staff.cardNo = data.cardNo.trim();
      credsChanged = true;
    }

    const metadata = staff.metadata || {};

    if (data.designationId !== undefined) {
      if (data.designationId) {
        const desig = await Designation.findOne({ _id: data.designationId, tenantId });
        if (desig) {
          metadata.designationId = desig._id;
          metadata.designation = desig.name;
          if (!data.departmentId && desig.departmentId) {
            metadata.departmentId = desig.departmentId;
            const dept = await Department.findOne({ _id: desig.departmentId, tenantId });
            if (dept) metadata.department = dept.name;
          }
        }
      } else {
        metadata.designationId = null;
      }
    } else if (data.designation !== undefined) {
      metadata.designation = data.designation;
    }

    if (data.departmentId !== undefined) {
      if (data.departmentId) {
        const dept = await Department.findOne({ _id: data.departmentId, tenantId });
        if (dept) {
          metadata.departmentId = dept._id;
          metadata.department = dept.name;
        }
      } else {
        metadata.departmentId = null;
      }
    } else if (data.department !== undefined) {
      metadata.department = data.department;
    }

    if (data.salary !== undefined) metadata.salary = data.salary;
    if (data.sportIds !== undefined) metadata.sportIds = data.sportIds;
    if (data.notes !== undefined) metadata.notes = data.notes;
    staff.metadata = metadata;

    await staff.save();

    // Re-sync to biometric devices if credentials changed
    if (credsChanged) {
      try {
        const targetDevices = await Device.find({
          tenantId,
          type: { $in: ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'] },
        });

        for (const dev of targetDevices) {
          const client = dev.ipAddress
            ? HikvisionService.forDevice({
                ip: dev.ipAddress,
                port: dev.port || 80,
                username: dev.username || 'admin',
                password: dev.password || '',
                protocol: dev.protocol || 'http',
              })
            : hikvisionService;

          await client.recordPerson({
            employeeNo: staff.employeeNo,
            name: `${staff.firstName} ${staff.lastName || ''}`.trim(),
            role: staff.role,
            userType: 'normal',
            pin: staff.pin,
          });

          if (staff.cardNo) {
            await client.recordCard({
              employeeNo: staff.employeeNo,
              cardNo: staff.cardNo,
            });
          }
        }
      } catch (syncErr) {
        console.warn('[Staff Update] Biometric re-sync warning:', syncErr.message);
      }
    }

    return await this.getStaffById(id, context);
  }

  /**
   * Deactivate Staff member
   */
  async deleteStaff(id, context = {}) {
    const tenantId = context.tenantId;
    const staff = await User.findOne({ _id: id, tenantId, role: { $in: STAFF_ROLES } });
    if (!staff) {
      throw new NotFoundError(`Staff member with ID '${id}' not found`);
    }

    staff.status = 'inactive';
    await staff.save();

    return {
      success: true,
      message: `Staff member '${staff.firstName} ${staff.lastName || ''}' deactivated successfully`,
    };
  }

  /**
   * Get batches assigned to a coach
   */
  async getStaffBatches(id, context = {}) {
    const tenantId = context.tenantId;
    return await Batch.find({ tenantId, coachId: id })
      .populate('sportId', 'name slug')
      .populate('resourceId', 'name code surface')
      .populate('courtId', 'name code surface')
      .sort({ createdAt: -1 })
      .lean();
  }
}

export const staffService = new StaffService();
