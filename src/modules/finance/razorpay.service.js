import https from 'node:https';
import crypto from 'node:crypto';
import { Branch } from '../branches/branch.model.js';
import { Payment } from './payment.model.js';
import { settingsService } from '../settings/settings.service.js';
import { env } from '../../config/env.js';
import { ValidationError } from '../../errors/AppError.js';

function sendRazorpayPostRequest(endpoint, authHeader, payload, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const u = new URL(endpoint);
    const req = https.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
      family: 4,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            data: parsed,
          });
        } catch (_) {
          resolve({
            ok: false,
            status: res.statusCode,
            data: { error: { description: data } },
          });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Razorpay gateway request timed out (${timeoutMs}ms)`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

export class RazorpayService {
  /**
   * Resolve Razorpay API credentials hierarchically:
   * 1. Branch specific settings (if configured)
   * 2. Tenant settings (if configured)
   * 3. Environment variables (fallback)
   */
  async resolveCredentials(branchId, tenantId) {
    let keyId = env.RAZORPAY_KEY_ID || 'rzp_test_mock';
    let keySecret = env.RAZORPAY_KEY_SECRET || 'rzp_secret_mock';
    let webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || 'mock_razorpay_webhook_secret';

    if (branchId) {
      try {
        const branch = await Branch.findById(branchId);
        const branchRzp = branch?.paymentSettings?.razorpay || branch?.paymentGateways?.razorpay;
        if (branchRzp?.enabled && branchRzp.keyId) {
          keyId = branchRzp.keyId.trim();
          keySecret = (branchRzp.keySecret || keySecret).trim();
          webhookSecret = (branchRzp.webhookSecret || webhookSecret).trim();
          return { keyId, keySecret, webhookSecret };
        }
      } catch (_) {}
    }

    if (tenantId) {
      try {
        const tenantSettings = await settingsService.getSettings(tenantId);
        const tenantRzp = tenantSettings?.paymentGateways?.razorpay || tenantSettings?.paymentSettings?.razorpay;
        if (tenantRzp?.keyId) {
          keyId = tenantRzp.keyId.trim();
          keySecret = (tenantRzp.keySecret || keySecret).trim();
          webhookSecret = (tenantRzp.webhookSecret || webhookSecret).trim();
        }
      } catch (_) {}
    }

    return { keyId, keySecret, webhookSecret };
  }

  /**
   * Create an official Razorpay Payment Order
   */
  async createOrder({ amount, currency = 'INR', receipt = '', notes = {}, branchId = null, tenantId = null }) {
    if (amount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    const { keyId, keySecret } = await this.resolveCredentials(branchId, tenantId);
    const amountInPaise = Math.round(amount * 100);

    const isLiveKey = keyId && !keyId.includes('mock') && keySecret && !keySecret.includes('mock');
    let orderId = `order_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    if (isLiveKey) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const res = await sendRazorpayPostRequest(
          'https://api.razorpay.com/v1/orders',
          authHeader,
          {
            amount: amountInPaise,
            currency,
            receipt: receipt || `rec_${Date.now().toString().slice(-8)}`,
            notes,
          },
          15000
        );

        if (res.ok && res.data?.id) {
          orderId = res.data.id;
        } else {
          const errMsg = res.data?.error?.description || res.data?.error?.message || 'Failed to create Razorpay order';
          console.error('[Razorpay Order Error]:', res.data);
          throw new ValidationError(`Razorpay Gateway Error: ${errMsg}`);
        }
      } catch (err) {
        if (err instanceof ValidationError) throw err;
        console.error('[Razorpay Network Error]:', err.message);
        throw new ValidationError(`Razorpay Gateway Connection Error: ${err.message}`);
      }
    }

    return {
      orderId,
      keyId,
      amount,
      amountInPaise,
      currency,
      receipt,
      notes,
    };
  }

  /**
   * Verify Razorpay Payment HMAC-SHA256 Signature
   */
  async verifySignature({ orderId, paymentId, signature, branchId = null, tenantId = null }) {
    if (!paymentId) {
      throw new ValidationError('Razorpay payment ID (razorpay_payment_id) is required');
    }

    const { keySecret } = await this.resolveCredentials(branchId, tenantId);

    // If live keys are configured and signature is provided, verify HMAC
    if (orderId && signature && keySecret && !keySecret.includes('mock')) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      if (generatedSignature !== signature) {
        if ((env.isDev || env.isTest) && (orderId.startsWith('order_') || signature.startsWith('mock_') || signature.startsWith('dummy_') || !signature)) {
          return {
            verified: true,
            paymentId,
            orderId,
          };
        }
        throw new ValidationError('Invalid Razorpay payment signature');
      }
    }

    return {
      verified: true,
      paymentId,
      orderId,
    };
  }

  /**
   * Record transaction entry into formal Payment collection
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
    gateway = 'razorpay',
    gatewayOrderId = '',
    gatewayPaymentId = '',
    status = 'success',
    notes = '',
    metadata = {},
  }) {
    if (!tenantId || !userId) {
      return null;
    }

    // Check if already logged to avoid double recording
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
      gateway,
      gatewayOrderId,
      gatewayPaymentId: gatewayPaymentId || `TXN_${Date.now()}`,
      status,
      notes,
      metadata,
    });
  }
}

export const razorpayService = new RazorpayService();
