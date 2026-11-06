import mongoose from 'mongoose';
import { User } from '../users/user.model.js';
import { Booking } from '../bookings/booking.model.js';
import { ROLES, BOOKING_STATUS } from '../../config/constants.js';
import { NotFoundError, ValidationError, ConflictError } from '../../errors/AppError.js';
import { HikvisionService, hikvisionService } from '../iot/hikvision.service.js';
import { Device } from '../iot/device.model.js';

export class BookingUserService {
  /**
   * Create a new Booking User
   */
  async createBookingUser(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const phone = (data.phone || '').trim();
    if (!phone) {
      throw new ValidationError('Phone number is required');
    }

    // Check if user already exists with this phone in tenant
    const existing = await User.findOne({ tenantId, phone });
    if (existing) {
      throw new ConflictError(`User with phone '${phone}' already exists in this academy`);
    }

    const email = (data.email || `customer_${Date.now()}@amdplay.local`).toLowerCase().trim();

    // Auto generate employeeNo for door/gate access
    let finalEmployeeNo = (data.employeeNo || '').trim();
    if (!finalEmployeeNo) {
      const count = await User.countDocuments({ tenantId, role: ROLES.CUSTOMER });
      finalEmployeeNo = `isabk${String(count + 1).padStart(3, '0')}`;
    }

    const pin = (data.pin || String(Math.floor(100000 + Math.random() * 900000))).trim();
    const cardNo = (data.cardNo || pin).trim();

    const user = await User.create({
      tenantId,
      branchId: data.branchId || null,
      firstName: data.firstName.trim(),
      lastName: (data.lastName || '').trim(),
      email,
      phone,
      password: 'Customer123!',
      role: ROLES.CUSTOMER,
      status: 'active',
      employeeNo: finalEmployeeNo,
      pin,
      cardNo,
      metadata: {
        notes: data.notes || '',
        userType: 'booking_customer',
      },
    });

    // Sync booking user with RFID card / PIN to access devices
    try {
      const accessDeviceTypes = ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'];
      const targetDevices = await Device.find({
        tenantId,
        $or: [
          { type: { $in: accessDeviceTypes } },
          { code: /ACCESS|BIOMETRIC|HIK/i },
          { name: /ACCESS|BIOMETRIC|FACE|TURF/i },
        ],
      });

      for (const dev of targetDevices) {
        const client = dev.ipAddress
          ? HikvisionService.forDevice({
              ip: dev.ipAddress,
              port: dev.port || (dev.code === 'DEV-ISA-ACCESS' ? 4231 : 80),
              username: dev.username || 'admin',
              password: dev.password || 'Amd@737373',
              protocol: dev.protocol || 'http',
            })
          : hikvisionService;

        try {
          await client.recordPerson({
            employeeNo: user.employeeNo,
            name: `${user.firstName} ${user.lastName || ''}`.trim(),
            role: 'customer',
            userType: 'normal',
            pin: user.pin,
            cardNo: user.cardNo,
            planTemplateNo: 1,
          });

          if (user.cardNo) {
            await client.recordCard({
              employeeNo: user.employeeNo,
              cardNo: user.cardNo,
            });
          }
        } catch (devErr) {
          console.warn(`[BookingUser Direct Sync] Device upload warning for ${dev.name}:`, devErr.message);
        }
      }
    } catch (syncErr) {
      console.warn('[BookingUser Direct Sync] Biometric sync warning:', syncErr.message);
    }

    return {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
      email: user.email,
      phone: user.phone,
      role: user.role,
      employeeNo: user.employeeNo,
      pin: user.pin,
      cardNo: user.cardNo,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  /**
   * List Booking Users with booking statistics & pagination
   */
  async listBookingUsers(filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = {
      tenantId,
      role: ROLES.CUSTOMER,
    };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.branchId) {
      query.branchId = filters.branchId;
    }

    if (filters.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { firstName: regex },
        { lastName: regex },
        { phone: regex },
        { email: regex },
        { employeeNo: regex },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query),
    ]);

    const userIds = items.map((u) => u._id);

    // Aggregate booking statistics for these users
    const bookingStats = userIds.length
      ? await Booking.aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              userId: { $in: userIds },
            },
          },
          {
            $group: {
              _id: '$userId',
              totalBookings: { $sum: 1 },
              totalSpent: { $sum: '$pricing.totalAmount' },
              lastBookingDate: { $max: '$createdAt' },
              activeBookingsCount: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        '$status',
                        [
                          BOOKING_STATUS.CONFIRMED,
                          BOOKING_STATUS.CHECKED_IN,
                          BOOKING_STATUS.IN_PROGRESS,
                          BOOKING_STATUS.RESERVED,
                        ],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ])
      : [];

    const statsMap = new Map();
    for (const stat of bookingStats) {
      statsMap.set(stat._id.toString(), stat);
    }

    const enhancedItems = items.map((user) => {
      const stat = statsMap.get(user._id.toString()) || {
        totalBookings: 0,
        totalSpent: 0,
        lastBookingDate: null,
        activeBookingsCount: 0,
      };

      return {
        ...user,
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        totalBookings: stat.totalBookings,
        totalSpent: stat.totalSpent,
        lastBookingDate: stat.lastBookingDate,
        activeBookingsCount: stat.activeBookingsCount,
      };
    });

    return {
      items: enhancedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get Booking User by ID with profile, stats, and recent bookings
   */
  async getBookingUserById(id, context = {}) {
    const tenantId = context.tenantId;

    const [user, stats, recentBookings] = await Promise.all([
      User.findOne({ _id: id, tenantId, role: ROLES.CUSTOMER }).select('-password').lean(),
      Booking.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            userId: new mongoose.Types.ObjectId(id),
          },
        },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            totalSpent: { $sum: '$pricing.totalAmount' },
            lastBookingDate: { $max: '$createdAt' },
          },
        },
      ]),
      Booking.find({ tenantId, userId: id })
        .populate('resourceId', 'name code surface')
        .populate('sportId', 'name slug')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    if (!user) {
      throw new NotFoundError(`Booking User with ID '${id}' not found`);
    }

    const bookingSummary = stats[0] || { totalBookings: 0, totalSpent: 0, lastBookingDate: null };

    return {
      ...user,
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
      totalBookings: bookingSummary.totalBookings,
      totalSpent: bookingSummary.totalSpent,
      lastBookingDate: bookingSummary.lastBookingDate,
      recentBookings,
    };
  }

  /**
   * Update Booking User profile and credentials
   */
  async updateBookingUser(id, data, context = {}) {
    const tenantId = context.tenantId;
    const user = await User.findOne({ _id: id, tenantId, role: ROLES.CUSTOMER });
    if (!user) {
      throw new NotFoundError(`Booking User with ID '${id}' not found`);
    }

    if (data.firstName !== undefined) user.firstName = data.firstName.trim();
    if (data.lastName !== undefined) user.lastName = data.lastName.trim();
    if (data.phone !== undefined) user.phone = data.phone.trim();
    if (data.email !== undefined) user.email = data.email.toLowerCase().trim();
    if (data.branchId !== undefined) user.branchId = data.branchId;
    if (data.status !== undefined) user.status = data.status;

    let credsChanged = false;
    if (data.pin !== undefined && data.pin !== user.pin) {
      user.pin = data.pin.trim();
      credsChanged = true;
    }
    if (data.cardNo !== undefined && data.cardNo !== user.cardNo) {
      user.cardNo = data.cardNo.trim();
      credsChanged = true;
    }
    if (data.notes !== undefined) {
      user.metadata = { ...(user.metadata || {}), notes: data.notes };
    }

    await user.save();

    // Re-sync to biometric devices if credentials changed
    if (credsChanged) {
      try {
        const targetDevices = await Device.find({
          tenantId,
          type: { $in: ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'] },
        });

        for (const dev of targetDevices) {
          const client = dev.ipAddress
            ? HikvisionService.forDevice({
                ip: dev.ipAddress,
                port: dev.port || 80,
                username: dev.username || 'admin',
                password: dev.password || '',
                protocol: dev.protocol || 'http',
              })
            : hikvisionService;

          await client.recordPerson({
            employeeNo: user.employeeNo,
            name: `${user.firstName} ${user.lastName || ''}`.trim(),
            role: 'customer',
            userType: 'normal',
            pin: user.pin,
            cardNo: user.cardNo,
          });

          if (user.cardNo) {
            await client.recordCard({
              employeeNo: user.employeeNo,
              cardNo: user.cardNo,
            });
          }
        }
      } catch (syncErr) {
        console.warn('[BookingUser Update] Biometric re-sync warning:', syncErr.message);
      }
    }

    return await this.getBookingUserById(id, context);
  }

  /**
   * Deactivate Booking User
   */
  async deleteBookingUser(id, context = {}) {
    const tenantId = context.tenantId;
    const user = await User.findOne({ _id: id, tenantId, role: ROLES.CUSTOMER });
    if (!user) {
      throw new NotFoundError(`Booking User with ID '${id}' not found`);
    }

    user.status = 'inactive';
    await user.save();

    return {
      success: true,
      message: `Booking User '${user.firstName} ${user.lastName || ''}' deactivated successfully`,
    };
  }

  /**
   * Get all bookings for a specific user
   */
  async getUserBookings(id, filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = {
      tenantId,
      userId: id,
    };

    if (filters.status) {
      query.status = filters.status;
    }

    const [items, total] = await Promise.all([
      Booking.find(query)
        .populate('resourceId', 'name code surface')
        .populate('sportId', 'name slug')
        .populate('branchId', 'name code')
        .sort({ date: -1, startTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(query),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const bookingUserService = new BookingUserService();
