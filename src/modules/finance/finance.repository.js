import { BaseRepository } from '../../core/BaseRepository.js';
import { Expense } from './expense.model.js';
import { Payment } from './payment.model.js';

export class ExpenseRepository extends BaseRepository {
  constructor() {
    super(Expense);
  }

  async paginateExpenses(filter = {}, pagination = {}, tenantId = null) {
    const sort = pagination.sort || { date: -1, createdAt: -1 };
    return await this.paginate(
      filter,
      {
        ...pagination,
        sort,
        populate: [
          { path: 'branchId', select: 'name code' },
          { path: 'recordedBy', select: 'firstName lastName email' },
          { path: 'approvedBy', select: 'firstName lastName email' },
        ],
        lean: true,
      },
      tenantId
    );
  }

  async findApprovedByDateRange(tenantId, branchId = null, startDate = null, endDate = null) {
    const filter = {
      status: 'approved',
    };
    if (tenantId) {
      filter.tenantId = tenantId;
    }

    if (branchId) {
      filter.branchId = branchId;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }

    return await this.model.find(filter).sort({ date: 1 }).lean().exec();
  }
}

export class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment);
  }

  async paginatePayments(filter = {}, pagination = {}, tenantId = null) {
    const sort = pagination.sort || { createdAt: -1 };
    return await this.paginate(
      filter,
      {
        ...pagination,
        sort,
        populate: [
          { path: 'branchId', select: 'name code' },
          { path: 'userId', select: 'firstName lastName email phone' },
        ],
        lean: true,
      },
      tenantId
    );
  }

  async findByGatewayPaymentId(gatewayPaymentId) {
    return await this.model.findOne({ gatewayPaymentId }).lean();
  }

  async findByReference(referenceId, tenantId) {
    return await this.model.find({ referenceId, tenantId }).sort({ createdAt: -1 }).lean();
  }

  async findSuccessfulByDateRange(tenantId, branchId = null, startDate = null, endDate = null) {
    const filter = {
      status: 'success',
    };
    if (tenantId) {
      filter.tenantId = tenantId;
    }

    if (branchId) {
      filter.branchId = branchId;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    return await this.model.find(filter).sort({ createdAt: 1 }).lean().exec();
  }
}

export const expenseRepository = new ExpenseRepository();
export const paymentRepository = new PaymentRepository();
