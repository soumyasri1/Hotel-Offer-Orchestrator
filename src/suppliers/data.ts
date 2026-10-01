import type { SupplierHotel } from '../types';

/**
 * Static supplier catalogues.
 *
 * The two lists deliberately overlap so the comparison step has something to do:
 *
 *   delhi    - Holtin (B cheaper), Radison (A cheaper), Tajj (A cheaper),
 *              Levridge (A only), Oberoy (B only)
 *   mumbai   - Holtin (B cheaper), Marriot (A cheaper), Sealink Suites (B only)
 *   bengaluru- Radison (B cheaper), Leelah (A only)
 *
 * `jaipur` is intentionally absent from both catalogues so the "city with no
 * results" case can be exercised.
 */
export const SUPPLIER_A_HOTELS: readonly SupplierHotel[] = [
  { hotelId: 'a1', name: 'Holtin', price: 6000, city: 'delhi', commissionPct: 10 },
  { hotelId: 'a2', name: 'Radison', price: 5900, city: 'delhi', commissionPct: 13 },
  { hotelId: 'a3', name: 'Tajj', price: 8200, city: 'delhi', commissionPct: 15 },
  { hotelId: 'a4', name: 'Levridge', price: 4200, city: 'delhi', commissionPct: 8 },
  { hotelId: 'a5', name: 'Holtin', price: 7400, city: 'mumbai', commissionPct: 10 },
  { hotelId: 'a6', name: 'Marriot', price: 9100, city: 'mumbai', commissionPct: 12 },
  { hotelId: 'a7', name: 'Radison', price: 5100, city: 'bengaluru', commissionPct: 11 },
  { hotelId: 'a8', name: 'Leelah', price: 6800, city: 'bengaluru', commissionPct: 14 },
  { hotelId: 'a9', name: 'Hyatt', price: 6100, city: 'bengaluru', commissionPct: 13 },

];

export const SUPPLIER_B_HOTELS: readonly SupplierHotel[] = [
  { hotelId: 'b1', name: 'Holtin', price: 5340, city: 'delhi', commissionPct: 20 },
  { hotelId: 'b2', name: 'Radison', price: 6150, city: 'delhi', commissionPct: 18 },
  { hotelId: 'b3', name: 'Tajj', price: 8750, city: 'delhi', commissionPct: 9 },
  { hotelId: 'b4', name: 'Oberoy', price: 11200, city: 'delhi', commissionPct: 22 },
  { hotelId: 'b5', name: 'Holtin', price: 7050, city: 'mumbai', commissionPct: 19 },
  { hotelId: 'b6', name: 'Marriot', price: 9400, city: 'mumbai', commissionPct: 16 },
  { hotelId: 'b7', name: 'Sealink Suites', price: 12300, city: 'mumbai', commissionPct: 21 },
  { hotelId: 'b8', name: 'Radison', price: 4950, city: 'bengaluru', commissionPct: 17 },
  { hotelId: 'b9', name: 'Hyatt', price: 6300, city: 'bengaluru', commissionPct: 12 },

];

/** Case-insensitive city match; an empty city returns the whole catalogue. */
export function hotelsForCity(
  catalogue: readonly SupplierHotel[],
  city: string | undefined,
): SupplierHotel[] {
  if (!city) return [...catalogue];
  const needle = city.trim().toLowerCase();
  return catalogue.filter((hotel) => hotel.city.toLowerCase() === needle);
}
