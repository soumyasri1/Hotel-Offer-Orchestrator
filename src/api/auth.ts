import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

/**
 * Minimal admin auth for the demo: one shared password, exchanged at login for
 * an opaque bearer token held in memory. Tokens do not survive a restart and
 * are not shared between API replicas — enough for a single mock-supplier host,
 * not a substitute for a real identity provider.
 */
const sessions = new Map<string, number>(); // token -> expiresAt (epoch ms)

/** Constant-time comparison; hashing first makes the lengths equal. */
function passwordMatches(candidate: string): boolean {
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(config.admin.password).digest();
  return timingSafeEqual(a, b);
}

export function login(password: string): { token: string; expiresAt: number } | null {
  if (!passwordMatches(password)) return null;
  const token = randomUUID();
  const expiresAt = Date.now() + config.admin.sessionTtlMs;
  sessions.set(token, expiresAt);
  return { token, expiresAt };
}

export function logout(token: string | undefined): void {
  if (token) sessions.delete(token);
}

export function bearerToken(req: Request): string | undefined {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

export function isAdmin(req: Request): boolean {
  const token = bearerToken(req);
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (expiresAt === undefined) return false;
  if (expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

/** Route guard: 401 unless the request carries a live admin token. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (isAdmin(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized', message: 'Admin login required' });
}
