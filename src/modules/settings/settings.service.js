import { Tenant } from '../tenants/tenant.model.js';
import { wabridgeService } from '../notifications/wabridge.service.js';
import { env } from '../../config/env.js';
import { NotFoundError, ValidationError } from '../../errors/AppError.js';

export class SettingsService {
  /**
   * Default fallback settings if none configured
   */
  getDefaultSettings() {
    return {
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      taxPercentage: 18,
      cancellationCutoffHours: 12,
      openingTime: '00:00',
      closingTime: '24:00',
      is24Hours: true,
      holdTtlMinutes: 5,
      doorBufferMinutes: 15,
      paymentGateways: {
        activeGateway: 'razorpay',
        razorpay: {
          enabled: true,
          keyId: env.RAZORPAY_KEY_ID || '',
          keySecret: env.RAZORPAY_KEY_SECRET || '',
          webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '',
          accountNumber: '',
        },
        stripe: {
          enabled: false,
          publishableKey: '',
          secretKey: '',
          webhookSecret: '',
        },
        phonepe: {
          enabled: false,
          merchantId: '',
          saltKey: '',
          saltIndex: 1,
          env: 'UAT',
        },
        customUpi: {
          enabled: true,
          vpa: '',
          merchantName: '',
        },
        cash: {
          enabled: true,
          allowCounterPay: true,
        },
      },
      readers: [
        {
          id: 'reader_badminton_01',
          name: 'Badminton ACS Terminal',
          deviceModel: 'Hikvision DS-K1T671MF (Face & Card)',
          ip: '192.168.1.155',
          port: 80,
          username: 'admin',
          password: '1234567a',
          protocol: 'http',
          doorNo: 1,
          assignedSports: ['badminton'],
          status: 'online',
        },
        {
          id: 'reader_turf_01',
          name: 'Turf & Outdoor Arena Turnstile',
          deviceModel: 'Hikvision DS-K1T341AMF / QR Gate',
          ip: '192.168.1.160',
          port: 80,
          username: 'admin',
          password: '1234567a',
          protocol: 'http',
          doorNo: 1,
          assignedSports: ['cricket', 'football', 'turf'],
          status: 'online',
        },
      ],
      whatsapp: {
        provider: 'wabridge',
        enabled: true,
        appKey: '57a4fda2-5c5f-4b74-9b10-9549dbc99b26',
        authKey: 'd8f1db9d6df2e6c4083d94e26e7292183b0e8a9b0eddaa6b82',
        deviceId: '66338c43c358a3c31dc4c3e3',
        templates: {
          bookingConfirmation: { templateId: 'booking_access_pass', enabled: true },
          studentRegistration: { templateId: 'student_welcome_biometric', enabled: true },
          memberRegistration: { templateId: 'member_registration_card', enabled: true },
          attendanceCheckIn: { templateId: 'student_attendance_alert', enabled: true },
          attendanceCheckOut: { templateId: 'student_attendance_alert', enabled: true },
        },
      },
    };
  }

  /**
   * Get settings for a tenant
   */
  async getSettings(tenantId) {
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant academy not found');
    }

    const defaults = this.getDefaultSettings();
    const current = tenant.settings || {};

    return {
      ...defaults,
      ...current,
      paymentGateways: {
        ...defaults.paymentGateways,
        ...(current.paymentGateways || {}),
        razorpay: {
          ...defaults.paymentGateways.razorpay,
          ...(current.paymentGateways?.razorpay || {}),
        },
        stripe: {
          ...defaults.paymentGateways.stripe,
          ...(current.paymentGateways?.stripe || {}),
        },
        phonepe: {
          ...defaults.paymentGateways.phonepe,
          ...(current.paymentGateways?.phonepe || {}),
        },
        customUpi: {
          ...defaults.paymentGateways.customUpi,
          ...(current.paymentGateways?.customUpi || {}),
        },
        cash: {
          ...defaults.paymentGateways.cash,
          ...(current.paymentGateways?.cash || {}),
        },
      },
      readers: Array.isArray(current.readers) && current.readers.length > 0 ? current.readers : defaults.readers,
      whatsapp: {
        ...defaults.whatsapp,
        ...(current.whatsapp || {}),
        templates: {
          ...defaults.whatsapp.templates,
          ...(current.whatsapp?.templates || {}),
        },
      },
    };
  }

  /**
   * Update settings for a tenant
   */
  async updateSettings(tenantId, updateData) {
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant academy not found');
    }

    const existingSettings = await this.getSettings(tenantId);

    const mergedGateways = updateData.paymentGateways
      ? {
          ...existingSettings.paymentGateways,
          ...updateData.paymentGateways,
          razorpay: {
            ...existingSettings.paymentGateways.razorpay,
            ...(updateData.paymentGateways.razorpay || {}),
            // Preserve existing secret if not supplied or empty
            keySecret:
              updateData.paymentGateways.razorpay?.keySecret?.trim() ||
              existingSettings.paymentGateways.razorpay.keySecret,
          },
          stripe: {
            ...existingSettings.paymentGateways.stripe,
            ...(updateData.paymentGateways.stripe || {}),
            secretKey:
              updateData.paymentGateways.stripe?.secretKey?.trim() ||
              existingSettings.paymentGateways.stripe.secretKey,
          },
          phonepe: {
            ...existingSettings.paymentGateways.phonepe,
            ...(updateData.paymentGateways.phonepe || {}),
            saltKey:
              updateData.paymentGateways.phonepe?.saltKey?.trim() ||
              existingSettings.paymentGateways.phonepe.saltKey,
          },
          customUpi: {
            ...existingSettings.paymentGateways.customUpi,
            ...(updateData.paymentGateways.customUpi || {}),
          },
          cash: {
            ...existingSettings.paymentGateways.cash,
            ...(updateData.paymentGateways.cash || {}),
          },
        }
      : existingSettings.paymentGateways;

    const mergedSettings = {
      ...existingSettings,
      ...updateData,
      paymentGateways: mergedGateways,
      readers: updateData.readers || existingSettings.readers,
      whatsapp: {
        ...existingSettings.whatsapp,
        ...(updateData.whatsapp || {}),
        templates: {
          ...existingSettings.whatsapp?.templates,
          ...(updateData.whatsapp?.templates || {}),
        },
      },
    };

    tenant.settings = mergedSettings;
    tenant.markModified('settings');
    await tenant.save();

    return mergedSettings;
  }

  /**
   * Test payment gateway credentials connectivity
   */
  async testPaymentGateway(tenantId, { gateway = 'razorpay', credentials = {} }) {
    const settings = await this.getSettings(tenantId);
    const targetGateway = gateway.toLowerCase();

    if (targetGateway === 'razorpay') {
      const keyId = credentials.keyId || settings.paymentGateways?.razorpay?.keyId;
      const keySecret = credentials.keySecret || settings.paymentGateways?.razorpay?.keySecret;

      if (!keyId || !keySecret) {
        throw new ValidationError('Razorpay Key ID and Key Secret are required for testing');
      }

      if (keyId.includes('mock') || keySecret.includes('mock')) {
        return {
          success: true,
          mode: 'mock/sandbox',
          message: 'Razorpay Sandbox / Mock credentials configured successfully',
          keyId,
        };
      }

      try {
        const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const res = await fetch('https://api.razorpay.com/v1/payments?count=1', {
          headers: { Authorization: authHeader },
        });
        const data = await res.json();

        if (res.ok) {
          return {
            success: true,
            mode: keyId.startsWith('rzp_live') ? 'production' : 'test',
            message: `Razorpay credentials verified successfully (${keyId.startsWith('rzp_live') ? 'LIVE Mode' : 'TEST Mode'})`,
            keyId,
          };
        } else {
          throw new Error(data.error?.description || 'Invalid Razorpay credentials');
        }
      } catch (err) {
        throw new ValidationError(`Razorpay connection failed: ${err.message}`);
      }
    } else if (targetGateway === 'stripe') {
      const secretKey = credentials.secretKey || settings.paymentGateways?.stripe?.secretKey;
      if (!secretKey) {
        throw new ValidationError('Stripe Secret Key is required for testing');
      }
      try {
        const res = await fetch('https://api.stripe.com/v1/balance', {
          headers: { Authorization: `Bearer ${secretKey}` },
        });
        const data = await res.json();
        if (res.ok) {
          return {
            success: true,
            message: 'Stripe API keys verified successfully',
          };
        } else {
          throw new Error(data.error?.message || 'Invalid Stripe secret key');
        }
      } catch (err) {
        throw new ValidationError(`Stripe connection failed: ${err.message}`);
      }
    } else {
      return {
        success: true,
        message: `${gateway} configured successfully`,
      };
    }
  }

  /**
   * Resolve hardware reader assigned to a specific sport
   */
  async getReaderForSport(tenantId, sportSlugOrName) {
    const settings = await this.getSettings(tenantId);
    const target = String(sportSlugOrName || '').toLowerCase().trim();

    const readers = settings.readers || [];
    // Match sport in assignedSports list
    const matchedReader = readers.find((r) =>
      (r.assignedSports || []).some((s) => String(s).toLowerCase().trim() === target || target.includes(String(s).toLowerCase()))
    );

    if (matchedReader) {
      return matchedReader;
    }

    // Default fallback based on sport type
    if (target.includes('cricket') || target.includes('football') || target.includes('turf')) {
      return readers.find((r) => r.id === 'reader_turf_01') || readers[1] || readers[0];
    }

    return readers.find((r) => r.id === 'reader_badminton_01') || readers[0];
  }

  /**
   * Send a test WhatsApp message via WABridge
   */
  async testWhatsAppMessage(tenantId, { destinationNumber, message }) {
    const settings = await this.getSettings(tenantId);
    const wa = settings.whatsapp || {};

    const credentials = {
      appKey: wa.appKey,
      authKey: wa.authKey,
      deviceId: wa.deviceId,
    };

    const text = message || '🎾 Apex Sports Academy: Test WhatsApp message from WABridge gateway!';
    return await wabridgeService.sendTextMessage({
      destinationNumber,
      message: text,
      credentials,
    });
  }

  /**
   * Fetch approved WABridge templates
   */
  async getWhatsAppTemplates(tenantId) {
    const settings = await this.getSettings(tenantId);
    const wa = settings.whatsapp || {};

    const credentials = {
      appKey: wa.appKey,
      authKey: wa.authKey,
      deviceId: wa.deviceId,
    };

    return await wabridgeService.getTemplates(credentials);
  }
}

export const settingsService = new SettingsService();
