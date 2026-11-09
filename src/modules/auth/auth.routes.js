import { AuthController } from './auth.controller.js';
import {
  registerSchema,
  loginSchema,
  superAdminLoginSchema,
  tenantLoginSchema,
  studentLoginSchema,
  switchStudentProfileSchema,
  memberLoginSchema,
  registerAndBookSchema,
  guestRegisterSchema,
  resetPasswordSchema,
  studentResetPasswordSchema,
  changePasswordSchema,
  adminResetPasswordSchema,
} from './auth.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function authRoutes(fastify) {
  const authController = new AuthController(fastify);

  // Super Admin Dedicated Login
  fastify.post('/auth/superadmin/login', {
    schema: superAdminLoginSchema,
    handler: authController.superAdminLogin.bind(authController),
  });

  // Tenant / Academy Admin Dedicated Login
  fastify.post('/auth/tenant/login', {
    schema: tenantLoginSchema,
    handler: authController.tenantLogin.bind(authController),
  });

  // Independent Student / Trainee Login (Mobile App & Web - Sibling Multi-Profile Aware)
  fastify.post('/auth/student/login', {
    schema: studentLoginSchema,
    handler: authController.studentLogin.bind(authController),
  });

  // Seamless Sibling Profile Switcher for Mobile App
  fastify.post('/auth/student/switch-profile', {
    schema: switchStudentProfileSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: authController.switchStudentProfile.bind(authController),
  });

  // Independent Member Login (Mobile App & Web)
  fastify.post('/auth/member/login', {
    schema: memberLoginSchema,
    handler: authController.memberLogin.bind(authController),
  });

  // Universal Login (Customers, Members, App Users)
  fastify.post('/auth/login', {
    schema: loginSchema,
    handler: authController.login.bind(authController),
  });

  // Customer / Player Registration
  fastify.post('/auth/register', {
    schema: registerSchema,
    handler: authController.register.bind(authController),
  });

  // Instant Player Registration + Direct Court Booking Checkout
  fastify.post('/auth/register-and-book', {
    schema: registerAndBookSchema,
    handler: authController.registerAndBook.bind(authController),
  });

  // Fast Guest Customer Registration & Smart Auto-Match by Phone
  fastify.post('/auth/guest-register', {
    schema: guestRegisterSchema,
    handler: authController.guestRegister.bind(authController),
  });

  fastify.get('/auth/me', {
    schema: {
      description: 'Get authenticated user session profile & tenant context',
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: authController.getProfile.bind(authController),
  });

  // Universal Password Reset (Coach, Admin, Staff, Student)
  fastify.post('/auth/reset-password', {
    schema: resetPasswordSchema,
    handler: authController.resetPassword.bind(authController),
  });

  // Dedicated Student Password Reset (by regNo, phone, or email)
  fastify.post('/auth/student/reset-password', {
    schema: studentResetPasswordSchema,
    handler: authController.studentResetPassword.bind(authController),
  });

  // Authenticated Change Password (Current Password + New Password)
  fastify.post('/auth/change-password', {
    schema: changePasswordSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: authController.changePassword.bind(authController),
  });

  // Admin / Coach direct password reset for a user or student by ID
  fastify.post('/auth/users/:id/reset-password', {
    schema: adminResetPasswordSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: authController.adminResetPassword.bind(authController),
  });
}

