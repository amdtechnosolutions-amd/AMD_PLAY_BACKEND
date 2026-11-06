import { iotController } from './iot.controller.js';
import {
  registerDeviceSchema,
  queryDevicesSchema,
  updateDeviceSchema,
  deleteDeviceSchema,
  toggleRelaySchema,
  masterRelaySchema,
  courtLightingSchema,
  deviceHeartbeatSchema,
  verifyAccessSchema,
  deviceParamSchema,
} from './iot.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function iotRoutes(fastify) {
  // Device Management
  fastify.post('/iot/devices', {
    schema: registerDeviceSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: iotController.registerDevice.bind(iotController),
  });

  fastify.get('/iot/devices', {
    schema: queryDevicesSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: iotController.listDevices.bind(iotController),
  });

  fastify.get('/iot/devices/:id', {
    schema: deviceParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: iotController.getDeviceById.bind(iotController),
  });

  fastify.patch('/iot/devices/:id', {
    schema: updateDeviceSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: iotController.updateDevice.bind(iotController),
  });

  fastify.put('/iot/devices/:id', {
    schema: updateDeviceSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: iotController.updateDevice.bind(iotController),
  });

  fastify.delete('/iot/devices/:id', {
    schema: deleteDeviceSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: iotController.deleteDevice.bind(iotController),
  });

  // Relay Controls (Light, Fan, AC, EM Lock)
  fastify.post('/iot/devices/:id/relay', {
    schema: toggleRelaySchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: iotController.toggleRelay.bind(iotController),
  });

  // Master All Relays Control (All ON / All OFF)
  fastify.post('/iot/devices/:id/all-relays', {
    schema: masterRelaySchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: iotController.toggleAllRelays.bind(iotController),
  });

  // Court Lighting Automation Trigger
  fastify.post('/iot/courts/:resourceId/lighting', {
    schema: courtLightingSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: iotController.triggerCourtLighting.bind(iotController),
  });

  // Device Edge Heartbeat Telemetry (Public or edge authenticated)
  fastify.post('/iot/devices/:id/heartbeat', {
    schema: deviceHeartbeatSchema,
    handler: iotController.recordHeartbeat.bind(iotController),
  });

  // Access Control PIN & QR Verification (Turnstile, Door Lock Keypad)
  fastify.post('/iot/access/verify', {
    schema: verifyAccessSchema,
    handler: iotController.verifyAccess.bind(iotController),
  });
}
