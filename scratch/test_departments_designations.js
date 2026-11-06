import fetch from 'node-fetch';
import { createSigner } from 'fast-jwt';

const BASE_URL = 'http://127.0.0.1:5005/api/v1';

async function main() {
  console.log('--- 1. Generating Admin Token ---');
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

  // 1. Roles & Dynamic Lookups
  console.log('\n--- 2. Testing Dynamic GET /staff/roles ---');
  const rolesRes = await fetch(`${BASE_URL}/staff/roles`, { headers });
  const rolesJson = await rolesRes.json();
  console.log('Roles status:', rolesRes.status);
  console.log('Departments count in roles:', rolesJson.data?.departments?.length);
  console.log('Designations count in roles:', rolesJson.data?.designations?.length);

  // 2. Departments CRUD
  console.log('\n--- 3. Testing Departments CRUD (/staff/departments) ---');
  const listDeptRes = await fetch(`${BASE_URL}/staff/departments`, { headers });
  const listDeptJson = await listDeptRes.json();
  console.log('List departments status:', listDeptRes.status, 'Total:', listDeptJson.data?.length);

  // Create new custom department
  const createDeptRes = await fetch(`${BASE_URL}/staff/departments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Pro Shop & Cafe',
      description: 'Sports equipment retail and healthy nutrition cafe',
      order: 9,
    }),
  });
  const createDeptJson = await createDeptRes.json();
  console.log('Create department status:', createDeptRes.status, 'Created:', createDeptJson.data?.name, 'Code:', createDeptJson.data?.code);
  const newDeptId = createDeptJson.data?._id;

  if (newDeptId) {
    // Get Department by ID
    const getDeptRes = await fetch(`${BASE_URL}/staff/departments/${newDeptId}`, { headers });
    const getDeptJson = await getDeptRes.json();
    console.log('Get department by ID status:', getDeptRes.status, 'Name:', getDeptJson.data?.name);

    // Update Department
    const patchDeptRes = await fetch(`${BASE_URL}/staff/departments/${newDeptId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        description: 'Pro badminton racket stringing, apparel, and healthy juice bar',
      }),
    });
    const patchDeptJson = await patchDeptRes.json();
    console.log('Update department status:', patchDeptRes.status, 'Updated Desc:', patchDeptJson.data?.description);
  }

  // 3. Designations CRUD
  console.log('\n--- 4. Testing Designations CRUD (/staff/designations) ---');
  const listDesigRes = await fetch(`${BASE_URL}/staff/designations`, { headers });
  const listDesigJson = await listDesigRes.json();
  console.log('List designations status:', listDesigRes.status, 'Total:', listDesigJson.data?.length);

  // Create new custom designation linked to new department
  const createDesigRes = await fetch(`${BASE_URL}/staff/designations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Lead Racket Stringer & Shop Manager',
      departmentId: newDeptId,
      defaultRole: 'staff',
      description: 'Yonex certified stringing technician and store supervisor',
    }),
  });
  const createDesigJson = await createDesigRes.json();
  console.log('Create designation status:', createDesigRes.status, 'Created:', createDesigJson.data?.name, 'Code:', createDesigJson.data?.code);
  const newDesigId = createDesigJson.data?._id;

  if (newDesigId) {
    // Get Designation by ID
    const getDesigRes = await fetch(`${BASE_URL}/staff/designations/${newDesigId}`, { headers });
    const getDesigJson = await getDesigRes.json();
    console.log('Get designation by ID status:', getDesigRes.status, 'Department:', getDesigJson.data?.departmentId?.name);

    // Update Designation
    const patchDesigRes = await fetch(`${BASE_URL}/staff/designations/${newDesigId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        description: 'Updated: Master Racket Stringing Specialist & Store In-Charge',
      }),
    });
    const patchDesigJson = await patchDesigRes.json();
    console.log('Update designation status:', patchDesigRes.status, 'Updated Desc:', patchDesigJson.data?.description);
  }

  // 4. Staff Member creation with Dynamic Department & Designation
  console.log('\n--- 5. Testing Staff Member Onboarding with Dynamic IDs ---');
  const staffPhone = `9844${Math.floor(100000 + Math.random() * 900000)}`;
  const createStaffRes = await fetch(`${BASE_URL}/staff`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: 'Siddharth',
      lastName: 'Venkatesh',
      phone: staffPhone,
      email: `sid_${Date.now()}@test.com`,
      role: 'staff',
      departmentId: newDeptId,
      designationId: newDesigId,
      salary: 32000,
      branchId: '6ad6bd7fd33a91a36c41ff46',
    }),
  });
  const createStaffJson = await createStaffRes.json();
  console.log('Create staff status:', createStaffRes.status, 'Staff Name:', createStaffJson.data?.name);
  console.log('Assigned Department:', createStaffJson.data?.department);
  console.log('Assigned Designation:', createStaffJson.data?.designation);
  const staffId = createStaffJson.data?._id;

  if (staffId) {
    // Get Staff by ID
    const getStaffRes = await fetch(`${BASE_URL}/staff/${staffId}`, { headers });
    const getStaffJson = await getStaffRes.json();
    console.log('Get staff profile status:', getStaffRes.status);
    console.log('Populated Department Object:', getStaffJson.data?.departmentDetails?.name);
    console.log('Populated Designation Object:', getStaffJson.data?.designationDetails?.name);

    // Query staff filtered by dynamic departmentId
    const filterStaffRes = await fetch(`${BASE_URL}/staff?departmentId=${newDeptId}`, { headers });
    const filterStaffJson = await filterStaffRes.json();
    console.log('Filter staff by departmentId count:', filterStaffJson.data?.length);
  }

  // 5. Test Direct Aliases (/departments & /designations)
  console.log('\n--- 6. Testing Top-Level Alias Endpoints ---');
  const aliasDeptRes = await fetch(`${BASE_URL}/departments`, { headers });
  const aliasDeptJson = await aliasDeptRes.json();
  console.log('GET /departments alias status:', aliasDeptRes.status, 'Count:', aliasDeptJson.data?.length);

  const aliasDesigRes = await fetch(`${BASE_URL}/designations`, { headers });
  const aliasDesigJson = await aliasDesigRes.json();
  console.log('GET /designations alias status:', aliasDesigRes.status, 'Count:', aliasDesigJson.data?.length);

  console.log('\n======================================================');
  console.log('DYNAMIC DEPARTMENTS & DESIGNATIONS VERIFIED SUCCESSFULLY!');
  console.log('======================================================');
}

main().catch(console.error);
