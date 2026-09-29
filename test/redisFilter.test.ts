import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { closeRedis, redis } from '../src/redis/client';
import { filterOffers, saveOffers } from '../src/redis/offerStore';
import type { BestOffer } from '../src/types';

/**
 * Exercises the Redis-side price filter against a real Redis.
 * Skipped automatically when none is reachable, so `npm test` still passes
 * without the Compose stack running.
 */
const CITY = 'test-city-redis-filter';

const OFFERS: BestOffer[] = [
  { name: 'Levridge', price: 4200, supplier: 'Supplier A', commissionPct: 8 },
  { name: 'Holtin', price: 5340, supplier: 'Supplier B', commissionPct: 20 },
  { name: 'Radison', price: 5900, supplier: 'Supplier A', commissionPct: 13 },
  { name: 'Tajj', price: 8200, supplier: 'Supplier A', commissionPct: 15 },
  { name: 'Oberoy', price: 11200, supplier: 'Supplier B', commissionPct: 22 },
];

let available = false;

before(async () => {
  try {
    // Bounded probe: ioredis retries a refused connection, so cap the wait.
    await Promise.race([
      redis().ping(),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('probe timed out')), 3_000).unref(),
      ),
    ]);
    available = true;
  } catch {
    available = false;
    console.log('Redis not reachable - skipping Redis filter tests');
  }
});

after(async () => {
  if (available) {
    await redis().del(
      `hotels:${CITY}:byprice`,
      `hotels:${CITY}:offers`,
      `hotels:${CITY}:empty`,
    );
  }
  await closeRedis();
});

describe('Redis price filtering', () => {
  const names = (offers: BestOffer[]) => offers.map((o) => o.name);

  test('returns everything when no bounds are given', async (t) => {
    if (!available) return t.skip('no redis');
    await saveOffers(CITY, OFFERS);

    const { hit, offers } = await filterOffers(CITY);
    assert.equal(hit, true);
    assert.deepEqual(names(offers), ['Levridge', 'Holtin', 'Radison', 'Tajj', 'Oberoy']);
  });

  test('applies both bounds inclusively', async (t) => {
    if (!available) return t.skip('no redis');
    await saveOffers(CITY, OFFERS);

    const { offers } = await filterOffers(CITY, 5340, 8200);
    assert.deepEqual(names(offers), ['Holtin', 'Radison', 'Tajj']);
  });

  test('applies a lower bound only', async (t) => {
    if (!available) return t.skip('no redis');
    await saveOffers(CITY, OFFERS);

    const { offers } = await filterOffers(CITY, 6000, undefined);
    assert.deepEqual(names(offers), ['Tajj', 'Oberoy']);
  });

  test('applies an upper bound only', async (t) => {
    if (!available) return t.skip('no redis');
    await saveOffers(CITY, OFFERS);

    const { offers } = await filterOffers(CITY, undefined, 5340);
    assert.deepEqual(names(offers), ['Levridge', 'Holtin']);
  });

  test('returns an empty list when the range matches nothing', async (t) => {
    if (!available) return t.skip('no redis');
    await saveOffers(CITY, OFFERS);

    const { hit, offers } = await filterOffers(CITY, 90000, 99000);
    assert.equal(hit, true);
    assert.deepEqual(offers, []);
  });

  test('reports a miss for a city that was never cached', async (t) => {
    if (!available) return t.skip('no redis');

    const { hit, offers } = await filterOffers('never-cached-city-xyz');
    assert.equal(hit, false);
    assert.deepEqual(offers, []);
  });

  test('caching an empty result still reads as a hit', async (t) => {
    if (!available) return t.skip('no redis');
    await saveOffers(CITY, []);

    const { hit, offers } = await filterOffers(CITY);
    assert.equal(hit, true);
    assert.deepEqual(offers, []);
  });

  test('a later save replaces the previous result set', async (t) => {
    if (!available) return t.skip('no redis');
    await saveOffers(CITY, OFFERS);
    await saveOffers(CITY, [OFFERS[1]!]);

    const { offers } = await filterOffers(CITY);
    assert.deepEqual(names(offers), ['Holtin']);
  });
});
