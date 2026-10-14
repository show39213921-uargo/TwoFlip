import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toKrw, rankCandidates, compareToKream, validateCandidate, parseRates, checkRate } from '../assets/js/sourcing.js';

const rates = { USD: 1400, JPY: 9.3 };

test('원화 환산 — KRW 그대로, 외화는 환율, 환율 없으면 null', () => {
  assert.equal(toKrw(100000, 'KRW', rates), 100000);
  assert.equal(toKrw(199.99, 'USD', rates), 279986);
  assert.equal(toKrw(22000, 'JPY', rates), 204600);
  assert.equal(toKrw(100, 'EUR', rates), null);
  assert.equal(toKrw(-1, 'KRW', rates), null);
});

test('후보 정렬 — 원화 싼 순, 환산 불가는 맨 뒤, 최저가 표시', () => {
  const r = rankCandidates([
    { id: 'a', price: 320000, currency: 'KRW' },
    { id: 'b', price: 199, currency: 'USD' },
    { id: 'c', price: 100, currency: 'EUR' },
    { id: 'd', price: 30000, currency: 'JPY' },
  ], rates);
  assert.deepEqual(r.list.map((x) => [x.id, x.krw]), [['b', 278600], ['d', 279000], ['a', 320000], ['c', null]]);
  assert.equal(r.cheapestId, 'b');
  assert.equal(r.unconverted, 1);
});

test('후보가 없으면 cheapestId null', () => {
  assert.deepEqual(rankCandidates([], rates), { list: [], cheapestId: null, unconverted: 0 });
});

test('KREAM 대비', () => {
  assert.deepEqual(compareToKream(300000, 317000), { diff: -17000, label: 'KREAM 대비 −17,000원', cheaper: true });
  assert.deepEqual(compareToKream(320000, 317000), { diff: 3000, label: 'KREAM 대비 +3,000원', cheaper: false });
  assert.equal(compareToKream(300000, null), null);
});

test('후보 입력 검증', () => {
  const ok = validateCandidate({ type: 'overseas', name: ' Nike US ', price: '199.99', currency: 'usd', url: 'https://www.nike.com/t/x', note: '' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { type: 'overseas', name: 'Nike US', price: 199.99, currency: 'USD', url: 'https://www.nike.com/t/x', note: '' });

  const bad = validateCandidate({ type: 'x', name: '', price: '0', currency: 'ABC', url: 'javascript:alert(1)' });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['currency', 'name', 'price', 'type', 'url']);
});

test('환율 입력 정리 — 양수만, 소수 허용', () => {
  assert.deepEqual(parseRates({ USD: '1,400', JPY: '9.3', EUR: '', GBP: '-1', XXX: '1' }), { USD: 1400, JPY: 9.3 });
});

test('설정 환율 한 칸 — 비우면 없음, 0 이하·숫자 아님은 거절(B-3)', () => {
  assert.deepEqual(checkRate(''), { ok: true, value: null });
  assert.deepEqual(checkRate('1,400'), { ok: true, value: 1400 });
  assert.deepEqual(checkRate('9.3'), { ok: true, value: 9.3 });
  for (const bad of ['0', '-5', 'abc', '1,4a']) assert.equal(checkRate(bad).ok, false, bad);
});
