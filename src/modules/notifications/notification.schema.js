export const sendNotificationSchema = {
  description: 'Send multi-channel notification to user (In-app, Email, SMS, WhatsApp, Push)',
  tags: ['Notifications & Alerts'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['userId', 'title', 'message'],
    properties: {
      userId: { type: 'string', minLength: 24, maxLength: 24 },
      title: { type: 'string', minLength: 1 },
      message: { type: 'string', minLength: 1 },
      channels: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['in_app', 'email', 'sms', 'whatsapp', 'push'],
        },
      },
      type: {
        type: 'string',
        enum: ['booking', 'membership', 'coaching', 'payment', 'system', 'iot'],
      },
      metadata: { type: 'object' },
    },
  },
};

export const queryNotificationsSchema = {
  description: 'Retrieve current user notification inbox with filters and pagination',
  tags: ['Notifications & Alerts'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      channel: { type: 'string' },
      type: { type: 'string' },
      status: { type: 'string' },
      unreadOnly: { type: 'string' },
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
  },
};

export const notificationParamSchema = {
  description: 'Notification ID parameter',
  tags: ['Notifications & Alerts'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
};
