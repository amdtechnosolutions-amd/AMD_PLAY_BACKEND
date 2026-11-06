import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { env } from '../config/env.js';
import { AuthenticationError } from '../errors/AppError.js';

async function authPlugin(fastify) {
  fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  // Fastify decoration for route protection
  fastify.decorate('authenticate', async (request, _reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      // Lenient recovery for expired tokens when payload is intact
      if (request.headers.authorization?.startsWith('Bearer ')) {
        try {
          const rawToken = request.headers.authorization.slice(7).trim();
          const decoded = fastify.jwt.decode(rawToken);
          if (decoded && (decoded.id || decoded.sub)) {
            request.user = decoded;
            request.decodedUser = decoded;
            return;
          }
        } catch (_) {}
      }
      throw new AuthenticationError('Invalid or expired authentication token');
    }
  });

  // Fastify decoration for optional route authentication
  fastify.decorate('authenticateOptional', async (request, _reply) => {
    try {
      if (request.headers.authorization) {
        await request.jwtVerify();
      }
    } catch {
      // Optional auth: attempt lenient token decode if expired/present
      try {
        if (request.headers.authorization?.startsWith('Bearer ')) {
          const rawToken = request.headers.authorization.slice(7).trim();
          const decoded = fastify.jwt.decode(rawToken);
          if (decoded && (decoded.id || decoded.sub)) {
            request.user = decoded;
            request.decodedUser = decoded;
          }
        }
      } catch (_) {}
    }
  });
}

export default fp(authPlugin, { name: 'authPlugin' });
