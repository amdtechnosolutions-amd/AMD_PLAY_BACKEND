import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { getTenantDatabaseName, getTenantDatabaseUri, provisionTenantDatabase } from '../src/utils/tenantDatabase.js';

async function migrate() {
  console.log('Connecting to central DB:', env.MONGO_URI);
  await mongoose.connect(env.MONGO_URI);

  const tenants = await mongoose.connection.db.collection('tenants').find().toArray();
  console.log(`Found ${tenants.length} tenants in central database`);

  for (const t of tenants) {
    const databaseName = t.databaseName || getTenantDatabaseName(t.slug);
    const dbUri = t.dbUri || getTenantDatabaseUri(databaseName);

    console.log(`Provisioning database for tenant "${t.name}" (slug: ${t.slug}) -> ${databaseName}`);
    await provisionTenantDatabase({ ...t, databaseName, dbUri });

    await mongoose.connection.db.collection('tenants').updateOne(
      { _id: t._id },
      { $set: { databaseName, dbUri } }
    );
    console.log(`Updated central record for ${t.name} with databaseName: ${databaseName}`);
  }

  const adminDb = mongoose.connection.db.admin();
  const dbs = await adminDb.listDatabases();
  console.log('\n--- Current MongoDB Databases in Cluster ---');
  dbs.databases.forEach(d => console.log(` - ${d.name} (${(d.sizeOnDisk / 1024).toFixed(1)} KB)`));

  await mongoose.disconnect();
  console.log('Migration complete.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
