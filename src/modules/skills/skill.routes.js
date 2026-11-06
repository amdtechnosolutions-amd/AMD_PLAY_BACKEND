import { skillController } from './skill.controller.js';
import {
  createSkillSchema,
  querySkillsSchema,
  skillParamSchema,
  updateSkillSchema,
  deleteSkillSchema,
} from './skill.schema.js';
import { attachTenantContext } from '../../middleware/tenant.middleware.js';

export default async function skillRoutes(fastify) {
  // 1. List all skill levels (with sportId, category, search filters)
  fastify.get('/skills', {
    schema: querySkillsSchema,
    preHandler: [fastify.authenticateOptional, attachTenantContext],
    handler: skillController.list.bind(skillController),
  });

  // Alias /skill-levels for developer convenience
  fastify.get('/skill-levels', {
    schema: {
      ...querySkillsSchema,
      description: 'Alias of /skills: List coaching skill levels with optional sport filter',
    },
    preHandler: [fastify.authenticateOptional, attachTenantContext],
    handler: skillController.list.bind(skillController),
  });

  // 2. Get skill by ID
  fastify.get('/skills/:id', {
    schema: skillParamSchema,
    preHandler: [fastify.authenticateOptional, attachTenantContext],
    handler: skillController.getById.bind(skillController),
  });

  fastify.get('/skill-levels/:id', {
    schema: {
      ...skillParamSchema,
      description: 'Alias of /skills/:id: Get coaching skill level by ID',
    },
    preHandler: [fastify.authenticateOptional, attachTenantContext],
    handler: skillController.getById.bind(skillController),
  });

  // 3. Create new skill level
  fastify.post('/skills', {
    schema: createSkillSchema,
    preHandler: [fastify.authenticate, attachTenantContext],
    handler: skillController.create.bind(skillController),
  });

  fastify.post('/skill-levels', {
    schema: {
      ...createSkillSchema,
      description: 'Alias of /skills: Create a new coaching skill level',
    },
    preHandler: [fastify.authenticate, attachTenantContext],
    handler: skillController.create.bind(skillController),
  });

  // 4. Update skill level
  fastify.patch('/skills/:id', {
    schema: updateSkillSchema,
    preHandler: [fastify.authenticate, attachTenantContext],
    handler: skillController.update.bind(skillController),
  });

  fastify.patch('/skill-levels/:id', {
    schema: {
      ...updateSkillSchema,
      description: 'Alias of /skills/:id: Update coaching skill level',
    },
    preHandler: [fastify.authenticate, attachTenantContext],
    handler: skillController.update.bind(skillController),
  });

  // 5. Delete skill level
  fastify.delete('/skills/:id', {
    schema: deleteSkillSchema,
    preHandler: [fastify.authenticate, attachTenantContext],
    handler: skillController.delete.bind(skillController),
  });

  fastify.delete('/skill-levels/:id', {
    schema: {
      ...deleteSkillSchema,
      description: 'Alias of /skills/:id: Delete coaching skill level',
    },
    preHandler: [fastify.authenticate, attachTenantContext],
    handler: skillController.delete.bind(skillController),
  });
}
