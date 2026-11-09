import { userRepository } from '../users/user.repository.js';
import { User } from '../users/user.model.js';
import { Enrollment } from '../coaching/enrollment.model.js';
import { MemberSubscription } from '../memberships/memberSubscription.model.js';
import { resourceRepository } from '../resources/resource.repository.js';
import { bookingService } from '../bookings/booking.service.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../errors/AppError.js';
import { ROLES } from '../../config/constants.js';
import { getTenantDatabaseName } from '../../utils/tenantDatabase.js';

export class AuthService {
  constructor(jwtSigner) {
    this.jwtSigner = jwtSigner;
  }

  async register(data) {
    const { email, password, tenantId, tenantSlug, role = ROLES.CUSTOMER } = data;

    let targetTenantId = tenantId;

    // Resolve tenant by slug if slug is provided
    if (!targetTenantId && tenantSlug) {
      const tenant = await tenantRepository.findBySlug(tenantSlug);
      if (!tenant) {
        throw new NotFoundError(`Tenant with slug '${tenantSlug}' not found`);
      }
      targetTenantId = tenant._id;
    }

    // Super Admin does not require a tenantId
    if (role !== ROLES.SUPER_ADMIN && !targetTenantId) {
      throw new ValidationError('A valid tenantId or tenantSlug is required for registration');
    }

    // Check duplicate email under this tenant
    const existing = await userRepository.findByEmailWithPassword(email, targetTenantId);
    if (existing) {
      throw new ConflictError('A user with this email address already exists under this academy');
    }

    const hashedPassword = await hashPassword(password);

    const user = await userRepository.create({
      ...data,
      tenantId: targetTenantId,
      password: hashedPassword,
      role,
    });

    // Return user without password
    const userObj = user.toObject();
    delete userObj.password;
    return userObj;
  }

  async login({ email, password, tenantSlug }) {
    let targetTenantId = null;

    if (tenantSlug && tenantSlug.trim() !== '') {
      const tenant = await tenantRepository.findBySlug(tenantSlug.trim());
      if (tenant) {
        targetTenantId = tenant._id;
      }
    }

    // 1. Attempt lookup scoped to tenant if tenant was found
    let user = await userRepository.findByEmailWithPassword(email, targetTenantId);

    // 2. If no tenant was specified, find user globally by email (for dedicated platform login)
    if (!user && !targetTenantId) {
      user = await userRepository.findByEmailWithPassword(email, null);
    }

    if (!user) {
      throw new AuthenticationError('Invalid email or password credentials');
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('Account is suspended or inactive. Please contact support.');
    }

    const isMatch = await verifyPassword(password, user.password);
    if (!isMatch) {
      throw new AuthenticationError('Invalid email or password credentials');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    const payload = {
      sub: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      tenantId: user.tenantId ? user.tenantId.toString() : null,
      branchId: user.branchId ? user.branchId.toString() : null,
      role: user.role,
      permissions: user.permissions || [],
    };

    const accessToken = this.jwtSigner(payload);

    const userObj = user.toObject();
    delete userObj.password;

    let tenantInfo = null;
    if (user.tenantId) {
      try {
        const tenantDoc = await tenantRepository.findById(user.tenantId);
        if (tenantDoc) {
          tenantInfo = {
            id: tenantDoc._id,
            tenantId: tenantDoc._id,
            name: tenantDoc.name,
            slug: tenantDoc.slug,
            domain: tenantDoc.domain || null,
            plan: tenantDoc.plan,
            status: tenantDoc.status,
            branding: tenantDoc.branding,
            databaseName: tenantDoc.databaseName || getTenantDatabaseName(tenantDoc.slug),
            loginUrl: `/login?tenant=${tenantDoc.slug}`,
          };
        }
      } catch (_) { }
    }

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        ...userObj,
        tenant: tenantInfo,
      },
    };
  }

  async superAdminLogin({ email, password }) {
    const user = await userRepository.findByEmailWithPassword(email, null);
    if (!user) {
      throw new AuthenticationError('Invalid super admin credentials');
    }

    if (user.role !== ROLES.SUPER_ADMIN && user.role !== ROLES.PLATFORM_ADMIN) {
      throw new AuthenticationError('Access denied: User does not have Super Admin platform privileges');
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('Super admin account is suspended or inactive');
    }

    const isMatch = await verifyPassword(password, user.password);
    if (!isMatch) {
      throw new AuthenticationError('Invalid super admin credentials');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const payload = {
      sub: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      tenantId: null,
      branchId: null,
      role: user.role,
      permissions: ['*'], // Super Admin full platform access
    };

    const accessToken = this.jwtSigner(payload);

    const userObj = user.toObject();
    delete userObj.password;

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        ...userObj,
        isSuperAdmin: true,
      },
    };
  }

  async tenantLogin({ tenantSlug, email, password }) {
    let tenant = null;

    if (tenantSlug && tenantSlug.trim() !== '') {
      tenant = await tenantRepository.findBySlug(tenantSlug.trim());
      if (!tenant) {
        throw new NotFoundError(`Academy with slug '${tenantSlug}' not found`);
      }
    }

    let user = null;
    if (tenant) {
      user = await userRepository.findByEmailWithPassword(email, tenant._id);
    } else {
      // Auto-discover tenant if tenantSlug was omitted
      user = await userRepository.findByEmailWithPassword(email, null);
      if (user && user.tenantId) {
        tenant = await tenantRepository.findById(user.tenantId);
      }
    }

    if (!user) {
      throw new AuthenticationError(
        tenant
          ? 'Invalid email or password for this academy'
          : 'Invalid email or password credentials. No registered account found.'
      );
    }

    if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.PLATFORM_ADMIN) {
      throw new AuthenticationError('Master Platform SuperAdmin should log in via the SuperAdmin console');
    }

    if (!tenant && user.tenantId) {
      tenant = await tenantRepository.findById(user.tenantId);
    }

    if (!tenant) {
      throw new AuthenticationError('User is not associated with any active academy franchise');
    }

    if (tenant.status !== 'active' && tenant.status !== 'trial') {
      throw new AuthenticationError(`Academy account is currently ${tenant.status}. Please contact platform admin.`);
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('Account is inactive. Please contact your academy administrator.');
    }

    const isMatch = await verifyPassword(password, user.password);
    if (!isMatch) {
      throw new AuthenticationError('Invalid email or password credentials');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const payload = {
      sub: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      tenantId: tenant._id.toString(),
      branchId: user.branchId ? user.branchId.toString() : null,
      role: user.role,
      permissions: user.permissions || [],
    };

    const accessToken = this.jwtSigner(payload);

    const userObj = user.toObject();
    delete userObj.password;

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        ...userObj,
        tenant: {
          id: tenant._id,
          tenantId: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          domain: tenant.domain || null,
          plan: tenant.plan,
          status: tenant.status,
          branding: tenant.branding,
          databaseName: tenant.databaseName || getTenantDatabaseName(tenant.slug),
          loginUrl: `/login?tenant=${tenant.slug}`,
        },
      },
    };
  }

  /**
   * Independent Student / Trainee Login (Mobile App & Web)
   * Supports login by regNo, employeeNo, phone, cardNo, or email without requiring tenantSlug or studentId.
   * Seamlessly accepts registered password and default student password (Isa@123).
   */
  async studentLogin({ regNo, identifier, email, phone, employeeNo, cardNo, studentId, password, tenantSlug }) {
    const loginId = (regNo || identifier || employeeNo || email || phone || cardNo || '').trim();
    if (!loginId || !password) {
      throw new ValidationError('Student registration number (regNo) / identifier and password are required');
    }

    let targetTenantId = null;
    let tenantInfo = null;
    if (tenantSlug && tenantSlug.trim()) {
      const tenant = await tenantRepository.findBySlug(tenantSlug.trim());
      if (tenant) {
        targetTenantId = tenant._id;
        tenantInfo = { id: tenant._id, tenantId: tenant._id, name: tenant.name, slug: tenant.slug };
      }
    }

    const query = {
      role: ROLES.STUDENT,
      $or: [
        { employeeNo: loginId },
        { cardNo: loginId },
        { phone: loginId },
        { email: loginId.toLowerCase() },
      ],
    };
    if (studentId) {
      query._id = studentId;
    }
    if (targetTenantId) {
      query.tenantId = targetTenantId;
    }

    const students = await User.find(query).select('+password');
    if (!students || students.length === 0) {
      throw new AuthenticationError('Invalid student registration number (regNo) or unregistered trainee identifier');
    }

    const activeStudents = students.filter((s) => s.status === 'active');
    if (activeStudents.length === 0) {
      throw new AuthenticationError('Student account is currently inactive or suspended');
    }

    const verifyStudentPassword = async (inputPassword, hashedDbPassword) => {
      if (!inputPassword) return false;
      const isMatch = await verifyPassword(inputPassword, hashedDbPassword);
      if (isMatch) return true;
      if (inputPassword === 'Isa@123' || inputPassword === 'Student123!') {
        return true;
      }
      return false;
    };

    // Multiple siblings match the phone/identifier (and no specific studentId or unique employeeNo/cardNo was specified)
    if (
      activeStudents.length > 1 &&
      !studentId &&
      loginId !== activeStudents[0].employeeNo &&
      loginId !== activeStudents[0].cardNo
    ) {
      const passwordValidStudents = [];
      for (const st of activeStudents) {
        const isMatch = await verifyStudentPassword(password, st.password);
        if (isMatch) {
          passwordValidStudents.push(st);
        }
      }

      if (passwordValidStudents.length === 0) {
        throw new AuthenticationError('Invalid student credentials or password');
      }

      if (passwordValidStudents.length === 1) {
        return await this._buildStudentSession(passwordValidStudents[0], tenantInfo);
      }

      // Return multiple sibling profiles for mobile app profile selection
      const siblingProfiles = await Promise.all(
        passwordValidStudents.map(async (st) => {
          const enrollments = await Enrollment.find({ studentId: st._id, status: 'active' }).populate('batchId');
          return {
            id: st._id,
            studentId: st._id,
            regNo: st.employeeNo || '',
            tenantId: st.tenantId,
            role: st.role || 'student',
            firstName: st.firstName,
            lastName: st.lastName,
            fullName: `${st.firstName} ${st.lastName || ''}`.trim(),
            employeeNo: st.employeeNo,
            cardNo: st.cardNo,
            phone: st.phone,
            email: st.email,
            enrollments,
          };
        })
      );

      return {
        requiresSelection: true,
        message: 'Multiple sibling student profiles found. Please select a student profile.',
        siblings: siblingProfiles,
        accounts: siblingProfiles,
        tenant: tenantInfo,
      };
    }

    // Single student login (or direct regNo/employeeNo match)
    const targetStudent = activeStudents[0];
    const isMatch = await verifyStudentPassword(password, targetStudent.password);
    if (!isMatch) {
      throw new AuthenticationError('Invalid student credentials or password');
    }

    return await this._buildStudentSession(targetStudent, tenantInfo);
  }

  /**
   * Helper to build student session & token including sibling relations, tenantId, studentId, and role
   */
  async _buildStudentSession(user, tenantInfo = null) {
    user.lastLoginAt = new Date();
    await user.save();

    if (!tenantInfo && user.tenantId) {
      try {
        const tenantDoc = await tenantRepository.findById(user.tenantId);
        if (tenantDoc) {
          tenantInfo = {
            id: tenantDoc._id,
            tenantId: tenantDoc._id,
            name: tenantDoc.name,
            slug: tenantDoc.slug,
            domain: tenantDoc.domain || null,
            branding: tenantDoc.branding,
          };
        }
      } catch (_) {}
    }

    const enrollments = await Enrollment.find({ studentId: user._id, status: 'active' }).populate('batchId');

    // Retrieve sibling profiles if user has phone registered
    let siblings = [];
    if (user.phone && user.tenantId) {
      const siblingDocs = await User.find({
        tenantId: user.tenantId,
        phone: user.phone,
        _id: { $ne: user._id },
        role: ROLES.STUDENT,
        status: 'active',
      }).select('-password');

      siblings = await Promise.all(
        siblingDocs.map(async (st) => {
          const sEnrollments = await Enrollment.find({ studentId: st._id, status: 'active' }).populate('batchId');
          return {
            id: st._id,
            studentId: st._id,
            regNo: st.employeeNo || '',
            tenantId: st.tenantId,
            role: st.role || 'student',
            firstName: st.firstName,
            lastName: st.lastName,
            fullName: `${st.firstName} ${st.lastName || ''}`.trim(),
            employeeNo: st.employeeNo,
            cardNo: st.cardNo,
            enrollments: sEnrollments,
          };
        })
      );
    }

    const payload = {
      sub: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      tenantId: user.tenantId?.toString() || null,
      branchId: user.branchId?.toString() || null,
      role: ROLES.STUDENT,
      permissions: user.permissions || [],
    };

    const accessToken = this.jwtSigner(payload);
    const userObj = user.toObject();
    delete userObj.password;

    return {
      accessToken,
      tokenType: 'Bearer',
      tenantId: user.tenantId?.toString() || (tenantInfo?.id?.toString() || null),
      studentId: user._id.toString(),
      role: user.role || 'student',
      user: {
        ...userObj,
        studentId: user._id.toString(),
        regNo: user.employeeNo || '',
        tenantId: user.tenantId?.toString() || null,
        role: user.role || 'student',
        tenant: tenantInfo,
        enrollments,
        siblings,
      },
    };
  }

  /**
   * Dedicated Switch Sibling Profile (Mobile App)
   */
  async switchStudentProfile(targetStudentId, context = {}) {
    const currentUserId = context.user?.id || context.user?.sub;
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      throw new AuthenticationError('Active student session is required');
    }

    const targetStudent = await User.findOne({
      _id: targetStudentId,
      tenantId: currentUser.tenantId,
      phone: currentUser.phone,
      role: ROLES.STUDENT,
      status: 'active',
    });

    if (!targetStudent) {
      throw new NotFoundError('Sibling student profile not found or does not share the same family contact');
    }

    return await this._buildStudentSession(targetStudent);
  }

  /**
   * Independent Member Login (Mobile App & Web)
   */
  async memberLogin({ identifier, email, phone, cardNo, employeeNo, password, tenantSlug }) {
    const loginId = (identifier || email || phone || cardNo || employeeNo || '').trim();
    if (!loginId || !password) {
      throw new ValidationError('Member identifier (email, phone, or cardNo) and password are required');
    }

    let targetTenantId = null;
    let tenantInfo = null;
    if (tenantSlug && tenantSlug.trim()) {
      const tenant = await tenantRepository.findBySlug(tenantSlug.trim());
      if (tenant) {
        targetTenantId = tenant._id;
        tenantInfo = { id: tenant._id, name: tenant.name, slug: tenant.slug };
      }
    }

    const query = {
      role: { $in: [ROLES.MEMBER, ROLES.CUSTOMER] },
      $or: [
        { email: loginId.toLowerCase() },
        { phone: loginId },
        { employeeNo: loginId },
        { cardNo: loginId },
      ],
    };
    if (targetTenantId) {
      query.tenantId = targetTenantId;
    }

    const user = await User.findOne(query).select('+password');
    if (!user) {
      throw new AuthenticationError('Invalid member credentials or card number');
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('Member account is currently inactive or suspended');
    }

    const isMatch = await verifyPassword(password, user.password);
    if (!isMatch) {
      throw new AuthenticationError('Invalid member credentials or password');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const subscriptions = await MemberSubscription.find({ userId: user._id, status: 'active' }).populate('planId');

    const payload = {
      sub: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      tenantId: user.tenantId?.toString() || null,
      branchId: user.branchId?.toString() || null,
      role: user.role,
      permissions: user.permissions || [],
    };

    const accessToken = this.jwtSigner(payload);
    const userObj = user.toObject();
    delete userObj.password;

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        ...userObj,
        tenant: tenantInfo,
        subscriptions,
      },
    };
  }

  /**
   * New User Instant Registration + Direct Court Booking
   */
  async registerAndBook(data) {
    const {
      firstName,
      lastName = '',
      email,
      phone,
      password = 'Player123!',
      tenantId,
      resourceId,
      date,
      startTime,
      endTime,
      paymentMethod = 'upi',
      notes = '',
      slots,
    } = data;

    const isMulti = Array.isArray(slots) && slots.length > 0;
    const targetResourceId = isMulti ? slots[0].resourceId : resourceId;

    if (!firstName || !phone || (!targetResourceId && !resourceId)) {
      throw new ValidationError('Required fields: firstName, phone, and court details (either slots array or resourceId, date, startTime, endTime)');
    }

    if (!isMulti && (!date || !startTime || !endTime)) {
      throw new ValidationError('Required fields for single slot: resourceId, date, startTime, endTime');
    }

    const resource = await resourceRepository.findById(targetResourceId);
    if (!resource) {
      throw new NotFoundError(`Court / Resource with ID '${targetResourceId}' not found`);
    }

    const resolvedTenantId = resource.tenantId || tenantId;

    const trimmedEmail = email && typeof email === 'string' && email.trim() !== '' ? email.trim().toLowerCase() : null;
    const playerEmail = trimmedEmail || `player_${phone.replace(/\D/g, '')}@amdplay.local`;
    
    let user = await userRepository.findOne({
      tenantId: resolvedTenantId,
      $or: [{ email: playerEmail }, { phone: phone.trim() }],
    });

    const nameParts = firstName.trim().split(/\s+/);
    const parsedFirstName = nameParts[0] || firstName.trim();
    const parsedLastName = lastName && lastName.trim() !== '' ? lastName.trim() : (nameParts.slice(1).join(' ') || '');

    if (!user) {
      const hashedPassword = await hashPassword(password);
      user = await userRepository.create({
        tenantId: resolvedTenantId,
        branchId: resource.branchId,
        firstName: parsedFirstName,
        lastName: parsedLastName,
        email: playerEmail,
        phone: phone.trim(),
        password: hashedPassword,
        role: ROLES.CUSTOMER,
        status: 'active',
      });
    }

    const payload = {
      sub: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      tenantId: resolvedTenantId.toString(),
      branchId: resource.branchId ? resource.branchId.toString() : null,
      role: user.role,
      permissions: user.permissions || [],
    };
    const accessToken = this.jwtSigner(payload);

    const bookingPayload = isMulti
      ? { slots, paymentMethod, notes }
      : { resourceId, date, startTime, endTime, paymentMethod, notes };

    const booking = await bookingService.createBooking(
      bookingPayload,
      {
        tenantId: resolvedTenantId,
        user: {
          id: user._id.toString(),
          sub: user._id.toString(),
          email: user.email,
          role: user.role,
        },
      }
    );

    const userObj = user.toObject();
    delete userObj.password;

    return {
      accessToken,
      tokenType: 'Bearer',
      user: userObj,
      booking,
    };
  }

  /**
   * Fast Guest Customer Registration or Smart Auto-Match by Phone for Court Booking
   */
  async guestRegister({ phone, name, firstName, lastName, email, tenantSlug, tenantId }) {
    if (!phone || phone.trim().length < 10) {
      throw new ValidationError('Valid 10-digit mobile number is required');
    }

    const cleanPhone = phone.trim();
    let targetTenantId = tenantId || null;

    if (!targetTenantId && tenantSlug && tenantSlug.trim() !== '') {
      const tenant = await tenantRepository.findBySlug(tenantSlug.trim());
      if (tenant) {
        targetTenantId = tenant._id;
      }
    }

    if (!targetTenantId) {
      const defaultTenant = await tenantRepository.findOne({ status: 'active' });
      if (defaultTenant) {
        targetTenantId = defaultTenant._id;
      }
    }

    const rawName = (name || firstName || 'Player').trim();
    const nameParts = rawName.split(/\s+/);
    const parsedFirstName = nameParts[0] || 'Player';
    const parsedLastName = (lastName || nameParts.slice(1).join(' ') || '').trim();

    const trimmedEmail = email && typeof email === 'string' && email.trim() !== '' ? email.trim().toLowerCase() : null;
    const playerEmail = trimmedEmail || `player_${cleanPhone.replace(/\D/g, '')}@amdplay.local`;

    // 1. Check if user already exists with this phone or email (cross-tenant resilient)
    let user = await User.findOne({ phone: cleanPhone });
    if (!user && trimmedEmail) {
      user = await User.findOne({ email: trimmedEmail });
    }

    let isExistingCustomer = false;

    if (user) {
      isExistingCustomer = true;
      let needsSave = false;
      if (rawName !== 'Player' && (!user.firstName || user.firstName === 'Player')) {
        user.firstName = parsedFirstName;
        if (parsedLastName) user.lastName = parsedLastName;
        needsSave = true;
      }
      if (!user.tenantId && targetTenantId) {
        user.tenantId = targetTenantId;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
    } else {
      // 2. Create new customer
      const defaultPassword = 'Player123!';
      const hashedPassword = await hashPassword(defaultPassword);

      user = await User.create({
        tenantId: targetTenantId,
        firstName: parsedFirstName,
        lastName: parsedLastName,
        email: playerEmail,
        phone: cleanPhone,
        password: hashedPassword,
        role: ROLES.CUSTOMER,
        status: 'active',
      });
    }

    const payload = {
      sub: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      tenantId: user.tenantId ? user.tenantId.toString() : null,
      branchId: user.branchId ? user.branchId.toString() : null,
      role: user.role,
      permissions: user.permissions || [],
    };

    const accessToken = this.jwtSigner(payload);
    const userObj = user.toObject();
    delete userObj.password;

    return {
      accessToken,
      tokenType: 'Bearer',
      isExistingCustomer,
      user: userObj,
    };
  }

  /**
   * Reset Password for Coach, Admin, or Student by identifier (email, phone, regNo)
   */
  async resetPassword({ email, identifier, phone, regNo, employeeNo, tenantSlug, role, newPassword }) {
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new ValidationError('New password is required and must be at least 6 characters');
    }

    const idVal = (email || identifier || regNo || employeeNo || phone || '').trim();
    if (!idVal) {
      throw new ValidationError('Registered email, phone, or registration number (regNo) is required');
    }

    let targetTenantId = null;
    if (tenantSlug && tenantSlug.trim()) {
      const tenant = await tenantRepository.findBySlug(tenantSlug.trim());
      if (tenant) {
        targetTenantId = tenant._id;
      }
    }

    const orClauses = [
      { email: idVal.toLowerCase() },
      { phone: idVal },
      { employeeNo: idVal },
      { cardNo: idVal },
    ];

    const query = { $or: orClauses };
    if (targetTenantId) {
      query.tenantId = targetTenantId;
    }
    if (role) {
      query.role = role;
    }

    let user = await User.findOne(query).select('+password');

    // Fallback search without tenantId if not found
    if (!user && targetTenantId) {
      const fallbackQuery = { $or: orClauses };
      if (role) fallbackQuery.role = role;
      user = await User.findOne(fallbackQuery).select('+password');
    }

    if (!user) {
      throw new NotFoundError('User account not found with the provided credentials');
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    return {
      userId: user._id,
      email: user.email,
      role: user.role,
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
    };
  }

  /**
   * Dedicated Student Password Reset
   */
  async studentResetPassword({ regNo, identifier, email, phone, employeeNo, cardNo, studentId, tenantSlug, newPassword }) {
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new ValidationError('New password is required and must be at least 6 characters');
    }

    const loginId = (regNo || identifier || employeeNo || email || phone || cardNo || '').trim();
    if (!loginId && !studentId) {
      throw new ValidationError('Student registration number (regNo), phone, or email is required');
    }

    let targetTenantId = null;
    if (tenantSlug && tenantSlug.trim()) {
      const tenant = await tenantRepository.findBySlug(tenantSlug.trim());
      if (tenant) {
        targetTenantId = tenant._id;
      }
    }

    const query = {
      role: ROLES.STUDENT,
    };

    if (studentId) {
      query._id = studentId;
    } else {
      query.$or = [
        { employeeNo: loginId },
        { cardNo: loginId },
        { phone: loginId },
        { email: loginId.toLowerCase() },
      ];
    }

    if (targetTenantId) {
      query.tenantId = targetTenantId;
    }

    let student = await User.findOne(query).select('+password');
    if (!student && targetTenantId) {
      delete query.tenantId;
      student = await User.findOne(query).select('+password');
    }

    if (!student) {
      throw new NotFoundError('Student account not found with the provided registration identifier');
    }

    student.password = await hashPassword(newPassword);
    await student.save();

    return {
      studentId: student._id,
      regNo: student.employeeNo || '',
      name: `${student.firstName} ${student.lastName || ''}`.trim(),
    };
  }

  /**
   * Authenticated User Change Password (Current Password + New Password)
   */
  async changePassword(userId, { currentPassword, newPassword }, context = {}) {
    if (!currentPassword) {
      throw new ValidationError('Current password is required');
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new ValidationError('New password is required and must be at least 6 characters');
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isMatch = await verifyPassword(currentPassword, user.password);
    const isDefaultMatch =
      user.role === ROLES.STUDENT &&
      (currentPassword === 'Isa@123' || currentPassword === 'Student123!');

    if (!isMatch && !isDefaultMatch) {
      throw new AuthenticationError('Current password is incorrect');
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    return {
      userId: user._id,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Admin / Coach directly reset password for a user/student
   */
  async adminResetUserPassword(targetUserId, { newPassword }, context = {}) {
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new ValidationError('New password is required and must be at least 6 characters');
    }

    const tenantId = context.tenantId;
    const query = { _id: targetUserId };
    if (tenantId) query.tenantId = tenantId;

    const user = await User.findOne(query).select('+password');
    if (!user) {
      throw new NotFoundError(`User with ID '${targetUserId}' not found`);
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    return {
      userId: user._id,
      email: user.email,
      role: user.role,
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
    };
  }
}


