import { Router, type Request, type Response } from 'express';
import { config } from '../../config';
import { errorMessage, logger } from '../../logger';
import { pingRedis } from '../../redis/offerStore';
import { temporalHealthy } from '../../temporal/client';
import type { DependencyHealth } from '../../types';

const HEALTH_TIMEOUT_MS = 3_000;

/**
 * `/health` reports each dependency separately:
 *
 *   ok        - everything reachable
 *   degraded  - at least one supplier is down, but the service can still answer
 *               requests from the remaining supplier (HTTP 200)
 *   unhealthy - Redis or Temporal is down, so searches cannot be served (HTTP 503)
 */
export function healthRoutes(): Router {
  const router = Router();

  router.get('/health', async (_req: Request, res: Response): Promise<void> => {
    const [supplierA, supplierB, redisHealth, temporal] = await Promise.all([
      checkSupplier('/supplierA/hotels'),
      checkSupplier('/supplierB/hotels'),
      check(async () => {
        const pong = await pingRedis();
        return `PING -> ${pong}`;
      }),
      check(async () => {
        await temporalHealthy();
        return config.temporal.address;
      }),
    ]);

    const suppliersDown = [supplierA, supplierB].filter((s) => s.status === 'down').length;
    const infraDown = redisHealth.status === 'down' || temporal.status === 'down';

    const status = infraDown || suppliersDown === 2 ? 'unhealthy' : suppliersDown === 1 ? 'degraded' : 'ok';

    const body = {
      status,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies: {
        suppliers: { 'Supplier A': supplierA, 'Supplier B': supplierB },
        redis: redisHealth,
        temporal,
      },
    };

    if (status !== 'ok') {
      logger.warn({ status, suppliersDown, infraDown }, 'health check is not fully healthy');
    }

    res.status(status === 'unhealthy' ? 503 : 200).json(body);
  });

  return router;
}

/** Probes a mock supplier over HTTP, exactly as the activities reach it. */
async function checkSupplier(path: string): Promise<DependencyHealth> {
  return check(async () => {
    const response = await fetch(`${config.suppliers.baseUrl}${path}?city=delhi`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`responded ${response.status}`);
    }
    const hotels = (await response.json()) as unknown[];
    return `${Array.isArray(hotels) ? hotels.length : 0} hotels for probe city "delhi"`;
  });
}

async function check(probe: () => Promise<string>): Promise<DependencyHealth> {
  const started = Date.now();
  try {
    const detail = await probe();
    return { status: 'up', latencyMs: Date.now() - started, detail };
  } catch (err) {
    return { status: 'down', latencyMs: Date.now() - started, error: errorMessage(err) };
  }
}
