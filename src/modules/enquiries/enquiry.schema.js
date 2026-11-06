export const createEnquirySchema = {
  description: 'Submit or record a new lead / student enquiry',
  tags: ['CRM Enquiries & Leads'],
  body: {
    type: 'object',
    required: ['name', 'phone'],
    properties: {
      branchId: { type: 'string', minLength: 24, maxLength: 24 },
      sportId: { type: 'string', minLength: 24, maxLength: 24 },
      name: { type: 'string', minLength: 2 },
      phone: { type: 'string', minLength: 10, maxLength: 15 },
      email: { type: 'string' },
      interest: {
        type: 'string',
        enum: ['Coaching', 'Court Booking', 'Membership', 'Tournament', 'General', 'Events', 'Other'],
      },
      message: { type: 'string' },
      source: {
        type: 'string',
        enum: [
          'Walk-in',
          'Website',
          'Website Form',
          'Phone Call',
          'Phone',
          'IVR',
          'IVR / Phone Call',
          'WhatsApp',
          'Social Media',
          'Referral',
          'Campaign',
          'Other',
        ],
      },
      status: {
        type: 'string',
        enum: ['Pending', 'Contacted', 'Trial Scheduled', 'Converted', 'Lost', 'Closed'],
      },
    },
  },
};

export const updateEnquirySchema = {
  description: 'Update enquiry status, notes, or assignment',
  tags: ['CRM Enquiries & Leads'],
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
    properties: {
      status: {
        type: 'string',
        enum: ['Pending', 'Contacted', 'Trial Scheduled', 'Converted', 'Lost', 'Closed'],
      },
      followUpDate: { type: 'string' },
      assignedTo: { type: 'string', minLength: 24, maxLength: 24 },
      message: { type: 'string' },
    },
  },
};
