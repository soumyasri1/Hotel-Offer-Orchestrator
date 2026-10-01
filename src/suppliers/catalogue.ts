import { logger } from '../logger';
import { redis } from '../redis/client';
import type { SupplierHotel } from '../types';
import { SUPPLIER_A_HOTELS, SUPPLIER_B_HOTELS } from './data';
import type { SupplierId } from './outage';

/**
 * Supplier catalogues, persisted in Redis and seeded from the static data.
 *
 * Admins add and remove hotels through the API; the mock supplier endpoints
 * read from here, so a change shows up on the very next search. Keeping them
 * in Redis (which writes to disk) means admin edits survive API restarts and
 * image rebuilds. "Reset demo data" re-seeds them.
 *
 *   catalogue:supplier:{A|B}       HASH   field = hotelId, value = JSON hotel
 *   catalogue:supplier:{A|B}:seq   STRING last numeric id issued (a10, b10, ...)
 *   catalogue:seeded               STRING marker; absent until the first seed
 *
 * The marker distinguishes "never seeded" from "an admin removed every hotel".
 */
const SUPPLIERS: SupplierId[] = ['A', 'B'];
const SEED: Record<SupplierId, readonly SupplierHotel[]> = { A: SUPPLIER_A_HOTELS, B: SUPPLIER_B_HOTELS };
const SEEDED_KEY = 'catalogue:seeded';
const hashKey = (supplier: SupplierId) => `catalogue:supplier:${supplier}`;
const seqKey = (supplier: SupplierId) => `catalogue:supplier:${supplier}:seq`;

export interface NewHotel {
  name: string;
  city: string;
  price: number;
  commissionPct: number;
}

export class DuplicateHotelError extends Error {}

/** Highest numeric suffix in a list of ids such as a1, a2, ... */
function highestId(supplier: SupplierId, hotels: readonly SupplierHotel[]): number {
  const prefix = supplier.toLowerCase();
  return hotels.reduce((max, hotel) => {
    const n = Number.parseInt(hotel.hotelId.slice(prefix.length), 10);
    return hotel.hotelId.startsWith(prefix) && Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
}

/** Overwrites both catalogues with the seed data, atomically. */
async function writeSeed(): Promise<void> {
  const tx = redis().multi();
  for (const supplier of SUPPLIERS) {
    tx.del(hashKey(supplier));
    const fields = SEED[supplier].flatMap((hotel) => [hotel.hotelId, JSON.stringify(hotel)]);
    if (fields.length > 0) tx.hset(hashKey(supplier), ...(fields as [string, ...string[]]));
    tx.set(seqKey(supplier), highestId(supplier, SEED[supplier]));
  }
  tx.set(SEEDED_KEY, '1');
  const results = await tx.exec();
  const failure = results?.find(([err]) => err !== null)?.[0];
  if (failure) throw failure;
}

let seeded: Promise<void> | null = null;

/** Seeds Redis on first use only; later calls reuse the result. */
function ensureSeeded(): Promise<void> {
  if (!seeded) {
    seeded = (async () => {
      if ((await redis().exists(SEEDED_KEY)) === 0) {
        await writeSeed();
        logger.info('supplier catalogues seeded into redis');
      }
    })().catch((err: unknown) => {
      seeded = null; // retry on the next call rather than caching the failure
      throw err;
    });
  }
  return seeded;
}

/** Discards every admin edit and restores the seed data. */
export async function resetCatalogues(): Promise<void> {
  await writeSeed();
  seeded = Promise.resolve();
  logger.info('supplier catalogues reset to seed data');
}

/** Case-insensitive city match; an empty city returns the whole catalogue. */
export async function listHotels(supplier: SupplierId, city?: string): Promise<SupplierHotel[]> {
  await ensureSeeded();
  const all = (await redis().hvals(hashKey(supplier)))
    .map((json) => JSON.parse(json) as SupplierHotel)
    .sort((a, b) => highestId(supplier, [a]) - highestId(supplier, [b]));
  if (!city) return all;
  const needle = city.trim().toLowerCase();
  return all.filter((hotel) => hotel.city.toLowerCase() === needle);
}

export async function addHotel(supplier: SupplierId, input: NewHotel): Promise<SupplierHotel> {
  const name = input.name.trim();
  const city = input.city.trim().toLowerCase();

  const existing = await listHotels(supplier, city);
  if (existing.some((hotel) => hotel.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new DuplicateHotelError(`Supplier ${supplier} already lists "${name}" in ${city}`);
  }

  // INCR hands out unique ids even when two admins add at the same moment.
  const n = await redis().incr(seqKey(supplier));
  const hotel: SupplierHotel = {
    hotelId: `${supplier.toLowerCase()}${n}`,
    name,
    city,
    price: input.price,
    commissionPct: input.commissionPct,
  };
  await redis().hset(hashKey(supplier), hotel.hotelId, JSON.stringify(hotel));
  logger.info({ supplier, hotel }, 'admin added a supplier hotel');
  return hotel;
}

export async function removeHotel(supplier: SupplierId, hotelId: string): Promise<SupplierHotel | null> {
  await ensureSeeded();
  const json = await redis().hget(hashKey(supplier), hotelId);
  if (json === null) return null;
  await redis().hdel(hashKey(supplier), hotelId);
  logger.info({ supplier, hotelId }, 'admin removed a supplier hotel');
  return JSON.parse(json) as SupplierHotel;
}
