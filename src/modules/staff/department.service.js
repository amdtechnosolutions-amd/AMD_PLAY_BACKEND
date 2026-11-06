import mongoose from 'mongoose';
import { Department } from './department.model.js';
import { Designation } from './designation.model.js';
import { User } from '../users/user.model.js';
import { STAFF_ROLES } from './staff.schema.js';
import { NotFoundError, ValidationError, ConflictError } from '../../errors/AppError.js';

export class DepartmentService {
  /**
   * Helper to slugify / generate uppercase code from name
   */
  _generateCode(name) {
    return name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * Pre-seed standard sports academy departments and designations if tenant has none
   */
  async seedDefaultsIfEmpty(tenantId, branchId = null) {
    if (!tenantId) return;

    const count = await Department.countDocuments({ tenantId });
    if (count > 0) return;

    const defaultDepartments = [
      {
        name: 'Coaching & Academy',
        code: 'COACHING',
        description: 'Sports coaching, training batches, and student development',
        order: 1,
        designations: [
          { name: 'Head Coach', code: 'HEAD_COACH', defaultRole: 'coach', order: 1 },
          { name: 'Senior Badminton Coach', code: 'SR_BD_COACH', defaultRole: 'coach', order: 2 },
          { name: 'Assistant Coach', code: 'ASST_COACH', defaultRole: 'coach', order: 3 },
          { name: 'Junior Trainer', code: 'JR_TRAINER', defaultRole: 'trainer', order: 4 },
        ],
      },
      {
        name: 'Front Desk & Reception',
        code: 'FRONT_DESK',
        description: 'Customer inquiries, court reservations, billing, and player assistance',
        order: 2,
        designations: [
          { name: 'Lead Receptionist', code: 'LEAD_RECEPT', defaultRole: 'receptionist', order: 1 },
          { name: 'Front Desk Executive', code: 'FRONT_DESK_EXEC', defaultRole: 'front_desk', order: 2 },
          { name: 'Customer Relations Executive', code: 'CUST_REL_EXEC', defaultRole: 'front_desk', order: 3 },
        ],
      },
      {
        name: 'Operations & Court Management',
        code: 'OPERATIONS',
        description: 'Daily arena operations, slot allocations, and court maintenance',
        order: 3,
        designations: [
          { name: 'Operations Manager', code: 'OPS_MGR', defaultRole: 'manager', order: 1 },
          { name: 'Court Coordinator', code: 'COURT_COORD', defaultRole: 'staff', order: 2 },
          { name: 'Inventory & Equipment In-Charge', code: 'INVENTORY_EXEC', defaultRole: 'staff', order: 3 },
        ],
      },
      {
        name: 'Finance & Accounts',
        code: 'FINANCE',
        description: 'Subscription accounting, fee collections, payroll, and invoicing',
        order: 4,
        designations: [
          { name: 'Senior Accountant', code: 'SR_ACCOUNTANT', defaultRole: 'accountant', order: 1 },
          { name: 'Cashier & Billing Clerk', code: 'CASHIER', defaultRole: 'accountant', order: 2 },
        ],
      },
      {
        name: 'Fitness & Conditioning',
        code: 'FITNESS',
        description: 'Athlete fitness, agility conditioning, and gym training',
        order: 5,
        designations: [
          { name: 'Strength & Conditioning Coach', code: 'STRENGTH_COACH', defaultRole: 'trainer', order: 1 },
          { name: 'Fitness Trainer', code: 'FITNESS_TRAINER', defaultRole: 'trainer', order: 2 },
        ],
      },
      {
        name: 'Facility & Maintenance',
        code: 'MAINTENANCE',
        description: 'Court lighting, synthetic mat maintenance, cleaning, and sanitization',
        order: 6,
        designations: [
          { name: 'Facility Supervisor', code: 'FACILITY_SUPERVISOR', defaultRole: 'maintenance', order: 1 },
          { name: 'Court Maintenance Technician', code: 'COURT_MAINT_TECH', defaultRole: 'maintenance', order: 2 },
        ],
      },
      {
        name: 'Security & Access Control',
        code: 'SECURITY',
        description: 'Gate entry, turnstile monitoring, biometric terminal maintenance',
        order: 7,
        designations: [
          { name: 'Chief Security Officer', code: 'CHIEF_SECURITY', defaultRole: 'security', order: 1 },
          { name: 'Gate Security Guard', code: 'SECURITY_GUARD', defaultRole: 'security', order: 2 },
        ],
      },
      {
        name: 'Management & Administration',
        code: 'MANAGEMENT',
        description: 'Academy directors, branch administration, and franchise management',
        order: 8,
        designations: [
          { name: 'Branch Administrator', code: 'BRANCH_ADMIN', defaultRole: 'branch_admin', order: 1 },
          { name: 'Academy Director', code: 'ACADEMY_DIR', defaultRole: 'manager', order: 2 },
        ],
      },
    ];

    for (const d of defaultDepartments) {
      const dept = await Department.create({
        tenantId,
        branchId,
        name: d.name,
        code: d.code,
        description: d.description,
        order: d.order,
        status: 'active',
      });

      for (const des of d.designations) {
        await Designation.create({
          tenantId,
          branchId,
          departmentId: dept._id,
          name: des.name,
          code: des.code,
          defaultRole: des.defaultRole,
          order: des.order,
          status: 'active',
        });
      }
    }
  }

  // =========================================================================
  // DEPARTMENTS CRUD
  // =========================================================================

  async createDepartment(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const name = (data.name || '').trim();
    if (!name) {
      throw new ValidationError('Department name is required');
    }

    const code = (data.code || this._generateCode(name)).toUpperCase().trim();

    const existing = await Department.findOne({ tenantId, code });
    if (existing) {
      throw new ConflictError(`Department with code '${code}' already exists`);
    }

    return await Department.create({
      tenantId,
      branchId: data.branchId || null,
      name,
      code,
      description: (data.description || '').trim(),
      order: data.order || 0,
      status: data.status || 'active',
    });
  }

  async listDepartments(filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    // Auto seed default departments if none exist for this tenant
    await this.seedDefaultsIfEmpty(tenantId, filters.branchId || null);

    const query = { tenantId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.branchId) {
      query.$or = [{ branchId: filters.branchId }, { branchId: null }];
    }

    if (filters.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [{ name: regex }, { code: regex }, { description: regex }];
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Department.find(query).sort({ order: 1, name: 1 }).skip(skip).limit(limit).lean(),
      Department.countDocuments(query),
    ]);

    // Attach count of designations and staff for each department
    const deptIds = items.map((d) => d._id);

    const [desigCounts, staffCounts] = await Promise.all([
      Designation.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), departmentId: { $in: deptIds }, status: 'active' } },
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
      ]),
      User.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            role: { $in: STAFF_ROLES },
            status: 'active',
            'metadata.departmentId': { $in: deptIds },
          },
        },
        { $group: { _id: '$metadata.departmentId', count: { $sum: 1 } } },
      ]),
    ]);

    const desigMap = new Map();
    for (const d of desigCounts) desigMap.set(d._id.toString(), d.count);

    const staffMap = new Map();
    for (const s of staffCounts) staffMap.set(s._id.toString(), s.count);

    const enhancedItems = items.map((dept) => ({
      ...dept,
      designationCount: desigMap.get(dept._id.toString()) || 0,
      staffCount: staffMap.get(dept._id.toString()) || 0,
    }));

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

  async getDepartmentById(id, context = {}) {
    const tenantId = context.tenantId;
    const department = await Department.findOne({ _id: id, tenantId }).lean();
    if (!department) {
      throw new NotFoundError(`Department with ID '${id}' not found`);
    }

    // Attach designations belonging to this department
    const designations = await Designation.find({ tenantId, departmentId: id, status: 'active' })
      .sort({ order: 1, name: 1 })
      .lean();

    return {
      ...department,
      designations,
    };
  }

  async updateDepartment(id, data, context = {}) {
    const tenantId = context.tenantId;
    const department = await Department.findOne({ _id: id, tenantId });
    if (!department) {
      throw new NotFoundError(`Department with ID '${id}' not found`);
    }

    if (data.name !== undefined) department.name = data.name.trim();
    if (data.description !== undefined) department.description = data.description.trim();
    if (data.status !== undefined) department.status = data.status;
    if (data.order !== undefined) department.order = data.order;
    if (data.branchId !== undefined) department.branchId = data.branchId;

    if (data.code !== undefined && data.code.toUpperCase().trim() !== department.code) {
      const newCode = data.code.toUpperCase().trim();
      const existing = await Department.findOne({ tenantId, code: newCode, _id: { $ne: id } });
      if (existing) {
        throw new ConflictError(`Department code '${newCode}' is already in use`);
      }
      department.code = newCode;
    }

    await department.save();
    return department;
  }

  async deleteDepartment(id, context = {}) {
    const tenantId = context.tenantId;
    const department = await Department.findOne({ _id: id, tenantId });
    if (!department) {
      throw new NotFoundError(`Department with ID '${id}' not found`);
    }

    // Soft delete / toggle inactive
    department.status = 'inactive';
    await department.save();

    // Also deactivate associated designations
    await Designation.updateMany({ tenantId, departmentId: id }, { status: 'inactive' });

    return {
      success: true,
      message: `Department '${department.name}' deactivated successfully`,
    };
  }

  // =========================================================================
  // DESIGNATIONS CRUD
  // =========================================================================

  async createDesignation(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const name = (data.name || '').trim();
    if (!name) {
      throw new ValidationError('Designation name is required');
    }

    const code = (data.code || this._generateCode(name)).toUpperCase().trim();

    const existing = await Designation.findOne({ tenantId, code });
    if (existing) {
      throw new ConflictError(`Designation with code '${code}' already exists`);
    }

    let departmentId = data.departmentId || null;
    if (departmentId) {
      const dept = await Department.findOne({ _id: departmentId, tenantId });
      if (!dept) {
        throw new NotFoundError(`Department with ID '${departmentId}' not found`);
      }
    }

    return await Designation.create({
      tenantId,
      branchId: data.branchId || null,
      departmentId,
      name,
      code,
      description: (data.description || '').trim(),
      defaultRole: data.defaultRole || 'staff',
      order: data.order || 0,
      status: data.status || 'active',
    });
  }

  async listDesignations(filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    // Auto seed default departments and designations if empty
    await this.seedDefaultsIfEmpty(tenantId, filters.branchId || null);

    const query = { tenantId };

    if (filters.departmentId) {
      query.departmentId = filters.departmentId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.defaultRole) {
      query.defaultRole = filters.defaultRole;
    }

    if (filters.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [{ name: regex }, { code: regex }, { description: regex }];
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Designation.find(query)
        .populate('departmentId', 'name code')
        .sort({ order: 1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Designation.countDocuments(query),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDesignationById(id, context = {}) {
    const tenantId = context.tenantId;
    const designation = await Designation.findOne({ _id: id, tenantId })
      .populate('departmentId', 'name code description')
      .lean();

    if (!designation) {
      throw new NotFoundError(`Designation with ID '${id}' not found`);
    }

    return designation;
  }

  async updateDesignation(id, data, context = {}) {
    const tenantId = context.tenantId;
    const designation = await Designation.findOne({ _id: id, tenantId });
    if (!designation) {
      throw new NotFoundError(`Designation with ID '${id}' not found`);
    }

    if (data.name !== undefined) designation.name = data.name.trim();
    if (data.description !== undefined) designation.description = data.description.trim();
    if (data.defaultRole !== undefined) designation.defaultRole = data.defaultRole;
    if (data.status !== undefined) designation.status = data.status;
    if (data.order !== undefined) designation.order = data.order;
    if (data.branchId !== undefined) designation.branchId = data.branchId;

    if (data.departmentId !== undefined) {
      if (data.departmentId) {
        const dept = await Department.findOne({ _id: data.departmentId, tenantId });
        if (!dept) {
          throw new NotFoundError(`Department with ID '${data.departmentId}' not found`);
        }
      }
      designation.departmentId = data.departmentId || null;
    }

    if (data.code !== undefined && data.code.toUpperCase().trim() !== designation.code) {
      const newCode = data.code.toUpperCase().trim();
      const existing = await Designation.findOne({ tenantId, code: newCode, _id: { $ne: id } });
      if (existing) {
        throw new ConflictError(`Designation code '${newCode}' is already in use`);
      }
      designation.code = newCode;
    }

    await designation.save();
    return await this.getDesignationById(id, context);
  }

  async deleteDesignation(id, context = {}) {
    const tenantId = context.tenantId;
    const designation = await Designation.findOne({ _id: id, tenantId });
    if (!designation) {
      throw new NotFoundError(`Designation with ID '${id}' not found`);
    }

    designation.status = 'inactive';
    await designation.save();

    return {
      success: true,
      message: `Designation '${designation.name}' deactivated successfully`,
    };
  }
}

export const departmentService = new DepartmentService();
