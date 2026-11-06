import { BaseRepository } from '../../core/BaseRepository.js';
import { Resource } from './resource.model.js';

export class ResourceRepository extends BaseRepository {
  constructor() {
    super(Resource);
  }

  async findById(id, tenantId = null) {
    const filter = this._scopeFilter({ _id: id }, tenantId);
    return await this.model
      .findOne(filter)
      .populate('sportId', 'name slug type icon')
      .populate('sportIds', 'name slug type icon')
      .populate('branchId', 'name code timezone')
      .populate('iotMapping.deviceId', 'name code type status relayChannels ipAddress')
      .lean();
  }

  async updateById(id, updateData, tenantId = null) {
    const filter = this._scopeFilter({ _id: id }, tenantId);
    return await this.model
      .findOneAndUpdate(filter, updateData, {
        new: true,
        runValidators: true,
      })
      .populate('sportId', 'name slug type icon')
      .populate('sportIds', 'name slug type icon')
      .populate('branchId', 'name code timezone')
      .populate('iotMapping.deviceId', 'name code type status relayChannels ipAddress');
  }

  async paginate(filter = {}, pagination = {}, tenantId = null) {
    const queryFilter = { ...filter };
    if (queryFilter.sportId) {
      const sId = queryFilter.sportId;
      delete queryFilter.sportId;
      queryFilter.$or = [{ sportId: sId }, { sportIds: sId }];
    }
    return await super.paginate(
      queryFilter,
      {
        ...pagination,
        populate: [
          { path: 'sportId', select: 'name slug type icon' },
          { path: 'sportIds', select: 'name slug type icon' },
          { path: 'branchId', select: 'name code timezone' },
          { path: 'iotMapping.deviceId', select: 'name code type status relayChannels ipAddress' },
        ],
      },
      tenantId
    );
  }

  async findByCode(code, branchId, tenantId) {
    return await this.model.findOne({
      code: code.toUpperCase(),
      branchId,
      tenantId,
    }).lean();
  }

  async findActiveByBranchAndSport(branchId, sportId, tenantId) {
    const filter = {
      status: 'active',
      ...(tenantId ? { tenantId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(sportId
        ? {
            $or: [
              { sportId },
              { sportIds: sportId },
            ],
          }
        : {}),
    };

    return await this.model
      .find(filter)
      .populate('sportId', 'name slug type icon')
      .populate('sportIds', 'name slug type icon')
      .populate('branchId', 'name code timezone')
      .populate('iotMapping.deviceId', 'name code type status relayChannels ipAddress')
      .sort({ name: 1 })
      .lean();
  }

  async setMaintenance(id, maintenanceData, tenantId) {
    const status = maintenanceData.isUnderMaintenance ? 'maintenance' : 'active';
    return await this.model.findOneAndUpdate(
      { _id: id, tenantId },
      {
        $set: {
          maintenance: maintenanceData,
          status,
        },
      },
      { new: true }
    );
  }
}

export const resourceRepository = new ResourceRepository();
