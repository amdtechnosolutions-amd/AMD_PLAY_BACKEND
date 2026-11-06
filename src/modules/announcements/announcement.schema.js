export const createAnnouncementSchema = {
  description: 'Create and publish an academy announcement',
  tags: ['Announcements'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['title', 'description'],
    properties: {
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
      title: { type: 'string', minLength: 2 },
      description: { type: 'string', minLength: 5 },
      category: { type: 'string', enum: ['general', 'exam', 'event', 'maintenance', 'holiday', 'coaching'] },
      icon: { type: 'string' },
      image: { type: 'string' },
      targetType: { type: 'string', enum: ['all', 'sport', 'students', 'members', 'coaches'] },
      targetSportId: { type: 'string', minLength: 24, maxLength: 24 },
      sendPushNotification: { type: 'boolean' },
    },
  },
};
