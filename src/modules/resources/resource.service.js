import { BaseService } from '../../core/BaseService.js';
import { resourceRepository } from './resource.repository.js';
import { branchRepository } from '../branches/branch.repository.js';
import { sportRepository } from '../sports/sport.repository.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { ConflictError, NotFoundError, ValidationError } from '../../errors/AppError.js';

export class ResourceService extends BaseService {
  constructor() {
    super(resourceRepository, 'Resource');
  }

  _normalizeIotMapping(data) {
    if (!data) return data;

    // Check if iot fields were provided at top level and move to iotMapping
    if (!data.iotMapping) {
      if (
        data.lightRelayChannel !== undefined ||
        data.lightRelayChannel2 !== undefined ||
        data.lightRelayChannels !== undefined ||
        data.row1 !== undefined ||
        data.row1Lights !== undefined ||
        data.deviceId !== undefined
      ) {
        data.iotMapping = {};
      }
    }

    const iot = data.iotMapping;
    if (!iot) return data;

    // If top level had iot fields, copy them into iotMapping
    if (data.deviceId && !iot.deviceId) iot.deviceId = data.deviceId;
    if (data.lightRelayChannel !== undefined && iot.lightRelayChannel === undefined) iot.lightRelayChannel = data.lightRelayChannel;
    if (data.lightRelayChannel2 !== undefined && iot.lightRelayChannel2 === undefined) iot.lightRelayChannel2 = data.lightRelayChannel2;
    if (data.lightRelayChannels !== undefined && iot.lightRelayChannels === undefined) iot.lightRelayChannels = data.lightRelayChannels;
    if (data.row1 !== undefined && iot.row1 === undefined) iot.row1 = data.row1;
    if (data.row1Lights !== undefined && iot.row1Lights === undefined) iot.row1Lights = data.row1Lights;

    // 1. Handle row1 or row1Lights (e.g. 2 lights in row one: [1, 2] or "1,2")
    let row1List = [];
    if (Array.isArray(iot.row1)) {
      row1List = iot.row1.map(Number).filter((n) => !isNaN(n));
    } else if (Array.isArray(iot.row1Lights)) {
      row1List = iot.row1Lights.map(Number).filter((n) => !isNaN(n));
    } else if (typeof iot.row1 === 'string' && iot.row1.includes(',')) {
      row1List = iot.row1.split(',').map((x) => Number(x.trim())).filter((n) => !isNaN(n));
    } else if (typeof iot.row1Lights === 'string' && iot.row1Lights.includes(',')) {
      row1List = iot.row1Lights.split(',').map((x) => Number(x.trim())).filter((n) => !isNaN(n));
    }

    // 2. Handle lightRelayChannels array
    let channelsList = [];
    if (Array.isArray(iot.lightRelayChannels)) {
      channelsList = iot.lightRelayChannels.map(Number).filter((n) => !isNaN(n));
    } else if (typeof iot.lightRelayChannels === 'string' && iot.lightRelayChannels.includes(',')) {
      channelsList = iot.lightRelayChannels.split(',').map((x) => Number(x.trim())).filter((n) => !isNaN(n));
    }

    // 3. Handle lightRelayChannel if passed as array
    if (Array.isArray(iot.lightRelayChannel)) {
      const arr = iot.lightRelayChannel.map(Number).filter((n) => !isNaN(n));
      if (arr.length > 0 && channelsList.length === 0) {
        channelsList = arr;
      }
    } else if (typeof iot.lightRelayChannel === 'string' && iot.lightRelayChannel.includes(',')) {
      const arr = iot.lightRelayChannel.split(',').map((x) => Number(x.trim())).filter((n) => !isNaN(n));
      if (arr.length > 0 && channelsList.length === 0) {
        channelsList = arr;
      }
    }

    // Merge row1List and channelsList if both exist or either exists
    const combinedLights = Array.from(
      new Set([
        ...channelsList,
        ...row1List,
        ...(iot.lightRelayChannel && !Array.isArray(iot.lightRelayChannel) && !isNaN(Number(iot.lightRelayChannel))
          ? [Number(iot.lightRelayChannel)]
          : []),
        ...(iot.lightRelayChannel2 && !isNaN(Number(iot.lightRelayChannel2))
          ? [Number(iot.lightRelayChannel2)]
          : []),
      ])
    );

    if (combinedLights.length > 0) {
      iot.lightRelayChannels = combinedLights;
      iot.lightRelayChannel = combinedLights[0];
      if (combinedLights.length > 1) {
        iot.lightRelayChannel2 = combinedLights[1];
        iot.dualLights = true;
      }
      if (!iot.row1Lights || iot.row1Lights.length === 0) {
        iot.row1Lights = combinedLights;
      }
      if (!iot.row1) {
        iot.row1 = combinedLights;
      }
    }

    return data;
  }

  async create(data, context = {}) {
    data = this._normalizeIotMapping(data);
    const tenantId = context.tenantId || data.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required to create a resource');
    }

    // 1. Verify branch exists under tenant
    const branch = await branchRepository.findById(data.branchId, tenantId);
    if (!branch) {
      throw new NotFoundError(`Branch with ID '${data.branchId}' not found in this academy`);
    }

    // 2. Verify sports exist
    const primarySportId = data.sportId || (Array.isArray(data.sportIds) && data.sportIds[0]);
    if (!primarySportId) {
      throw new ValidationError('Sport ID or sportIds is required');
    }
    const sport = await sportRepository.findById(primarySportId);
    if (!sport) {
      throw new NotFoundError(`Sport with ID '${primarySportId}' not found in catalog`);
    }

    if (Array.isArray(data.sportIds) && data.sportIds.length > 0) {
      const sanitizedSportIds = [];
      for (const sId of data.sportIds) {
        if (!sId) continue;
        const s = await sportRepository.findById(sId);
        if (!s) {
          throw new NotFoundError(`Sport with ID '${sId}' not found in catalog`);
        }
        sanitizedSportIds.push(s._id);
      }
      data.sportIds = sanitizedSportIds;
      if (!data.sportId && sanitizedSportIds.length > 0) {
        data.sportId = sanitizedSportIds[0];
      }
      if (data.sportId && !data.sportIds.some((id) => id.toString() === data.sportId.toString())) {
        data.sportIds.unshift(data.sportId);
      }
    } else {
      data.sportIds = [data.sportId];
    }

    // 3. Verify code uniqueness within this branch
    const existingCode = await resourceRepository.findByCode(data.code, data.branchId, tenantId);
    if (existingCode) {
      throw new ConflictError(
        `Resource code '${data.code}' is already assigned in branch '${branch.name}'`
      );
    }

    // 4. Verify tenant court/resource limit
    const tenant = await tenantRepository.findById(tenantId);
    if (tenant && tenant.limits?.maxCourts) {
      const currentResourceCount = await resourceRepository.count({}, tenantId);
      if (currentResourceCount >= tenant.limits.maxCourts) {
        throw new ConflictError(
          `Academy court/resource limit reached (${tenant.limits.maxCourts}). Upgrade your plan to add more courts.`
        );
      }
    }

    const created = await super.create({ ...data, tenantId }, context);
    return await this.repository.findById(created._id, tenantId);
  }

  async getById(id, context = {}) {
    const item = await this.repository.findById(id, context.tenantId);
    if (!item) {
      throw new NotFoundError(`Resource with ID '${id}' not found`);
    }
    return item;
  }

  async list(filter = {}, pagination = {}, context = {}) {
    return await this.repository.paginate(filter, pagination, context.tenantId);
  }

  async update(id, updateData, context = {}) {
    updateData = this._normalizeIotMapping(updateData);

    if (updateData.sportIds !== undefined) {
      if (Array.isArray(updateData.sportIds)) {
        const cleanedIds = updateData.sportIds.filter((x) => x && x !== '');
        for (const sId of cleanedIds) {
          const s = await sportRepository.findById(sId);
          if (!s) {
            throw new NotFoundError(`Sport with ID '${sId}' not found in catalog`);
          }
        }
        updateData.sportIds = cleanedIds;
        if (!updateData.sportId && cleanedIds.length > 0) {
          updateData.sportId = cleanedIds[0];
        }
      } else {
        updateData.sportIds = [];
      }
    }

    if (updateData.sportId && (!updateData.sportIds || updateData.sportIds.length === 0)) {
      const s = await sportRepository.findById(updateData.sportId);
      if (!s) {
        throw new NotFoundError(`Sport with ID '${updateData.sportId}' not found in catalog`);
      }
      updateData.sportIds = [updateData.sportId];
    } else if (updateData.sportId && Array.isArray(updateData.sportIds)) {
      if (!updateData.sportIds.some((id) => id.toString() === updateData.sportId.toString())) {
        updateData.sportIds.unshift(updateData.sportId);
      }
    }

    const updated = await this.repository.updateById(id, updateData, context.tenantId);
    if (!updated) {
      throw new NotFoundError(`Resource with ID '${id}' not found`);
    }
    return updated;
  }

  async listActive(branchId, sportId, tenantId) {
    return await resourceRepository.findActiveByBranchAndSport(branchId, sportId, tenantId);
  }

  async setMaintenance(id, maintenanceData, context = {}) {
    const tenantId = context.tenantId;
    const resource = await resourceRepository.findById(id, tenantId);
    if (!resource) {
      throw new NotFoundError(`Resource with ID '${id}' not found`);
    }

    return await resourceRepository.setMaintenance(id, maintenanceData, tenantId);
  }
}

export const resourceService = new ResourceService();
