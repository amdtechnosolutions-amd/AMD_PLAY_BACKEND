import { env } from '../src/config/env.js';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';

async function main() {
  const signerApp = Fastify();
  await signerApp.register(fastifyJwt, { secret: env.JWT_SECRET });
  const token = signerApp.jwt.sign({
    id: '6ad6bd7fd33a91a36c41ff99',
    role: 'tenant_admin',
    tenantId: '6ad6bd7fd33a91a36c41ff44',
  });

  const baseUrl = 'http://127.0.0.1:5005';
  console.log('--- 1. Testing GET /api/v1/skills ---');
  const res1 = await fetch(`${baseUrl}/api/v1/skills`);
  const data1 = await res1.json();
  console.log('Status:', res1.status, 'Total items:', data1.data?.length);

  console.log('\n--- 2. Testing POST /api/v1/skills ---');
  const res2 = await fetch(`${baseUrl}/api/v1/skills`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-tenant-id': '6ad6bd7fd33a91a36c41ff44',
    },
    body: JSON.stringify({
      name: 'U-14 State Squad',
      level: 5,
      sportId: '6ad6bdead33a91a36c41ff5b', // Badminton
      branchId: '6ad6bd7fd33a91a36c41ff46',
      description: 'Competitive junior team for district & state tournaments',
      criteria: ['Consistent smash speed > 200 km/h', 'Top 50 state ranking'],
      color: '#8B5CF6',
      active: true,
    }),
  });
  const data2 = await res2.json();
  console.log('Status:', res2.status, 'Created:', data2.data?.name, 'ID:', data2.data?._id);
  const createdId = data2.data?._id;

  if (createdId) {
    console.log('\n--- 3. Testing GET /api/v1/skills/:id ---');
    const res3 = await fetch(`${baseUrl}/api/v1/skills/${createdId}`);
    const data3 = await res3.json();
    console.log('Status:', res3.status, 'Name:', data3.data?.name);

    console.log('\n--- 4. Testing PATCH /api/v1/skills/:id ---');
    const res4 = await fetch(`${baseUrl}/api/v1/skills/${createdId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-tenant-id': '6ad6bd7fd33a91a36c41ff44',
      },
      body: JSON.stringify({
        color: '#7C3AED',
        description: 'Updated: Elite competitive squad for State Championships',
      }),
    });
    const data4 = await res4.json();
    console.log('Status:', res4.status, 'Updated color:', data4.data?.color);

    console.log('\n--- 5. Testing DELETE /api/v1/skills/:id ---');
    const res5 = await fetch(`${baseUrl}/api/v1/skills/${createdId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': '6ad6bd7fd33a91a36c41ff44',
      },
    });
    const data5 = await res5.json();
    console.log('Status:', res5.status, 'Message:', data5.message);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
