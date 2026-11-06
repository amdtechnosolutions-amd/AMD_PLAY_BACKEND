import { Tenant } from '../tenants/tenant.model.js';
import { monthlyFeeGeneratorService } from './monthly-fee-generator.service.js';
import { logger } from '../../utils/logger.js';

export class MonthlyFeeSchedulerService {
  constructor() {
    this.timer = null;
    this.lastRunKey = null; // e.g. "2026-11"
    this.intervalMs = 60 * 60 * 1000; // Check hourly
  }

  start() {
    if (this.timer) return;

    logger.info('📅 [Monthly Fee Scheduler] Automated 1st-of-month fee generator worker started');

    // Run initial check after 10 seconds of startup
    setTimeout(() => this._checkAndRun(), 10000);

    // Recurring check every hour
    this.timer = setInterval(() => this._checkAndRun(), this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('📅 [Monthly Fee Scheduler] Worker stopped');
    }
  }

  async _checkAndRun() {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const currentRunKey = `${year}-${String(month).padStart(2, '0')}`;

    // Auto-run on the 1st day of every calendar month (once per month)
    if (day === 1 && this.lastRunKey !== currentRunKey) {
      logger.info({ month, year }, '📅 [Monthly Fee Scheduler] Executing automated 1st-of-month fee generation for all academies...');
      try {
        const activeTenants = await Tenant.find({ status: 'active' });

        for (const tenant of activeTenants) {
          try {
            const report = await monthlyFeeGeneratorService.generateFeesForMonth({
              tenantId: tenant._id,
              month,
              year,
              target: 'all',
              dueDay: 5,
            });

            logger.info(
              {
                tenantId: tenant._id,
                tenantName: tenant.name,
                invoices: report.totalGeneratedInvoices,
                receivable: report.totalReceivableAmount,
              },
              '📅 [Monthly Fee Scheduler] Tenant monthly billing completed'
            );
          } catch (tenantErr) {
            logger.error({ tenantId: tenant._id, err: tenantErr.message }, '📅 [Monthly Fee Scheduler] Error generating fees for tenant');
          }
        }

        this.lastRunKey = currentRunKey;
      } catch (err) {
        logger.error({ err: err.message }, '📅 [Monthly Fee Scheduler] Execution error');
      }
    }
  }
}

export const monthlyFeeSchedulerService = new MonthlyFeeSchedulerService();
