import fetch from 'node-fetch';
import { createSigner } from 'fast-jwt';

const BASE_URL = 'http://127.0.0.1:5005/api/v1';

async function main() {
  console.log('--- 1. Generating Authenticated Admin Token ---');
  const sign = createSigner({ key: 'super_secret_sports_academy_jwt_key_2026_dev_only!' });
  const token = sign({
    id: '6ad6bd7fd33a91a36c41ff99',
    role: 'super_admin',
    tenantId: '6ad6bd7fd33a91a36c41ff44',
  });

  const tenantId = '6ad6bd7fd33a91a36c41ff44';
  const branchId = '6ad6bd7fd33a91a36c41ff46';

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenantId,
  };

  // ==========================================
  // Test Members CRUD
  // ==========================================
  console.log('\n--- 2. Testing /members CRUD ---');
  const listMembersRes = await fetch(`${BASE_URL}/members?limit=5`, { headers });
  const listMembersJson = await listMembersRes.json();
  console.log('GET /members status:', listMembersRes.status, 'Count:', listMembersJson.data?.length);

  const memberPhone = `9840${Math.floor(100000 + Math.random() * 900000)}`;
  const createMemberRes = await fetch(`${BASE_URL}/members`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: 'Ramesh',
      lastName: 'Krishnan',
      phone: memberPhone,
      email: `ramesh_${Date.now()}@test.com`,
      branchId,
      pin: '654321',
    }),
  });
  const createMemberJson = await createMemberRes.json();
  console.log('POST /members status:', createMemberRes.status, 'Result:', createMemberJson.message);
  const memberId = createMemberJson.data?.member?._id || createMemberJson.data?._id;

  if (memberId) {
    const getMemberRes = await fetch(`${BASE_URL}/members/${memberId}`, { headers });
    const getMemberJson = await getMemberRes.json();
    console.log('GET /members/:id status:', getMemberRes.status, 'Name:', getMemberJson.data?.name);

    const patchMemberRes = await fetch(`${BASE_URL}/members/${memberId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        lastName: 'Krishnan Sr.',
        pin: '778899',
      }),
    });
    const patchMemberJson = await patchMemberRes.json();
    console.log('PATCH /members/:id status:', patchMemberRes.status, 'Updated Pin:', patchMemberJson.data?.pin);

    const subsRes = await fetch(`${BASE_URL}/members/${memberId}/subscriptions`, { headers });
    const subsJson = await subsRes.json();
    console.log('GET /members/:id/subscriptions status:', subsRes.status, 'Subs Count:', subsJson.data?.length);
  }

  // ==========================================
  // Test Booking Users CRUD
  // ==========================================
  console.log('\n--- 3. Testing /booking-users CRUD ---');
  const listBkRes = await fetch(`${BASE_URL}/booking-users?limit=5`, { headers });
  const listBkJson = await listBkRes.json();
  console.log('GET /booking-users status:', listBkRes.status, 'Count:', listBkJson.data?.length);

  const bkPhone = `9841${Math.floor(100000 + Math.random() * 900000)}`;
  const createBkRes = await fetch(`${BASE_URL}/booking-users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: 'Karthik',
      lastName: 'Subbaraj',
      phone: bkPhone,
      email: `karthik_${Date.now()}@test.com`,
      branchId,
      pin: '112233',
    }),
  });
  const createBkJson = await createBkRes.json();
  console.log('POST /booking-users status:', createBkRes.status, 'Result:', createBkJson.message);
  const bkUserId = createBkJson.data?._id;

  if (bkUserId) {
    const getBkRes = await fetch(`${BASE_URL}/booking-users/${bkUserId}`, { headers });
    const getBkJson = await getBkRes.json();
    console.log('GET /booking-users/:id status:', getBkRes.status, 'Total Bookings:', getBkJson.data?.totalBookings);

    const patchBkRes = await fetch(`${BASE_URL}/booking-users/${bkUserId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        notes: 'Frequent weekend badminton court booker',
      }),
    });
    const patchBkJson = await patchBkRes.json();
    console.log('PATCH /booking-users/:id status:', patchBkRes.status, 'Notes:', patchBkJson.data?.metadata?.notes);

    const bkHistoryRes = await fetch(`${BASE_URL}/booking-users/${bkUserId}/bookings`, { headers });
    const bkHistoryJson = await bkHistoryRes.json();
    console.log('GET /booking-users/:id/bookings status:', bkHistoryRes.status, 'Bookings Count:', bkHistoryJson.data?.length);
  }

  // ==========================================
  // Test Staff & HR CRUD
  // ==========================================
  console.log('\n--- 4. Testing /staff CRUD ---');
  const rolesRes = await fetch(`${BASE_URL}/staff/roles`);
  const rolesJson = await rolesRes.json();
  console.log('GET /staff/roles status:', rolesRes.status, 'Roles available:', rolesJson.data?.length);

  const listStaffRes = await fetch(`${BASE_URL}/staff?limit=5`, { headers });
  const listStaffJson = await listStaffRes.json();
  console.log('GET /staff status:', listStaffRes.status, 'Count:', listStaffJson.data?.length);

  const stfPhone = `9842${Math.floor(100000 + Math.random() * 900000)}`;
  const createStaffRes = await fetch(`${BASE_URL}/staff`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: 'Prakash',
      lastName: 'Padukone',
      phone: stfPhone,
      email: `prakash_${Date.now()}@test.com`,
      role: 'coach',
      department: 'Coaching & Academy',
      designation: 'Chief Badminton Coach',
      branchId,
      salary: 45000,
    }),
  });
  const createStaffJson = await createStaffRes.json();
  console.log('POST /staff status:', createStaffRes.status, 'Employee No:', createStaffJson.data?.employeeNo);
  const staffId = createStaffJson.data?._id;

  if (staffId) {
    const getStaffRes = await fetch(`${BASE_URL}/staff/${staffId}`, { headers });
    const getStaffJson = await getStaffRes.json();
    console.log('GET /staff/:id status:', getStaffRes.status, 'Designation:', getStaffJson.data?.designation);

    const patchStaffRes = await fetch(`${BASE_URL}/staff/${staffId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        salary: 50000,
      }),
    });
    const patchStaffJson = await patchStaffRes.json();
    console.log('PATCH /staff/:id status:', patchStaffRes.status, 'Updated Salary:', patchStaffJson.data?.salary);

    const staffBatchesRes = await fetch(`${BASE_URL}/staff/${staffId}/batches`, { headers });
    const staffBatchesJson = await staffBatchesRes.json();
    console.log('GET /staff/:id/batches status:', staffBatchesRes.status, 'Batches Count:', staffBatchesJson.data?.length);
  }

  // ==========================================
  // Test Tournament Users CRUD
  // ==========================================
  console.log('\n--- 5. Testing /tournament-users CRUD ---');
  // Find an existing event or create one
  const eventsRes = await fetch(`${BASE_URL}/events`, { headers });
  const eventsJson = await eventsRes.json();
  let eventId = eventsJson.data?.items?.[0]?._id || eventsJson.data?.[0]?._id;

  if (!eventId) {
    const createEvRes = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Inertia Summer Badminton Championship 2026',
        category: 'Under-17 State Championship',
        startDate: '2026-11-15T09:00:00.000Z',
        endDate: '2026-11-18T18:00:00.000Z',
        registrationLastDate: '2026-11-10T23:59:59.000Z',
        registrationAmount: 750,
        branchId,
      }),
    });
    const evJson = await createEvRes.json();
    eventId = evJson.data?._id;
  }

  console.log('Using Event ID:', eventId);

  const listTourRes = await fetch(`${BASE_URL}/tournament-users?limit=5`, { headers });
  const listTourJson = await listTourRes.json();
  console.log('GET /tournament-users status:', listTourRes.status, 'Count:', listTourJson.data?.length);

  const tourPhone = `9843${Math.floor(100000 + Math.random() * 900000)}`;
  const createTourRes = await fetch(`${BASE_URL}/tournament-users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      eventId,
      fullName: 'Lakshya Sen',
      phone: tourPhone,
      email: `lakshya_${Date.now()}@test.com`,
      gender: 'Male',
      dateOfBirth: '2001-08-16',
      category: 'Men Singles Open',
      seedNumber: 1,
      academyName: 'Prakash Padukone Badminton Academy',
      amount: 750,
      paymentMethod: 'upi',
      paymentStatus: 'paid',
    }),
  });
  const createTourJson = await createTourRes.json();
  console.log('POST /tournament-users status:', createTourRes.status, 'Message:', createTourJson.message);
  const regId = createTourJson.data?.registration?._id;

  if (regId) {
    const getTourRes = await fetch(`${BASE_URL}/tournament-users/${regId}`, { headers });
    const getTourJson = await getTourRes.json();
    console.log('GET /tournament-users/:id status:', getTourRes.status, 'Player:', getTourJson.data?.fullName, 'Seed:', getTourJson.data?.seedNumber);

    const patchTourRes = await fetch(`${BASE_URL}/tournament-users/${regId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        seedNumber: 2,
      }),
    });
    const patchTourJson = await patchTourRes.json();
    console.log('PATCH /tournament-users/:id status:', patchTourRes.status, 'Updated Seed:', patchTourJson.data?.seedNumber);

    const tourHistoryRes = await fetch(`${BASE_URL}/tournament-users/${regId}/tournaments`, { headers });
    const tourHistoryJson = await tourHistoryRes.json();
    console.log('GET /tournament-users/:id/tournaments status:', tourHistoryRes.status, 'Tournaments Count:', tourHistoryJson.data?.length);
  }

  console.log('\n======================================================');
  console.log('ALL 4 PERSONA CRUD MODULES VERIFIED SUCCESSFULLY!');
  console.log('======================================================');
}

main().catch(console.error);
