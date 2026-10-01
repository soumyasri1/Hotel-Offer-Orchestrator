import { logger } from '../logger';
import type { SupplierHotel } from '../types';
import { SUPPLIER_A_HOTELS, SUPPLIER_B_HOTELS } from './data';
import type { SupplierId } from './outage';

/**
 * Mutable, in-memory supplier catalogues, seeded from the static data.
 *
 * Admins add and remove hotels through the API; the mock supplier endpoints
 * read from here, so a change shows up on the very next search. Edits live in
 * the API process and reset to the seed data on restart, which is what a mock
 * third party needs.
 */
const catalogues: Record<SupplierId, SupplierHotel[]> = {
  A: SUPPLIER_A_HOTELS.map((hotel) => ({ ...hotel })),
  B: SUPPLIER_B_HOTELS.map((hotel) => ({ ...hotel })),
};

export interface NewHotel {
  name: string;
  city: string;
  price: number;
  commissionPct: number;
}

/** Case-insensitive city match; an empty city returns the whole catalogue. */
export function listHotels(supplier: SupplierId, city?: string): SupplierHotel[] {
  const all = catalogues[supplier];
  if (!city) return all.map((hotel) => ({ ...hotel }));
  const needle = city.trim().toLowerCase();
  return all.filter((hotel) => hotel.city.toLowerCase() === needle).map((hotel) => ({ ...hotel }));
}

export class DuplicateHotelError extends Error {}

export function addHotel(supplier: SupplierId, input: NewHotel): SupplierHotel {
  const list = catalogues[supplier];
  const name = input.name.trim();
  const city = input.city.trim().toLowerCase();

  const clash = list.some(
    (hotel) => hotel.city === city && hotel.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (clash) {
    throw new DuplicateHotelError(`Supplier ${supplier} already lists "${name}" in ${city}`);
  }

  const hotel: SupplierHotel = {
    hotelId: nextId(supplier),
    name,
    city,
    price: input.price,
    commissionPct: input.commissionPct,
  };
  list.push(hotel);
  logger.info({ supplier, hotel }, 'admin added a supplier hotel');
  return { ...hotel };
}

export function removeHotel(supplier: SupplierId, hotelId: string): SupplierHotel | null {
  const list = catalogues[supplier];
  const index = list.findIndex((hotel) => hotel.hotelId === hotelId);
  if (index === -1) return null;
  const [removed] = list.splice(index, 1);
  logger.info({ supplier, hotelId }, 'admin removed a supplier hotel');
  return removed ?? null;
}

/** IDs follow the seed data's pattern: a1, a2, ... / b1, b2, ... */
function nextId(supplier: SupplierId): string {
  const prefix = supplier.toLowerCase();
  const highest = catalogues[supplier].reduce((max, hotel) => {
    const n = Number.parseInt(hotel.hotelId.slice(prefix.length), 10);
    return hotel.hotelId.startsWith(prefix) && Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return `${prefix}${highest + 1}`;
}
