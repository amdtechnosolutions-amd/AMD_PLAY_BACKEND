import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { expenseRepository, paymentRepository, webhookLogRepository } from './finance.repository.js';
import { MonthlyFee } from './monthly-fee.model.js';
import { bookingRepository } from '../bookings/booking.repository.js';
import { cashfreeService } from './cashfree.service.js';
import { ValidationError, NotFoundError, ConflictError } from '../../errors/AppError.js';
import { env } from '../../config/env.js';

export class FinanceService {
  constructor() {
    this.expenseRepository = expenseRepository;
    this.paymentRepository = paymentRepository;
    this.webhookLogRepository = webhookLogRepository;
    this._reconcilerTimer = null;
    this._isReconciling = false;
  }

  async recordExpense(data, context) {
    if (!context.tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const payload = {
      ...data,
      tenantId: context.tenantId,
      branchId: data.branchId || context.branchId,
      recordedBy: context.userId,
      status: data.status || 'pending',
    };

    return await this.expenseRepository.create(payload);
  }

  async approveExpense(id, { status, notes }, context) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new ValidationError("Status must be either 'approved' or 'rejected'");
    }

    const expense = await this.expenseRepository.findById(id, context.tenantId);
    if (!expense) {
      throw new NotFoundError(`Expense with ID '${id}' not found`);
    }

    const updateData = {
      status,
      approvedBy: context.userId,
    };
    if (notes) {
      updateData.notes = expense.notes ? `${expense.notes} | ${notes}` : notes;
    }

    return await this.expenseRepository.updateById(id, updateData, context.tenantId);
  }

  async deleteExpense(id, context = {}) {
    const deleted = await this.expenseRepository.deleteById(id, context.tenantId);
    if (!deleted) {
      throw new NotFoundError(`Expense with ID '${id}' not found`);
    }
    return deleted;
  }


  async listExpenses(filters = {}, pagination = {}, context = {}) {
    const filter = {};
    if (filters.branchId) filter.branchId = filters.branchId;
    if (filters.category) filter.category = filters.category;
    if (filters.status) filter.status = filters.status;

    if (filters.startDate || filters.endDate) {
      filter.date = {};
      if (filters.startDate) filter.date.$gte = filters.startDate;
      if (filters.endDate) filter.date.$lte = filters.endDate;
    }

    return await this.expenseRepository.paginateExpenses(filter, pagination, context.tenantId);
  }

  async getExpenseById(id, context = {}) {
    const expense = await this.expenseRepository.findById(id, context.tenantId);
    if (!expense) {
      throw new NotFoundError(`Expense with ID '${id}' not found`);
    }
    return expense;
  }

  async recordPayment(data, context) {
    if (!context.tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const payload = {
      ...data,
      tenantId: context.tenantId,
      branchId: data.branchId || context.branchId,
      userId: data.userId || context.userId,
      status: data.status || 'success',
      currency: data.currency || 'INR',
    };

    return await this.paymentRepository.create(payload);
  }

  async listPayments(filters = {}, pagination = {}, context = {}) {
    const filter = {};
    if (filters.branchId) filter.branchId = filters.branchId;
    if (filters.userId) filter.userId = filters.userId;
    if (filters.type) filter.type = filters.type;
    if (filters.status) filter.status = filters.status;
    if (filters.gateway) filter.gateway = filters.gateway;
    if (filters.referenceId) filter.referenceId = filters.referenceId;

    if (filters.startDate || filters.endDate) {
      filter.createdAt = {};
      if (filters.startDate) filter.createdAt.$gte = new Date(`${filters.startDate}T00:00:00.000Z`);
      if (filters.endDate) filter.createdAt.$lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }

    return await this.paymentRepository.paginatePayments(filter, pagination, context.tenantId);
  }

  async getPaymentById(id, context = {}) {
    const payment = await this.paymentRepository.findById(id, context.tenantId);
    if (!payment) {
      throw new NotFoundError(`Payment with ID '${id}' not found`);
    }
    return payment;
  }

  verifyWebhookSignature(rawBody, signature, secret = env.RAZORPAY_WEBHOOK_SECRET) {
    if (!rawBody || !signature || !secret) {
      return false;
    }

    try {
      const payloadString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

      if (signature.length !== expectedSignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  async processWebhook(event, signature, rawBody, secret = env.RAZORPAY_WEBHOOK_SECRET) {
    const isValid = this.verifyWebhookSignature(rawBody, signature, secret);
    if (!isValid) {
      try {
        await this.webhookLogRepository.create({
          gateway: 'razorpay',
          eventType: event?.event || 'UNKNOWN',
          status: 'error',
          signatureValid: false,
          error: 'Invalid Razorpay webhook signature',
          payload: event,
          headers: { 'x-razorpay-signature': signature },
          receivedAt: new Date(),
        });
      } catch (_) {}
      throw new ValidationError('Invalid webhook signature');
    }

    const { event: eventName, payload } = event;
    const paymentEntity = payload?.payment?.entity;
    if (!paymentEntity) {
      return { processed: true, message: 'No payment entity in webhook event' };
    }

    const gatewayPaymentId = paymentEntity.id;
    const gatewayOrderId = paymentEntity.order_id || '';
    const payment = await this.paymentRepository.findByGatewayPaymentId(gatewayPaymentId);

    const isSuccess = eventName === 'payment.captured' || eventName === 'order.paid';
    const isFailure = eventName === 'payment.failed';
    const isRefund = eventName === 'refund.processed';

    if (payment) {
      if (isSuccess) {
        payment.status = 'success';
        await payment.save();
      } else if (isFailure) {
        payment.status = 'failed';
        await payment.save();
      } else if (isRefund) {
        payment.status = 'refunded';
        payment.refund = {
          amount: (payload.refund?.entity?.amount || 0) / 100,
          refundedAt: new Date(),
          gatewayRefundId: payload.refund?.entity?.id || '',
          reason: payload.refund?.entity?.notes?.reason || 'Webhook refund',
        };
        await payment.save();
      }
    }

    const webhookStatus = isSuccess ? 'success' : isFailure ? 'failed' : isRefund ? 'refunded' : 'received';

    // Record Webhook Log
    try {
      await this.webhookLogRepository.create({
        tenantId: payment?.tenantId || null,
        branchId: payment?.branchId || null,
        gateway: 'razorpay',
        eventType: eventName,
        gatewayOrderId,
        gatewayPaymentId,
        amount: (paymentEntity.amount || 0) / 100,
        currency: paymentEntity.currency || 'INR',
        paymentMethod: paymentEntity.method || '',
        status: webhookStatus,
        signatureValid: true,
        customer: {
          name: paymentEntity.notes?.customerName || '',
          email: paymentEntity.email || '',
          phone: paymentEntity.contact || '',
        },
        paymentId: payment?._id || null,
        payload: event,
        headers: { 'x-razorpay-signature': signature },
        receivedAt: new Date(),
      });
    } catch (logErr) {
      console.error('[Razorpay WebhookLog Error]:', logErr.message);
    }

    return { processed: true, event: eventName, paymentId: payment?._id, status: webhookStatus };
  }

  async processCashfreeWebhook(event, signature, timestamp, rawBody) {
    const eventType = event?.type || event?.event || 'UNKNOWN';
    const linkData = event?.data?.link_id ? event.data : null;
    const paymentData = event?.data?.payment;
    const orderData = event?.data?.order;
    const customerDetails = event?.data?.customer_details || orderData?.customer_details || linkData?.customer_details || {};

    const gatewayPaymentId = paymentData?.cf_payment_id
      ? String(paymentData.cf_payment_id)
      : (orderData?.transaction_id ? String(orderData.transaction_id) : '');

    const gatewayOrderId = orderData?.order_id || (linkData ? String(linkData.link_id || linkData.cf_link_id) : '');
    const linkId = linkData ? String(linkData.link_id || linkData.cf_link_id) : '';

    const isValid = await cashfreeService.verifyWebhookSignature({
      rawBody,
      timestamp,
      signature,
      tenantId: orderData?.order_tags?.tenantId || null,
    });

    if (!isValid && !env.isDev && !env.isTest) {
      let fallbackTenantId = orderData?.order_tags?.tenantId || null;
      if (!fallbackTenantId) {
        try {
          const { tenantRepository } = await import('../tenants/tenant.repository.js');
          const defaultTenant = await tenantRepository.model.findOne({ status: 'active' }).select('_id').lean();
          if (defaultTenant) fallbackTenantId = defaultTenant._id;
        } catch (_) {}
      }
      try {
        await this.webhookLogRepository.create({
          tenantId: fallbackTenantId,
          gateway: 'cashfree',
          eventType,
          gatewayOrderId,
          gatewayPaymentId,
          amount: Number(orderData?.order_amount || paymentData?.payment_amount || linkData?.link_amount || 0) || 0,
          currency: String(orderData?.order_currency || paymentData?.payment_currency || linkData?.link_currency || 'INR').toUpperCase(),
          paymentMethod: paymentData?.payment_group || (paymentData?.payment_method?.upi ? 'upi' : ''),
          status: 'error',
          signatureValid: false,
          customer: {
            name: customerDetails.customer_name || customerDetails.name || '',
            email: customerDetails.customer_email || customerDetails.email || '',
            phone: customerDetails.customer_phone || customerDetails.phone || '',
          },
          error: 'Invalid Cashfree webhook signature',
          payload: event,
          headers: {
            'x-webhook-signature': signature,
            'x-webhook-timestamp': timestamp,
          },
          receivedAt: new Date(),
        });
      } catch (_) {}
      throw new ValidationError('Invalid Cashfree webhook signature');
    }

    // Handle dashboard test ping events
    if (eventType === 'TEST_WEBHOOK' || eventType.toUpperCase().includes('TEST')) {
      let testTenantId = null;
      try {
        const { tenantRepository } = await import('../tenants/tenant.repository.js');
        const defaultTenant = await tenantRepository.model.findOne({ status: 'active' }).select('_id').lean();
        if (defaultTenant) testTenantId = defaultTenant._id;
      } catch (_) {}

      try {
        await this.webhookLogRepository.create({
          tenantId: testTenantId,
          gateway: 'cashfree',
          eventType: 'TEST_WEBHOOK',
          status: 'test',
          signatureValid: true,
          payload: event,
          headers: {
            'x-webhook-signature': signature,
            'x-webhook-timestamp': timestamp,
          },
          receivedAt: new Date(),
        });
      } catch (logErr) {
        console.error('[Cashfree Test WebhookLog Error]:', logErr.message);
      }
      return { processed: true, message: 'Cashfree test webhook verified successfully' };
    }

    if (!gatewayPaymentId && !gatewayOrderId && !linkId) {
      return { processed: true, message: 'No payment or order details found in Cashfree webhook' };
    }

    const isSuccess = eventType === 'PAYMENT_SUCCESS_WEBHOOK' ||
      (eventType === 'PAYMENT_LINK_EVENT' && (linkData?.link_status === 'PAID' || orderData?.transaction_status === 'SUCCESS')) ||
      paymentData?.payment_status === 'SUCCESS' ||
      orderData?.order_status === 'PAID' ||
      orderData?.transaction_status === 'SUCCESS';

    const isDropped = eventType === 'PAYMENT_USER_DROPPED_WEBHOOK' ||
      paymentData?.payment_status === 'USER_DROPPED';

    const isFailure = eventType === 'PAYMENT_FAILED_WEBHOOK' ||
      isDropped ||
      (eventType === 'PAYMENT_LINK_EVENT' && ['CANCELLED', 'EXPIRED'].includes(linkData?.link_status)) ||
      paymentData?.payment_status === 'FAILED' ||
      paymentData?.payment_status === 'CANCELLED' ||
      orderData?.transaction_status === 'FAILED';

    const isRefund = eventType === 'REFUND_STATUS_WEBHOOK';

    // 1. Update Payment ledger if exists
    let payment = null;
    if (gatewayPaymentId) {
      payment = await this.paymentRepository.findByGatewayPaymentId(gatewayPaymentId);
    }
    if (!payment && gatewayOrderId) {
      payment = await this.paymentRepository.model.findOne({
        $or: [
          { gatewayOrderId },
          { 'metadata.linkId': linkId },
        ],
      });
    }

    if (payment) {
      if (isSuccess) {
        payment.status = 'success';
        if (gatewayPaymentId) payment.gatewayPaymentId = gatewayPaymentId;
        await payment.save();
      } else if (isFailure) {
        payment.status = 'failed';
        await payment.save();
      } else if (isRefund) {
        payment.status = 'refunded';
        const refundData = event.data?.refund;
        payment.refund = {
          amount: refundData?.refund_amount || 0,
          refundedAt: new Date(),
          gatewayRefundId: String(refundData?.cf_refund_id || refundData?.refund_id || ''),
          reason: refundData?.refund_note || 'Cashfree webhook refund',
        };
        await payment.save();
      }
    }

    // 2. Update Court Booking if exists (for mobile app & web async confirmation)
    let bookingDoc = null;
    try {
      const bookings = await bookingRepository.model.find({
        $or: [
          { 'payment.transactionId': gatewayOrderId },
          { 'payment.transactionId': gatewayPaymentId },
          { 'payment.cashfree_order_id': gatewayOrderId },
          { 'payment.cashfree_payment_id': gatewayPaymentId },
          { 'payment.linkId': linkId },
          { bookingNumber: gatewayOrderId },
        ],
      });

      if (bookings.length > 0) {
        bookingDoc = bookings[0];
      }

      for (const b of bookings) {
        if (isSuccess) {
          b.payment.status = 'success';
          if (gatewayPaymentId) b.payment.transactionId = gatewayPaymentId;
          b.status = 'confirmed';
          await b.save();
        } else if (isFailure && b.status !== 'confirmed') {
          b.payment.status = 'failed';
          b.status = 'cancelled';
          await b.save();
        }
      }
    } catch (_) {}

    // 3. Update Monthly Coaching / Member Fee invoice if exists
    let feeDoc = null;
    try {
      const fee = await MonthlyFee.findOne({
        $or: [
          { paymentId: gatewayPaymentId },
          { 'notes.orderId': gatewayOrderId },
          { 'notes.linkId': linkId },
          { 'notes.cfLinkId': linkData?.cf_link_id },
        ],
      });
      if (fee) {
        feeDoc = fee;
        if (isSuccess) {
          fee.status = 'paid';
          fee.paidAt = new Date();
          await fee.save();
        } else if (isFailure && fee.status !== 'paid') {
          fee.status = 'failed';
          await fee.save();
        }
      }
    } catch (_) {}

    // 4. Resolve tenantId & branchId
    let resolvedTenantId = payment?.tenantId || bookingDoc?.tenantId || feeDoc?.tenantId || null;
    let resolvedBranchId = payment?.branchId || bookingDoc?.branchId || feeDoc?.branchId || null;

    if (!resolvedTenantId && orderData?.order_tags?.tenantId) {
      resolvedTenantId = orderData.order_tags.tenantId;
    }

    if (!resolvedTenantId) {
      try {
        const { tenantRepository } = await import('../tenants/tenant.repository.js');
        const defaultTenant = await tenantRepository.model.findOne({ status: 'active' }).select('_id').lean();
        if (defaultTenant) resolvedTenantId = defaultTenant._id;
      } catch (_) {}
    }

    const resolvedAmount = orderData?.order_amount || paymentData?.payment_amount || linkData?.link_amount || payment?.amount || 0;
    const resolvedCurrency = orderData?.order_currency || paymentData?.payment_currency || linkData?.link_currency || 'INR';
    const resolvedMethod = paymentData?.payment_group || (paymentData?.payment_method?.upi ? 'upi' : '') || payment?.paymentMethod || '';
    const webhookStatus = isSuccess ? 'success' : isDropped ? 'dropped' : isFailure ? 'failed' : isRefund ? 'refunded' : 'received';
    const reasonMessage = (isFailure || isDropped) ? (paymentData?.payment_message || null) : null;

    // 5. Persist WebhookLog (deduplicate exact gateway retries)
    try {
      const logData = {
        tenantId: resolvedTenantId,
        branchId: resolvedBranchId,
        gateway: 'cashfree',
        eventType,
        gatewayOrderId,
        gatewayPaymentId,
        amount: Number(resolvedAmount) || 0,
        currency: String(resolvedCurrency || 'INR').toUpperCase(),
        paymentMethod: resolvedMethod,
        status: webhookStatus,
        signatureValid: true,
        customer: {
          name: customerDetails.customer_name || customerDetails.name || '',
          email: customerDetails.customer_email || customerDetails.email || '',
          phone: customerDetails.customer_phone || customerDetails.phone || '',
        },
        paymentId: payment?._id || null,
        bookingId: bookingDoc?._id || null,
        payload: event,
        headers: {
          'x-webhook-signature': signature,
          'x-webhook-timestamp': timestamp,
        },
        error: reasonMessage,
        receivedAt: event?.event_time ? new Date(event.event_time) : new Date(),
      };

      let existingLog = null;
      if (gatewayOrderId) {
        existingLog = await this.webhookLogRepository.model.findOne({
          gateway: 'cashfree',
          gatewayOrderId,
          $or: [
            { eventType: 'ORDER_CREATED' },
            ...(gatewayPaymentId ? [{ eventType, gatewayPaymentId }] : [{ eventType }]),
          ],
        });
      }

      let savedLog = null;
      if (existingLog) {
        Object.assign(existingLog, logData);
        savedLog = await existingLog.save();
      } else {
        savedLog = await this.webhookLogRepository.create(logData);
      }

      // 6. Post-webhook lifecycle automation:
      // - On drop/failure/cancel: immediately release any held Redis slot locks so another player can book right away
      // - On success with NO booking yet (phone/browser crashed after UPI debit): auto-create booking or auto-refund on conflict
      if (savedLog) {
        if (isFailure || isDropped) {
          await this._releaseOrderSlotLocks(savedLog);
        } else if (isSuccess && !bookingDoc && savedLog.bookingIntent) {
          await this._finalizePaidOrderFromIntent(savedLog, {
            gatewayOrderId,
            gatewayPaymentId,
            amount: Number(resolvedAmount) || savedLog.amount || 0,
            paymentMethod: resolvedMethod || 'upi',
          });
        }
      }
    } catch (logErr) {
      console.error('[Cashfree WebhookLog Error]:', logErr.message);
    }

    return {
      processed: true,
      eventType,
      orderId: gatewayOrderId,
      paymentId: gatewayPaymentId,
      status: webhookStatus,
    };
  }

  /**
   * Release any Redis slot locks bound to a cancelled/dropped Cashfree order
   */
  async _releaseOrderSlotLocks(logDoc) {
    if (!logDoc) return 0;
    try {
      const { slotService } = await import('../slots/slot.service.js');
      let slots = logDoc.bookingIntent?.slots || [];
      if ((!slots || slots.length === 0) && logDoc.payload?.data?.notes?.resourceId) {
        const n = logDoc.payload.data.notes;
        if (n.resourceId && n.date && n.startTime) {
          slots = [{ resourceId: n.resourceId, date: n.date, startTime: n.startTime, endTime: n.endTime || '' }];
        }
      }
      if (slots.length > 0 && logDoc.tenantId) {
        const released = await slotService.releaseOrderSlots(slots, logDoc.tenantId, logDoc.gatewayOrderId);
        if (released > 0) {
          console.log(`[Payment Reconciler] Released ${released} held slot lock(s) for dropped/cancelled order ${logDoc.gatewayOrderId}`);
        }
        return released;
      }
    } catch (err) {
      console.warn('[Payment Reconciler] Slot lock release warning:', err.message);
    }
    return 0;
  }

  /**
   * Crash-recovery: Auto-create confirmed booking from saved bookingIntent when payment succeeded
   * on Cashfree but the player's browser/phone crashed before calling /bookings/payment/verify.
   * If the slot was already booked by another player after hold expiry, auto-initiates a full Cashfree refund.
   */
  async _finalizePaidOrderFromIntent(logDoc, { gatewayOrderId, gatewayPaymentId, amount, paymentMethod = 'upi' }) {
    if (!logDoc?.bookingIntent || !gatewayOrderId) return null;
    try {
      // Idempotency: check if booking already exists for this order/payment
      const existingBookings = await bookingRepository.model.find({
        $or: [
          { 'payment.cashfree_order_id': gatewayOrderId },
          { 'payment.transactionId': gatewayOrderId },
          ...(gatewayPaymentId ? [{ 'payment.transactionId': gatewayPaymentId }, { 'payment.cashfree_payment_id': gatewayPaymentId }] : []),
        ],
      });

      if (existingBookings.length > 0) {
        logDoc.bookingId = existingBookings[0]._id;
        logDoc.status = 'success';
        logDoc.eventType = 'PAYMENT_SUCCESS_WEBHOOK';
        logDoc.error = null;
        await logDoc.save();
        return { recovered: false, alreadyExists: true, bookingId: existingBookings[0]._id };
      }

      const intent = logDoc.bookingIntent;
      if (!intent.slots || intent.slots.length === 0 || !intent.userId) {
        return null;
      }

      const { bookingService } = await import('../bookings/booking.service.js');
      const payload = {
        ...(intent.slots.length === 1
          ? {
              resourceId: intent.slots[0].resourceId,
              date: intent.slots[0].date,
              startTime: intent.slots[0].startTime,
              endTime: intent.slots[0].endTime,
            }
          : { slots: intent.slots }),
        userId: intent.userId,
        holdId: intent.holdId || undefined,
        notes: intent.notes || 'Auto-confirmed via Cashfree webhook (crash recovery)',
        paymentMethod: 'cashfree',
        cashfree_order_id: gatewayOrderId,
        cashfree_payment_id: gatewayPaymentId || gatewayOrderId,
        transactionId: gatewayPaymentId || gatewayOrderId,
        _bypassHoldCheck: true,
      };

      const context = {
        tenantId: intent.tenantId || (logDoc.tenantId ? String(logDoc.tenantId) : null),
        branchId: intent.branchId || (logDoc.branchId ? String(logDoc.branchId) : null),
        userId: intent.userId,
      };

      try {
        const bookingResult = await bookingService.createBooking(payload, context);
        const createdBookingId = bookingResult?._id || bookingResult?.bookings?.[0]?._id || null;
        logDoc.bookingId = createdBookingId;
        logDoc.status = 'success';
        logDoc.eventType = 'PAYMENT_SUCCESS_WEBHOOK';
        logDoc.error = null;
        if (gatewayPaymentId) logDoc.gatewayPaymentId = gatewayPaymentId;
        if (paymentMethod) logDoc.paymentMethod = paymentMethod;
        await logDoc.save();
        console.log(`[Payment Recovery] Auto-confirmed booking ${createdBookingId} for Cashfree order ${gatewayOrderId}`);
        return { recovered: true, bookingId: createdBookingId };
      } catch (bookErr) {
        if (bookErr instanceof ConflictError) {
          // Slot was booked by another player after hold expired — auto-refund full amount!
          const refundAmount = Number(amount || logDoc.amount || 0);
          let refundNote = `Slot conflict after hold expiry: ${bookErr.message}`;
          let refundSucceeded = false;

          if (refundAmount > 0) {
            try {
              const refundRes = await cashfreeService.initiateRefund({
                orderId: gatewayOrderId,
                amount: refundAmount,
                reason: 'Slot already booked by another player — automatic full refund',
                branchId: logDoc.branchId,
                tenantId: logDoc.tenantId,
              });
              refundSucceeded = true;
              refundNote = `Slot conflict — Automatic full refund of INR ${refundAmount} initiated (Refund ID: ${refundRes.cfRefundId || refundRes.refundId})`;
              console.warn(`[Payment Conflict Auto-Refund] Order ${gatewayOrderId}: ${refundNote}`);
            } catch (refundErr) {
              refundNote = `Slot conflict — Auto-refund failed (${refundErr.message}). Manual refund required for INR ${refundAmount}.`;
              console.error(`[Payment Conflict Auto-Refund Failed] Order ${gatewayOrderId}:`, refundErr.message);
            }
          }

          logDoc.status = refundSucceeded ? 'refunded' : 'error';
          logDoc.eventType = refundSucceeded ? 'CONFLICT_AUTO_REFUND' : 'CONFLICT_REFUND_FAILED';
          logDoc.error = refundNote;
          await logDoc.save();
          return { recovered: false, conflict: true, refunded: refundSucceeded, note: refundNote };
        }
        throw bookErr;
      }
    } catch (err) {
      console.error(`[Payment Recovery Error] Order ${gatewayOrderId}:`, err.message);
      return null;
    }
  }

  /**
   * Start lightweight 60-second background reconciliation worker.
   * Zero Cashfree API calls when no pending orders exist.
   */
  startPaymentReconciler(intervalMs = 60000) {
    if (this._reconcilerTimer) return;
    this._reconcilerTimer = setInterval(async () => {
      if (this._isReconciling) return;
      this._isReconciling = true;
      try {
        await this._syncPendingCashfreeLogs(null);
      } catch (err) {
        console.warn('[Payment Reconciler] Cycle warning:', err.message);
      } finally {
        this._isReconciling = false;
      }
    }, intervalMs);
    console.log(`💳 [Payment Reconciler] Cashfree live status & slot-lock worker started (${Math.round(intervalMs / 1000)}s interval)`);
  }

  stopPaymentReconciler() {
    if (this._reconcilerTimer) {
      clearInterval(this._reconcilerTimer);
      this._reconcilerTimer = null;
      console.log('💳 [Payment Reconciler] Worker stopped');
    }
  }

  /**
   * Live-sync recent pending Cashfree orders against Cashfree PG API so cancelled, dropped,
   * or newly paid orders appear immediately in the Admin Panel even before Cashfree's delayed webhook arrives.
   */
  async _syncPendingCashfreeLogs(rawTenantId = null) {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pendingFilter = {
        gateway: 'cashfree',
        status: 'pending',
        gatewayOrderId: { $ne: '' },
        receivedAt: { $gte: since },
      };
      if (rawTenantId && mongoose.Types.ObjectId.isValid(rawTenantId)) {
        pendingFilter.tenantId = new mongoose.Types.ObjectId(String(rawTenantId));
      }

      const pendingLogs = await this.webhookLogRepository.model
        .find(pendingFilter)
        .sort({ receivedAt: -1 })
        .limit(5)
        .exec();

      if (!pendingLogs.length) return;

      await Promise.all(
        pendingLogs.map(async (logDoc) => {
          try {
            const [orderData, payments] = await Promise.all([
              cashfreeService.getOrder(logDoc.gatewayOrderId, {
                branchId: logDoc.branchId,
                tenantId: logDoc.tenantId,
              }),
              cashfreeService.getOrderPayments(logDoc.gatewayOrderId, {
                branchId: logDoc.branchId,
                tenantId: logDoc.tenantId,
              }),
            ]);

            const latestPayment = Array.isArray(payments) && payments.length > 0 ? payments[0] : null;
            const successPayment = Array.isArray(payments)
              ? payments.find((p) => p.payment_status === 'SUCCESS')
              : null;

            const orderStatus = String(orderData?.order_status || '').toUpperCase();
            const paymentStatus = String(
              (successPayment || latestPayment)?.payment_status || ''
            ).toUpperCase();
            const terminationReason = String(
              orderData?.order_tags?.orderTerminationReason || ''
            ).trim();

            let nextStatus = null;
            let nextEventType = null;
            let nextError = logDoc.error;

            if (orderStatus === 'PAID' || paymentStatus === 'SUCCESS') {
              nextStatus = 'success';
              nextEventType = 'PAYMENT_SUCCESS_WEBHOOK';
              nextError = null;
            } else if (
              paymentStatus === 'USER_DROPPED' ||
              Boolean(terminationReason) ||
              (paymentStatus === 'NOT_ATTEMPTED' &&
                Date.now() - new Date(latestPayment?.payment_time || logDoc.receivedAt).getTime() > 90 * 1000)
            ) {
              nextStatus = 'dropped';
              nextEventType = 'PAYMENT_USER_DROPPED_WEBHOOK';
              nextError =
                latestPayment?.payment_message ||
                terminationReason ||
                'User dropped payment on Cashfree checkout';
            } else if (paymentStatus === 'FAILED') {
              nextStatus = 'failed';
              nextEventType = 'PAYMENT_FAILED_WEBHOOK';
              nextError = latestPayment?.payment_message || 'Payment failed';
            } else if (
              paymentStatus === 'CANCELLED' ||
              orderStatus === 'EXPIRED' ||
              orderStatus === 'TERMINATED'
            ) {
              nextStatus = 'cancelled';
              nextEventType = 'ORDER_CANCELLED';
              nextError = latestPayment?.payment_message || `Order ${orderStatus.toLowerCase()} on Cashfree`;
            } else if (
              orderStatus === 'ACTIVE' &&
              (!payments || payments.length === 0) &&
              Date.now() - new Date(logDoc.receivedAt).getTime() > 5 * 60 * 1000
            ) {
              // User closed/cancelled checkout without picking a payment method
              nextStatus = 'dropped';
              nextEventType = 'PAYMENT_USER_DROPPED_WEBHOOK';
              nextError = 'Checkout closed / dropped by user before payment';
            }

            if (nextStatus) {
              const chosenPayment = successPayment || latestPayment;
              logDoc.status = nextStatus;
              logDoc.eventType = nextEventType;
              logDoc.error = nextError;
              if (chosenPayment?.cf_payment_id) {
                logDoc.gatewayPaymentId = String(chosenPayment.cf_payment_id);
              }
              if (chosenPayment?.payment_group) {
                logDoc.paymentMethod = chosenPayment.payment_group;
              }
              logDoc.payload = {
                ...(logDoc.payload || {}),
                syncedAt: new Date().toISOString(),
                order: orderData,
                payment: chosenPayment || null,
              };
              await logDoc.save();

              // Release held Redis slot locks immediately on drop/fail/cancel
              if (['dropped', 'failed', 'cancelled'].includes(nextStatus)) {
                await this._releaseOrderSlotLocks(logDoc);
              } else if (nextStatus === 'success' && !logDoc.bookingId && logDoc.bookingIntent) {
                // Crash recovery: user paid on Cashfree, auto-confirm booking or auto-refund on conflict
                await this._finalizePaidOrderFromIntent(logDoc, {
                  gatewayOrderId: logDoc.gatewayOrderId,
                  gatewayPaymentId: logDoc.gatewayPaymentId,
                  amount: orderData?.order_amount || logDoc.amount,
                  paymentMethod: logDoc.paymentMethod || 'upi',
                });
              }
            }
          } catch (_) {
            // Silently skip individual gateway lookup failures so report endpoint stays fast
          }
        })
      );
    } catch (_) {}
  }

  async markOrderCancelled({ orderId, reason = 'Cancelled by user' }, context = {}) {
    if (!orderId) {
      throw new ValidationError('orderId is required');
    }

    const filter = { gatewayOrderId: String(orderId) };
    if (context.tenantId && mongoose.Types.ObjectId.isValid(context.tenantId)) {
      filter.tenantId = new mongoose.Types.ObjectId(String(context.tenantId));
    }

    const existing = await this.webhookLogRepository.model.findOne(filter);
    if (existing) {
      if (existing.status !== 'success') {
        existing.status = 'cancelled';
        existing.eventType = 'ORDER_CANCELLED';
        existing.error = reason || 'Cancelled by user';
        await existing.save();
        await this._releaseOrderSlotLocks(existing);
      }
      return existing;
    }

    let resolvedTenantId = context.tenantId || null;
    if (!resolvedTenantId) {
      try {
        const { tenantRepository } = await import('../tenants/tenant.repository.js');
        const defaultTenant = await tenantRepository.model.findOne({ status: 'active' }).select('_id').lean();
        if (defaultTenant) resolvedTenantId = defaultTenant._id;
      } catch (_) {}
    }

    return await this.webhookLogRepository.create({
      tenantId: resolvedTenantId,
      branchId: context.branchId || null,
      gateway: 'cashfree',
      eventType: 'ORDER_CANCELLED',
      gatewayOrderId: String(orderId),
      status: 'cancelled',
      signatureValid: true,
      error: reason || 'Cancelled by user',
      payload: { type: 'ORDER_CANCELLED', orderId, reason },
      receivedAt: new Date(),
    });
  }

  async getWebhookReport(filters = {}, pagination = {}, context = {}) {
    const rawTenantId = context.tenantId || (filters.tenantId && filters.tenantId !== 'all' ? filters.tenantId : null);

    // Live-sync any recent pending Cashfree orders before querying
    await this._syncPendingCashfreeLogs(rawTenantId);

    const query = {};

    if (rawTenantId && mongoose.Types.ObjectId.isValid(rawTenantId)) {
      query.tenantId = new mongoose.Types.ObjectId(String(rawTenantId));
    }

    if (filters.gateway) {
      query.gateway = String(filters.gateway).toLowerCase();
    }

    if (filters.status) {
      query.status = String(filters.status).toLowerCase();
    }

    if (filters.eventType) {
      query.eventType = String(filters.eventType);
    }

    if (filters.branchId && mongoose.Types.ObjectId.isValid(filters.branchId)) {
      query.branchId = new mongoose.Types.ObjectId(String(filters.branchId));
    }

    if (filters.search && String(filters.search).trim()) {
      const term = String(filters.search).trim();
      const escaped = term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { gatewayOrderId: regex },
        { gatewayPaymentId: regex },
        { 'customer.name': regex },
        { 'customer.email': regex },
        { 'customer.phone': regex },
      ];
    }

    if (filters.startDate || filters.endDate) {
      query.receivedAt = {};
      if (filters.startDate) {
        query.receivedAt.$gte = new Date(filters.startDate.includes('T') ? filters.startDate : `${filters.startDate}T00:00:00.000+05:30`);
      }
      if (filters.endDate) {
        query.receivedAt.$lte = new Date(filters.endDate.includes('T') ? filters.endDate : `${filters.endDate}T23:59:59.999+05:30`);
      }
    }

    const page = Math.max(1, Number.parseInt(pagination.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(pagination.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [items, total, summaryAgg] = await Promise.all([
      this.webhookLogRepository.model
        .find(query)
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('tenantId', 'name subdomain')
        .populate('branchId', 'name code')
        .populate('paymentId', 'amount currency status type referenceId')
        .populate('bookingId', 'bookingNumber status payment')
        .lean()
        .exec(),
      this.webhookLogRepository.model.countDocuments(query),
      this.webhookLogRepository.model.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'success'] }, '$amount', 0],
              },
            },
            successCount: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
            },
            pendingCount: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
            failedCount: {
              $sum: { $cond: [{ $in: ['$status', ['failed', 'dropped', 'cancelled']] }, 1, 0] },
            },
            droppedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'dropped'] }, 1, 0] },
            },
            cancelledCount: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            errorCount: {
              $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] },
            },
            testCount: {
              $sum: { $cond: [{ $eq: ['$status', 'test'] }, 1, 0] },
            },
            refundedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] },
            },
            cashfreeCount: {
              $sum: { $cond: [{ $eq: ['$gateway', 'cashfree'] }, 1, 0] },
            },
            razorpayCount: {
              $sum: { $cond: [{ $eq: ['$gateway', 'razorpay'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const stats = summaryAgg[0] || {
      total: 0,
      totalAmount: 0,
      successCount: 0,
      pendingCount: 0,
      failedCount: 0,
      droppedCount: 0,
      cancelledCount: 0,
      errorCount: 0,
      testCount: 0,
      refundedCount: 0,
      cashfreeCount: 0,
      razorpayCount: 0,
    };

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      summary: {
        total: stats.total || 0,
        totalAmount: Number((stats.totalAmount || 0).toFixed(2)),
        successCount: stats.successCount || 0,
        pendingCount: stats.pendingCount || 0,
        failedCount: stats.failedCount || 0,
        droppedCount: stats.droppedCount || 0,
        cancelledCount: stats.cancelledCount || 0,
        errorCount: stats.errorCount || 0,
        testCount: stats.testCount || 0,
        refundedCount: stats.refundedCount || 0,
        byGateway: {
          cashfree: stats.cashfreeCount || 0,
          razorpay: stats.razorpayCount || 0,
        },
      },
    };
  }

  async getWebhookSummary(filters = {}, context = {}) {
    const report = await this.getWebhookReport(filters, { page: 1, limit: 1 }, context);
    return report.summary;
  }

  async getWebhookById(id, context = {}) {
    const filter = { _id: id };
    if (context.tenantId) {
      filter.tenantId = context.tenantId;
    }

    const log = await this.webhookLogRepository.model
      .findOne(filter)
      .populate('tenantId', 'name subdomain')
      .populate('branchId', 'name code')
      .populate('paymentId', 'amount currency status type referenceId gatewayOrderId gatewayPaymentId')
      .populate('bookingId', 'bookingNumber status payment courtId date startTime endTime')
      .lean()
      .exec();

    if (!log) {
      throw new NotFoundError(`Webhook log entry with ID '${id}' not found`);
    }

    return log;
  }

  async getFinancialSummary(filters = {}, context = {}) {
    const tenantId = context.tenantId || filters.tenantId || null;
    const { branchId, startDate, endDate } = filters;

    const [payments, expenses] = await Promise.all([
      this.paymentRepository.findSuccessfulByDateRange(tenantId, branchId, startDate, endDate),
      this.expenseRepository.findApprovedByDateRange(tenantId, branchId, startDate, endDate),
    ]);

    // Safeguard: fetch unlinked paid monthly coaching fees
    const feeFilter = {
      status: 'paid',
      paymentId: null,
    };
    if (tenantId) feeFilter.tenantId = tenantId;
    if (branchId) feeFilter.branchId = branchId;
    if (startDate || endDate) {
      feeFilter.paidAt = {};
      if (startDate) feeFilter.paidAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) feeFilter.paidAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }
    const unlinkedFees = await MonthlyFee.find(feeFilter).exec();

    let totalRevenue = 0;
    const revenueByType = {
      booking: 0,
      membership: 0,
      coaching: 0,
      other: 0,
    };
    const revenueByPaymentMethod = {};

    for (const p of payments) {
      const amt = p.amount || 0;
      totalRevenue += amt;

      const pType = p.type || 'other';
      revenueByType[pType] = (revenueByType[pType] || 0) + amt;

      const method = p.paymentMethod || 'other';
      revenueByPaymentMethod[method] = (revenueByPaymentMethod[method] || 0) + amt;
    }

    for (const f of unlinkedFees) {
      const amt = f.paidAmount || f.finalAmount || 0;
      totalRevenue += amt;
      revenueByType.coaching = (revenueByType.coaching || 0) + amt;
      revenueByPaymentMethod.cash = (revenueByPaymentMethod.cash || 0) + amt;
    }

    let totalExpenses = 0;
    const expensesByCategory = {};

    for (const e of expenses) {
      const amt = e.amount || 0;
      totalExpenses += amt;

      const cat = e.category || 'other';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
    }

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(2)) : 0;

    return {
      currency: 'INR',
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
      },
      breakdowns: {
        revenueByType,
        revenueByPaymentMethod,
        expensesByCategory,
      },
      counts: {
        successfulPayments: payments.length + unlinkedFees.length,
        approvedExpenses: expenses.length,
      },
    };
  }
}

export const financeService = new FinanceService();
