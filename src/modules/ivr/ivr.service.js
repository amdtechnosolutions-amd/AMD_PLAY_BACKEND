import { IvrLog } from './ivr-log.model.js';
import { Enquiry } from '../enquiries/enquiry.model.js';
import { User } from '../users/user.model.js';

export class IvrService {
  async handleIncomingWebhook(payload = {}) {
    const callerPhone = payload.phone || payload.caller || payload.From || payload.mobile || 'Unknown';
    const callSid = payload.callSid || payload.CallSid || `${Date.now()}`;
    const duration = parseInt(payload.duration || payload.CallDuration || 0, 10);
    const dtmf = payload.dtmf || payload.Digits || '';
    const recording = payload.recordingUrl || payload.RecordingUrl || '';

    // Check if caller is existing user/student
    const existingUser = await User.findOne({ phone: callerPhone });
    const tenantId = existingUser?.tenantId || null;

    const log = await IvrLog.create({
      tenantId,
      callerPhone,
      callSid,
      callStatus: payload.status || 'completed',
      callDurationSeconds: duration,
      dtmfSelection: dtmf,
      recordingUrl: recording,
      provider: payload.provider || 'custom',
      payload,
    });

    // Auto-create Enquiry CRM lead if caller is not an existing student
    if (!existingUser && callerPhone !== 'Unknown') {
      try {
        await Enquiry.create({
          tenantId: tenantId,
          branchId: null,
          name: `Inbound Call (${callerPhone})`,
          phone: callerPhone,
          interest: 'General',
          message: `Inbound call received via IVR system (Duration: ${duration}s, DTMF: ${dtmf || 'None'})`,
          source: 'IVR / Phone Call',
          status: 'Pending',
        });
      } catch (_) {}
    }

    return {
      success: true,
      message: 'IVR webhook processed successfully',
      logId: log._id,
    };
  }

  async listLogs(query = {}, pagination = {}, context = {}) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (context.tenantId) filter.tenantId = context.tenantId;
    if (query.phone) filter.callerPhone = new RegExp(query.phone, 'i');

    const [items, total] = await Promise.all([
      IvrLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      IvrLog.countDocuments(filter),
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

export const ivrService = new IvrService();
