# Hotel Offer Orchestrator

Aggregates overlapping hotel offers from two mock suppliers, deduplicates them by hotel name, selects the best offer per hotel, and lets clients filter the result by price range.

The comparison is orchestrated by a **Temporal** workflow. The deduplicated list is persisted to **Redis**, and the price filter is executed **inside Redis** rather than in application code.

- **Stack:** Node.js 22 · TypeScript · Express · Temporal · Redis · Docker Compose

---

## Contents

- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [API reference](#api-reference)
- [Mock supplier data](#mock-supplier-data)
- [Postman collection](#postman-collection)
- [Simulating a supplier outage](#simulating-a-supplier-outage)
- [Design notes](#design-notes)
- [Configuration](#configuration)
- [Local development without Docker](#local-development-without-docker)
- [Tests](#tests)
- [Project layout](#project-layout)
- [Troubleshooting](#troubleshooting)

---

## How it works

```
     GET /api/hotels?city=delhi&minPrice=&maxPrice=
                        |
                        v
   +---------------------------------------+
   |  API (Express)                        |
   |  validates query, starts a workflow    |
   +---------------------------------------+
                        |  Temporal client
                        v
   +---------------------------------------+
   |  Temporal server                      |
   +---------------------------------------+
                        |  task queue: hotel-offers
                        v
   +---------------------------------------+
   |  Worker: hotelSearchWorkflow          |
   |                                       |
   |  1. fetchSupplierA  ] in parallel      |
   |     fetchSupplierB  ]                  |
   |  2. selectBestOffers()  (in workflow)  |
   |  3. cacheOffers      -> Redis          |
   |  4. readFilteredOffers <- Redis        |
   +---------------------------------------+
         |                        |
         v                        v
   mock supplier APIs        Redis (ZSET + HASH)
   (served by the API)
```

**Step by step:**

1. **Fan-out.** The workflow calls `fetchSupplierA` and `fetchSupplierB` as two parallel activities. Each activity makes a real HTTP call to a mock supplier endpoint, so the suppliers behave like genuine third parties (retries, timeouts and outages all apply).
2. **Deduplicate.** `selectBestOffers()` collapses the combined list to one entry per hotel name. It is a pure, deterministic function, so it runs inside the workflow rather than in an activity.
3. **Persist.** `cacheOffers` writes the deduplicated list to Redis.
4. **Filter.** `readFilteredOffers` reads it back with the price range applied by Redis itself.

A single supplier failing is tolerated — the workflow continues with whatever the other supplier returned. Only a total outage fails the request.

### Selection rules

For each hotel name:

| | Rule |
|---|---|
| 1 | Cheapest price wins. |
| 2 | On a price tie, the higher `commissionPct` wins — same cost to the guest, better margin for us. |
| 3 | Still tied, the alphabetically first supplier wins. |

Rule 3 exists purely so the result is **deterministic**. Temporal replays workflow code during recovery, and a replay that produced a different result would be a non-determinism error.

Hotel names are matched case-insensitively after trimming; the first spelling encountered is the one reported. Results are returned sorted by price, ascending.

### Why the price filter lives in Redis

The deduplicated list is stored under two keys per city:

| Key | Type | Contents |
|---|---|---|
| `hotels:{city}:byprice` | `ZSET` | member = hotel name, **score = price** |
| `hotels:{city}:offers` | `HASH` | field = hotel name, value = the offer as JSON |

Because price is the sort-set score, filtering is a `ZRANGEBYSCORE` — Redis returns exactly the names within `[minPrice, maxPrice]`, already ordered by price. A small Lua script (in [src/redis/offerStore.ts](src/redis/offerStore.ts)) runs that range query and the payload lookup **atomically in one round trip**:

```lua
local names = redis.call('ZRANGEBYSCORE', KEYS[1], ARGV[1], ARGV[2])
...
local values = redis.call('HMGET', KEYS[2], unpack(slice))
```

No filtering happens in Node. An omitted bound becomes `-inf` / `+inf`, so the filtered and unfiltered reads are the same code path. `HMGET` is issued in chunks of 500 because `unpack` on a very large table can overflow the Lua stack.

---

## Quick start

**Prerequisites:** Docker Desktop (or Docker Engine + Compose v2).

```bash
git clone <your-repo-url>
cd assignment3
docker compose up --build
```

First start takes a few minutes: Temporal's `auto-setup` image has to create its Postgres schema. The stack is ready when the API logs `hotel offer orchestrator API listening`.

Then:

```bash
curl "http://localhost:3000/api/hotels?city=delhi"
```

```json
[
  { "name": "Levridge", "price": 4200,  "supplier": "Supplier A", "commissionPct": 8  },
  { "name": "Holtin",   "price": 5340,  "supplier": "Supplier B", "commissionPct": 20 },
  { "name": "Radison",  "price": 5900,  "supplier": "Supplier A", "commissionPct": 13 },
  { "name": "Tajj",     "price": 8200,  "supplier": "Supplier A", "commissionPct": 15 },
  { "name": "Oberoy",   "price": 11200, "supplier": "Supplier B", "commissionPct": 22 }
]
```

With a price range:

```bash
curl "http://localhost:3000/api/hotels?city=delhi&minPrice=5000&maxPrice=9000"
```

### Services

| Service | Port | Purpose |
|---|---|---|
| `api` | 3000 | REST API + mock supplier endpoints |
| `worker` | – | Runs the Temporal workflow and activities |
| `temporal` | 7233 | Temporal server |
| `temporal-ui` | 8080 | Workflow UI — <http://localhost:8080> |
| `redis` | 6379 | Offer cache and price index |
| `postgres` | – | Temporal's persistence store |

Every workflow execution is visible at <http://localhost:8080>, including each activity attempt, its inputs and outputs, and any retries.

To stop, and to wipe the volumes:

```bash
docker compose down
docker compose down -v
```

---

## API reference

### `GET /api/hotels`

Returns the deduplicated, best-priced offer for each hotel in a city.

| Query param | Required | Description |
|---|---|---|
| `city` | yes | City name, case-insensitive. |
| `minPrice` | no | Inclusive lower bound. |
| `maxPrice` | no | Inclusive upper bound. |

Either bound may be supplied on its own.

**200** — an array of offers sorted by price ascending:

```json
[
  { "name": "Holtin", "price": 5340, "supplier": "Supplier B", "commissionPct": 20 }
]
```

A city with no hotels, or a price range that matches nothing, returns `200` with `[]` — an empty result is not an error.

**Error responses:**

| Status | `error` | When |
|---|---|---|
| 400 | `BadRequest` | Missing `city`, a non-numeric or negative price, or `minPrice > maxPrice`. |
| 502 | `SuppliersUnavailable` | Every supplier failed, so there was nothing to compare. |
| 503 | `OrchestratorUnavailable` | Temporal could not be reached to start the workflow. |
| 500 | `WorkflowFailed` | The workflow failed for any other reason (e.g. Redis unreachable). |

400 responses name the offending field:

```json
{
  "error": "BadRequest",
  "message": "Invalid query parameters",
  "details": [{ "field": "minPrice", "message": "must be a number" }]
}
```

### `GET /` — landing page

Open <http://localhost:3000> in a browser for an interactive dashboard. API clients such as curl and Postman get a JSON list of the endpoints instead.

| Everyone (viewer) | Admin (after **Admin login**) |
|---|---|
| Search hotels, including one-click demos of every validation error | Everything a viewer can do |
| See each supplier's raw offers next to the winner the API picked | Add a hotel to Supplier A or B |
| Browse both supplier catalogues, filtered by city | Remove a hotel |
| Per-dependency health, auto-refreshing | Take a supplier down, or make it slow |
| Current outage state of each supplier | |

The customer view sits on a full-page slideshow of Rajasthan photos (Hawa Mahal, Lake Pichola, Amber Fort, City Palace). They are served locally from `public/backgrounds/` so the page works offline. All are from Wikimedia Commons: Marcin Białek (CC BY-SA 4.0), UnpetitproleX (CC BY-SA 4.0), A.Savin (Free Art License), Mohd Danish Ansari (CC BY-SA 4.0) and Hirumon (CC BY 3.0); the credit for the photo on screen is shown in its caption.

The admin password is `ADMIN_PASSWORD` (default `admin123` — change it anywhere other than a local demo). Admin rights are enforced by the server, not just hidden in the page: login returns a bearer token, and every write endpoint returns `401` without one.

### `GET /health`

Reports each dependency separately, including **both suppliers**.

```json
{
  "status": "ok",
  "uptimeSeconds": 42,
  "timestamp": "2026-09-29T14:47:40.787Z",
  "dependencies": {
    "suppliers": {
      "Supplier A": { "status": "up", "latencyMs": 234, "detail": "4 hotels for probe city \"delhi\"" },
      "Supplier B": { "status": "up", "latencyMs": 229, "detail": "4 hotels for probe city \"delhi\"" }
    },
    "redis":    { "status": "up", "latencyMs": 2, "detail": "PING -> PONG" },
    "temporal": { "status": "up", "latencyMs": 8, "detail": "temporal:7233" }
  }
}
```

| `status` | HTTP | Meaning |
|---|---|---|
| `ok` | 200 | Everything reachable. |
| `degraded` | 200 | One supplier is down. Searches are still served from the other, so the service is deliberately **not** marked unhealthy — an orchestrator taken out of rotation for a third party's outage would be worse than one serving partial results. |
| `unhealthy` | 503 | Redis or Temporal is down, or **both** suppliers are down. No useful request can be served. |

The suppliers are probed over HTTP through `SUPPLIER_BASE_URL`, the same path the activities use, so the check exercises the real network route rather than an in-process shortcut.

### Mock supplier endpoints

| Endpoint | Description |
|---|---|
| `GET /supplierA/hotels?city=delhi` | Supplier A catalogue. Omit `city` for everything. |
| `GET /supplierB/hotels?city=delhi` | Supplier B catalogue. |
| `GET /suppliers/catalogue` | Both catalogues as stored, regardless of any simulated outage. |
| `GET /suppliers/control` | Current simulated-outage state of both suppliers. |

### Admin endpoints

All except login need `Authorization: Bearer <token>`.

| Endpoint | Description |
|---|---|
| `POST /admin/login` | Body `{"password":"..."}`. Returns `{ token, expiresAt }`; `401` on a wrong password. |
| `POST /admin/logout` | Invalidates the token. |
| `POST /admin/reset` | Restores the seed catalogues and brings both suppliers back online. |
| `GET /admin/session` | `{ "admin": true\|false }` for the presented token. |
| `POST /suppliers/{A\|B}/hotels` | Add a hotel: `{"name","city","price","commissionPct"}`. `201`, `400` with field details, or `409` if that supplier already lists the name in that city. |
| `DELETE /suppliers/{A\|B}/hotels/{hotelId}` | Remove a hotel. `404` if unknown. |
| `POST /suppliers/{A\|B}/control` | Toggle an outage — see [below](#simulating-a-supplier-outage). |

The catalogues are stored in Redis (`catalogue:supplier:{A|B}` hashes), seeded from [src/suppliers/data.ts](src/suppliers/data.ts) on first use. Because Redis writes to disk, admin edits survive API restarts and image rebuilds; `POST /admin/reset` (the **Reset demo data** button) re-seeds them, which is also how a change to `data.ts` takes effect. Because every search runs the workflow, an added or removed hotel shows up on the very next search.

---

## Mock supplier data

Both catalogues are seeded from static data and deliberately overlap (admins can edit them at runtime, see above). For **delhi**:

| Hotel | Supplier A | Supplier B | Winner |
|---|---|---|---|
| Holtin | 6000 (10%) | **5340 (20%)** | B — cheaper |
| Radison | **5900 (13%)** | 6150 (18%) | A — cheaper |
| Tajj | **8200 (15%)** | 8750 (9%) | A — cheaper |
| Levridge | **4200 (8%)** | – | A — only supplier |
| Oberoy | – | **11200 (22%)** | B — only supplier |

`mumbai` and `bengaluru` are also populated. **`jaipur` is intentionally absent from both catalogues**, so it exercises the "city with no results" case.

The mock endpoints sleep for `SUPPLIER_LATENCY_MS` (default 150 ms) before responding, which makes the parallel fan-out visible in the Temporal UI.

---

## Postman collection

Import [`postman/hotel-offer-orchestrator.postman_collection.json`](postman/hotel-offer-orchestrator.postman_collection.json). It has 21 requests with assertions, in five folders:

| Folder | Covers |
|---|---|
| **Health** | `/health` with every dependency up. |
| **Hotels** | Valid city with overlaps, price range, single bound, range matching nothing, city with no results, a second city. |
| **Validation** | Missing `city`, non-numeric `minPrice`, `minPrice > maxPrice`. |
| **Mock suppliers** | Both supplier endpoints directly. |
| **Supplier outage simulation** | Logs in as admin, then an 8-step scenario: take A down, confirm `degraded`, confirm results still served from B, take B down too, confirm `502`, confirm `unhealthy`, restore both. |

The collection variable `baseUrl` defaults to `http://localhost:3000`, and `adminPassword` to `admin123`.

Run the whole thing from the Collection Runner, or on the command line:

```bash
npm install -g newman
newman run postman/hotel-offer-orchestrator.postman_collection.json
```

Run the folders in order. The outage folder restores both suppliers in its final two steps, so the collection is re-runnable.

---

## Simulating a supplier outage

Supplier health is togglable at runtime, so the failure path can be demonstrated without restarting anything. The easiest way is the landing page: log in as admin and use the **Supplier outages** panel. From the command line:

```bash
# Log in as admin and keep the token
TOKEN=$(curl -s -X POST http://localhost:3000/admin/login \
  -H 'content-type: application/json' -d '{"password":"admin123"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')

# Take Supplier A down
curl -X POST http://localhost:3000/suppliers/A/control -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"down":true}'

# Still 200 - every offer now comes from Supplier B
curl "http://localhost:3000/api/hotels?city=delhi"

# /health reports exactly which supplier is failing
curl http://localhost:3000/health

# Restore
curl -X POST http://localhost:3000/suppliers/A/control -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"down":false}'
```

A supplier can also be made slow instead of dead, to exercise the activity timeout:

```bash
curl -X POST http://localhost:3000/suppliers/B/control -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"delayMs":8000}'
```

Or started in a failed state with `SUPPLIER_A_DOWN=true` / `SUPPLIER_B_DOWN=true`.

Watch it in the Temporal UI at <http://localhost:8080>: the failing activity shows three attempts with exponential backoff, while the healthy supplier's activity completes immediately alongside it.

---

## Design notes

**Suppliers are called over HTTP, not imported.** The activities issue real `fetch` calls against the mock endpoints. Importing the arrays directly would have been simpler but would make the timeout, retry and outage behaviour untestable.

**Deduplication runs in the workflow, not an activity.** It is pure and deterministic, so it costs nothing to replay and needs no separate task round trip. Everything that touches the network — supplier calls, Redis reads and writes — is an activity, which is what Temporal's retry and timeout machinery applies to.

**One supplier failing is not a request failure.** The workflow uses `Promise.allSettled` so a failure in one branch does not cancel the other. Only when every supplier fails does it raise a non-retryable `AllSuppliersFailed`, which the API maps to `502`.

**Retries distinguish transient from permanent failures.** Activities retry up to 3 times with exponential backoff. A `4xx` from a supplier means the request itself was wrong, so the activity raises a non-retryable `SupplierBadRequest` and fails fast instead of burning attempts. The same applies to a malformed payload.

**Malformed supplier rows are skipped, not fatal.** Each row is validated; anything without a usable name, price and commission is dropped and counted in the activity log, so one bad record cannot take out an entire supplier's results.

**Every request runs the workflow.** The Redis entry is a materialised result set for filtering, not a read-through cache — the spec asks for the orchestration to run, so results are not served straight from cache. The keys carry a TTL (`REDIS_TTL_SECONDS`, default 300s) so stale data cannot outlive a deployment. Serving cache hits directly would be a small change in [src/api/routes/hotels.ts](src/api/routes/hotels.ts).

**Logging.** Structured JSON via `pino`, with per-request logging and a `SERVICE_NAME` field distinguishing `api` from `worker`. Activities log the supplier, city, attempt number, result count and latency; the workflow logs the fan-out outcome and whether it ran degraded. Health polling is logged at `debug` to keep it out of the way.

---

## Configuration

All settings are environment variables with working defaults; see [`.env.example`](.env.example). Docker Compose sets them itself.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API port. |
| `LOG_LEVEL` | `info` | `trace` … `fatal`. |
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal gRPC endpoint. |
| `TEMPORAL_NAMESPACE` | `default` | Temporal namespace. |
| `TEMPORAL_TASK_QUEUE` | `hotel-offers` | Must match between API and worker. |
| `TEMPORAL_WORKFLOW_RUN_TIMEOUT_MS` | `30000` | How long the API waits for a result. |
| `TEMPORAL_CONNECT_TIMEOUT_MS` | `3000` | gRPC connect deadline. Keeps `/health` fast when Temporal is down. |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string. |
| `REDIS_KEY_PREFIX` | `hotels` | Prefix for all keys. |
| `REDIS_TTL_SECONDS` | `300` | TTL of a cached city result set. |
| `SUPPLIER_BASE_URL` | `http://localhost:3000` | Where activities reach the mock suppliers. `http://api:3000` in Compose. |
| `SUPPLIER_TIMEOUT_MS` | `5000` | Per-request supplier timeout. |
| `SUPPLIER_LATENCY_MS` | `150` | Artificial latency on the mock endpoints. |
| `SUPPLIER_A_DOWN` / `SUPPLIER_B_DOWN` | `false` | Start a supplier in a failed state. |
| `ADMIN_PASSWORD` | `admin123` | Landing-page admin password. |
| `ADMIN_SESSION_TTL_MS` | `28800000` | Admin token lifetime (8 h). |

---

## Local development without Docker

You still need Temporal and Redis. The lightest way is to run just those from Compose:

```bash
docker compose up redis temporal temporal-ui
```

Then, in two terminals:

```bash
npm install
cp .env.example .env     # defaults already point at localhost

npm run dev:api          # terminal 1 - API + mock suppliers on :3000
npm run dev:worker       # terminal 2 - Temporal worker
```

Both use `tsx watch` and reload on save. For a production-style run:

```bash
npm run build
npm run start:api
npm run start:worker
```

The API and the worker are separate processes on purpose: the worker scales with orchestration load, the API with request volume, and a crash in one does not take down the other.

---

## Tests

```bash
npm run typecheck    # src + test, via tsconfig.test.json
npm test
```

There are two TypeScript configs. [`tsconfig.json`](tsconfig.json) is the **build** config and is scoped to `src` — its `rootDir` is what keeps `dist/` flat. [`tsconfig.test.json`](tsconfig.test.json) extends it with `rootDir: "."` and `noEmit`, and adds `test/`, so the tests are type-checked too and editors do not report them as outside the project.

- [`test/dedupe.test.ts`](test/dedupe.test.ts) covers the selection logic: cheaper supplier wins, single-supplier hotels are kept, supplier ordering does not change the winner, tie-breaks, case-insensitive name matching, sort order, and determinism across repeated runs.
- [`test/redisFilter.test.ts`](test/redisFilter.test.ts) covers the Redis-side price filter — both bounds, each bound alone, no bounds, an empty match, a never-cached city, and result-set replacement. **These run only when Redis is reachable** and skip automatically otherwise, so `npm test` passes without the stack up. To run them, start Redis (`docker compose up redis`) and re-run.

---

## Project layout

```
src/
  api/
    server.ts            process bootstrap, graceful shutdown
    app.ts               express wiring, 404 and error handlers
    landingPage.ts       browser dashboard served at GET /
    auth.ts              admin password login + bearer-token guard
    routes/
      hotels.ts          GET /api/hotels - validation, starts the workflow
      health.ts          GET /health - per-dependency probes
      suppliers.ts       mock supplier APIs, catalogue edits, outage control
      admin.ts           POST /admin/login, logout, session
  temporal/
    workflows.ts         hotelSearchWorkflow - the orchestration
    activities.ts        supplier HTTP calls, Redis read/write
    worker.ts            worker bootstrap
    client.ts            shared Temporal client
  redis/
    offerStore.ts        ZSET/HASH layout + the Lua price filter
    client.ts            shared ioredis connection
  domain/
    dedupe.ts            selectBestOffers - pure, deterministic
  suppliers/
    data.ts              seed catalogues with deliberate overlaps
    catalogue.ts         Redis-backed catalogues admins can edit
    outage.ts            runtime outage toggle
  config.ts              env configuration
  logger.ts              pino setup
test/                    unit and integration tests
postman/                 Postman collection
Dockerfile               multi-stage build, one image for API and worker
docker-compose.yml       full stack
tsconfig.json            build config (src only, drives the dist/ layout)
tsconfig.test.json       type-check config (src + test, no emit)
```

---

## Troubleshooting

**`/api/hotels` returns 503 `OrchestratorUnavailable`.** Temporal is not reachable. Check `docker compose ps` — `temporal` should be `healthy`. On first start it can take a couple of minutes to set up its Postgres schema.

**Requests hang, then time out.** Usually the worker is not running, so nothing is polling the task queue. Check `docker compose logs worker`; it should log `starting temporal worker`. Confirm `TEMPORAL_TASK_QUEUE` matches between the API and the worker.

**`/health` shows `redis: down`.** Check `docker compose logs redis` and that `REDIS_URL` points at `redis://redis:6379` inside Compose (not `localhost`).

**Results look stale.** Entries expire after `REDIS_TTL_SECONDS`. To clear immediately: `docker compose exec redis redis-cli FLUSHALL`.

**Port already in use.** Change the host side of the mapping in `docker-compose.yml` (e.g. `'3001:3000'`), or stop whatever holds the port.

**Inspecting a run.** Open <http://localhost:8080>, pick the newest `hotel-search:...` workflow, and the history shows both supplier activities, their attempts, the cache write and the filtered read.
