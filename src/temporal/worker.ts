import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';
import { config } from '../config';
import { errorMessage, logger } from '../logger';
import { closeRedis } from '../redis/client';

async function main(): Promise<void> {
  logger.info(
    { address: config.temporal.address, taskQueue: config.temporal.taskQueue },
    'starting temporal worker',
  );

  const connection = await NativeConnection.connect({ address: config.temporal.address });

  const worker = await Worker.create({
    connection,
    namespace: config.temporal.namespace,
    taskQueue: config.temporal.taskQueue,
    // Resolves to the .ts file under tsx in dev and the compiled .js in the image.
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down worker');
    worker.shutdown();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await worker.run();
  } finally {
    await connection.close().catch(() => undefined);
    await closeRedis();
    logger.info('worker stopped');
  }
}

main().catch((err: unknown) => {
  logger.fatal({ err: errorMessage(err) }, 'worker failed to start');
  process.exit(1);
});
