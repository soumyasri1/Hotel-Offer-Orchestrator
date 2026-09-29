import { config } from '../config';
import { errorMessage, logger } from '../logger';
import { closeRedis } from '../redis/client';
import { closeTemporal } from '../temporal/client';
import { createApp } from './app';

const server = createApp().listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      temporal: config.temporal.address,
      redis: config.redis.url,
      supplierBaseUrl: config.suppliers.baseUrl,
    },
    'hotel offer orchestrator API listening',
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down API');

  server.close(async () => {
    await Promise.allSettled([closeRedis(), closeTemporal()]);
    logger.info('API stopped');
    process.exit(0);
  });

  // Do not hang forever on lingering keep-alive connections.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: errorMessage(reason) }, 'unhandled promise rejection');
});
