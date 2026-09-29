import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectBestOffers } from '../src/domain/dedupe';
import type { HotelOffer } from '../src/types';

const offer = (over: Partial<HotelOffer> & { name: string; price: number }): HotelOffer => ({
  hotelId: `${over.name}-${over.price}`,
  city: 'delhi',
  commissionPct: 10,
  supplier: 'Supplier A',
  ...over,
});

test('keeps the cheaper offer when a hotel appears in both suppliers', () => {
  const result = selectBestOffers([
    offer({ name: 'Holtin', price: 6000, supplier: 'Supplier A', commissionPct: 10 }),
    offer({ name: 'Holtin', price: 5340, supplier: 'Supplier B', commissionPct: 20 }),
  ]);

  assert.deepEqual(result, [
    { name: 'Holtin', price: 5340, supplier: 'Supplier B', commissionPct: 20 },
  ]);
});

test('keeps a hotel returned by only one supplier', () => {
  const result = selectBestOffers([offer({ name: 'Levridge', price: 4200, commissionPct: 8 })]);

  assert.deepEqual(result, [
    { name: 'Levridge', price: 4200, supplier: 'Supplier A', commissionPct: 8 },
  ]);
});

test('order of suppliers does not change the winner', () => {
  const a = offer({ name: 'Radison', price: 5900, supplier: 'Supplier A', commissionPct: 13 });
  const b = offer({ name: 'Radison', price: 6150, supplier: 'Supplier B', commissionPct: 18 });

  assert.deepEqual(selectBestOffers([a, b]), selectBestOffers([b, a]));
  assert.equal(selectBestOffers([b, a])[0]?.supplier, 'Supplier A');
});

test('breaks a price tie on the higher commission', () => {
  const result = selectBestOffers([
    offer({ name: 'Tajj', price: 8000, supplier: 'Supplier A', commissionPct: 9 }),
    offer({ name: 'Tajj', price: 8000, supplier: 'Supplier B', commissionPct: 15 }),
  ]);

  assert.equal(result[0]?.supplier, 'Supplier B');
});

test('matches hotel names case-insensitively and reports the first spelling', () => {
  const result = selectBestOffers([
    offer({ name: 'Holtin', price: 6000, supplier: 'Supplier A' }),
    offer({ name: 'HOLTIN', price: 5000, supplier: 'Supplier B' }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'Holtin');
  assert.equal(result[0]?.price, 5000);
});

test('returns results sorted by price ascending', () => {
  const result = selectBestOffers([
    offer({ name: 'Oberoy', price: 11200 }),
    offer({ name: 'Levridge', price: 4200 }),
    offer({ name: 'Radison', price: 5900 }),
  ]);

  assert.deepEqual(
    result.map((r) => r.name),
    ['Levridge', 'Radison', 'Oberoy'],
  );
});

test('returns an empty list for an empty input', () => {
  assert.deepEqual(selectBestOffers([]), []);
});

test('is deterministic across repeated runs (safe for workflow replay)', () => {
  const offers = [
    offer({ name: 'Holtin', price: 5340, supplier: 'Supplier B', commissionPct: 20 }),
    offer({ name: 'Holtin', price: 5340, supplier: 'Supplier A', commissionPct: 20 }),
    offer({ name: 'Radison', price: 5900, supplier: 'Supplier A', commissionPct: 13 }),
  ];

  const first = JSON.stringify(selectBestOffers(offers));
  for (let i = 0; i < 20; i += 1) {
    assert.equal(JSON.stringify(selectBestOffers(offers)), first);
  }
});
