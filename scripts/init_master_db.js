import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';
import { User } from '../src/modules/users/user.model.js';
import { Role } from '../src/modules/roles/role.model.js';
import { Tenant } from '../src/modules/tenants/tenant.model.js';
import { ROLES, PERMISSIONS } from '../src/config/constants.js';

/**
 * Production Master Database (amd_play) Initializer
 *
 * Initializes:
 * 1. Default SaaS System RBAC Roles
 * 2. Root Super Administrator User Account
 * 3. Essential indexes on master collections
 *
 * This script is idempotent (safe to run multiple times).
 * Does NOT populate mock academies, mock bookings, or test data.
 */
async function initMasterDatabase() {
  const masterUri = env.MONGO_URI;
  console.log('====================================================');
  console.log('🚀 AMD PLAY - Master Database Initialization');
  console.log('====================================================');
  console.log(`📡 Connecting to Master MongoDB: ${masterUri}...`);

  await mongoose.connect(masterUri, {
    serverSelectionTimeoutMS: 8000,
  });

  const db = mongoose.connection.db;
  console.log(`✅ Connected successfully to Master Database: [${db.databaseName}]`);

  // 1. Ensure System RBAC Roles
  console.log('\n🛡️  Step 1: Initializing System RBAC Roles...');
  const systemRoles = [
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
      name: 'Tenant Owner / Academy Director',
      slug: ROLES.TENANT_OWNER,
      description: 'Full control over single sports academy, all branches, staff, and finances',
      isSystem: true,
      permissions: [
        PERMISSIONS.TENANT_VIEW,
        PERMISSIONS.TENANT_EDIT,
        PERMISSIONS.BRANCH_CREATE,
        PERMISSIONS.BRANCH_VIEW,
        PERMISSIONS.BRANCH_EDIT,
        PERMISSIONS.USER_CREATE,
        PERMISSIONS.USER_VIEW,
        PERMISSIONS.USER_EDIT,
        PERMISSIONS.SPORT_CREATE,
        PERMISSIONS.SPORT_VIEW,
        PERMISSIONS.SPORT_EDIT,
        PERMISSIONS.RESOURCE_CREATE,
        PERMISSIONS.RESOURCE_VIEW,
        PERMISSIONS.RESOURCE_EDIT,
        PERMISSIONS.SLOT_GENERATE,
        PERMISSIONS.SLOT_VIEW,
        PERMISSIONS.SLOT_LOCK,
        PERMISSIONS.BOOKING_CREATE,
        PERMISSIONS.BOOKING_VIEW,
        PERMISSIONS.BOOKING_EDIT,
        PERMISSIONS.BOOKING_CANCEL,
        PERMISSIONS.PAYMENT_COLLECT,
        PERMISSIONS.FINANCE_VIEW,
        PERMISSIONS.FINANCE_MANAGE,
        PERMISSIONS.MEMBERSHIP_CREATE,
        PERMISSIONS.MEMBERSHIP_VIEW,
        PERMISSIONS.MEMBERSHIP_MANAGE,
        PERMISSIONS.COACHING_CREATE,
        PERMISSIONS.COACHING_VIEW,
        PERMISSIONS.COACHING_MANAGE,
        PERMISSIONS.ATTENDANCE_VIEW,
        PERMISSIONS.ATTENDANCE_MARK,
        PERMISSIONS.ANALYTICS_VIEW,
        PERMISSIONS.IOT_VIEW,
        PERMISSIONS.IOT_CONTROL,
        PERMISSIONS.SETTINGS_VIEW,
        PERMISSIONS.SETTINGS_EDIT,
      ],
    },
    {
      tenantId: null,
      name: 'Academy Administrator',
      slug: ROLES.TENANT_ADMIN,
      description: 'Academy-wide administrative management',
      isSystem: true,
      permissions: [
        PERMISSIONS.TENANT_VIEW,
        PERMISSIONS.BRANCH_VIEW,
        PERMISSIONS.USER_CREATE,
        PERMISSIONS.USER_VIEW,
        PERMISSIONS.USER_EDIT,
        PERMISSIONS.SPORT_VIEW,
        PERMISSIONS.RESOURCE_CREATE,
        PERMISSIONS.RESOURCE_VIEW,
        PERMISSIONS.RESOURCE_EDIT,
        PERMISSIONS.SLOT_GENERATE,
        PERMISSIONS.SLOT_VIEW,
        PERMISSIONS.SLOT_LOCK,
        PERMISSIONS.BOOKING_CREATE,
        PERMISSIONS.BOOKING_VIEW,
        PERMISSIONS.BOOKING_EDIT,
        PERMISSIONS.BOOKING_CANCEL,
        PERMISSIONS.PAYMENT_COLLECT,
        PERMISSIONS.MEMBERSHIP_VIEW,
        PERMISSIONS.MEMBERSHIP_MANAGE,
        PERMISSIONS.COACHING_VIEW,
        PERMISSIONS.COACHING_MANAGE,
        PERMISSIONS.ATTENDANCE_VIEW,
        PERMISSIONS.ATTENDANCE_MARK,
        PERMISSIONS.IOT_VIEW,
        PERMISSIONS.IOT_CONTROL,
      ],
    },
    {
      tenantId: null,
      name: 'Branch Manager',
      slug: ROLES.BRANCH_ADMIN,
      description: 'Day-to-day court operations, staff supervision, and customer walk-ins for assigned branch',
      isSystem: true,
      permissions: [
        PERMISSIONS.BRANCH_VIEW,
        PERMISSIONS.USER_VIEW,
        PERMISSIONS.SPORT_VIEW,
        PERMISSIONS.RESOURCE_VIEW,
        PERMISSIONS.SLOT_VIEW,
        PERMISSIONS.SLOT_LOCK,
        PERMISSIONS.BOOKING_CREATE,
        PERMISSIONS.BOOKING_VIEW,
        PERMISSIONS.BOOKING_EDIT,
        PERMISSIONS.BOOKING_CANCEL,
        PERMISSIONS.PAYMENT_COLLECT,
        PERMISSIONS.ATTENDANCE_VIEW,
        PERMISSIONS.ATTENDANCE_MARK,
        PERMISSIONS.IOT_VIEW,
        PERMISSIONS.IOT_CONTROL,
      ],
    },
    {
      tenantId: null,
      name: 'Head Coach / Trainer',
      slug: ROLES.COACH,
      description: 'Coaching batch management, attendance marking, and player assessments',
      isSystem: true,
      permissions: [
        PERMISSIONS.COACHING_VIEW,
        PERMISSIONS.ATTENDANCE_VIEW,
        PERMISSIONS.ATTENDANCE_MARK,
        PERMISSIONS.SLOT_VIEW,
        PERMISSIONS.BOOKING_VIEW,
      ],
    },
    {
      tenantId: null,
      name: 'Academy Member / Customer',
      slug: ROLES.MEMBER,
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

  for (const roleDef of systemRoles) {
    const existing = await Role.findOne({ slug: roleDef.slug, tenantId: null });
    if (!existing) {
      await Role.create(roleDef);
      console.log(`   ➕ Created System Role: ${roleDef.name} (${roleDef.slug})`);
    } else {
      console.log(`   ✔️  System Role exists: ${roleDef.name} (${roleDef.slug})`);
    }
  }

  // 2. Ensure Master Super Administrator Root Account
  console.log('\n👑 Step 2: Initializing Master SuperAdmin User...');
  const superAdminEmail = (process.env.SUPERADMIN_EMAIL || 'admin@amdtechno.in').toLowerCase().trim();
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'Amd@737373';
  const superAdminFirstName = process.env.SUPERADMIN_FIRST_NAME || 'AMD';
  const superAdminLastName = process.env.SUPERADMIN_LAST_NAME || 'Superadmin';
  const superAdminPhone = process.env.SUPERADMIN_PHONE || '9876543210';

  let superAdmin = await User.findOne({ email: superAdminEmail, role: ROLES.SUPER_ADMIN });
  if (!superAdmin) {
    const passwordHash = await hashPassword(superAdminPassword);
    superAdmin = await User.create({
      firstName: superAdminFirstName,
      lastName: superAdminLastName,
      email: superAdminEmail,
      phone: superAdminPhone,
      password: passwordHash,
      role: ROLES.SUPER_ADMIN,
      tenantId: null,
      branchId: null,
      status: 'active',
      permissions: ['*'],
    });
    console.log(`   ➕ SuperAdmin Root Created: ${superAdmin.email}`);
  } else {
    console.log(`   ✔️  SuperAdmin Root already exists: ${superAdmin.email} (ID: ${superAdmin._id})`);
  }

  // 3. Verify Master DB Collections and Indexes
  console.log('\n📋 Step 3: Verifying Database Indexes...');
  await User.syncIndexes();
  await Role.syncIndexes();
  await Tenant.syncIndexes();
  console.log('   ✔️  Indexes synchronized on [users], [roles], [tenants]');

  const tenantCount = await Tenant.countDocuments();

  console.log('\n====================================================');
  console.log('🎉 MASTER DATABASE (amd_play) READY FOR PRODUCTION!');
  console.log('====================================================');
  console.log(`📌 Master Database:        ${db.databaseName}`);
  console.log(`📌 SuperAdmin Login:       ${superAdminEmail}`);
  console.log(`📌 SuperAdmin Password:    ${superAdminPassword}`);
  console.log(`📌 Existing Active Tenants: ${tenantCount}`);
  console.log('\n💡 Next Steps:');
  console.log('   1. Start your backend service via PM2:');
  console.log('      pm2 start ecosystem.config.cjs');
  console.log('   2. Add your first tenant academy:');
  console.log('      • Via Web UI: Log into SuperAdmin Console');
  console.log('      • Via CLI:    node scripts/create_tenant.js --name "Academy Name" --slug "slug"');
  console.log('      • Via API:    POST /api/v1/academies');
  console.log('====================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

initMasterDatabase().catch((err) => {
  console.error('❌ Master Database Initialization Error:', err);
  process.exit(1);
});
