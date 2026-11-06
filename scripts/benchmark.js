import crypto from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: '/home/amdtechno/projects/amd_play/backend/.env' });

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${signature}`;
}

const secret = process.env.JWT_SECRET || 'fallback_dev_jwt_secret_must_change_in_prod';
const token = signJwt(
  {
    sub: '6ad6bd80d33a91a36c41ff48',
    id: '6ad6bd80d33a91a36c41ff48',
    email: 'inertia@amdtechno.in',
    tenantId: '6ad6bd7fd33a91a36c41ff44',
    branchId: '6ad6bd7fd33a91a36c41ff46',
    role: 'tenant_admin',
    permissions: ['*'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 86400,
  },
  secret
);

const endpoints = [
  { name: 'Analytics Dashboard', path: '/api/v1/analytics/dashboard?startDate=2026-11-03&endDate=2026-11-03' },
  { name: 'Terminal Hardware Status', path: '/api/v1/attendance/automated/status' },
  { name: 'Attendance Punch Logs', path: '/api/v1/attendance/automated/logs?page=1&limit=50' },
  { name: 'Coaching Batches', path: '/api/v1/coaching/batches?page=1&limit=50' },
  { name: 'Sports List', path: '/api/v1/sports' },
  { name: 'Branches List', path: '/api/v1/branches' },
  { name: 'Courts / Resources', path: '/api/v1/resources' },
  { name: 'Membership Plans', path: '/api/v1/memberships/plans' },
  { name: 'Member Subscriptions', path: '/api/v1/memberships/subscriptions' },
  { name: 'Students List', path: '/api/v1/students?page=1&limit=20' },
  { name: 'Members List', path: '/api/v1/members?page=1&limit=20' },
  { name: 'Booking Users List', path: '/api/v1/booking-users?page=1&limit=20' },
  { name: 'Staff / Coaches List', path: '/api/v1/staff?page=1&limit=20' },
  { name: 'Staff Roles & Depts', path: '/api/v1/staff/roles' },
  { name: 'Bookings List', path: '/api/v1/bookings?page=1&limit=20' },
  { name: 'Finance Payments', path: '/api/v1/finance/payments?page=1&limit=20' },
];

async function runBenchmark() {
  console.log('='.repeat(80));
  console.log('⚡ BENCHMARKING ALL API ENDPOINTS (COLD vs CACHED)');
  console.log('='.repeat(80));

  const results = [];

  for (const ep of endpoints) {
    const url = `http://127.0.0.1:5005${ep.path}`;

    // Request 1: Cold
    const t0 = performance.now();
    const res1 = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Encoding': 'gzip',
      },
    });
    const coldDuration = performance.now() - t0;
    const body1 = await res1.arrayBuffer();

    // Request 2: Warm / Cached
    const t1 = performance.now();
    const res2 = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Encoding': 'gzip',
      },
    });
    const cachedDuration = performance.now() - t1;
    const body2 = await res2.arrayBuffer();

    results.push({
      'Endpoint Name': ep.name,
      Status: res1.status,
      'Size (Bytes)': body1.byteLength,
      Compression: res1.headers.get('content-encoding') || 'none',
      'Cold (ms)': `${coldDuration.toFixed(1)} ms`,
      'Cached (ms)': `${cachedDuration.toFixed(1)} ms`,
    });
  }

  console.table(results);
}

runBenchmark().catch(console.error);
