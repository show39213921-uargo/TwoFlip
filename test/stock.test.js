import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STOCK_STATES, isStale, normalizeCheck, validateCheck, stockSummary, matchesStockFilter } from '../assets/js/stock.js';

const NOW = Date.parse('2026-10-13T10:00:00Z');
const H = 3600000;
const rates = { JPY: 9.3 };
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

test('재고 상태 4가지 — 살 수 있는 건 재고 있음·소량뿐', () => {
  assert.deepEqual(STOCK_STATES.map((s) => [s.key, s.buyable]), [['in', true], ['low', true], ['out', false], ['unknown', false]]);
});

test('오래된 확인 — 기준 시간 초과 · 시각이 없거나 깨지면 오래된 것으로', () => {
  assert.equal(isStale(iso(2 * H), NOW, 24), false);
  assert.equal(isStale(iso(25 * H), NOW, 24), true);
  assert.equal(isStale('bad', NOW, 24), true);
  assert.equal(isStale(undefined, NOW, 24), true);
});

test('예전 기록(재고 칸 없음)은 「확인 불가」 · 사이즈는 신청 사이즈 · 방식은 수동', () => {
  const c = normalizeCheck({ id: 'x', name: '공식몰', price: 320000, currency: 'KRW', at: iso(H) }, 'L');
  assert.equal(c.stock, 'unknown');
  assert.equal(c.size, 'L');
  assert.equal(c.method, 'manual');
});

test('입력 검증 — 재고 상태·사이즈 필수, 가격은 선택(품절이면 없어도 됨)', () => {
  const ok = validateCheck({ type: 'offline', name: ' 나이키 강남 ', size: 'l', stock: 'in', price: '299,000', currency: 'KRW', url: '', note: '1개' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { type: 'offline', name: '나이키 강남', size: 'L', stock: 'in', price: 299000, currency: 'KRW', url: '', note: '1개', method: 'manual' });

  const out = validateCheck({ type: 'official', name: '공식몰', size: 'L', stock: 'out', price: '', currency: 'KRW' });
  assert.equal(out.ok, true);
  assert.equal(out.value.price, null);

  const bad = validateCheck({ type: 'official', name: '', size: '', stock: 'maybe', price: '-3', currency: 'KRW', url: 'ftp://x' });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['name', 'price', 'size', 'stock', 'url']);
});

const app = (checks) => ({ id: 'a', size: 'L', sourcing: checks });

test('확인 기록이 없으면 「재고 미확인」 · 확인 필요', () => {
  const s = stockSummary(app([]), { rates, now: NOW, staleHours: 24 });
  assert.equal(s.label, '재고 미확인');
  assert.equal(s.needsCheck, true);
  assert.equal(s.cheapest, null);
});

test('신청 사이즈 · 살 수 있는 곳 · 최근 확인만으로 최저가 — 다른 사이즈·품절·오래된 건 빠진다', () => {
  const s = stockSummary(app([
    { id: '1', name: '강남점', size: 'L', stock: 'in', price: 299000, currency: 'KRW', at: iso(H) },
    { id: '2', name: '공식몰', size: 'L', stock: 'out', price: 280000, currency: 'KRW', at: iso(H) },
    { id: '3', name: 'JP', size: 'L', stock: 'low', price: 30000, currency: 'JPY', at: iso(2 * H) },
    { id: '4', name: '성수점', size: 'XL', stock: 'in', price: 250000, currency: 'KRW', at: iso(H) },
    { id: '5', name: '홍대점', size: 'L', stock: 'in', price: 200000, currency: 'KRW', at: iso(48 * H) },
  ]), { rates, now: NOW, staleHours: 24 });
  assert.equal(s.buyable, 2);
  assert.equal(s.cheapest.id, '3');
  assert.equal(s.cheapest.krw, 279000);
  assert.equal(s.cheapestStale, false);
  assert.equal(s.stale, 1);
  assert.equal(s.otherSize, 1);
  assert.equal(s.needsCheck, false);
  assert.equal(s.label, '재고 있음 2곳 · 최저 279,000원');
});

test('살 수 있는 곳이 오래된 확인뿐이면 그 최저가를 「오래됨」으로 · 다시 확인 필요', () => {
  const s = stockSummary(app([
    { id: '5', name: '홍대점', size: 'L', stock: 'in', price: 200000, currency: 'KRW', at: iso(48 * H) },
  ]), { rates, now: NOW, staleHours: 24 });
  assert.equal(s.cheapest.id, '5');
  assert.equal(s.cheapestStale, true);
  assert.equal(s.needsCheck, true);
  assert.equal(s.label, '오래된 확인만 · 최저 200,000원(다시 확인)');
});

test('최근 확인이 전부 품절 · 확인 불가면 「재고 없음」, 확인은 된 것', () => {
  const s = stockSummary(app([
    { id: '2', name: '공식몰', size: 'L', stock: 'out', at: iso(H) },
    { id: '6', name: '매장', size: 'L', stock: 'unknown', at: iso(H) },
  ]), { rates, now: NOW, staleHours: 24 });
  assert.equal(s.label, '재고 없음(2곳 확인)');
  assert.equal(s.needsCheck, false);
});

test('살 수 있지만 가격을 안 적었으면 최저가 없이 곳 수만', () => {
  const s = stockSummary(app([{ id: '1', name: '강남점', size: 'L', stock: 'in', price: null, currency: 'KRW', at: iso(H) }]), { rates, now: NOW, staleHours: 24 });
  assert.equal(s.label, '재고 있음 1곳 · 가격 미기록');
});

test('가격은 적었는데 그 통화 환율이 비어 원화로 못 바꾸면 「환율 필요」(가격 미기록 아님)', () => {
  const s = stockSummary(app([{ id: '1', name: 'EU', size: 'L', stock: 'in', price: 100, currency: 'EUR', at: iso(H) }]), { rates, now: NOW, staleHours: 24 });
  assert.equal(s.label, '재고 있음 1곳 · 환율 필요');
  assert.equal(s.cheapest, null);
  const mixed = stockSummary(app([
    { id: '1', name: 'EU', size: 'L', stock: 'in', price: 100, currency: 'EUR', at: iso(H) },
    { id: '2', name: '강남점', size: 'L', stock: 'in', price: null, currency: 'KRW', at: iso(H) },
  ]), { rates, now: NOW, staleHours: 24 });
  assert.equal(mixed.label, '재고 있음 2곳 · 환율 필요');
});

test('목록 필터 — 확인 필요 / 재고 있음 / 재고 없음', () => {
  const opts = { rates, now: NOW, staleHours: 24 };
  const none = app([]);
  const yes = app([{ id: '1', size: 'L', stock: 'in', price: 1, currency: 'KRW', at: iso(H) }]);
  const no = app([{ id: '1', size: 'L', stock: 'out', at: iso(H) }]);
  assert.deepEqual([none, yes, no].map((r) => matchesStockFilter(r, 'needs', opts)), [true, false, false]);
  assert.deepEqual([none, yes, no].map((r) => matchesStockFilter(r, 'available', opts)), [false, true, false]);
  assert.deepEqual([none, yes, no].map((r) => matchesStockFilter(r, 'none', opts)), [false, false, true]);
  assert.deepEqual([none, yes, no].map((r) => matchesStockFilter(r, '', opts)), [true, true, true]);
});
