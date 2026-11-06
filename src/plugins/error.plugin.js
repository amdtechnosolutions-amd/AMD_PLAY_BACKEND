import fp from 'fastify-plugin';
import { AppError } from '../errors/AppError.js';
import { apiError } from '../utils/response.js';
import { env } from '../config/env.js';

async function errorHandlerPlugin(fastify) {
  fastify.setErrorHandler((error, request, reply) => {
    request.log.error({
      err: error,
      requestId: request.id,
      url: request.raw.url,
      method: request.raw.method,
    }, 'Request Error');

    // 1. Fastify Schema Validation Error
    if (error.validation) {
      const validationDetails = error.validation.map((v) => ({
        field: (v.instancePath || v.params?.missingProperty || 'body').replace(/^\//, ''),
        message: v.message,
      }));

      const errorSummary = validationDetails.map((e) => `${e.field}: ${e.message}`).join(', ');

      return reply.status(400).send(
        apiError({
          message: errorSummary
            ? `Invalid request payload or parameters (${errorSummary})`
            : 'Invalid request payload or parameters',
          code: 'VALIDATION_ERROR',
          errors: validationDetails,
        })
      );
    }

    // 2. Domain / AppError
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(
        apiError({
          message: error.message,
          code: error.code,
          errors: error.errors,
        })
      );
    }

    // 3. Mongoose Duplicate Key Error (code 11000)
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'record';
      return reply.status(409).send(
        apiError({
          message: `A record with this ${duplicateField} already exists`,
          code: 'DUPLICATE_KEY_ERROR',
          errors: [{ field: duplicateField, message: 'Duplicate value detected' }],
        })
      );
    }

    // 4. Fastify HTTP Client / Parser Errors (4xx)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send(
        apiError({
          message: error.message || 'Bad Request',
          code: error.code || 'BAD_REQUEST',
          errors: [],
        })
      );
    }

    // 5. Default Internal Server Error (500)
    const statusCode = error.statusCode && error.statusCode >= 500 && error.statusCode < 600
      ? error.statusCode
      : 500;

    return reply.status(statusCode).send(
      apiError({
        message: env.NODE_ENV === 'production' ? 'An internal server error occurred' : error.message,
        code: 'INTERNAL_SERVER_ERROR',
        errors: env.NODE_ENV === 'development' ? [{ stack: error.stack }] : [],
      })
    );
  });
}

export default fp(errorHandlerPlugin, { name: 'errorHandlerPlugin' });
