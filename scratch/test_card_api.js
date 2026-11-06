import fetch from 'node-fetch';
import { createSigner } from 'fast-jwt';

const BASE_URL = 'http://127.0.0.1:5005/api/v1';

async function main() {
  const sign = createSigner({ key: 'super_secret_sports_academy_jwt_key_2026_dev_only!' });
  const token = sign({
    id: '6ad6bd7fd33a91a36c41ff99',
    role: 'super_admin',
    tenantId: '6ad6bd7fd33a91a36c41ff44',
  });

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-tenant-id': '6ad6bd7fd33a91a36c41ff44',
  };

  const queries = ['0006244569', '6244569'];

  for (const q of queries) {
    console.log(`\n=== SEARCHING FOR '${q}' ===`);
    
    // 1. Users
    const uRes = await fetch(`${BASE_URL}/users?search=${q}`, { headers });
    const uJson = await uRes.json();
    console.log('/users results:', uJson.data?.length || 0, uJson.data);

    // 2. Students
    const sRes = await fetch(`${BASE_URL}/students?search=${q}`, { headers });
    const sJson = await sRes.json();
    console.log('/students results:', sJson.data?.length || 0, sJson.data);

    // 3. Members
    const mRes = await fetch(`${BASE_URL}/members?search=${q}`, { headers });
    const mJson = await mRes.json();
    console.log('/members results:', mJson.data?.length || 0, mJson.data);

    // 4. Staff
    const stRes = await fetch(`${BASE_URL}/staff?search=${q}`, { headers });
    const stJson = await stRes.json();
    console.log('/staff results:', stJson.data?.length || 0, stJson.data);

    // 5. Booking Users
    const bRes = await fetch(`${BASE_URL}/booking-users?search=${q}`, { headers });
    const bJson = await bRes.json();
    console.log('/booking-users results:', bJson.data?.length || 0, bJson.data);

    // 6. Tournament Users
    const tRes = await fetch(`${BASE_URL}/tournament-users?search=${q}`, { headers });
    const tJson = await tRes.json();
    console.log('/tournament-users results:', tJson.data?.length || 0, tJson.data);
  }
}

main().catch(console.error);
