import mongoose from 'mongoose';
import { hashPassword } from './src/utils/password.js';
import { User } from './src/modules/users/user.model.js';
import { Role } from './src/modules/roles/role.model.js';
import { ROLES, PERMISSIONS } from './src/config/constants.js';

import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:41111/amd_play';

async function cleanReset() {
  console.log('🧹 Starting Complete Database Wipe & Clean Reset...');
  console.log(`📡 Connecting to ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB.');

  const db = mongoose.connection.db;

  // 1. List all collections in master DB (amd_play) and drop them
  const collections = await db.listCollections().toArray();
  console.log(`\n📦 Found ${collections.length} collections in master database (${db.databaseName}).`);
  for (const col of collections) {
    console.log(`🗑️ Dropping collection: ${col.name}...`);
    await db.collection(col.name).drop().catch((err) => console.log(`  (Notice: ${err.message})`));
  }

  // 2. Drop any tenant databases created during testing or previous runs
  const adminDb = db.admin();
  const dbs = await adminDb.listDatabases();
  const tenantDbs = dbs.databases.filter((d) =>
    (d.name.startsWith('amd_play_') || d.name.startsWith('sports_academy_')) &&
    d.name !== 'amd_play' &&
    d.name !== 'amd_play_test' &&
    d.name !== 'sports_academy_dev' &&
    d.name !== 'sports_academy_test'
  );

  const baseUri = MONGO_URI.substring(0, MONGO_URI.lastIndexOf('/'));
  for (const tDb of tenantDbs) {
    console.log(`🗑️ Dropping isolated tenant database: ${tDb.name}...`);
    const tenantConn = mongoose.createConnection(`${baseUri}/${tDb.name}`);
    await tenantConn.asPromise();
    await tenantConn.dropDatabase();
    await tenantConn.close();
    console.log(`✅ Dropped ${tDb.name}`);
  }

  // 3. Create Default System Roles (Clean Platform Baseline)
  console.log('\n🛡️ Initializing Default System RBAC Roles...');
  const defaultRoles = [
    {
      tenantId: null,
      name: 'Super Administrator',
      slug: ROLES.SUPER_ADMIN,
      description: 'Full unrestricted SaaS platform ownership and tenant management',
      isSystem: true,
      permissions: ['*'],
    },
    {
      tenantId: null,
      name: 'Platform Administrator',
      slug: ROLES.PLATFORM_ADMIN,
      description: 'Platform infrastructure and tenant operations staff',
      isSystem: true,
      permissions: ['*'],
    },
    {
      tenantId: null,
      name: 'Academy Owner / Franchise Admin',
      slug: ROLES.TENANT_OWNER,
      description: 'Complete academy franchise ownership, courts, coaching, finance, and settings',
      isSystem: true,
      permissions: Object.values(PERMISSIONS),
    },
    {
      tenantId: null,
      name: 'Branch Manager',
      slug: ROLES.BRANCH_ADMIN,
      description: 'Branch-level operational management, courts, and daily schedules',
      isSystem: true,
      permissions: [
        PERMISSIONS.RESOURCE_VIEW,
        PERMISSIONS.RESOURCE_EDIT,
        PERMISSIONS.SLOT_VIEW,
        PERMISSIONS.SLOT_HOLD,
        PERMISSIONS.BOOKING_CREATE,
        PERMISSIONS.BOOKING_VIEW,
        PERMISSIONS.BOOKING_CANCEL,
        PERMISSIONS.STUDENT_VIEW,
        PERMISSIONS.ATTENDANCE_MARK,
        PERMISSIONS.ATTENDANCE_VIEW,
      ],
    },
    {
      tenantId: null,
      name: 'Coach / Trainer',
      slug: ROLES.COACH,
      description: 'Batch coaching, student assessments, and attendance marking',
      isSystem: true,
      permissions: [
        PERMISSIONS.SLOT_VIEW,
        PERMISSIONS.STUDENT_VIEW,
        PERMISSIONS.ATTENDANCE_MARK,
        PERMISSIONS.ATTENDANCE_VIEW,
      ],
    },
    {
      tenantId: null,
      name: 'Front Desk / Receptionist',
      slug: ROLES.FRONT_DESK,
      description: 'Walk-in bookings, court check-ins, fee collections',
      isSystem: true,
      permissions: [
        PERMISSIONS.SLOT_VIEW,
        PERMISSIONS.SLOT_HOLD,
        PERMISSIONS.BOOKING_CREATE,
        PERMISSIONS.BOOKING_VIEW,
        PERMISSIONS.PAYMENT_CREATE,
        PERMISSIONS.PAYMENT_VIEW,
        PERMISSIONS.ATTENDANCE_MARK,
      ],
    },
    {
      tenantId: null,
      name: 'Member / Customer',
      slug: ROLES.CUSTOMER,
      description: 'Court bookings, membership plans, and profile management',
      isSystem: true,
      permissions: [PERMISSIONS.SLOT_VIEW, PERMISSIONS.BOOKING_CREATE, PERMISSIONS.BOOKING_VIEW],
    },
    {
      tenantId: null,
      name: 'Student / Trainee',
      slug: ROLES.STUDENT,
      description: 'Coaching batch schedule, attendance logs, and tournament progress',
      isSystem: true,
      permissions: [PERMISSIONS.ATTENDANCE_VIEW],
    },
  ];

  for (const r of defaultRoles) {
    await Role.create(r);
  }
  console.log(`✅ Created ${defaultRoles.length} system RBAC roles.`);

  // 4. Create Pristine SuperAdmin Root User Accounts
  console.log('\n👑 Creating Fresh SuperAdmin User Account...');
  const passwordHash = await hashPassword('Amd@737373');

  const superAdmins = [
    {
      firstName: 'AMD',
      lastName: 'Superadmin',
      email: 'admin@amdtechno.in',
      phone: '9876543210',
      password: passwordHash,
      role: ROLES.SUPER_ADMIN,
      tenantId: null,
      branchId: null,
      status: 'active',
      permissions: ['*'],
    },
  ];

  for (const sa of superAdmins) {
    const created = await User.create(sa);
    console.log(`✅ Created SuperAdmin Root: ${created.email} (ID: ${created._id})`);
  }

  console.log('\n🎉 DATABASE CLEANED & INITIALIZED FROM SCRATCH SUCCESSFULLY!');
  console.log('------------------------------------------------------------');
  console.log('📌 You can now log into the SuperAdmin Console:');
  console.log('   👉 Email:    admin@amdtechno.in');
  console.log('   👉 Password: Amd@737373');
  console.log('   👉 Tenant:   (Leave blank)');
  console.log('------------------------------------------------------------\n');

  await mongoose.disconnect();
  process.exit(0);
}

cleanReset().catch((err) => {
  console.error('❌ Error during clean reset:', err);
  process.exit(1);
});
