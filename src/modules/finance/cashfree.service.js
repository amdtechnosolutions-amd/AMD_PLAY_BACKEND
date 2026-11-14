import crypto from 'node:crypto';
import { Branch } from '../branches/branch.model.js';
import { Payment } from './payment.model.js';
import { settingsService } from '../settings/settings.service.js';
import { env } from '../../config/env.js';
import { ValidationError } from '../../errors/AppError.js';

export class CashfreeService {
  /**
   * Resolve Cashfree API credentials hierarchically:
   * 1. Branch specific settings (if configured)
   * 2. Tenant settings (if configured)
   * 3. Environment variables (fallback)
   */
  async resolveCredentials(branchId, tenantId) {
    let appId = env.CASHFREE_APP_ID || '';
    let secretKey = env.CASHFREE_SECRET_KEY || '';
    let apiVersion = env.CASHFREE_API_VERSION || '2023-08-01';
    let environment = env.CASHFREE_ENV || 'TEST';

    if (branchId) {
      try {
        const branch = await Branch.findById(branchId);
        const branchCf = branch?.paymentSettings?.cashfree || branch?.paymentGateways?.cashfree;
        if (branchCf?.enabled && branchCf.appId) {
          appId = branchCf.appId.trim();
          secretKey = (branchCf.secretKey || secretKey).trim();
          apiVersion = (branchCf.apiVersion || apiVersion).trim();
          environment = (branchCf.environment || environment).trim();
          const baseUrl = String(environment).toUpperCase() === 'PROD'
            ? 'https://api.cashfree.com/pg'
            : 'https://sandbox.cashfree.com/pg';
          return { appId, secretKey, apiVersion, environment, baseUrl };
        }
      } catch (_) {}
    }

    if (tenantId) {
      try {
        const tenantSettings = await settingsService.getSettings(tenantId);
        const tenantCf = tenantSettings?.paymentGateways?.cashfree || tenantSettings?.paymentSettings?.cashfree;
        if (tenantCf?.appId) {
          appId = tenantCf.appId.trim();
          secretKey = (tenantCf.secretKey || secretKey).trim();
          apiVersion = (tenantCf.apiVersion || apiVersion).trim();
          environment = (tenantCf.environment || environment).trim();
        }
      } catch (_) {}
    }

    const baseUrl = String(environment).toUpperCase() === 'PROD'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

    return { appId, secretKey, apiVersion, environment, baseUrl };
  }

  /**
   * Helper to perform authenticated HTTP requests to Cashfree PG API
   */
  async _request(endpoint, { method = 'GET', body = null, timeoutMs = 15000 }, credentials) {
    const { appId, secretKey, apiVersion, baseUrl } = credentials;
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = {
      'x-client-id': appId,
      'x-client-secret': secretKey,
      'x-api-version': apiVersion || '2023-08-01',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const fetchOptions = {
      method,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { raw: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  }

  /**
   * Create an official Cashfree Payment Order
   * Reference: https://www.cashfree.com/docs/api-reference/payments/latest/orders/create-order
   */
  async createOrder({
    orderId = null,
    amount,
    currency = 'INR',
    customer = {},
    notes = {},
    returnUrl = '',
    notifyUrl = '',
    branchId = null,
    tenantId = null,
  }) {
    if (amount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    const credentials = await this.resolveCredentials(branchId, tenantId);
    const { appId, secretKey, environment } = credentials;

    // Sanitize order_id: alphanumeric, min 3, max 50 chars, allowed chars [a-zA-Z0-9_-]
    let normalizedOrderId = orderId
      ? String(orderId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)
      : `cf_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    if (normalizedOrderId.length < 3) {
      normalizedOrderId = `cf_${normalizedOrderId}_${Date.now()}`.slice(0, 48);
    }

    // Sanitize customer details
    const rawCustomerId = customer.id || customer.userId || `cust_${Date.now()}`;
    let customerId = String(rawCustomerId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
    if (customerId.length < 3) {
      customerId = `cust_${customerId}_01`.slice(0, 48);
    }

    const rawPhone = String(customer.phone || '').replace(/[^0-9]/g, '');
    const customerPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : '9999999999';
    const customerEmail = customer.email && customer.email.includes('@')
      ? customer.email
      : 'customer@apexacademy.com';
    const customerName = (customer.name || 'Academy Player').trim().slice(0, 50) || 'Academy Player';

    const orderAmount = Number(Number(amount).toFixed(2));

    const isLiveKey = appId && !appId.includes('mock') && secretKey && !secretKey.includes('mock');

    let paymentSessionId = `session_cf_mock_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    let cfOrderId = String(Math.floor(1000000 + Math.random() * 9000000));
    let orderStatus = 'ACTIVE';

    if (isLiveKey) {
      try {
        const orderPayload = {
          order_id: normalizedOrderId,
          order_amount: orderAmount,
          order_currency: currency,
          customer_details: {
            customer_id: customerId,
            customer_phone: customerPhone,
            customer_name: customerName,
            customer_email: customerEmail,
          },
          order_meta: {
            return_url: returnUrl || undefined,
            notify_url: notifyUrl || undefined,
          },
          order_note: notes.description || notes.note || (notes.resourceName ? `Booking: ${notes.resourceName}` : 'Court Booking'),
          order_tags: {
            tenantId: tenantId ? String(tenantId) : '',
            type: notes.type || 'booking',
          },
        };

        const res = await this._request('/orders', {
          method: 'POST',
          body: orderPayload,
        }, credentials);

        if (res.ok && res.data?.payment_session_id) {
          paymentSessionId = res.data.payment_session_id;
          cfOrderId = String(res.data.cf_order_id || cfOrderId);
          orderStatus = res.data.order_status || 'ACTIVE';
          normalizedOrderId = res.data.order_id || normalizedOrderId;
        } else {
          const errMsg = res.data?.message || res.data?.error || 'Failed to create Cashfree order';
          console.error('[Cashfree Order Error]:', res.data);
          throw new ValidationError(`Cashfree Gateway Error: ${errMsg}`);
        }
      } catch (err) {
        if (err instanceof ValidationError) throw err;
        console.error('[Cashfree Network Error]:', err.message);
        throw new ValidationError(`Cashfree Gateway Connection Error: ${err.message}`);
      }
    }

    return {
      orderId: normalizedOrderId,
      cfOrderId,
      paymentSessionId,
      amount: orderAmount,
      currency,
      environment,
      orderStatus,
      customer: {
        id: customerId,
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
    };
  }

  /**
   * Retrieve order details from Cashfree
   */
  async getOrder(orderId, { branchId = null, tenantId = null } = {}) {
    const credentials = await this.resolveCredentials(branchId, tenantId);
    const res = await this._request(`/orders/${encodeURIComponent(orderId)}`, { method: 'GET' }, credentials);
    if (!res.ok) {
      const errMsg = res.data?.message || `Cashfree Order '${orderId}' not found`;
      throw new ValidationError(`Cashfree Order Error: ${errMsg}`);
    }
    return res.data;
  }

  /**
   * Retrieve payments associated with an order from Cashfree
   */
  async getOrderPayments(orderId, { branchId = null, tenantId = null } = {}) {
    const credentials = await this.resolveCredentials(branchId, tenantId);
    const res = await this._request(`/orders/${encodeURIComponent(orderId)}/payments`, { method: 'GET' }, credentials);
    if (!res.ok) {
      return [];
    }
    return Array.isArray(res.data) ? res.data : [];
  }

  /**
   * Verify Cashfree payment status for an order
   */
  async verifyPayment({
    orderId,
    cfPaymentId = null,
    branchId = null,
    tenantId = null,
  }) {
    if (!orderId) {
      throw new ValidationError('Cashfree Order ID (orderId) is required for verification');
    }

    const credentials = await this.resolveCredentials(branchId, tenantId);
    const { appId, secretKey } = credentials;
    const isLiveKey = appId && !appId.includes('mock') && secretKey && !secretKey.includes('mock');

    if (isLiveKey) {
      try {
        const orderData = await this.getOrder(orderId, { branchId, tenantId });
        const payments = await this.getOrderPayments(orderId, { branchId, tenantId });

        const successfulPayment = payments.find(p => p.payment_status === 'SUCCESS') || payments[0];
        const isPaid = orderData.order_status === 'PAID' || successfulPayment?.payment_status === 'SUCCESS';

        if (!isPaid) {
          throw new ValidationError(`Cashfree payment not confirmed. Order status: ${orderData.order_status}`);
        }

        const resolvedPaymentId = cfPaymentId || (successfulPayment?.cf_payment_id ? String(successfulPayment.cf_payment_id) : String(orderData.cf_order_id || orderId));
        const paymentMethod = successfulPayment?.payment_group || successfulPayment?.payment_method?.upi ? 'upi' : 'card';

        return {
          verified: true,
          orderId,
          cfOrderId: String(orderData.cf_order_id || orderId),
          paymentId: resolvedPaymentId,
          paymentMethod,
          paymentStatus: 'SUCCESS',
          amount: orderData.order_amount,
          currency: orderData.order_currency || 'INR',
          rawOrder: orderData,
          rawPayment: successfulPayment,
        };
      } catch (err) {
        if (err instanceof ValidationError) throw err;
        console.error('[Cashfree Verification Error]:', err.message);
        throw new ValidationError(`Cashfree Payment Verification Failed: ${err.message}`);
      }
    }

    // Mock / Offline Test Environment
    const resolvedPaymentId = cfPaymentId || `cf_pay_mock_${Date.now()}`;
    return {
      verified: true,
      orderId,
      cfOrderId: `cf_ord_mock_${Date.now()}`,
      paymentId: resolvedPaymentId,
      paymentMethod: 'upi',
      paymentStatus: 'SUCCESS',
    };
  }

  /**
   * Verify Cashfree Webhook Signature (v2023-08-01)
   * Signature is HMAC-SHA256 of (timestamp + rawBody) with secretKey, base64 encoded.
   */
  async verifyWebhookSignature({
    rawBody,
    timestamp,
    signature,
    branchId = null,
    tenantId = null,
  }) {
    if (!signature || !timestamp || !rawBody) {
      return false;
    }

    const { secretKey } = await this.resolveCredentials(branchId, tenantId);
    if (!secretKey || secretKey.includes('mock')) {
      return (env.isDev || env.isTest);
    }

    try {
      const payloadToSign = `${timestamp}${rawBody}`;
      const computedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(payloadToSign)
        .digest('base64');

      return computedSignature === signature;
    } catch (_) {
      return false;
    }
  }

  /**
   * Record transaction entry into formal Payment collection with gateway 'cashfree'
   */
  async recordPayment({
    tenantId,
    branchId,
    userId,
    amount,
    currency = 'INR',
    type = 'booking',
    referenceId = '',
    paymentMethod = 'upi',
    gatewayOrderId = '',
    gatewayPaymentId = '',
    status = 'success',
    notes = '',
    metadata = {},
  }) {
    if (!tenantId || !userId) {
      return null;
    }

    if (gatewayPaymentId) {
      const existing = await Payment.findOne({ gatewayPaymentId });
      if (existing) {
        existing.status = status;
        if (amount) existing.amount = amount;
        await existing.save();
        return existing;
      }
    }

    return await Payment.create({
      tenantId,
      branchId,
      userId,
      amount,
      currency,
      type,
      referenceId,
      paymentMethod,
      gateway: 'cashfree',
      gatewayOrderId,
      gatewayPaymentId: gatewayPaymentId || `CF_TXN_${Date.now()}`,
      status,
      notes,
      metadata,
    });
  }
}

export const cashfreeService = new CashfreeService();
