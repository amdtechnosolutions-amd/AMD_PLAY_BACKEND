import { BaseController } from '../../core/BaseController.js';
import { financeService } from './finance.service.js';
import { monthlyFeeGeneratorService } from './monthly-fee-generator.service.js';
import { apiSuccess } from '../../utils/response.js';

export class FinanceController extends BaseController {
  constructor() {
    super(financeService);
  }

  async recordExpense(request, reply) {
    const context = this._extractContext(request);
    const expense = await financeService.recordExpense(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Expense recorded successfully',
        data: expense,
      })
    );
  }

  async approveExpense(request, reply) {
    const context = this._extractContext(request);
    const expense = await financeService.approveExpense(
      request.params.id,
      request.body,
      context
    );

    return reply.status(200).send(
      apiSuccess({
        message: `Expense ${request.body.status} successfully`,
        data: expense,
      })
    );
  }

  async deleteExpense(request, reply) {
    const context = this._extractContext(request);
    await financeService.deleteExpense(request.params.id, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Expense deleted successfully',
      })
    );
  }


  async listExpenses(request, reply) {
    const context = this._extractContext(request);
    const { page, limit, ...filters } = request.query || {};
    const pagination = { page, limit };

    const result = await financeService.listExpenses(filters, pagination, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Expenses retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async getExpenseById(request, reply) {
    const context = this._extractContext(request);
    const expense = await financeService.getExpenseById(request.params.id, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Expense retrieved successfully',
        data: expense,
      })
    );
  }

  async recordPayment(request, reply) {
    const context = this._extractContext(request);
    const payment = await financeService.recordPayment(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Payment recorded successfully',
        data: payment,
      })
    );
  }

  async listPayments(request, reply) {
    const context = this._extractContext(request);
    const { page, limit, ...filters } = request.query || {};
    const pagination = { page, limit };

    const result = await financeService.listPayments(filters, pagination, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Payments retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async getPaymentById(request, reply) {
    const context = this._extractContext(request);
    const payment = await financeService.getPaymentById(request.params.id, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Payment retrieved successfully',
        data: payment,
      })
    );
  }

  async handleRazorpayWebhook(request, reply) {
    const signature = request.headers['x-razorpay-signature'] || '';
    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);

    const result = await financeService.processWebhook(request.body, signature, rawBody);

    return reply.status(200).send(
      apiSuccess({
        message: 'Webhook processed',
        data: result,
      })
    );
  }

  async generateMonthlyFees(request, reply) {
    const context = this._extractContext(request);
    const body = request.body || {};
    const month = body.month ? parseInt(body.month, 10) : undefined;
    const year = body.year ? parseInt(body.year, 10) : undefined;
    const target = body.target || 'all';
    const dueDay = body.dueDay ? parseInt(body.dueDay, 10) : 5;

    const result = await monthlyFeeGeneratorService.generateFeesForMonth({
      tenantId: context.tenantId,
      month,
      year,
      target,
      dueDay,
    });

    return reply.status(200).send(
      apiSuccess({
        message: `Monthly fees generated (${result.totalGeneratedInvoices} invoices created)`,
        data: result,
      })
    );
  }

  async listMonthlyFees(request, reply) {
    const context = this._extractContext(request);
    const { page, limit, ...filters } = request.query || {};
    const pagination = { page, limit };

    const result = await monthlyFeeGeneratorService.listMonthlyFees(filters, pagination, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Monthly fee invoices retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async markFeeAsPaid(request, reply) {
    const context = this._extractContext(request);
    const result = await monthlyFeeGeneratorService.markFeeAsPaid(
      request.params.id,
      request.body || {},
      context
    );

    return reply.status(200).send(
      apiSuccess({
        message: 'Fee invoice marked as paid successfully',
        data: result,
      })
    );
  }

  async createRazorpayFeeOrder(request, reply) {
    const context = this._extractContext(request);
    const order = await monthlyFeeGeneratorService.createRazorpayOrder(request.params.id, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Razorpay order created successfully',
        data: order,
      })
    );
  }

  async verifyRazorpayFeePayment(request, reply) {
    const context = this._extractContext(request);
    const result = await monthlyFeeGeneratorService.verifyRazorpayPayment(
      request.params.id,
      request.body || {},
      context
    );

    return reply.status(200).send(
      apiSuccess({
        message: result.message || 'Fee payment verified successfully',
        data: result,
      })
    );
  }

  async getFinancialSummary(request, reply) {
    const context = this._extractContext(request);
    const filters = request.query || {};

    const summary = await financeService.getFinancialSummary(filters, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Financial summary report generated successfully',
        data: summary,
      })
    );
  }
}

export const financeController = new FinanceController();
