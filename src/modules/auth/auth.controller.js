import mongoose from 'mongoose';
import { AuthService } from './auth.service.js';
import { apiSuccess } from '../../utils/response.js';
import { User } from '../users/user.model.js';
import { Enrollment } from '../coaching/enrollment.model.js';
import { ROLES } from '../../config/constants.js';
import { resolveUserPermissions } from '../../middleware/permission.middleware.js';

export class AuthController {
  constructor(fastify) {
    this.authService = new AuthService(fastify.jwt.sign.bind(fastify.jwt));
  }

  async register(request, reply) {
    const user = await this.authService.register(request.body);
    return reply.status(201).send(
      apiSuccess({
        message: 'User registered successfully',
        data: user,
      })
    );
  }

  async login(request, reply) {
    const authResult = await this.authService.login(request.body);
    return reply.status(200).send(
      apiSuccess({
        message: 'Login successful',
        data: authResult,
      })
    );
  }

  async superAdminLogin(request, reply) {
    const authResult = await this.authService.superAdminLogin(request.body);
    return reply.status(200).send(
      apiSuccess({
        message: 'Super Admin login successful',
        data: authResult,
      })
    );
  }

  async tenantLogin(request, reply) {
    const authResult = await this.authService.tenantLogin(request.body);
    return reply.status(200).send(
      apiSuccess({
        message: 'Academy login successful',
        data: authResult,
      })
    );
  }

  async coachLogin(request, reply) {
    const authResult = await this.authService.coachLogin(request.body);
    return reply.status(200).send(
      apiSuccess({
        message: 'Coach login successful',
        data: authResult,
      })
    );
  }

  async studentLogin(request, reply) {
    const authResult = await this.authService.studentLogin(request.body);
    return reply.status(200).send(
      apiSuccess({
        message: authResult.requiresSelection ? authResult.message : 'Student login successful',
        data: authResult,
      })
    );
  }

  async switchStudentProfile(request, reply) {
    const targetStudentId = request.body.targetStudentId || request.body.studentId;
    const authResult = await this.authService.switchStudentProfile(targetStudentId, {
      user: request.user,
      tenantId: request.tenantId || request.user?.tenantId,
    });
    return reply.status(200).send(
      apiSuccess({
        message: 'Switched to sibling student profile successfully',
        data: authResult,
      })
    );
  }

  async memberLogin(request, reply) {
    const authResult = await this.authService.memberLogin(request.body);
    return reply.status(200).send(
      apiSuccess({
        message: 'Member login successful',
        data: authResult,
      })
    );
  }

  async registerAndBook(request, reply) {
    const result = await this.authService.registerAndBook(request.body);
    return reply.status(201).send(
      apiSuccess({
        message: 'User registered and court booking confirmed successfully',
        data: result,
      })
    );
  }

  async guestRegister(request, reply) {
    const result = await this.authService.guestRegister(request.body);
    return reply.status(200).send(
      apiSuccess({
        message: result.isExistingCustomer ? 'Welcome back! Customer session initialized' : 'Customer registered successfully',
        data: result,
      })
    );
  }

  async getProfile(request, reply) {
    let fullUser = null;
    const uId = request.user?.id || request.user?.sub;
    if (uId) {
      try {
        fullUser = await User.findById(uId).select('-password').lean();
      } catch (_) {}
    }

    const userData = fullUser || request.user;
    let siblings = [];
    let hasSiblings = false;
    let siblingCount = 0;
    let siblingGroupId = userData?.siblingGroupId || userData?.metadata?.siblingGroupId || null;
    let familyPhone = userData?.metadata?.parentPhone || userData?.phone || '';
    let parentName = userData?.metadata?.parentName || '';

    if (userData && (userData.role === 'student' || userData.role === ROLES.STUDENT)) {
      try {
        const tenantId = request.tenantId || userData.tenantId;
        const siblingCriteria = [];
        if (userData.siblingGroupId) siblingCriteria.push({ siblingGroupId: userData.siblingGroupId });
        if (userData.metadata?.siblingGroupId && mongoose.Types.ObjectId.isValid(userData.metadata.siblingGroupId)) {
          siblingCriteria.push({ siblingGroupId: new mongoose.Types.ObjectId(userData.metadata.siblingGroupId) });
        }
        if (userData.phone) {
          siblingCriteria.push({ phone: userData.phone });
          siblingCriteria.push({ 'metadata.parentPhone': userData.phone });
        }
        if (userData.metadata?.parentPhone) {
          siblingCriteria.push({ phone: userData.metadata.parentPhone });
          siblingCriteria.push({ 'metadata.parentPhone': userData.metadata.parentPhone });
        }

        if (siblingCriteria.length > 0) {
          const docs = await User.find({
            tenantId,
            role: ROLES.STUDENT,
            status: 'active',
            $or: siblingCriteria,
          }).select('-password').lean();

          if (docs.length > 0) {
            const studentMap = new Map();
            studentMap.set(userData._id.toString(), userData);
            for (const d of docs) {
              studentMap.set(d._id.toString(), d);
            }
            const familyStudents = Array.from(studentMap.values());
            hasSiblings = familyStudents.length > 1;
            siblingCount = Math.max(0, familyStudents.length - 1);

            const studentIds = familyStudents.map((s) => s._id);
            const enrollments = await Enrollment.find({
              tenantId,
              studentId: { $in: studentIds },
              status: 'active',
            })
              .populate({
                path: 'batchId',
                select: 'name code schedule sportId',
                populate: { path: 'sportId', select: 'name' },
              })
              .lean();

            siblings = familyStudents.map((st) => {
              const sIdStr = st._id.toString();
              const stEnr = enrollments.filter((e) => e.studentId?.toString() === sIdStr);
              const primary = stEnr[0];
              return {
                id: st._id,
                _id: st._id,
                studentId: st._id,
                firstName: st.firstName,
                lastName: st.lastName || '',
                fullName: `${st.firstName} ${st.lastName || ''}`.trim(),
                employeeNo: st.employeeNo || '',
                regNo: st.employeeNo || '',
                phone: st.phone || '',
                cardNo: st.cardNo || '',
                avatar: st.avatar || '',
                siblingGroupId: st.siblingGroupId || siblingGroupId,
                parentPhone: st.metadata?.parentPhone || familyPhone,
                parentName: st.metadata?.parentName || parentName,
                batchId: primary?.batchId?._id?.toString() || primary?.batchId || null,
                batchName: primary?.batchId?.name || '',
                sportName: primary?.batchId?.sportId?.name || '',
                enrollments: stEnr,
                isCurrent: sIdStr === userData._id.toString(),
                isSelected: sIdStr === userData._id.toString(),
                status: st.status || 'active',
              };
            });
          }
        }
      } catch (_) {}
    }

    const effectivePermissions = resolveUserPermissions(userData?.role, userData?.permissions);

    return reply.status(200).send(
      apiSuccess({
        message: 'Authenticated profile retrieved',
        data: {
          user: {
            ...userData,
            permissions: effectivePermissions,
            primaryRole: userData?.role,
            hasSiblings,
            siblingCount,
            siblingGroupId,
            familyPhone,
            parentName,
            siblings,
          },
          tenantId: request.tenantId || userData?.tenantId,
          branchId: request.branchId || userData?.branchId,
        },
      })
    );
  }

  async forgotPassword(request, reply) {
    const result = await this.authService.forgotPassword(request.body);
    return reply.status(200).send(
      apiSuccess({
        message: 'Password reset OTP generated and dispatched',
        data: result,
      })
    );
  }

  async resetPassword(request, reply) {
    const result = await this.authService.resetPassword(request.body);
    return reply.status(200).send(
      apiSuccess({
        message: 'Password reset successfully',
        data: result,
      })
    );
  }

  async studentResetPassword(request, reply) {
    const result = await this.authService.studentResetPassword(request.body);
    return reply.status(200).send(
      apiSuccess({
        message: 'Student password reset successfully',
        data: result,
      })
    );
  }

  async changePassword(request, reply) {
    const userId = request.user?.id || request.user?.sub;
    const result = await this.authService.changePassword(userId, request.body, {
      tenantId: request.tenantId,
      user: request.user,
    });
    return reply.status(200).send(
      apiSuccess({
        message: 'Password changed successfully',
        data: result,
      })
    );
  }

  async adminResetPassword(request, reply) {
    const targetUserId = request.params.id;
    const result = await this.authService.adminResetUserPassword(targetUserId, request.body, {
      tenantId: request.tenantId,
      user: request.user,
    });
    return reply.status(200).send(
      apiSuccess({
        message: 'User password reset successfully',
        data: result,
      })
    );
  }
}

