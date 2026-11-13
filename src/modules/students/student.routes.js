import { studentController } from './student.controller.js';
import { siblingController } from './sibling.controller.js';
import { evaluationController } from '../coaching/evaluation.controller.js';
import { createEvaluationSchema } from '../coaching/evaluation.schema.js';
import { adminResetPasswordSchema } from '../auth/auth.schema.js';
import {
  listSiblingGroupsSchema,
  studentSiblingsParamSchema,
  linkSiblingsSchema,
  assignSiblingPhoneSchema,
} from './sibling.schema.js';
import {
  createStudentSchema,
  queryStudentsSchema,
  studentsDropdownSchema,
  updateStudentSchema,
  studentParamSchema,
  uploadStudentFaceSchema,
  markStudentAttendanceSchema,
  getMyAttendanceSchema,
  getSiblingAttendanceSchema,
  getMyProfileSchema,
  getMySiblingsSchema,
} from './student.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function studentRoutes(fastify) {
  fastify.post('/students', {
    schema: createStudentSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.createStudent.bind(studentController),
  });

  fastify.get('/students', {
    schema: queryStudentsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.listStudents.bind(studentController),
  });

  // Dedicated Universal & Batch-Wise Student Dropdown
  fastify.get('/students/dropdown', {
    schema: studentsDropdownSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.getStudentsDropdown.bind(studentController),
  });

  // Available dynamic skill levels
  fastify.get('/students/skill-levels', {
    schema: {
      description: 'Get dynamic list of coaching skill levels from database for student onboarding dropdowns',
      tags: ['Students Management', 'Skills & Levels Management'],
      querystring: {
        type: 'object',
        properties: {
          sportId: { type: 'string', description: 'Filter by sport ID (e.g. Badminton 6ad6bdead33a91a36c41ff5b)' },
          search: { type: 'string', description: 'Search keyword' },
        },
      },
    },
    preHandler: [fastify.authenticateOptional],
    handler: async (request) => {
      const { skillService } = await import('../skills/skill.service.js');
      const result = await skillService.list(request.query || {}, {}, request);
      return {
        success: true,
        message: 'Skill levels retrieved successfully',
        data: result.items,
      };
    },
  });

  // Logged-in Student personal attendance for Mobile App
  fastify.get('/students/my/attendance', {
    schema: getMyAttendanceSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.getMyAttendance.bind(studentController),
  });

  // Logged-in Student personal profile (supports ?studentId=<siblingId> switcher)
  fastify.get('/students/my/profile', {
    schema: getMyProfileSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.getMyProfile.bind(studentController),
  });

  // Logged-in Student siblings under the same parent contact for Mobile App
  fastify.get('/students/my/siblings', {
    schema: getMySiblingsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.getMySiblings.bind(studentController),
  });

  // Logged-in Student personal monthly fee invoices for Mobile App
  fastify.get('/students/my/fees', {
    schema: {
      description: '[Roles: student] Get personal monthly coaching fee dues and payment receipts (supports ?groupBy=sibling)',
      tags: ['Students Management', 'Finance & Monthly Fees'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          groupBy: { type: 'string', enum: ['sibling', 'none'], description: 'Group fees and payments by sibling profile' },
          format: { type: 'string', description: 'Alternative alias for groupBy' },
        },
      },
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.getMyFees.bind(studentController),
  });

  // Logged-in Student sibling-wise payments, fees & transaction history for Mobile App
  fastify.get('/students/my/payments', {
    schema: {
      description: '[Roles: student] Get consolidated sibling-wise payments, fee dues, and settled receipts for the entire family',
      tags: ['Students Management', 'Finance & Monthly Fees'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.getMyPayments.bind(studentController),
  });

  // Logged-in Student personal performance evaluation scorecard for Mobile App
  fastify.get('/students/my/evaluations', {
    schema: {
      description: '[Roles: student] Get personal performance feedback scorecard, category breakdown, radar chart data, and progress trends',
      tags: ['Students Management', 'Coaching & Evaluations'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: evaluationController.getMyEvaluations.bind(evaluationController),
  });

  fastify.get('/students/my/evaluations/latest', {
    schema: {
      description: '[Roles: student] Get latest detailed performance scorecard with all 24 metric cards',
      tags: ['Students Management', 'Coaching & Evaluations'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: evaluationController.getMyLatestEvaluation.bind(evaluationController),
  });

  // Coach batch attendance marking for Mobile App
  fastify.post('/students/attendance/mark', {
    schema: markStudentAttendanceSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.markAttendance.bind(studentController),
  });

  fastify.get('/students/:id', {
    schema: studentParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.getStudentById.bind(studentController),
  });

  fastify.patch('/students/:id', {
    schema: updateStudentSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.updateStudent.bind(studentController),
  });

  fastify.delete('/students/:id', {
    schema: studentParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.deleteStudent.bind(studentController),
  });

  fastify.post('/students/:id/face', {
    schema: uploadStudentFaceSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.uploadFace.bind(studentController),
  });

  fastify.get('/students/:id/attendance', {
    schema: {
      ...studentParamSchema,
      description: '[Roles: tenant_admin, branch_manager, coach, student] Get detailed attendance history, percentage, and punch logs for a student',
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.getAttendance.bind(studentController),
  });

  fastify.get('/students/:id/fees', {
    schema: {
      ...studentParamSchema,
      description: '[Roles: tenant_admin, branch_manager, coach, student] Get monthly coaching fee invoices and payment status for a student',
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.getFees.bind(studentController),
  });

  // Student payments, fee invoices, and sibling-wise financial breakdown
  fastify.get('/students/:id/payments', {
    schema: {
      ...studentParamSchema,
      description: '[Roles: tenant_admin, branch_manager, coach, student] Get payments, fee invoices, and sibling-wise financial breakdown for a student',
      tags: ['Students Management', 'Finance & Monthly Fees'],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.getStudentPayments.bind(studentController),
  });

  // Student performance evaluation scorecard reports for Coach, Admin, and Student
  fastify.get('/students/:id/evaluations', {
    schema: {
      ...studentParamSchema,
      description: '[Roles: tenant_admin, branch_manager, coach, student] Get complete performance evaluations and progression history for a student',
      tags: ['Students Management', 'Coaching & Evaluations'],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: evaluationController.getStudentEvaluations.bind(evaluationController),
  });

  fastify.get('/students/:id/evaluations/latest', {
    schema: {
      ...studentParamSchema,
      description: '[Roles: tenant_admin, branch_manager, coach, student] Get latest performance scorecard for a student',
      tags: ['Students Management', 'Coaching & Evaluations'],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: evaluationController.getStudentLatestEvaluation.bind(evaluationController),
  });

  // Direct evaluation submission by Coach for student :id
  fastify.post('/students/:id/evaluations', {
    schema: createEvaluationSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: evaluationController.createEvaluation.bind(evaluationController),
  });

  // Direct student password reset by Coach or Admin
  fastify.post('/students/:id/reset-password', {
    schema: adminResetPasswordSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: async (request, reply) => {
      const { AuthService } = await import('../auth/auth.service.js');
      const authService = new AuthService(fastify.jwt.sign.bind(fastify.jwt));
      const result = await authService.adminResetUserPassword(request.params.id, request.body, {
        tenantId: request.tenantId,
        user: request.user,
      });
      return reply.status(200).send({
        success: true,
        message: 'Student password reset successfully',
        data: result,
      });
    },
  });

  // --- Sibling Family Records & CRUD Operations ---
  // List all sibling families in academy
  fastify.get('/students/siblings', {
    schema: listSiblingGroupsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.listSiblingGroups.bind(siblingController),
  });

  // Consolidated sibling-wise payments and fee history for academy or specific sibling family
  fastify.get('/students/siblings/payments', {
    schema: {
      description: '[Roles: tenant_admin, branch_manager, coach, student] Get sibling-wise fee dues, receipts, and payments breakdown by siblingGroupId, studentId, or familyPhone',
      tags: ['Students Management', 'Finance & Monthly Fees'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'Student ID in family' },
          siblingGroupId: { type: 'string', description: 'Sibling Group ID' },
          familyPhone: { type: 'string', description: 'Parent / Family Phone' },
        },
      },
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.getSiblingPayments.bind(studentController),
  });

  // Consolidated sibling-wise attendance and punch history for academy or specific sibling family
  fastify.get('/students/siblings/attendance', {
    schema: getSiblingAttendanceSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: studentController.getSiblingAttendance.bind(studentController),
  });

  // Link two or more students as siblings
  fastify.post('/students/siblings', {
    schema: linkSiblingsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.linkSiblings.bind(siblingController),
  });

  // Get full sibling profiles for a specific student
  fastify.get('/students/:id/siblings', {
    schema: studentSiblingsParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.getStudentSiblings.bind(siblingController),
  });

  // Link a sibling directly to student :id
  fastify.post('/students/:id/siblings', {
    schema: linkSiblingsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.linkSiblings.bind(siblingController),
  });

  // Assign or update a different mobile number for a sibling student while keeping them in the family group
  fastify.patch('/students/siblings/:id', {
    schema: assignSiblingPhoneSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.assignSiblingPhone.bind(siblingController),
  });

  fastify.patch('/students/:id/sibling-phone', {
    schema: assignSiblingPhoneSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.assignSiblingPhone.bind(siblingController),
  });

  // Unlink a student from their sibling family group
  fastify.delete('/students/:id/siblings', {
    schema: studentSiblingsParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.unlinkSibling.bind(siblingController),
  });

  fastify.delete('/students/siblings/:id', {
    schema: studentSiblingsParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.unlinkSibling.bind(siblingController),
  });
}

