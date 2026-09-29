import { Client, Connection } from '@temporalio/client';
import { config } from '../config';
import { logger } from '../logger';

let clientPromise: Promise<Client> | null = null;
let connection: Connection | null = null;

/** Shared Temporal client; the connection is established once and reused. */
export async function temporalClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      connection = await Connection.connect({
        address: config.temporal.address,
        // Without this the default deadline is ~10s, which makes /health crawl
        // whenever Temporal is unreachable.
        connectTimeout: config.temporal.connectTimeoutMs,
      });
      logger.info({ address: config.temporal.address }, 'temporal client connected');
      return new Client({ connection, namespace: config.temporal.namespace });
    })().catch((err: unknown) => {
      // Do not cache a failed connection — let the next request try again.
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

/** Cheap liveness probe used by /health. */
export async function temporalHealthy(): Promise<void> {
  const client = await temporalClient();
  await client.connection.workflowService.getSystemInfo({});
}

export async function closeTemporal(): Promise<void> {
  if (connection) {
    await connection.close().catch(() => undefined);
    connection = null;
  }
  clientPromise = null;
}
