import { AuthorizationError } from '../errors/AppError.js';
import { ROLES } from '../config/constants.js';

/**
 * Granular Permission Checker Middleware
 * Verifies that the authenticated user possesses all required permissions.
 *
 * @param {...string} requiredPermissions
 */
export const requirePermissions = (...requiredPermissions) => {
  return async (request, _reply) => {
    if (!request.user) {
      throw new AuthorizationError('Authentication required to verify permissions');
    }

    // Super Admin has unrestricted platform access
    if (request.user.role === ROLES.SUPER_ADMIN) {
      return;
    }

    const userPermissions = new Set(request.user.permissions || []);

    // Tenant owner and tenant admin have wildcards for their tenant
    if (request.user.role === ROLES.TENANT_OWNER || request.user.role === ROLES.TENANT_ADMIN) {
      return;
    }

    const hasAll = requiredPermissions.every((perm) => userPermissions.has(perm));

    if (!hasAll) {
      throw new AuthorizationError(
        `Missing required permissions: ${requiredPermissions.join(', ')}`
      );
    }
  };
};
