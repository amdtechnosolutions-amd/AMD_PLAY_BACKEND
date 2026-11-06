import fs from 'node:fs';
import { automatedAttendanceService } from './automated-attendance.service.js';
import { hikvisionService } from '../iot/hikvision.service.js';

export class AutomatedAttendanceController {
  async getStatus(request, reply) {
    const status = await automatedAttendanceService.getTerminalStatus(request.user);
    return reply.send({
      success: true,
      data: status,
    });
  }

  async syncAttendance(request, reply) {
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];
    const branchId = request.query?.branchId || null;
    const result = await automatedAttendanceService.syncTerminalAttendance(tenantId, branchId);
    return reply.send({
      success: true,
      message: `Successfully synchronized ${result.syncedCount} biometric events from terminal`,
      data: result,
    });
  }

  async pushRoster(request, reply) {
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];
    const { batchId } = request.body || {};
    const result = await automatedAttendanceService.pushRosterToTerminal(tenantId, batchId);
    return reply.send({
      success: true,
      data: result,
    });
  }

  async uploadStudent(request, reply) {
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];
    const { studentId } = request.body || {};
    const result = await automatedAttendanceService.uploadStudentToTerminal(tenantId, studentId);
    return reply.send({
      success: true,
      message: result.message,
      data: result,
    });
  }

  async simulatePunch(request, reply) {
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];
    const { studentId, verificationMode, cardNo } = request.body || {};

    const result = await automatedAttendanceService.recordBiometricPunch({
      tenantId,
      studentId,
      verificationMode: verificationMode || 'face',
      cardNo,
      punchTime: new Date(),
    });

    return reply.send({
      success: true,
      message: `Biometric ${verificationMode || 'face'} punch recorded for student`,
      data: result,
    });
  }

  async getLogs(request, reply) {
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];
    const limit = Number(request.query?.limit) || 20;
    const logs = await automatedAttendanceService.getPunchLogs(tenantId, limit);
    return reply.send({
      success: true,
      data: logs,
    });
  }

  async getRawLogs(request, reply) {
    const limit = Math.min(Number(request.query?.limit) || 50, 200);
    const logFilePath = 'logs/hikvision_events.log';
    if (!fs.existsSync(logFilePath)) {
      return reply.send({ success: true, count: 0, logs: [] });
    }

    try {
      const content = fs.readFileSync(logFilePath, 'utf8');
      const entries = content.split('-----------------------------------').filter((e) => e.trim().length > 0);
      const recent = entries.slice(-limit).reverse().map((e) => e.trim());
      return reply.send({
        success: true,
        count: recent.length,
        logs: recent,
      });
    } catch (err) {
      return reply.status(500).send({ success: false, message: 'Failed to read raw logs', error: err.message });
    }
  }

  async handleWebhook(request, reply) {
    const clientIp = request.ip || request.socket?.remoteAddress;
    const rawString = typeof request.body === 'string' ? request.body : JSON.stringify(request.body, null, 2);

    let body = request.body || {};

    // If body is XML string, JSON string, or multipart text, convert to object
    if (typeof body === 'string') {
      const trimmed = body.trim();

      // 1. Direct JSON check
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          body = JSON.parse(trimmed);
        } catch {}
      }

      // 2. Multipart extraction: extract JSON part between MIME boundaries
      if (typeof body === 'string' && trimmed.includes('--')) {
        const jsonPartMatch = trimmed.match(/Content-Type:\s*application\/json[\r\n]+([\s\S]*?)(\r?\n--|$)/i);
        if (jsonPartMatch && jsonPartMatch[1]) {
          try {
            body = JSON.parse(jsonPartMatch[1].trim());
          } catch {}
        }
      }

      // 3. Fallback regex for first balanced or greedy JSON block
      if (typeof body === 'string') {
        const jsonMatch = trimmed.match(/\{[\s\S]*?\}(?=\s*(\r?\n--|$))/);
        if (jsonMatch) {
          try {
            body = JSON.parse(jsonMatch[0].trim());
          } catch {}
        }
      }

      // 4. XML Parsing
      if (typeof body === 'string' && trimmed.includes('<')) {
        const xmlObj = {};
        const matches = trimmed.matchAll(/<([a-zA-Z0-9_-]+)>([^<]*)<\/\1>/g);
        for (const match of matches) {
          xmlObj[match[1]] = match[2];
        }
        if (Object.keys(xmlObj).length > 0) {
          body = xmlObj;
        }
      }
    }

    const isHb =
      body?.eventType === 'heartBeat' ||
      body?.eventDescription === 'heartBeat' ||
      body?.AccessControllerEvent?.eventType === 'heartBeat';

    if (isHb) {
      const devIp = body?.ipAddress || body?.AccessControllerEvent?.ipAddress || clientIp;
      console.log(`❤️ [HIKVISION HEARTBEAT RAW] [${new Date().toLocaleTimeString()}] IP: ${devIp} | URL: ${request.url} | Raw: ${JSON.stringify(body)}`);
    } else {
      // Helper to display raw wire payload without dumping huge image binary
      let printableRaw = rawString;
      if (printableRaw.length > 8000) {
        const imgMatch = printableRaw.match(/(Content-Type:\s*image\/jpeg[\r\n]+)([\s\S]*?)(\r?\n--|$)/i);
        if (imgMatch) {
          const binaryLen = imgMatch[2].length;
          printableRaw = printableRaw.replace(imgMatch[0], `${imgMatch[1]}[Binary JPEG Image Data: ${binaryLen} bytes]\n${imgMatch[3]}`);
        } else {
          printableRaw = printableRaw.slice(0, 8000) + `\n... [Truncated ${printableRaw.length - 8000} additional bytes]`;
        }
      }

      console.log(`\n================================================================================`);
      console.log(`🔔 [HIKVISION INCOMING RAW EVENT] Device Transmission Detected!`);
      console.log(`   Timestamp: ${new Date().toLocaleString()}`);
      console.log(`   URL Path: ${request.url}`);
      console.log(`   Client Device IP: ${clientIp}`);
      console.log(`   Content-Type: ${request.headers['content-type'] || 'N/A'}`);
      console.log(`--------------------------------------------------------------------------------`);
      console.log(`📄 [RAW DEVICE PAYLOAD]:\n${printableRaw}`);
      console.log(`--------------------------------------------------------------------------------`);
      console.log(`📦 [PARSED JSON OBJECT]:\n${JSON.stringify(body, null, 2)}`);
      console.log(`================================================================================\n`);

      // Append to file logs for audit and persistent analysis
      try {
        const logEntry = `[${new Date().toISOString()}] Path: ${request.url} | IP: ${clientIp}\n${printableRaw}\n-----------------------------------\n`;
        fs.appendFileSync('logs/hikvision_events.log', logEntry);
        fs.appendFileSync('logs/hikvision_raw.log', logEntry);
      } catch (logErr) {
        console.error('Error writing hikvision log:', logErr.message);
      }
    }

    const tenantIdentifier =
      request.params?.tenantId ||
      request.headers['x-tenant-id'] ||
      request.query?.tenantId ||
      request.query?.tenantSlug ||
      request.query?.tenant;

    const branchIdentifier =
      request.params?.branchId ||
      request.headers['x-branch-id'] ||
      request.query?.branchId ||
      request.query?.branchCode ||
      request.query?.branch;

    const deviceIdentifier =
      request.params?.deviceCode ||
      request.headers['x-device-code'] ||
      request.query?.deviceCode ||
      request.query?.device;

    const sportIdentifier =
      request.params?.sportSlug ||
      request.headers['x-sport-slug'] ||
      request.query?.sportSlug ||
      request.query?.sport;

    const multiParam = request.params?.branchOrSportOrDevice || request.params?.sportOrDevice;
    const hostHeader = request.headers['host'];

    const result = await automatedAttendanceService.handleWebhook(body, {
      tenantIdentifier,
      branchIdentifier,
      deviceIdentifier,
      sportIdentifier,
      multiParam,
      clientIp,
      hostHeader,
    });
    return reply.code(200).send({
      statusCode: 1,
      statusString: 'OK',
      data: result,
    });
  }

  async configureWebhook(request, reply) {
    const { hostUrl, ipAddress, portNo } = request.body || {};
    const result = await hikvisionService.configureHttpHostNotification({
      hostUrl,
      ipAddress,
      portNo,
    });
    return reply.send({
      success: true,
      message: 'Hikvision HTTP notification host configured',
      data: result,
    });
  }
}

export const automatedAttendanceController = new AutomatedAttendanceController();
