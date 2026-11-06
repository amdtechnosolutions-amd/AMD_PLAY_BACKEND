import { sportController } from './sport.controller.js';
import {
  createSportSchema,
  updateSportSchema,
  sportParamSchema,
} from './sport.schema.js';

export default async function sportRoutes(fastify) {
  fastify.get('/sports', {
    schema: {
      description: 'List all sports available in the sports catalog',
      tags: ['Sports & Resources Management'],
    },
    preHandler: [fastify.authenticateOptional],
    handler: sportController.list.bind(sportController),
  });

  fastify.get('/sports/:id', {
    schema: sportParamSchema,
    handler: sportController.getById.bind(sportController),
  });

  fastify.post('/sports', {
    schema: createSportSchema,
    preHandler: [fastify.authenticate],
    handler: sportController.create.bind(sportController),
  });

  fastify.patch('/sports/:id', {
    schema: updateSportSchema,
    preHandler: [fastify.authenticate],
    handler: sportController.update.bind(sportController),
  });

  fastify.delete('/sports/:id', {
    schema: sportParamSchema,
    preHandler: [fastify.authenticate],
    handler: sportController.delete.bind(sportController),
  });
}
