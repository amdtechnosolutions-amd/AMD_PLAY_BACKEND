import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

class LockManager {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.inMemoryStore = new Map(); // Fallback in-memory store for dev/testing
    this._init();
  }

  _init() {
    if (env.REDIS_ENABLED) {
      try {
        this.redis = new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          retryStrategy: (times) => {
            if (times > 3) {
              logger.warn('Redis retry threshold reached. Using in-memory lock store fallback.');
              return null; // Stop retrying
            }
            return Math.min(times * 200, 1000);
          },
        });

        this.redis.on('connect', () => {
          this.isConnected = true;
          logger.info('Redis Connected Successfully');
        });

        this.redis.on('error', (err) => {
          this.isConnected = false;
          logger.warn({ error: err.message }, 'Redis error. Utilizing in-memory lock store fallback.');
        });
      } catch (err) {
        logger.warn({ error: err.message }, 'Redis initialization failed. Using in-memory fallback.');
        this.redis = null;
        this.isConnected = false;
      }
    }
  }

  /**
   * Acquire atomic lock with TTL in seconds
   */
  async acquireLock(key, ttlSeconds = 300, metadata = {}) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const payload = JSON.stringify({ ...metadata, key, expiresAt });

    if (this.isConnected && this.redis) {
      try {
        // Set NX PX (atomic set if not exists with millisecond expiration)
        const result = await this.redis.set(key, payload, 'PX', ttlSeconds * 1000, 'NX');
        if (result === 'OK') {
          return { acquired: true, expiresAt, metadata };
        }
        const existingRaw = await this.redis.get(key);
        return {
          acquired: false,
          existing: existingRaw ? JSON.parse(existingRaw) : null,
        };
      } catch (err) {
        logger.warn({ err: err.message }, 'Redis acquireLock failed. Falling back to in-memory store.');
      }
    }

    // In-Memory Fallback
    const now = Date.now();
    const existing = this.inMemoryStore.get(key);
    if (existing && existing.expiresTimestamp > now) {
      return { acquired: false, existing: existing.data };
    }

    // Clear any previous timer if present
    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      this.inMemoryStore.delete(key);
    }, ttlSeconds * 1000);

    const lockData = { ...metadata, key, expiresAt };
    this.inMemoryStore.set(key, {
      data: lockData,
      expiresTimestamp: now + ttlSeconds * 1000,
      timer,
    });

    return { acquired: true, expiresAt, metadata };
  }

  /**
   * Retrieve active lock info
   */
  async getLock(key) {
    if (this.isConnected && this.redis) {
      try {
        const raw = await this.redis.get(key);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        logger.warn({ err: err.message }, 'Redis getLock failed. Falling back to in-memory.');
      }
    }

    const item = this.inMemoryStore.get(key);
    if (!item) return null;
    if (item.expiresTimestamp <= Date.now()) {
      clearTimeout(item.timer);
      this.inMemoryStore.delete(key);
      return null;
    }
    return item.data;
  }

  /**
   * Release lock with optional ownership check
   */
  async releaseLock(key, ownerId = null, force = false) {
    const current = await this.getLock(key);
    if (!current) {
      return { released: true, message: 'Lock not active or already expired' };
    }

    if (!force && ownerId && current.userId && current.userId.toString() !== ownerId.toString()) {
      return { released: false, message: 'Unauthorized to release this lock' };
    }

    if (this.isConnected && this.redis) {
      try {
        await this.redis.del(key);
      } catch (err) {
        logger.warn({ err: err.message }, 'Redis releaseLock failed.');
      }
    }

    const item = this.inMemoryStore.get(key);
    if (item?.timer) {
      clearTimeout(item.timer);
    }
    this.inMemoryStore.delete(key);

    return { released: true, message: 'Lock released successfully' };
  }

  /**
   * Clear all in-memory timers and disconnect Redis
   */
  async disconnect() {
    for (const [, item] of this.inMemoryStore) {
      if (item.timer) clearTimeout(item.timer);
    }
    this.inMemoryStore.clear();

    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        // ignore
      }
      this.isConnected = false;
    }
  }

  isHealthy() {
    return !env.REDIS_ENABLED || this.isConnected;
  }
}

export const lockManager = new LockManager();
export const acquireLock = lockManager.acquireLock.bind(lockManager);
export const releaseLock = lockManager.releaseLock.bind(lockManager);
export const getLock = lockManager.getLock.bind(lockManager);
export const isRedisHealthy = lockManager.isHealthy.bind(lockManager);
export const disconnectRedis = lockManager.disconnect.bind(lockManager);
