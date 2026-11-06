import { memberService } from './member.service.js';
import { apiSuccess } from '../../utils/response.js';

export class MemberController {
  _extractContext(request) {
    return {
      tenantId: request.tenantId || request.user?.tenantId,
      branchId: request.user?.branchId,
      user: request.user,
    };
  }

  async createMember(req, reply) {
    const context = this._extractContext(req);
    const result = await memberService.createMember(req.body, context);
    return reply.status(201).send(
      apiSuccess({
        message: 'Member registered and onboarded successfully',
        data: result,
      })
    );
  }

  async listMembers(req, reply) {
    const context = this._extractContext(req);
    const { page, limit, ...filters } = req.query || {};
    const pagination = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    };
    const result = await memberService.listMembers(filters, pagination, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Members retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async getMemberById(req, reply) {
    const context = this._extractContext(req);
    const member = await memberService.getMemberById(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Member profile retrieved',
        data: member,
      })
    );
  }

  async updateMember(req, reply) {
    const context = this._extractContext(req);
    const member = await memberService.updateMember(req.params.id, req.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Member profile updated successfully',
        data: member,
      })
    );
  }

  async deleteMember(req, reply) {
    const context = this._extractContext(req);
    const result = await memberService.deleteMember(req.params.id, context);
    return reply.status(200).send(apiSuccess(result));
  }

  async getMemberSubscriptions(req, reply) {
    const context = this._extractContext(req);
    const subscriptions = await memberService.getMemberSubscriptions(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Member subscriptions retrieved',
        data: subscriptions,
      })
    );
  }
}

export const memberController = new MemberController();
