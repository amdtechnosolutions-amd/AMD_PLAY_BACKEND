import { BaseController } from '../../core/BaseController.js';
import { announcementService } from './announcement.service.js';
import { apiSuccess } from '../../utils/response.js';

export class AnnouncementController extends BaseController {
  constructor() {
    super(announcementService);
  }

  async create(req, reply) {
    const context = this._extractContext(req);
    const result = await announcementService.createAnnouncement(req.body, context);
    return reply.status(201).send(
      apiSuccess({
        message: 'Announcement published successfully',
        data: result,
      })
    );
  }
}

export const announcementController = new AnnouncementController();
