import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { logger } from '../../logger';
import { DuplicateHotelError, addHotel, listHotels, removeHotel } from '../../suppliers/catalogue';
import { allOutages, getOutage, setOutage, type SupplierId } from '../../suppliers/outage';
import { requireAdmin } from '../auth';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const newHotelSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(80),
  city: z.string().trim().min(1, 'city is required').max(40),
  price: z.number({ invalid_type_error: 'must be a number' }).finite().positive('must be greater than zero'),
  commissionPct: z
    .number({ invalid_type_error: 'must be a number' })
    .min(0, 'must be between 0 and 100')
    .max(100, 'must be between 0 and 100'),
});

/**
 * Mounts `GET /supplier{A,B}/hotels` plus admin-only endpoints to edit the
 * catalogues and simulate an outage. The supplier endpoints stand in for
 * third-party APIs — the Temporal activities call them over HTTP rather than
 * importing the data directly.
 */
export function supplierRoutes(): Router {
  const router = Router();

  router.get('/supplierA/hotels', handler('A'));
  router.get('/supplierB/hotels', handler('B'));

  // Admin: add a hotel to a supplier's catalogue.
  router.post('/suppliers/:supplier/hotels', requireAdmin, (req: Request, res: Response) => {
    const supplier = normaliseSupplier(req.params.supplier);
    if (!supplier) {
      res.status(400).json({ error: 'BadRequest', message: 'supplier must be "A" or "B"' });
      return;
    }

    const parsed = newHotelSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid hotel',
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message,
        })),
      });
      return;
    }

    try {
      res.status(201).json({ supplier, hotel: addHotel(supplier, parsed.data) });
    } catch (err) {
      if (err instanceof DuplicateHotelError) {
        res.status(409).json({ error: 'Conflict', message: err.message });
        return;
      }
      throw err;
    }
  });

  // Admin: remove a hotel from a supplier's catalogue.
  router.delete('/suppliers/:supplier/hotels/:hotelId', requireAdmin, (req: Request, res: Response) => {
    const supplier = normaliseSupplier(req.params.supplier);
    if (!supplier) {
      res.status(400).json({ error: 'BadRequest', message: 'supplier must be "A" or "B"' });
      return;
    }
    const removed = removeHotel(supplier, req.params.hotelId ?? '');
    if (!removed) {
      res.status(404).json({ error: 'NotFound', message: `No hotel ${req.params.hotelId} at Supplier ${supplier}` });
      return;
    }
    res.json({ supplier, removed });
  });

  // Admin: runtime outage toggle, body { "down": true, "delayMs": 0 }
  router.post('/suppliers/:supplier/control', requireAdmin, (req: Request, res: Response) => {
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

  // Public: both catalogues as stored, regardless of any simulated outage.
  router.get('/suppliers/catalogue', (_req: Request, res: Response) => {
    res.json({ A: listHotels('A'), B: listHotels('B') });
  });

  // Public: current outage state, so anyone can see why results look partial.
  router.get('/suppliers/control', (_req: Request, res: Response) => {
    res.json(allOutages());
  });

  return router;
}

function handler(supplier: SupplierId) {
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

    const hotels = listHotels(supplier, city);
    logger.debug({ supplier, city, count: hotels.length }, 'mock supplier responded');
    res.json(hotels);
  };
}

function normaliseSupplier(value: string | undefined): SupplierId | null {
  const upper = (value ?? '').toUpperCase();
  return upper === 'A' || upper === 'B' ? upper : null;
}
