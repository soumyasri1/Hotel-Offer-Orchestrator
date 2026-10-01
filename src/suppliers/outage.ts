import { logger } from '../logger';

export type SupplierId = 'A' | 'B';

export interface OutageState {
  down: boolean;
  /** Extra delay (ms) injected before responding, to simulate a slow supplier. */
  delayMs: number;
}

const state: Record<SupplierId, OutageState> = {
  A: { down: envFlag('SUPPLIER_A_DOWN'), delayMs: 0 },
  B: { down: envFlag('SUPPLIER_B_DOWN'), delayMs: 0 },
};

function envFlag(name: string): boolean {
  return (process.env[name] ?? '').toLowerCase() === 'true';
}

export function getOutage(supplier: SupplierId): OutageState {
  return state[supplier];
}

/**
 * Flips a mock supplier between healthy and failing at runtime, so the
 * "one supplier is down" path can be exercised without restarting anything.
 */
export function setOutage(supplier: SupplierId, patch: Partial<OutageState>): OutageState {
  const next = { ...state[supplier], ...patch };
  state[supplier] = next;
  logger.warn({ supplier, ...next }, 'supplier outage state changed');
  return next;
}

/** Brings both suppliers back to their start-up state. */
export function resetOutages(): Record<SupplierId, OutageState> {
  state.A = { down: envFlag('SUPPLIER_A_DOWN'), delayMs: 0 };
  state.B = { down: envFlag('SUPPLIER_B_DOWN'), delayMs: 0 };
  logger.warn({ ...state }, 'supplier outage state reset');
  return allOutages();
}

export function allOutages(): Record<SupplierId, OutageState> {
  return { A: { ...state.A }, B: { ...state.B } };
}
