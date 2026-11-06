import crypto from 'node:crypto';
import { MonthlyFee } from './monthly-fee.model.js';
import { Payment } from './payment.model.js';
import { Enrollment } from '../coaching/enrollment.model.js';
import { Batch } from '../coaching/batch.model.js';
import { MemberSubscription } from '../memberships/memberSubscription.model.js';
import { MembershipPlan } from '../memberships/membershipPlan.model.js';
import { Branch } from '../branches/branch.model.js';
import { wabridgeService } from '../notifications/wabridge.service.js';
import { settingsService } from '../settings/settings.service.js';
import { env } from '../../config/env.js';
import { NotFoundError, ValidationError } from '../../errors/AppError.js';

export class MonthlyFeeGeneratorService {
  /**
   * Option A: Pro-Rata Fee Calculation
   * - If join date is on or before the 20th: Full month fee applies.
   * - If join date is after the 20th (21st - end of month): Exact daily pro-rata for remaining days of the month.
   */
  calculateOptionAFee(baseMonthlyFee, rawJoinDate = new Date()) {
    const joinDate = new Date(rawJoinDate);
    const day = joinDate.getDate();
    const month = joinDate.getMonth() + 1;
    const year = joinDate.getFullYear();
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    if (day > 20) {
      const remainingDays = totalDaysInMonth - day + 1;
      const dailyRate = Number((baseMonthlyFee / totalDaysInMonth).toFixed(2));
      const proratedAmount = Math.max(0, Math.round(dailyRate * remainingDays));

      return {
        isProrated: true,
        joinDay: day,
        totalDaysInMonth,
        remainingDays,
        dailyRate,
        baseFee: baseMonthlyFee,
        finalAmount: proratedAmount,
        month,
        year,
        periodStart: joinDate,
        periodEnd: new Date(year, month - 1, totalDaysInMonth, 23, 59, 59),
      };
    }

    return {
      isProrated: false,
      joinDay: day,
      totalDaysInMonth,
      remainingDays: totalDaysInMonth,
      dailyRate: Number((baseMonthlyFee / totalDaysInMonth).toFixed(2)),
      baseFee: baseMonthlyFee,
      finalAmount: baseMonthlyFee,
      month,
      year,
      periodStart: new Date(year, month - 1, 1),
      periodEnd: new Date(year, month - 1, totalDaysInMonth, 23, 59, 59),
    };
  }

  /**
   * Create an initial fee invoice for a newly joined Student or Member
   * Automatically applies Option A pro-ration if joined after the 20th.
   */
  async createJoinerFee({
    tenantId,
    branchId,
    userId,
    feeType = 'coaching_student',
    studentId = null,
    batchId = null,
    sportId = null,
    subscriptionId = null,
    planId = null,
    baseFee = 2000,
    discount = 0,
    joinDate = new Date(),
    status = 'pending',
    paymentMethod = null,
    notes = '',
  }) {
    if (!tenantId || !userId) {
      throw new ValidationError('tenantId and userId are required to create joiner fee');
    }

    const proration = this.calculateOptionAFee(baseFee, joinDate);
    const finalAmount = Math.max(0, proration.finalAmount - discount);

    // Due date: 3 days after join date or end of month
    const dueDate = new Date(joinDate);
    dueDate.setDate(dueDate.getDate() + 3);

    // Check if an invoice already exists for this user in this month/year
    const query = {
      tenantId,
      userId,
      feeType,
      month: proration.month,
      year: proration.year,
    };
    if (batchId) query.batchId = batchId;
    if (subscriptionId) query.subscriptionId = subscriptionId;

    let invoice = await MonthlyFee.findOne(query);
    if (invoice) {
      return invoice;
    }

    invoice = await MonthlyFee.create({
      tenantId,
      branchId,
      feeType,
      userId,
      studentId: studentId || (feeType === 'coaching_student' ? userId : null),
      batchId,
      sportId,
      subscriptionId,
      planId,
      month: proration.month,
      year: proration.year,
      isProrated: proration.isProrated,
      proratedDays: proration.remainingDays,
      dailyRate: proration.dailyRate,
      joinDate: new Date(joinDate),
      billingPeriodStart: proration.periodStart,
      billingPeriodEnd: proration.periodEnd,
      baseFee,
      discountAmount: discount,
      finalAmount,
      dueDate,
      status: finalAmount === 0 ? 'waived' : status,
      paidAmount: status === 'paid' ? finalAmount : 0,
      paidAt: status === 'paid' ? new Date() : null,
      notes: notes || (proration.isProrated
        ? `Option A Joiner Pro-Rata: ${proration.remainingDays} days active in Month ${proration.month}/${proration.year}`
        : `Initial Onboarding Fee for Month ${proration.month}/${proration.year}`),
    });

    return invoice;
  }

  /**
   * Auto-generate recurring monthly fee dues for all active students and members under a tenant
   * Target options: 'all' | 'students' | 'members'
   */
  async generateFeesForMonth({ tenantId, month = null, year = null, target = 'all', dueDay = 5 }) {
    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();

    // Due date of the month (default 5th)
    const dueDate = new Date(targetYear, targetMonth - 1, Math.min(dueDay || 5, 28));

    let studentsGenerated = 0;
    let studentsSkipped = 0;
    let studentsTotalAmount = 0;

    let membersGenerated = 0;
    let membersSkipped = 0;
    let membersTotalAmount = 0;

    const generatedInvoices = [];

    // ==========================================
    // 1. Process Active Coaching Students
    // ==========================================
    if (target === 'all' || target === 'students') {
      const enrollments = await Enrollment.find({
        tenantId,
        status: 'active',
      }).populate('studentId batchId');

      for (const enr of enrollments) {
        if (!enr.studentId || !enr.batchId) {
          studentsSkipped++;
          continue;
        }

        const batch = enr.batchId;
        const student = enr.studentId;

        const baseFee = enr.monthlyFee || batch.monthlyFee || 2000;
        const discount = enr.customDiscount || 0;
        const finalAmount = Math.max(0, baseFee - discount);

        try {
          const existing = await MonthlyFee.findOne({
            tenantId,
            studentId: student._id,
            batchId: batch._id,
            month: targetMonth,
            year: targetYear,
          });

          if (existing) {
            studentsSkipped++;
            continue;
          }

          const feeDoc = await MonthlyFee.create({
            tenantId,
            branchId: batch.branchId || student.branchId,
            feeType: 'coaching_student',
            userId: student._id,
            studentId: student._id,
            batchId: batch._id,
            sportId: batch.sportId,
            month: targetMonth,
            year: targetYear,
            baseFee,
            discountAmount: discount,
            finalAmount,
            dueDate,
            status: finalAmount === 0 ? 'waived' : 'pending',
            notes: `Monthly Coaching Fee - ${batch.name || 'Batch'}`,
          });

          studentsGenerated++;
          studentsTotalAmount += finalAmount;
          generatedInvoices.push(feeDoc);

          // WhatsApp reminder dispatch if enabled
          if (student.phone && finalAmount > 0) {
            this.sendFeeReminder(tenantId, student, feeDoc, { batchName: batch.name, sportName: 'Coaching' }).catch(() => {});
          }
        } catch (err) {
          studentsSkipped++;
        }
      }
    }

    // ==========================================
    // 2. Process Active Court Members
    // ==========================================
    if (target === 'all' || target === 'members') {
      const activeSubscriptions = await MemberSubscription.find({
        tenantId,
        status: 'active',
      }).populate('userId planId');

      for (const sub of activeSubscriptions) {
        if (!sub.userId || !sub.planId) {
          membersSkipped++;
          continue;
        }

        const member = sub.userId;
        const plan = sub.planId;

        // Base fee: monthly plan price
        const baseFee = plan.price || sub.pricePaid || 3000;
        const finalAmount = baseFee;

        try {
          const existing = await MonthlyFee.findOne({
            tenantId,
            userId: member._id,
            subscriptionId: sub._id,
            month: targetMonth,
            year: targetYear,
          });

          if (existing) {
            membersSkipped++;
            continue;
          }

          const feeDoc = await MonthlyFee.create({
            tenantId,
            branchId: sub.branchId || member.branchId,
            feeType: 'court_member',
            userId: member._id,
            subscriptionId: sub._id,
            planId: plan._id,
            sportId: sub.sportId || plan.sportId,
            month: targetMonth,
            year: targetYear,
            baseFee,
            discountAmount: 0,
            finalAmount,
            dueDate,
            status: finalAmount === 0 ? 'waived' : 'pending',
            notes: `Monthly Membership Renewal - ${plan.name || 'Court Plan'}`,
          });

          membersGenerated++;
          membersTotalAmount += finalAmount;
          generatedInvoices.push(feeDoc);

          // WhatsApp reminder dispatch if enabled
          if (member.phone && finalAmount > 0) {
            this.sendFeeReminder(tenantId, member, feeDoc, { planName: plan.name, sportName: 'Membership' }).catch(() => {});
          }
        } catch (err) {
          membersSkipped++;
        }
      }
    }

    return {
      success: true,
      month: targetMonth,
      year: targetYear,
      target,
      students: {
        generated: studentsGenerated,
        skipped: studentsSkipped,
        totalAmount: studentsTotalAmount,
      },
      members: {
        generated: membersGenerated,
        skipped: membersSkipped,
        totalAmount: membersTotalAmount,
      },
      totalGeneratedInvoices: studentsGenerated + membersGenerated,
      totalReceivableAmount: studentsTotalAmount + membersTotalAmount,
      invoices: generatedInvoices,
    };
  }

  async sendFeeReminder(tenantId, user, feeDoc, details = {}) {
    const tenantSettings = await settingsService.getSettings(tenantId);
    if (!tenantSettings?.whatsapp?.enabled) return;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const monthName = monthNames[feeDoc.month - 1];
    const serviceName = details.batchName || details.planName || 'Sports Academy Services';
    const feeTypeName = feeDoc.feeType === 'court_member' ? 'Court Membership Fee' : 'Coaching Batch Fee';

    const message =
      `🥋 *Fee Due Notice - ${monthName} ${feeDoc.year}*\n\n` +
      `Dear ${user.firstName},\n` +
      `Your ${feeTypeName} for *${serviceName}* is due for payment.\n\n` +
      `💵 *Amount Due:* ₹${feeDoc.finalAmount}` +
      (feeDoc.isProrated ? ` _(Option A Pro-rated: ${feeDoc.proratedDays} days)_\n` : `\n`) +
      `📅 *Due Date:* ${feeDoc.dueDate.toISOString().slice(0, 10)}\n\n` +
      `Please complete the payment on the academy mobile app or at the academy reception.`;

    await wabridgeService.sendTextMessage({
      destinationNumber: user.phone,
      message,
      credentials: {
        appKey: tenantSettings.whatsapp.appKey,
        authKey: tenantSettings.whatsapp.authKey,
        deviceId: tenantSettings.whatsapp.deviceId,
      },
    });
  }

  async listMonthlyFees(filter = {}, pagination = {}, context = {}) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = { tenantId: context.tenantId };
    if (filter.month) query.month = parseInt(filter.month, 10);
    if (filter.year) query.year = parseInt(filter.year, 10);
    if (filter.status) query.status = filter.status;
    if (filter.feeType) query.feeType = filter.feeType;
    if (filter.userId) query.userId = filter.userId;
    if (filter.studentId) query.studentId = filter.studentId;
    if (filter.batchId) query.batchId = filter.batchId;
    if (filter.subscriptionId) query.subscriptionId = filter.subscriptionId;

    const [items, total] = await Promise.all([
      MonthlyFee.find(query)
        .populate('userId', 'firstName lastName phone email employeeNo role')
        .populate('studentId', 'firstName lastName phone email employeeNo')
        .populate('batchId', 'name schedule code')
        .populate('subscriptionId', 'startDate endDate timeSlot status')
        .populate('planId', 'name price durationDays')
        .populate('sportId', 'name icon')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MonthlyFee.countDocuments(query),
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

  async markFeeAsPaid(id, paymentData = {}, context = {}) {
    const feeDoc = await MonthlyFee.findOne({ _id: id, tenantId: context.tenantId });
    if (!feeDoc) {
      throw new NotFoundError('Monthly fee invoice not found');
    }

    const rawMethod = (paymentData.method || 'cash').toLowerCase();
    const method = ['upi', 'card', 'cash', 'netbanking', 'wallet'].includes(rawMethod) ? rawMethod : 'cash';
    const amount = Number(feeDoc.finalAmount) || 0;

    let payment = null;
    if (feeDoc.paymentId) {
      payment = await Payment.findById(feeDoc.paymentId);
    }

    if (!payment) {
      const gateway = method === 'cash' ? 'cash' : 'manual';
      const paymentType = feeDoc.feeType === 'court_member' ? 'membership' : 'coaching';

      payment = await Payment.create({
        tenantId: feeDoc.tenantId,
        branchId: feeDoc.branchId,
        userId: feeDoc.userId || feeDoc.studentId,
        amount,
        currency: 'INR',
        type: paymentType,
        referenceId: feeDoc._id.toString(),
        paymentMethod: method,
        gateway,
        gatewayPaymentId: paymentData.transactionId || `MANUAL_${Date.now()}`,
        status: 'success',
        notes: paymentData.notes || `${feeDoc.feeType === 'court_member' ? 'Membership' : 'Coaching'} fee payment (${method})`,
        metadata: {
          feeId: feeDoc._id.toString(),
          feeType: feeDoc.feeType,
          month: feeDoc.month,
          year: feeDoc.year,
          isProrated: feeDoc.isProrated,
        },
      });
    } else {
      payment.status = 'success';
      payment.amount = amount;
      payment.paymentMethod = method;
      await payment.save();
    }

    feeDoc.status = 'paid';
    feeDoc.paidAmount = amount;
    feeDoc.paidAt = new Date();
    feeDoc.paymentId = payment._id;
    feeDoc.notes = paymentData.notes || `Paid via ${method}`;
    await feeDoc.save();

    return feeDoc;
  }

  /**
   * Helper to resolve Razorpay credentials by branch, tenant, or platform env
   */
  async _resolveRazorpayCredentials(branchId, tenantId) {
    let keyId = env.RAZORPAY_KEY_ID;
    let keySecret = env.RAZORPAY_KEY_SECRET;
    let webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

    if (branchId) {
      try {
        const branch = await Branch.findById(branchId);
        const branchRzp = branch?.paymentSettings?.razorpay || branch?.paymentGateways?.razorpay;
        if (branchRzp?.enabled && branchRzp.keyId) {
          keyId = branchRzp.keyId;
          keySecret = branchRzp.keySecret || keySecret;
          webhookSecret = branchRzp.webhookSecret || webhookSecret;
          return { keyId, keySecret, webhookSecret };
        }
      } catch (_) {}
    }

    if (tenantId) {
      try {
        const tenantSettings = await settingsService.getSettings(tenantId);
        const tenantRzp = tenantSettings?.paymentGateways?.razorpay || tenantSettings?.paymentSettings?.razorpay;
        if (tenantRzp?.keyId) {
          keyId = tenantRzp.keyId;
          keySecret = tenantRzp.keySecret || keySecret;
          webhookSecret = tenantRzp.webhookSecret || webhookSecret;
        }
      } catch (_) {}
    }

    return { keyId, keySecret, webhookSecret };
  }

  /**
   * Initialize a Razorpay Order for a student coaching fee invoice
   */
  async createRazorpayOrder(feeId, context = {}) {
    const feeDoc = await MonthlyFee.findOne({ _id: feeId, tenantId: context.tenantId })
      .populate('studentId', 'firstName lastName phone email employeeNo')
      .populate('batchId', 'name code schedule')
      .populate('sportId', 'name icon');

    if (!feeDoc) {
      throw new NotFoundError('Monthly coaching fee invoice not found');
    }

    if (feeDoc.status === 'paid') {
      throw new ValidationError('This coaching fee invoice is already paid');
    }

    if (feeDoc.finalAmount <= 0) {
      throw new ValidationError('Invoice amount is ₹0, payment is not required');
    }

    const { keyId, keySecret } = await this._resolveRazorpayCredentials(feeDoc.branchId, context.tenantId);
    const amountInPaise = Math.round(feeDoc.finalAmount * 100);

    let orderId = `order_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const isLiveKey = keyId && !keyId.includes('mock') && keySecret && !keySecret.includes('mock');

    if (isLiveKey) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${keyId.trim()}:${keySecret.trim()}`).toString('base64');
        const response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `fee_${feeDoc._id.toString().slice(-8)}`,
            notes: {
              feeId: feeDoc._id.toString(),
              studentId: feeDoc.studentId?._id?.toString() || feeDoc.studentId?.toString(),
              tenantId: context.tenantId.toString(),
              month: feeDoc.month,
              year: feeDoc.year,
            },
          }),
          signal: AbortSignal.timeout(3000),
        });

        const rzpData = await response.json();
        if (response.ok && rzpData.id) {
          orderId = rzpData.id;
        } else {
          const errMsg = rzpData.error?.description || rzpData.error?.message || 'Failed to create Razorpay order';
          console.error('[Razorpay Order Creation Error]:', rzpData);
          if (env.isDev || env.isTest) {
            console.warn(`[Razorpay Gateway Dev Fallback]: ${errMsg}. Using offline mock order ${orderId} for development.`);
          } else {
            throw new ValidationError(`Razorpay Gateway Error: ${errMsg}. Verify your Razorpay Key ID and Secret in settings.`);
          }
        }
      } catch (err) {
        if (err instanceof ValidationError) throw err;
        console.error('[Razorpay Network Error]:', err.message);
        if (env.isDev || env.isTest) {
          console.warn(`[Razorpay Gateway Dev Fallback]: Unable to reach Razorpay gateway (${err.message}). Using offline mock order ${orderId} for development.`);
        } else {
          throw new ValidationError(`Unable to connect to Razorpay Gateway: ${err.message}`);
        }
      }
    }

    // Save generated Razorpay order ID to invoice
    feeDoc.razorpayOrderId = orderId;
    await feeDoc.save();

    const student = feeDoc.studentId || {};
    const batch = feeDoc.batchId || {};

    return {
      orderId,
      keyId,
      amount: feeDoc.finalAmount,
      amountInPaise,
      currency: 'INR',
      feeId: feeDoc._id,
      month: feeDoc.month,
      year: feeDoc.year,
      student: {
        id: student._id,
        name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Trainee',
        email: student.email || '',
        phone: student.phone || '',
        regNo: student.employeeNo || '',
      },
      batch: {
        id: batch._id,
        name: batch.name || 'Coaching Batch',
        code: batch.code || '',
        schedule: batch.schedule || '',
      },
    };
  }

  /**
   * Verify Razorpay Payment Signature and mark fee invoice as paid + log ledger payment
   */
  async verifyRazorpayPayment(feeId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }, context = {}) {
    if (!razorpay_payment_id) {
      throw new ValidationError('Razorpay payment ID (razorpay_payment_id) is required');
    }

    const feeDoc = await MonthlyFee.findOne({ _id: feeId, tenantId: context.tenantId })
      .populate('studentId', 'firstName lastName phone email employeeNo')
      .populate('batchId', 'name code schedule');

    if (!feeDoc) {
      throw new NotFoundError('Monthly coaching fee invoice not found');
    }

    if (feeDoc.status === 'paid') {
      return {
        alreadyPaid: true,
        invoice: feeDoc,
        message: 'This invoice has already been verified and marked as paid',
      };
    }

    const { keyId, keySecret } = await this._resolveRazorpayCredentials(feeDoc.branchId, context.tenantId);

    // Verify HMAC-SHA256 signature if order ID and signature are provided
    if (razorpay_order_id && razorpay_signature && keySecret && !keySecret.includes('mock')) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        throw new ValidationError('Invalid Razorpay payment signature');
      }
    }

    // Record formal ledger Payment
    const payment = await Payment.create({
      tenantId: feeDoc.tenantId,
      branchId: feeDoc.branchId,
      userId: feeDoc.studentId?._id || feeDoc.studentId,
      amount: feeDoc.finalAmount,
      currency: 'INR',
      type: 'coaching',
      referenceId: feeDoc._id.toString(),
      paymentMethod: 'upi',
      gateway: 'razorpay',
      gatewayOrderId: razorpay_order_id || feeDoc.razorpayOrderId || '',
      gatewayPaymentId: razorpay_payment_id,
      status: 'success',
      metadata: {
        feeId: feeDoc._id.toString(),
        month: feeDoc.month,
        year: feeDoc.year,
        batchName: feeDoc.batchId?.name || '',
      },
    });

    feeDoc.status = 'paid';
    feeDoc.paidAmount = feeDoc.finalAmount;
    feeDoc.paidAt = new Date();
    feeDoc.paymentId = payment._id;
    feeDoc.razorpayOrderId = razorpay_order_id || feeDoc.razorpayOrderId;
    feeDoc.razorpayPaymentId = razorpay_payment_id;
    feeDoc.notes = `Paid via Razorpay (${razorpay_payment_id})`;
    await feeDoc.save();

    return {
      success: true,
      message: 'Coaching fee payment verified and completed successfully',
      invoice: feeDoc,
      payment,
    };
  }
}

export const monthlyFeeGeneratorService = new MonthlyFeeGeneratorService();
