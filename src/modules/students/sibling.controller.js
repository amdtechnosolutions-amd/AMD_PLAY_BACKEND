import { siblingService } from './sibling.service.js';
import { apiSuccess } from '../../utils/response.js';

export class SiblingController {
  _extractContext(request) {
    return {
      tenantId: request.tenantId || request.user?.tenantId,
      branchId: request.branchId || request.user?.branchId,
      user: request.user,
    };
  }

  async listSiblingGroups(req, reply) {
    const context = this._extractContext(req);
    const { page, limit, search, q, branchId } = req.query || {};
    const filters = { search: search || q, branchId };
    const pagination = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    };

    const result = await siblingService.listSiblingGroups(filters, pagination, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Sibling families retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async getStudentSiblings(req, reply) {
    const context = this._extractContext(req);
    const result = await siblingService.getStudentSiblings(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Student sibling records retrieved successfully',
        data: result,
      })
    );
  }

  async linkSiblings(req, reply) {
    const context = this._extractContext(req);
    const body = { ...req.body };
    if (req.params?.id && !body.studentId) {
      body.studentId = req.params.id;
    }
    const result = await siblingService.linkSiblings(body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Students linked into sibling family group successfully',
        data: result,
      })
    );
  }

  async assignSiblingPhone(req, reply) {
    const context = this._extractContext(req);
    const result = await siblingService.assignSiblingPhone(req.params.id, req.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Sibling mobile number updated successfully while maintaining family group',
        data: result,
      })
    );
  }

  async unlinkSibling(req, reply) {
    const context = this._extractContext(req);
    const result = await siblingService.unlinkSibling(req.params.id, context);
    return reply.status(200).send(apiSuccess(result));
  }
}

export const siblingController = new SiblingController();
