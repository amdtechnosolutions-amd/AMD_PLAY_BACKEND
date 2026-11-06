import { BaseService } from '../../core/BaseService.js';
import { tenantRepository } from './tenant.repository.js';
import { userRepository } from '../users/user.repository.js';
import { branchRepository } from '../branches/branch.repository.js';
import { hashPassword } from '../../utils/password.js';
import { ROLES } from '../../config/constants.js';
import { ConflictError, NotFoundError } from '../../errors/AppError.js';
import { getTenantDatabaseName, getTenantDatabaseUri, provisionTenantDatabase } from '../../utils/tenantDatabase.js';
import { logger } from '../../utils/logger.js';

export class TenantService extends BaseService {
  constructor() {
    super(tenantRepository, 'Tenant');
  }

  async createTenant(data) {
    const { adminUser, ...tenantData } = data;

    // 1. Auto-generate slug if not provided
    let slug = (tenantData.slug || tenantData.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Ensure unique slug
    let existing = await tenantRepository.findBySlug(slug);
    if (existing) {
      if (tenantData.slug) {
        throw new ConflictError(`An academy with slug '${slug}' already exists`);
      }
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }
    tenantData.slug = slug;

    if (tenantData.domain) {
      const existingDomain = await tenantRepository.findByDomain(tenantData.domain);
      if (existingDomain) {
        throw new ConflictError(`An academy with domain '${tenantData.domain}' already exists`);
      }
    }

    // 2. Auto-generate dedicated database name: e.g. amd_play_<slug>
    const databaseName = tenantData.databaseName || getTenantDatabaseName(slug);
    const dbUri = tenantData.dbUri || getTenantDatabaseUri(databaseName);
    tenantData.databaseName = databaseName;
    tenantData.dbUri = dbUri;
    tenantData.contactEmail = (tenantData.contactEmail || adminUser?.email || `admin@${slug}.com`).toLowerCase().trim();

    const tenant = await this.repository.create(tenantData);

    // 3. Automatically provision default Main Branch with payment template
    const branchCode = 'MAIN';
    let defaultBranch = null;
    try {
      defaultBranch = await branchRepository.create({
        tenantId: tenant._id,
        name: `${tenant.name} - Main Branch`,
        code: branchCode,
        address: tenantData.address || {
          street: 'Main Campus Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'India',
        },
        contactPhone: tenantData.contactPhone || adminUser?.phone || '',
        contactEmail: tenantData.contactEmail,
        paymentSettings: {
          razorpay: { enabled: false, keyId: '', keySecret: '', webhookSecret: '' },
          upi: { enabled: false, upiId: '', merchantName: tenant.name, qrImageUrl: '' },
          bankAccount: { accountNumber: '', ifscCode: '', bankName: '', accountHolder: tenant.name },
          cashAccepted: true,
        },
        operatingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          dayOfWeek,
          openTime: '00:00',
          closeTime: '24:00',
          isOpen: true,
        })),
        is24Hours: true,
        timezone: 'Asia/Kolkata',
        status: 'active',
      });
      logger.info({ branchId: defaultBranch._id, branchCode }, 'Main branch auto-provisioned for new academy');
    } catch (branchErr) {
      logger.warn({ err: branchErr.message }, 'Warning: Could not auto-create main branch');
    }

    // 4. Create Academy Admin user if provided
    let createdAdmin = null;
    if (adminUser && adminUser.email) {
      const hashedPassword = await hashPassword(adminUser.password || 'Password123!');
      const user = await userRepository.create({
        firstName: adminUser.firstName || 'Academy',
        lastName: adminUser.lastName || 'Admin',
        email: adminUser.email.toLowerCase(),
        phone: adminUser.phone || tenantData.contactPhone || '',
        password: hashedPassword,
        role: ROLES.TENANT_ADMIN,
        tenantId: tenant._id,
        branchId: defaultBranch?._id || null,
        status: 'active',
      });
      createdAdmin = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        branchId: defaultBranch?._id || null,
      };
    }

    // 5. Physically provision the new database in MongoDB
    try {
      await provisionTenantDatabase(tenant, adminUser, defaultBranch);
    } catch (dbErr) {
      logger.warn({ err: dbErr.message, databaseName }, 'Warning during tenant DB provisioning');
    }

    const resObj = tenant.toObject ? tenant.toObject() : tenant;
    return {
      ...resObj,
      tenantId: tenant._id,
      databaseName,
      slug,
      loginUrl: `/login?tenant=${slug}`,
      mainBranch: defaultBranch,
      adminUser: createdAdmin,
    };
  }

  async lookupBySlug(slug) {
    const tenant = await tenantRepository.findBySlug(slug);
    if (!tenant) {
      throw new NotFoundError(`Sports academy '${slug}' not found`);
    }

    return {
      id: tenant._id,
      tenantId: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain || null,
      plan: tenant.plan,
      status: tenant.status,
      branding: tenant.branding,
      settings: tenant.settings,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      loginUrl: `/login?tenant=${tenant.slug}`,
    };
  }

  async lookupByEmail(email) {
    if (!email) {
      throw new ValidationError('Email is required to lookup academy');
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await userRepository.findByEmailWithPassword(cleanEmail, null);
    if (!user) {
      throw new NotFoundError(`No user account found for email '${cleanEmail}'`);
    }

    if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.PLATFORM_ADMIN) {
      return {
        isSuperAdmin: true,
        email: user.email,
        message: 'This account is a Master Platform SuperAdmin (no tenant slug required).',
        slug: null,
      };
    }

    if (!user.tenantId) {
      throw new NotFoundError(`User '${cleanEmail}' is not associated with any academy franchise`);
    }

    const tenant = await tenantRepository.findById(user.tenantId);
    if (!tenant) {
      throw new NotFoundError(`Associated academy tenant could not be found`);
    }

    return {
      id: tenant._id,
      tenantId: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain || null,
      plan: tenant.plan,
      status: tenant.status,
      branding: tenant.branding,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      loginUrl: `/login?tenant=${tenant.slug}`,
    };
  }
}

export const tenantService = new TenantService();

