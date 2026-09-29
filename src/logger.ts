import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.logLevel,
  base: { service: process.env.SERVICE_NAME ?? 'hotel-offer-orchestrator' },
  redact: { paths: ['req.headers.authorization'], remove: true },
});

export type Logger = typeof logger;

/** Normalises anything thrown into a readable message. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
