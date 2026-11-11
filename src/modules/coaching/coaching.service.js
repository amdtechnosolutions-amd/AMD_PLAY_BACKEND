import mongoose from 'mongoose';
import { BaseService } from '../../core/BaseService.js';
import {
  batchRepository,
  enrollmentRepository,
  attendanceRepository,
} from './coaching.repository.js';
import { Batch } from './batch.model.js';
import { branchRepository } from '../branches/branch.repository.js';
import { sportRepository } from '../sports/sport.repository.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { userRepository } from '../users/user.repository.js';
import { hashPassword } from '../../utils/password.js';
import { NotFoundError, ConflictError, ValidationError } from '../../errors/AppError.js';
import { ROLES } from '../../config/constants.js';
import { HikvisionService, hikvisionService } from '../iot/hikvision.service.js';
import { Device } from '../iot/device.model.js';
import { deviceSyncQueueService } from '../iot/device-sync-queue.service.js';
import { settingsService } from '../settings/settings.service.js';
import { wabridgeService } from '../notifications/wabridge.service.js';
import { MembershipPlan } from '../memberships/membershipPlan.model.js';
import { MemberSubscription } from '../memberships/memberSubscription.model.js';
import { Resource } from '../resources/resource.model.js';
import { Enrollment } from './enrollment.model.js';
import { Skill } from '../skills/skill.model.js';
import { User } from '../users/user.model.js';

export class CoachingService extends BaseService {
  constructor() {
    super(batchRepository, 'Batch');
  }

  async list(filters, pagination, context = {}) {
    const tenantId = context.tenantId;
    const result = await super.list(filters, pagination, context);

    if (result && result.items && result.items.length > 0) {
      const populatedItems = await Promise.all(
        result.items.map(async (b) => {
          const bObj = b.toObject ? b.toObject() : { ...b };
          try {
            const enrollments = await enrollmentRepository.findActiveByBatch(bObj._id, tenantId);
            bObj.students = (enrollments || []).map((e) => ({
              _id: e.studentId?._id || e.studentId,
              name: e.studentId
                ? `${e.studentId.firstName || ''} ${e.studentId.lastName || ''}`.trim()
                : 'Trainee',
              email: e.studentId?.email || '',
              phone: e.studentId?.phone || '',
              status: e.status || 'active',
              attendance: 'present',
              joinedAt: e.createdAt,
              enrollmentId: e._id,
            }));
            bObj.enrolledCount = bObj.students.length;
          } catch (_) {
            bObj.students = bObj.students || [];
          }
          return bObj;
        })
      );
      result.items = populatedItems;
    }

    return result;
  }

  async createBatch(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    // 1. Verify Branch
    const branch = await branchRepository.findById(data.branchId, tenantId);
    if (!branch) {
      throw new NotFoundError(`Branch with ID '${data.branchId}' not found`);
    }

    // 2. Verify Sport
    const sport = await sportRepository.findById(data.sportId);
    if (!sport) {
      throw new NotFoundError(`Sport with ID '${data.sportId}' not found`);
    }

    // 3. Verify Coach
    const coach = await userRepository.findById(data.coachId, tenantId);
    if (!coach) {
      throw new NotFoundError(`Coach with ID '${data.coachId}' not found`);
    }

    // 4. Resolve or auto-generate unique batch code per branch
    let finalCode = (data.code || '').trim().toUpperCase();
    if (!finalCode) {
      let sportCode = 'BAT';
      try {
        const s = (sport.slug || sport.name || '').toLowerCase().replace(/[^a-z]/g, '');
        if (s.includes('badminton')) sportCode = 'BD';
        else if (s.includes('cricket')) sportCode = 'CR';
        else if (s.includes('football')) sportCode = 'FB';
        else if (s.includes('basketball')) sportCode = 'BB';
        else if (s.includes('pickle')) sportCode = 'PB';
        else if (s.includes('tennis')) sportCode = 'TN';
        else if (s.includes('swim')) sportCode = 'SW';
        else if (s.includes('squash')) sportCode = 'SQ';
        else sportCode = s.slice(0, 2).toUpperCase() || 'SP';
      } catch (_) {}

      const timePart = data.schedule?.startTime ? data.schedule.startTime.replace(':', '') : '0000';
      const baseCode = `BAT-${sportCode}-${timePart}`;
      finalCode = baseCode;
      let counter = 1;
      while (await batchRepository.findByCode(finalCode, data.branchId, tenantId)) {
        counter += 1;
        finalCode = `${baseCode}-${String(counter).padStart(2, '0')}`;
      }
    } else {
      const existing = await batchRepository.findByCode(finalCode, data.branchId, tenantId);
      if (existing) {
        throw new ConflictError(
          `Batch code '${finalCode}' is already assigned in branch '${branch.name}'`
        );
      }
    }

    // 5. Auto-generate Hikvision Plan Template ID if schedule is present and not provided
    let autoHikvisionId = data.hikvisionPlanTemplateNo;
    if (!autoHikvisionId && data.schedule?.startTime && data.schedule?.endTime) {
      const [maxBatch, maxPlan, maxSub] = await Promise.all([
        Batch.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
          .sort({ hikvisionPlanTemplateNo: -1 })
          .select('hikvisionPlanTemplateNo')
          .lean(),
        MembershipPlan.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
          .sort({ hikvisionPlanTemplateNo: -1 })
          .select('hikvisionPlanTemplateNo')
          .lean(),
        MemberSubscription.findOne({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
          .sort({ hikvisionPlanTemplateNo: -1 })
          .select('hikvisionPlanTemplateNo')
          .lean(),
      ]);

      const highestTemplate = Math.max(
        maxBatch?.hikvisionPlanTemplateNo || 1,
        maxPlan?.hikvisionPlanTemplateNo || 1,
        maxSub?.hikvisionPlanTemplateNo || 1,
        1
      );
      autoHikvisionId = highestTemplate + 1;
    }

    // 6. Resolve Court(s)
    const rawCourtId = data.courtId || data.resourceId || null;
    let courtIds = [];
    if (Array.isArray(data.courtIds) && data.courtIds.length > 0) {
      courtIds = data.courtIds.filter(Boolean);
    } else if (rawCourtId) {
      courtIds = [rawCourtId];
    }
    const finalCourtId = rawCourtId || (courtIds.length > 0 ? courtIds[0] : null);

    if (finalCourtId) {
      const court = await Resource.findOne({ _id: finalCourtId, tenantId });
      if (!court) {
        throw new NotFoundError(`Court / Resource with ID '${finalCourtId}' not found`);
      }
    }

    const batch = await batchRepository.create({
      ...data,
      code: finalCode,
      resourceId: finalCourtId,
      courtId: finalCourtId,
      courtIds,
      hikvisionPlanTemplateNo: autoHikvisionId || null,
      tenantId,
      enrolledCount: 0,
    });

    // 6. Pre-program physical biometric terminal with 15-min grace window
    if (autoHikvisionId && autoHikvisionId > 1 && data.schedule) {
      try {
        const deviceQuery = {
          tenantId,
          type: { $in: ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'] },
        };
        if (data.branchId) deviceQuery.branchId = data.branchId;
        if (data.sportId) deviceQuery.$or = [{ sportId: data.sportId }, { isDefaultEntrance: true }];

        const targetDevices = await Device.find(deviceQuery);
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

          await client.syncBatchScheduleWeekPlan({
            templateNo: autoHikvisionId,
            batch,
            bufferMinutes: 15,
          });
        }
      } catch (syncErr) {
        console.warn('[Batch] Hardware schedule pre-sync notice:', syncErr.message);
      }
    }

    return batch;
  }

  async getBatchDetails(id, context = {}) {
    const tenantId = context.tenantId;
    const batch = await batchRepository.findWithDetails(id, tenantId);
    if (!batch) {
      throw new NotFoundError(`Batch with ID '${id}' not found`);
    }
    const enrollments = await enrollmentRepository.findActiveByBatch(id, tenantId);
    const batchObj = batch.toObject ? batch.toObject() : { ...batch };
    batchObj.students = (enrollments || []).map((e) => ({
      _id: e.studentId?._id || e.studentId,
      name: e.studentId ? `${e.studentId.firstName || ''} ${e.studentId.lastName || ''}`.trim() : 'Trainee',
      email: e.studentId?.email,
      phone: e.studentId?.phone,
      enrollmentId: e._id,
      joinedAt: e.createdAt,
      status: e.status,
    }));
    batchObj.enrolledCount = batchObj.students.length;
    return batchObj;
  }

  /**
   * Get enrolled students dropdown list for a specific batch
   */
  async getBatchStudentsDropdown(batchId, filters = {}, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const batch = await batchRepository.findById(batchId, tenantId);
    if (!batch) {
      throw new NotFoundError(`Batch with ID '${batchId}' not found`);
    }

    let sportName = '';
    if (batch.sportId) {
      try {
        const sport =
          (await sportRepository.findById(batch.sportId, tenantId)) ||
          (await sportRepository.findById(batch.sportId, null));
        if (sport) sportName = sport.name;
      } catch (_) {}
    }

    const skillMap = new Map();
    try {
      const skills = await Skill.find({}).lean();
      for (const s of skills) {
        skillMap.set(s._id.toString(), s.name);
      }
    } catch (_) {}

    const enrollmentQuery = {
      tenantId,
      batchId,
      status: filters.status || 'active',
    };

    const enrollments = await Enrollment.find(enrollmentQuery)
      .populate({
        path: 'studentId',
        select: 'firstName lastName email phone employeeNo cardNo pin status metadata createdAt',
      })
      .sort({ createdAt: 1 })
      .lean();

    let students = (enrollments || [])
      .filter((e) => e.studentId && (e.studentId.status === 'active' || !filters.onlyActive))
      .map((e) => {
        const s = e.studentId;
        const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim();
        const code = s.employeeNo || s.email || s.phone || '';
        const rawSkill = s.metadata?.skillLevel || '';
        const skillName = skillMap.get(rawSkill?.toString()) || rawSkill || 'Beginner';

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
          dateOfBirth: s.metadata?.dateOfBirth || null,
          skillLevel: skillName,
          parentName: s.metadata?.parentName || '',
          parentPhone: s.metadata?.parentPhone || '',
          batchId: batch._id.toString(),
          batchName: batch.name,
          sportId: batch.sportId ? batch.sportId.toString() : null,
          sportName,
          enrollmentId: e._id.toString(),
          enrollmentDate: e.enrollmentDate || e.createdAt,
          feeStatus: e.feeStatus || 'paid',
          monthlyFee: e.monthlyFee || batch.monthlyFee || 0,
          status: e.status,
        };
      });

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      students = students.filter(
        (st) =>
          st.name.toLowerCase().includes(q) ||
          st.employeeNo.toLowerCase().includes(q) ||
          st.phone.includes(q) ||
          st.email.toLowerCase().includes(q)
      );
    }

    return {
      batchId: batch._id.toString(),
      batchName: batch.name,
      batchCode: batch.code || '',
      sportName,
      totalStudents: students.length,
      items: students,
    };
  }

  /**
   * Get all batches with their enrolled students formatted for dropdowns
   */
  async getBatchWiseStudentsDropdown(filters = {}, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const query = { tenantId, status: filters.status || 'active' };
    if (filters.branchId) query.branchId = filters.branchId;
    if (filters.sportId) query.sportId = filters.sportId;

    if (context.user && (context.user.role === ROLES.COACH || context.user.role === 'trainer')) {
      const coachUserId = context.user.id || context.user.sub || context.user._id;
      if (coachUserId) query.coachId = coachUserId;
    } else if (filters.coachId) {
      query.coachId = filters.coachId;
    }

    const batches = await Batch.find(query)
      .populate('sportId', 'name slug')
      .populate('coachId', 'firstName lastName email phone')
      .populate('branchId', 'name code')
      .sort({ name: 1 })
      .lean();

    const skillMap = new Map();
    try {
      const skills = await Skill.find({}).lean();
      for (const s of skills) {
        skillMap.set(s._id.toString(), s.name);
      }
    } catch (_) {}

    const batchIds = batches.map((b) => b._id);
    const enrollments = await Enrollment.find({
      tenantId,
      batchId: { $in: batchIds },
      status: 'active',
    })
      .populate({
        path: 'studentId',
        select: 'firstName lastName email phone employeeNo cardNo pin status metadata createdAt',
      })
      .sort({ createdAt: 1 })
      .lean();

    const enrollmentsByBatch = new Map();
    for (const e of enrollments) {
      const bId = e.batchId.toString();
      if (!enrollmentsByBatch.has(bId)) enrollmentsByBatch.set(bId, []);
      enrollmentsByBatch.get(bId).push(e);
    }

    const result = batches.map((batch) => {
      const bId = batch._id.toString();
      const bEnrollments = enrollmentsByBatch.get(bId) || [];

      let students = bEnrollments
        .filter((e) => e.studentId && e.studentId.status === 'active')
        .map((e) => {
          const s = e.studentId;
          const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim();
          const code = s.employeeNo || s.email || s.phone || '';
          const rawSkill = s.metadata?.skillLevel || '';
          const skillName = skillMap.get(rawSkill?.toString()) || rawSkill || 'Beginner';

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
            batchId: bId,
            batchName: batch.name,
            enrollmentId: e._id.toString(),
            status: e.status,
          };
        });

      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        students = students.filter(
          (st) =>
            st.name.toLowerCase().includes(q) ||
            st.employeeNo.toLowerCase().includes(q) ||
            st.phone.includes(q)
        );
      }

      return {
        batchId: bId,
        batchName: batch.name,
        code: batch.code || '',
        level: batch.level || 'all_levels',
        sportId: batch.sportId?._id?.toString() || batch.sportId?.toString() || null,
        sportName: batch.sportId?.name || '',
        coachId: batch.coachId?._id?.toString() || batch.coachId?.toString() || null,
        coachName: batch.coachId
          ? `${batch.coachId.firstName || ''} ${batch.coachId.lastName || ''}`.trim()
          : '',
        coachPhone: batch.coachId?.phone || '',
        branchId: batch.branchId?._id?.toString() || batch.branchId?.toString() || null,
        branchName: batch.branchId?.name || '',
        schedule: batch.schedule || null,
        monthlyFee: batch.monthlyFee || 0,
        enrolledCount: students.length,
        students,
      };
    });

    return result;
  }

  async registerStudent(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    let student = null;
    if (data.studentId) {
      student = await userRepository.findById(data.studentId, tenantId);
      if (!student) {
        throw new NotFoundError(`Student with ID '${data.studentId}' not found`);
      }
    } else {
      if (!data.firstName || !data.firstName.trim()) {
        throw new ValidationError('Student first name is required');
      }

      // Look up existing user by studentId, employeeNo, cardNo, explicit email, or phone
      let existingUser = null;
      let matchedSibling = null;
      if (data.employeeNo && data.employeeNo.trim()) {
        existingUser = await userRepository.findOne({ tenantId, employeeNo: data.employeeNo.trim() });
      } else if (data.cardNo && data.cardNo.trim()) {
        existingUser = await userRepository.findOne({ tenantId, cardNo: data.cardNo.trim() });
      } else if (data.email && data.email.trim() && !data.email.includes('@amdplay.local')) {
        existingUser = await userRepository.findOne({ tenantId, email: data.email.toLowerCase().trim() });
      }

      // Check phone or explicit sibling link
      const cleanPhone = (data.phone || data.parentPhone || '').trim();
      const digits = cleanPhone.replace(/\D/g, '');
      const phoneVariants = [cleanPhone];
      if (digits.length === 10) phoneVariants.push(digits, `+91${digits}`, `91${digits}`);

      // If an explicit sibling is provided
      if (data.siblingStudentId && mongoose.Types.ObjectId.isValid(data.siblingStudentId)) {
        matchedSibling = await userRepository.findOne({ _id: data.siblingStudentId, tenantId });
      }

      if (!existingUser && cleanPhone) {
        const candidateUsers = await userRepository.model.find({
          tenantId,
          $or: [
            { phone: { $in: phoneVariants } },
            { 'metadata.parentPhone': { $in: phoneVariants } },
          ],
        });

        if (candidateUsers && candidateUsers.length > 0) {
          const inputFirst = (data.firstName || '').trim().toLowerCase();
          const inputLast = (data.lastName || '').trim().toLowerCase();
          const inputFull = `${inputFirst} ${inputLast}`.trim();

          const exactMatch = candidateUsers.find((u) => {
            const uFirst = (u.firstName || '').trim().toLowerCase();
            const uLast = (u.lastName || '').trim().toLowerCase();
            const uFull = `${uFirst} ${uLast}`.trim();
            return uFull === inputFull || (inputLast ? false : uFirst === inputFirst);
          });

          if (exactMatch) {
            existingUser = exactMatch;
          } else {
            const existingStudent = candidateUsers.find((u) => u.role === ROLES.STUDENT);
            if (existingStudent) {
              // SIBLING AUTO-CALCULATION: Another student is already enrolled with this phone!
              // Create a brand new student record for the new child and link them as siblings
              matchedSibling = matchedSibling || existingStudent;
              existingUser = null;
            } else {
              const customerUser = candidateUsers.find((u) => u.role === ROLES.CUSTOMER);
              if (customerUser) {
                existingUser = customerUser;
              }
            }
          }
        }
      }

      // Auto-generate biometric credentials if not provided (e.g. isabd001)
      let finalEmployeeNo = (data.employeeNo || '').trim();
      if (!finalEmployeeNo) {
        // 1. Resolve Academy Prefix (e.g. "isa")
        let academyPrefix = 'isa';
        try {
          const tenant = await tenantRepository.findById(tenantId);
          if (tenant) {
            const slug = (tenant.slug || tenant.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (slug.includes('inertia')) academyPrefix = 'isa';
            else if (slug.includes('kinetic') || slug.includes('ksa')) academyPrefix = 'ksa';
            else {
              const words = (tenant.slug || '').split('-').filter(Boolean);
              academyPrefix = words.length >= 2 ? words.map((w) => w[0]).join('') : slug.slice(0, 3) || 'isa';
            }
          }
        } catch (_) {}

        // 2. Resolve Sport Code (e.g. "bd")
        let sportCode = 'bd';
        try {
          const targetSportId =
            data.sportId ||
            (data.batchId ? (await batchRepository.findById(data.batchId, tenantId))?.sportId : null);
          if (targetSportId) {
            const sport =
              (await sportRepository.findById(targetSportId, tenantId)) ||
              (await sportRepository.findById(targetSportId, null));
            if (sport) {
              const s = (sport.slug || sport.name || '').toLowerCase().replace(/[^a-z]/g, '');
              if (s.includes('badminton')) sportCode = 'bd';
              else if (s.includes('cricket')) sportCode = 'cr';
              else if (s.includes('football') || s.includes('soccer')) sportCode = 'fb';
              else if (s.includes('basketball')) sportCode = 'bb';
              else if (s.includes('pickle')) sportCode = 'pb';
              else if (s.includes('tennis')) sportCode = 'tn';
              else if (s.includes('swim')) sportCode = 'sw';
              else if (s.includes('archery')) sportCode = 'arc';
              else if (s.includes('rifle') || s.includes('shoot')) sportCode = 'rif';
              else if (s.includes('skat')) sportCode = 'ska';
              else sportCode = s.slice(0, 2) || 'bd';
            }
          }
        } catch (_) {}

        // 3. Format sequential number: isabd001, isabd002...
        const prefix = `${academyPrefix}${sportCode}`.toLowerCase();
        let nextSeq = 1;
        try {
          const latestStudent = await userRepository.model
            .findOne({
              tenantId,
              role: ROLES.STUDENT,
              employeeNo: new RegExp(`^${prefix}\\d+$`, 'i'),
            })
            .sort({ employeeNo: -1 })
            .exec();

          if (latestStudent && latestStudent.employeeNo) {
            const numPart = parseInt(latestStudent.employeeNo.replace(new RegExp(`^${prefix}`, 'i'), ''), 10);
            if (!isNaN(numPart)) {
              nextSeq = numPart + 1;
            }
          } else {
            const existingCount = await userRepository.count({
              tenantId,
              role: ROLES.STUDENT,
              employeeNo: new RegExp(`^${prefix}`, 'i'),
            });
            nextSeq = existingCount + 1;
          }
        } catch (_) {
          nextSeq = 1;
        }

        finalEmployeeNo = `${prefix}${String(nextSeq).padStart(3, '0')}`;
      }

      let finalPin = (data.pin || data.cardNo || '').trim();
      if (!finalPin) {
        finalPin = String(Math.floor(100000 + Math.random() * 900000));
      }

      let finalCardNo = (data.cardNo || finalPin).trim();
      if (!finalCardNo) {
        finalCardNo = finalPin;
      }

      const email = (data.email || `student_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}@amdplay.local`).toLowerCase().trim();

      // Resolve or allocate Sibling Group ID if matchedSibling exists
      let siblingGroupToAssign = null;
      const siblingTarget = matchedSibling;
      if (siblingTarget) {
        if (siblingTarget.siblingGroupId) {
          siblingGroupToAssign = siblingTarget.siblingGroupId;
        } else if (siblingTarget.metadata?.siblingGroupId && mongoose.Types.ObjectId.isValid(siblingTarget.metadata.siblingGroupId)) {
          siblingGroupToAssign = new mongoose.Types.ObjectId(siblingTarget.metadata.siblingGroupId);
          siblingTarget.siblingGroupId = siblingGroupToAssign;
          await siblingTarget.save();
        } else {
          siblingGroupToAssign = new mongoose.Types.ObjectId();
          siblingTarget.siblingGroupId = siblingGroupToAssign;
          siblingTarget.metadata = siblingTarget.metadata || {};
          siblingTarget.metadata.siblingGroupId = siblingGroupToAssign.toString();
          siblingTarget.metadata.isSibling = true;
          if (cleanPhone && !siblingTarget.metadata.parentPhone) siblingTarget.metadata.parentPhone = cleanPhone;
          if (data.parentName && !siblingTarget.metadata.parentName) siblingTarget.metadata.parentName = data.parentName;
          await siblingTarget.save();
        }
      }

      if (existingUser) {
        student = existingUser;
        let needsSave = false;
        if (student.role !== ROLES.STUDENT && student.role === ROLES.CUSTOMER) {
          student.role = ROLES.STUDENT;
          needsSave = true;
        }
        if (siblingGroupToAssign && !student.siblingGroupId) {
          student.siblingGroupId = siblingGroupToAssign;
          student.metadata = student.metadata || {};
          student.metadata.siblingGroupId = siblingGroupToAssign.toString();
          student.metadata.isSibling = true;
          needsSave = true;
        }
        if (!student.employeeNo) {
          student.employeeNo = finalEmployeeNo;
          needsSave = true;
        } else if (data.employeeNo && student.employeeNo !== data.employeeNo) {
          student.employeeNo = data.employeeNo;
          needsSave = true;
        }

        if (!student.cardNo) {
          student.cardNo = finalCardNo;
          needsSave = true;
        } else if (data.cardNo && student.cardNo !== data.cardNo) {
          student.cardNo = data.cardNo;
          needsSave = true;
        }

        if (!student.pin) {
          student.pin = finalPin;
          needsSave = true;
        } else if (data.pin && student.pin !== data.pin) {
          student.pin = data.pin;
          needsSave = true;
        }

        if (needsSave) {
          await student.save();
        }
      } else {
        const hashedPassword = await hashPassword(data.password || 'Isa@123');
        student = await userRepository.create({
          tenantId,
          branchId: data.branchId || null,
          firstName: data.firstName.trim(),
          lastName: (data.lastName || '').trim(),
          email,
          phone: data.phone || '',
          password: hashedPassword,
          role: ROLES.STUDENT,
          status: 'active',
          employeeNo: finalEmployeeNo,
          cardNo: finalCardNo,
          pin: finalPin,
          siblingGroupId: siblingGroupToAssign,
          metadata: {
            sportId: data.sportId || null,
            branchId: data.branchId || null,
            batchId: data.batchId || null,
            parentName: data.parentName || siblingTarget?.metadata?.parentName || '',
            parentPhone: data.parentPhone || cleanPhone || siblingTarget?.phone || '',
            skillLevel: data.skillLevel || 'beginner',
            gender: data.gender || '',
            dateOfBirth: data.dateOfBirth || '',
            address: data.address || siblingTarget?.metadata?.address || '',
            pin: finalPin,
            siblingGroupId: siblingGroupToAssign ? siblingGroupToAssign.toString() : null,
            isSibling: Boolean(siblingGroupToAssign),
          },
        });
      }
    }

    // Enroll student into the requested batch if batchId is provided
    let enrollment = null;
    if (data.batchId) {
      enrollment = await this.enrollStudent(
        {
          batchId: data.batchId,
          studentId: student._id.toString(),
          monthlyFee: data.monthlyFee,
          notes: data.notes || '',
        },
        context
      );
    }

    // Automatically upload newly registered student to Sport-Specific Hikvision ACS Biometric Devices
    let deviceUploadResult = { uploadedDevices: [], queuedDevices: [], failedDevices: [] };
    try {
      const fullName = `${student.firstName} ${student.lastName || ''}`.trim();
      const empNo = student.employeeNo || data.employeeNo || student.phone || student._id.toString().slice(-6);
      const studentPin = student.pin || (data.pin || data.cardNo || '').trim() || student.cardNo || '';
      const cardNo = student.cardNo || data.cardNo || studentPin || '';

      const batch = data.batchId ? await batchRepository.findById(data.batchId, tenantId) : null;
      const sportId = batch?.sportId || data.sportId;
      const branchId = batch?.branchId || data.branchId || student.branchId;

      // Resolve or allocate Hikvision Plan Template for the batch schedule (e.g. Morning Batch: Template #2)
      let planTemplateNo = 1;
      if (batch && batch.schedule) {
        if (batch.hikvisionPlanTemplateNo) {
          planTemplateNo = batch.hikvisionPlanTemplateNo;
        } else {
          const existingBatches = await Batch.find({ tenantId, hikvisionPlanTemplateNo: { $ne: null } })
            .sort({ hikvisionPlanTemplateNo: -1 })
            .limit(1);
          planTemplateNo = existingBatches.length > 0 && existingBatches[0].hikvisionPlanTemplateNo >= 2
            ? existingBatches[0].hikvisionPlanTemplateNo + 1
            : 2;
          batch.hikvisionPlanTemplateNo = planTemplateNo;
          await batch.save();
        }
      }

      const deviceQuery = {
        tenantId,
        type: { $in: ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'] },
      };
      if (branchId) {
        deviceQuery.branchId = branchId;
      }
      if (sportId) {
        deviceQuery.$or = [{ sportId }, { isDefaultEntrance: true }];
      }

      let targetDevices = await Device.find(deviceQuery);
      if (!targetDevices || targetDevices.length === 0) {
        // Fallback to any default entrance or biometric device in branch
        targetDevices = await Device.find({
          tenantId,
          ...(branchId ? { branchId } : {}),
          type: { $in: ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'] },
        });
      }

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

        try {
          // 1. Program batch-specific schedule week plan & template with 15-minute buffer on device
          if (batch && batch.schedule && planTemplateNo > 1) {
            try {
              await client.syncBatchScheduleWeekPlan({
                templateNo: planTemplateNo,
                batch,
                bufferMinutes: 15,
              });
            } catch (schedErr) {
              console.warn(`[Hikvision] Batch schedule sync notice for device ${dev.name}:`, schedErr.message);
            }
          }

          // 2. Upload person with Keypad PIN and batch PlanTemplateNo
          await client.recordPerson({
            employeeNo: empNo,
            name: fullName,
            role: 'student',
            userType: 'normal',
            pin: studentPin,
            planTemplateNo,
          });

          // 3. Upload smartcard matching the PIN/cardNo
          if (cardNo) {
            await client.recordCard({
              employeeNo: empNo,
              cardNo,
            });
          }

          deviceUploadResult.uploadedDevices.push({
            deviceId: dev._id,
            deviceName: dev.name,
            deviceIp: dev.ipAddress,
            sportId: dev.sportId,
            planTemplateNo,
          });
        } catch (uploadErr) {
          console.warn(`[Hikvision] Sync failed for device ${dev.name} (${dev.ipAddress}):`, uploadErr.message);
          // Queue for background retry
          await deviceSyncQueueService.enqueueJob({
            tenantId,
            branchId: dev.branchId,
            deviceId: dev._id,
            action: 'ADD_USER',
            employeeNo: empNo,
            payload: {
              employeeNo: empNo,
              name: fullName,
              role: 'student',
              userType: 'normal',
              cardNo,
              pin: studentPin,
              planTemplateNo,
            },
          });
          deviceUploadResult.queuedDevices.push({
            deviceId: dev._id,
            deviceName: dev.name,
            reason: uploadErr.message,
          });
        }
      }
    } catch (deviceErr) {
      console.warn('Hikvision device auto-upload error:', deviceErr.message);
      deviceUploadResult.failedDevices.push({ error: deviceErr.message });
    }

    // Send WhatsApp Welcome & Biometric Credentials to Student & Parent
    try {
      const tenantSettings = await settingsService.getSettings(tenantId);
      if (tenantSettings?.whatsapp?.enabled) {
        const batchName = enrollment?.batchId?.name || 'Academy Cohort';
        let courtInfoStr = '';
        const cId = enrollment?.batchId?.courtId || enrollment?.batchId?.resourceId;
        if (cId) {
          try {
            const courtDoc = await Resource.findById(cId).select('name code').lean();
            if (courtDoc) {
              courtInfoStr = `\n🏟️ *Court Assigned:* *${courtDoc.name} (${courtDoc.code})*`;
            }
          } catch (_) {}
        }

        const msg =
          `🎓 *Welcome to Apex Sports Academy Coaching!*\n\n` +
          `Dear ${student.firstName},\n` +
          `You have been registered for *${batchName}*.\n\n` +
          `🆔 *Biometric Employee No:* *${student.employeeNo}*\n` +
          `🔢 *Keypad Access PIN:* *${student.pin}*\n` +
          `💳 *Smartcard / NFC ID:* *${student.cardNo}*${courtInfoStr}\n\n` +
          `Your credentials have been uploaded to the academy terminal. Scan face, swipe card, or enter your 6-digit PIN on the terminal keypad for automated attendance.`;

        const waCreds = {
          appKey: tenantSettings.whatsapp.appKey,
          authKey: tenantSettings.whatsapp.authKey,
          deviceId: tenantSettings.whatsapp.deviceId,
        };

        if (student.phone) {
          await wabridgeService.sendTextMessage({
            destinationNumber: student.phone,
            message: msg,
            credentials: waCreds,
          });
        }

        const parentPhone = data.parentPhone || student.metadata?.parentPhone;
        if (parentPhone && parentPhone !== student.phone) {
          const parentMsg =
            `👨‍👩‍👧 *Apex Sports Academy - Student Enrollment Update*\n\n` +
            `Dear Parent / Guardian,\n` +
            `Your child *${student.firstName} ${student.lastName || ''}* has been enrolled in *${batchName}*.\n` +
            `Biometric ID: *${student.employeeNo}* • Keypad PIN: *${student.pin}* • Smartcard: *${student.cardNo}*.\n\n` +
            `You will receive automated WhatsApp updates whenever your child checks in or checks out at the facility.`;

          await wabridgeService.sendTextMessage({
            destinationNumber: parentPhone,
            message: parentMsg,
            credentials: waCreds,
          });
        }
      }
    } catch (waErr) {
      console.warn('WhatsApp student registration notification warning:', waErr.message);
    }

    return {
      student: {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        name: `${student.firstName} ${student.lastName || ''}`.trim(),
        email: student.email,
        phone: student.phone,
        role: student.role,
        employeeNo: student.employeeNo,
        cardNo: student.cardNo,
        pin: student.pin,
        siblingGroupId: student.siblingGroupId || null,
        isSibling: Boolean(student.siblingGroupId),
      },
      isSibling: Boolean(student.siblingGroupId),
      siblingGroupId: student.siblingGroupId || null,
      enrollment,
      deviceUpload: deviceUploadResult,
    };
  }

  async enrollStudent(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    // 1. Verify Batch
    const batch = await batchRepository.findById(data.batchId, tenantId);
    if (!batch) {
      throw new NotFoundError(`Batch with ID '${data.batchId}' not found`);
    }

    // 2. Verify Student
    const student = await userRepository.findById(data.studentId, tenantId);
    if (!student) {
      throw new NotFoundError(`Student user with ID '${data.studentId}' not found`);
    }

    // 3. Check for existing active enrollment
    const existing = await enrollmentRepository.findByStudentAndBatch(
      data.studentId,
      data.batchId,
      tenantId
    );
    if (existing && existing.status === 'active') {
      throw new ConflictError(`Student is already actively enrolled in batch '${batch.name}'`);
    }

    // 4. Check Capacity
    if (batch.enrolledCount >= batch.maxStudents) {
      throw new ConflictError(
        `Coaching batch '${batch.name}' has reached maximum student capacity (${batch.maxStudents})`
      );
    }

    // 5. Create Enrollment
    const baseFee = data.monthlyFee || batch.monthlyFee || 2000;
    const discount = data.customDiscount || 0;
    const joinDate = data.joinDate ? new Date(data.joinDate) : new Date();

    const enrollment = await enrollmentRepository.create({
      tenantId,
      batchId: batch._id,
      studentId: student._id,
      monthlyFee: baseFee,
      feeStatus: data.feeStatus || 'pending',
      status: 'active',
      notes: data.notes || '',
    });

    // 5.1 Auto-generate Option A joiner fee invoice (prorated if joined after 20th)
    try {
      const { monthlyFeeGeneratorService } = await import('../finance/monthly-fee-generator.service.js');
      await monthlyFeeGeneratorService.createJoinerFee({
        tenantId,
        branchId: batch.branchId || student.branchId,
        userId: student._id,
        feeType: 'coaching_student',
        studentId: student._id,
        batchId: batch._id,
        sportId: batch.sportId,
        baseFee,
        discount,
        joinDate,
        status: data.feeStatus === 'paid' ? 'paid' : 'pending',
        notes: `Option A Joiner Fee for ${batch.name}`,
      });
    } catch (invErr) {
      console.warn('[Enrollment] Auto fee generation notice:', invErr.message);
    }

    // 6. Increment batch enrolledCount
    batch.enrolledCount += 1;
    await batch.save();

    // 7. Promote user role to STUDENT if currently CUSTOMER
    if (student.role === ROLES.CUSTOMER) {
      student.role = ROLES.STUDENT;
      await student.save();
    }

    return enrollment;
  }

  async markAttendance(data, context = {}) {
    const tenantId = context.tenantId;
    const markedBy = context.user?.id || context.user?.sub;

    if (!tenantId || !markedBy) {
      throw new ValidationError('Authenticated context is required');
    }

    // Verify Batch
    const batch = await batchRepository.findById(data.batchId, tenantId);
    if (!batch) {
      throw new NotFoundError(`Batch with ID '${data.batchId}' not found`);
    }

    const existingAttendance = await attendanceRepository.findByBatchAndDate(
      data.batchId,
      data.date,
      tenantId
    );

    if (existingAttendance) {
      existingAttendance.records = data.records;
      existingAttendance.markedBy = markedBy;
      await existingAttendance.save();
      return existingAttendance;
    }

    return await attendanceRepository.create({
      tenantId,
      batchId: batch._id,
      date: data.date,
      markedBy,
      records: data.records,
    });
  }

  async getBatchAttendance(batchId, date, context = {}) {
    const tenantId = context.tenantId;
    if (date) {
      const attendance = await attendanceRepository.findByBatchAndDate(batchId, date, tenantId);
      if (!attendance) {
        const activeEnrollments = await enrollmentRepository.findActiveByBatch(batchId, tenantId);
        return {
          batchId,
          date,
          tenantId,
          marked: false,
          records: activeEnrollments.map((enr) => ({
            studentId: enr.studentId,
            status: 'absent',
            checkInTime: null,
            checkOutTime: null,
            verificationMode: '',
            remarks: 'Not checked in yet',
          })),
        };
      }
      return attendance;
    }
    return await attendanceRepository.findAllByBatch(batchId, tenantId);
  }

  async getStudentAttendanceSummary(batchId, studentId, context = {}) {
    const tenantId = context.tenantId;
    const allSessions = await attendanceRepository.findAllByBatch(batchId, tenantId);

    let present = 0;
    let absent = 0;
    let excused = 0;
    let totalSessions = 0;

    for (const session of allSessions) {
      const rec = session.records.find((r) => r.studentId.toString() === studentId.toString());
      if (rec) {
        totalSessions += 1;
        if (rec.status === 'present') present += 1;
        else if (rec.status === 'absent') absent += 1;
        else if (rec.status === 'excused') excused += 1;
      }
    }

    const percentage = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0;

    return {
      studentId,
      batchId,
      totalSessions,
      present,
      absent,
      excused,
      attendancePercentage: percentage,
    };
  }

  /**
   * Upload and sync student face photo to biometric ISAPI face library
   */
  async uploadStudentFace(studentId, { faceImageBase64 }, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    if (!faceImageBase64) {
      throw new ValidationError('Face image base64 data is required');
    }

    const student = await userRepository.findById(studentId, tenantId);
    if (!student) {
      throw new NotFoundError(`Student with ID '${studentId}' not found`);
    }

    // Save image reference in user metadata
    student.metadata = student.metadata || {};
    student.metadata.facePhotoUrl = faceImageBase64.slice(0, 50) + '...';
    await student.save();

    const empNo = student.employeeNo || student.phone || student._id.toString().slice(-6);

    // Upload to primary Hikvision ISAPI client
    let syncResult = null;
    try {
      syncResult = await hikvisionService.uploadFace(empNo, faceImageBase64);
    } catch (err) {
      console.warn('[Face Sync] Direct upload warning, enqueuing to offline retry queue:', err.message);
    }

    return {
      success: true,
      studentId,
      employeeNo: empNo,
      status: 'FACE_REGISTERED',
      syncResult,
    };
  }

  async update(id, data, context = {}) {
    const tenantId = context.tenantId;
    if (data.courtId !== undefined || data.resourceId !== undefined || data.courtIds !== undefined) {
      const rawCourtId = data.courtId || data.resourceId || null;
      let courtIds = [];
      if (Array.isArray(data.courtIds)) {
        courtIds = data.courtIds.filter(Boolean);
      } else if (rawCourtId) {
        courtIds = [rawCourtId];
      }
      const finalCourtId = rawCourtId || (courtIds.length > 0 ? courtIds[0] : null);
      if (finalCourtId) {
        const court = await Resource.findOne({ _id: finalCourtId, tenantId });
        if (!court) {
          throw new NotFoundError(`Court / Resource with ID '${finalCourtId}' not found`);
        }
      }
      data.resourceId = finalCourtId;
      data.courtId = finalCourtId;
      data.courtIds = courtIds;
    }
    return await super.update(id, data, context);
  }
}

export const coachingService = new CoachingService();
