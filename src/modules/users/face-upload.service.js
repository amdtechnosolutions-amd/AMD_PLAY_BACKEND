import fs from 'node:fs';
import path from 'node:path';
import { User } from './user.model.js';
import { Device } from '../iot/device.model.js';
import { DeviceSyncQueue } from '../iot/device-sync-queue.model.js';
import { HikvisionService, hikvisionService } from '../iot/hikvision.service.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../../errors/AppError.js';
import { ROLES } from '../../config/constants.js';

class FaceUploadService {
  /**
   * Upload user face photo, store on disk, update user profile, and sync to all active biometric terminals
   */
  async uploadAndSyncFace(userId, body = {}, context = {}) {
    const tenantId = context.tenantId || context.user?.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const rawData = body.faceImageBase64 || body.photo || body.avatar || body.image;
    if (!rawData || typeof rawData !== 'string') {
      throw new ValidationError('Face image Base64 data is required (JPEG or PNG)');
    }

    const targetUser = await User.findOne({ _id: userId, tenantId });
    if (!targetUser) {
      throw new NotFoundError(`User with ID '${userId}' not found`);
    }

    // Permission check: if requesting user is not admin/manager/coach/staff, they can only upload for themselves or siblings
    const currentUserId = context.user?.id || context.user?.sub;
    const currentRole = context.user?.role;
    const isStaffOrAdmin = [ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.BRANCH_MANAGER, ROLES.COACH, 'staff'].includes(currentRole);

    if (!isStaffOrAdmin && currentUserId && currentUserId.toString() !== targetUser._id.toString()) {
      // Check sibling group
      const currentUser = await User.findById(currentUserId).lean();
      const isSibling =
        currentUser?.siblingGroupId &&
        targetUser.siblingGroupId &&
        currentUser.siblingGroupId.toString() === targetUser.siblingGroupId.toString();

      if (!isSibling) {
        throw new AuthorizationError('You are only authorized to upload face photos for yourself or family members');
      }
    }

    // 1. Process and save image buffer to disk
    const cleanBase64 = rawData.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
    const imgBuffer = Buffer.from(cleanBase64, 'base64');

    if (imgBuffer.length < 50) {
      throw new ValidationError('Invalid image payload: data length too short');
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${targetUser._id}_${Date.now()}.jpg`;
    const fullPath = path.join(uploadsDir, filename);
    fs.writeFileSync(fullPath, imgBuffer);

    const avatarUrl = `/api/v1/uploads/avatars/${filename}`;

    // 2. Update user document
    targetUser.avatar = avatarUrl;
    targetUser.metadata = targetUser.metadata || {};
    targetUser.metadata.facePhotoUrl = avatarUrl;
    await targetUser.save();

    // 3. Sync to all active biometric terminals
    const empNo = targetUser.employeeNo || targetUser.phone || targetUser._id.toString().slice(-6);
    const personName = `${targetUser.firstName} ${targetUser.lastName || ''}`.trim() || empNo;

    const accessDeviceTypes = ['biometric', 'biometric_terminal', 'access_control', 'door_lock', 'turnstile'];
    const targetDevices = await Device.find({
      tenantId,
      ipAddress: { $exists: true, $ne: '' },
      type: { $in: accessDeviceTypes, $ne: 'relay_controller' },
    });

    const deviceResults = [];

    for (const dev of targetDevices) {
      const client = dev.ipAddress
        ? HikvisionService.forDevice({
            ip: dev.ipAddress,
            port: dev.port || 80,
            username: dev.username || 'admin',
            password: dev.password || 'Amd@737373',
            protocol: dev.protocol || 'http',
          })
        : hikvisionService;

      try {
        // Ensure user is registered on terminal
        try {
          await client.recordPerson({
            employeeNo: empNo,
            name: personName,
            role: targetUser.role,
            userType: 'normal',
            pin: targetUser.pin,
            cardNo: targetUser.cardNo,
            planTemplateNo: 1,
          });
        } catch (recErr) {
          console.log(`[Face Sync] Pre-registration note for ${empNo} on ${dev.code}:`, recErr.message);
        }

        const faceRes = await client.uploadFace(empNo, imgBuffer);
        deviceResults.push({
          deviceId: dev._id,
          code: dev.code,
          name: dev.name,
          ipAddress: dev.ipAddress,
          port: dev.port,
          status: 'SUCCESS',
          message: 'Face photo registered on terminal',
          details: faceRes,
        });
      } catch (devErr) {
        console.warn(`[Face Sync] Terminal ${dev.code} sync warning:`, devErr.message);

        // Enqueue to DeviceSyncQueue for offline background retry
        try {
          await DeviceSyncQueue.create({
            tenantId,
            branchId: dev.branchId || targetUser.branchId,
            deviceId: dev._id,
            action: 'UPLOAD_FACE',
            employeeNo: empNo,
            payload: {
              faceImage: cleanBase64,
              employeeNo: empNo,
              name: personName,
            },
            status: 'PENDING',
            retryCount: 0,
            lastError: devErr.message,
          });
        } catch (qErr) {
          console.warn('[Face Sync] Queue error:', qErr.message);
        }

        deviceResults.push({
          deviceId: dev._id,
          code: dev.code,
          name: dev.name,
          ipAddress: dev.ipAddress,
          port: dev.port,
          status: 'ENQUEUED_OFFLINE',
          message: 'Device offline or busy. Enqueued for automated background synchronization.',
          error: devErr.message,
        });
      }
    }

    return {
      userId: targetUser._id,
      employeeNo: empNo,
      name: personName,
      role: targetUser.role,
      avatarUrl,
      devices: deviceResults,
    };
  }
}

export const faceUploadService = new FaceUploadService();
