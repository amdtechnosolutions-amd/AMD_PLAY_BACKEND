import mongoose from 'mongoose';
import { Booking } from '../bookings/booking.model.js';
import { Payment } from '../finance/payment.model.js';
import { MonthlyFee } from '../finance/monthly-fee.model.js';
import { Expense } from '../finance/expense.model.js';
import { Resource } from '../resources/resource.model.js';
import { MemberSubscription } from '../memberships/memberSubscription.model.js';
import { Enrollment } from '../coaching/enrollment.model.js';
import { Attendance } from '../coaching/attendance.model.js';
import { BOOKING_STATUS } from '../../config/constants.js';
import { ValidationError } from '../../errors/AppError.js';

/**
 * High-speed in-memory TTL cache for analytics queries.
 * Prevents redundant database aggregations on dashboard reloads / multi-widget views.
 */
class FastAnalyticsCache {
  constructor(defaultTtlMs = 15000) {
    this.cache = new Map();
    this.defaultTtlMs = defaultTtlMs;
  }

  getKey(scope, filters = {}, context = {}) {
    const tenantId = context.tenantId || filters.tenantId || 'global';
    const branchId = filters.branchId || context.branchId || 'all';
    const sDate = filters.startDate || filters.date || '';
    const eDate = filters.endDate || filters.date || '';
    const range = filters.range || '';
    return `${scope}:${tenantId}:${branchId}:${sDate}:${eDate}:${range}`;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs) {
    // Purge expired keys if cache grows large
    if (this.cache.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (now > v.expiresAt) this.cache.delete(k);
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs || this.defaultTtlMs),
    });
  }

  clear() {
    this.cache.clear();
  }
}

export class AnalyticsService {
  constructor() {
    this._cache = new FastAnalyticsCache(15000);
  }

  /**
   * Clear cache on demand (e.g., when new transactions or bookings are recorded)
   */
  invalidateCache() {
    this._cache.clear();
  }

  /**
   * Normalize and resolve date filter parameters (branchId, date, startDate, endDate)
   */
  _resolveDateFilters(filters = {}) {
    const { branchId, range } = filters;
    let date = filters.date;
    let sDate = filters.startDate;
    let eDate = filters.endDate;

    // Handle explicit "all" / "overall" requests (returns all-time data)
    if (
      range === 'all' ||
      range === 'overall' ||
      date === 'all' ||
      date === 'overall' ||
      sDate === 'all' ||
      sDate === 'overall'
    ) {
      return { branchId, startDate: null, endDate: null, stringDateFilter: null, timestampFilter: null };
    }

    // Handle range shortcuts if provided (e.g. range=today)
    if (range === 'today' && !date && !sDate) {
      const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
      date = todayStr;
    }

    const startDate = (sDate && sDate !== 'all' && sDate !== 'overall')
      ? sDate
      : (date && date !== 'all' && date !== 'overall' ? date : null);
    const endDate = (eDate && eDate !== 'all' && eDate !== 'overall')
      ? eDate
      : (date && date !== 'all' && date !== 'overall' ? date : null);

    let stringDateFilter = null;
    if (startDate && endDate) {
      if (startDate === endDate) {
        stringDateFilter = startDate;
      } else {
        stringDateFilter = { $gte: startDate, $lte: endDate };
      }
    } else if (startDate) {
      stringDateFilter = { $gte: startDate };
    } else if (endDate) {
      stringDateFilter = { $lte: endDate };
    }

    let timestampFilter = null;
    if (startDate || endDate) {
      timestampFilter = {};
      if (startDate) {
        const istStart = new Date(`${startDate}T00:00:00.000+05:30`);
        const utcStart = new Date(`${startDate}T00:00:00.000Z`);
        timestampFilter.$gte = istStart < utcStart ? istStart : utcStart;
      }
      if (endDate) {
        const istEnd = new Date(`${endDate}T23:59:59.999+05:30`);
        const utcEnd = new Date(`${endDate}T23:59:59.999Z`);
        timestampFilter.$lte = istEnd > utcEnd ? istEnd : utcEnd;
      }
    }

    return { branchId, startDate, endDate, stringDateFilter, timestampFilter };
  }

  /**
   * Executive Dashboard KPIs summary with parallelized queries and sub-millisecond caching
   */
  async getDashboardSummary(filters = {}, context = {}) {
    const cacheKey = this._cache.getKey('dashboard', filters, context);
    const cached = this._cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tenantId = context.tenantId || filters.tenantId || null;

    const { branchId, startDate, endDate, stringDateFilter, timestampFilter } =
      this._resolveDateFilters(filters);

    const branchFilter = {};
    if (branchId) {
      branchFilter.branchId = new mongoose.Types.ObjectId(branchId);
    }

    const tenantObjectId = tenantId ? new mongoose.Types.ObjectId(tenantId) : null;
    const tenantMatch = tenantObjectId ? { tenantId: tenantObjectId } : {};

    // 1. Total Successful Revenue (Filtered by date range when provided)
    const revenueMatch = {
      status: 'success',
      ...tenantMatch,
      ...branchFilter,
    };
    if (timestampFilter) {
      revenueMatch.createdAt = timestampFilter;
    }

    // Safeguard: Add legacy paid MonthlyFees that don't have a linked payment record
    const feeMatch = {
      status: 'paid',
      paymentId: null,
      ...tenantMatch,
      ...branchFilter,
    };
    if (timestampFilter) {
      feeMatch.$or = [
        { paidAt: timestampFilter },
        { createdAt: timestampFilter },
      ];
    }

    // 2. Total Confirmed/Checked-in Bookings
    const bookingMatch = {
      status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN] },
      ...tenantMatch,
      ...branchFilter,
    };
    if (stringDateFilter) {
      bookingMatch.date = stringDateFilter;
    }

    // 3. Active Courts / Resources
    const courtMatch = {
      status: 'active',
      ...tenantMatch,
      ...branchFilter,
    };

    // 4. Active Members with valid subscriptions
    const memberMatch = {
      status: 'active',
      ...tenantMatch,
    };

    // 5. Enrolled Students in Coaching Batches
    const enrollmentMatch = {
      status: 'active',
      ...tenantMatch,
    };

    // 6. Pending Expenses
    const expenseMatch = {
      status: 'pending',
      ...tenantMatch,
      ...branchFilter,
    };
    if (stringDateFilter) {
      expenseMatch.date = stringDateFilter;
    }

    // Execute ALL database operations concurrently in parallel via Promise.all
    const [
      revenueAgg,
      feeAgg,
      totalBookings,
      activeCourts,
      activeMembers,
      enrolledStudents,
      expenseAgg,
    ] = await Promise.all([
      Payment.aggregate([
        { $match: revenueMatch },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      MonthlyFee.aggregate([
        { $match: feeMatch },
        { $group: { _id: null, total: { $sum: '$paidAmount' } } },
      ]),
      Booking.countDocuments(bookingMatch),
      Resource.countDocuments(courtMatch),
      MemberSubscription.countDocuments(memberMatch),
      Enrollment.countDocuments(enrollmentMatch),
      Expense.aggregate([
        { $match: expenseMatch },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    let totalRevenue = (revenueAgg[0]?.total || 0) + (feeAgg[0]?.total || 0);
    const pendingExpensesCount = expenseAgg[0]?.count || 0;
    const pendingExpensesAmount = expenseAgg[0]?.total || 0;

    const result = {
      currency: 'INR',
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      kpis: {
        totalRevenue,
        totalBookings,
        activeCourts,
        activeMembers,
        enrolledStudents,
        pendingExpenses: {
          count: pendingExpensesCount,
          amount: pendingExpensesAmount,
        },
      },
    };

    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * Court / Ground Utilization and Peak Hours Analysis with parallel queries & lean projection
   */
  async getCourtUtilization(filters = {}, context = {}) {
    const cacheKey = this._cache.getKey('court_utilization', filters, context);
    const cached = this._cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tenantId = context.tenantId || filters.tenantId || null;
    const { branchId, stringDateFilter } = this._resolveDateFilters(filters);

    const courtFilter = { status: 'active' };
    if (tenantId) courtFilter.tenantId = tenantId;
    if (branchId) courtFilter.branchId = branchId;

    const bookingFilter = {
      status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN] },
    };
    if (tenantId) bookingFilter.tenantId = tenantId;
    if (branchId) bookingFilter.branchId = branchId;
    if (stringDateFilter) bookingFilter.date = stringDateFilter;

    // Run both queries in parallel with lean projection for minimum memory overhead
    const [courts, bookings] = await Promise.all([
      Resource.find(courtFilter).lean().select('_id name code surface').exec(),
      Booking.find(bookingFilter).lean().select('resourceId startTime').exec(),
    ]);

    if (courts.length === 0) {
      const emptyResult = {
        overallUtilizationRate: 0,
        totalBookedHours: 0,
        totalAvailableHours: 0,
        peakHour: 'None',
        courtBreakdown: [],
      };
      this._cache.set(cacheKey, emptyResult);
      return emptyResult;
    }

    // Group bookings per court
    const courtBookingsMap = new Map();
    const hourFrequency = {};

    for (const b of bookings) {
      const cId = b.resourceId ? b.resourceId.toString() : '';
      if (cId) {
        courtBookingsMap.set(cId, (courtBookingsMap.get(cId) || 0) + 1);
      }

      const hour = b.startTime || '00:00';
      hourFrequency[hour] = (hourFrequency[hour] || 0) + 1;
    }

    // Determine Peak Hour
    let peakHour = '18:00';
    let maxHourCount = 0;
    for (const [hour, count] of Object.entries(hourFrequency)) {
      if (count > maxHourCount) {
        maxHourCount = count;
        peakHour = hour;
      }
    }

    // Standard daily operating capacity per court: 14 hours (08:00 to 22:00)
    const operationalHoursPerCourt = 14;
    const totalAvailableHours = courts.length * operationalHoursPerCourt;
    let totalBookedHours = 0;

    const courtBreakdown = courts.map((court) => {
      const bookedSlots = courtBookingsMap.get(court._id.toString()) || 0;
      const bookedHours = bookedSlots * 1; // 1 hour per slot
      totalBookedHours += bookedHours;
      const courtUtilization = Number(((bookedHours / operationalHoursPerCourt) * 100).toFixed(2));

      return {
        courtId: court._id,
        name: court.name,
        code: court.code,
        surface: court.surface,
        bookedSlots,
        bookedHours,
        utilizationPercentage: Math.min(100, courtUtilization),
      };
    });

    const overallRate =
      totalAvailableHours > 0
        ? Number(((totalBookedHours / totalAvailableHours) * 100).toFixed(2))
        : 0;

    const result = {
      overallUtilizationRate: Math.min(100, overallRate),
      totalBookedHours,
      totalAvailableHours,
      peakHour: maxHourCount > 0 ? peakHour : 'None',
      courtBreakdown,
    };

    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * Revenue Trends & Categorized Breakdown with parallel queries and lean projection
   */
  async getRevenueAnalytics(filters = {}, context = {}) {
    const cacheKey = this._cache.getKey('revenue', filters, context);
    const cached = this._cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tenantId = context.tenantId || filters.tenantId || null;
    const { branchId, timestampFilter } = this._resolveDateFilters(filters);

    const filter = { status: 'success' };
    if (tenantId) filter.tenantId = tenantId;
    if (branchId) filter.branchId = branchId;
    if (timestampFilter) filter.createdAt = timestampFilter;

    // Safeguard: Fetch unlinked paid MonthlyFees
    const feeFilter = {
      status: 'paid',
      paymentId: null,
    };
    if (tenantId) feeFilter.tenantId = tenantId;
    if (branchId) feeFilter.branchId = branchId;
    if (timestampFilter) {
      feeFilter.$or = [
        { paidAt: timestampFilter },
        { createdAt: timestampFilter },
      ];
    }

    // Execute queries in parallel with lean projection
    const [payments, unlinkedFees] = await Promise.all([
      Payment.find(filter).lean().select('amount type paymentMethod').exec(),
      MonthlyFee.find(feeFilter).lean().select('paidAmount finalAmount').exec(),
    ]);

    let totalRevenue = 0;
    const revenueByType = {
      booking: 0,
      membership: 0,
      coaching: 0,
      other: 0,
    };
    const revenueByPaymentMethod = {};

    for (const p of payments) {
      const amount = p.amount || 0;
      totalRevenue += amount;

      const type = p.type || 'other';
      revenueByType[type] = (revenueByType[type] || 0) + amount;

      const method = p.paymentMethod || 'other';
      revenueByPaymentMethod[method] = (revenueByPaymentMethod[method] || 0) + amount;
    }

    for (const f of unlinkedFees) {
      const amount = f.paidAmount || f.finalAmount || 0;
      totalRevenue += amount;
      revenueByType.coaching = (revenueByType.coaching || 0) + amount;
      revenueByPaymentMethod.cash = (revenueByPaymentMethod.cash || 0) + amount;
    }

    const result = {
      currency: 'INR',
      totalRevenue,
      paymentCount: payments.length + unlinkedFees.length,
      revenueByType,
      revenueByPaymentMethod,
    };

    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * Coaching Attendance Metrics & Session Completion Rates with lean projection
   */
  async getAttendanceMetrics(filters = {}, context = {}) {
    const cacheKey = this._cache.getKey('attendance', filters, context);
    const cached = this._cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tenantId = context.tenantId || filters.tenantId || null;
    const { stringDateFilter } = this._resolveDateFilters(filters);

    const filter = {};
    if (tenantId) filter.tenantId = tenantId;
    if (stringDateFilter) filter.date = stringDateFilter;

    const attendanceDocs = await Attendance.find(filter).lean().select('records.status').exec();

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalExcused = 0;

    for (const doc of attendanceDocs) {
      for (const record of doc.records || []) {
        if (record.status === 'present') totalPresent++;
        else if (record.status === 'absent') totalAbsent++;
        else if (record.status === 'excused') totalExcused++;
      }
    }

    const totalMarks = totalPresent + totalAbsent + totalExcused;
    const attendanceRate =
      totalPresent + totalAbsent > 0
        ? Number(((totalPresent / (totalPresent + totalAbsent)) * 100).toFixed(2))
        : 0;

    const result = {
      totalSessions: attendanceDocs.length,
      totalAttendanceMarks: totalMarks,
      presentCount: totalPresent,
      absentCount: totalAbsent,
      excusedCount: totalExcused,
      overallAttendanceRate: attendanceRate,
    };

    this._cache.set(cacheKey, result);
    return result;
  }
}

export const analyticsService = new AnalyticsService();
