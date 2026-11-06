import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { tenantService } from '../src/modules/tenants/tenant.service.js';

/**
 * Production CLI Tenant Onboarding Script
 *
 * Usage:
 *   node scripts/create_tenant.js --name "Smash Arena" --slug "smash-arena" --adminEmail "admin@smasharena.com" --adminPassword "Pass@123"
 *
 * Options:
 *   --name          Name of the sports academy (Required)
 *   --slug          Unique URL slug (Optional, auto-generated from name)
 *   --adminEmail    Tenant Admin Email (Optional, defaults to admin@<slug>.com)
 *   --adminPassword Tenant Admin Password (Optional, defaults to Academy@123)
 *   --adminPhone    Tenant Admin Phone (Optional)
 *   --plan          Subscription plan: free | basic | professional | enterprise (Default: enterprise)
 *   --dbStrategy    Database Strategy: A (Shared DB) or B (Isolated DB) (Default: B)
 *   --city          City of main branch (Default: Bengaluru)
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key.startsWith('--')) {
      const cleanKey = key.slice(2);
      const nextVal = args[i + 1];
      if (nextVal && !nextVal.startsWith('--')) {
        params[cleanKey] = nextVal;
        i++;
      } else {
        params[cleanKey] = true;
      }
    }
  }
  return params;
}

async function createTenantCli() {
  const params = parseArgs();

  if (!params.name) {
    console.error('\n❌ Error: Academy name is required!');
    console.log('Usage example:');
    console.log('  node scripts/create_tenant.js --name "Smash Arena" --slug "smash-arena" --adminEmail "admin@smasharena.com" --adminPassword "SecurePass@123"\n');
    process.exit(1);
  }

  const name = params.name;
  const slug = params.slug || name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const adminEmail = (params.adminEmail || `admin@${slug}.com`).toLowerCase().trim();
  const adminPassword = params.adminPassword || 'Academy@123';
  const adminPhone = params.adminPhone || '9876543210';
  const plan = params.plan || 'enterprise';
  const dbStrategy = params.dbStrategy || 'B';
  const city = params.city || 'Bengaluru';

  console.log('====================================================');
  console.log('🏢 AMD PLAY - Tenant Academy Provisioning');
  console.log('====================================================');
  console.log(`Connecting to Master Database: ${env.MONGO_URI}...`);

  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 8000,
  });

  console.log(`Connected to Master Database: [${mongoose.connection.db.databaseName}]`);
  console.log(`\nProvisioning Academy: "${name}" (${slug})...`);

  try {
    const tenant = await tenantService.createTenant({
      name,
      slug,
      plan,
      dbStrategy,
      contactEmail: adminEmail,
      contactPhone: adminPhone,
      adminUser: {
        firstName: name,
        lastName: 'Admin',
        email: adminEmail,
        password: adminPassword,
        phone: adminPhone,
      },
      address: {
        street: 'Main Campus Road',
        city,
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
      },
    });

    console.log('\n====================================================');
    console.log('🎉 TENANT ACADEMY PROVISIONED SUCCESSFULLY!');
    console.log('====================================================');
    console.log(`🏢 Academy Name:       ${tenant.name}`);
    console.log(`🔗 Slug:               ${tenant.slug}`);
    console.log(`🆔 Tenant ID:          ${tenant._id}`);
    console.log(`🗄️  Database Strategy:  Strategy ${tenant.dbStrategy || dbStrategy}`);
    console.log(`📦 Database Name:      ${tenant.databaseName}`);
    console.log(`🔑 Admin Email:        ${adminEmail}`);
    console.log(`🔒 Admin Password:     ${adminPassword}`);
    console.log(`🌐 Academy Login URL:  /login?tenant=${tenant.slug}`);
    console.log('====================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Failed to provision tenant academy:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createTenantCli();
