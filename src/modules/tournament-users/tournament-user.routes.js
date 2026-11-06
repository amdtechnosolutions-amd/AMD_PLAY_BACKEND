import { tournamentUserController } from './tournament-user.controller.js';
import {
  createTournamentUserSchema,
  queryTournamentUsersSchema,
  tournamentUserParamSchema,
  updateTournamentUserSchema,
} from './tournament-user.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function tournamentUserRoutes(fastify) {
  fastify.post('/tournament-users', {
    schema: createTournamentUserSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: tournamentUserController.createTournamentUser.bind(tournamentUserController),
  });

  fastify.get('/tournament-users', {
    schema: queryTournamentUsersSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: tournamentUserController.listTournamentUsers.bind(tournamentUserController),
  });

  fastify.get('/tournament-users/:id', {
    schema: tournamentUserParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: tournamentUserController.getTournamentUserById.bind(tournamentUserController),
  });

  fastify.patch('/tournament-users/:id', {
    schema: updateTournamentUserSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: tournamentUserController.updateTournamentUser.bind(tournamentUserController),
  });

  fastify.delete('/tournament-users/:id', {
    schema: tournamentUserParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: tournamentUserController.deleteTournamentUser.bind(tournamentUserController),
  });

  fastify.get('/tournament-users/:id/tournaments', {
    schema: {
      ...tournamentUserParamSchema,
      description: '[Roles: tenant_admin, branch_manager, staff] Get tournament history for a participant',
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: tournamentUserController.getParticipantTournaments.bind(tournamentUserController),
  });
}
