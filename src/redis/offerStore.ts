import { config } from '../config';
import { logger } from '../logger';
import type { BestOffer } from '../types';
import { redis } from './client';

/**
 * Storage layout, per city:
 *
 *   {prefix}:{city}:byprice  ZSET   member = hotel name, score = price
 *   {prefix}:{city}:offers   HASH   field  = hotel name, value = JSON offer
 *
 * The ZSET is what makes the price filter a Redis-side operation: a range query
 * on score returns exactly the names in [minPrice, maxPrice], already ordered
 * by price, and the payloads are fetched in the same round trip by the script
 * below. No filtering happens in Node.
 */

function keys(city: string): { zset: string; hash: string; empty: string } {
  const slug = city.trim().toLowerCase();
  return {
    zset: `${config.redis.keyPrefix}:${slug}:byprice`,
    hash: `${config.redis.keyPrefix}:${slug}:offers`,
    empty: `${config.redis.keyPrefix}:${slug}:empty`,
  };
}

/**
 * ZRANGEBYSCORE + HMGET executed atomically inside Redis.
 *
 * HMGET is issued in chunks because `unpack` on a very large table can overflow
 * the Lua stack. Returns `false` in the first slot when the index exists but the
 * payload hash has expired, which the caller treats as a cache miss.
 */
const FILTER_SCRIPT = `
local names = redis.call('ZRANGEBYSCORE', KEYS[1], ARGV[1], ARGV[2])
if #names == 0 then
  return { 0, {} }
end

local exists = redis.call('EXISTS', KEYS[2])
if exists == 0 then
  return { 0, {} }
end

local out = {}
local chunk = 500
local i = 1
while i <= #names do
  local last = math.min(i + chunk - 1, #names)
  local slice = {}
  for j = i, last do
    slice[#slice + 1] = names[j]
  end
  local values = redis.call('HMGET', KEYS[2], unpack(slice))
  for j = 1, #values do
    if values[j] then
      out[#out + 1] = values[j]
    end
  end
  i = last + 1
end

return { 1, out }
`;

export interface FilterResult {
  /** False when the city has never been cached (or the cache expired). */
  hit: boolean;
  offers: BestOffer[];
}

/** Replaces the cached result set for a city, atomically. */
export async function saveOffers(city: string, offers: BestOffer[]): Promise<void> {
  const { zset, hash, empty } = keys(city);
  const client = redis();
  const pipeline = client.multi();

  pipeline.del(zset, hash, empty);

  if (offers.length > 0) {
    const zsetArgs: (string | number)[] = [];
    const hashArgs: string[] = [];
    for (const offer of offers) {
      zsetArgs.push(offer.price, offer.name);
      hashArgs.push(offer.name, JSON.stringify(offer));
    }
    pipeline.zadd(zset, ...(zsetArgs as [string | number, ...(string | number)[]]));
    pipeline.hset(hash, ...(hashArgs as [string, ...string[]]));
    pipeline.expire(zset, config.redis.ttlSeconds);
    pipeline.expire(hash, config.redis.ttlSeconds);
  } else {
    // Remember the empty result too, so a no-results city still reads as a hit.
    pipeline.set(empty, '1', 'EX', config.redis.ttlSeconds);
  }

  // exec() reports per-command failures in its result rather than throwing,
  // so a silent partial write would otherwise look like a success.
  const results = await pipeline.exec();
  const failure = results?.find(([err]) => err !== null)?.[0];
  if (failure) throw failure;

  logger.info({ city, count: offers.length }, 'cached deduplicated offers in redis');
}

/**
 * Reads a city's offers back, filtered by price inside Redis.
 * Omitted bounds become -inf / +inf, so an unfiltered read is the same code path.
 */
export async function filterOffers(
  city: string,
  minPrice?: number,
  maxPrice?: number,
): Promise<FilterResult> {
  const { zset, hash, empty } = keys(city);
  const client = redis();

  const min = minPrice === undefined ? '-inf' : String(minPrice);
  const max = maxPrice === undefined ? '+inf' : String(maxPrice);

  const raw = (await client.eval(FILTER_SCRIPT, 2, zset, hash, min, max)) as [number, string[]];
  const [found, payloads] = raw;

  if (found === 1) {
    return { hit: true, offers: payloads.map((json) => JSON.parse(json) as BestOffer) };
  }

  // Nothing matched. Distinguish "cached, but this city genuinely has no
  // hotels" from "never cached" so the caller knows whether to run the workflow.
  const emptyMarker = await client.exists(empty);
  if (emptyMarker === 1) {
    return { hit: true, offers: [] };
  }

  const indexed = await client.exists(zset);
  return { hit: indexed === 1, offers: [] };
}

export async function pingRedis(): Promise<string> {
  return redis().ping();
}
