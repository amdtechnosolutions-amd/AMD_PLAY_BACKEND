import { staffController } from './staff.controller.js';
import {
  createStaffSchema,
  queryStaffSchema,
  staffParamSchema,
  updateStaffSchema,
  createDepartmentSchema,
  queryDepartmentsSchema,
  departmentParamSchema,
  updateDepartmentSchema,
  createDesignationSchema,
  queryDesignationsSchema,
  designationParamSchema,
  updateDesignationSchema,
} from './staff.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function staffRoutes(fastify) {
  // Predefined & dynamic staff roles, departments, and designations for dropdowns
  fastify.get('/staff/roles', {
    schema: {
      description: 'Get available academy staff roles, dynamic departments, and designations for dropdowns',
      tags: ['Staff & HR Management', 'Departments & Designations'],
    },
    preHandler: [fastify.authenticateOptional],
    handler: staffController.getStaffRoles.bind(staffController),
  });

  // =========================================================================
  // DYNAMIC DEPARTMENTS ROUTES
  // =========================================================================

  fastify.post('/staff/departments', {
    schema: createDepartmentSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.createDepartment.bind(staffController),
  });

  fastify.get('/staff/departments', {
    schema: queryDepartmentsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.listDepartments.bind(staffController),
  });

  fastify.get('/staff/departments/:id', {
    schema: departmentParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.getDepartmentById.bind(staffController),
  });

  fastify.patch('/staff/departments/:id', {
    schema: updateDepartmentSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.updateDepartment.bind(staffController),
  });

  fastify.delete('/staff/departments/:id', {
    schema: departmentParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.deleteDepartment.bind(staffController),
  });

  // Direct aliases for top-level /departments
  fastify.post('/departments', {
    schema: createDepartmentSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.createDepartment.bind(staffController),
  });

  fastify.get('/departments', {
    schema: queryDepartmentsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.listDepartments.bind(staffController),
  });

  fastify.get('/departments/:id', {
    schema: departmentParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.getDepartmentById.bind(staffController),
  });

  fastify.patch('/departments/:id', {
    schema: updateDepartmentSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.updateDepartment.bind(staffController),
  });

  fastify.delete('/departments/:id', {
    schema: departmentParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.deleteDepartment.bind(staffController),
  });

  // =========================================================================
  // DYNAMIC DESIGNATIONS ROUTES
  // =========================================================================

  fastify.post('/staff/designations', {
    schema: createDesignationSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.createDesignation.bind(staffController),
  });

  fastify.get('/staff/designations', {
    schema: queryDesignationsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.listDesignations.bind(staffController),
  });

  fastify.get('/staff/designations/:id', {
    schema: designationParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.getDesignationById.bind(staffController),
  });

  fastify.patch('/staff/designations/:id', {
    schema: updateDesignationSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.updateDesignation.bind(staffController),
  });

  fastify.delete('/staff/designations/:id', {
    schema: designationParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.deleteDesignation.bind(staffController),
  });

  // Direct aliases for top-level /designations
  fastify.post('/designations', {
    schema: createDesignationSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.createDesignation.bind(staffController),
  });

  fastify.get('/designations', {
    schema: queryDesignationsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.listDesignations.bind(staffController),
  });

  fastify.get('/designations/:id', {
    schema: designationParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.getDesignationById.bind(staffController),
  });

  fastify.patch('/designations/:id', {
    schema: updateDesignationSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.updateDesignation.bind(staffController),
  });

  fastify.delete('/designations/:id', {
    schema: designationParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.deleteDesignation.bind(staffController),
  });

  // =========================================================================
  // STAFF MEMBERS ROUTES
  // =========================================================================

  fastify.post('/staff', {
    schema: createStaffSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.createStaff.bind(staffController),
  });

  fastify.get('/staff', {
    schema: queryStaffSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.listStaff.bind(staffController),
  });

  fastify.get('/staff/:id', {
    schema: staffParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.getStaffById.bind(staffController),
  });

  fastify.patch('/staff/:id', {
    schema: updateStaffSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.updateStaff.bind(staffController),
  });

  fastify.delete('/staff/:id', {
    schema: staffParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.deleteStaff.bind(staffController),
  });

  fastify.get('/staff/:id/batches', {
    schema: {
      ...staffParamSchema,
      description: '[Roles: tenant_admin, branch_manager, coach] Get batches assigned to a coach or instructor',
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.getStaffBatches.bind(staffController),
  });

  fastify.post('/staff/:id/face', {
    schema: {
      description: '[Roles: tenant_admin, branch_manager, staff, coach] Upload staff or coach face photo (Base64) and sync directly to biometric access terminal',
      tags: ['Staff & HR Management'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 24, maxLength: 24, description: 'Staff/Coach User ID' },
        },
      },
      body: {
        type: 'object',
        required: ['faceImageBase64'],
        properties: {
          faceImageBase64: { type: 'string', description: 'Base64 encoded JPEG/PNG facial image' },
        },
      },
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: staffController.uploadFace.bind(staffController),
  });
}
