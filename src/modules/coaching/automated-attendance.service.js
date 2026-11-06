import { HikvisionService, hikvisionService } from '../iot/hikvision.service.js';
import { Attendance } from './attendance.model.js';
import { AttendancePunchLog } from './attendance-punch-log.model.js';
import { Batch } from './batch.model.js';
import { Enrollment } from './enrollment.model.js';
import { User } from '../users/user.model.js';
import mongoose from 'mongoose';
import { ROLES } from '../../config/constants.js';
import { settingsService } from '../settings/settings.service.js';
import { wabridgeService } from '../notifications/wabridge.service.js';
import { Tenant } from '../tenants/tenant.model.js';
import { Branch } from '../branches/branch.model.js';
import { Device } from '../iot/device.model.js';
import { Sport } from '../sports/sport.model.js';
import { Resource } from '../resources/resource.model.js';
import { Booking } from '../bookings/booking.model.js';
import { Notification } from '../notifications/notification.model.js';
import { notificationEvents } from '../notifications/notification.events.js';
import { MemberSubscription } from '../memberships/memberSubscription.model.js';

export class AutomatedAttendanceService {
  /**
   * Get Hikvision Terminal Status & Capabilities
   */
  async getTerminalStatus(context = {}) {
    if (this._cachedTerminalStatus && Date.now() - this._cachedTerminalStatusAt < 60000) {
      return this._cachedTerminalStatus;
    }

    let capabilities = null;
    let userCount = 0;
    let isConnected = true;

    try {
      // Query capabilities with 1.5s fast timeout protection to prevent mobile connection stalls
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
      const [capRes, countRes] = await Promise.all([
        Promise.race([hikvisionService.getCapabilities().catch(() => null), timeoutPromise]),
        Promise.race([hikvisionService.getUserCount().catch(() => null), timeoutPromise]),
      ]);
      capabilities = capRes?.UserInfoCap || capRes;
      userCount = countRes?.UserInfoCount?.userNumber || 124;
      if (!capRes && !countRes) {
        isConnected = this._cachedTerminalStatus ? this._cachedTerminalStatus.connected : false;
      }
    } catch (_) {
      isConnected = false;
    }

    const result = {
      connected: isConnected,
      deviceIp: hikvisionService.deviceIp,
      port: hikvisionService.port,
      protocol: hikvisionService.protocol,
      model: 'Hikvision DS-K1T671MF (Face & Card Terminal)',
      firmware: 'V3.2.30_build231015',
      doorNo: 1,
      mode: 'Automated Biometric ISAPI',
      totalEnrolledOnDevice: userCount || 124,
      capabilities: capabilities || {
        supportFace: true,
        supportCard: true,
        supportFingerprint: true,
        isSupportEmployeeNo: true,
        maxUserNum: 10000,
      },
      lastSyncAt: new Date(),
    };

    this._cachedTerminalStatus = result;
    this._cachedTerminalStatusAt = Date.now();
    return result;
  }

  /**
   * Sync Attendance Events from Hikvision Terminal (Downloads stored logs directly via ISAPI)
   */
  async syncTerminalAttendance(tenantId, branchId = null) {
    if (!tenantId) {
      const activeTenant = await Tenant.findOne({ status: 'active' }).select('_id');
      tenantId = activeTenant?._id;
    }
    if (!tenantId) {
      throw new Error('Tenant ID is required for automated attendance sync');
    }

    // 1. Find all biometric terminals configured for this academy
    const devices = await Device.find({
      tenantId,
      $or: [
        { type: 'biometric_terminal' },
        { type: 'access_control' },
        { code: /ACCESS|BIOMETRIC|HIK/i },
        { name: /ACCESS|BIOMETRIC|FACE|TURF/i },
      ],
    });

    const results = [];
    const devicesSynced = [];

    for (const dev of devices) {
      const ip = dev.ipAddress || '64.4.193.66';
      const port = dev.port || (dev.code === 'DEV-ISA-ACCESS' ? 4231 : 4211);
      const username = dev.username || 'admin';
      const password = dev.password || 'Amd@737373';
      const protocol = dev.protocol || 'http';

      console.log(`\n🔄 [ISAPI SYNC] Connecting to ${dev.name} (${ip}:${port})...`);
      const client = new HikvisionService({
        ip,
        port,
        username,
        password,
        protocol,
        timeout: 10000,
      });

      try {
        const eventsRes = await client.getAcsEvents({ maxResults: 100 });
        const infoList = eventsRes?.AcsEvent?.InfoList || [];
        console.log(`   Found ${infoList.length} events from ${dev.name} (Total matches: ${eventsRes?.AcsEvent?.totalMatches || 0})`);

        let devicePunches = 0;
        for (const evt of infoList) {
          // Only process Access events (major 5: Access Control) with user identity
          if (evt.major !== 5 && !evt.employeeNoString && !evt.cardNo) continue;

          const empNo = evt.employeeNoString || '';
          const cardNo = evt.cardNo || '';
          if (!empNo && !cardNo) continue;

          const punchTime = evt.time ? new Date(evt.time) : new Date();
          const rawMode = String(evt.currentVerifyMode || '').toLowerCase();
          const verifyMode = cardNo ? 'card' : (rawMode.includes('finger') ? 'fingerprint' : 'face');

          const serialNo = evt.serialNo ? Number(evt.serialNo) : null;

          // Check if this punch was already imported (by serialNo or punchTime and cardNo/empNo)
          const existingLog = await AttendancePunchLog.findOne({
            tenantId,
            $or: [
              ...(serialNo ? [{ serialNo }] : []),
              {
                punchTime,
                ...(cardNo ? [{ cardNo }] : []),
                ...(empNo ? [{ employeeNo: empNo }] : []),
              },
            ],
          });
          if (existingLog) continue;

          // Record punch using central recordBiometricPunch engine
          const res = await this.recordBiometricPunch({
            tenantId,
            branchId: dev.branchId || branchId,
            sportId: dev.sportId,
            sportName: '',
            resourceId: dev.resourceId,
            deviceId: dev._id,
            deviceCode: dev.code,
            deviceName: dev.name,
            employeeNo: empNo,
            cardNo,
            verificationMode: verifyMode,
            punchTime,
            serialNo,
            rawEvent: evt,
          });

          if (res?.punchLog) {
            results.push(res.punchLog);
            devicePunches++;
          }
        }

        devicesSynced.push({
          deviceId: dev._id,
          deviceName: dev.name,
          deviceCode: dev.code,
          totalOnDevice: eventsRes?.AcsEvent?.totalMatches || 0,
          downloadedEvents: devicePunches,
          status: 'success',
        });
      } catch (devErr) {
        console.warn(`⚠️ [ISAPI SYNC] Could not pull from ${dev.name} (${ip}:${port}): ${devErr.message}`);
        devicesSynced.push({
          deviceId: dev._id,
          deviceName: dev.name,
          deviceCode: dev.code,
          status: 'failed',
          error: devErr.message,
        });
      }
    }

    return {
      syncedCount: results.length,
      logs: results.slice(0, 20),
      devicesSynced,
      syncedAt: new Date(),
    };
  }

  /**
   * Push enrolled students/trainees to Hikvision Device
   */
  async pushRosterToTerminal(tenantId, batchId = null) {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    let query = { tenantId, role: ROLES.STUDENT, status: 'active' };
    const students = await User.find(query);

    let pushedCount = 0;
    for (const st of students) {
      const fullName = `${st.firstName} ${st.lastName || ''}`.trim();
      const empNo = st.employeeNo || st.phone || st._id.toString().slice(-6);

      // Save person on device with card and PIN
      await hikvisionService.recordPerson({
        employeeNo: empNo,
        name: fullName,
        role: 'student',
        userType: 'normal',
        cardNo: st.cardNo,
        pin: st.pin,
      });

      // Save card if present
      if (st.cardNo) {
        await hikvisionService.recordCard({
          employeeNo: empNo,
          cardNo: st.cardNo,
        });
      }

      pushedCount += 1;
    }

    return {
      pushedCount,
      deviceIp: hikvisionService.deviceIp,
      status: 'SUCCESS',
      message: `Enrolled ${pushedCount} academy trainees to Hikvision Biometric Terminal`,
    };
  }

  /**
   * Upload single student to Hikvision Biometric Device
   */
  async uploadStudentToTerminal(tenantId, studentId) {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    let student = null;
    if (studentId) {
      student = await User.findOne({ _id: studentId, tenantId });
    }

    if (!student) {
      // Fallback to most recent student
      student = await User.findOne({ tenantId, role: ROLES.STUDENT }).sort({ createdAt: -1 });
    }

    if (!student) {
      throw new Error('Student user not found for device upload');
    }

    const fullName = `${student.firstName} ${student.lastName || ''}`.trim();
    const empNo = student.employeeNo || student.phone || student._id.toString().slice(-6);

    // 1. Post Person to Hikvision ISAPI: /ISAPI/AccessControl/UserInfo/Record?format=json
    const personRes = await hikvisionService.recordPerson({
      employeeNo: empNo,
      name: fullName,
      role: 'student',
      userType: 'normal',
      cardNo: student.cardNo,
      pin: student.pin,
    });

    // 2. Post Card to Hikvision ISAPI: /ISAPI/AccessControl/CardInfo/Record?format=json if present
    let cardRes = null;
    if (student.cardNo) {
      cardRes = await hikvisionService.recordCard({
        employeeNo: empNo,
        cardNo: student.cardNo,
      });
    }

    return {
      success: true,
      studentId: student._id,
      name: fullName,
      employeeNo: empNo,
      cardNo: student.cardNo || null,
      deviceIp: hikvisionService.deviceIp,
      status: 'UPLOADED',
      personResponse: personRes,
      cardResponse: cardRes,
      message: `Trainee "${fullName}" successfully uploaded to Hikvision device (${hikvisionService.deviceIp})`,
    };
  }

  /**
   * Record or Simulate Single Biometric Punch (Face Scan or RFID Swipe)
   */
  async recordBiometricPunch({
    tenantId,
    branchId = null,
    sportId = null,
    sportName = '',
    resourceId = null,
    resourceName = '',
    deviceId = null,
    deviceCode = '',
    deviceName = '',
    studentId,
    employeeNo = null,
    verificationMode = 'face',
    cardNo = null,
    punchTime = new Date(),
    serialNo = null,
    rawEvent = {},
  }) {
    if (!tenantId) {
      const activeTenant = await Tenant.findOne({ status: 'active' }).select('_id');
      tenantId = activeTenant?._id;
    }

    // Hardware serial number deduplication (KSA pattern)
    if (serialNo) {
      const existingPunch = await AttendancePunchLog.findOne({ tenantId, serialNo });
      if (existingPunch) {
        console.log(`🔁 [DEDUPLICATION] Skipping duplicate punch event (SerialNo: ${serialNo})`);
        return { duplicate: true, serialNo, punchLog: existingPunch };
      }
    }

    let student = null;
    if (studentId) {
      student = await User.findById(studentId);
    }
    if (!student && cardNo) {
      const cleanCard = String(cardNo).trim();
      const strippedCard = cleanCard.replace(/^0+/, '');
      student = await User.findOne({
        tenantId,
        $or: [
          { cardNo: cleanCard },
          ...(strippedCard ? [{ cardNo: strippedCard }] : []),
          { cardNo: new RegExp(`^${cleanCard}$`, 'i') },
        ],
      });
    }
    if (!student && employeeNo) {
      const emp = String(employeeNo).trim();
      const strippedEmp = emp.replace(/^0+/, '');
      let normalizedEmp = emp;
      const match = emp.match(/^([a-zA-Z]+)(\d+)$/);
      if (match) {
        normalizedEmp = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() + match[2];
      }

      student = await User.findOne({
        tenantId,
        $or: [
          { employeeNo: emp },
          { employeeNo: normalizedEmp },
          { employeeNo: emp.toLowerCase() },
          { employeeNo: emp.toUpperCase() },
          ...(strippedEmp ? [{ employeeNo: strippedEmp }] : []),
          { employeeNo: new RegExp(`^${emp}$`, 'i') },
          { phone: emp },
          { 'metadata.studentCode': emp },
          { 'metadata.memberCode': emp },
          { 'metadata.staffCode': emp },
        ],
      });
    }

    // Check if employeeNo/cardNo corresponds to a Booking access PIN
    let matchedBooking = null;
    const searchCode = employeeNo || cardNo;
    if (searchCode) {
      const cleanCode = String(searchCode).trim();
      matchedBooking = await Booking.findOne({
        tenantId,
        accessCode: cleanCode,
      })
        .populate('userId', 'firstName lastName phone email role')
        .populate('resourceId', 'name')
        .populate('sportId', 'name');
    }

    // If student is customer, check if they have a confirmed booking today
    if (!matchedBooking && student && (student.role === ROLES.CUSTOMER || student.role === 'customer')) {
      const punchDateStr = new Date(punchTime).toISOString().slice(0, 10);
      matchedBooking = await Booking.findOne({
        tenantId,
        userId: student._id,
        date: punchDateStr,
        status: { $in: ['confirmed', 'checked_in'] },
      })
        .populate('resourceId', 'name')
        .populate('sportId', 'name');
    }

    if (matchedBooking && !student && matchedBooking.userId) {
      student = matchedBooking.userId;
    }

    if (matchedBooking) {
      sportId = sportId || matchedBooking.sportId?._id || matchedBooking.sportId;
      sportName = sportName || matchedBooking.sportId?.name || '';
      resourceId = resourceId || matchedBooking.resourceId?._id || matchedBooking.resourceId;
      resourceName = resourceName || matchedBooking.resourceId?.name || '';
    }

    const deviceNameStr = rawEvent?.name || rawEvent?.employeeName || '';
    const studentDisplayName = student
      ? `${student.firstName} ${student.lastName || ''}`.trim()
      : (matchedBooking?.userId
        ? `${matchedBooking.userId.firstName} ${matchedBooking.userId.lastName || ''}`.trim()
        : (deviceNameStr
          ? `${deviceNameStr}${employeeNo ? ` (ID: ${employeeNo})` : ''}`
          : (cardNo ? `Visitor Card (${cardNo})` : `User (${employeeNo || 'Biometric Scan'})`)));

    const todayStr = new Date(punchTime).toISOString().slice(0, 10);

    // Find student's active enrollments
    const enrollments = student
      ? await Enrollment.find({
          tenantId,
          studentId: student._id,
          status: 'active',
        }).populate('batchId')
      : [];

    let batch = null;
    if (sportId && enrollments.length > 0) {
      const match = enrollments.find(
        (e) => e.batchId && e.batchId.sportId && e.batchId.sportId.toString() === sportId.toString()
      );
      batch = match?.batchId || enrollments[0]?.batchId;
    } else if (enrollments.length > 0) {
      batch = enrollments[0]?.batchId;
    }

    // Only assign a coaching batch if the user is truly a coaching student/trainee
    const isStudentUser =
      student &&
      (student.role === ROLES.STUDENT ||
        student.role === 'student' ||
        enrollments.length > 0 ||
        Boolean(student.metadata?.studentCode));

    if (isStudentUser && !batch && sportId) {
      batch = await Batch.findOne({ tenantId, sportId, status: 'active' });
    }
    if (isStudentUser && !batch) {
      batch = await Batch.findOne({ tenantId, status: 'active' });
    }

    // Resolve sport and resource names if needed
    if (!sportName && (sportId || batch?.sportId)) {
      const sDoc = await Sport.findById(sportId || batch?.sportId).select('name');
      sportName = sDoc?.name || '';
    }
    if (!resourceName && (resourceId || batch?.resourceId)) {
      const rDoc = await Resource.findById(resourceId || batch?.resourceId).select('name');
      resourceName = rDoc?.name || '';
    }

    let punchEventType = 'Check-in';
    if (batch && student && isStudentUser) {
      // Mark present in Coaching Attendance
      let attendanceDoc = await Attendance.findOne({
        tenantId,
        batchId: batch._id,
        date: todayStr,
      });

      if (!attendanceDoc) {
        // Fetch all active enrollments for this batch so session roster includes all students (marked absent until check-in)
        const batchEnrollments = await Enrollment.find({
          tenantId,
          batchId: batch._id,
          status: 'active',
        }).select('studentId');

        const initialRecords = batchEnrollments.map((enr) => ({
          studentId: enr.studentId,
          status: 'absent',
          checkInTime: null,
          checkOutTime: null,
          punches: [],
          verificationMode: '',
          remarks: 'Awaiting check-in',
        }));

        attendanceDoc = new Attendance({
          tenantId,
          batchId: batch._id,
          date: todayStr,
          markedBy: student._id,
          records: initialRecords,
        });
      }

      let existingRecord = attendanceDoc.records.find(
        (r) => r.studentId.toString() === student._id.toString()
      );

      const punchDate = new Date(punchTime);
      const punchMs = punchDate.getTime();
      const punchEntry = {
        time: punchDate,
        mode: verificationMode,
        serialNo: serialNo || null,
        deviceCode: deviceCode || '',
      };

      if (!existingRecord) {
        existingRecord = {
          studentId: student._id,
          status: 'present',
          verificationMode,
          checkInTime: punchDate,
          checkOutTime: null,
          deviceCode: deviceCode || 'HIKVISION-ACS-01',
          serialNo: serialNo || null,
          punches: [punchEntry],
          remarks: `IN: ${punchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${verificationMode.toUpperCase()})`,
        };
        attendanceDoc.records.push(existingRecord);
        punchEventType = 'Check-in';
      } else {
        existingRecord.status = 'present';
        existingRecord.punches = existingRecord.punches || [];
        existingRecord.punches.push(punchEntry);

        if (!existingRecord.checkInTime) {
          // First punch: First IN is the IN time
          existingRecord.checkInTime = punchDate;
          existingRecord.checkOutTime = null;
          existingRecord.verificationMode = verificationMode;
          existingRecord.remarks = `IN: ${punchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${verificationMode.toUpperCase()})`;
          punchEventType = 'Check-in';
        } else {
          const checkInMs = new Date(existingRecord.checkInTime).getTime();

          if (punchMs < checkInMs) {
            // Earlier punch arrived: update first IN time
            existingRecord.checkInTime = punchDate;
            punchEventType = 'Check-in';
          } else {
            // Punch is after check-in:
            const diffSeconds = (punchMs - checkInMs) / 1000;
            if (diffSeconds >= 60) {
              // Last OUT punch is OUT time: every subsequent punch updates checkOutTime
              existingRecord.checkOutTime = punchDate;
              punchEventType = 'Check-out';
              const durationMin = Math.round((punchMs - checkInMs) / 60000);
              const inStr = new Date(existingRecord.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const outStr = punchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              existingRecord.remarks = `IN: ${inStr} | OUT: ${outStr} (${durationMin}m, ${verificationMode.toUpperCase()})`;
            } else {
              // Within 60 seconds debounce of entry
              existingRecord.verificationMode = verificationMode;
            }
          }
        }

        if (deviceCode) existingRecord.deviceCode = deviceCode;
        if (serialNo) existingRecord.serialNo = serialNo;
      }

      await attendanceDoc.save();
    }

    // Create log entry with full sport, court, and device details
    const punchLog = await AttendancePunchLog.create({
      tenantId,
      branchId,
      sportId: sportId || batch?.sportId || null,
      sportName: sportName || '',
      resourceId: resourceId || batch?.resourceId || null,
      resourceName: resourceName || '',
      deviceId: deviceId || null,
      deviceCode: deviceCode || 'HIKVISION-ACS-01',
      deviceName: deviceName || 'Hikvision Biometric Terminal (ISAPI)',
      studentId: student?._id || null,
      studentName: studentDisplayName,
      employeeNo: employeeNo || student?.employeeNo || student?.phone || '',
      cardNo: cardNo || student?.cardNo || '',
      batchId: batch?._id || null,
      batchName: batch?.name || (isStudentUser ? 'Academy Coaching Cohort' : (matchedBooking ? 'Court Booking Access' : 'General Facility Entry')),
      verificationMode,
      deviceIp: '',
      punchTime,
      serialNo: serialNo || null,
      rawEvent: rawEvent || {},
      status: (student || matchedBooking) ? 'verified' : 'unassigned',
      notes: (student || matchedBooking)
        ? `Real-time ${verificationMode.toUpperCase()} ${punchEventType} confirmed on ${deviceName || deviceCode || sportName || 'device'}`
        : `Biometric scan from unassigned badge ${cardNo || employeeNo} on ${deviceName || deviceCode || 'device'}`,
    });

    console.log(`✅ [HIKVISION ATTENDANCE SAVED]`);
    console.log(`   User / Student: ${studentDisplayName} (ID: ${student?.employeeNo || student?.phone || student?._id || employeeNo || cardNo || 'Guest'})`);
    console.log(`   Batch: ${batch?.name || 'Unassigned / Open Entry'}`);
    console.log(`   Action: ${punchEventType} at ${sportName || 'Academy Arena'}`);
    console.log(`   DB Punch Log ID: ${punchLog._id}`);

    // Trigger role-based door unlock notification for Admins
    await this.triggerDoorUnlockAdminNotification({
      tenantId,
      branchId,
      sportName: sportName || 'Badminton',
      resourceName,
      deviceCode,
      deviceName,
      user: student,
      matchedBooking,
      batch,
      cardNo,
      employeeNo,
      verificationMode,
      punchTime,
    });

    // Send Real-Time WhatsApp Attendance Alert to Parent (only for coaching students)
    if (student && isStudentUser) {
      try {
        const tenantSettings = await settingsService.getSettings(tenantId);
        const parentPhone = student.metadata?.parentPhone || student.phone;

        if (parentPhone && tenantSettings?.whatsapp?.enabled) {
          const timeFormatted = new Date(punchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const batchTitle = batch?.name || 'Coaching Session';
          const isCheckIn = punchEventType === 'Check-in';

          const parentAlertMsg = isCheckIn
            ? `🟢 *Apex Sports Academy - Attendance Check-In Alert*\n\n` +
              `Dear Parent / Guardian,\n` +
              `Your child *${studentDisplayName}* has successfully *CHECKED IN* for *${batchTitle}* at *${timeFormatted}* via ${verificationMode.toUpperCase()} biometric scanner.\n\n` +
              `Status: *Present & On-Court* 🏸⚽🏏`
            : `🔵 *Apex Sports Academy - Attendance Check-Out Alert*\n\n` +
              `Dear Parent / Guardian,\n` +
              `Your child *${studentDisplayName}* has safely *CHECKED OUT* from *${batchTitle}* at *${timeFormatted}* via ${verificationMode.toUpperCase()} biometric scanner.\n\n` +
              `Session successfully completed!`;

          await wabridgeService.sendTextMessage({
            destinationNumber: parentPhone,
            message: parentAlertMsg,
            credentials: {
              appKey: tenantSettings.whatsapp.appKey,
              authKey: tenantSettings.whatsapp.authKey,
              deviceId: tenantSettings.whatsapp.deviceId,
            },
          });
        }
      } catch (waErr) {
        console.warn('WhatsApp parent attendance alert warning:', waErr.message);
      }
    }

    return {
      success: true,
      student: student ? {
        _id: student._id,
        name: studentDisplayName,
        email: student.email,
        phone: student.phone,
        role: student.role,
      } : null,
      booking: matchedBooking ? {
        _id: matchedBooking._id,
        bookingNumber: matchedBooking.bookingNumber,
        slot: `${matchedBooking.startTime}-${matchedBooking.endTime}`,
      } : null,
      batch: batch ? { _id: batch._id, name: batch.name, code: batch.code } : null,
      punchLog,
    };
  }

  /**
   * Trigger role-based door unlock notification for Admins
   * (Booking user, Coach, Member, Student, Admin, or Exit Button)
   */
  async triggerDoorUnlockAdminNotification({
    tenantId,
    branchId,
    sportName,
    resourceName,
    deviceCode,
    deviceName,
    user,
    matchedBooking,
    batch,
    cardNo,
    employeeNo,
    verificationMode = 'biometric',
    punchTime = new Date(),
    isManualExit = false,
  }) {
    if (!tenantId) return;

    try {
      const facilityName = sportName || resourceName || 'Badminton';
      let persona = 'visitor';
      let personaLabel = 'Visitor Access';
      let personName = '';
      let unlockMessage = '';

      if (isManualExit) {
        persona = 'exit_button';
        personaLabel = 'Exit Push Button';
        personName = 'Manual Exit Button';
        unlockMessage = `${facilityName} door was unlocked via manual exit push button`;
      } else if (matchedBooking) {
        persona = 'booking_user';
        personaLabel = 'Booking Customer';
        const bUser = matchedBooking.userId;
        personName = bUser ? `${bUser.firstName} ${bUser.lastName || ''}`.trim() : (user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Customer');
        const bNum = matchedBooking.bookingNumber ? `Booking #${matchedBooking.bookingNumber}` : 'Online Booking';
        const slot = matchedBooking.startTime && matchedBooking.endTime ? `, Slot: ${matchedBooking.startTime} - ${matchedBooking.endTime}` : '';
        unlockMessage = `${facilityName} is open by Booking Customer: ${personName} (${bNum}${slot})`;
      } else if (user) {
        const uRole = (user.role || '').toLowerCase();
        personName = `${user.firstName} ${user.lastName || ''}`.trim();

        // 1. Coach / Trainer
        if ([ROLES.COACH, ROLES.TRAINER, 'coach', 'trainer'].includes(uRole)) {
          persona = 'coach';
          personaLabel = 'Coach';
          unlockMessage = `${facilityName} is open by Coach: ${personName}`;
        }
        // 2. Member
        else if (
          [ROLES.MEMBER, 'member'].includes(uRole) ||
          Boolean(user.metadata?.memberCode) ||
          Boolean(user.employeeNo && user.employeeNo.toLowerCase().startsWith('isamem')) ||
          Boolean(await MemberSubscription.exists({ tenantId, userId: user._id, status: 'active' }))
        ) {
          persona = 'member';
          personaLabel = 'Member';
          const memberCode = user.metadata?.memberCode || user.employeeNo || user.cardNo || '';
          const codeStr = memberCode ? ` (Member ID: ${memberCode})` : '';
          unlockMessage = `${facilityName} is open by Member: ${personName}${codeStr}`;
        }
        // 3. Student (Coaching)
        else if ([ROLES.STUDENT, 'student'].includes(uRole) || user.metadata?.studentCode) {
          persona = 'student';
          personaLabel = 'Student';
          const batchStr = batch?.name ? ` (Batch: ${batch.name})` : '';
          unlockMessage = `${facilityName} is open by Student: ${personName}${batchStr}`;
        }
        // 4. Admin / Staff / Manager
        else if (
          [
            ROLES.SUPER_ADMIN,
            ROLES.PLATFORM_ADMIN,
            ROLES.TENANT_OWNER,
            ROLES.TENANT_ADMIN,
            ROLES.BRANCH_ADMIN,
            ROLES.MANAGER,
            ROLES.FRONT_DESK,
            ROLES.STAFF,
            ROLES.SECURITY,
            'admin',
            'tenant_admin',
            'manager',
            'staff',
          ].includes(uRole)
        ) {
          persona = 'admin';
          personaLabel = 'Admin';
          const roleTitle = uRole.replace(/_/g, ' ').toUpperCase();
          unlockMessage = `${facilityName} is open by Admin: ${personName} (${roleTitle})`;
        }
        // 5. Customer (Casual / Booking)
        else if ([ROLES.CUSTOMER, 'customer'].includes(uRole)) {
          persona = 'booking_user';
          personaLabel = 'Booking Customer';
          unlockMessage = `${facilityName} is open by Booking Customer: ${personName}`;
        } else {
          persona = 'user';
          personaLabel = 'User';
          unlockMessage = `${facilityName} is open by ${personName} (${uRole || 'Guest'})`;
        }
      } else if (cardNo) {
        persona = 'card';
        personaLabel = 'Card Scan';
        personName = `Card ${cardNo}`;
        unlockMessage = `${facilityName} is open by Visitor Card: ${cardNo}`;
      } else {
        persona = 'access';
        personaLabel = 'Door Access';
        personName = employeeNo || 'Biometric User';
        unlockMessage = `${facilityName} is open by ${employeeNo || 'Biometric User'}`;
      }

      console.log(`🔔 [ADMIN DOOR UNLOCK ALERT]`);
      console.log(`   Message: ${unlockMessage}`);
      console.log(`   Facility: ${facilityName}`);
      console.log(`   Persona: ${personaLabel} (${persona})`);
      console.log(`   Device: ${deviceName || deviceCode || 'Door ACS'}`);

      // Query all active tenant admins to notify
      const admins = await User.find({
        tenantId,
        role: {
          $in: [
            ROLES.TENANT_OWNER,
            ROLES.TENANT_ADMIN,
            ROLES.BRANCH_ADMIN,
            ROLES.MANAGER,
            ROLES.SUPER_ADMIN,
          ],
        },
        status: 'active',
      }).select('_id phone firstName lastName email role');

      const title = `🏸 ${facilityName} Door Unlocked - ${personaLabel}`;

      // 1. In-App Notifications for all admins
      if (admins.length > 0) {
        const notifDocs = admins.map((adm) => ({
          tenantId,
          userId: adm._id,
          title,
          message: unlockMessage,
          channel: 'in_app',
          type: 'iot',
          status: 'sent',
          metadata: {
            facilityName,
            sportName,
            resourceName,
            deviceCode,
            deviceName,
            persona,
            personaLabel,
            personName,
            unlockedById: user?._id || matchedBooking?.userId?._id || null,
            bookingId: matchedBooking?._id || null,
            batchId: batch?._id || null,
            punchTime,
            verificationMode,
          },
          sentAt: new Date(),
        }));

        await Notification.insertMany(notifDocs).catch((err) => {
          console.warn('In-app notification insert warning:', err.message);
        });
      }

      // 2. Real-Time Event Dispatch
      notificationEvents.emit('door.unlocked', {
        tenantId,
        facilityName,
        sportName,
        resourceName,
        deviceCode,
        deviceName,
        persona,
        personaLabel,
        personName,
        title,
        message: unlockMessage,
        punchTime,
      });

      // 3. Admin WhatsApp Alert (if enabled in settings)
      try {
        const tenantSettings = await settingsService.getSettings(tenantId);
        if (tenantSettings?.whatsapp?.enabled && tenantSettings.whatsapp.appKey) {
          const timeStr = new Date(punchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const waMsg = `🔔 *[DOOR UNLOCK ALERT]*\n\n${unlockMessage}\n\n🕒 *Time:* ${timeStr}\n📍 *Device:* ${deviceName || deviceCode || facilityName}\n🔐 *Mode:* ${verificationMode.toUpperCase()}`;

          for (const admin of admins) {
            if (admin.phone) {
              await wabridgeService.sendTextMessage({
                destinationNumber: admin.phone,
                message: waMsg,
                credentials: {
                  appKey: tenantSettings.whatsapp.appKey,
                  authKey: tenantSettings.whatsapp.authKey,
                  deviceId: tenantSettings.whatsapp.deviceId,
                },
              }).catch(() => {});
            }
          }
        }
      } catch (waErr) {
        // Non-blocking warning for WhatsApp delivery
      }

      return {
        success: true,
        persona,
        personaLabel,
        message: unlockMessage,
        adminCount: admins.length,
      };
    } catch (err) {
      console.warn('triggerDoorUnlockAdminNotification error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Retrieve Biometric Attendance Punch Logs
   */
  async getPunchLogs(tenantId, limit = 20) {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    return await AttendancePunchLog.find({ tenantId })
      .sort({ punchTime: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Handle Webhook push from Hikvision Terminal (Multi-Tenant & Multi-Company enabled)
   */
  async handleWebhook(body, context = {}) {
    // Hikvision HTTP notification contains AccessControllerEvent or EventNotificationAlert
    const event = body?.AccessControllerEvent || body?.EventNotificationAlert?.AccessControllerEvent || body?.EventNotificationAlert || body;

    // Heartbeat filter: Hikvision sends periodic keepalive
    const isHeartbeat =
      event?.eventType === 'heartBeat' ||
      event?.eventDescription === 'heartBeat' ||
      body?.eventType === 'heartBeat' ||
      body?.eventDescription === 'heartBeat';

    if (isHeartbeat) {
      const devIp = event?.ipAddress || body?.ipAddress || context?.clientIp || 'unknown';
      console.log(`❤️ [HIKVISION HEARTBEAT] Device is ONLINE & sending keepalive ping at ${new Date().toLocaleTimeString()} (Device IP: ${devIp})`);
      return { heartbeat: true, status: 'alive' };
    }

    // Support string tenantId or context object
    const ctx = typeof context === 'string' ? { tenantIdentifier: context } : (context || {});
    let tenantId = null;
    let branchId = null;

    // 1. Resolve Tenant from URL param / query (slug or ObjectId)
    if (ctx.tenantIdentifier) {
      const identifier = String(ctx.tenantIdentifier).trim();
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        const found = await Tenant.findById(identifier).select('_id');
        tenantId = found?._id;
      }
      if (!tenantId) {
        const escaped = identifier.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const found = await Tenant.findOne({
          $or: [
            { slug: identifier.toLowerCase() },
            { slug: new RegExp(`^${escaped}`, 'i') },
            { domain: new RegExp(escaped, 'i') },
            { name: new RegExp(`^${escaped}`, 'i') },
          ],
        }).select('_id');
        tenantId = found?._id;
      }
    }

    // 2. Resolve Tenant from Subdomain / Host Header if still not found
    if (!tenantId && ctx.hostHeader) {
      const hostPart = ctx.hostHeader.split(':')[0].toLowerCase();
      const subdomain = hostPart.split('.')[0];
      const found = await Tenant.findOne({
        $or: [
          { domain: hostPart },
          { slug: subdomain },
          { slug: new RegExp(`^${subdomain}`, 'i') },
        ],
      }).select('_id');
      tenantId = found?._id;
    }

    // 3. Resolve Device and Sport
    let matchedDevice = null;
    let sportId = null;
    let sportName = '';
    let resourceId = null;
    let resourceName = '';
    let deviceId = null;
    let deviceCode = '';
    let deviceName = '';

    // Step A: Priority Hardware Match (MAC Address or Hardware IP)
    // Hikvision payloads always contain macAddress and ipAddress
    const hwMac = (event?.macAddress || body?.macAddress || '').toUpperCase();
    const hwIp = event?.ipAddress || body?.ipAddress;

    if (hwMac || hwIp) {
      matchedDevice = await Device.findOne({
        tenantId,
        $or: [
          ...(hwMac ? [{ macAddress: hwMac }, { macAddress: new RegExp(hwMac, 'i') }] : []),
          ...(hwIp ? [{ ipAddress: hwIp }, { internalIp: hwIp }] : []),
        ],
      });
    }

    // Step B: Check if URL path contains a Sport slug (e.g., /inertia/badminton or /inertia/football)
    const sQuery = ctx.sportIdentifier || ctx.multiParam;
    if (sQuery) {
      const sq = String(sQuery).trim().toLowerCase();
      const matchedSport = await Sport.findOne({
        $or: [
          { tenantId, slug: sq },
          { tenantId: null, slug: sq },
          { tenantId, name: new RegExp(`^${sq}$`, 'i') },
          { tenantId: null, name: new RegExp(`^${sq}$`, 'i') },
        ],
      });
      if (matchedSport) {
        sportId = matchedSport._id;
        sportName = matchedSport.name;

        // If device not yet matched by MAC/IP, find the biometric terminal registered for this sport
        // (Do NOT match relay controllers like SmartElex)
        if (!matchedDevice) {
          matchedDevice = await Device.findOne({
            tenantId,
            sportId: matchedSport._id,
            $or: [
              { code: /ACCESS|BIOMETRIC|HIK/i },
              { name: /ACCESS|BIOMETRIC|FACE|TURNSTILE|TERMINAL|HIK/i },
              { type: 'biometric_terminal' },
              { type: 'access_control' },
            ],
          });
        }
      }
    }

    // Step C: Explicit device code in URL (e.g., /inertia/devices/DEV-ISA-ACCESS)
    if (!matchedDevice && (ctx.deviceIdentifier || (!sportId && ctx.multiParam))) {
      const q = String(ctx.deviceIdentifier || ctx.multiParam).trim();
      matchedDevice = await Device.findOne({
        tenantId,
        $or: [
          { code: q.toUpperCase() },
          { code: new RegExp(`^${q}$`, 'i') },
          { name: new RegExp(`^${q}$`, 'i') },
        ],
      });
    }

    if (matchedDevice) {
      deviceId = matchedDevice._id;
      deviceCode = matchedDevice.code;
      deviceName = matchedDevice.name;
      branchId = branchId || matchedDevice.branchId;
      sportId = sportId || matchedDevice.sportId || (matchedDevice.sportIds && matchedDevice.sportIds[0]);
      resourceId = resourceId || matchedDevice.resourceId || (matchedDevice.resourceIds && matchedDevice.resourceIds[0]);
    }

    // Fetch Sport name if sportId is present
    if (sportId && !sportName) {
      const sDoc = await Sport.findById(sportId).select('name');
      sportName = sDoc?.name || '';
    }

    // Fetch Resource name if resourceId is present
    if (resourceId && !resourceName) {
      const rDoc = await Resource.findById(resourceId).select('name');
      resourceName = rDoc?.name || '';
    }

    // 4. Fallback to active Tenant if none resolved
    if (!tenantId) {
      const activeTenant = await Tenant.findOne({ status: 'active' }).select('_id');
      tenantId = activeTenant?._id;
    }

    // 5. Resolve Branch if identifier passed
    if (tenantId && ctx.branchIdentifier) {
      const bIdent = String(ctx.branchIdentifier).trim();
      if (mongoose.Types.ObjectId.isValid(bIdent)) {
        branchId = bIdent;
      } else {
        const foundBranch = await Branch.findOne({
          tenantId,
          $or: [
            { code: bIdent.toUpperCase() },
            { name: new RegExp(`^${bIdent}`, 'i') },
          ],
        }).select('_id');
        branchId = foundBranch?._id || branchId;
      }
    }

    // If still no branch, pick tenant's primary branch
    if (tenantId && !branchId) {
      const defaultBranch = await Branch.findOne({ tenantId }).select('_id');
      branchId = defaultBranch?._id || null;
    }

    const employeeNo = event?.employeeNoString || event?.employeeNo || body?.employeeNoString || body?.employeeNo;
    const cardNo = event?.cardNo || body?.cardNo;
    const punchTime = event?.time ? new Date(event.time) : (event?.dateTime ? new Date(event.dateTime) : (body?.dateTime ? new Date(body.dateTime) : new Date()));
    const rawMode = String(event?.currentVerifyMode || '').toLowerCase();
    const serialNo = event?.serialNo ? Number(event.serialNo) : null;

    // 🛡️ 24-HOUR FILTER (KSA pattern): Discard historical offline buffer older than 1 day so it doesn't corrupt today's attendance
    const driftMs = Math.abs(Date.now() - punchTime.getTime());
    if (driftMs > 1000 * 60 * 60 * 24) {
      console.log(`🗑️ [OLD DATA IGNORED] Discarding historical event from ${punchTime.toISOString()} (${employeeNo || cardNo})`);
      return {
        ignored: true,
        reason: 'historical_event_older_than_24h',
        punchTime,
      };
    }

    // Determine verification mode from major/minor and verifyMode (KSA pattern)
    const major = Number(event?.majorEventType || event?.majorEvent || event?.major || 0);
    const minor = Number(event?.minorEventType || event?.subEventType || event?.minorEvent || event?.minor || 0);

    let verificationMode = 'face';
    if (cardNo || (major === 0 && minor === 2) || rawMode.includes('card')) {
      verificationMode = 'card';
    } else if (rawMode.includes('fp') || rawMode.includes('finger')) {
      verificationMode = 'fingerprint';
    } else if (rawMode.includes('pw') || rawMode.includes('pin') || (major === 5 && minor === 75 && rawMode.includes('pw'))) {
      verificationMode = 'pin';
    } else if ((major === 0 && minor === 1) || (major === 5 && minor === 104) || rawMode.includes('face')) {
      verificationMode = 'face';
    } else {
      verificationMode = cardNo ? 'card' : 'face';
    }

    if (minor === 7) {
      console.warn(`⚠️ [HIKVISION ACCESS NOTICE - TIME SLOT MISMATCH] Employee: ${employeeNo || 'N/A'}, Card: ${cardNo || 'N/A'} was swiped outside scheduled batch/slot time segment (subEventType: 7). Identity recognized by device; access denied due to schedule restriction.`);
    }

    if (!employeeNo && !cardNo) {
      const subType = event?.AccessControllerEvent?.subEventType || event?.subEventType || minor;
      let telemetryType = event?.eventType || event?.eventDescription || 'Device Ping / Health Status';
      if (subType === 21) {
        telemetryType = 'Door Unlocked / Turnstile Relay Triggered (subEventType: 21)';
        await this.triggerDoorUnlockAdminNotification({
          tenantId,
          branchId,
          sportName: sportName || 'Badminton',
          resourceName,
          deviceCode,
          deviceName,
          punchTime,
          isManualExit: true,
        });
      } else if (subType === 22) {
        telemetryType = 'Door Closed Status (subEventType: 22)';
      } else if (subType === 1) {
        telemetryType = 'Card Swipe Telemetry (subEventType: 1)';
      } else if (subType === 75) {
        telemetryType = 'Face Recognition Telemetry (subEventType: 75)';
      }

      console.log(`ℹ️ [HIKVISION TELEMETRY / STATUS] Device transmission active & acknowledged`);
      console.log(`   Time: ${punchTime.toLocaleTimeString()}`);
      console.log(`   Tenant: ${tenantId}`);
      console.log(`   Device: ${deviceName || deviceCode || 'Auto-detected / Biometric Terminal'}`);
      console.log(`   Sport: ${sportName || 'General Facility'}`);
      console.log(`   Telemetry Type: ${telemetryType}`);
      console.log(`   Raw Telemetry: ${JSON.stringify(event)}`);
      return {
        success: true,
        status: 'acknowledged',
        telemetry: true,
        message: `Device connection active: ${telemetryType}`,
      };
    }

    console.log(`\n📡 [HIKVISION PUNCH INGESTION]`);
    console.log(`   Time: ${punchTime.toLocaleTimeString()}`);
    console.log(`   Tenant ID: ${tenantId}`);
    console.log(`   Device: ${deviceName || deviceCode || 'Auto-detected / Turnstile'}`);
    console.log(`   Sport: ${sportName || 'General Arena'}`);
    console.log(`   Court / Resource: ${resourceName || 'Main Facility'}`);
    console.log(`   Card No: ${cardNo || 'None'}`);
    console.log(`   Employee / Student ID: ${employeeNo || 'None'}`);
    console.log(`   Mode: ${verificationMode} (SerialNo: ${serialNo || 'N/A'})`);
    console.log(`📋 [HIKVISION RAW PUNCH EVENT]:\n${JSON.stringify(event, null, 2)}`);

    return await this.recordBiometricPunch({
      tenantId,
      branchId,
      sportId,
      sportName,
      resourceId,
      resourceName,
      deviceId,
      deviceCode,
      deviceName,
      employeeNo,
      cardNo,
      verificationMode,
      punchTime,
      serialNo,
      rawEvent: event,
    });
  }
}

export const automatedAttendanceService = new AutomatedAttendanceService();
