import { BaseRepository } from '../../core/BaseRepository.js';
import { Booking } from './booking.model.js';
import { BOOKING_STATUS } from '../../config/constants.js';

export class BookingRepository extends BaseRepository {
  constructor() {
    super(Booking);
  }

  async findByBookingNumber(bookingNumber, tenantId) {
    return await this.model.findOne({
      bookingNumber: bookingNumber.toUpperCase(),
      tenantId,
    });
  }

  async findByGroupId(groupId, tenantId) {
    const filter = this._scopeFilter({ groupId }, tenantId);
    return await this.model
      .find(filter)
      .populate('resourceId', 'name code type surface capacity pricing')
      .populate('branchId', 'name code timezone address')
      .populate('sportId', 'name slug type')
      .populate('userId', 'firstName lastName email phone')
      .sort({ date: 1, startTime: 1 })
      .lean();
  }

  async findByGroupBookingNumber(groupBookingNumber, tenantId) {
    const filter = this._scopeFilter({ groupBookingNumber: groupBookingNumber.toUpperCase() }, tenantId);
    return await this.model
      .find(filter)
      .populate('resourceId', 'name code type surface capacity pricing')
      .populate('branchId', 'name code timezone address')
      .populate('sportId', 'name slug type')
      .populate('userId', 'firstName lastName email phone')
      .sort({ date: 1, startTime: 1 })
      .lean();
  }

  async findActiveByResourceAndDate(resourceId, date, tenantId) {
    return await this.model
      .find({
        resourceId,
        date,
        tenantId,
        status: {
          $in: [
            BOOKING_STATUS.CONFIRMED,
            BOOKING_STATUS.CHECKED_IN,
            BOOKING_STATUS.IN_PROGRESS,
            BOOKING_STATUS.RESERVED,
          ],
        },
      })
      .select('startTime endTime status userId groupId groupBookingNumber')
      .lean();
  }

  async isSlotBooked(resourceId, date, startTime, tenantId) {
    const existing = await this.model
      .findOne({
        resourceId,
        date,
        startTime,
        tenantId,
        status: {
          $in: [
            BOOKING_STATUS.CONFIRMED,
            BOOKING_STATUS.CHECKED_IN,
            BOOKING_STATUS.IN_PROGRESS,
            BOOKING_STATUS.RESERVED,
          ],
        },
      })
      .select('_id')
      .lean();
    return !!existing;
  }

  async findByIdWithDetails(id, tenantId) {
    const filter = this._scopeFilter({ _id: id }, tenantId);
    return await this.model
      .findOne(filter)
      .populate('resourceId', 'name code type surface capacity pricing')
      .populate('branchId', 'name code timezone address')
      .populate('sportId', 'name slug type')
      .populate('userId', 'firstName lastName email phone')
      .lean();
  }

  async paginateBookings(filter = {}, pagination = {}, tenantId = null) {
    const sort = pagination.sort || { date: -1, startTime: -1 };
    return await this.paginate(
      filter,
      {
        ...pagination,
        sort,
        populate: [
          { path: 'resourceId', select: 'name code type' },
          { path: 'branchId', select: 'name code' },
          { path: 'sportId', select: 'name slug' },
          { path: 'userId', select: 'firstName lastName email phone' },
        ],
        lean: true,
      },
      tenantId
    );
  }
}

export const bookingRepository = new BookingRepository();
