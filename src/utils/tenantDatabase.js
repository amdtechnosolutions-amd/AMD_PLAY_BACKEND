import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Derives the dedicated MongoDB database name for a tenant.
 * Format: amd_play_<tenant_slug>
 * Example: 'smash-arena' -> 'amd_play_smash_arena'
 */
export function getTenantDatabaseName(tenantSlug) {
  const appPrefix = process.env.APP_NAME || env.APP_NAME || 'amd_play';
  const cleanSlug = (tenantSlug || 'tenant')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${appPrefix}_${cleanSlug}`;
}

/**
 * Derives the MongoDB connection URI for a tenant database,
 * preserving credentials, ports, and query parameters (such as ?authSource=admin).
 */
export function getTenantDatabaseUri(databaseName) {
  try {
    const parsed = new URL(env.MONGO_URI);
    parsed.pathname = `/${databaseName}`;
    return parsed.toString();
  } catch (_) {
    const qIndex = env.MONGO_URI.indexOf('?');
    const query = qIndex !== -1 ? env.MONGO_URI.substring(qIndex) : '';
    const cleanUri = qIndex !== -1 ? env.MONGO_URI.substring(0, qIndex) : env.MONGO_URI;
    const baseUri = cleanUri.substring(0, cleanUri.lastIndexOf('/'));
    return `${baseUri}/${databaseName}${query}`;
  }
}

/**
 * Initializes and provisions the dedicated MongoDB database for a tenant on disk
 * so that it immediately shows up in MongoDB Compass and mongosh.
 */
export async function provisionTenantDatabase(tenant, adminUser = null, defaultBranch = null) {
  const databaseName = tenant.databaseName || getTenantDatabaseName(tenant.slug);
  const dbUri = tenant.dbUri || getTenantDatabaseUri(databaseName);

  logger.info({ tenantSlug: tenant.slug, databaseName, dbUri }, 'Provisioning dedicated MongoDB database for tenant');

  let tenantConn = null;
  try {
    tenantConn = await mongoose.createConnection(dbUri, {
      serverSelectionTimeoutMS: 5000,
    }).asPromise();

    const db = tenantConn.db;

    // 1. Create and seed tenant info in 'tenants' collection
    await db.collection('tenants').updateOne(
      { slug: tenant.slug },
      {
        $set: {
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          status: tenant.status || 'active',
          dbStrategy: tenant.dbStrategy,
          databaseName,
          settings: tenant.settings || {},
          branding: tenant.branding || {},
          contactEmail: tenant.contactEmail,
          contactPhone: tenant.contactPhone,
          provisionedAt: new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    // 2. If adminUser is provided, seed the admin user in 'users' collection of tenant DB
    if (adminUser && adminUser.email) {
      await db.collection('users').updateOne(
        { email: adminUser.email.toLowerCase() },
        {
          $set: {
            firstName: adminUser.firstName || 'Academy',
            lastName: adminUser.lastName || 'Admin',
            email: adminUser.email.toLowerCase(),
            phone: adminUser.phone || '',
            role: 'tenant_admin',
            status: 'active',
            branchId: defaultBranch?._id || null,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    // 3. Seed default flagship branch in 'branches' collection if available
    if (defaultBranch) {
      await db.collection('branches').updateOne(
        { code: defaultBranch.code },
        {
          $set: {
            _id: defaultBranch._id,
            tenantId: tenant._id,
            name: defaultBranch.name,
            code: defaultBranch.code,
            address: defaultBranch.address || {},
            contactPhone: defaultBranch.contactPhone || '',
            contactEmail: defaultBranch.contactEmail || '',
            operatingHours: defaultBranch.operatingHours || [],
            timezone: defaultBranch.timezone || 'Asia/Kolkata',
            status: defaultBranch.status || 'active',
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    // 4. Seed standard sports in 'sports' collection of tenant DB
    const STANDARD_SPORTS = [
      { name: 'Badminton', slug: 'badminton', icon: '🏸', type: 'court', defaultDurationMinutes: 60, minPlayers: 2, maxPlayers: 4 },
      { name: 'Tennis', slug: 'tennis', icon: '🎾', type: 'court', defaultDurationMinutes: 60, minPlayers: 2, maxPlayers: 4 },
      { name: 'Pickleball', slug: 'pickleball', icon: '🏓', type: 'court', defaultDurationMinutes: 60, minPlayers: 2, maxPlayers: 4 },
      { name: 'Football Turf', slug: 'football', icon: '⚽', type: 'turf', defaultDurationMinutes: 60, minPlayers: 10, maxPlayers: 22 },
      { name: 'Cricket Nets', slug: 'cricket', icon: '🏏', type: 'pitch', defaultDurationMinutes: 60, minPlayers: 2, maxPlayers: 12 },
      { name: 'Basketball', slug: 'basketball', icon: '🏀', type: 'court', defaultDurationMinutes: 60, minPlayers: 4, maxPlayers: 10 },
      { name: 'Squash', slug: 'squash', icon: '🎯', type: 'court', defaultDurationMinutes: 60, minPlayers: 2, maxPlayers: 2 },
      { name: 'Table Tennis', slug: 'table-tennis', icon: '🏓', type: 'table', defaultDurationMinutes: 60, minPlayers: 2, maxPlayers: 4 },
    ];

    for (const s of STANDARD_SPORTS) {
      await db.collection('sports').updateOne(
        { slug: s.slug },
        {
          $set: {
            name: s.name,
            slug: s.slug,
            icon: s.icon,
            type: s.type,
            defaultDurationMinutes: s.defaultDurationMinutes,
            minPlayers: s.minPlayers,
            maxPlayers: s.maxPlayers,
            active: true,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    // 5. Initialize remaining core collections with initial schema metadata
    const collectionsToInit = [
      'resources',
      'bookings',
      'memberships',
      'coaching',
      'finance',
      'iot_devices',
      'audit_logs',
    ];

    for (const col of collectionsToInit) {
      const exists = await db.listCollections({ name: col }).hasNext();
      if (!exists) {
        await db.createCollection(col);
      }
    }

    logger.info({ databaseName }, 'Dedicated tenant database provisioned successfully in MongoDB');
    return { databaseName, dbUri };
  } catch (err) {
    logger.error({ err, databaseName }, 'Failed to provision dedicated tenant database');
    throw err;
  } finally {
    if (tenantConn) {
      await tenantConn.close();
    }
  }
}
