import { BaseRepository } from '../../core/BaseRepository.js';
import { Enquiry } from './enquiry.model.js';

export class EnquiryRepository extends BaseRepository {
  constructor() {
    super(Enquiry);
  }
}

export const enquiryRepository = new EnquiryRepository();
