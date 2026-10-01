function str(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}"`);
  }
  return parsed;
}

export const config = {
  port: int('PORT', 3000),
  logLevel: str('LOG_LEVEL', 'info'),

  temporal: {
    address: str('TEMPORAL_ADDRESS', 'localhost:7233'),
    namespace: str('TEMPORAL_NAMESPACE', 'default'),
    taskQueue: str('TEMPORAL_TASK_QUEUE', 'hotel-offers'),
    /** How long the API waits for a workflow result before giving up. */
    workflowRunTimeoutMs: int('TEMPORAL_WORKFLOW_RUN_TIMEOUT_MS', 30_000),
    /** How long to wait for the gRPC connection itself. */
    connectTimeoutMs: int('TEMPORAL_CONNECT_TIMEOUT_MS', 3_000),
  },

  redis: {
    url: str('REDIS_URL', 'redis://localhost:6379'),
    keyPrefix: str('REDIS_KEY_PREFIX', 'hotels'),
    /** TTL of a cached city result set, in seconds. */
    ttlSeconds: int('REDIS_TTL_SECONDS', 300),
  },

  suppliers: {
    /**
     * Where the activities reach the mock supplier APIs. They are hosted by this
     * same service, so in Compose this points the worker back at the API container.
     */
    baseUrl: str('SUPPLIER_BASE_URL', 'http://localhost:3000'),
    timeoutMs: int('SUPPLIER_TIMEOUT_MS', 5_000),
    /** Artificial latency on the mock endpoints, to make the parallel fan-out visible. */
    latencyMs: int('SUPPLIER_LATENCY_MS', 150),
  },

  admin: {
    /** Password for the landing page's admin login. Override it outside local demos. */
    password: str('ADMIN_PASSWORD', 'admin123'),
    /** How long an admin session token stays valid. */
    sessionTtlMs: int('ADMIN_SESSION_TTL_MS', 8 * 60 * 60 * 1000),
  },
} as const;

export type Config = typeof config;
