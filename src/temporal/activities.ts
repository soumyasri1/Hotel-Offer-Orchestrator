import { ApplicationFailure, Context } from '@temporalio/activity';
import { config } from '../config';
import { errorMessage, logger } from '../logger';
import { filterOffers, saveOffers } from '../redis/offerStore';
import type { BestOffer, HotelOffer, SupplierFetchResult, SupplierHotel } from '../types';

const SUPPLIER_A = 'Supplier A';
const SUPPLIER_B = 'Supplier B';

/** Calls the mock Supplier A API. */
export async function fetchSupplierA(city: string): Promise<SupplierFetchResult> {
  return fetchSupplier(SUPPLIER_A, '/supplierA/hotels', city);
}

/** Calls the mock Supplier B API. */
export async function fetchSupplierB(city: string): Promise<SupplierFetchResult> {
  return fetchSupplier(SUPPLIER_B, '/supplierB/hotels', city);
}

async function fetchSupplier(
  supplier: string,
  path: string,
  city: string,
): Promise<SupplierFetchResult> {
  const url = `${config.suppliers.baseUrl}${path}?city=${encodeURIComponent(city)}`;
  const attempt = Context.current().info.attempt;
  const log = logger.child({ activity: 'fetchSupplier', supplier, city, attempt });

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(config.suppliers.timeoutMs),
      headers: { accept: 'application/json' },
    });
  } catch (err) {
    // Network error or timeout — retryable, Temporal will back off and retry.
    log.error({ err: errorMessage(err), url }, 'supplier request failed');
    throw new Error(`${supplier} request failed: ${errorMessage(err)}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const detail = `${supplier} responded ${response.status}: ${body.slice(0, 200)}`;
    log.error({ status: response.status, url }, 'supplier returned an error status');

    // 4xx means we asked wrongly — retrying will not help.
    if (response.status >= 400 && response.status < 500) {
      throw ApplicationFailure.nonRetryable(detail, 'SupplierBadRequest');
    }
    throw new Error(detail);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw ApplicationFailure.nonRetryable(
      `${supplier} returned a non-array payload`,
      'SupplierBadPayload',
    );
  }

  const offers = payload
    .filter(isSupplierHotel)
    .map<HotelOffer>((hotel) => ({ ...hotel, supplier }));

  log.info(
    { count: offers.length, skipped: payload.length - offers.length, ms: Date.now() - started },
    'supplier responded',
  );

  return { supplier, offers };
}

function isSupplierHotel(value: unknown): value is SupplierHotel {
  if (typeof value !== 'object' || value === null) return false;
  const hotel = value as Record<string, unknown>;
  return (
    typeof hotel.name === 'string' &&
    hotel.name.trim() !== '' &&
    typeof hotel.price === 'number' &&
    Number.isFinite(hotel.price) &&
    typeof hotel.commissionPct === 'number'
  );
}

/** Persists the deduplicated list so Redis can serve price-filtered reads. */
export async function cacheOffers(city: string, offers: BestOffer[]): Promise<void> {
  try {
    await saveOffers(city, offers);
  } catch (err) {
    logger.error({ activity: 'cacheOffers', city, err: errorMessage(err) }, 'redis write failed');
    throw new Error(`Failed to cache offers for "${city}": ${errorMessage(err)}`);
  }
}

/** Reads the cached list back, with the price range applied inside Redis. */
export async function readFilteredOffers(
  city: string,
  minPrice?: number,
  maxPrice?: number,
): Promise<BestOffer[]> {
  try {
    const { hit, offers } = await filterOffers(city, minPrice, maxPrice);
    logger.info(
      { activity: 'readFilteredOffers', city, minPrice, maxPrice, hit, count: offers.length },
      'read price-filtered offers from redis',
    );
    return offers;
  } catch (err) {
    logger.error(
      { activity: 'readFilteredOffers', city, err: errorMessage(err) },
      'redis read failed',
    );
    throw new Error(`Failed to read offers for "${city}": ${errorMessage(err)}`);
  }
}
