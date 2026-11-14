import DigestFetch from 'digest-fetch';

// Allow TLS connections to on-premise biometric controllers with self-signed certificates
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

/**
 * Hikvision Access Control Service (ACS) ISAPI Client
 * Implements endpoints from Hikvision ISAPI specification & Postman ACS ISAPI Collection:
 * - /ISAPI/AccessControl/UserInfo/* (Capabilities, Count, Search, Record, Modify, Detail/Delete)
 * - /ISAPI/AccessControl/CardInfo/* (Capabilities, Count, Search, Record, Modify, Delete)
 * - /ISAPI/Intelligent/FDLib/* (Face library, search, records)
 * - /ISAPI/AccessControl/CaptureFingerPrint & FingerPrintDownload
 * - /ISAPI/AccessControl/AcsEvent (Attendance & access event log queries)
 * - /ISAPI/Event/notification/httpHosts (Webhook push subscription)
 */
export class HikvisionService {
  constructor(config = {}) {
    let rawIp = String(config.ip || process.env.HIKVISION_IP || '64.4.193.66').trim();
    let detectedProtocol = config.protocol;
    let detectedPort = config.port;

    // Sanitize any http:// or https:// prefix passed inside ip
    if (rawIp.startsWith('http://')) {
      detectedProtocol = detectedProtocol || 'http';
      rawIp = rawIp.replace(/^http:\/\//, '');
    } else if (rawIp.startsWith('https://')) {
      detectedProtocol = detectedProtocol || 'https';
      rawIp = rawIp.replace(/^https:\/\//, '');
    }

    // Strip trailing slashes or paths
    rawIp = rawIp.replace(/\/.*$/, '');

    // Extract port if contained in IP (e.g. "64.4.193.66:4231")
    if (rawIp.includes(':')) {
      const [hostPart, portPart] = rawIp.split(':');
      rawIp = hostPart;
      if (!detectedPort && portPart) {
        detectedPort = Number(portPart);
      }
    }

    this.deviceIp = rawIp;
    this.port = detectedPort || (rawIp === '64.4.193.66' ? 4231 : (detectedProtocol === 'https' ? 443 : 80));
    this.username = config.username || 'admin';
    this.password = (config.password !== undefined && config.password !== null && config.password !== '')
      ? String(config.password)
      : (process.env.HIKVISION_PASSWORD || 'Amd@737373');
    this.protocol = detectedProtocol || (Number(this.port) === 443 ? 'https' : 'http');
    this.timeout = config.timeout || 12000;
    this.client = new DigestFetch(this.username, this.password, { algorithm: 'MD5' });
  }

  static forDevice(config = {}) {
    return new HikvisionService(config);
  }

  getBaseUrl() {
    const isStandard =
      (this.protocol === 'http' && Number(this.port) === 80) ||
      (this.protocol === 'https' && Number(this.port) === 443);
    return isStandard ? `${this.protocol}://${this.deviceIp}` : `${this.protocol}://${this.deviceIp}:${this.port}`;
  }

  /**
   * Parse XML tags into a key-value object safely
   */
  _parseXmlTags(xmlText, statusCode = 200) {
    const result = { raw: xmlText, status: statusCode };
    const matches = xmlText.matchAll(/<([a-zA-Z0-9_-]+)>([^<]*)<\/\1>/g);
    for (const match of matches) {
      result[match[1]] = match[2];
    }
    return result;
  }

  /**
   * Execute authenticated request to Hikvision device via DigestFetch
   */
  async request(endpoint, options = {}) {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const method = options.method || 'GET';
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/xml, */*',
      ...(options.headers || {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await this.client.fetch(url, {
        method,
        headers,
        body: options.body
          ? typeof options.body === 'string' || Buffer.isBuffer(options.body)
            ? options.body
            : JSON.stringify(options.body)
          : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await res.text();
      let data = null;

      // Safely parse JSON or XML
      try {
        data = JSON.parse(text);
      } catch {
        data = this._parseXmlTags(text, res.status);
      }

      // Log raw ISAPI device communication
      if (!url.includes('/Heartbeat') && !url.includes('/Count')) {
        console.log(`📡 [HIKVISION ISAPI ${method}] ${url} -> Status: ${res.status}`);
        if (options.body && typeof options.body === 'string' && options.body.length < 500) {
          console.log(`   Outbound Payload: ${options.body}`);
        }
        if (text && text.length < 1500 && !text.includes('<picture')) {
          console.log(`   Raw Response: ${text.replace(/\r?\n\s*/g, ' ').trim()}`);
        }
      }

      if (!res.ok) {
        // Detect Hikvision anti-brute force user/IP lock
        if (data.lockStatus === 'lock' || text.includes('<lockStatus>lock</lockStatus>')) {
          const unlockTime = parseInt(data.unlockTime || '1800', 10);
          const lockErr = new Error(
            `Hikvision terminal ${this.deviceIp}:${this.port} is temporarily locked for security. Unlocks in ${unlockTime}s.`
          );
          lockErr.isLocked = true;
          lockErr.unlockTime = unlockTime;
          lockErr.status = res.status;
          lockErr.data = data;
          throw lockErr;
        }

        const errMsg =
          data.errorMsg ||
          data.statusString ||
          data.message ||
          `Hikvision API Error ${res.status}: ${text.slice(0, 150)}`;
        const apiErr = new Error(errMsg);
        apiErr.status = res.status;
        apiErr.statusCode = data.statusCode;
        apiErr.subStatusCode = data.subStatusCode;
        apiErr.data = data;
        throw apiErr;
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[HikvisionService] Request to ${url} failed: ${err.message}`);
      if (process.env.NODE_ENV === 'test') {
        return this.handleFallback(endpoint, method, options);
      }
      throw err;
    }
  }

  /**
   * High-fidelity fallback / simulator for development and offline testing
   */
  handleFallback(endpoint, method, options) {
    if (endpoint.includes('/AccessControl/UserInfo/capabilities')) {
      return {
        UserInfoCap: {
          isSupportEmployeeNo: true,
          nameLen: 32,
          maxUserNum: 10000,
          userType: ['normal', 'visitor', 'blackList'],
        },
      };
    }

    if (endpoint.includes('/AccessControl/UserInfo/Count')) {
      return {
        UserInfoCount: {
          userNumber: 124,
        },
      };
    }

    if (endpoint.includes('/AccessControl/UserInfo/Record') || endpoint.includes('/AccessControl/UserInfo/Modify')) {
      return {
        statusCode: 1,
        statusString: 'OK',
        subStatusCode: 'ok',
        errorCode: 0,
        errorMsg: 'OK',
        deviceIp: this.deviceIp,
      };
    }

    if (endpoint.includes('/AccessControl/CardInfo/Record')) {
      return {
        statusCode: 1,
        statusString: 'OK',
        subStatusCode: 'ok',
        errorCode: 0,
        errorMsg: 'OK',
      };
    }

    if (endpoint.includes('/AccessControl/AcsEvent')) {
      const now = new Date();
      return {
        AcsEvent: {
          searchID: '0',
          totalMatches: 2,
          responseStatusStrg: 'OK',
          numOfMatches: 2,
          InfoList: [
            {
              major: 5,
              minor: 75,
              time: new Date(now.getTime() - 1000 * 60 * 12).toISOString(),
              cardType: 0,
              name: 'Aarav Verma',
              cardNo: 'CARD-88910',
              doorNo: 1,
              employeeNoString: '9999',
              type: 0,
              currentVerifyMode: 'face',
              pictureURL: '',
            },
            {
              major: 5,
              minor: 1,
              time: new Date(now.getTime() - 1000 * 60 * 35).toISOString(),
              cardType: 1,
              name: 'Rahul Sharma',
              cardNo: '123456',
              doorNo: 1,
              employeeNoString: '9998',
              type: 0,
              currentVerifyMode: 'card',
              pictureURL: '',
            },
          ],
        },
      };
    }

    return {
      statusCode: 1,
      statusString: 'Simulated OK',
      isSimulated: true,
      deviceIp: this.deviceIp,
    };
  }

  // --- Person Information ---
  async getCapabilities() {
    return this.request('/ISAPI/AccessControl/UserInfo/capabilities?format=json');
  }

  async getUserCount() {
    return this.request('/ISAPI/AccessControl/UserInfo/Count?format=json');
  }

  async recordPerson(person) {
    const pinStr = (person.pin || person.password) ? String(person.pin || person.password).trim() : null;
    const templateNo = String(person.planTemplateNo || '1');

    const payload = {
      UserInfo: {
        employeeNo: String(person.employeeNo || person.id || '9999'),
        name: (person.name || 'Academy Trainee').slice(0, 32),
        userType: person.userType || 'normal',
        Valid: {
          enable: true,
          beginTime: person.beginTime || new Date().toISOString().slice(0, 19),
          endTime: person.endTime || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 19),
        },
        doorRight: String(person.doorNo || 1),
        RightPlan: [{ doorNo: Number(person.doorNo) || 1, planTemplateNo: templateNo }],
        PersonInfoExtends: [
          { name: 'role', value: person.role || 'student' },
          { name: 'cohort', value: person.cohort || 'JBC-01' },
        ],
      },
    };

    if (pinStr) {
      payload.UserInfo.password = pinStr;
      payload.UserInfo.localPassword = pinStr;
      payload.UserInfo.purePwdVerifyEnable = true;
      payload.UserInfo.userVerifyMode = 'faceOrFpOrCardOrPw';
    }

    let userResult;
    try {
      userResult = await this.request('/ISAPI/AccessControl/UserInfo/Record?format=json', {
        method: 'POST',
        body: payload,
      });
    } catch (err) {
      if (
        err.subStatusCode === 'employeeNoAlreadyExist' ||
        err.data?.subStatusCode === 'employeeNoAlreadyExist' ||
        err.message?.includes('employeeNoAlreadyExist') ||
        err.subStatusCode === 'checkUser' ||
        err.data?.subStatusCode === 'checkUser' ||
        err.message?.includes('checkUser') ||
        err.statusCode === 6 ||
        err.data?.statusCode === 6
      ) {
        userResult = await this.request('/ISAPI/AccessControl/UserInfo/Modify?format=json', {
          method: 'PUT',
          body: payload,
        });
      } else {
        throw err;
      }
    }

    if (person.cardNo && String(person.cardNo).trim()) {
      try {
        await this.recordCard({
          employeeNo: payload.UserInfo.employeeNo,
          cardNo: String(person.cardNo).trim(),
        });
      } catch (cardErr) {
        console.warn(`[HikvisionService] Automatic card provisioning note for employee ${payload.UserInfo.employeeNo}:`, cardErr?.message || cardErr);
      }
    }

    return userResult;
  }

  async modifyPerson(person) {
    const pinStr = (person.pin || person.password) ? String(person.pin || person.password).trim() : null;
    const templateNo = String(person.planTemplateNo || '1');

    const payload = {
      UserInfo: {
        employeeNo: String(person.employeeNo || person.id),
        name: (person.name || 'Academy Trainee').slice(0, 32),
        userType: person.userType || 'normal',
        Valid: {
          enable: true,
          beginTime: person.beginTime,
          endTime: person.endTime,
        },
        doorRight: String(person.doorNo || 1),
        RightPlan: [{ doorNo: Number(person.doorNo) || 1, planTemplateNo: templateNo }],
      },
    };

    if (pinStr) {
      payload.UserInfo.password = pinStr;
      payload.UserInfo.localPassword = pinStr;
      payload.UserInfo.purePwdVerifyEnable = true;
      payload.UserInfo.userVerifyMode = 'faceOrFpOrCardOrPw';
    }

    const result = await this.request('/ISAPI/AccessControl/UserInfo/Modify?format=json', {
      method: 'PUT',
      body: payload,
    });

    if (person.cardNo && String(person.cardNo).trim()) {
      try {
        await this.recordCard({
          employeeNo: payload.UserInfo.employeeNo,
          cardNo: String(person.cardNo).trim(),
        });
      } catch (cardErr) {
        console.warn(`[HikvisionService] Automatic card provisioning note on modify for employee ${payload.UserInfo.employeeNo}:`, cardErr?.message || cardErr);
      }
    }

    return result;
  }

  /**
   * Synchronize coaching batch or member weekly schedule to Hikvision terminal
   * Creates a dedicated UserRightWeekPlanCfg and UserRightPlanTemplate with grace buffer.
   */
  async syncBatchScheduleWeekPlan({ templateNo, batch, schedule, name, code, bufferMinutes = 15 }) {
    const targetSchedule = schedule || batch?.schedule;
    if (!templateNo || !targetSchedule) return null;
    const tNo = Number(templateNo);
    const daysMap = {
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      7: 'Sunday',
    };

    const parseTime = (timeStr) => {
      const [h, m] = (timeStr || '06:00').split(':').map(Number);
      return h * 60 + (m || 0);
    };

    const formatTime = (totalMinutes) => {
      let clamped = Math.max(0, Math.min(1439, totalMinutes));
      const h = String(Math.floor(clamped / 60)).padStart(2, '0');
      const m = String(clamped % 60).padStart(2, '0');
      return `${h}:${m}:00`;
    };

    const startMinutes = parseTime(targetSchedule.startTime);
    const endMinutes = parseTime(targetSchedule.endTime);

    const beginTime = formatTime(startMinutes - bufferMinutes);
    const endTime = formatTime(endMinutes + bufferMinutes);

    const targetDays = Array.isArray(targetSchedule.daysOfWeek) && targetSchedule.daysOfWeek.length > 0
      ? targetSchedule.daysOfWeek
      : [1, 2, 3, 4, 5, 6, 7];

    const weekPlanCfg = targetDays
      .filter((d) => daysMap[d])
      .map((d, idx) => ({
        week: daysMap[d],
        id: idx + 1,
        enable: true,
        TimeSegment: {
          beginTime,
          endTime,
        },
      }));

    // 1. Program the WeekPlan on the device
    await this.request(`/ISAPI/AccessControl/UserRightWeekPlanCfg/${tNo}?format=json`, {
      method: 'PUT',
      body: {
        UserRightWeekPlanCfg: {
          enable: true,
          WeekPlanCfg: weekPlanCfg,
        },
      },
    });

    // 2. Program the PlanTemplate pointing to that WeekPlan
    const cleanTemplateName = (name || code || batch?.code || batch?.name || `Slot_${tNo}`)
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 32);

    return await this.request(`/ISAPI/AccessControl/UserRightPlanTemplate/${tNo}?format=json`, {
      method: 'PUT',
      body: {
        UserRightPlanTemplate: {
          enable: true,
          templateName: cleanTemplateName,
          weekPlanNo: tNo,
          holidayGroupNo: '',
        },
      },
    });
  }

  async syncScheduleWeekPlan(args) {
    return this.syncBatchScheduleWeekPlan(args);
  }

  async deleteUser(employeeNo) {
    try {
      await this.deleteCard(employeeNo);
    } catch {
      // Ignore if card was not registered or already removed
    }
    const payload = {
      UserInfoDetail: {
        mode: 'byEmployeeNo',
        EmployeeNoList: [{ employeeNo: String(employeeNo) }],
      },
    };
    return this.request('/ISAPI/AccessControl/UserInfoDetail/Delete?format=json', {
      method: 'PUT',
      body: payload,
    });
  }

  // --- Dynamic PIN Assignment for Court / Sport Gate ---
  async assignPin({ employeeNo, pin, beginTime, endTime, userName, doorNo = 1, cardNo }) {
    const cleanName = (userName ? `${employeeNo} - ${userName}` : `${employeeNo}`)
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .slice(0, 32);

    const pinStr = String(pin).trim();
    const payload = {
      UserInfo: {
        employeeNo: String(employeeNo),
        name: cleanName,
        userType: 'normal',
        Valid: {
          enable: true,
          beginTime: beginTime || '2026-01-01T00:00:00',
          endTime: endTime || '2030-12-31T23:59:59',
        },
        doorRight: String(doorNo || 1),
        RightPlan: [
          { doorNo: Number(doorNo) || 1, planTemplateNo: '1' },
        ],
        password: pinStr,
        localPassword: pinStr,
        purePwdVerifyEnable: true,
        userVerifyMode: 'faceOrFpOrCardOrPw',
        PersonInfoExtends: [{ name: cleanName.slice(0, 32), value: pinStr }],
      },
    };

    let userResult;
    try {
      userResult = await this.request('/ISAPI/AccessControl/UserInfo/Record?format=json', {
        method: 'POST',
        body: payload,
      });
    } catch (err) {
      const isAlreadyExists =
        err.subStatusCode === 'employeeNoAlreadyExist' ||
        err.data?.subStatusCode === 'employeeNoAlreadyExist' ||
        err.message?.includes('employeeNoAlreadyExist') ||
        err.data?.errorCode === '1073741829' ||
        err.statusCode === 6 ||
        err.data?.statusCode === 6 ||
        err.data?.statusCode === '6' ||
        err.statusCode === 4 ||
        err.data?.statusCode === '4';

      if (isAlreadyExists) {
        console.log(`[HikvisionService] User ${employeeNo} already exists on device, updating with Modify (PUT)...`);
        userResult = await this.request('/ISAPI/AccessControl/UserInfo/Modify?format=json', {
          method: 'PUT',
          body: payload,
        });
      } else {
        throw err;
      }
    }

    // Only provision RFID card if explicitly requested (or fallback to PIN only if explicitly cardNo is undefined)
    const targetCardNo = cardNo ? String(cardNo).trim() : null;
    if (targetCardNo) {
      try {
        await this.recordCard({ employeeNo: String(employeeNo), cardNo: targetCardNo });
      } catch (cardErr) {
        console.warn(`[HikvisionService] Non-blocking card registration note for employee ${employeeNo}:`, cardErr?.message || cardErr);
      }
    }

    return userResult;
  }

  // --- Card Information ---
  async recordCard({ employeeNo, cardNo, cardType = 'normalCard' }) {
    if (!cardNo || !String(cardNo).trim()) return null;
    const cleanCardNo = String(cardNo).trim();
    const cleanEmpNo = String(employeeNo).trim();

    const payload = {
      CardInfo: {
        employeeNo: cleanEmpNo,
        cardNo: cleanCardNo,
        cardType,
      },
    };

    try {
      return await this.request('/ISAPI/AccessControl/CardInfo/Record?format=json', {
        method: 'POST',
        body: payload,
      });
    } catch (err) {
      const isCardConflict =
        err.subStatusCode === 'cardNoAlreadyExist' ||
        err.data?.subStatusCode === 'cardNoAlreadyExist' ||
        err.message?.includes('cardNoAlreadyExist') ||
        err.subStatusCode === 'checkEmployeeNo' ||
        err.data?.subStatusCode === 'checkEmployeeNo' ||
        err.message?.includes('checkEmployeeNo') ||
        err.statusCode === 6 ||
        err.data?.statusCode === 6;

      if (isCardConflict && err.subStatusCode !== 'employeeNoNotExist') {
        try {
          return await this.request('/ISAPI/AccessControl/CardInfo/Modify?format=json', {
            method: 'PUT',
            body: payload,
          });
        } catch (modifyErr) {
          // If modify fails (e.g., card bound to another employee or internal state), delete existing card and re-record
          try {
            console.log(`[HikvisionService] Card conflict on modify for ${cleanEmpNo}, cleaning existing card record...`);
            await this.deleteCard(cleanEmpNo);
            return await this.request('/ISAPI/AccessControl/CardInfo/Record?format=json', {
              method: 'POST',
              body: payload,
            });
          } catch (delErr) {
            console.warn(`[HikvisionService] Re-binding card ${cleanCardNo} error:`, delErr?.message || delErr);
            throw modifyErr;
          }
        }
      }
      throw err;
    }
  }

  async deleteCard(employeeNo) {
    const payload = {
      CardInfoDelCond: {
        EmployeeNoList: [{ employeeNo: String(employeeNo) }],
      },
    };
    return this.request('/ISAPI/AccessControl/CardInfo/Delete?format=json', {
      method: 'PUT',
      body: payload,
    });
  }

  // --- Face Data Upload (FDLib) ---
  async uploadFace(employeeNo, imageBase64OrBuffer, fdId = '1') {
    let imgBuffer;
    if (Buffer.isBuffer(imageBase64OrBuffer)) {
      imgBuffer = imageBase64OrBuffer;
    } else if (typeof imageBase64OrBuffer === 'string') {
      const cleanBase64 = imageBase64OrBuffer.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
      imgBuffer = Buffer.from(cleanBase64, 'base64');
    } else {
      throw new Error('Image data must be a Buffer or Base64 string');
    }

    const cleanEmpNo = String(employeeNo).trim();
    const boundary = '----HikvisionFDLibBoundary' + Date.now();
    const jsonPart = JSON.stringify({
      faceLibType: 'blackFD',
      FDID: String(fdId),
      FPID: cleanEmpNo,
    });

    const fullBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="FaceDataRecord"\r\nContent-Type: application/json\r\n\r\n${jsonPart}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="img"; filename="${cleanEmpNo}.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      imgBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    try {
      return await this.request('/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(fullBody.length),
        },
        body: fullBody,
      });
    } catch (err) {
      // If user already has a face in FDLib on device, update it via FDSetUp (PUT)
      const isAlreadyExist =
        err.data?.subStatusCode === 'deviceUserAlreadyExistFace' ||
        err.message?.includes('deviceUserAlreadyExistFace') ||
        err.message?.includes('AlreadyExist');

      if (isAlreadyExist) {
        console.log(`[HikvisionService] Face already exists for ${cleanEmpNo}, updating via FDSetUp PUT...`);
        return await this.request('/ISAPI/Intelligent/FDLib/FDSetUp?format=json', {
          method: 'PUT',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': String(fullBody.length),
          },
          body: fullBody,
        });
      }

      // If user does not exist on device yet, auto-register person on terminal then retry face upload
      const isUserNotExist =
        err.data?.subStatusCode === 'employeeNoNotExist' ||
        err.message?.includes('employeeNoNotExist');

      if (isUserNotExist) {
        console.log(`[HikvisionService] User ${cleanEmpNo} not yet on device, creating user and retrying face upload...`);
        try {
          await this.recordPerson({
            employeeNo: cleanEmpNo,
            name: cleanEmpNo,
            userType: 'normal',
            planTemplateNo: 1,
          });
          return await this.request('/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json', {
            method: 'POST',
            headers: {
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Content-Length': String(fullBody.length),
            },
            body: fullBody,
          });
        } catch (retryErr) {
          throw retryErr;
        }
      }

      throw err;
    }
  }

  // --- Search Users on Device ---
  async searchUsers({ position = 0, maxResults = 30 } = {}) {
    const payload = {
      UserInfoSearchCond: {
        searchID: '1',
        searchResultPosition: position,
        maxResults,
        EmployeeNoList: [],
      },
    };
    return this.request('/ISAPI/AccessControl/UserInfo/Search?format=json', {
      method: 'POST',
      body: payload,
    });
  }

  // --- AcsEvent (Attendance Log Queries) ---
  async getAcsEvents({
    searchID = '1',
    searchResultPosition = 0,
    maxResults = 50,
    major = 0,
    minor = 0,
    startTime = null,
    endTime = null,
  } = {}) {
    const pad = (n) => String(n).padStart(2, '0');
    const formatHikTime = (d) => {
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const mins = pad(d.getMinutes());
      const secs = pad(d.getSeconds());
      return `${year}-${month}-${day}T${hours}:${mins}:${secs}+05:30`;
    };

    const start = startTime || formatHikTime(new Date(Date.now() - 30 * 24 * 3600 * 1000));
    const end = endTime || formatHikTime(new Date());

    const payload = {
      AcsEventCond: {
        searchID: String(searchID),
        searchResultPosition,
        maxResults,
        major,
        minor,
        startTime: start,
        endTime: end,
      },
    };

    return this.request('/ISAPI/AccessControl/AcsEvent?format=json', {
      method: 'POST',
      body: payload,
    });
  }

  // --- Webhook / HTTP Host Notification Subscription ---
  async configureHttpHostNotification({ hostUrl, ipAddress, portNo = 5000 }) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
    <HttpHostNotification>
        <id>1</id>
        <url>${hostUrl || '/api/v1/attendance/automated/webhook'}</url>
        <protocolType>HTTP</protocolType>
        <addressingFormatType>ipaddress</addressingFormatType>
        <ipAddress>${ipAddress || '127.0.0.1'}</ipAddress>
        <portNo>${portNo}</portNo>
        <httpAuthenticationMethod>none</httpAuthenticationMethod>
        <SubscribeEvent>
            <heartbeat>30</heartbeat>
            <eventMode>all</eventMode>
            <EventList>
                <Event>
                    <type>AccessControllerEvent</type>
                    <pictureURLType>binary</pictureURLType>
                </Event>
            </EventList>
        </SubscribeEvent>
    </HttpHostNotification>
</HttpHostNotificationList>`;

    return this.request('/ISAPI/Event/notification/httpHosts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
    });
  }

  /**
   * Remotely open / close / alwaysOpen / alwaysClose door
   * @param {number} doorNo - Door number (default 1)
   * @param {string} cmd - Command: 'open' | 'close' | 'alwaysOpen' | 'alwaysClose'
   */
  async remoteControlDoor(doorNo = 1, cmd = 'open') {
    const xml = `<?xml version="1.0" encoding="utf-8"?><RemoteControlDoor><cmd>${cmd}</cmd></RemoteControlDoor>`;
    return this.request(`/ISAPI/AccessControl/RemoteControl/door/${doorNo}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
    });
  }
}

export const hikvisionService = new HikvisionService({
  ip: process.env.HIKVISION_IP || '64.4.193.66',
  port: process.env.HIKVISION_PORT || 4231,
  username: process.env.HIKVISION_USERNAME || 'admin',
  password: process.env.HIKVISION_PASSWORD || 'Amd@737373',
  protocol: process.env.HIKVISION_PROTOCOL || 'http',
});
