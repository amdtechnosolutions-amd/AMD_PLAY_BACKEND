export const registerDeviceSchema = {
  description: 'Register a new IoT device / Hikvision biometric terminal / smart relay / door lock',
  tags: ['IoT & Hardware Automation'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['branchId', 'name', 'code', 'type'],
    properties: {
      branchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Branch ID' },
      name: { type: 'string', minLength: 2, description: 'Device Name (e.g. Badminton Gate 1 Hikvision)' },
      code: { type: 'string', minLength: 2, maxLength: 30, description: 'Unique device code (e.g. DEV-BIO-BADM-01)' },
      type: {
        type: 'string',
        enum: ['relay', 'door_lock', 'turnstile', 'biometric', 'biometric_terminal', 'access_control', 'sensor', 'gateway'],
        description: 'Device type (e.g. biometric for Hikvision access control)',
      },
      sportId: { type: ['string', 'null'], nullable: true, description: 'Primary Assigned Sport ID' },
      sportIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Assigned Sport IDs (Device can serve multiple sports like Badminton + Squash)',
      },
      resourceId: { type: ['string', 'null'], nullable: true, description: 'Primary Assigned Court / Resource ID' },
      resourceIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Assigned Court / Resource IDs (Device can serve multiple courts)',
      },
      accessScope: {
        type: 'string',
        enum: ['court', 'sport', 'multi_sport', 'branch_entrance', 'global'],
        description: 'Access boundary: court-specific, sport-specific, multi-sport shared, or branch entrance',
      },
      ipAddress: { type: 'string', description: 'Device IP address (e.g. 192.168.1.100)' },
      port: { type: 'integer', default: 80, description: 'Device HTTP/ISAPI port' },
      protocol: { type: 'string', enum: ['http', 'https', 'mqtt', 'modbus_tcp', 'tcp'], default: 'http' },
      username: { type: 'string', default: 'admin', description: 'Device admin username' },
      password: { type: 'string', description: 'Device admin password' },
      doorNo: { type: 'integer', default: 1, description: 'Door number on multi-door access controller' },
      isDefaultEntrance: { type: 'boolean', default: false, description: 'True if device is at main entrance gate' },
      macAddress: { type: 'string' },
      mqttTopic: { type: 'string' },
      relayChannels: {
        type: 'array',
        items: {
          type: 'object',
          required: ['channelNumber'],
          properties: {
            channelNumber: { type: 'integer', minimum: 1, maximum: 32 },
            target: { type: 'string', enum: ['light', 'fan', 'ac', 'lock', 'other'] },
            state: { type: 'string', enum: ['on', 'off'] },
            label: { type: 'string' },
          },
        },
      },
      apiKey: { type: 'string' },
    },
  },
};

export const queryDevicesSchema = {
  description: 'List IoT devices with filtering and pagination',
  tags: ['IoT & Hardware Automation'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      branchId: { type: 'string' },
      sportId: { type: 'string' },
      type: { type: 'string' },
      status: { type: 'string' },
      resourceId: { type: 'string' },
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
  },
};


export const toggleRelaySchema = {
  description: 'Remotely toggle a relay channel (Lights, Fans, AC, Lock; channel 0 = ALL)',
  tags: ['IoT & Hardware Automation'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
  body: {
    type: 'object',
    required: ['channelNumber', 'state'],
    properties: {
      channelNumber: { type: 'integer', minimum: 0, maximum: 32 },
      state: { type: 'string', enum: ['on', 'off'] },
    },
  },
};

export const masterRelaySchema = {
  description: 'Remotely switch ALL relay channels on a device (Master ON / Master OFF)',
  tags: ['IoT & Hardware Automation'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
  body: {
    type: 'object',
    required: ['state'],
    properties: {
      state: { type: 'string', enum: ['on', 'off'] },
    },
  },
};

export const courtLightingSchema = {
  description: 'Turn court lighting automation ON or OFF for a specific court',
  tags: ['IoT & Hardware Automation'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['resourceId'],
    properties: {
      resourceId: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
  body: {
    type: 'object',
    required: ['state'],
    properties: {
      state: { type: 'string', enum: ['on', 'off'] },
    },
  },
};

export const deviceHeartbeatSchema = {
  description: 'Report device heartbeat / telemetry from edge hardware',
  tags: ['IoT & Hardware Automation'],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
  body: {
    type: 'object',
    properties: {
      ipAddress: { type: 'string' },
      status: { type: 'string' },
    },
  },
};

export const verifyAccessSchema = {
  description: 'Validate 6-digit access PIN or QR code at turnstile or door lock',
  tags: ['IoT & Hardware Automation'],
  body: {
    type: 'object',
    required: ['deviceId'],
    properties: {
      deviceId: { type: 'string', minLength: 24, maxLength: 24 },
      pin: { type: 'string', minLength: 4, maxLength: 10 },
      qrCode: { type: 'string' },
      simulatedTime: { type: 'string' },
    },
  },
};

export const deviceParamSchema = {
  description: 'Device ID parameter',
  tags: ['IoT & Hardware Automation'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24 },
    },
  },
};

export const updateDeviceSchema = {
  description: 'Update an existing IoT device configuration / status / mappings',
  tags: ['IoT & Hardware Automation'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Device ID' },
    },
  },
  body: {
    type: 'object',
    properties: {
      branchId: { type: 'string', minLength: 24, maxLength: 24, description: 'Branch ID' },
      name: { type: 'string', minLength: 2, description: 'Device Name' },
      code: { type: 'string', minLength: 2, maxLength: 30, description: 'Unique device code' },
      type: {
        type: 'string',
        enum: ['relay', 'door_lock', 'turnstile', 'biometric', 'biometric_terminal', 'access_control', 'sensor', 'gateway'],
        description: 'Device type',
      },
      sportId: { type: ['string', 'null'], nullable: true, description: 'Primary Assigned Sport ID' },
      sportIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Assigned Sport IDs',
      },
      resourceId: { type: ['string', 'null'], nullable: true, description: 'Primary Assigned Court / Resource ID' },
      resourceIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Assigned Court / Resource IDs',
      },
      accessScope: {
        type: 'string',
        enum: ['court', 'sport', 'multi_sport', 'branch_entrance', 'global'],
        description: 'Access boundary',
      },
      ipAddress: { type: 'string', description: 'Device IP address' },
      port: { type: 'integer', description: 'Device HTTP/ISAPI port' },
      protocol: { type: 'string', enum: ['http', 'https', 'mqtt', 'modbus_tcp', 'tcp'] },
      username: { type: 'string', description: 'Device admin username' },
      password: { type: 'string', description: 'Device admin password' },
      doorNo: { type: 'integer', description: 'Door number on multi-door access controller' },
      isDefaultEntrance: { type: 'boolean', description: 'True if device is at main entrance gate' },
      macAddress: { type: 'string' },
      mqttTopic: { type: 'string' },
      relayChannels: {
        type: 'array',
        items: {
          type: 'object',
          required: ['channelNumber'],
          properties: {
            channelNumber: { type: 'integer', minimum: 1, maximum: 32 },
            target: { type: 'string', enum: ['light', 'fan', 'ac', 'lock', 'other'] },
            state: { type: 'string', enum: ['on', 'off'] },
            label: { type: 'string' },
          },
        },
      },
      apiKey: { type: 'string' },
      status: {
        type: 'string',
        enum: ['online', 'offline', 'maintenance', 'error'],
        description: 'Device operational status',
      },
      metadata: { type: 'object' },
    },
  },
};

export const deleteDeviceSchema = {
  description: 'Delete an IoT device / Access control terminal',
  tags: ['IoT & Hardware Automation'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 24, maxLength: 24, description: 'Device ID' },
    },
  },
};

