import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tenant academy name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Tenant unique slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    domain: {
      type: String,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'trial', 'cancelled'],
      default: 'active',
    },
    plan: {
      type: String,
      enum: ['free', 'basic', 'professional', 'enterprise'],
      default: 'basic',
    },
    dbStrategy: {
      type: String,
      enum: ['A', 'B'],
      default: 'A',
    },
    databaseName: {
      type: String,
      trim: true,
    },
    dbUri: {
      type: String,
      select: false, // Hidden by default for security
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        taxPercentage: 18,
        cancellationCutoffHours: 12,
        openingTime: '00:00',
        closingTime: '24:00',
        is24Hours: true,
        holdTtlMinutes: 5,
        doorBufferMinutes: 15,
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
      }),
    },
    branding: {
      logoUrl: { type: String, default: null },
      primaryColor: { type: String, default: '#1769FF' },
      accentColor: { type: String, default: '#FFD928' },
    },
    limits: {
      maxBranches: { type: Number, default: 3 },
      maxCourts: { type: Number, default: 10 },
      maxUsers: { type: Number, default: 50 },
    },
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema);
