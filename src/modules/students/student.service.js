import mongoose from 'mongoose';
import { User } from '../users/user.model.js';
import { Enrollment } from '../coaching/enrollment.model.js';
import { Attendance } from '../coaching/attendance.model.js';
import { AttendancePunchLog } from '../coaching/attendance-punch-log.model.js';
import { MonthlyFee } from '../finance/monthly-fee.model.js';
import { Payment } from '../finance/payment.model.js';
import { Evaluation } from '../coaching/evaluation.model.js';
import { Skill } from '../skills/skill.model.js';
import { coachingService } from '../coaching/coaching.service.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../../errors/AppError.js';
import { ROLES } from '../../config/constants.js';

export class StudentService {
  /**
   * Register a new student and enroll in batch
   */
  async createStudent(data, context = {}) {
    return await coachingService.registerStudent(data, context);
  }

  /**
   * Universal Student Dropdown with optional batchId filter
   */
  async getStudentsDropdown(filters = {}, context = {}) {
    if (filters.batchId) {
      const res = await coachingService.getBatchStudentsDropdown(filters.batchId, filters, context);
      return res.items;
    }

    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const query = { tenantId, role: ROLES.STUDENT, status: filters.status || 'active' };
    if (filters.branchId) query.branchId = filters.branchId;

    const [students, skills, enrollments] = await Promise.all([
      User.find(query)
        .select('firstName lastName phone email employeeNo cardNo status metadata')
        .sort({ firstName: 1 })
        .lean(),
      Skill.find({}).lean().catch(() => []),
      Enrollment.find({ tenantId, status: 'active' }).populate('batchId', 'name code').lean().catch(() => []),
    ]);

    const skillMap = new Map(skills.map((s) => [s._id.toString(), s.name]));
    const batchMap = new Map();
    for (const e of enrollments) {
      if (e.studentId && e.batchId) {
        batchMap.set(e.studentId.toString(), {
          batchId: e.batchId._id.toString(),
          batchName: e.batchId.name,
          batchCode: e.batchId.code || '',
        });
      }
    }

    let items = students.map((s) => {
      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim();
      const code = s.employeeNo || s.email || s.phone || '';
      const rawSkill = s.metadata?.skillLevel || '';
      const skillName = skillMap.get(rawSkill?.toString()) || rawSkill || 'Beginner';
      const bInfo = batchMap.get(s._id.toString()) || {};

      return {
        id: s._id.toString(),
        value: s._id.toString(),
        label: `${fullName} (${code})`.trim(),
        name: fullName,
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        employeeNo: s.employeeNo || '',
        regNo: s.employeeNo || '',
        phone: s.phone || '',
        email: s.email || '',
        cardNo: s.cardNo || '',
        gender: s.metadata?.gender || '',
        skillLevel: skillName,
        parentName: s.metadata?.parentName || '',
        parentPhone: s.metadata?.parentPhone || '',
        batchId: bInfo.batchId || null,
        batchName: bInfo.batchName || '',
        status: s.status,
      };
    });

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      items = items.filter(
        (st) =>
          st.name.toLowerCase().includes(q) ||
          st.employeeNo.toLowerCase().includes(q) ||
          st.phone.includes(q)
      );
    }

    return items;
  }

  /**
   * List all students with search and pagination
   */
  async listStudents(filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = { tenantId, role: ROLES.STUDENT };

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
      ];
    }

    // Filter by batch enrollment if batchId provided
    if (filters.batchId) {
      const enrollments = await Enrollment.find({
        tenantId,
        batchId: filters.batchId,
        status: 'active',
      }).select('studentId');
      const studentIds = enrollments.map((e) => e.studentId);
      query._id = { $in: studentIds };
    }

    const [items, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query),
    ]);

    // Attach active enrollment details for each student
    const studentIds = items.map((u) => u._id);
    const activeEnrollments = studentIds.length
      ? await Enrollment.find({
          tenantId,
          studentId: { $in: studentIds },
          status: 'active',
        }).populate('batchId').lean()
      : [];

    const enrollmentMap = new Map();
    for (const enr of activeEnrollments) {
      const sId = enr.studentId.toString();
      if (!enrollmentMap.has(sId)) enrollmentMap.set(sId, []);
      enrollmentMap.get(sId).push(enr);
    }

    const studentsWithBatches = items.map((s) => ({
      ...s,
      enrollments: enrollmentMap.get(s._id.toString()) || [],
    }));

    return {
      items: studentsWithBatches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single student profile with enrollments, fees, and attendance
   */
  async getStudentById(id, context = {}) {
    const tenantId = context.tenantId;
    const [student, enrollments, monthlyFees, recentPunches, latestEvaluation] = await Promise.all([
      User.findOne({ _id: id, tenantId, role: ROLES.STUDENT }).select('-password').lean(),
      Enrollment.find({ tenantId, studentId: id }).populate('batchId').lean(),
      MonthlyFee.find({ tenantId, studentId: id }).sort({ year: -1, month: -1 }).limit(12).lean(),
      AttendancePunchLog.find({ tenantId, studentId: id }).sort({ punchTime: -1 }).limit(10).lean(),
      Evaluation.findOne({ tenantId, studentId: id, status: 'published' })
        .populate('coachId', 'firstName lastName')
        .sort({ evaluationDate: -1 })
        .lean(),
    ]);

    if (!student) {
      throw new NotFoundError(`Student with ID '${id}' not found`);
    }

    return {
      ...student,
      enrollments,
      monthlyFees,
      recentPunches,
      latestEvaluation,
    };
  }

  /**
   * Update student profile
   */
  async updateStudent(id, updateData, context = {}) {
    const tenantId = context.tenantId;
    const student = await User.findOne({ _id: id, tenantId, role: ROLES.STUDENT });
    if (!student) {
      throw new NotFoundError(`Student with ID '${id}' not found`);
    }

    const allowedFields = [
      'firstName', 'lastName', 'phone', 'email', 'status',
      'employeeNo', 'cardNo', 'pin', 'branchId',
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        student[field] = updateData[field];
      }
    }

    student.metadata = student.metadata || {};
    if (updateData.parentName) student.metadata.parentName = updateData.parentName;
    if (updateData.parentPhone) student.metadata.parentPhone = updateData.parentPhone;
    if (updateData.skillLevel) student.metadata.skillLevel = updateData.skillLevel;

    await student.save();

    // Update enrollment monthlyFee override if provided
    if (updateData.monthlyFee !== undefined || updateData.customDiscount !== undefined) {
      const enr = await Enrollment.findOne({ tenantId, studentId: id, status: 'active' });
      if (enr) {
        if (updateData.monthlyFee !== undefined) enr.monthlyFee = updateData.monthlyFee;
        if (updateData.customDiscount !== undefined) enr.customDiscount = updateData.customDiscount;
        await enr.save();
      }
    }

    const res = student.toObject();
    delete res.password;
    return res;
  }

  /**
   * Deactivate / Delete student
   */
  async deleteStudent(id, context = {}) {
    const tenantId = context.tenantId;
    const student = await User.findOne({ _id: id, tenantId, role: ROLES.STUDENT });
    if (!student) {
      throw new NotFoundError(`Student with ID '${id}' not found`);
    }

    student.status = 'inactive';
    await student.save();

    // Deactivate active enrollments
    await Enrollment.updateMany({ tenantId, studentId: id, status: 'active' }, { status: 'inactive' });

    return {
      success: true,
      message: 'Student account and coaching enrollments deactivated successfully',
    };
  }

  /**
   * Helper to resolve all student accounts belonging to the same sibling family group.
   * Checks siblingGroupId, metadata.siblingGroupId, and shared parent phone numbers.
   */
  async _resolveFamilyStudents(studentOrId, tenantId = null) {
    let student = studentOrId;
    if (!student || typeof student === 'string' || student instanceof mongoose.Types.ObjectId) {
      student = await User.findById(studentOrId).lean();
    }
    if (!student) return [];

    const effectiveTenantId = student.tenantId || tenantId;
    const siblingCriteria = [];
    if (student.siblingGroupId) {
      siblingCriteria.push({ siblingGroupId: student.siblingGroupId });
    }
    if (student.metadata?.siblingGroupId && mongoose.Types.ObjectId.isValid(student.metadata.siblingGroupId)) {
      siblingCriteria.push({ siblingGroupId: new mongoose.Types.ObjectId(student.metadata.siblingGroupId) });
      siblingCriteria.push({ 'metadata.siblingGroupId': student.metadata.siblingGroupId });
    }
    if (student.phone) {
      siblingCriteria.push({ phone: student.phone });
      siblingCriteria.push({ 'metadata.parentPhone': student.phone });
    }
    if (student.metadata?.parentPhone) {
      siblingCriteria.push({ phone: student.metadata.parentPhone });
      siblingCriteria.push({ 'metadata.parentPhone': student.metadata.parentPhone });
    }

    if (siblingCriteria.length === 0) {
      return [student];
    }

    const docs = await User.find({
      tenantId: effectiveTenantId,
      role: ROLES.STUDENT,
      status: 'active',
      $or: siblingCriteria,
    })
      .select('_id firstName lastName employeeNo phone email metadata avatar cardNo siblingGroupId')
      .lean();

    const studentMap = new Map();
    studentMap.set(student._id.toString(), student);
    for (const d of docs) {
      studentMap.set(d._id.toString(), d);
    }
    return Array.from(studentMap.values());
  }

  /**
   * Calculate attendance summary statistics, punch logs, and session history for a student
   */
  _calculateAttendanceMetrics(student, punchLogs = [], manualAttendances = []) {
    const sId = student._id || student;
    const sIdStr = sId.toString();
    const empNo = student.employeeNo ? String(student.employeeNo).trim().toLowerCase() : null;
    const cardNo = student.cardNo ? String(student.cardNo).trim() : null;

    const stPunches = punchLogs.filter((p) => {
      if (p.studentId && p.studentId.toString() === sIdStr) return true;
      if (empNo && p.employeeNo && String(p.employeeNo).trim().toLowerCase() === empNo) return true;
      if (cardNo && p.cardNo && String(p.cardNo).trim() === cardNo) return true;
      return false;
    });

    let presentCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    const sessionHistory = [];

    for (const att of manualAttendances) {
      const rec = att.records?.find((r) => r.studentId?.toString() === sIdStr);
      if (rec) {
        if (rec.status === 'present') presentCount += 1;
        else if (rec.status === 'absent') absentCount += 1;
        else if (rec.status === 'excused') excusedCount += 1;

        sessionHistory.push({
          date: att.date,
          batchId: att.batchId,
          status: rec.status || 'present',
          remarks: rec.remarks || '',
          checkInTime: rec.checkInTime || null,
          checkOutTime: rec.checkOutTime || null,
          verificationMode: rec.verificationMode || '',
        });
      }
    }

    const activeSessions = presentCount + absentCount;
    const totalSessions = activeSessions + excusedCount;
    const attendancePercentage = activeSessions > 0 ? Math.round((presentCount / activeSessions) * 100) : 100;
    const latestPunch = stPunches.length > 0 ? stPunches[0] : null;

    return {
      totalSessions,
      presentCount,
      absentCount,
      excusedCount,
      attendancePercentage,
      latestPunch,
      punchLogs: stPunches,
      sessionHistory,
    };
  }

  /**
   * Get student attendance history & statistical summary.
   * When student has linked siblings, includes family sibling metadata and sibling attendance summaries.
   */
  async getStudentAttendance(id, context = {}) {
    const tenantId = context.tenantId || context.user?.tenantId;
    const currentUser = await User.findById(id).lean();
    if (!currentUser) {
      throw new NotFoundError('Student profile not found');
    }

    const familyStudents = await this._resolveFamilyStudents(currentUser, tenantId);
    const familyStudentIds = familyStudents.map((s) => s._id);

    const punchCriteria = [{ studentId: { $in: familyStudentIds } }];
    const empNos = familyStudents.map((s) => s.employeeNo).filter(Boolean);
    if (empNos.length > 0) {
      punchCriteria.push({ employeeNo: { $in: empNos } });
    }
    const cards = familyStudents.map((s) => s.cardNo).filter(Boolean);
    if (cards.length > 0) {
      punchCriteria.push({ cardNo: { $in: cards } });
    }

    const [punchLogs, manualAttendances, enrollments] = await Promise.all([
      AttendancePunchLog.find({
        tenantId,
        $or: punchCriteria,
      })
        .sort({ punchTime: -1 })
        .limit(200)
        .lean(),
      Attendance.find({
        tenantId,
        'records.studentId': { $in: familyStudentIds },
      })
        .sort({ date: -1 })
        .limit(100)
        .lean(),
      Enrollment.find({
        tenantId,
        studentId: { $in: familyStudentIds },
        status: 'active',
      })
        .populate({
          path: 'batchId',
          select: 'name code sportId',
          populate: { path: 'sportId', select: 'name' },
        })
        .lean(),
    ]);

    const targetMetrics = this._calculateAttendanceMetrics(currentUser, punchLogs, manualAttendances);
    const targetEnr = enrollments.find((e) => e.studentId?.toString() === currentUser._id.toString());
    const targetFullName = `${currentUser.firstName} ${currentUser.lastName || ''}`.trim();

    const hasSiblings = familyStudents.length > 1;
    const siblingCount = Math.max(0, familyStudents.length - 1);
    const siblingGroupId = currentUser.siblingGroupId || currentUser.metadata?.siblingGroupId || null;
    const familyPhone = currentUser.metadata?.parentPhone || currentUser.phone || '';
    const parentName = currentUser.metadata?.parentName || '';

    const siblings = familyStudents.map((st) => {
      const sIdStr = st._id.toString();
      const sMetrics = this._calculateAttendanceMetrics(st, punchLogs, manualAttendances);
      const enr = enrollments.find((e) => e.studentId?.toString() === sIdStr);

      return {
        studentId: sIdStr,
        _id: sIdStr,
        firstName: st.firstName,
        lastName: st.lastName || '',
        fullName: `${st.firstName} ${st.lastName || ''}`.trim(),
        employeeNo: st.employeeNo || '',
        regNo: st.employeeNo || '',
        phone: st.phone || '',
        cardNo: st.cardNo || '',
        avatar: st.avatar || '',
        batchId: enr?.batchId?._id?.toString() || enr?.batchId || null,
        batchName: enr?.batchId?.name || '',
        sportName: enr?.batchId?.sportId?.name || '',
        totalSessions: sMetrics.totalSessions,
        presentCount: sMetrics.presentCount,
        absentCount: sMetrics.absentCount,
        excusedCount: sMetrics.excusedCount,
        attendancePercentage: sMetrics.attendancePercentage,
        latestPunch: sMetrics.latestPunch
          ? {
              punchTime: sMetrics.latestPunch.punchTime,
              verificationMode: sMetrics.latestPunch.verificationMode,
              deviceName: sMetrics.latestPunch.deviceName,
              deviceCode: sMetrics.latestPunch.deviceCode,
              status: sMetrics.latestPunch.status,
            }
          : null,
        isSelected: sIdStr === currentUser._id.toString(),
      };
    });

    return {
      studentId: currentUser._id.toString(),
      studentName: targetFullName,
      regNo: currentUser.employeeNo || '',
      employeeNo: currentUser.employeeNo || '',
      batchId: targetEnr?.batchId?._id?.toString() || targetEnr?.batchId || null,
      batchName: targetEnr?.batchId?.name || '',
      sportName: targetEnr?.batchId?.sportId?.name || '',
      totalSessions: targetMetrics.totalSessions,
      presentCount: targetMetrics.presentCount,
      absentCount: targetMetrics.absentCount,
      excusedCount: targetMetrics.excusedCount,
      attendancePercentage: targetMetrics.attendancePercentage,
      punchLogs: targetMetrics.punchLogs,
      sessionHistory: targetMetrics.sessionHistory,
      hasSiblings,
      siblingCount,
      siblingGroupId,
      familyPhone,
      parentName,
      selectedStudent: {
        studentId: currentUser._id.toString(),
        fullName: targetFullName,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName || '',
        regNo: currentUser.employeeNo || '',
        phone: currentUser.phone || '',
        cardNo: currentUser.cardNo || '',
        avatar: currentUser.avatar || '',
        batchId: targetEnr?.batchId?._id?.toString() || targetEnr?.batchId || null,
        batchName: targetEnr?.batchId?.name || '',
        sportName: targetEnr?.batchId?.sportId?.name || '',
        attendancePercentage: targetMetrics.attendancePercentage,
        totalSessions: targetMetrics.totalSessions,
        presentCount: targetMetrics.presentCount,
        absentCount: targetMetrics.absentCount,
      },
      siblings,
    };
  }

  /**
   * Get logged-in student's personal attendance (Mobile App)
   * Supports:
   * - query.studentId: Switch to attendance of a linked sibling profile
   * - query.groupBy === 'sibling': Complete family-wide attendance breakdown
   */
  async getMyAttendance(context = {}) {
    const userId = context.user?.id || context.user?.sub;
    if (!userId) {
      throw new ValidationError('Authenticated student user is required');
    }

    if (context.query?.groupBy === 'sibling' || context.query?.format === 'grouped') {
      return await this.getStudentSiblingAttendance(userId, context);
    }

    const tenantId = context.tenantId || context.user?.tenantId;
    const currentUser = await User.findById(userId).lean();
    if (!currentUser) {
      throw new NotFoundError('Student profile not found');
    }

    let targetStudentId = userId;
    if (context.query?.studentId) {
      const requestedId = context.query.studentId.toString();
      const familyStudents = await this._resolveFamilyStudents(currentUser, tenantId);
      const isSibling = familyStudents.some((s) => s._id.toString() === requestedId);
      const role = context.user?.role;
      const isAdminOrCoach = [ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.COACH].includes(role);

      if (isSibling || isAdminOrCoach) {
        targetStudentId = requestedId;
      } else {
        throw new AuthorizationError('Requested student does not belong to your family sibling group');
      }
    }

    return await this.getStudentAttendance(targetStudentId, context);
  }

  /**
   * Complete sibling-wise breakdown of attendance, punch logs, and session history
   */
  async getStudentSiblingAttendance(id, context = {}) {
    const tenantId = context.tenantId || context.user?.tenantId;
    const currentUser = await User.findById(id).lean();
    if (!currentUser) {
      throw new NotFoundError('Student profile not found');
    }

    const familyStudents = await this._resolveFamilyStudents(currentUser, tenantId);
    const familyStudentIds = familyStudents.map((s) => s._id);

    const punchCriteria = [{ studentId: { $in: familyStudentIds } }];
    const empNos = familyStudents.map((s) => s.employeeNo).filter(Boolean);
    if (empNos.length > 0) {
      punchCriteria.push({ employeeNo: { $in: empNos } });
    }
    const cards = familyStudents.map((s) => s.cardNo).filter(Boolean);
    if (cards.length > 0) {
      punchCriteria.push({ cardNo: { $in: cards } });
    }

    const [punchLogs, manualAttendances, enrollments] = await Promise.all([
      AttendancePunchLog.find({
        tenantId,
        $or: punchCriteria,
      })
        .sort({ punchTime: -1 })
        .limit(200)
        .lean(),
      Attendance.find({
        tenantId,
        'records.studentId': { $in: familyStudentIds },
      })
        .sort({ date: -1 })
        .limit(100)
        .lean(),
      Enrollment.find({
        tenantId,
        studentId: { $in: familyStudentIds },
        status: 'active',
      })
        .populate({
          path: 'batchId',
          select: 'name code sportId',
          populate: { path: 'sportId', select: 'name' },
        })
        .lean(),
    ]);

    let familyTotalSessions = 0;
    let familyTotalPresent = 0;
    let familyTotalAbsent = 0;
    let familyTotalExcused = 0;

    const siblings = familyStudents.map((st) => {
      const sIdStr = st._id.toString();
      const sMetrics = this._calculateAttendanceMetrics(st, punchLogs, manualAttendances);
      const enr = enrollments.find((e) => e.studentId?.toString() === sIdStr);

      familyTotalSessions += sMetrics.totalSessions;
      familyTotalPresent += sMetrics.presentCount;
      familyTotalAbsent += sMetrics.absentCount;
      familyTotalExcused += sMetrics.excusedCount;

      return {
        studentId: sIdStr,
        _id: sIdStr,
        firstName: st.firstName,
        lastName: st.lastName || '',
        fullName: `${st.firstName} ${st.lastName || ''}`.trim(),
        employeeNo: st.employeeNo || '',
        regNo: st.employeeNo || '',
        phone: st.phone || '',
        cardNo: st.cardNo || '',
        avatar: st.avatar || '',
        parentPhone: st.metadata?.parentPhone || currentUser.metadata?.parentPhone || currentUser.phone || '',
        parentName: st.metadata?.parentName || currentUser.metadata?.parentName || '',
        batchId: enr?.batchId?._id?.toString() || enr?.batchId || null,
        batchName: enr?.batchId?.name || '',
        sportName: enr?.batchId?.sportId?.name || '',
        summary: {
          totalSessions: sMetrics.totalSessions,
          presentCount: sMetrics.presentCount,
          absentCount: sMetrics.absentCount,
          excusedCount: sMetrics.excusedCount,
          attendancePercentage: sMetrics.attendancePercentage,
        },
        latestPunch: sMetrics.latestPunch
          ? {
              punchTime: sMetrics.latestPunch.punchTime,
              verificationMode: sMetrics.latestPunch.verificationMode,
              deviceName: sMetrics.latestPunch.deviceName,
              deviceCode: sMetrics.latestPunch.deviceCode,
              status: sMetrics.latestPunch.status,
            }
          : null,
        punchLogs: sMetrics.punchLogs,
        sessionHistory: sMetrics.sessionHistory,
      };
    });

    const activeSessions = familyTotalPresent + familyTotalAbsent;
    const overallPercentage =
      activeSessions > 0 ? Math.round((familyTotalPresent / activeSessions) * 100) : 100;

    return {
      siblingGroupId: currentUser.siblingGroupId || currentUser.metadata?.siblingGroupId || null,
      familyPhone: currentUser.metadata?.parentPhone || currentUser.phone || '',
      parentName: currentUser.metadata?.parentName || '',
      siblingCount: familyStudents.length,
      familySummary: {
        totalSessions: familyTotalSessions,
        presentCount: familyTotalPresent,
        absentCount: familyTotalAbsent,
        excusedCount: familyTotalExcused,
        overallAttendancePercentage: overallPercentage,
      },
      siblings,
    };
  }

  /**
   * Sibling group attendance query by studentId, familyPhone, or siblingGroupId
   */
  async getSiblingAttendance(context = {}) {
    const query = context.query || {};
    let targetUserId = query.studentId || context.user?.id || context.user?.sub;
    if (!targetUserId && (query.familyPhone || query.siblingGroupId)) {
      const matchCriteria = [];
      if (query.siblingGroupId && mongoose.Types.ObjectId.isValid(query.siblingGroupId)) {
        matchCriteria.push({ siblingGroupId: new mongoose.Types.ObjectId(query.siblingGroupId) });
      }
      if (query.familyPhone) {
        matchCriteria.push({ phone: query.familyPhone });
        matchCriteria.push({ 'metadata.parentPhone': query.familyPhone });
      }
      const st = await User.findOne({
        tenantId: context.tenantId,
        role: ROLES.STUDENT,
        $or: matchCriteria,
      });
      if (st) {
        targetUserId = st._id.toString();
      }
    }
    if (!targetUserId) {
      throw new ValidationError('studentId, familyPhone, or active student session is required');
    }
    return await this.getStudentSiblingAttendance(targetUserId, context);
  }

  /**
   * Mark batch session attendance (Coach / Staff Mobile App)
   */
  async markAttendance(data, context = {}) {
    return await coachingService.markAttendance(data, context);
  }

  /**
   * Get siblings of the logged-in student (Mobile App)
   */
  async getMySiblings(context = {}) {
    const userId = context.user?.id || context.user?.sub;
    const user = await User.findById(userId);
    if (!user || !user.tenantId) {
      return [];
    }

    const siblingCriteria = [];
    if (user.siblingGroupId) {
      siblingCriteria.push({ siblingGroupId: user.siblingGroupId });
    }
    if (user.metadata?.siblingGroupId && mongoose.Types.ObjectId.isValid(user.metadata.siblingGroupId)) {
      siblingCriteria.push({ siblingGroupId: new mongoose.Types.ObjectId(user.metadata.siblingGroupId) });
    }
    if (user.phone) {
      siblingCriteria.push({ phone: user.phone });
      siblingCriteria.push({ 'metadata.parentPhone': user.phone });
    }
    if (user.metadata?.parentPhone) {
      siblingCriteria.push({ phone: user.metadata.parentPhone });
      siblingCriteria.push({ 'metadata.parentPhone': user.metadata.parentPhone });
    }

    if (siblingCriteria.length === 0) {
      return [];
    }

    const siblings = await User.find({
      tenantId: user.tenantId,
      _id: { $ne: user._id },
      role: ROLES.STUDENT,
      status: 'active',
      $or: siblingCriteria,
    }).select('-password');

    return await Promise.all(
      siblings.map(async (st) => {
        const enrollments = await Enrollment.find({ studentId: st._id, status: 'active' }).populate('batchId');
        return {
          id: st._id,
          studentId: st._id,
          firstName: st.firstName,
          lastName: st.lastName,
          fullName: `${st.firstName} ${st.lastName || ''}`.trim(),
          employeeNo: st.employeeNo,
          cardNo: st.cardNo,
          phone: st.phone,
          email: st.email,
          siblingGroupId: st.siblingGroupId || user.siblingGroupId || null,
          parentPhone: st.metadata?.parentPhone || user.metadata?.parentPhone || user.phone || '',
          enrollments,
        };
      })
    );
  }

  /**
   * Get logged-in student's monthly coaching fee invoices (Mobile App)
   * Automatically aggregates all fees across all siblings in the family group.
   * If query.groupBy === 'sibling', returns structured sibling-wise breakdown.
   */
  async getMyFees(context = {}) {
    const userId = context.user?.id || context.user?.sub;
    if (!userId) {
      throw new ValidationError('Authenticated student user is required');
    }
    if (context.query?.groupBy === 'sibling' || context.query?.format === 'grouped') {
      return await this.getStudentSiblingPayments(userId, context);
    }
    return await this.getStudentFees(userId, { ...context, includeSiblings: true });
  }

  /**
   * Get logged-in student's sibling-wise payments, fees & financial breakdown (Mobile App)
   */
  async getMyPayments(context = {}) {
    const userId = context.user?.id || context.user?.sub;
    if (!userId) {
      throw new ValidationError('Authenticated student user is required');
    }
    return await this.getStudentSiblingPayments(userId, context);
  }

  /**
   * Sibling group payments query by studentId, familyPhone, or siblingGroupId
   */
  async getSiblingPayments(context = {}) {
    const query = context.query || {};
    let targetUserId = query.studentId || context.user?.id || context.user?.sub;
    if (!targetUserId && (query.familyPhone || query.siblingGroupId)) {
      const matchCriteria = [];
      if (query.siblingGroupId && mongoose.Types.ObjectId.isValid(query.siblingGroupId)) {
        matchCriteria.push({ siblingGroupId: new mongoose.Types.ObjectId(query.siblingGroupId) });
      }
      if (query.familyPhone) {
        matchCriteria.push({ phone: query.familyPhone });
        matchCriteria.push({ 'metadata.parentPhone': query.familyPhone });
      }
      const st = await User.findOne({
        tenantId: context.tenantId,
        role: ROLES.STUDENT,
        $or: matchCriteria,
      });
      if (st) {
        targetUserId = st._id.toString();
      }
    }
    if (!targetUserId) {
      throw new ValidationError('studentId, familyPhone, or active student session is required');
    }
    return await this.getStudentSiblingPayments(targetUserId, context);
  }

  /**
   * Complete sibling-wise breakdown of fees, ledger payments, and invoices
   */
  async getStudentSiblingPayments(id, context = {}) {
    const tenantId = context.tenantId;
    const currentUser = await User.findById(id).lean();
    if (!currentUser) {
      throw new NotFoundError('Student profile not found');
    }

    const siblingCriteria = [];
    if (currentUser.siblingGroupId) {
      siblingCriteria.push({ siblingGroupId: currentUser.siblingGroupId });
    }
    if (currentUser.metadata?.siblingGroupId && mongoose.Types.ObjectId.isValid(currentUser.metadata.siblingGroupId)) {
      siblingCriteria.push({ siblingGroupId: new mongoose.Types.ObjectId(currentUser.metadata.siblingGroupId) });
    }
    if (currentUser.phone) {
      siblingCriteria.push({ phone: currentUser.phone });
      siblingCriteria.push({ 'metadata.parentPhone': currentUser.phone });
    }
    if (currentUser.metadata?.parentPhone) {
      siblingCriteria.push({ phone: currentUser.metadata.parentPhone });
      siblingCriteria.push({ 'metadata.parentPhone': currentUser.metadata.parentPhone });
    }

    let familyStudents = [currentUser];
    if (siblingCriteria.length > 0) {
      const docs = await User.find({
        tenantId: currentUser.tenantId || tenantId,
        role: ROLES.STUDENT,
        status: 'active',
        $or: siblingCriteria,
      })
        .select('_id firstName lastName employeeNo phone email metadata avatar cardNo')
        .lean();

      if (docs.length > 0) {
        const studentMap = new Map();
        studentMap.set(currentUser._id.toString(), currentUser);
        for (const d of docs) {
          studentMap.set(d._id.toString(), d);
        }
        familyStudents = Array.from(studentMap.values());
      }
    }

    const studentIds = familyStudents.map((s) => s._id);

    const [allFees, allPayments] = await Promise.all([
      MonthlyFee.find({
        tenantId: currentUser.tenantId || tenantId,
        $or: [
          { studentId: { $in: studentIds } },
          { userId: { $in: studentIds } },
        ],
      })
        .populate('batchId', 'name schedule code')
        .populate('sportId', 'name icon')
        .sort({ year: -1, month: -1, createdAt: -1 })
        .lean(),
      Payment.find({
        tenantId: currentUser.tenantId || tenantId,
        userId: { $in: studentIds },
      })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const siblings = familyStudents.map((st) => {
      const sIdStr = st._id.toString();
      const stFullName = `${st.firstName} ${st.lastName || ''}`.trim();
      const stFees = allFees.filter(
        (f) => (f.studentId?.toString() || f.userId?.toString()) === sIdStr
      );
      const stPayments = allPayments.filter(
        (p) => p.userId?.toString() === sIdStr
      );

      const totalAmount = stFees.reduce((sum, f) => sum + (f.finalAmount || f.baseFee || 0), 0);
      const totalPaid = stFees
        .filter((f) => f.status === 'paid')
        .reduce((sum, f) => sum + (f.paidAmount || f.finalAmount || 0), 0);
      const totalPending = stFees
        .filter((f) => f.status !== 'paid')
        .reduce((sum, f) => sum + (f.finalAmount || 0), 0);

      const paidCount = stFees.filter((f) => f.status === 'paid').length;
      const pendingCount = stFees.filter((f) => f.status !== 'paid').length;

      return {
        studentId: sIdStr,
        _id: sIdStr,
        firstName: st.firstName,
        lastName: st.lastName || '',
        fullName: stFullName,
        regNo: st.employeeNo || '',
        employeeNo: st.employeeNo || '',
        phone: st.phone || '',
        cardNo: st.cardNo || '',
        avatar: st.avatar || '',
        parentPhone: st.metadata?.parentPhone || currentUser.metadata?.parentPhone || currentUser.phone || '',
        parentName: st.metadata?.parentName || currentUser.metadata?.parentName || '',
        summary: {
          totalAmount,
          totalPaid,
          totalPending,
          invoiceCount: stFees.length,
          paidCount,
          pendingCount,
          paymentTransactionCount: stPayments.length,
        },
        fees: stFees.map((f) => {
          const originalBatchName = f.batchId?.name || 'Monthly Coaching Fee';
          return {
            ...f,
            studentId: sIdStr,
            studentName: stFullName,
            studentRegNo: st.employeeNo || '',
            batchName: originalBatchName,
            batchDisplayName: `${originalBatchName} (${stFullName})`,
          };
        }),
        payments: stPayments.map((p) => ({
          ...p,
          studentId: sIdStr,
          studentName: stFullName,
          studentRegNo: st.employeeNo || '',
        })),
      };
    });

    const familyTotalAmount = siblings.reduce((sum, s) => sum + s.summary.totalAmount, 0);
    const familyTotalPaid = siblings.reduce((sum, s) => sum + s.summary.totalPaid, 0);
    const familyTotalPending = siblings.reduce((sum, s) => sum + s.summary.totalPending, 0);
    const familyInvoiceCount = siblings.reduce((sum, s) => sum + s.summary.invoiceCount, 0);
    const familyPaidCount = siblings.reduce((sum, s) => sum + s.summary.paidCount, 0);
    const familyPendingCount = siblings.reduce((sum, s) => sum + s.summary.pendingCount, 0);

    return {
      familyPhone: currentUser.metadata?.parentPhone || currentUser.phone || '',
      parentName: currentUser.metadata?.parentName || '',
      siblingGroupId: currentUser.siblingGroupId || currentUser.metadata?.siblingGroupId || null,
      totalStudents: familyStudents.length,
      summary: {
        totalAmount: familyTotalAmount,
        totalPaid: familyTotalPaid,
        totalPending: familyTotalPending,
        totalInvoices: familyInvoiceCount,
        paidInvoices: familyPaidCount,
        pendingInvoices: familyPendingCount,
        paymentTransactions: allPayments.length,
      },
      siblings,
      allFees: allFees.map((fee) => {
        const sIdStr = fee.studentId?.toString() || fee.userId?.toString();
        const st = familyStudents.find((s) => s._id.toString() === sIdStr);
        const name = st ? `${st.firstName} ${st.lastName || ''}`.trim() : 'Student';
        const originalBatchName = fee.batchId?.name || 'Monthly Coaching Fee';
        return {
          ...fee,
          studentId: sIdStr,
          studentName: name,
          studentRegNo: st?.employeeNo || '',
          batchName: originalBatchName,
          batchDisplayName: `${originalBatchName} (${name})`,
        };
      }),
      allPayments: allPayments.map((p) => {
        const sIdStr = p.userId?.toString();
        const st = familyStudents.find((s) => s._id.toString() === sIdStr);
        return {
          ...p,
          studentId: sIdStr,
          studentName: st ? `${st.firstName} ${st.lastName || ''}`.trim() : 'Student',
          studentRegNo: st?.employeeNo || '',
        };
      }),
    };
  }

  /**
   * Get student monthly fee invoices
   * When includeSiblings is true (or when accessed by student session),
   * returns monthly fee invoices for both the student and all linked siblings
   */
  async getStudentFees(id, context = {}) {
    const tenantId = context.tenantId;
    const isStudent = context.user?.role === ROLES.STUDENT;
    const includeSiblings =
      context.includeSiblings === true ||
      (isStudent && context.query?.includeSiblings !== false && context.query?.includeSiblings !== 'false') ||
      context.query?.includeSiblings === true ||
      context.query?.includeSiblings === 'true';

    let targetStudentIds = [id];
    const studentMap = new Map();

    const currentUser = await User.findById(id).lean();
    if (currentUser) {
      studentMap.set(currentUser._id.toString(), {
        _id: currentUser._id,
        id: currentUser._id.toString(),
        studentId: currentUser._id.toString(),
        firstName: currentUser.firstName,
        lastName: currentUser.lastName || '',
        fullName: `${currentUser.firstName} ${currentUser.lastName || ''}`.trim(),
        regNo: currentUser.employeeNo || '',
        employeeNo: currentUser.employeeNo || '',
        phone: currentUser.phone || '',
      });

      if (includeSiblings) {
        const siblingCriteria = [];
        if (currentUser.siblingGroupId) {
          siblingCriteria.push({ siblingGroupId: currentUser.siblingGroupId });
        }
        if (currentUser.metadata?.siblingGroupId && mongoose.Types.ObjectId.isValid(currentUser.metadata.siblingGroupId)) {
          siblingCriteria.push({ siblingGroupId: new mongoose.Types.ObjectId(currentUser.metadata.siblingGroupId) });
        }
        if (currentUser.phone) {
          siblingCriteria.push({ phone: currentUser.phone });
          siblingCriteria.push({ 'metadata.parentPhone': currentUser.phone });
        }
        if (currentUser.metadata?.parentPhone) {
          siblingCriteria.push({ phone: currentUser.metadata.parentPhone });
          siblingCriteria.push({ 'metadata.parentPhone': currentUser.metadata.parentPhone });
        }

        if (siblingCriteria.length > 0) {
          const siblingDocs = await User.find({
            tenantId: currentUser.tenantId || tenantId,
            role: ROLES.STUDENT,
            status: 'active',
            $or: siblingCriteria,
          })
            .select('_id firstName lastName employeeNo phone')
            .lean();

          for (const s of siblingDocs) {
            const sIdStr = s._id.toString();
            studentMap.set(sIdStr, {
              _id: s._id,
              id: sIdStr,
              studentId: sIdStr,
              firstName: s.firstName,
              lastName: s.lastName || '',
              fullName: `${s.firstName} ${s.lastName || ''}`.trim(),
              regNo: s.employeeNo || '',
              employeeNo: s.employeeNo || '',
              phone: s.phone || '',
            });
          }
          targetStudentIds = Array.from(studentMap.keys()).map((sid) => new mongoose.Types.ObjectId(sid));
        }
      }
    }

    const hasMultipleSiblings = targetStudentIds.length > 1;

    const feeQuery = {
      tenantId,
      $or: [
        { studentId: { $in: targetStudentIds } },
        { userId: { $in: targetStudentIds } },
      ],
    };

    const fees = await MonthlyFee.find(feeQuery)
      .populate('batchId', 'name schedule code')
      .populate('sportId', 'name icon')
      .sort({ year: -1, month: -1, createdAt: -1 })
      .lean();

    return fees.map((fee) => {
      const sIdStr = fee.studentId?.toString() || fee.userId?.toString();
      const studentInfo = studentMap.get(sIdStr) || {
        _id: sIdStr,
        id: sIdStr,
        studentId: sIdStr,
        fullName: 'Student',
        firstName: 'Student',
        lastName: '',
        regNo: '',
        employeeNo: '',
        phone: '',
      };

      const originalBatchName = fee.batchId?.name || 'Monthly Coaching Fee';
      const displayName = hasMultipleSiblings
        ? `${originalBatchName} (${studentInfo.fullName})`
        : originalBatchName;

      return {
        ...fee,
        studentId: sIdStr,
        studentName: studentInfo.fullName,
        studentRegNo: studentInfo.regNo,
        student: studentInfo,
        batchName: originalBatchName,
        batchId: fee.batchId
          ? {
              ...fee.batchId,
              name: displayName,
              batchName: originalBatchName,
            }
          : fee.batchId,
      };
    });
  }
}

export const studentService = new StudentService();

