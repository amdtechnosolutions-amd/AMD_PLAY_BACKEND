import { BaseController } from '../../core/BaseController.js';
import { iotService } from './iot.service.js';
import { accessService } from './access.service.js';
import { apiSuccess } from '../../utils/response.js';

export class IotController extends BaseController {
  constructor() {
    super(iotService);
  }

  async registerDevice(request, reply) {
    const context = this._extractContext(request);
    const device = await iotService.registerDevice(request.body, context);

    return reply.status(201).send(
      apiSuccess({
        message: 'IoT device registered successfully',
        data: device,
      })
    );
  }

  async listDevices(request, reply) {
    const context = this._extractContext(request);
    const { page, limit, ...filters } = request.query || {};
    const pagination = { page, limit };

    const result = await iotService.listDevices(filters, pagination, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Devices retrieved successfully',
        data: result.items,
        pagination: result.pagination,
      })
    );
  }

  async getDeviceById(request, reply) {
    const context = this._extractContext(request);
    const device = await iotService.getDeviceById(request.params.id, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'Device details retrieved',
        data: device,
      })
    );
  }

  async updateDevice(request, reply) {
    const context = this._extractContext(request);
    const device = await iotService.updateDevice(
      request.params.id,
      request.body,
      context
    );

    return reply.status(200).send(
      apiSuccess({
        message: 'IoT device updated successfully',
        data: device,
      })
    );
  }

  async deleteDevice(request, reply) {
    const context = this._extractContext(request);
    const result = await iotService.deleteDevice(request.params.id, context);

    return reply.status(200).send(
      apiSuccess({
        message: 'IoT device deleted successfully',
        data: result,
      })
    );
  }


  async toggleRelay(request, reply) {
    const context = this._extractContext(request);
    const result = await iotService.toggleRelayChannel(
      request.params.id,
      request.body,
      context
    );

    return reply.status(200).send(
      apiSuccess({
        message: `Relay channel ${request.body.channelNumber} switched ${request.body.state.toUpperCase()}`,
        data: result,
      })
    );
  }

  async toggleAllRelays(request, reply) {
    const context = this._extractContext(request);
    const result = await iotService.toggleAllRelayChannels(
      request.params.id,
      request.body.state,
      context
    );

    return reply.status(200).send(
      apiSuccess({
        message: `All relays switched ${request.body.state.toUpperCase()}`,
        data: result,
      })
    );
  }

  async triggerCourtLighting(request, reply) {
    const context = this._extractContext(request);
    const result = await iotService.triggerCourtLighting(
      request.params.resourceId,
      request.body.state,
      context
    );

    return reply.status(200).send(
      apiSuccess({
        message: `Court lighting switched ${request.body.state.toUpperCase()}`,
        data: result,
      })
    );
  }

  async recordHeartbeat(request, reply) {
    const result = await iotService.recordHeartbeat(request.params.id, request.body);

    return reply.status(200).send(
      apiSuccess({
        message: 'Heartbeat recorded',
        data: result,
      })
    );
  }

  async verifyAccess(request, reply) {
    const result = await accessService.verifyAccess(request.body);

    return reply.status(200).send(
      apiSuccess({
        message: result.accessGranted ? 'Access granted' : 'Access denied',
        data: result,
      })
    );
  }
}

export const iotController = new IotController();
