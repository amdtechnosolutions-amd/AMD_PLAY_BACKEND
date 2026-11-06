  import { DeviceSyncQueue } from './device-sync-queue.model.js';
  import { Device } from './device.model.js';
  import { HikvisionService, hikvisionService } from './hikvision.service.js';

  export class DeviceSyncQueueService {
    constructor() {
      this.timer = null;
      this.intervalMs = 30000; // Run every 30 seconds
      this.isProcessing = false;
    }

    /**
     * Enqueue a synchronization job for a specific terminal
     */
    async enqueueJob({ tenantId, branchId = null, deviceId = null, action, employeeNo, payload, nextAttemptAt = null }) {
      let resolvedNextAttempt = nextAttemptAt;
      if (!resolvedNextAttempt && deviceId) {
        const lockedJob = await DeviceSyncQueue.findOne({
          deviceId,
          status: 'PENDING',
          nextAttemptAt: { $gt: new Date() },
        }).sort({ nextAttemptAt: -1 });

        if (lockedJob?.nextAttemptAt) {
          resolvedNextAttempt = lockedJob.nextAttemptAt;
        }
      }

      return await DeviceSyncQueue.create({
        tenantId,
        branchId,
        deviceId,
        action,
        employeeNo,
        payload,
        status: 'PENDING',
        nextAttemptAt: resolvedNextAttempt,
      });
    }

    /**
     * Start the background queue worker
     */
    start() {
      if (this.timer) return;
      this.timer = setInterval(() => {
        this.processPendingJobs().catch((err) => {
          console.error('[Device Sync Queue] Processor error:', err.message);
        });
      }, this.intervalMs);
      console.log('🔄 [Device Sync Queue] Background retry worker started');
    }

    stop() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }

    /**
     * Process pending offline sync jobs
     */
    async processPendingJobs() {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        const now = new Date();
        const pendingJobs = await DeviceSyncQueue.find({
          status: 'PENDING',
          retryCount: { $lt: 15 },
          $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
        })
          .sort({ createdAt: 1 })
          .limit(20);

        for (const job of pendingJobs) {
          job.lastAttemptAt = new Date();

          try {
            // 1. Resolve client for target device or fallback to default
            let client = hikvisionService;
            if (job.deviceId) {
              const device = await Device.findById(job.deviceId);
              if (device && device.ipAddress) {
                client = HikvisionService.forDevice({
                  ip: device.ipAddress,
                  port: device.port || (device.protocol === 'https' ? 443 : 80),
                  username: device.username || 'admin',
                  password: device.password || '',
                  protocol: device.protocol || (Number(device.port) === 443 ? 'https' : 'http'),
                });
              }
            }

            // 2. Execute appropriate hardware ISAPI action
            switch (job.action) {
              case 'ADD_USER':
                await client.recordPerson(job.payload);
                if (job.payload.cardNo) {
                  await client.recordCard({
                    employeeNo: job.payload.employeeNo,
                    cardNo: job.payload.cardNo,
                  });
                }
                break;
              case 'MODIFY_USER':
                await client.modifyPerson(job.payload);
                if (job.payload.cardNo) {
                  await client.recordCard({
                    employeeNo: job.payload.employeeNo,
                    cardNo: job.payload.cardNo,
                  });
                }
                break;
            case 'DELETE_USER':
              await client.deleteUser(job.employeeNo);
              break;
            case 'ASSIGN_PIN':
              await client.assignPin(job.payload);
              break;
            case 'RECORD_CARD':
              await client.recordCard(job.payload);
              break;
            case 'UPLOAD_FACE':
              await client.uploadFace(job.employeeNo, job.payload.faceImage);
              break;
            default:
              break;
          }

          job.status = 'COMPLETED';
          job.completedAt = new Date();
          job.lastError = null;
          job.nextAttemptAt = null;
          await job.save();
          console.log(`[Device Sync Queue] Successfully completed ${job.action} for employee ${job.employeeNo}`);
        } catch (jobErr) {
          if (jobErr.isLocked) {
            const unlockSeconds = Number(jobErr.unlockTime || 1800);
            const lockNextAttempt = new Date(Date.now() + (unlockSeconds + 10) * 1000);
            job.nextAttemptAt = lockNextAttempt;
            job.lastError = jobErr.message;
            await job.save();

            // Also delay all other pending jobs for this device
            if (job.deviceId) {
              await DeviceSyncQueue.updateMany(
                { deviceId: job.deviceId, status: 'PENDING' },
                { $set: { nextAttemptAt: lockNextAttempt } }
              );
            }
            console.warn(`[Device Sync Queue] Terminal ${job.deviceId} is locked. Pausing retry until ${lockNextAttempt.toISOString()}`);
            break; // Stop further requests to the locked device
          }

          job.retryCount += 1;
          job.lastError = jobErr.message;
          const delaySeconds = Math.min(30 * Math.pow(2, Math.max(0, job.retryCount - 1)), 3600);
          job.nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);
          if (job.retryCount >= job.maxRetries) {
            job.status = 'FAILED';
          }
          await job.save();
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const deviceSyncQueueService = new DeviceSyncQueueService();
