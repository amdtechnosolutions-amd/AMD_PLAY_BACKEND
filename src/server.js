import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { iotSchedulerService } from './modules/iot/iot-scheduler.service.js';
import { deviceSyncQueueService } from './modules/iot/device-sync-queue.service.js';
import { monthlyFeeSchedulerService } from './modules/finance/monthly-fee-scheduler.service.js';
// Server initialization - port 5005

const startServer = async () => {
  try {
    const app = await buildApp();

    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    // Start background workers
    iotSchedulerService.start();
    deviceSyncQueueService.start();
    monthlyFeeSchedulerService.start();

    logger.info(`Sports Academy API running at http://${env.HOST}:${env.PORT}`);
    logger.info(`Swagger Documentation available at http://localhost:${env.PORT}/api/docs`);

    const gracefulShutdown = async (signal) => {
      logger.info({ signal }, 'Received shutdown signal, closing Fastify server gracefully...');
      try {
        iotSchedulerService.stop();
        deviceSyncQueueService.stop();
        monthlyFeeSchedulerService.stop();
        await app.close();
        logger.info('Fastify server closed successfully. Exiting.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during graceful server shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    logger.error({ err: error }, 'Failed to start Sports Academy server');
    process.exit(1);
  }
};

startServer();
