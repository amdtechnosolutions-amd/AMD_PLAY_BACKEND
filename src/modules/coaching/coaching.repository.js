import { BaseRepository } from '../../core/BaseRepository.js';
import { Batch } from './batch.model.js';
import { Enrollment } from './enrollment.model.js';
import { Attendance } from './attendance.model.js';

export class BatchRepository extends BaseRepository {
  constructor() {
    super(Batch);
  }

  async findByCode(code, branchId, tenantId) {
    return await this.model.findOne({
      code: code.toUpperCase(),
      branchId,
      tenantId,
    });
  }

  async findActiveByBranchAndSport(branchId, sportId, tenantId) {
    const filter = {
      branchId,
      status: 'active',
    };
    if (sportId) {
      filter.sportId = sportId;
    }
    const scoped = this._scopeFilter(filter, tenantId);
    return await this.model
      .find(scoped)
      .populate('resourceId', 'name code surface type')
      .populate('courtId', 'name code surface type')
      .populate('courtIds', 'name code surface type')
      .lean()
      .exec();
  }

  async findWithDetails(id, tenantId) {
    const filter = this._scopeFilter({ _id: id }, tenantId);
    return await this.model
      .findOne(filter)
      .populate('coachId', 'firstName lastName email phone')
      .populate('sportId', 'name slug type')
      .populate('branchId', 'name code timezone')
      .populate('resourceId', 'name code surface type')
      .populate('courtId', 'name code surface type')
      .populate('courtIds', 'name code surface type')
      .lean();
  }

  async paginateBatches(filter = {}, pagination = {}, tenantId = null) {
    const sort = pagination.sort || { createdAt: -1 };
    return await this.paginate(
      filter,
      {
        ...pagination,
        sort,
        populate: [
          { path: 'coachId', select: 'firstName lastName' },
          { path: 'sportId', select: 'name slug' },
          { path: 'branchId', select: 'name code' },
          { path: 'resourceId', select: 'name code surface type' },
          { path: 'courtId', select: 'name code surface type' },
          { path: 'courtIds', select: 'name code surface type' },
        ],
        lean: true,
      },
      tenantId
    );
  }
}

export class EnrollmentRepository extends BaseRepository {
  constructor() {
    super(Enrollment);
  }

  async findByStudentAndBatch(studentId, batchId, tenantId) {
    return await this.model
      .findOne({
        studentId,
        batchId,
        tenantId,
      })
      .lean();
  }

  async findActiveByBatch(batchId, tenantId) {
    return await this.model
      .find({ batchId, tenantId, status: 'active' })
      .populate('studentId', 'firstName lastName email phone')
      .sort({ createdAt: 1 })
      .lean();
  }
}

export class AttendanceRepository extends BaseRepository {
  constructor() {
    super(Attendance);
  }

  async findByBatchAndDate(batchId, date, tenantId) {
    return await this.model
      .findOne({
        batchId,
        date,
        tenantId,
      })
      .populate('records.studentId', 'firstName lastName email phone cardNo employeeNo avatar')
      .lean();
  }

  async findAllByBatch(batchId, tenantId) {
    return await this.model
      .find({ batchId, tenantId })
      .sort({ date: -1 })
      .lean();
  }
}

export const batchRepository = new BatchRepository();
export const enrollmentRepository = new EnrollmentRepository();
export const attendanceRepository = new AttendanceRepository();
