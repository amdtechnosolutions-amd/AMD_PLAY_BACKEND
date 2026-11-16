import crypto from 'node:crypto';
import { expenseRepository, paymentRepository } from './finance.repository.js';
import { MonthlyFee } from './monthly-fee.model.js';
import { bookingRepository } from '../bookings/booking.repository.js';
import { cashfreeService } from './cashfree.service.js';
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

  async processCashfreeWebhook(event, signature, timestamp, rawBody) {
    const isValid = await cashfreeService.verifyWebhookSignature({
      rawBody,
      timestamp,
      signature,
    });

    if (!isValid && !env.isDev && !env.isTest) {
      throw new ValidationError('Invalid Cashfree webhook signature');
    }

    const eventType = event.type || event.event || '';
    if (eventType === 'TEST_WEBHOOK' || eventType.toUpperCase().includes('TEST')) {
      return { processed: true, message: 'Cashfree test webhook verified successfully' };
    }

    const linkData = event.data?.link_id ? event.data : null;
    const paymentData = event.data?.payment;
    const orderData = event.data?.order;

    const gatewayPaymentId = paymentData?.cf_payment_id
      ? String(paymentData.cf_payment_id)
      : (orderData?.transaction_id ? String(orderData.transaction_id) : '');

    const gatewayOrderId = orderData?.order_id || (linkData ? String(linkData.link_id || linkData.cf_link_id) : '');
    const linkId = linkData ? String(linkData.link_id || linkData.cf_link_id) : '';

    if (!gatewayPaymentId && !gatewayOrderId && !linkId) {
      return { processed: true, message: 'No payment or order details found in Cashfree webhook' };
    }

    const isSuccess = eventType === 'PAYMENT_SUCCESS_WEBHOOK' ||
      (eventType === 'PAYMENT_LINK_EVENT' && (linkData?.link_status === 'PAID' || orderData?.transaction_status === 'SUCCESS')) ||
      paymentData?.payment_status === 'SUCCESS' ||
      orderData?.order_status === 'PAID' ||
      orderData?.transaction_status === 'SUCCESS';

    const isFailure = eventType === 'PAYMENT_FAILED_WEBHOOK' ||
      eventType === 'PAYMENT_USER_DROPPED_WEBHOOK' ||
      (eventType === 'PAYMENT_LINK_EVENT' && ['CANCELLED', 'EXPIRED'].includes(linkData?.link_status)) ||
      paymentData?.payment_status === 'FAILED' ||
      paymentData?.payment_status === 'CANCELLED' ||
      orderData?.transaction_status === 'FAILED';

    const isRefund = eventType === 'REFUND_STATUS_WEBHOOK';

    // 1. Update Payment ledger if exists
    let payment = null;
    if (gatewayPaymentId) {
      payment = await this.paymentRepository.findByGatewayPaymentId(gatewayPaymentId);
    }
    if (!payment && gatewayOrderId) {
      payment = await this.paymentRepository.model.findOne({
        $or: [
          { gatewayOrderId },
          { 'metadata.linkId': linkId },
        ],
      });
    }

    if (payment) {
      if (isSuccess) {
        payment.status = 'success';
        if (gatewayPaymentId) payment.gatewayPaymentId = gatewayPaymentId;
        await payment.save();
      } else if (isFailure) {
        payment.status = 'failed';
        await payment.save();
      } else if (isRefund) {
        payment.status = 'refunded';
        const refundData = event.data?.refund;
        payment.refund = {
          amount: refundData?.refund_amount || 0,
          refundedAt: new Date(),
          gatewayRefundId: String(refundData?.cf_refund_id || refundData?.refund_id || ''),
          reason: refundData?.refund_note || 'Cashfree webhook refund',
        };
        await payment.save();
      }
    }

    // 2. Update Court Booking if exists (for mobile app & web async confirmation)
    try {
      const bookings = await bookingRepository.model.find({
        $or: [
          { 'payment.transactionId': gatewayOrderId },
          { 'payment.transactionId': gatewayPaymentId },
          { 'payment.cashfree_order_id': gatewayOrderId },
          { 'payment.cashfree_payment_id': gatewayPaymentId },
          { 'payment.linkId': linkId },
          { bookingNumber: gatewayOrderId },
        ],
      });

      for (const b of bookings) {
        if (isSuccess) {
          b.payment.status = 'paid';
          if (gatewayPaymentId) b.payment.transactionId = gatewayPaymentId;
          b.status = 'confirmed';
          await b.save();
        } else if (isFailure && b.status !== 'confirmed') {
          b.payment.status = 'failed';
          b.status = 'cancelled';
          await b.save();
        }
      }
    } catch (_) {}

    // 3. Update Monthly Coaching / Member Fee invoice if exists
    try {
      const fee = await MonthlyFee.findOne({
        $or: [
          { paymentId: gatewayPaymentId },
          { 'notes.orderId': gatewayOrderId },
          { 'notes.linkId': linkId },
          { 'notes.cfLinkId': linkData?.cf_link_id },
        ],
      });
      if (fee) {
        if (isSuccess) {
          fee.status = 'paid';
          fee.paidAt = new Date();
          await fee.save();
        } else if (isFailure && fee.status !== 'paid') {
          fee.status = 'failed';
          await fee.save();
        }
      }
    } catch (_) {}

    return {
      processed: true,
      eventType,
      orderId: gatewayOrderId,
      paymentId: gatewayPaymentId,
      status: isSuccess ? 'success' : isFailure ? 'failed' : isRefund ? 'refunded' : 'received',
    };
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
