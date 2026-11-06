import { ivrService } from './ivr.service.js';

export class IvrController {
  async handleWebhook(req, reply) {
    const result = await ivrService.handleIncomingWebhook(req.body);
    return reply.status(200).send(result);
  }

  async listLogs(req, reply) {
    const context = { tenantId: req.tenantId || req.user?.tenantId };
    const pagination = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
    };
    const result = await ivrService.listLogs(req.query, pagination, context);
    return reply.status(200).send({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  }
}

export const ivrController = new IvrController();
