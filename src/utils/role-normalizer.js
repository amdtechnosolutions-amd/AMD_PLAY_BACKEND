import { ROLES } from '../config/constants.js';

/**
 * Normalizes any role input (slug, display title, uppercase, mixed case, or alias)
 * into a valid canonical system ROLES enum value.
 */
const ROLE_MAPPINGS = {
  // Super Admin
  'super_admin': ROLES.SUPER_ADMIN,
  'superadmin': ROLES.SUPER_ADMIN,
  'super admin': ROLES.SUPER_ADMIN,
  'super administrator': ROLES.SUPER_ADMIN,

  // Platform Admin
  'platform_admin': ROLES.PLATFORM_ADMIN,
  'platformadmin': ROLES.PLATFORM_ADMIN,
  'platform admin': ROLES.PLATFORM_ADMIN,
  'platform administrator': ROLES.PLATFORM_ADMIN,

  // Tenant Owner / Franchise Admin
  'tenant_owner': ROLES.TENANT_OWNER,
  'tenantowner': ROLES.TENANT_OWNER,
  'tenant owner': ROLES.TENANT_OWNER,
  'academy owner': ROLES.TENANT_OWNER,
  'franchise admin': ROLES.TENANT_OWNER,
  'academy owner / franchise admin': ROLES.TENANT_OWNER,
  'academy owner/franchise admin': ROLES.TENANT_OWNER,

  // Tenant Admin
  'tenant_admin': ROLES.TENANT_ADMIN,
  'tenantadmin': ROLES.TENANT_ADMIN,
  'tenant admin': ROLES.TENANT_ADMIN,
  'academy admin': ROLES.TENANT_ADMIN,

  // Branch Admin / Manager
  'branch_admin': ROLES.BRANCH_ADMIN,
  'branchadmin': ROLES.BRANCH_ADMIN,
  'branch admin': ROLES.BRANCH_ADMIN,
  'branch manager': ROLES.BRANCH_ADMIN,
  'manager': ROLES.MANAGER,

  // Coach / Trainer
  'coach': ROLES.COACH,
  'trainer': ROLES.COACH,
  'coach / trainer': ROLES.COACH,
  'coach/trainer': ROLES.COACH,
  'coach & trainer': ROLES.COACH,
  'head coach': ROLES.COACH,
  'assistant coach': ROLES.COACH,

  // Front Desk / Receptionist
  'front_desk': ROLES.FRONT_DESK,
  'frontdesk': ROLES.FRONT_DESK,
  'front desk': ROLES.FRONT_DESK,
  'receptionist': ROLES.FRONT_DESK,
  'front desk / receptionist': ROLES.FRONT_DESK,
  'front desk/receptionist': ROLES.FRONT_DESK,

  // Member
  'member': ROLES.MEMBER,

  // Customer / Player
  'customer': ROLES.CUSTOMER,
  'player': ROLES.CUSTOMER,

  // Student / Trainee
  'student': ROLES.STUDENT,
  'trainee': ROLES.STUDENT,
  'student / trainee': ROLES.STUDENT,
  'student/trainee': ROLES.STUDENT,

  // Other Staff
  'staff': ROLES.STAFF,
  'accountant': ROLES.ACCOUNTANT,
  'maintenance': ROLES.MAINTENANCE,
  'security': ROLES.SECURITY,
  'parent': ROLES.PARENT,
};

export function normalizeRole(roleInput) {
  if (!roleInput || typeof roleInput !== 'string') {
    return ROLES.CUSTOMER;
  }

  const clean = roleInput.trim().toLowerCase();
  
  if (ROLE_MAPPINGS[clean]) {
    return ROLE_MAPPINGS[clean];
  }

  // Check if it directly matches a ROLES value
  const validRoles = Object.values(ROLES);
  if (validRoles.includes(clean)) {
    return clean;
  }

  // Match by removing slashes/hyphens/spaces
  const simplified = clean.replace(/[\s/_-]+/g, '');
  for (const [key, val] of Object.entries(ROLE_MAPPINGS)) {
    if (key.replace(/[\s/_-]+/g, '') === simplified) {
      return val;
    }
  }

  return clean;
}
