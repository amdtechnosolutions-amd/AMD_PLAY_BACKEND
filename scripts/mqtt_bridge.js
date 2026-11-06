import 'dotenv/config';
import net from 'node:net';
import mongoose from 'mongoose';

const LOCAL_PORT = 1883;
const LOCAL_HOST = '127.0.0.1';
const LISTEN_PORT = 1883;
const LISTEN_HOST = '103.99.36.60';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:41111/amd_play';

// Simple in-memory rate limiter per remote IP
const connectionAttempts = new Map();

// Localhost and internal server loopbacks that skip verification
const INTERNAL_IPS = new Set(['127.0.0.1', '::1', '103.99.36.60']);

// Cache of authorized device client IDs (synced from MongoDB + defaults)
const authorizedClientIds = new Set([
  'smartelex_relay_badminton',
  'sports_academy_backend',
]);

if (process.env.MQTT_ALLOWED_CLIENT_IDS) {
  process.env.MQTT_ALLOWED_CLIENT_IDS.split(',').forEach((id) => {
    const trimmed = id.trim();
    if (trimmed) {
      authorizedClientIds.add(trimmed);
      authorizedClientIds.add(trimmed.toLowerCase());
    }
  });
}

// Trusted device prefix conventions for multi-tenant IoT devices
const ALLOWED_ID_PREFIXES = [
  'smartelex_',
  'dev-',
  'DEV-',
  'isa_',
  'ISA_',
  'sports_',
];

let dbConnected = false;

// Connect to MongoDB and sync registered devices across all tenants
async function initDb() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    dbConnected = true;
    console.log('[MQTT Bridge] Connected to MongoDB for dynamic device authorization');
    await syncAuthorizedDevices();
    setInterval(syncAuthorizedDevices, 30000); // Re-sync every 30s
  } catch (err) {
    console.warn('[MQTT Bridge] MongoDB connection warning:', err.message);
    setTimeout(initDb, 10000); // Retry in 10s
  }
}

async function syncAuthorizedDevices() {
  if (!dbConnected) return;
  try {
    const devices = await mongoose.connection.collection('devices').find(
      {},
      { projection: { code: 1, apiKey: 1, mqttTopic: 1, metadata: 1 } }
    ).toArray();

    for (const d of devices) {
      if (d.code) {
        authorizedClientIds.add(d.code);
        authorizedClientIds.add(d.code.toLowerCase());
        authorizedClientIds.add(d.code.toUpperCase());
      }
      if (d._id) authorizedClientIds.add(d._id.toString());
      if (d.apiKey) authorizedClientIds.add(d.apiKey);
      if (d.metadata?.clientId) {
        authorizedClientIds.add(d.metadata.clientId);
        authorizedClientIds.add(d.metadata.clientId.toLowerCase());
      }
    }
  } catch (err) {
    console.warn('[MQTT Bridge] Error syncing authorized devices from DB:', err.message);
  }
}

async function isClientIdAuthorized(clientId) {
  if (!clientId || typeof clientId !== 'string') return false;
  const trimmed = clientId.trim();
  if (!trimmed) return false;

  // 1. Check in-memory cache
  if (
    authorizedClientIds.has(trimmed) ||
    authorizedClientIds.has(trimmed.toLowerCase()) ||
    authorizedClientIds.has(trimmed.toUpperCase())
  ) {
    return true;
  }

  // 2. Check trusted prefix conventions
  for (const prefix of ALLOWED_ID_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      authorizedClientIds.add(trimmed);
      return true;
    }
  }

  // 3. Fallback: Query MongoDB directly (in case device was registered seconds ago)
  if (dbConnected) {
    try {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const dev = await mongoose.connection.collection('devices').findOne({
        $or: [
          { code: new RegExp(`^${escaped}$`, 'i') },
          { apiKey: trimmed },
          { 'metadata.clientId': trimmed },
        ],
      });
      if (dev) {
        authorizedClientIds.add(trimmed);
        authorizedClientIds.add(trimmed.toLowerCase());
        return true;
      }
    } catch (_) {}
  }

  return false;
}

function normalizeIp(ip) {
  if (!ip) return '';
  return ip.replace(/^::ffff:/, '').trim();
}

function isRateLimited(ip) {
  const now = Date.now();
  const record = connectionAttempts.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + 60000;
  }
  record.count += 1;
  connectionAttempts.set(ip, record);
  return record.count > 120; // Max 120 connection attempts per minute per IP
}

/**
 * Parses MQTT CONNECT packet from initial buffer
 * Supports MQTT 3.1.1 and 3.1 specifications
 */
function parseMqttConnectPacket(buf) {
  if (!buf || buf.length < 2) return null;
  // Byte 0: Packet type must be 1 (CONNECT = 0x10)
  if ((buf[0] >> 4) !== 1) return null;

  let offset = 1;
  let multiplier = 1;
  let remainingLength = 0;
  let encodedByte;
  do {
    if (offset >= buf.length) return null; // Incomplete
    encodedByte = buf[offset++];
    remainingLength += (encodedByte & 127) * multiplier;
    multiplier *= 128;
    if (multiplier > 128 * 128 * 128) return null;
  } while ((encodedByte & 128) !== 0);

  // Variable Header: Protocol Name
  if (offset + 2 > buf.length) return null;
  const protoLen = buf.readUInt16BE(offset);
  offset += 2;

  if (offset + protoLen + 4 > buf.length) return null;
  const protoName = buf.toString('utf8', offset, offset + protoLen);
  offset += protoLen;

  if (protoName !== 'MQTT' && protoName !== 'MQIsdp') return null;

  const protoLevel = buf[offset++];
  const connectFlags = buf[offset++];
  offset += 2; // skip keepalive

  // Payload: Client Identifier (Length-prefixed UTF-8 string)
  if (offset + 2 > buf.length) return null;
  const clientIdLen = buf.readUInt16BE(offset);
  offset += 2;

  if (offset + clientIdLen > buf.length) return null;
  const clientId = buf.toString('utf8', offset, offset + clientIdLen);

  return { clientId, protoName, protoLevel };
}

const server = net.createServer((clientSocket) => {
  const remoteIp = clientSocket.remoteAddress;
  const remoteAddr = `${remoteIp}:${clientSocket.remotePort}`;
  const cleanIp = normalizeIp(remoteIp);

  // Security Check 1: Anti-DDoS Rate Limiting
  if (isRateLimited(cleanIp)) {
    console.warn(`[MQTT Bridge] Rate limit exceeded for ${cleanIp}. Dropping connection.`);
    clientSocket.destroy();
    return;
  }

  // Fast-track internal / localhost loopback connections
  if (INTERNAL_IPS.has(cleanIp)) {
    const brokerSocket = net.connect(LOCAL_PORT, LOCAL_HOST, () => {
      clientSocket.pipe(brokerSocket);
      brokerSocket.pipe(clientSocket);
    });
    clientSocket.on('error', () => {});
    brokerSocket.on('error', () => {});
    clientSocket.on('close', () => brokerSocket.end());
    brokerSocket.on('close', () => clientSocket.end());
    return;
  }

  // For all external connections (any dynamic IP from any tenant/user):
  // Wait for MQTT CONNECT packet and authorize by Device Client ID
  let accumulatedBuffer = Buffer.alloc(0);
  let isAuthorized = false;
  let brokerSocket = null;

  // 5-second handshake timeout to prevent hanging connections
  const handshakeTimer = setTimeout(() => {
    if (!isAuthorized) {
      console.warn(`[MQTT Bridge] [TIMEOUT] Handshake timed out from ${remoteAddr}. Dropping.`);
      clientSocket.destroy();
    }
  }, 5000);

  const onData = async (chunk) => {
    accumulatedBuffer = Buffer.concat([accumulatedBuffer, chunk]);

    // Validation 1: First byte MUST be 0x10 (MQTT CONNECT). Drop HTTP scanners/bots immediately.
    if (accumulatedBuffer.length > 0 && (accumulatedBuffer[0] >> 4) !== 1) {
      clearTimeout(handshakeTimer);
      clientSocket.removeListener('data', onData);
      console.warn(`[MQTT Bridge] [BLOCKED] Non-MQTT packet (0x${accumulatedBuffer[0].toString(16)}) from ${remoteAddr}. Dropping.`);
      clientSocket.destroy();
      return;
    }

    // Try parsing the MQTT CONNECT packet
    const parsed = parseMqttConnectPacket(accumulatedBuffer);
    if (!parsed) {
      // Incomplete packet; wait for next TCP chunk if within reasonable size
      if (accumulatedBuffer.length > 4096) {
        clearTimeout(handshakeTimer);
        clientSocket.removeListener('data', onData);
        console.warn(`[MQTT Bridge] [BLOCKED] Oversized/malformed CONNECT packet from ${remoteAddr}. Dropping.`);
        clientSocket.destroy();
      }
      return;
    }

    // Packet successfully parsed -> Validate Client ID
    clearTimeout(handshakeTimer);
    clientSocket.pause();
    clientSocket.removeListener('data', onData);

    const valid = await isClientIdAuthorized(parsed.clientId);

    if (!valid) {
      console.warn(`[MQTT Bridge] [BLOCKED] Unauthorized client ID '${parsed.clientId}' from ${remoteAddr} (IP: ${cleanIp}). Dropping.`);
      clientSocket.destroy();
      return;
    }

    // Device authorized! Connect to local Mosquitto broker
    isAuthorized = true;
    console.log(`[MQTT Bridge] [${new Date().toISOString()}] [AUTHORIZED] Device '${parsed.clientId}' accepted from ${remoteAddr} (IP: ${cleanIp})`);

    // Update device status and public IP in MongoDB in background
    if (dbConnected) {
      mongoose.connection.collection('devices').updateOne(
        {
          $or: [
            { code: parsed.clientId },
            { code: parsed.clientId.toUpperCase() },
            { code: parsed.clientId.toLowerCase() },
            { 'metadata.clientId': parsed.clientId },
            { apiKey: parsed.clientId },
          ],
        },
        {
          $set: {
            status: 'online',
            lastHeartbeat: new Date(),
            lastPublicIp: cleanIp,
          },
        }
      ).catch(() => {});
    }

    brokerSocket = net.connect(LOCAL_PORT, LOCAL_HOST, () => {
      // Forward the buffered initial CONNECT packet
      brokerSocket.write(accumulatedBuffer);

      // Pipe remaining traffic bidirectionally
      clientSocket.pipe(brokerSocket);
      brokerSocket.pipe(clientSocket);
      clientSocket.resume();
    });

    brokerSocket.on('error', (err) => {
      console.error(`[MQTT Bridge] Broker connection error for ${remoteAddr}:`, err.message);
      clientSocket.destroy();
    });

    brokerSocket.on('close', () => {
      clientSocket.end();
    });
  };

  clientSocket.on('data', onData);

  clientSocket.on('error', (err) => {
    clearTimeout(handshakeTimer);
  });

  clientSocket.on('close', () => {
    clearTimeout(handshakeTimer);
    if (brokerSocket) brokerSocket.end();
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[MQTT Bridge] Port ${LISTEN_PORT} already in use.`);
  } else {
    console.error('[MQTT Bridge] Server error:', err.message);
  }
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[MQTT Bridge] Device Auth Bridge active on ${LISTEN_HOST}:${LISTEN_PORT} -> forwarding to ${LOCAL_HOST}:${LOCAL_PORT}`);
  initDb().catch((e) => console.error('[MQTT Bridge] initDb error:', e.message));
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
