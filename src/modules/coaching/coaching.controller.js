import { BaseController } from '../../core/BaseController.js';
import { coachingService } from './coaching.service.js';
import { apiSuccess } from '../../utils/response.js';

export class CoachingController extends BaseController {
  constructor() {
    super(coachingService);
  }

  async createBatch(request, reply) {
    const context = this._extractContext(request);
    const batch = await coachingService.createBatch(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Coaching batch created successfully',
        data: batch,
      })
    );
  }

  async getBatchById(request, reply) {
    const context = this._extractContext(request);
    const batch = await coachingService.getBatchDetails(request.params.id, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Batch details retrieved',
        data: batch,
      })
    );
  }

  async getBatchStudentsDropdown(request, reply) {
    const context = this._extractContext(request);
    const result = await coachingService.getBatchStudentsDropdown(
      request.params.id,
      request.query || {},
      context
    );

    return reply.status(200).send(
      apiSuccess({
        message: 'Batch students dropdown retrieved successfully',
        data: result.items,
        meta: {
          batchId: result.batchId,
          batchName: result.batchName,
          batchCode: result.batchCode,
          sportName: result.sportName,
          totalStudents: result.totalStudents,
        },
      })
    );
  }

  async getBatchWiseStudentsDropdown(request, reply) {
    const context = this._extractContext(request);
    const result = await coachingService.getBatchWiseStudentsDropdown(
      request.query || {},
      context
    );

    return reply.status(200).send(
      apiSuccess({
        message: 'Batch-wise students dropdown retrieved successfully',
        data: result,
      })
    );
  }

  async registerStudent(request, reply) {
    const context = this._extractContext(request);
    const result = await coachingService.registerStudent(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Student registered and enrolled successfully',
        data: result,
      })
    );
  }

  async enrollStudent(request, reply) {
    const context = this._extractContext(request);
    const enrollment = await coachingService.enrollStudent(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Student enrolled in batch successfully',
        data: enrollment,
      })
    );
  }

  async markAttendance(request, reply) {
    const context = this._extractContext(request);
    const attendance = await coachingService.markAttendance(request.body, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Attendance recorded successfully',
        data: attendance,
      })
    );
  }

  async getAttendance(request, reply) {
    const context = this._extractContext(request);
    const { id } = request.params;
    const { date } = request.query || {};

    const attendance = await coachingService.getBatchAttendance(id, date, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Attendance retrieved successfully',
        data: attendance,
      })
    );
  }

  async getStudentSummary(request, reply) {
    const context = this._extractContext(request);
    const { batchId, studentId } = request.params;

    const summary = await coachingService.getStudentAttendanceSummary(batchId, studentId, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Student attendance summary retrieved',
        data: summary,
      })
    );
  }

  async uploadFace(request, reply) {
    const context = this._extractContext(request);
    const { id } = request.params;
    const result = await coachingService.uploadStudentFace(id, request.body, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Student face photo uploaded and synced successfully',
        data: result,
      })
    );
  }
}

export const coachingController = new CoachingController();
