import { BaseController } from '../../core/BaseController.js';
import { membershipService } from './membership.service.js';
import { apiSuccess } from '../../utils/response.js';

export class MembershipController extends BaseController {
  constructor() {
    super(membershipService);
  }

  async createPlan(request, reply) {
    const context = this._extractContext(request);
    const plan = await membershipService.createPlan(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Membership plan created successfully',
        data: plan,
      })
    );
  }

  async listActivePlans(request, reply) {
    const context = this._extractContext(request);
    const plans = await membershipService.listActivePlans(context.tenantId);

    return reply.status(200).send(
      apiSuccess({
        message: 'Active membership plans retrieved',
        data: plans,
      })
    );
  }

  async registerMember(request, reply) {
    const context = this._extractContext(request);
    const result = await membershipService.registerMember(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Member registered and subscription activated successfully',
        data: result,
      })
    );
  }

  async subscribeUser(request, reply) {
    const context = this._extractContext(request);
    const subscription = await membershipService.subscribeUser(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Subscription activated successfully',
        data: subscription,
      })
    );
  }

  async getMySubscriptions(request, reply) {
    const context = this._extractContext(request);
    const subscriptions = await membershipService.getMySubscriptions(context);

    return reply.status(200).send(
      apiSuccess({
        message: 'User subscriptions retrieved',
        data: subscriptions,
      })
    );
  }

  async listSubscriptions(request, reply) {
    const context = this._extractContext(request);
    const subscriptions = await membershipService.listAllSubscriptions(context);

    return reply.status(200).send(
      apiSuccess({
        message: 'All subscriptions retrieved',
        data: subscriptions,
      })
    );
  }

  async createRazorpayOrder(request, reply) {
    const context = this._extractContext(request);
    const order = await membershipService.createRazorpayOrder(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Razorpay membership order generated successfully',
        data: order,
      })
    );
  }

  async verifyRazorpayPayment(request, reply) {
    const context = this._extractContext(request);
    const subscription = await membershipService.verifyRazorpayPayment(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'Razorpay payment verified and membership subscription activated',
        data: subscription,
      })
    );
  }

  async assignSubscriptionTimeSlot(request, reply) {
    const context = this._extractContext(request);
    const subscription = await membershipService.assignSubscriptionTimeSlot(
      request.params.id,
      request.body,
      context
    );

    return reply.status(200).send(
      apiSuccess({
        message: 'Member time slot assigned and biometric gate schedule updated successfully',
        data: subscription,
      })
    );
  }
}

export const membershipController = new MembershipController();

