import { BaseService } from '../../core/BaseService.js';
import { enquiryRepository } from './enquiry.repository.js';
import { NotFoundError } from '../../errors/AppError.js';

export class EnquiryService extends BaseService {
  constructor() {
    super(enquiryRepository, 'Enquiry');
  }

  async addNote(id, noteContent, userId, context = {}) {
    const tenantId = context.tenantId;
    const enquiry = await this.repository.findById(id, tenantId);
    if (!enquiry) {
      throw new NotFoundError(`Enquiry with ID '${id}' not found`);
    }

    enquiry.notes.push({
      content: noteContent,
      createdBy: userId,
      createdAt: new Date(),
    });

    await enquiry.save();
    return enquiry;
  }
}

export const enquiryService = new EnquiryService();
