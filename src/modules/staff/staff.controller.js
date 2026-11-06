import { staffService } from './staff.service.js';
import { departmentService } from './department.service.js';
import { apiSuccess } from '../../utils/response.js';

export class StaffController {
  _extractContext(request) {
    return {
      tenantId: request.tenantId || request.user?.tenantId,
      branchId: request.user?.branchId,
      user: request.user,
    };
  }

  // =========================================================================
  // ROLES & LOOKUPS
  // =========================================================================

  async getStaffRoles(req, reply) {
    const context = this._extractContext(req);
    const result = await staffService.getStaffRoles(context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Staff roles, departments, and designations retrieved successfully',
        data: result,
      })
    );
  }

  // =========================================================================
  // STAFF CRUD
  // =========================================================================

  async createStaff(req, reply) {
    const context = this._extractContext(req);
    const result = await staffService.createStaff(req.body, context);
    return reply.status(201).send(
      apiSuccess({
        message: 'Staff member registered successfully',
        data: result,
      })
    );
  }

  async listStaff(req, reply) {
    const context = this._extractContext(req);
    const { page, limit, ...filters } = req.query || {};
    const pagination = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    };
    const result = await staffService.listStaff(filters, pagination, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Staff members retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async getStaffById(req, reply) {
    const context = this._extractContext(req);
    const staff = await staffService.getStaffById(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Staff profile retrieved',
        data: staff,
      })
    );
  }

  async updateStaff(req, reply) {
    const context = this._extractContext(req);
    const staff = await staffService.updateStaff(req.params.id, req.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Staff profile updated successfully',
        data: staff,
      })
    );
  }

  async deleteStaff(req, reply) {
    const context = this._extractContext(req);
    const result = await staffService.deleteStaff(req.params.id, context);
    return reply.status(200).send(apiSuccess(result));
  }

  async getStaffBatches(req, reply) {
    const context = this._extractContext(req);
    const batches = await staffService.getStaffBatches(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Coach assigned batches retrieved successfully',
        data: batches,
      })
    );
  }

  // =========================================================================
  // DYNAMIC DEPARTMENTS CRUD
  // =========================================================================

  async createDepartment(req, reply) {
    const context = this._extractContext(req);
    const result = await departmentService.createDepartment(req.body, context);
    return reply.status(201).send(
      apiSuccess({
        message: 'Department created successfully',
        data: result,
      })
    );
  }

  async listDepartments(req, reply) {
    const context = this._extractContext(req);
    const { page, limit, ...filters } = req.query || {};
    const pagination = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
    };
    const result = await departmentService.listDepartments(filters, pagination, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Departments retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async getDepartmentById(req, reply) {
    const context = this._extractContext(req);
    const result = await departmentService.getDepartmentById(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Department retrieved successfully',
        data: result,
      })
    );
  }

  async updateDepartment(req, reply) {
    const context = this._extractContext(req);
    const result = await departmentService.updateDepartment(req.params.id, req.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Department updated successfully',
        data: result,
      })
    );
  }

  async deleteDepartment(req, reply) {
    const context = this._extractContext(req);
    const result = await departmentService.deleteDepartment(req.params.id, context);
    return reply.status(200).send(apiSuccess(result));
  }

  // =========================================================================
  // DYNAMIC DESIGNATIONS CRUD
  // =========================================================================

  async createDesignation(req, reply) {
    const context = this._extractContext(req);
    const result = await departmentService.createDesignation(req.body, context);
    return reply.status(201).send(
      apiSuccess({
        message: 'Designation created successfully',
        data: result,
      })
    );
  }

  async listDesignations(req, reply) {
    const context = this._extractContext(req);
    const { page, limit, ...filters } = req.query || {};
    const pagination = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
    };
    const result = await departmentService.listDesignations(filters, pagination, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Designations retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async getDesignationById(req, reply) {
    const context = this._extractContext(req);
    const result = await departmentService.getDesignationById(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Designation retrieved successfully',
        data: result,
      })
    );
  }

  async updateDesignation(req, reply) {
    const context = this._extractContext(req);
    const result = await departmentService.updateDesignation(req.params.id, req.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Designation updated successfully',
        data: result,
      })
    );
  }

  async deleteDesignation(req, reply) {
    const context = this._extractContext(req);
    const result = await departmentService.deleteDesignation(req.params.id, context);
    return reply.status(200).send(apiSuccess(result));
  }
}

export const staffController = new StaffController();
