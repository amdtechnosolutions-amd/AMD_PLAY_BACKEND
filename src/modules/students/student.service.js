import { User } from '../users/user.model.js';
import { Enrollment } from '../coaching/enrollment.model.js';
import { Attendance } from '../coaching/attendance.model.js';
import { AttendancePunchLog } from '../coaching/attendance-punch-log.model.js';
import { MonthlyFee } from '../finance/monthly-fee.model.js';
import { Evaluation } from '../coaching/evaluation.model.js';
import { Skill } from '../skills/skill.model.js';
import { coachingService } from '../coaching/coaching.service.js';
import { NotFoundError, ValidationError } from '../../errors/AppError.js';
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
   * Get student attendance history & statistical summary
   */
  async getStudentAttendance(id, context = {}) {
    const tenantId = context.tenantId;
    const [punchLogs, manualAttendances] = await Promise.all([
      AttendancePunchLog.find({ tenantId, studentId: id }).sort({ punchTime: -1 }).limit(100).lean(),
      Attendance.find({
        tenantId,
        'records.studentId': id,
      }).sort({ date: -1 }).limit(60).lean(),
    ]);

    let presentCount = 0;
    let absentCount = 0;
    const sessionHistory = manualAttendances.map((att) => {
      const rec = att.records.find((r) => r.studentId?.toString() === id.toString());
      if (rec?.status === 'present') presentCount += 1;
      else if (rec?.status === 'absent') absentCount += 1;
      return {
        date: att.date,
        batchId: att.batchId,
        status: rec?.status || 'present',
        remarks: rec?.remarks || '',
      };
    });

    const totalSessions = presentCount + absentCount;
    const attendancePercentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

    return {
      studentId: id,
      totalSessions,
      presentCount,
      absentCount,
      attendancePercentage,
      punchLogs,
      sessionHistory,
    };
  }

  /**
   * Get logged-in student's personal attendance (Mobile App)
   */
  async getMyAttendance(context = {}) {
    const userId = context.user?.id || context.user?.sub;
    if (!userId) {
      throw new ValidationError('Authenticated student user is required');
    }
    return await this.getStudentAttendance(userId, context);
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
    if (!user || !user.phone || !user.tenantId) {
      return [];
    }

    const siblings = await User.find({
      tenantId: user.tenantId,
      phone: user.phone,
      _id: { $ne: user._id },
      role: ROLES.STUDENT,
      status: 'active',
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
          enrollments,
        };
      })
    );
  }

  /**
   * Get logged-in student's monthly coaching fee invoices (Mobile App)
   */
  async getMyFees(context = {}) {
    const userId = context.user?.id || context.user?.sub;
    if (!userId) {
      throw new ValidationError('Authenticated student user is required');
    }
    return await this.getStudentFees(userId, context);
  }

  /**
   * Get student monthly fee invoices
   */
  async getStudentFees(id, context = {}) {
    const tenantId = context.tenantId;
    const fees = await MonthlyFee.find({ tenantId, studentId: id })
      .populate('batchId', 'name schedule code')
      .populate('sportId', 'name icon')
      .sort({ year: -1, month: -1 });
    return fees;
  }
}

export const studentService = new StudentService();

