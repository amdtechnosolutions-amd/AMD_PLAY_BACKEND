import { financeController } from './finance.controller.js';
import {
  recordExpenseSchema,
  approveExpenseSchema,
  queryExpensesSchema,
  recordPaymentSchema,
  queryPaymentsSchema,
  financialSummarySchema,
  expenseParamSchema,
  paymentParamSchema,
} from './finance.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function financeRoutes(fastify) {
  // Booking Invoice alias for Admin Panel
  fastify.get('/finance/invoices/:id', {
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: async (request, reply) => {
      const { bookingController } = await import('../bookings/booking.controller.js');
      return bookingController.getInvoice(request, reply);
    },
  });

  // Expenses
  fastify.post('/finance/expenses', {
    schema: recordExpenseSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.recordExpense.bind(financeController),
  });

  fastify.get('/finance/expenses', {
    schema: queryExpensesSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.listExpenses.bind(financeController),
  });

  fastify.get('/finance/expenses/:id', {
    schema: expenseParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.getExpenseById.bind(financeController),
  });

  fastify.patch('/finance/expenses/:id/approve', {
    schema: approveExpenseSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.approveExpense.bind(financeController),
  });

  fastify.delete('/finance/expenses/:id', {
    schema: expenseParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.deleteExpense.bind(financeController),
  });


  // Payments
  fastify.post('/finance/payments', {
    schema: recordPaymentSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.recordPayment.bind(financeController),
  });

  fastify.get('/finance/payments', {
    schema: queryPaymentsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.listPayments.bind(financeController),
  });

  fastify.get('/finance/payments/:id', {
    schema: paymentParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.getPaymentById.bind(financeController),
  });

  // Webhooks (public endpoint; verified via HMAC signature)
  fastify.post('/finance/webhook/razorpay', {
    schema: {
      description: 'Razorpay payment & refund webhook listener',
      tags: ['Finance & Monthly Fees'],
    },
    handler: financeController.handleRazorpayWebhook.bind(financeController),
  });

  // Monthly Coaching & Member Fee Billing
  fastify.post('/finance/monthly-fees/generate', {
    schema: {
      description: 'Auto-generate monthly fee dues for all active students and/or court members (Defaults to current month and all)',
      tags: ['Finance & Monthly Fees'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
        properties: {
          month: { type: 'integer', minimum: 1, maximum: 12, description: 'Optional month (1-12)' },
          year: { type: 'integer', minimum: 2020, description: 'Optional year (e.g. 2026)' },
          target: { type: 'string', enum: ['all', 'students', 'members'], default: 'all', description: 'Target user persona' },
          dueDay: { type: 'integer', minimum: 1, maximum: 28, default: 5, description: 'Day of month invoice is due' },
        },
      },
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.generateMonthlyFees.bind(financeController),
  });

  fastify.get('/finance/monthly-fees', {
    schema: {
      description: 'List monthly fee invoices with filter by month, year, feeType, student, member, batch',
      tags: ['Finance & Monthly Fees', 'Students Management'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          month: { type: 'integer', description: 'Filter by month (1-12)' },
          year: { type: 'integer', description: 'Filter by year' },
          feeType: { type: 'string', enum: ['coaching_student', 'court_member'], description: 'Filter by fee type' },
          status: { type: 'string', enum: ['pending', 'paid', 'overdue', 'waived', 'partially_paid'], description: 'Invoice payment status' },
          userId: { type: 'string', description: 'Filter by user ID (student or member)' },
          studentId: { type: 'string', description: 'Filter by student ID' },
          subscriptionId: { type: 'string', description: 'Filter by membership subscription ID' },
          batchId: { type: 'string', description: 'Filter by batch ID' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.listMonthlyFees.bind(financeController),
  });

  fastify.patch('/finance/monthly-fees/:id/pay', {
    schema: {
      description: '[Roles: student, tenant_admin] 1-Tap Fee Payment: Pay student coaching fee invoice via UPI/Card/Wallet',
      tags: ['Finance & Monthly Fees', 'Students Management'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 24, maxLength: 24, description: 'Monthly fee invoice ID' },
        },
      },
      body: {
        type: 'object',
        required: ['method'],
        properties: {
          method: { type: 'string', enum: ['upi', 'card', 'online', 'wallet', 'cash'], default: 'upi', description: 'Payment method channel' },
          transactionId: { type: 'string', description: 'Gateway transaction reference ID / UPI UTR' },
          notes: { type: 'string', description: 'Payment receipt memo (e.g. 1-Tap Mobile UPI)' },
        },
      },
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.markFeeAsPaid.bind(financeController),
  });

  // Razorpay Order Creation for Student Monthly Fee
  fastify.post('/finance/monthly-fees/:id/razorpay/order', {
    schema: {
      description: '[Roles: student, tenant_admin] Initialize Razorpay Payment Order for student coaching fee invoice',
      tags: ['Finance & Monthly Fees', 'Students Management'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 24, maxLength: 24, description: 'Monthly fee invoice ID' },
        },
      },
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.createRazorpayFeeOrder.bind(financeController),
  });

  // Razorpay Payment Verification & Fee Settlement
  fastify.post('/finance/monthly-fees/:id/razorpay/verify', {
    schema: {
      description: '[Roles: student, tenant_admin] Verify Razorpay payment signature, settle student coaching fee invoice, and issue receipt',
      tags: ['Finance & Monthly Fees', 'Students Management'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 24, maxLength: 24, description: 'Monthly fee invoice ID' },
        },
      },
      body: {
        type: 'object',
        required: ['razorpay_payment_id'],
        properties: {
          razorpay_order_id: { type: 'string', description: 'Razorpay Order ID' },
          razorpay_payment_id: { type: 'string', description: 'Razorpay Payment ID (e.g. pay_29QQoUBcx96muk)' },
          razorpay_signature: { type: 'string', description: 'Razorpay HMAC-SHA256 signature' },
        },
      },
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.verifyRazorpayFeePayment.bind(financeController),
  });

  // Reports & Financial Summary
  fastify.get('/finance/reports/summary', {
    schema: financialSummarySchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: financeController.getFinancialSummary.bind(financeController),
  });
}
