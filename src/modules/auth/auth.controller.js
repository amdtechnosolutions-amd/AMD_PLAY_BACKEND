import { AuthService } from './auth.service.js';
import { apiSuccess } from '../../utils/response.js';

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
    const authResult = await this.authService.switchStudentProfile(request.body.targetStudentId, {
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
    return reply.status(200).send(
      apiSuccess({
        message: 'Authenticated profile retrieved',
        data: {
          user: request.user,
          tenantId: request.tenantId,
          branchId: request.branchId,
        },
      })
    );
  }
}

