import pino from 'pino';
import { env } from '../config/env.js';

/**
 * Structured Pino logger with redaction for passwords, PINs, secrets, and auth tokens.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'password',
      'pin',
      'pinCode',
      'secret',
      'token',
      'refreshToken',
      'razorpay_signature',
      'card',
      'cvv',
    ],
    censor: '[REDACTED]',
  },
  transport: env.isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
