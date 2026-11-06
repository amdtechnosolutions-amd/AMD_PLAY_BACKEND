import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { logger } from './utils/logger.js';
import { env } from './config/env.js';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(zlib.gzip);

// Plugins
import databasePlugin from './plugins/database.plugin.js';
import authPlugin from './plugins/auth.plugin.js';
import swaggerPlugin from './plugins/swagger.plugin.js';
import errorPlugin from './plugins/error.plugin.js';

// Routes
import apiRoutes from './routes/index.js';
import { automatedAttendanceController } from './modules/coaching/automated-attendance.controller.js';

/**
 * Build Fastify application instance
 */
export async function buildApp(opts = {}) {
  const app = Fastify({
    loggerInstance: logger,
    ...opts,
  });

  // Security Headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // Allows Swagger UI inline scripts
    frameguard: false, // Allows embedding Swagger UI in the admin panel iframe
    crossOriginResourcePolicy: false,
  });

  // Cross-Origin Resource Sharing
  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  // Rate Limiting (exempts local development and Swagger UI docs)
  await app.register(fastifyRateLimit, {
    max: env.RATE_LIMIT_MAX || 10000,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW || '1 minute',
    allowList: (req) => {
      const ip = req.ip || req.socket?.remoteAddress || '';
      const url = req.url || '';
      return (
        ip === '127.0.0.1' ||
        ip === 'localhost' ||
        ip === '::1' ||
        ip.endsWith('127.0.0.1') ||
        url.startsWith('/api/docs') ||
        url.startsWith('/documentation') ||
        url.startsWith('/docs') ||
        url.startsWith('/health')
      );
    },
  });

  // Support raw/text/xml/plain/multipart IoT device payloads (Hikvision, biometric terminals)
  // Using direct stream consumer avoids Fastify's strict byte-for-byte Content-Length validation errors
  // caused by embedded device firmware CRLF / boundary differences.
  const parseRawIoTStream = (request, payload, done) => {
    let data = '';
    payload.setEncoding('utf8');
    payload.on('data', (chunk) => {
      data += chunk;
    });
    payload.on('end', () => {
      done(null, data);
    });
    payload.on('error', (err) => {
      done(err);
    });
  };

  app.addContentTypeParser(
    [
      'text/xml',
      'application/xml',
      'text/plain',
      'application/octet-stream',
      'application/x-www-form-urlencoded',
    ],
    parseRawIoTStream
  );

  // Catch-all parser for Hikvision multipart/form-data event notifications
  app.addContentTypeParser(/^multipart\/.*/, parseRawIoTStream);

  // Support empty JSON bodies gracefully (e.g. Flutter/Dio or web clients sending POST without a body)
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (!body || body.length === 0 || (typeof body === 'string' && body.trim() === '')) {
      return done(null, {});
    }
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // Core Plugins
  await app.register(errorPlugin);
  await app.register(databasePlugin);
  await app.register(authPlugin);
  await app.register(swaggerPlugin);

  // Application Routes
  await app.register(apiRoutes);

  // KSA-compatible top-level /api/hikvision alias (for devices configured with legacy path)
  app.get('/api/hikvision', async (request, reply) => {
    return reply.code(200).send('OK');
  });
  app.post('/api/hikvision', {
    onRequest: (request, reply, done) => {
      delete request.headers['content-length'];
      done();
    },
    handler: automatedAttendanceController.handleWebhook.bind(automatedAttendanceController),
  });

  // Global Performance Hooks: Cache-Control & Asynchronous Gzip Compression
  app.addHook('onSend', async (request, reply, payload) => {
    // 1. Set default Cache-Control on successful GET requests
    if (request.method === 'GET' && reply.statusCode === 200 && !reply.getHeader('cache-control')) {
      reply.header('Cache-Control', 'private, no-cache, stale-while-revalidate=5');
    }

    if (!payload) return payload;

    // 2. High-Speed Gzip Compression for JSON/text responses
    const acceptEncoding = request.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip') || reply.getHeader('content-encoding')) {
      return payload;
    }

    const contentType = reply.getHeader('content-type') || '';
    const isCompressible =
      contentType.includes('application/json') ||
      contentType.includes('text/') ||
      contentType.includes('application/javascript');

    if (!isCompressible) {
      return payload;
    }

    const buffer = Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));

    // Only compress payloads larger than 512 bytes
    if (buffer.length < 512) {
      return payload;
    }

    try {
      const compressed = await gzipAsync(buffer, { level: 6 });
      reply.header('Content-Encoding', 'gzip');
      reply.header('Vary', 'Accept-Encoding');
      return compressed;
    } catch (_) {
      return payload;
    }
  });

  return app;
}
