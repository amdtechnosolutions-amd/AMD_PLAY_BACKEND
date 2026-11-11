import mongoose from 'mongoose';
import { User } from '../users/user.model.js';
import { Enrollment } from '../coaching/enrollment.model.js';
import { Batch } from '../coaching/batch.model.js';
import { ROLES } from '../../config/constants.js';
import { NotFoundError, ValidationError } from '../../errors/AppError.js';

export class SiblingService {
  /**
   * Helper to format student profile summary for sibling listings
   */
  _formatStudentSummary(student, batchMap = new Map()) {
    const sId = student._id.toString();
    const batchInfo = batchMap.get(sId);

    return {
      id: student._id,
      studentId: student._id,
      firstName: student.firstName,
      lastName: student.lastName || '',
      fullName: `${student.firstName} ${student.lastName || ''}`.trim(),
      phone: student.phone || '',
      email: student.email || '',
      employeeNo: student.employeeNo || '',
      regNo: student.employeeNo || '',
      cardNo: student.cardNo || '',
      pin: student.pin || '',
      siblingGroupId: student.siblingGroupId || student.metadata?.siblingGroupId || null,
      parentName: student.metadata?.parentName || '',
      parentPhone: student.metadata?.parentPhone || student.phone || '',
      batch: batchInfo || null,
      batchId: batchInfo?._id || null,
      batchName: batchInfo?.name || '',
      status: student.status,
    };
  }

  /**
   * Helper to build sibling match criteria for a student
   */
  _buildSiblingCriteria(student) {
    const criteria = [];
    if (student.siblingGroupId) {
      criteria.push({ siblingGroupId: student.siblingGroupId });
    }
    if (student.metadata?.siblingGroupId && mongoose.Types.ObjectId.isValid(student.metadata.siblingGroupId)) {
      criteria.push({ siblingGroupId: new mongoose.Types.ObjectId(student.metadata.siblingGroupId) });
      criteria.push({ 'metadata.siblingGroupId': student.metadata.siblingGroupId });
    }
    if (student.phone) {
      criteria.push({ phone: student.phone });
      criteria.push({ 'metadata.parentPhone': student.phone });
    }
    if (student.metadata?.parentPhone) {
      criteria.push({ phone: student.metadata.parentPhone });
      criteria.push({ 'metadata.parentPhone': student.metadata.parentPhone });
    }
    return criteria;
  }

  /**
   * List all sibling groups/families in the academy with pagination & search
   */
  async listSiblingGroups(filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit) || 20;
    const skip = (page - 1) * limit;

    const query = { tenantId, role: ROLES.STUDENT, status: 'active' };
    if (filters.branchId && mongoose.Types.ObjectId.isValid(filters.branchId)) {
      query.branchId = filters.branchId;
    }

    const students = await User.find(query).select('-password').lean();

    // Map active enrollments to students
    const enrollments = await Enrollment.find({ tenantId, status: 'active' })
      .populate('batchId', 'name code level schedule')
      .lean();

    const batchMap = new Map();
    for (const e of enrollments) {
      if (e.studentId && e.batchId) {
        batchMap.set(e.studentId.toString(), e.batchId);
      }
    }

    // Build clusters of connected sibling students
    const studentById = new Map(students.map((s) => [s._id.toString(), s]));
    const visited = new Set();
    let siblingGroups = [];

    for (const student of students) {
      const sId = student._id.toString();
      if (visited.has(sId)) continue;

      // Find all students connected by siblingGroupId, phone, or parentPhone
      const groupMembers = [];
      const queue = [student];
      visited.add(sId);

      while (queue.length > 0) {
        const current = queue.shift();
        groupMembers.push(current);

        const criteria = this._buildSiblingCriteria(current);
        if (criteria.length > 0) {
          for (const other of students) {
            const oId = other._id.toString();
            if (!visited.has(oId)) {
              const isMatch = criteria.some((c) => {
                if (c.siblingGroupId && other.siblingGroupId) {
                  return c.siblingGroupId.toString() === other.siblingGroupId.toString();
                }
                if (c['metadata.siblingGroupId'] && other.metadata?.siblingGroupId) {
                  return c['metadata.siblingGroupId'] === other.metadata.siblingGroupId;
                }
                if (c.phone && other.phone) {
                  return c.phone === other.phone;
                }
                if (c['metadata.parentPhone'] && other.metadata?.parentPhone) {
                  return c['metadata.parentPhone'] === other.metadata.parentPhone;
                }
                if (c.phone && other.metadata?.parentPhone) {
                  return c.phone === other.metadata.parentPhone;
                }
                if (c['metadata.parentPhone'] && other.phone) {
                  return c['metadata.parentPhone'] === other.phone;
                }
                return false;
              });

              if (isMatch) {
                visited.add(oId);
                queue.push(other);
              }
            }
          }
        }
      }

      // Only groups with >= 2 students count as sibling family groups
      if (groupMembers.length >= 2) {
        const existingGroupId =
          groupMembers.find((m) => m.siblingGroupId)?.siblingGroupId?.toString() ||
          groupMembers.find((m) => m.metadata?.siblingGroupId)?.metadata?.siblingGroupId ||
          groupMembers[0]._id.toString();

        const familyPhone =
          groupMembers.find((m) => m.metadata?.parentPhone)?.metadata?.parentPhone ||
          groupMembers[0].phone ||
          '';

        const parentName =
          groupMembers.find((m) => m.metadata?.parentName)?.metadata?.parentName || '';

        siblingGroups.push({
          siblingGroupId: existingGroupId,
          familyPhone,
          parentName,
          studentCount: groupMembers.length,
          students: groupMembers.map((m) => this._formatStudentSummary(m, batchMap)),
        });
      }
    }

    // Filter by search keyword if provided
    if (filters.search || filters.q) {
      const q = String(filters.search || filters.q).toLowerCase().trim();
      siblingGroups = siblingGroups.filter((g) => {
        if (g.familyPhone.includes(q)) return true;
        if (g.parentName.toLowerCase().includes(q)) return true;
        return g.students.some(
          (st) =>
            st.fullName.toLowerCase().includes(q) ||
            st.employeeNo.toLowerCase().includes(q) ||
            st.phone.includes(q)
        );
      });
    }

    const total = siblingGroups.length;
    const paginatedGroups = siblingGroups.slice(skip, skip + limit);

    return {
      items: paginatedGroups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get full sibling profile details for a specific student
   */
  async getStudentSiblings(studentId, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const student = await User.findOne({ _id: studentId, tenantId }).select('-password').lean();
    if (!student) {
      throw new NotFoundError(`Student with ID '${studentId}' not found`);
    }

    const criteria = this._buildSiblingCriteria(student);
    let siblingDocs = [];
    if (criteria.length > 0) {
      siblingDocs = await User.find({
        tenantId,
        _id: { $ne: student._id },
        role: ROLES.STUDENT,
        $or: criteria,
      })
        .select('-password')
        .lean();
    }

    // Populate active batch details for all siblings
    const allIds = [student._id, ...siblingDocs.map((s) => s._id)];
    const enrollments = await Enrollment.find({
      tenantId,
      studentId: { $in: allIds },
      status: 'active',
    })
      .populate('batchId', 'name code level schedule')
      .lean();

    const batchMap = new Map();
    for (const e of enrollments) {
      if (e.studentId && e.batchId) {
        batchMap.set(e.studentId.toString(), e.batchId);
      }
    }

    const siblings = siblingDocs.map((s) => this._formatStudentSummary(s, batchMap));
    const selfFormatted = this._formatStudentSummary(student, batchMap);

    const familyGroupId =
      student.siblingGroupId?.toString() ||
      student.metadata?.siblingGroupId ||
      siblingDocs.find((s) => s.siblingGroupId)?.siblingGroupId?.toString() ||
      null;

    const familyPhone =
      student.metadata?.parentPhone ||
      student.phone ||
      siblingDocs.find((s) => s.metadata?.parentPhone)?.metadata?.parentPhone ||
      siblingDocs[0]?.phone ||
      '';

    const parentName =
      student.metadata?.parentName ||
      siblingDocs.find((s) => s.metadata?.parentName)?.metadata?.parentName ||
      '';

    return {
      student: selfFormatted,
      hasSiblings: siblings.length > 0,
      siblingCount: siblings.length,
      siblingGroupId: familyGroupId,
      familyPhone,
      parentName,
      siblings,
    };
  }

  /**
   * Link two or more students as siblings (even if they have different mobile numbers)
   */
  async linkSiblings(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const studentIds = [];
    if (data.studentId) studentIds.push(data.studentId);
    if (data.siblingStudentId) studentIds.push(data.siblingStudentId);
    if (Array.isArray(data.studentIds)) {
      studentIds.push(...data.studentIds);
    }

    const uniqueIds = [...new Set(studentIds.filter((id) => mongoose.Types.ObjectId.isValid(id)))];
    if (uniqueIds.length < 2) {
      throw new ValidationError('At least 2 valid student IDs are required to establish a sibling relationship');
    }

    const students = await User.find({
      _id: { $in: uniqueIds },
      tenantId,
    });

    if (students.length < 2) {
      throw new NotFoundError('One or more students not found in this academy');
    }

    // Determine target siblingGroupId: reuse existing if any student already has one, or generate new
    let targetGroupId = students.find((s) => s.siblingGroupId)?.siblingGroupId;
    if (!targetGroupId) {
      targetGroupId = new mongoose.Types.ObjectId();
    }

    const familyPhone =
      data.familyPhone ||
      data.parentPhone ||
      students.find((s) => s.metadata?.parentPhone)?.metadata?.parentPhone ||
      students[0].phone ||
      '';

    const parentName =
      data.parentName ||
      students.find((s) => s.metadata?.parentName)?.metadata?.parentName ||
      '';

    // Update all target students to share the common siblingGroupId
    await Promise.all(
      students.map(async (student) => {
        student.siblingGroupId = targetGroupId;
        student.metadata = student.metadata || {};
        student.metadata.siblingGroupId = targetGroupId.toString();
        student.metadata.isSibling = true;
        if (parentName) student.metadata.parentName = parentName;
        if (familyPhone && !student.metadata.parentPhone) student.metadata.parentPhone = familyPhone;
        await student.save();
      })
    );

    return await this.getStudentSiblings(uniqueIds[0], context);
  }

  /**
   * Assign or update a different mobile number for a sibling student while keeping them in the family group
   */
  async assignSiblingPhone(studentId, data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new ValidationError('Valid student ID is required');
    }

    const student = await User.findOne({ _id: studentId, tenantId });
    if (!student) {
      throw new NotFoundError(`Student with ID '${studentId}' not found`);
    }

    const newPhone = (data.phone || '').trim();
    if (!newPhone) {
      throw new ValidationError('New mobile number is required');
    }

    const oldPhone = student.phone;
    const parentPhone = (data.parentPhone || student.metadata?.parentPhone || oldPhone || '').trim();
    const parentName = (data.parentName || student.metadata?.parentName || '').trim();

    // Ensure student already belongs to a sibling group before phone change
    if (!student.siblingGroupId) {
      // Find other siblings who currently share student's old phone or parentPhone
      const existingSiblings = await User.find({
        tenantId,
        _id: { $ne: student._id },
        role: ROLES.STUDENT,
        $or: [
          ...(oldPhone ? [{ phone: oldPhone }, { 'metadata.parentPhone': oldPhone }] : []),
          ...(parentPhone ? [{ phone: parentPhone }, { 'metadata.parentPhone': parentPhone }] : []),
        ],
      });

      const groupId =
        existingSiblings.find((s) => s.siblingGroupId)?.siblingGroupId ||
        new mongoose.Types.ObjectId();

      student.siblingGroupId = groupId;
      student.metadata = student.metadata || {};
      student.metadata.siblingGroupId = groupId.toString();
      student.metadata.isSibling = true;

      // Ensure all related siblings have this group ID set
      await Promise.all(
        existingSiblings.map(async (sib) => {
          if (!sib.siblingGroupId) {
            sib.siblingGroupId = groupId;
            sib.metadata = sib.metadata || {};
            sib.metadata.siblingGroupId = groupId.toString();
            sib.metadata.isSibling = true;
            if (parentPhone && !sib.metadata.parentPhone) sib.metadata.parentPhone = parentPhone;
            if (parentName && !sib.metadata.parentName) sib.metadata.parentName = parentName;
            await sib.save();
          }
        })
      );
    }

    // Update the student's mobile number
    student.phone = newPhone;
    student.metadata = student.metadata || {};
    if (parentPhone) student.metadata.parentPhone = parentPhone;
    if (parentName) student.metadata.parentName = parentName;

    await student.save();

    return await this.getStudentSiblings(student._id, context);
  }

  /**
   * Unlink a student from their sibling group
   */
  async unlinkSibling(studentId, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const student = await User.findOne({ _id: studentId, tenantId });
    if (!student) {
      throw new NotFoundError(`Student with ID '${studentId}' not found`);
    }

    const oldGroupId = student.siblingGroupId;
    student.siblingGroupId = null;
    if (student.metadata) {
      delete student.metadata.siblingGroupId;
      student.metadata.isSibling = false;
    }
    await student.save();

    // If only 1 student remains in that group, reset sibling status for that single student
    if (oldGroupId) {
      const remaining = await User.find({ tenantId, siblingGroupId: oldGroupId });
      if (remaining.length <= 1) {
        for (const rem of remaining) {
          rem.siblingGroupId = null;
          if (rem.metadata) {
            delete rem.metadata.siblingGroupId;
            rem.metadata.isSibling = false;
          }
          await rem.save();
        }
      }
    }

    return {
      success: true,
      message: 'Student unlinked from sibling group successfully',
      studentId: student._id,
    };
  }
}

export const siblingService = new SiblingService();
