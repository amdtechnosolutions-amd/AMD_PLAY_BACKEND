import { BaseRepository } from '../../core/BaseRepository.js';
import { User } from './user.model.js';

export class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmailWithPassword(email, tenantId = null) {
    const filter = tenantId
      ? { email: email.toLowerCase(), tenantId }
      : { email: email.toLowerCase() };
    return await this.model.findOne(filter).select('+password');
  }

  async findByPhone(phone, tenantId = null) {
    const filter = this._scopeFilter({ phone }, tenantId);
    return await this.model.findOne(filter);
  }
}

export const userRepository = new UserRepository();
