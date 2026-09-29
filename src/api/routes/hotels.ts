import { randomUUID } from 'node:crypto';
import { WorkflowFailedError } from '@temporalio/client';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { errorMessage, logger } from '../../logger';
import { temporalClient } from '../../temporal/client';
import { hotelSearchWorkflow } from '../../temporal/workflows';
import type { BestOffer } from '../../types';

/** `?minPrice=` / `?maxPrice=` arrive as strings; reject anything non-numeric. */
const numericQuery = z
  .string()
  .trim()
  .refine((value) => value !== '' && Number.isFinite(Number(value)), {
    message: 'must be a number',
  })
  .transform(Number)
  .refine((value) => value >= 0, { message: 'must be zero or greater' });

const querySchema = z
  .object({
    city: z.string().trim().min(1, 'city is required'),
    minPrice: numericQuery.optional(),
    maxPrice: numericQuery.optional(),
  })
  .refine(
    (q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice,
    { message: 'minPrice must not be greater than maxPrice', path: ['minPrice'] },
  );

export function hotelRoutes(): Router {
  const router = Router();

  router.get('/api/hotels', async (req: Request, res: Response): Promise<void> => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid query parameters',
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'query',
          message: issue.message,
        })),
      });
      return;
    }

    const { city, minPrice, maxPrice } = parsed.data;
    const workflowId = `hotel-search:${city.toLowerCase()}:${randomUUID()}`;
    const log = logger.child({ route: 'GET /api/hotels', city, minPrice, maxPrice, workflowId });

    try {
      const client = await temporalClient();
      const started = Date.now();

      const offers = await client.workflow.execute(hotelSearchWorkflow, {
        taskQueue: config.temporal.taskQueue,
        workflowId,
        args: [{ city, minPrice, maxPrice }],
        workflowRunTimeout: config.temporal.workflowRunTimeoutMs,
      });

      log.info({ count: offers.length, ms: Date.now() - started }, 'hotel search completed');
      res.json(offers satisfies BestOffer[]);
    } catch (err) {
      handleFailure(err, res, log);
    }
  });

  return router;
}

function handleFailure(err: unknown, res: Response, log: typeof logger): void {
  if (err instanceof WorkflowFailedError) {
    const cause = err.cause?.message ?? err.message;

    if (cause.includes('All suppliers failed')) {
      log.error({ err: cause }, 'every supplier was unavailable');
      res.status(502).json({
        error: 'SuppliersUnavailable',
        message: 'No supplier could be reached for this request. Please retry shortly.',
      });
      return;
    }

    log.error({ err: cause }, 'workflow failed');
    res.status(500).json({ error: 'WorkflowFailed', message: cause });
    return;
  }

  // Most commonly: Temporal itself is unreachable.
  log.error({ err: errorMessage(err) }, 'could not run the hotel search workflow');
  res.status(503).json({
    error: 'OrchestratorUnavailable',
    message: 'The orchestration service is unavailable. Please retry shortly.',
  });
}
