import { tournamentUserService } from './tournament-user.service.js';
import { apiSuccess } from '../../utils/response.js';

export class TournamentUserController {
  _extractContext(request) {
    return {
      tenantId: request.tenantId || request.user?.tenantId,
      branchId: request.user?.branchId,
      user: request.user,
    };
  }

  async createTournamentUser(req, reply) {
    const context = this._extractContext(req);
    const result = await tournamentUserService.createTournamentUser(req.body, context);
    return reply.status(201).send(
      apiSuccess({
        message: 'Tournament participant registered successfully',
        data: result,
      })
    );
  }

  async listTournamentUsers(req, reply) {
    const context = this._extractContext(req);
    const { page, limit, ...filters } = req.query || {};
    const pagination = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    };
    const result = await tournamentUserService.listTournamentUsers(filters, pagination, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Tournament participants retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async getTournamentUserById(req, reply) {
    const context = this._extractContext(req);
    const participant = await tournamentUserService.getTournamentUserById(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Tournament participant profile retrieved',
        data: participant,
      })
    );
  }

  async updateTournamentUser(req, reply) {
    const context = this._extractContext(req);
    const participant = await tournamentUserService.updateTournamentUser(req.params.id, req.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Tournament participant updated successfully',
        data: participant,
      })
    );
  }

  async deleteTournamentUser(req, reply) {
    const context = this._extractContext(req);
    const result = await tournamentUserService.deleteTournamentUser(req.params.id, context);
    return reply.status(200).send(apiSuccess(result));
  }

  async getParticipantTournaments(req, reply) {
    const context = this._extractContext(req);
    const tournaments = await tournamentUserService.getParticipantTournaments(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Participant tournament history retrieved',
        data: tournaments,
      })
    );
  }
}

export const tournamentUserController = new TournamentUserController();
