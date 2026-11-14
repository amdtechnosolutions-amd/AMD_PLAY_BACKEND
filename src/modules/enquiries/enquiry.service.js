import { BaseService } from '../../core/BaseService.js';
import { enquiryRepository } from './enquiry.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { Tenant } from '../tenants/tenant.model.js';
import { Branch } from '../branches/branch.model.js';
import { Sport } from '../sports/sport.model.js';

export class EnquiryService extends BaseService {
  constructor() {
    super(enquiryRepository, 'Enquiry');
  }

  async create(data, context = {}) {
    let tenantId = context.tenantId || data.tenantId;

    if (!tenantId && data.branchId) {
      try {
        const branch = await Branch.findById(data.branchId);
        if (branch) tenantId = branch.tenantId;
      } catch (_) {}
    }

    if (!tenantId && data.sportId) {
      try {
        const sport = await Sport.findById(data.sportId);
        if (sport) tenantId = sport.tenantId;
      } catch (_) {}
    }

    if (!tenantId) {
      const activeTenant = await Tenant.findOne({ status: 'active' });
      if (activeTenant) tenantId = activeTenant._id;
    }

    let branchId = context.branchId || data.branchId;
    if (!branchId && tenantId) {
      const defaultBranch =
        (await Branch.findOne({ tenantId, code: 'MAIN' })) ||
        (await Branch.findOne({ tenantId }));
      if (defaultBranch) branchId = defaultBranch._id;
    }

    const payload = {
      ...data,
      tenantId,
      branchId,
      source: data.source || (context.user ? 'Walk-in' : 'Website Form'),
      status: data.status || 'Pending',
    };

    return await this.repository.create(payload);
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
