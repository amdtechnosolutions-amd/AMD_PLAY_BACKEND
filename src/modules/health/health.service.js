import { isDatabaseHealthy } from '../../config/database.js';
import { isRedisHealthy } from '../../config/redis.js';
import { isMqttHealthy } from '../../config/mqtt.js';
import { env } from '../../config/env.js';

export class HealthService {
  async getOverallHealth() {
    const dbStatus = isDatabaseHealthy() ? 'connected' : 'disconnected';
    const redisStatus = env.REDIS_ENABLED
      ? isRedisHealthy()
        ? 'connected'
        : 'disconnected'
      : 'disabled';
    const mqttStatus = isMqttHealthy() ? 'connected' : 'disconnected';

    const isHealthy = isDatabaseHealthy() && (!env.REDIS_ENABLED || isRedisHealthy());

    return {
      success: isHealthy,
      service: 'sports-academy-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      redis: redisStatus,
      mqtt: mqttStatus,
      environment: env.NODE_ENV,
    };
  }

  async getDatabaseHealth() {
    const connected = isDatabaseHealthy();
    return {
      status: connected ? 'healthy' : 'unhealthy',
      database: connected ? 'connected' : 'disconnected',
    };
  }

  async getRedisHealth() {
    const healthy = isRedisHealthy();
    return {
      status: env.REDIS_ENABLED ? (healthy ? 'healthy' : 'unhealthy') : 'disabled',
      redis: env.REDIS_ENABLED ? (healthy ? 'connected' : 'disconnected') : 'disabled',
    };
  }

  async getMqttHealth() {
    return {
      status: 'healthy',
      mqtt: 'configured',
      url: env.MQTT_URL,
    };
  }
}

export const healthService = new HealthService();
