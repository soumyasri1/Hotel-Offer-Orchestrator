/** Shape returned by the mock supplier APIs. */
export interface SupplierHotel {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
}

/** A supplier hotel tagged with the supplier it came from. */
export interface HotelOffer extends SupplierHotel {
  supplier: string;
}

/** The public response shape, per the spec. */
export interface BestOffer {
  name: string;
  price: number;
  supplier: string;
  commissionPct: number;
}

export interface SearchInput {
  city: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface SupplierFetchResult {
  supplier: string;
  offers: HotelOffer[];
}

export type DependencyState = 'up' | 'down';

export interface DependencyHealth {
  status: DependencyState;
  latencyMs: number;
  /** Present only when the dependency is down. */
  error?: string;
  /** Extra detail, e.g. hotel count returned by a supplier. */
  detail?: string;
}
