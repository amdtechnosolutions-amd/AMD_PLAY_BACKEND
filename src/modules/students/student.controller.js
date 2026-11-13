import { studentService } from './student.service.js';
import { coachingService } from '../coaching/coaching.service.js';
import { apiSuccess } from '../../utils/response.js';

export class StudentController {
  _extractContext(request) {
    return {
      tenantId: request.tenantId || request.user?.tenantId,
      branchId: request.user?.branchId,
      user: request.user,
      query: request.query,
    };
  }

  async createStudent(req, reply) {
    const context = this._extractContext(req);
    const result = await studentService.createStudent(req.body, context);
    return reply.status(201).send(
      apiSuccess({
        message: 'Student registered and enrolled successfully',
        data: result,
      })
    );
  }

  async listStudents(req, reply) {
    const context = this._extractContext(req);
    const { page, limit, ...filters } = req.query || {};
    const pagination = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    };
    const result = await studentService.listStudents(filters, pagination, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Students retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async getStudentsDropdown(req, reply) {
    const context = this._extractContext(req);
    const result = await studentService.getStudentsDropdown(req.query || {}, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Students dropdown retrieved successfully',
        data: result,
      })
    );
  }

  async getStudentById(req, reply) {
    const context = this._extractContext(req);
    const student = await studentService.getStudentById(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Student profile retrieved',
        data: student,
      })
    );
  }

  async updateStudent(req, reply) {
    const context = this._extractContext(req);
    const student = await studentService.updateStudent(req.params.id, req.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Student profile updated successfully',
        data: student,
      })
    );
  }

  async deleteStudent(req, reply) {
    const context = this._extractContext(req);
    const result = await studentService.deleteStudent(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Student deactivated successfully',
        data: result,
      })
    );
  }

  async uploadFace(req, reply) {
    const context = this._extractContext(req);
    const result = await coachingService.uploadStudentFace(req.params.id, req.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Student face photo uploaded and synced successfully',
        data: result,
      })
    );
  }

  async getAttendance(req, reply) {
    const context = this._extractContext(req);
    context.query = req.query;
    const logs = await studentService.getStudentAttendance(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Student attendance logs retrieved',
        data: logs,
      })
    );
  }

  async getMyAttendance(req, reply) {
    const context = this._extractContext(req);
    context.query = req.query;
    const attendance = await studentService.getMyAttendance(context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Personal and sibling attendance records retrieved',
        data: attendance,
      })
    );
  }

  async getSiblingAttendance(req, reply) {
    const context = this._extractContext(req);
    context.query = req.query;
    const attendance = await studentService.getSiblingAttendance(context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Sibling family attendance records retrieved successfully',
        data: attendance,
      })
    );
  }

  async getMySiblings(req, reply) {
    const context = this._extractContext(req);
    const siblings = await studentService.getMySiblings(context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Enrolled sibling profiles retrieved successfully',
        data: siblings,
      })
    );
  }

  async markAttendance(req, reply) {
    const context = this._extractContext(req);
    const result = await studentService.markAttendance(req.body, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Attendance recorded successfully',
        data: result,
      })
    );
  }

  async getMyFees(req, reply) {
    const context = this._extractContext(req);
    context.query = req.query;
    const fees = await studentService.getMyFees(context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Personal monthly coaching fee records retrieved',
        data: fees,
      })
    );
  }

  async getMyPayments(req, reply) {
    const context = this._extractContext(req);
    context.query = req.query;
    const payments = await studentService.getMyPayments(context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Personal and sibling payment records retrieved successfully',
        data: payments,
      })
    );
  }

  async getSiblingPayments(req, reply) {
    const context = this._extractContext(req);
    context.query = req.query;
    const payments = await studentService.getSiblingPayments(context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Sibling group payment records retrieved successfully',
        data: payments,
      })
    );
  }

  async getStudentPayments(req, reply) {
    const context = this._extractContext(req);
    context.query = req.query;
    const payments = await studentService.getStudentSiblingPayments(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Student payment records retrieved successfully',
        data: payments,
      })
    );
  }

  async getFees(req, reply) {
    const context = this._extractContext(req);
    context.query = req.query;
    const fees = await studentService.getStudentFees(req.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Student fee history retrieved',
        data: fees,
      })
    );
  }
}

export const studentController = new StudentController();

