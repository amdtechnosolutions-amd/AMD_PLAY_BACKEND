import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number.parseInt(process.env.PORT || '5000', 10),
  HOST: process.env.HOST || '0.0.0.0',

  APP_NAME: process.env.APP_NAME || 'amd_play',

  MONGO_URI: process.env.NODE_ENV === 'test'
    ? (process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:41111/amd_play_test')
    : (process.env.MONGO_URI || 'mongodb://127.0.0.1:41111/amd_play'),
  DB_STRATEGY: process.env.DB_STRATEGY || 'A', // Strategy A: shared with tenantId, Strategy B: separate DB

  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  REDIS_ENABLED: process.env.REDIS_ENABLED === 'true',

  JWT_SECRET: process.env.JWT_SECRET || 'fallback_dev_jwt_secret_must_change_in_prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'fallback_dev_jwt_refresh_secret',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  MQTT_URL: process.env.MQTT_URL || 'mqtt://localhost:1883',
  MQTT_USERNAME: process.env.MQTT_USERNAME || '',
  MQTT_PASSWORD: process.env.MQTT_PASSWORD || '',
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || 'sports_academy_backend',

  RATE_LIMIT_MAX: Number.parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  RATE_LIMIT_TIME_WINDOW: process.env.RATE_LIMIT_TIME_WINDOW || '1 minute',

  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_mock',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_razorpay_webhook_secret',

  LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'debug'),
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isTest: process.env.NODE_ENV === 'test',
  isProd: process.env.NODE_ENV === 'production',
};
