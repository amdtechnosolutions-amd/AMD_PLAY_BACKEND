import mongoose from 'mongoose';
import { EventRegistration } from '../events/event-registration.model.js';
import { Event } from '../events/event.model.js';
import { User } from '../users/user.model.js';
import { ROLES } from '../../config/constants.js';
import { NotFoundError, ValidationError, ConflictError } from '../../errors/AppError.js';
import { HikvisionService, hikvisionService } from '../iot/hikvision.service.js';
import { Device } from '../iot/device.model.js';

export class TournamentUserService {
  /**
   * Register a new Tournament User / Participant
   */
  async createTournamentUser(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const { eventId, fullName, phone, gender, dateOfBirth } = data;
    if (!eventId) {
      throw new ValidationError('Tournament / Event ID is required');
    }

    const event = await Event.findOne({ _id: eventId, tenantId });
    if (!event) {
      throw new NotFoundError(`Tournament / Event with ID '${eventId}' not found`);
    }

    // Check duplicate registration for the same event and phone
    const existing = await EventRegistration.findOne({
      tenantId,
      eventId,
      phone: phone.trim(),
      category: data.category || 'Open Tournament',
    });

    if (existing) {
      throw new ConflictError(
        `Participant with phone '${phone}' is already registered for this tournament under category '${existing.category}'`
      );
    }

    // Find or create User profile for tournament player
    let user = await User.findOne({ tenantId, phone: phone.trim() });
    const pin = (data.pin || String(Math.floor(100000 + Math.random() * 900000))).trim();
    const cardNo = (data.cardNo || pin).trim();

    if (!user) {
      const count = await User.countDocuments({ tenantId, 'metadata.userType': 'tournament_player' });
      const employeeNo = `isatour${String(count + 1).padStart(3, '0')}`;
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || fullName.trim();
      const lastName = nameParts.slice(1).join(' ') || '';
      const email = (data.email || `tour_${Date.now()}@amdplay.local`).toLowerCase().trim();

      user = await User.create({
        tenantId,
        branchId: event.branchId,
        firstName,
        lastName,
        phone: phone.trim(),
        email,
        password: 'Tournament123!',
        role: ROLES.CUSTOMER,
        status: 'active',
        employeeNo,
        pin,
        cardNo,
        metadata: {
          userType: 'tournament_player',
          academyName: data.academyName || '',
        },
      });
    }

    // Calculate age if dateOfBirth provided
    let age = data.age;
    if (!age && dateOfBirth) {
      const birthYear = new Date(dateOfBirth).getFullYear();
      age = new Date().getFullYear() - birthYear;
    }

    // Create Event Registration
    const registration = await EventRegistration.create({
      tenantId,
      branchId: event.branchId,
      eventId,
      userId: user._id,
      fullName: fullName.trim(),
      gender,
      dateOfBirth: new Date(dateOfBirth),
      age: age || 0,
      phone: phone.trim(),
      email: data.email ? data.email.trim() : user.email,
      address: data.address || '',
      pincode: data.pincode || '',
      parentName: data.parentName || '',
      coachName: data.coachName || '',
      academyName: data.academyName || '',
      category: data.category || event.category || 'Open Tournament',
      paymentStatus: data.paymentStatus || 'paid',
      paymentMethod: data.paymentMethod || 'cash',
      transactionId: data.transactionId || '',
      amount: data.amount !== undefined ? data.amount : event.registrationAmount || 0,
      seedNumber: data.seedNumber || null,
      profilePhoto: data.profilePhoto || null,
    });

    // Increment event participants count
    await Event.findByIdAndUpdate(eventId, { $inc: { enrolledCount: 1 } });

    // Sync credentials to biometric access control devices
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
          name: fullName.trim(),
          role: 'customer',
          userType: 'normal',
          pin: user.pin,
        });

        if (user.cardNo) {
          await client.recordCard({
            employeeNo: user.employeeNo,
            cardNo: user.cardNo,
          });
        }
      }
    } catch (syncErr) {
      console.warn('[Tournament User Create] Biometric sync warning:', syncErr.message);
    }

    return {
      registration,
      tournament: {
        _id: event._id,
        name: event.name,
        category: event.category,
        startDate: event.startDate,
        endDate: event.endDate,
      },
      playerAccess: {
        userId: user._id,
        employeeNo: user.employeeNo,
        pin: user.pin,
        cardNo: user.cardNo,
      },
    };
  }

  /**
   * List Tournament Users / Participants with filters and search
   */
  async listTournamentUsers(filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = { tenantId };

    if (filters.eventId) {
      query.eventId = filters.eventId;
    }

    if (filters.branchId) {
      query.branchId = filters.branchId;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.paymentStatus) {
      query.paymentStatus = filters.paymentStatus;
    }

    if (filters.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { fullName: regex },
        { phone: regex },
        { email: regex },
        { academyName: regex },
        { coachName: regex },
      ];
    }

    const [items, total] = await Promise.all([
      EventRegistration.find(query)
        .populate('eventId', 'name category startDate endDate registrationAmount')
        .populate('userId', 'employeeNo pin cardNo status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EventRegistration.countDocuments(query),
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

  /**
   * Get Tournament User / Participant by ID
   */
  async getTournamentUserById(id, context = {}) {
    const tenantId = context.tenantId;
    const registration = await EventRegistration.findOne({ _id: id, tenantId })
      .populate('eventId')
      .populate('userId', 'employeeNo pin cardNo status')
      .lean();

    if (!registration) {
      throw new NotFoundError(`Tournament Participant registration with ID '${id}' not found`);
    }

    // Find other tournaments this player has participated in
    const otherTournaments = await EventRegistration.find({
      tenantId,
      phone: registration.phone,
      _id: { $ne: id },
    })
      .populate('eventId', 'name category startDate endDate')
      .lean();

    return {
      ...registration,
      tournamentHistory: otherTournaments,
    };
  }

  /**
   * Update Tournament User registration
   */
  async updateTournamentUser(id, data, context = {}) {
    const tenantId = context.tenantId;
    const registration = await EventRegistration.findOne({ _id: id, tenantId });
    if (!registration) {
      throw new NotFoundError(`Tournament Participant registration with ID '${id}' not found`);
    }

    if (data.fullName !== undefined) registration.fullName = data.fullName.trim();
    if (data.phone !== undefined) registration.phone = data.phone.trim();
    if (data.email !== undefined) registration.email = data.email.toLowerCase().trim();
    if (data.category !== undefined) registration.category = data.category.trim();
    if (data.seedNumber !== undefined) registration.seedNumber = data.seedNumber;
    if (data.academyName !== undefined) registration.academyName = data.academyName.trim();
    if (data.coachName !== undefined) registration.coachName = data.coachName.trim();
    if (data.parentName !== undefined) registration.parentName = data.parentName.trim();
    if (data.paymentStatus !== undefined) registration.paymentStatus = data.paymentStatus;
    if (data.paymentMethod !== undefined) registration.paymentMethod = data.paymentMethod;
    if (data.amount !== undefined) registration.amount = data.amount;
    if (data.profilePhoto !== undefined) registration.profilePhoto = data.profilePhoto;

    await registration.save();
    return await this.getTournamentUserById(id, context);
  }

  /**
   * Delete / Cancel Tournament Participant registration
   */
  async deleteTournamentUser(id, context = {}) {
    const tenantId = context.tenantId;
    const registration = await EventRegistration.findOne({ _id: id, tenantId });
    if (!registration) {
      throw new NotFoundError(`Tournament Participant registration with ID '${id}' not found`);
    }

    const eventId = registration.eventId;
    await EventRegistration.deleteOne({ _id: id });

    // Decrement event enrolled count
    if (eventId) {
      await Event.findByIdAndUpdate(eventId, { $inc: { enrolledCount: -1 } });
    }

    return {
      success: true,
      message: `Tournament Participant registration for '${registration.fullName}' cancelled successfully`,
    };
  }

  /**
   * Get all tournament registrations for a specific participant
   */
  async getParticipantTournaments(id, context = {}) {
    const tenantId = context.tenantId;
    const registration = await EventRegistration.findOne({ _id: id, tenantId });
    if (!registration) {
      throw new NotFoundError(`Tournament Participant registration with ID '${id}' not found`);
    }

    return await EventRegistration.find({ tenantId, phone: registration.phone })
      .populate('eventId')
      .sort({ createdAt: -1 })
      .lean();
  }
}

export const tournamentUserService = new TournamentUserService();
