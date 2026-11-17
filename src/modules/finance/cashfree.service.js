import crypto from 'node:crypto';
import { Branch } from '../branches/branch.model.js';
import { Payment } from './payment.model.js';
import { WebhookLog } from './webhook-log.model.js';
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
          const isProd = ['PROD', 'PRODUCTION', 'LIVE'].includes(String(environment).toUpperCase()) ||
            secretKey.startsWith('cfsk_ma_prod_');
          const baseUrl = isProd
            ? 'https://api.cashfree.com/pg'
            : 'https://sandbox.cashfree.com/pg';
          const normalizedEnv = isProd ? 'PRODUCTION' : 'TEST';
          return { appId, secretKey, apiVersion, environment: normalizedEnv, baseUrl };
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

    if (!appId || !secretKey || appId.includes('mock') || secretKey.includes('mock')) {
      try {
        const { tenantRepository } = await import('../tenants/tenant.repository.js');
        const activeTenant = await tenantRepository.model.findOne({ status: 'active' }).lean();
        if (activeTenant) {
          const tenantSettings = await settingsService.getSettings(activeTenant._id);
          const tenantCf = tenantSettings?.paymentGateways?.cashfree || tenantSettings?.paymentSettings?.cashfree;
          if (tenantCf?.appId) {
            appId = tenantCf.appId.trim();
            secretKey = (tenantCf.secretKey || secretKey).trim();
            apiVersion = (tenantCf.apiVersion || apiVersion).trim();
            environment = (tenantCf.environment || environment).trim();
          }
        }
      } catch (_) {}
    }

    const isProd = ['PROD', 'PRODUCTION', 'LIVE'].includes(String(environment).toUpperCase()) ||
      secretKey.startsWith('cfsk_ma_prod_');
    const baseUrl = isProd
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
    const normalizedEnv = isProd ? 'PRODUCTION' : 'TEST';

    return { appId, secretKey, apiVersion, environment: normalizedEnv, baseUrl };
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
    orderExpiryMinutes = 17,
    bookingIntent = null,
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

    const safeExpiryMins = Math.max(16, Number(orderExpiryMinutes) || 17);
    const orderExpiryIso = new Date(Date.now() + safeExpiryMins * 60 * 1000).toISOString();

    if (isLiveKey) {
      try {
        const orderPayload = {
          order_id: normalizedOrderId,
          order_amount: orderAmount,
          order_currency: currency,
          order_expiry_time: orderExpiryIso,
          customer_details: {
            customer_id: customerId,
            customer_phone: customerPhone,
            customer_name: customerName,
            customer_email: customerEmail,
          },
          order_meta: {
            return_url: returnUrl || undefined,
            notify_url: notifyUrl || env.CASHFREE_WEBHOOK_URL || 'https://amdplayapi.amdtechno.in/api/v1/finance/webhook/cashfree',
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

    // Record initial order initiation in WebhookLog so admin panel tracks every initiated / cancelled / abandoned checkout
    try {
      let resolvedTenantId = tenantId || null;
      if (!resolvedTenantId) {
        const { tenantRepository } = await import('../tenants/tenant.repository.js');
        const defaultTenant = await tenantRepository.model.findOne({ status: 'active' }).select('_id').lean();
        if (defaultTenant) resolvedTenantId = defaultTenant._id;
      }

      await WebhookLog.create({
        tenantId: resolvedTenantId,
        branchId: branchId || null,
        gateway: 'cashfree',
        eventType: 'ORDER_CREATED',
        gatewayOrderId: normalizedOrderId,
        gatewayPaymentId: '',
        amount: orderAmount,
        currency: String(currency || 'INR').toUpperCase(),
        paymentMethod: '',
        status: 'pending',
        signatureValid: true,
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
        bookingIntent: bookingIntent || null,
        payload: {
          type: 'ORDER_CREATED',
          event_time: new Date().toISOString(),
          data: {
            order: {
              order_id: normalizedOrderId,
              cf_order_id: cfOrderId,
              order_amount: orderAmount,
              order_currency: currency,
              order_status: orderStatus,
              order_expiry_time: orderExpiryIso,
            },
            customer_details: {
              customer_id: customerId,
              customer_name: customerName,
              customer_email: customerEmail,
              customer_phone: customerPhone,
            },
            notes,
          },
        },
        receivedAt: new Date(),
      });
    } catch (logErr) {
      console.error('[Cashfree Order Log Warning]:', logErr.message);
    }

    const isProduction = environment === 'PRODUCTION' || environment === 'PROD';

    return {
      orderId: normalizedOrderId,
      cfOrderId,
      paymentSessionId,
      amount: orderAmount,
      currency,
      orderExpiryTime: orderExpiryIso,
      environment,
      mode: isProduction ? 'production' : 'sandbox',
      env: environment,
      cfEnvironment: isProduction ? 'PRODUCTION' : 'SANDBOX',
      isProduction,
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
   * Initiate a full or partial refund on Cashfree PG API (used for auto-refunding double-booking conflicts)
   * Reference: https://www.cashfree.com/docs/api-reference/payments/latest/refunds/create
   */
  async initiateRefund({
    orderId,
    amount,
    refundId = null,
    reason = 'Slot no longer available — automatic full refund',
    branchId = null,
    tenantId = null,
  }) {
    if (!orderId || !amount || Number(amount) <= 0) {
      throw new ValidationError('orderId and positive refund amount are required');
    }

    const credentials = await this.resolveCredentials(branchId, tenantId);
    const { appId, secretKey } = credentials;
    const isLiveKey = appId && !appId.includes('mock') && secretKey && !secretKey.includes('mock');

    const safeRefundId = (refundId || `rf_${orderId}_${Date.now()}`)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);

    if (!isLiveKey) {
      return {
        refunded: true,
        mock: true,
        refundId: safeRefundId,
        cfRefundId: `cf_rf_mock_${Date.now()}`,
        refundStatus: 'PENDING',
        refundAmount: Number(Number(amount).toFixed(2)),
      };
    }

    const res = await this._request(
      `/orders/${encodeURIComponent(orderId)}/refunds`,
      {
        method: 'POST',
        body: {
          refund_amount: Number(Number(amount).toFixed(2)),
          refund_id: safeRefundId,
          refund_note: String(reason || 'Automatic conflict refund').slice(0, 100),
          refund_speed: 'STANDARD',
        },
      },
      credentials
    );

    if (!res.ok) {
      const errMsg = res.data?.message || res.data?.error || 'Cashfree refund request failed';
      console.error('[Cashfree Refund Error]:', res.data);
      throw new ValidationError(`Cashfree Refund Error: ${errMsg}`);
    }

    return {
      refunded: true,
      refundId: res.data?.refund_id || safeRefundId,
      cfRefundId: String(res.data?.cf_refund_id || ''),
      refundStatus: res.data?.refund_status || 'PENDING',
      refundAmount: res.data?.refund_amount || Number(Number(amount).toFixed(2)),
      raw: res.data,
    };
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
          cfPaymentId: resolvedPaymentId,
          bankReference: successfulPayment?.bank_reference || '',
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
    // 1. Allow dashboard test events immediately
    try {
      const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
      if (parsed?.type === 'TEST_WEBHOOK' || parsed?.event === 'TEST_WEBHOOK') {
        return true;
      }
    } catch (_) {}

    if (!signature || !timestamp || !rawBody) {
      return (env.isDev || env.isTest);
    }

    const secretKeysToTry = [];
    if (tenantId) {
      const { secretKey } = await this.resolveCredentials(branchId, tenantId);
      if (secretKey && !secretKey.includes('mock')) {
        secretKeysToTry.push(secretKey.trim());
      }
    }

    if (env.CASHFREE_SECRET_KEY && !env.CASHFREE_SECRET_KEY.includes('mock')) {
      secretKeysToTry.push(env.CASHFREE_SECRET_KEY.trim());
    }

    // Also look up all configured tenant Cashfree secret keys across multi-tenant database
    try {
      const { tenantRepository } = await import('../tenants/tenant.repository.js');
      const { settingsService } = await import('../settings/settings.service.js');
      const tenants = await tenantRepository.model.find({});
      for (const t of tenants) {
        const s = await settingsService.getSettings(t._id);
        const cfKey = s?.paymentGateways?.cashfree?.secretKey;
        if (cfKey && !cfKey.includes('mock') && !secretKeysToTry.includes(cfKey.trim())) {
          secretKeysToTry.push(cfKey.trim());
        }
      }
    } catch (_) {}

    if (secretKeysToTry.length === 0) {
      return (env.isDev || env.isTest);
    }

    const payloadToSign = `${timestamp}${rawBody}`;
    for (const key of secretKeysToTry) {
      try {
        const computedSignature = crypto
          .createHmac('sha256', key)
          .update(payloadToSign)
          .digest('base64');
        if (computedSignature === signature) {
          return true;
        }
      } catch (_) {}
    }

    return false;
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

    if (gatewayPaymentId || gatewayOrderId) {
      const orClauses = [];
      if (gatewayPaymentId) orClauses.push({ gatewayPaymentId });
      if (gatewayOrderId) orClauses.push({ gatewayOrderId });
      const existing = await Payment.findOne({ $or: orClauses });
      if (existing) {
        existing.status = status;
        if (amount) existing.amount = amount;
        if (gatewayPaymentId) existing.gatewayPaymentId = gatewayPaymentId;
        if (notes) existing.notes = notes;
        if (metadata && Object.keys(metadata).length) {
          existing.metadata = { ...(existing.metadata || {}), ...metadata };
        }
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

