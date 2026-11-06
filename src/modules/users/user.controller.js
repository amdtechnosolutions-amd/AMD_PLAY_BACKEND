import { BaseController } from '../../core/BaseController.js';
import { userService } from './user.service.js';
import { apiSuccess } from '../../utils/response.js';

export class UserController extends BaseController {
  constructor() {
    super(userService);
  }

  async deactivate(request, reply) {
    const context = this._extractContext(request);
    const deactivated = await userService.deactivate(request.params.id, context);
    return reply.status(200).send(
      apiSuccess({
        message: 'User account deactivated successfully',
        data: deactivated,
      })
    );
  }
}

export const userController = new UserController();
