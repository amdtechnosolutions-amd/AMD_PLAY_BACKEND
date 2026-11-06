import fp from 'fastify-plugin';
import { connectDatabase, disconnectDatabase, isDatabaseHealthy } from '../config/database.js';

async function databasePlugin(fastify) {
  // Connect on startup unless in test without direct DB call
  await connectDatabase();

  fastify.decorate('isDbHealthy', isDatabaseHealthy);

  fastify.addHook('onClose', async () => {
    await disconnectDatabase();
  });
}

export default fp(databasePlugin, { name: 'databasePlugin' });
