import { Router, type Request, type Response } from 'express';
import { config } from '../../config';
import { logger } from '../../logger';
import { SUPPLIER_A_HOTELS, SUPPLIER_B_HOTELS, hotelsForCity } from '../../suppliers/data';
import { allOutages, getOutage, setOutage, type SupplierId } from '../../suppliers/outage';
import type { SupplierHotel } from '../../types';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Mounts `GET /supplier{A,B}/hotels` plus a control endpoint used to simulate
 * an outage. These stand in for third-party APIs — the Temporal activities call
 * them over HTTP rather than importing the data directly.
 */
export function supplierRoutes(): Router {
  const router = Router();

  router.get('/supplierA/hotels', handler('A', SUPPLIER_A_HOTELS));
  router.get('/supplierB/hotels', handler('B', SUPPLIER_B_HOTELS));

  // Runtime outage toggle: POST /suppliers/A/control { "down": true, "delayMs": 0 }
  router.post('/suppliers/:supplier/control', (req: Request, res: Response) => {
    const supplier = normaliseSupplier(req.params.supplier);
    if (!supplier) {
      res.status(400).json({ error: 'BadRequest', message: 'supplier must be "A" or "B"' });
      return;
    }

    const body = (req.body ?? {}) as { down?: unknown; delayMs?: unknown };
    const patch: { down?: boolean; delayMs?: number } = {};

    if (body.down !== undefined) {
      if (typeof body.down !== 'boolean') {
        res.status(400).json({ error: 'BadRequest', message: '"down" must be a boolean' });
        return;
      }
      patch.down = body.down;
    }
    if (body.delayMs !== undefined) {
      if (typeof body.delayMs !== 'number' || body.delayMs < 0) {
        res.status(400).json({ error: 'BadRequest', message: '"delayMs" must be a non-negative number' });
        return;
      }
      patch.delayMs = body.delayMs;
    }

    res.json({ supplier, state: setOutage(supplier, patch) });
  });

  router.get('/suppliers/control', (_req: Request, res: Response) => {
    res.json(allOutages());
  });

  return router;
}

function handler(supplier: SupplierId, catalogue: readonly SupplierHotel[]) {
  return async (req: Request, res: Response): Promise<void> => {
    const outage = getOutage(supplier);
    const city = typeof req.query.city === 'string' ? req.query.city : undefined;

    await sleep(config.suppliers.latencyMs + outage.delayMs);

    if (outage.down) {
      logger.warn({ supplier, city }, 'mock supplier returning simulated outage');
      res.status(503).json({
        error: 'SupplierUnavailable',
        message: `Supplier ${supplier} is currently unavailable (simulated outage)`,
      });
      return;
    }

    const hotels = hotelsForCity(catalogue, city);
    logger.debug({ supplier, city, count: hotels.length }, 'mock supplier responded');
    res.json(hotels);
  };
}

function normaliseSupplier(value: string | undefined): SupplierId | null {
  const upper = (value ?? '').toUpperCase();
  return upper === 'A' || upper === 'B' ? upper : null;
}
