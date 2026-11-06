import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Cache for tenant-isolated database connections (Strategy B)
const tenantConnectionCache = new Map();

/**
 * Connect to primary MongoDB database
 */
export const connectDatabase = async (uri = env.MONGO_URI) => {
  try {
    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(uri, {
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info({ host: conn.connection.host, name: conn.connection.name }, 'MongoDB Connected Successfully');

    // Ensure phone index allows non-unique siblings under same tenant
    try {
      const usersColl = conn.connection.collection('users');
      const existingIndexes = await usersColl.indexes();
      const phoneIdx = existingIndexes.find((idx) => idx.name === 'tenantId_1_phone_1');
      if (phoneIdx && phoneIdx.unique) {
        await usersColl.dropIndex('tenantId_1_phone_1');
        logger.info('Migrated tenantId_1_phone_1 index to non-unique for sibling support');
      }
    } catch (_) {}

    return conn;
  } catch (error) {
    logger.error({ err: error }, 'MongoDB Connection Failed');
    throw error;
  }
};

/**
 * Strategy B Resolver: Returns an isolated Mongoose connection for a tenant
 */
export const getTenantConnection = async (tenantId, tenantDbUri) => {
  if (env.DB_STRATEGY === 'A' || !tenantDbUri) {
    // Shared database default
    return mongoose.connection;
  }

  if (tenantConnectionCache.has(tenantId)) {
    return tenantConnectionCache.get(tenantId);
  }

  logger.info({ tenantId }, 'Creating new isolated MongoDB connection for tenant');
  const tenantConn = mongoose.createConnection(tenantDbUri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000,
  });

  tenantConnectionCache.set(tenantId, tenantConn);
  return tenantConn;
};

/**
 * Disconnect all databases gracefully
 */
export const disconnectDatabase = async () => {
  for (const [tenantId, conn] of tenantConnectionCache.entries()) {
    try {
      await conn.close();
      logger.info({ tenantId }, 'Closed tenant DB connection');
    } catch (err) {
      logger.error({ err, tenantId }, 'Error closing tenant connection');
    }
  }
  tenantConnectionCache.clear();
  await mongoose.disconnect();
  logger.info('MongoDB Disconnected');
};

/**
 * Check primary database health
 */
export const isDatabaseHealthy = () => {
  // 1 = connected, 2 = connecting
  return mongoose.connection.readyState === 1;
};
