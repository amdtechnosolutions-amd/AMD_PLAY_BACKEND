import { evaluationService } from './evaluation.service.js';
import { apiSuccess } from '../../utils/response.js';

export class EvaluationController {
  _extractContext(request) {
    return {
      tenantId: request.tenantId || request.user?.tenantId,
      branchId: request.branchId || request.user?.branchId,
      user: request.user,
    };
  }

  async getTemplate(req, reply) {
    const template = evaluationService.getTemplate();
    return reply.status(200).send(
      apiSuccess({
        message: 'Assessment scorecard template retrieved',
        data: template,
      })
    );
  }

  async createEvaluation(req, reply) {
    const context = this._extractContext(req);
    const body = { ...req.body };
    if (req.params?.id && !body.studentId) {
      body.studentId = req.params.id;
    }
    const result = await evaluationService.createEvaluation(body, context);
    return reply.status(201).send(
      apiSuccess({
        message: 'Coach performance feedback submitted successfully',
        data: result,
      })
    );
  }

  async updateEvaluation(req, reply) {
    const context = this._extractContext(req);
    const result = await evaluationService.updateEvaluation(req.params.id, req.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Evaluation updated successfully',
        data: result,
      })
    );
  }

  async getEvaluationById(req, reply) {
    const context = this._extractContext(req);
    const result = await evaluationService.getEvaluationById(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Evaluation report retrieved successfully',
        data: result,
      })
    );
  }

  async listEvaluations(req, reply) {
    const context = this._extractContext(req);
    const { page, limit, ...filters } = req.query || {};
    const pagination = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    };
    const result = await evaluationService.listEvaluations(filters, pagination, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Evaluations retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async deleteEvaluation(req, reply) {
    const context = this._extractContext(req);
    const result = await evaluationService.deleteEvaluation(req.params.id, context);
    return reply.status(200).send(apiSuccess(result));
  }

  async getStudentEvaluations(req, reply) {
    const context = this._extractContext(req);
    const result = await evaluationService.getStudentEvaluationReports(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Student evaluation reports and progression retrieved',
        data: result,
      })
    );
  }

  async getStudentLatestEvaluation(req, reply) {
    const context = this._extractContext(req);
    const report = await evaluationService.getStudentEvaluationReports(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Latest evaluation report retrieved',
        data: report.latestEvaluation || null,
      })
    );
  }

  async getMyEvaluations(req, reply) {
    const context = this._extractContext(req);
    const studentId = req.user?.id || req.user?.sub;
    const result = await evaluationService.getStudentEvaluationReports(studentId, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Personal performance scorecard retrieved',
        data: result,
      })
    );
  }

  async getMyLatestEvaluation(req, reply) {
    const context = this._extractContext(req);
    const studentId = req.user?.id || req.user?.sub;
    const report = await evaluationService.getStudentEvaluationReports(studentId, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Latest performance scorecard retrieved',
        data: report.latestEvaluation || null,
      })
    );
  }
}

export const evaluationController = new EvaluationController();
