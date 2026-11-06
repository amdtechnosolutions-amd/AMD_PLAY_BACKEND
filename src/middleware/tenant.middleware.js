import { TenantIsolationError } from '../errors/AppError.js';
import { ROLES } from '../config/constants.js';

/**
 * Tenant Context Middleware
 * Enforces tenant isolation strictly from authenticated server-side user identity.
 * Never trusts tenantId from request body.
 */
export const requireTenantContext = async (request, _reply) => {
  if (!request.user) {
    throw new TenantIsolationError('Tenant context requires an authenticated user');
  }

  // Super Admin can optionally target a specific tenant via header or query for platform management
  if (request.user.role === ROLES.SUPER_ADMIN || request.user.role === ROLES.PLATFORM_ADMIN) {
    const targetTenantId = request.headers['x-tenant-id'] || request.query?.tenantId || request.user.tenantId;
    if (targetTenantId && targetTenantId !== 'all') {
      request.tenantId = targetTenantId;
    } else {
      request.tenantId = null;
    }
    return;
  }

  // Normal users & tenant staff: strictly bound to authenticated tenant
  if (!request.user.tenantId) {
    throw new TenantIsolationError('User is not associated with any active tenant');
  }

  request.tenantId = request.user.tenantId;
  request.branchId = request.user.branchId || request.headers['x-branch-id'] || null;
};

/**
 * Optional Tenant Context Middleware
 * Safely resolves and attaches tenant context without rejecting platform super admins or global users.
 */
export const attachTenantContext = async (request, _reply) => {
  if (!request.user) {
    return;
  }

  if (request.user.role === ROLES.SUPER_ADMIN || request.user.role === ROLES.PLATFORM_ADMIN) {
    const targetTenantId = request.headers['x-tenant-id'] || request.query?.tenantId || request.user.tenantId;
    if (targetTenantId && targetTenantId !== 'all') {
      request.tenantId = targetTenantId;
    } else {
      request.tenantId = null;
    }
    return;
  }

  request.tenantId = request.user.tenantId || null;
  request.branchId = request.user.branchId || request.headers['x-branch-id'] || null;
};
