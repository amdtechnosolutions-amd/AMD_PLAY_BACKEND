export const recordExpenseSchema = {
  description: 'Record an operational expense for a branch',
  tags: ['Finance & Monthly Fees'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['branchId', 'title', 'amount', 'date'],
    properties: {
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
      category: {
        type: 'string',
        enum: [
          'maintenance',
          'electricity',
          'equipment',
          'salaries',
          'rent',
          'utilities',
          'marketing',
          'other',
        ],
      },
      title: { type: 'string', minLength: 2 },
      amount: { type: 'number', minimum: 0 },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      paidTo: { type: 'string' },
      paymentMethod: {
        type: 'string',
        enum: ['cash', 'bank_transfer', 'upi', 'card', 'cheque'],
      },
      receiptUrl: { type: 'string' },
      notes: { type: 'string' },
    },
  },
};

export const approveExpenseSchema = {
  description: 'Approve or reject a recorded expense',
  tags: ['Finance & Monthly Fees'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['approved', 'rejected'] },
      notes: { type: 'string' },
    },
  },
};

export const queryExpensesSchema = {
  description: 'List expenses with category/status filters and pagination',
  tags: ['Finance & Monthly Fees'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      branchId: { type: 'string' },
      category: { type: 'string' },
      status: { type: 'string' },
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
  },
};

export const recordPaymentSchema = {
  description: 'Record a payment transaction (booking, membership, coaching, or manual)',
  tags: ['Finance & Monthly Fees'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['branchId', 'userId', 'amount', 'type'],
    properties: {
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
      userId: { type: 'string', minLength: 24, maxLength: 24 },
      amount: { type: 'number', minimum: 0 },
      currency: { type: 'string' },
      type: {
        type: 'string',
        enum: ['booking', 'membership', 'coaching', 'other'],
      },
      referenceId: { type: 'string' },
      paymentMethod: {
        type: 'string',
        enum: ['upi', 'card', 'cash', 'netbanking', 'wallet'],
      },
      gateway: {
        type: 'string',
        enum: ['razorpay', 'stripe', 'manual', 'cash'],
      },
      gatewayOrderId: { type: 'string' },
      gatewayPaymentId: { type: 'string' },
      status: {
        type: 'string',
        enum: ['pending', 'success', 'failed', 'refunded'],
      },
      metadata: { type: 'object' },
    },
  },
};

export const queryPaymentsSchema = {
  description: 'List payments with filters and pagination',
  tags: ['Finance & Monthly Fees'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      branchId: { type: 'string' },
      userId: { type: 'string' },
      type: { type: 'string' },
      status: { type: 'string' },
      gateway: { type: 'string' },
      referenceId: { type: 'string' },
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
  },
};

export const financialSummarySchema = {
  description: 'Aggregate financial summary (P&L report: revenue, expenses, net profit, margin)',
  tags: ['Finance & Monthly Fees'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      branchId: { type: 'string' },
      startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    },
  },
};

export const expenseParamSchema = {
  description: 'Expense ID parameter',
  tags: ['Finance & Monthly Fees'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
};

export const paymentParamSchema = {
  description: 'Payment ID parameter',
  tags: ['Finance & Monthly Fees'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
};
