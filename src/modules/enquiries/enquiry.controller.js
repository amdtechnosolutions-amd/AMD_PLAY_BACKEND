import { BaseController } from '../../core/BaseController.js';
import { enquiryService } from './enquiry.service.js';
import { apiSuccess } from '../../utils/response.js';

export class EnquiryController extends BaseController {
  constructor() {
    super(enquiryService);
  }

  async addNote(req, reply) {
    const context = this._extractContext(req);
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user?.id || req.user?.sub;
    const result = await enquiryService.addNote(id, content, userId, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'Note added successfully',
        data: result,
      })
    );
  }
}

export const enquiryController = new EnquiryController();
