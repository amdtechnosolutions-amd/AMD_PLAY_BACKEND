import { settingsService } from './settings.service.js';
import { apiSuccess } from '../../utils/response.js';

export class SettingsController {
  async getSettings(request, reply) {
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];
    const settings = await settingsService.getSettings(tenantId);
    return reply.send(
      apiSuccess({
        message: 'Settings fetched successfully',
        data: settings,
      })
    );
  }

  async updateSettings(request, reply) {
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];
    const updated = await settingsService.updateSettings(tenantId, request.body);
    return reply.send(
      apiSuccess({
        message: 'Settings updated successfully',
        data: updated,
      })
    );
  }

  async testWhatsApp(request, reply) {
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];
    const { destinationNumber, message } = request.body || {};
    const result = await settingsService.testWhatsAppMessage(tenantId, {
      destinationNumber,
      message,
    });
    return reply.send(
      apiSuccess({
        message: result.message || 'Test WhatsApp message dispatched',
        data: result,
      })
    );
  }

  async getWhatsAppTemplates(request, reply) {
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];
    const templates = await settingsService.getWhatsAppTemplates(tenantId);
    return reply.send(
      apiSuccess({
        message: 'Templates fetched successfully',
        data: templates,
      })
    );
  }

  async testPaymentGateway(request, reply) {
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];
    const { gateway, credentials } = request.body || {};
    const result = await settingsService.testPaymentGateway(tenantId, {
      gateway,
      credentials,
    });
    return reply.send(
      apiSuccess({
        message: result.message || 'Payment gateway connection verified',
        data: result,
      })
    );
  }
}

export const settingsController = new SettingsController();
