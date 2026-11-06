export const createEventSchema = {
  description: 'Create a new Tournament / Sports Event',
  tags: ['Events & Tournaments'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['branchId', 'name', 'startDate', 'endDate', 'registrationLastDate', 'registrationAmount'],
    properties: {
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
      sportId: { type: 'string', minLength: 24, maxLength: 24 },
      name: { type: 'string', minLength: 2 },
      description: { type: 'string' },
      category: { type: 'string' },
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      registrationLastDate: { type: 'string' },
      registrationAmount: { type: 'number', minimum: 0 },
      maxParticipants: { type: 'integer', minimum: 1 },
      posterImage: { type: 'string' },
      brochure: { type: 'string' },
      rules: { type: 'string' },
    },
  },
};

export const registerEventSchema = {
  description: 'Register a participant / athlete for a tournament',
  tags: ['Events & Tournaments'],
  params: {
    type: 'object',
    required: ['eventId'],
    properties: {
      eventId: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
  body: {
    type: 'object',
    required: ['fullName', 'gender', 'dateOfBirth', 'phone'],
    properties: {
      fullName: { type: 'string', minLength: 2 },
      gender: { type: 'string', enum: ['Male', 'Female', 'Other'] },
      dateOfBirth: { type: 'string' },
      phone: { type: 'string', minLength: 10, maxLength: 15 },
      email: { type: 'string' },
      address: { type: 'string' },
      pincode: { type: 'string' },
      parentName: { type: 'string' },
      coachName: { type: 'string' },
      academyName: { type: 'string' },
      category: { type: 'string' },
      profilePhoto: { type: 'string' },
      paymentMethod: { type: 'string' },
    },
  },
};
