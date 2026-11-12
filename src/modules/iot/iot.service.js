import crypto from 'node:crypto';
import { deviceRepository } from './iot.repository.js';
import { resourceRepository } from '../resources/resource.repository.js';
import { mqttClient } from '../../config/mqtt.js';
import { HikvisionService } from './hikvision.service.js';
import { ValidationError, NotFoundError, ConflictError } from '../../errors/AppError.js';
import { logger } from '../../utils/logger.js';

function extractObjectId(val) {
  if (!val) return null;
  if (typeof val === 'object') {
    if (val._id) return extractObjectId(val._id);
    if (val.id) return extractObjectId(val.id);
    if (typeof val.toString === 'function') {
      const s = val.toString();
      if (/^[0-9a-fA-F]{24}$/.test(s)) return s;
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^[0-9a-fA-F]{24}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/[0-9a-fA-F]{24}/);
    if (match) return match[0];
  }
  return null;
}

function extractObjectIdArray(arr) {
  if (!arr) return [];
  if (!Array.isArray(arr)) {
    const single = extractObjectId(arr);
    return single ? [single] : [];
  }
  const result = [];
  const seen = new Set();
  for (const item of arr) {
    const id = extractObjectId(item);
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

export class IotService {
  constructor() {
    this.deviceRepository = deviceRepository;
  }

  async registerDevice(data, context = {}) {
    const tenantId = context.tenantId || data.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const branchId = data.branchId || context.branchId;
    if (!branchId) {
      throw new ValidationError('Branch ID is required');
    }

    const existing = await this.deviceRepository.findByCode(data.code, branchId, tenantId);
    if (existing) {
      throw new ConflictError(`Device with code '${data.code.toUpperCase()}' already exists in this branch`);
    }

    const deviceCode = data.code.toUpperCase().trim();
    const mqttTopic =
      data.mqttTopic ||
      `tenants/${tenantId}/branches/${branchId}/devices/${deviceCode.toLowerCase()}`;
    const apiKey = data.apiKey || `key_${crypto.randomBytes(16).toString('hex')}`;

    // Clean IP Address and Protocol
    let cleanIp = data.ipAddress ? String(data.ipAddress).trim() : '';
    let protocol = data.protocol;
    let port = data.port;
    if (cleanIp.startsWith('http://')) {
      protocol = protocol || 'http';
      cleanIp = cleanIp.replace(/^http:\/\//, '');
    } else if (cleanIp.startsWith('https://')) {
      protocol = protocol || 'https';
      cleanIp = cleanIp.replace(/^https:\/\//, '');
    }
    cleanIp = cleanIp.replace(/\/.*$/, '');
    if (cleanIp.includes(':')) {
      const [h, p] = cleanIp.split(':');
      cleanIp = h;
      if (!port && p) port = Number(p);
    }

    const sanitizedSportId = extractObjectId(data.sportId);
    const sanitizedResourceId = extractObjectId(data.resourceId);
    const sanitizedSportIds = extractObjectIdArray(data.sportIds);
    if (sanitizedSportId && !sanitizedSportIds.includes(sanitizedSportId)) {
      sanitizedSportIds.push(sanitizedSportId);
    }
    const sanitizedResourceIds = extractObjectIdArray(data.resourceIds);
    if (sanitizedResourceId && !sanitizedResourceIds.includes(sanitizedResourceId)) {
      sanitizedResourceIds.push(sanitizedResourceId);
    }
    const sanitizedBranchId = extractObjectId(branchId);

    const payload = {
      ...data,
      code: deviceCode,
      tenantId,
      branchId: sanitizedBranchId,
      ipAddress: cleanIp,
      protocol: protocol || (port === 443 ? 'https' : 'http'),
      username: (data.username !== undefined && data.username !== null && data.username !== '') ? data.username : 'admin',
      password: (data.password !== undefined && data.password !== null) ? data.password : '',
      sportId: sanitizedSportId,
      sportIds: sanitizedSportIds,
      resourceId: sanitizedResourceId,
      resourceIds: sanitizedResourceIds,
      mqttTopic,
      apiKey,
      status: data.status || 'offline',
    };

    return await this.deviceRepository.create(payload);
  }

  async listDevices(filters = {}, pagination = {}, context = {}) {
    const filter = {};
    if (filters.branchId) filter.branchId = filters.branchId;
    if (filters.type) filter.type = filters.type;
    if (filters.status) filter.status = filters.status;
    if (filters.resourceId) filter.resourceId = filters.resourceId;

    return await this.deviceRepository.paginateDevices(filter, pagination, context.tenantId);
  }

  async getDeviceById(id, context = {}) {
    const device = await this.deviceRepository.findById(id, context.tenantId);
    if (!device) {
      throw new NotFoundError(`Device with ID '${id}' not found`);
    }
    return device;
  }

  async updateDevice(id, data, context = {}) {
    const tenantId = context.tenantId || data.tenantId;
    const device = await this.deviceRepository.findById(id, tenantId);
    if (!device) {
      throw new NotFoundError(`Device with ID '${id}' not found`);
    }

    if (data.code) {
      const newCode = data.code.toUpperCase().trim();
      if (newCode !== device.code) {
        const branchId = data.branchId || device.branchId;
        const existing = await this.deviceRepository.findByCode(newCode, branchId, tenantId);
        if (existing && existing._id.toString() !== id.toString()) {
          throw new ConflictError(`Device with code '${newCode}' already exists in this branch`);
        }
        device.code = newCode;
      }
    }

    if (data.ipAddress !== undefined) {
      let cleanIp = String(data.ipAddress || '').trim();
      if (cleanIp.startsWith('http://')) {
        data.protocol = data.protocol || 'http';
        cleanIp = cleanIp.replace(/^http:\/\//, '');
      } else if (cleanIp.startsWith('https://')) {
        data.protocol = data.protocol || 'https';
        cleanIp = cleanIp.replace(/^https:\/\//, '');
      }
      cleanIp = cleanIp.replace(/\/.*$/, '');
      if (cleanIp.includes(':')) {
        const [h, p] = cleanIp.split(':');
        cleanIp = h;
        if (!data.port && p) data.port = Number(p);
      }
      data.ipAddress = cleanIp;
    }

    const allowedFields = [
      'name',
      'type',
      'branchId',
      'sportId',
      'sportIds',
      'resourceId',
      'resourceIds',
      'accessScope',
      'ipAddress',
      'port',
      'protocol',
      'username',
      'password',
      'doorNo',
      'isDefaultEntrance',
      'macAddress',
      'mqttTopic',
      'relayChannels',
      'apiKey',
      'status',
      'metadata',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'sportId' || field === 'resourceId') {
          const cleanId = extractObjectId(data[field]);
          device[field] = cleanId;
        } else if (field === 'sportIds' || field === 'resourceIds') {
          device[field] = extractObjectIdArray(data[field]);
        } else if (field === 'branchId') {
          const cleanBranch = extractObjectId(data[field]);
          if (cleanBranch) device[field] = cleanBranch;
        } else {
          device[field] = data[field];
        }
      }
    }

    // Keep primary sportId in sync with sportIds array
    if (device.sportIds && device.sportIds.length > 0) {
      if (!device.sportId || !device.sportIds.some((id) => id.toString() === device.sportId.toString())) {
        device.sportId = device.sportIds[0];
      }
    }

    // Keep primary resourceId in sync with resourceIds array
    if (device.resourceIds && device.resourceIds.length > 0) {
      if (!device.resourceId || !device.resourceIds.some((id) => id.toString() === device.resourceId.toString())) {
        device.resourceId = device.resourceIds[0];
      }
    }



    await device.save();

    return await this.deviceRepository.model
      .findById(device._id)
      .populate('branchId', 'name code')
      .populate('resourceId', 'name code')
      .populate('resourceIds', 'name code')
      .populate('sportId', 'name slug icon type')
      .populate('sportIds', 'name slug icon type');
  }

  async deleteDevice(id, context = {}) {
    const tenantId = context.tenantId;
    const device = await this.deviceRepository.findById(id, tenantId);
    if (!device) {
      throw new NotFoundError(`Device with ID '${id}' not found`);
    }

    // Clear any court/resource iotMapping pointing to this device
    await resourceRepository.model.updateMany(
      { tenantId: device.tenantId, 'iotMapping.deviceId': id },
      { $unset: { 'iotMapping.deviceId': '' } }
    );

    await this.deviceRepository.deleteById(id, tenantId);

    return {
      id: device._id.toString(),
      code: device.code,
      message: 'IoT device deleted successfully',
    };
  }

  async toggleRelayChannel(deviceId, { channelNumber, state, target = null } = {}, context = {}) {
    const device = await this.deviceRepository.findById(deviceId, context.tenantId);
    if (!device) {
      throw new NotFoundError(`Device with ID '${deviceId}' not found`);
    }

    const normalizedState = state.toLowerCase();
    if (!['on', 'off'].includes(normalizedState)) {
      throw new ValidationError("State must be either 'on' or 'off'");
    }

    // Support channelNumber === 0 or 'all' for Master All Relays toggle
    if (channelNumber === 0 || channelNumber === 'all') {
      return await this.toggleAllRelayChannels(deviceId, normalizedState, context);
    }

    let channel = device.relayChannels.find((c) => c.channelNumber === channelNumber);
    if (!channel) {
      device.relayChannels.push({
        channelNumber,
        target: 'light',
        state: normalizedState,
        label: `Channel ${channelNumber}`,
      });
      channel = device.relayChannels[device.relayChannels.length - 1];
    } else {
      channel.state = normalizedState;
    }

    device.status = 'online';
    device.lastHeartbeat = new Date();
    if (typeof device.save === 'function') {
      await device.save();
    } else {
      await this.deviceRepository.model.findByIdAndUpdate(device._id, {
        $set: {
          relayChannels: device.relayChannels,
          status: 'online',
          lastHeartbeat: new Date(),
        },
      });
    }

    const isSelfOrVpsHost = (ip) => {
      if (!ip) return true;
      const cleaned = String(ip).trim().toLowerCase();
      return (
        cleaned === '103.99.36.60' ||
        cleaned === '127.0.0.1' ||
        cleaned === 'localhost' ||
        cleaned === '::1' ||
        cleaned.includes('amdplayapi') ||
        cleaned.includes('amdtechno.in')
      );
    };

    // 1. Direct hardware trigger dispatch
    const isSmartElexBoard = device.type === 'relay' || String(device.model || '').toLowerCase().includes('smartelex');
    if (isSmartElexBoard && device.ipAddress && device.protocol !== 'mqtt' && !isSelfOrVpsHost(device.ipAddress)) {
      const portStr = device.port && device.port !== 80 ? `:${device.port}` : '';
      const httpUrl = `http://${device.ipAddress}${portStr}/toggle?ch=${channelNumber}&state=${normalizedState}&json=1`;
      logger.info({ url: httpUrl, device: device.name, channel: channelNumber }, 'Dispatching direct HTTP trigger to SmartElex relay');
      fetch(httpUrl, { redirect: 'manual', signal: AbortSignal.timeout(2000) })
        .then((res) => logger.info({ status: res.status, device: device.name }, 'SmartElex direct HTTP relay trigger dispatched'))
        .catch((httpErr) => logger.warn({ err: httpErr.message, ip: device.ipAddress }, 'SmartElex direct HTTP relay trigger failed or timed out'));
    }

    // Direct door control for Biometric Access Terminals (Hikvision)
    const isBiometricTerminal = device.type === 'biometric_terminal' || String(device.model || '').toLowerCase().includes('hikvision');
    if (isBiometricTerminal && (normalizedState === 'on' || target === 'lock' || channel?.target === 'lock')) {
      const hikClient = HikvisionService.forDevice({
        ip: device.ipAddress,
        port: device.port,
        username: device.username,
        password: device.password,
        protocol: device.protocol,
        timeout: 2500,
      });
      hikClient.remoteControlDoor(device.doorNo || 1, 'open')
        .then(() => logger.info({ device: device.name, doorNo: device.doorNo || 1 }, 'Hikvision door remote open triggered successfully'))
        .catch((err) => logger.warn({ err: err.message, device: device.name }, 'Hikvision door remote control failed or timed out'));
    }

    // 2. Publish MQTT relay command
    // Matches exact WS_MQTT.cpp parser:
    // Format A: {"data":{"CH1":1}}
    // Format B: {"channel":1,"state":"ON"}
    const defaultTopic = `tenants/${device.tenantId}/branches/${device.branchId}/relays/${device.code.toLowerCase()}/command`;
    const isStateOn = normalizedState === 'on';
    const channelKey = `CH${channelNumber}`;

    const exactSmartElexPayload = {
      data: {
        [channelKey]: isStateOn ? 1 : 0,
      },
      channel: channelNumber,
      state: isStateOn ? 'ON' : 'OFF',
      relay: channelNumber,
      [channelKey]: isStateOn ? 1 : 0,
      deviceId: device._id,
      deviceCode: device.code,
      timestamp: new Date().toISOString(),
    };

    const targetTopics = [defaultTopic];
    if (device.mqttTopic && device.mqttTopic !== defaultTopic) {
      targetTopics.push(device.mqttTopic);
    }

    for (const t of targetTopics) {
      // 1. Send exact SmartElex firmware JSON payload
      await mqttClient.publish(t, exactSmartElexPayload);
      // 2. Also send compact Format A payload: {"data":{"CH1":1}}
      await mqttClient.publish(t, JSON.stringify({ data: { [channelKey]: isStateOn ? 1 : 0 } }));
      // 3. Subtopics
      await mqttClient.publish(`${t}/${channelNumber}`, isStateOn ? '1' : '0');
      await mqttClient.publish(`${t}/${channelKey}`, isStateOn ? '1' : '0');
    }

    return {
      success: true,
      deviceId: device._id,
      deviceCode: device.code,
      channelNumber,
      state: normalizedState,
      topic: device.mqttTopic || defaultTopic,
    };
  }

  async toggleAllRelayChannels(deviceId, state, context = {}) {
    const device = await this.deviceRepository.findById(deviceId, context.tenantId);
    if (!device) {
      throw new NotFoundError(`Device with ID '${deviceId}' not found`);
    }

    const normalizedState = state.toLowerCase();
    if (!['on', 'off'].includes(normalizedState)) {
      throw new ValidationError("State must be either 'on' or 'off'");
    }

    // Ensure all 6 channels are defined and set to target state in DB
    const maxChannels = Math.max(6, Array.isArray(device.relayChannels) ? device.relayChannels.length : 6);
    for (let ch = 1; ch <= maxChannels; ch++) {
      let channel = device.relayChannels.find((c) => c.channelNumber === ch);
      if (!channel) {
        device.relayChannels.push({
          channelNumber: ch,
          target: ch % 2 === 1 ? 'light' : 'fan',
          state: normalizedState,
          label: `CH${ch}`,
        });
      } else {
        channel.state = normalizedState;
      }
    }

    device.status = 'online';
    device.lastHeartbeat = new Date();
    if (typeof device.save === 'function') {
      await device.save();
    } else {
      await this.deviceRepository.model.findByIdAndUpdate(device._id, {
        $set: {
          relayChannels: device.relayChannels,
          status: 'online',
          lastHeartbeat: new Date(),
        },
      });
    }

    const isSelfOrVpsHost = (ip) => {
      if (!ip) return true;
      const cleaned = String(ip).trim().toLowerCase();
      return (
        cleaned === '103.99.36.60' ||
        cleaned === '127.0.0.1' ||
        cleaned === 'localhost' ||
        cleaned === '::1' ||
        cleaned.includes('amdplayapi') ||
        cleaned.includes('amdtechno.in')
      );
    };

    // 1. Direct hardware trigger dispatch
    const isSmartElexBoard = device.type === 'relay' || String(device.model || '').toLowerCase().includes('smartelex');
    if (isSmartElexBoard && device.ipAddress && device.protocol !== 'mqtt' && !isSelfOrVpsHost(device.ipAddress)) {
      const portStr = device.port && device.port !== 80 ? `:${device.port}` : '';
      const endpoint = normalizedState === 'off' ? 'all_off' : 'all_on';
      const httpUrl = `http://${device.ipAddress}${portStr}/${endpoint}?json=1`;
      logger.info({ url: httpUrl, device: device.name, state: normalizedState }, 'Dispatching direct master relay trigger');
      fetch(httpUrl, { redirect: 'manual', signal: AbortSignal.timeout(2000) })
        .then((res) => logger.info({ status: res.status, device: device.name }, 'SmartElex direct master trigger dispatched'))
        .catch((httpErr) => logger.warn({ err: httpErr.message, ip: device.ipAddress }, 'SmartElex direct master trigger failed or timed out'));
    }

    // Direct door control for Biometric Access Terminals (Hikvision)
    const isBiometricTerminal = device.type === 'biometric_terminal' || String(device.model || '').toLowerCase().includes('hikvision');
    if (isBiometricTerminal && normalizedState === 'on') {
      const hikClient = HikvisionService.forDevice({
        ip: device.ipAddress,
        port: device.port,
        username: device.username,
        password: device.password,
        protocol: device.protocol,
        timeout: 2500,
      });
      hikClient.remoteControlDoor(device.doorNo || 1, 'open')
        .then(() => logger.info({ device: device.name, doorNo: device.doorNo || 1 }, 'Hikvision door remote open triggered successfully'))
        .catch((err) => logger.warn({ err: err.message, device: device.name }, 'Hikvision door remote control failed or timed out'));
    }

    // 2. Publish MQTT master command
    const defaultTopic = `tenants/${device.tenantId}/branches/${device.branchId}/relays/${device.code.toLowerCase()}/command`;
    const isStateOn = normalizedState === 'on';

    const commandPayload = {
      command: normalizedState === 'off' ? 'ALL_OFF' : 'ALL_ON',
      action: normalizedState === 'off' ? 'ALL_OFF' : 'ALL_ON',
      state: normalizedState.toUpperCase(),
      status: isStateOn ? 1 : 0,
      CH1: isStateOn ? 1 : 0,
      CH2: isStateOn ? 1 : 0,
      CH3: isStateOn ? 1 : 0,
      CH4: isStateOn ? 1 : 0,
      CH5: isStateOn ? 1 : 0,
      CH6: isStateOn ? 1 : 0,
      ch1: isStateOn ? 1 : 0,
      ch2: isStateOn ? 1 : 0,
      ch3: isStateOn ? 1 : 0,
      ch4: isStateOn ? 1 : 0,
      ch5: isStateOn ? 1 : 0,
      ch6: isStateOn ? 1 : 0,
      data: {
        ALL: isStateOn ? 1 : 0,
        CH1: isStateOn ? 1 : 0,
        CH2: isStateOn ? 1 : 0,
        CH3: isStateOn ? 1 : 0,
        CH4: isStateOn ? 1 : 0,
        CH5: isStateOn ? 1 : 0,
        CH6: isStateOn ? 1 : 0,
      },
      deviceId: device._id,
      deviceCode: device.code,
      channel: 0,
      timestamp: new Date().toISOString(),
    };

    const targetTopics = [defaultTopic];
    if (device.mqttTopic && device.mqttTopic !== defaultTopic) {
      targetTopics.push(device.mqttTopic);
    }

    for (const t of targetTopics) {
      // 1. Send ultra-compact Format A payload matching WS_MQTT.cpp directly: {"data":{"ALL":1}}
      await mqttClient.publish(t, JSON.stringify({ data: { ALL: isStateOn ? 1 : 0 } }));
      // 2. Send master command full payload
      await mqttClient.publish(t, commandPayload);
      // 3. Subtopics
      for (let ch = 1; ch <= 6; ch++) {
        await mqttClient.publish(`${t}/${ch}`, isStateOn ? '1' : '0');
        await mqttClient.publish(`${t}/CH${ch}`, isStateOn ? '1' : '0');
      }
    }

    return {
      success: true,
      deviceId: device._id,
      deviceCode: device.code,
      allChannels: true,
      state: normalizedState,
      topic: device.mqttTopic || defaultTopic,
    };
  }

  async triggerCourtLighting(resourceId, state, context = {}) {
    const tenantId = context.tenantId;
    const normalizedState = state.toLowerCase();
    if (!['on', 'off'].includes(normalizedState)) {
      throw new ValidationError("State must be either 'on' or 'off'");
    }

    const resource = await resourceRepository.findById(resourceId, tenantId);
    if (!resource) {
      throw new NotFoundError(`Court / Resource with ID '${resourceId}' not found`);
    }

    const resolvedTenantId = tenantId || resource.tenantId;
    let device = null;
    let channelNumber = 1;

    // 1. Check resource model's iotMapping first (handles multi-court shared relay modules)
    if (resource.iotMapping?.deviceId) {
      device = await this.deviceRepository.findById(resource.iotMapping.deviceId, resolvedTenantId);
      channelNumber = resource.iotMapping.lightRelayChannel || 1;
    }

    // 2. Fallback: Check if device directly references resourceId (prioritizing smart relay controller)
    if (!device) {
      device = await this.deviceRepository.findCourtDevice(resourceId, resolvedTenantId, 'relay');
      if (device && Array.isArray(device.relayChannels) && device.relayChannels.length > 0) {
        channelNumber = device.relayChannels[0].channelNumber || 1;
      }
    }

    if (!device) {
      throw new NotFoundError(`No IoT relay controller configured for court '${resourceId}'`);
    }

    // Collect all light channels for this court (supporting single, dual, or multi-light rows)
    const lightChannels = new Set();
    if (Array.isArray(resource.iotMapping?.lightRelayChannels)) {
      resource.iotMapping.lightRelayChannels.forEach((ch) => ch && lightChannels.add(Number(ch)));
    }
    if (Array.isArray(resource.iotMapping?.row1Lights)) {
      resource.iotMapping.row1Lights.forEach((ch) => ch && lightChannels.add(Number(ch)));
    }
    if (Array.isArray(resource.iotMapping?.lights)) {
      resource.iotMapping.lights.forEach((ch) => ch && lightChannels.add(Number(ch)));
    }
    if (Array.isArray(resource.iotMapping?.lightRelayChannel)) {
      resource.iotMapping.lightRelayChannel.forEach((ch) => ch && lightChannels.add(Number(ch)));
    } else if (resource.iotMapping?.lightRelayChannel && !isNaN(Number(resource.iotMapping.lightRelayChannel))) {
      lightChannels.add(Number(resource.iotMapping.lightRelayChannel));
    }
    if (resource.iotMapping?.lightRelayChannel2 && !isNaN(Number(resource.iotMapping.lightRelayChannel2))) {
      lightChannels.add(Number(resource.iotMapping.lightRelayChannel2));
    }
    if (lightChannels.size === 0) {
      if (Array.isArray(device.relayChannels)) {
        const configuredLights = device.relayChannels.filter((c) => c.target === 'light').map((c) => c.channelNumber);
        if (configuredLights.length > 0) {
          configuredLights.forEach((ch) => lightChannels.add(ch));
        }
      }
      if (lightChannels.size === 0) {
        lightChannels.add(channelNumber || 1);
      }
    }

    // Toggle all light relay channels (supporting dual lights e.g. row 1 light 1 and light 2)
    let lightResult = null;
    for (const ch of lightChannels) {
      lightResult = await this.toggleRelayChannel(
        device._id,
        { channelNumber: ch, state: normalizedState },
        { tenantId: resolvedTenantId, branchId: resource.branchId, ...context }
      );
    }

    // If court also maps a fan/exhaust relay channel (e.g. Court 1 uses CH1/CH2 for Light, CH3 for Fan)
    if (resource.iotMapping?.fanRelayChannel && !lightChannels.has(Number(resource.iotMapping.fanRelayChannel))) {
      await this.toggleRelayChannel(
        device._id,
        { channelNumber: resource.iotMapping.fanRelayChannel, state: normalizedState },
        { tenantId: resolvedTenantId, branchId: resource.branchId, ...context }
      );
    }

    return lightResult;
  }

  async recordHeartbeat(deviceId, payload = {}) {
    const device = await this.deviceRepository.findById(deviceId);
    if (!device) {
      throw new NotFoundError(`Device with ID '${deviceId}' not found`);
    }

    device.status = 'online';
    device.lastHeartbeat = new Date();
    if (payload.ipAddress) {
      device.ipAddress = payload.ipAddress;
    }
    await device.save();

    const topic = `tenants/${device.tenantId}/branches/${device.branchId}/devices/${device.code.toLowerCase()}/heartbeat`;
    await mqttClient.publish(topic, {
      deviceId: device._id,
      code: device.code,
      status: 'online',
      timestamp: device.lastHeartbeat.toISOString(),
    });

    return {
      success: true,
      deviceId: device._id,
      status: device.status,
      lastHeartbeat: device.lastHeartbeat,
    };
  }
}

export const iotService = new IotService();
