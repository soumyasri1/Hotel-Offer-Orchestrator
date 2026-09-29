import type { BestOffer, HotelOffer } from '../types';

/**
 * Collapses offers from every supplier down to one per hotel name.
 *
 * Selection rules, in order:
 *   1. cheapest price wins;
 *   2. on a price tie, the higher commission wins (same cost to the guest,
 *      better margin for us);
 *   3. still tied, the supplier name that sorts first wins, purely so the
 *      result is deterministic — this runs inside a Temporal workflow, where a
 *      replay must produce the identical output.
 *
 * Names are matched case-insensitively after trimming; the first spelling seen
 * is the one reported.
 */
export function selectBestOffers(offers: HotelOffer[]): BestOffer[] {
  const best = new Map<string, HotelOffer>();

  for (const offer of offers) {
    const key = offer.name.trim().toLowerCase();
    const incumbent = best.get(key);
    if (!incumbent || beats(offer, incumbent)) {
      best.set(key, incumbent ? { ...offer, name: incumbent.name } : offer);
    }
  }

  return [...best.values()]
    .map(({ name, price, supplier, commissionPct }) => ({ name, price, supplier, commissionPct }))
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
}

function beats(candidate: HotelOffer, incumbent: HotelOffer): boolean {
  if (candidate.price !== incumbent.price) return candidate.price < incumbent.price;
  if (candidate.commissionPct !== incumbent.commissionPct) {
    return candidate.commissionPct > incumbent.commissionPct;
  }
  return candidate.supplier.localeCompare(incumbent.supplier) < 0;
}
