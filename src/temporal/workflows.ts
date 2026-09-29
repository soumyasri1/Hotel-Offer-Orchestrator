import { ApplicationFailure, log, proxyActivities } from '@temporalio/workflow';
import { selectBestOffers } from '../domain/dedupe';
import type * as activities from './activities';
import type { BestOffer, SearchInput, SupplierFetchResult } from '../types';

const { fetchSupplierA, fetchSupplierB } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: {
    initialInterval: '200ms',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    // Raised by the activity when the supplier's answer will never become valid.
    nonRetryableErrorTypes: ['SupplierBadRequest', 'SupplierBadPayload'],
  },
});

const { cacheOffers, readFilteredOffers } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { initialInterval: '200ms', backoffCoefficient: 2, maximumAttempts: 3 },
});

/**
 * Orchestrates one hotel search:
 *
 *   1. call both suppliers in parallel;
 *   2. dedupe by hotel name, keeping the best offer for each;
 *   3. persist the deduplicated list to Redis;
 *   4. read it back with the price range applied inside Redis.
 *
 * A single supplier failing is tolerated — we continue with whatever the other
 * one returned. Only a total supplier outage fails the workflow.
 */
export async function hotelSearchWorkflow(input: SearchInput): Promise<BestOffer[]> {
  const { city, minPrice, maxPrice } = input;
  log.info('hotel search started', { city, minPrice, maxPrice });

  // Step 1 — parallel fan-out. allSettled so one supplier's failure does not
  // cancel the other branch.
  const settled = await Promise.allSettled([fetchSupplierA(city), fetchSupplierB(city)]);

  const results: SupplierFetchResult[] = [];
  const failures: string[] = [];

  for (const [index, outcome] of settled.entries()) {
    const supplier = index === 0 ? 'Supplier A' : 'Supplier B';
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
    } else {
      failures.push(supplier);
      log.warn('supplier unavailable, continuing without it', {
        supplier,
        reason: String(outcome.reason),
      });
    }
  }

  if (results.length === 0) {
    throw ApplicationFailure.nonRetryable(
      `All suppliers failed for city "${city}"`,
      'AllSuppliersFailed',
      failures,
    );
  }

  // Step 2 — deduplicate. Pure and deterministic, so it belongs in the workflow.
  const allOffers = results.flatMap((result) => result.offers);
  const best = selectBestOffers(allOffers);
  log.info('deduplicated supplier offers', {
    received: allOffers.length,
    deduplicated: best.length,
    degraded: failures.length > 0,
  });

  // Step 3 — persist for Redis-side filtering.
  await cacheOffers(city, best);

  // Step 4 — read back through the Redis price filter.
  const filtered = await readFilteredOffers(city, minPrice, maxPrice);
  log.info('hotel search finished', { city, returned: filtered.length });

  return filtered;
}
