import crypto from 'node:crypto';
import { expenseRepository, paymentRepository } from './finance.repository.js';
import { MonthlyFee } from './monthly-fee.model.js';
import { ValidationError, NotFoundError } from '../../errors/AppError.js';
import { env } from '../../config/env.js';

export class FinanceService {
  constructor() {
    this.expenseRepository = expenseRepository;
    this.paymentRepository = paymentRepository;
  }

  async recordExpense(data, context) {
    if (!context.tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const payload = {
      ...data,
      tenantId: context.tenantId,
      branchId: data.branchId || context.branchId,
      recordedBy: context.userId,
      status: data.status || 'pending',
    };

    return await this.expenseRepository.create(payload);
  }

  async approveExpense(id, { status, notes }, context) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new ValidationError("Status must be either 'approved' or 'rejected'");
    }

    const expense = await this.expenseRepository.findById(id, context.tenantId);
    if (!expense) {
      throw new NotFoundError(`Expense with ID '${id}' not found`);
    }

    const updateData = {
      status,
      approvedBy: context.userId,
    };
    if (notes) {
      updateData.notes = expense.notes ? `${expense.notes} | ${notes}` : notes;
    }

    return await this.expenseRepository.updateById(id, updateData, context.tenantId);
  }

  async deleteExpense(id, context = {}) {
    const deleted = await this.expenseRepository.deleteById(id, context.tenantId);
    if (!deleted) {
      throw new NotFoundError(`Expense with ID '${id}' not found`);
    }
    return deleted;
  }


  async listExpenses(filters = {}, pagination = {}, context = {}) {
    const filter = {};
    if (filters.branchId) filter.branchId = filters.branchId;
    if (filters.category) filter.category = filters.category;
    if (filters.status) filter.status = filters.status;

    if (filters.startDate || filters.endDate) {
      filter.date = {};
      if (filters.startDate) filter.date.$gte = filters.startDate;
      if (filters.endDate) filter.date.$lte = filters.endDate;
    }

    return await this.expenseRepository.paginateExpenses(filter, pagination, context.tenantId);
  }

  async getExpenseById(id, context = {}) {
    const expense = await this.expenseRepository.findById(id, context.tenantId);
    if (!expense) {
      throw new NotFoundError(`Expense with ID '${id}' not found`);
    }
    return expense;
  }

  async recordPayment(data, context) {
    if (!context.tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const payload = {
      ...data,
      tenantId: context.tenantId,
      branchId: data.branchId || context.branchId,
      userId: data.userId || context.userId,
      status: data.status || 'success',
      currency: data.currency || 'INR',
    };

    return await this.paymentRepository.create(payload);
  }

  async listPayments(filters = {}, pagination = {}, context = {}) {
    const filter = {};
    if (filters.branchId) filter.branchId = filters.branchId;
    if (filters.userId) filter.userId = filters.userId;
    if (filters.type) filter.type = filters.type;
    if (filters.status) filter.status = filters.status;
    if (filters.gateway) filter.gateway = filters.gateway;
    if (filters.referenceId) filter.referenceId = filters.referenceId;

    if (filters.startDate || filters.endDate) {
      filter.createdAt = {};
      if (filters.startDate) filter.createdAt.$gte = new Date(`${filters.startDate}T00:00:00.000Z`);
      if (filters.endDate) filter.createdAt.$lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }

    return await this.paymentRepository.paginatePayments(filter, pagination, context.tenantId);
  }

  async getPaymentById(id, context = {}) {
    const payment = await this.paymentRepository.findById(id, context.tenantId);
    if (!payment) {
      throw new NotFoundError(`Payment with ID '${id}' not found`);
    }
    return payment;
  }

  verifyWebhookSignature(rawBody, signature, secret = env.RAZORPAY_WEBHOOK_SECRET) {
    if (!rawBody || !signature || !secret) {
      return false;
    }

    try {
      const payloadString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

      if (signature.length !== expectedSignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  async processWebhook(event, signature, rawBody, secret = env.RAZORPAY_WEBHOOK_SECRET) {
    const isValid = this.verifyWebhookSignature(rawBody, signature, secret);
    if (!isValid) {
      throw new ValidationError('Invalid webhook signature');
    }

    const { event: eventName, payload } = event;
    const paymentEntity = payload?.payment?.entity;
    if (!paymentEntity) {
      return { processed: true, message: 'No payment entity in webhook event' };
    }

    const gatewayPaymentId = paymentEntity.id;
    const payment = await this.paymentRepository.findByGatewayPaymentId(gatewayPaymentId);

    if (!payment) {
      return { processed: false, message: `Payment with gateway id ${gatewayPaymentId} not found` };
    }

    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      payment.status = 'success';
      await payment.save();
    } else if (eventName === 'payment.failed') {
      payment.status = 'failed';
      await payment.save();
    } else if (eventName === 'refund.processed') {
      payment.status = 'refunded';
      payment.refund = {
        amount: (payload.refund?.entity?.amount || 0) / 100,
        refundedAt: new Date(),
        gatewayRefundId: payload.refund?.entity?.id || '',
        reason: payload.refund?.entity?.notes?.reason || 'Webhook refund',
      };
      await payment.save();
    }

    return { processed: true, event: eventName, paymentId: payment._id, status: payment.status };
  }

  async getFinancialSummary(filters = {}, context = {}) {
    const tenantId = context.tenantId || filters.tenantId || null;
    const { branchId, startDate, endDate } = filters;

    const [payments, expenses] = await Promise.all([
      this.paymentRepository.findSuccessfulByDateRange(tenantId, branchId, startDate, endDate),
      this.expenseRepository.findApprovedByDateRange(tenantId, branchId, startDate, endDate),
    ]);

    // Safeguard: fetch unlinked paid monthly coaching fees
    const feeFilter = {
      status: 'paid',
      paymentId: null,
    };
    if (tenantId) feeFilter.tenantId = tenantId;
    if (branchId) feeFilter.branchId = branchId;
    if (startDate || endDate) {
      feeFilter.paidAt = {};
      if (startDate) feeFilter.paidAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) feeFilter.paidAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }
    const unlinkedFees = await MonthlyFee.find(feeFilter).exec();

    let totalRevenue = 0;
    const revenueByType = {
      booking: 0,
      membership: 0,
      coaching: 0,
      other: 0,
    };
    const revenueByPaymentMethod = {};

    for (const p of payments) {
      const amt = p.amount || 0;
      totalRevenue += amt;

      const pType = p.type || 'other';
      revenueByType[pType] = (revenueByType[pType] || 0) + amt;

      const method = p.paymentMethod || 'other';
      revenueByPaymentMethod[method] = (revenueByPaymentMethod[method] || 0) + amt;
    }

    for (const f of unlinkedFees) {
      const amt = f.paidAmount || f.finalAmount || 0;
      totalRevenue += amt;
      revenueByType.coaching = (revenueByType.coaching || 0) + amt;
      revenueByPaymentMethod.cash = (revenueByPaymentMethod.cash || 0) + amt;
    }

    let totalExpenses = 0;
    const expensesByCategory = {};

    for (const e of expenses) {
      const amt = e.amount || 0;
      totalExpenses += amt;

      const cat = e.category || 'other';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
    }

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(2)) : 0;

    return {
      currency: 'INR',
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
      },
      breakdowns: {
        revenueByType,
        revenueByPaymentMethod,
        expensesByCategory,
      },
      counts: {
        successfulPayments: payments.length + unlinkedFees.length,
        approvedExpenses: expenses.length,
      },
    };
  }
}

export const financeService = new FinanceService();
