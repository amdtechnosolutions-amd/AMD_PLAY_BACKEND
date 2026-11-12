import { BaseRepository } from '../../core/BaseRepository.js';
import { Device } from './device.model.js';

export class DeviceRepository extends BaseRepository {
  constructor() {
    super(Device);
  }

  async findByCode(code, branchId, tenantId) {
    return await this.model.findOne({
      code: code.toUpperCase(),
      branchId,
      tenantId,
    });
  }

  async findByApiKey(apiKey) {
    return await this.model.findOne({ apiKey }).populate('branchId', 'name code timezone');
  }

  async findDevicesByBranch(branchId, tenantId) {
    return await this.model
      .find({ branchId, tenantId })
      .populate('resourceId', 'name code')
      .populate('resourceIds', 'name code')
      .populate('sportId', 'name slug icon type')
      .populate('sportIds', 'name slug icon type')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findCourtDevice(resourceId, tenantId, preferredType = 'relay') {
    if (preferredType) {
      const preferred = await this.model.findOne({
        ...(tenantId ? { tenantId } : {}),
        type: preferredType,
        $or: [{ resourceId }, { resourceIds: resourceId }],
      }).lean();
      if (preferred) return preferred;
    }

    return await this.model.findOne({
      ...(tenantId ? { tenantId } : {}),
      $or: [{ resourceId }, { resourceIds: resourceId }],
    }).lean();
  }

  async findDevicesForSport(sportId, branchId, tenantId) {
    return await this.model.find({
      tenantId,
      ...(branchId ? { branchId } : {}),
      $or: [
        { sportId },
        { sportIds: sportId },
        { isDefaultEntrance: true },
        { accessScope: 'global' },
      ],
    }).lean();
  }

  async findDevicesForResource(resourceId, sportId, branchId, tenantId) {
    return await this.model.find({
      tenantId,
      ...(branchId ? { branchId } : {}),
      $or: [
        { resourceId },
        { resourceIds: resourceId },
        ...(sportId ? [{ sportId }, { sportIds: sportId }] : []),
        { isDefaultEntrance: true },
        { accessScope: 'global' },
      ],
    }).lean();
  }

  async paginateDevices(filter = {}, pagination = {}, tenantId = null) {
    const sort = pagination.sort || { createdAt: -1 };
    return await this.paginate(
      filter,
      {
        ...pagination,
        sort,
        populate: [
          { path: 'branchId', select: 'name code' },
          { path: 'resourceId', select: 'name code' },
          { path: 'resourceIds', select: 'name code' },
          { path: 'sportId', select: 'name slug icon type' },
          { path: 'sportIds', select: 'name slug icon type' },
        ],
        lean: true,
      },
      tenantId
    );
  }
}

export const deviceRepository = new DeviceRepository();
