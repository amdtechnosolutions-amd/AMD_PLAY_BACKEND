import { BaseRepository } from '../../core/BaseRepository.js';
import { Announcement } from './announcement.model.js';

export class AnnouncementRepository extends BaseRepository {
  constructor() {
    super(Announcement);
  }
}

export const announcementRepository = new AnnouncementRepository();
