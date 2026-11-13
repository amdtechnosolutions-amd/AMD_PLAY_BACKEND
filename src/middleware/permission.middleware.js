import { AuthorizationError } from '../errors/AppError.js';
import { ROLES, DEFAULT_ROLE_PERMISSIONS } from '../config/constants.js';

/**
 * Resolves effective permissions for a given role combined with any explicitly granted permissions.
 *
 * @param {string} role
 * @param {Array<string>} [explicitPermissions=[]]
 * @returns {Array<string>}
 */
export const resolveUserPermissions = (role, explicitPermissions = []) => {
  const defaults = DEFAULT_ROLE_PERMISSIONS[role] || [];
  if (defaults.includes('*')) {
    return ['*'];
  }
  const merged = new Set([
    ...defaults,
    ...(Array.isArray(explicitPermissions) ? explicitPermissions : []),
  ]);
  return Array.from(merged);
};

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

    // Super Admin and Platform Admin have unrestricted platform access
    if (
      request.user.role === ROLES.SUPER_ADMIN ||
      request.user.role === ROLES.PLATFORM_ADMIN
    ) {
      return;
    }

    // Tenant owner and tenant admin have wildcards for their tenant
    if (
      request.user.role === ROLES.TENANT_OWNER ||
      request.user.role === ROLES.TENANT_ADMIN
    ) {
      return;
    }

    // Resolve combined effective permissions (default role + explicit)
    const effectivePermissions = resolveUserPermissions(
      request.user.role,
      request.user.permissions
    );

    if (effectivePermissions.includes('*')) {
      return;
    }

    const userPermissions = new Set(effectivePermissions);
    const hasAll = requiredPermissions.every((perm) => userPermissions.has(perm));

    if (!hasAll) {
      throw new AuthorizationError(
        `Missing required permissions: ${requiredPermissions.join(', ')}`
      );
    }
  };
};
