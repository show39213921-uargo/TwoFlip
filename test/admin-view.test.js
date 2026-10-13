import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUSES, statusLabel, maskPhone, formatPhone, formatKst, summarize, filterRecords, sortNewest, sizeQuoteFor, toCsv, normalizeImported,
} from '../assets/js/admin-view.js';

const snap = {
  name: 'Salomon Jacket', nameKo: '살로몬 자켓', brand: 'Salomon', modelNo: 'LD0274200', image: 'https://x/a.png', buyNowPrice: 317000,
  sizes: [
    { size: 'L', recentPrice: null, recentAgo: null, lowestAsk: 319000, highestBid: null },
    { size: 'XL', recentPrice: 317000, recentAgo: '1시간 전', lowestAsk: null, highestBid: null },
  ],
};
const rows = [
  { id: 'a', status: 'received', receivedAt: '2026-10-13T07:00:00Z', size: 'l', name: '김가', phone: '01012345678', memo: '', kream: snap, kreamUrl: 'https://kream.co.kr/products/1' },
  { id: 'b', status: 'secured', receivedAt: '2026-10-13T08:00:00Z', size: '270', name: '이나', phone: '0111234567', memo: '저녁 연락, "급함"', kream: null, kreamUrl: 'https://kream.co.kr/products/2' },
  { id: 'c', status: 'weird', receivedAt: 'bad', size: 'XL', name: '박다', phone: '01099998888', memo: '', kream: snap, kreamUrl: 'https://kream.co.kr/products/1' },
];

test('상태 7단계와 라벨, 모르는 상태는 그대로 보인다', () => {
  assert.deepEqual(STATUSES.map((s) => s.key), ['received', 'sourcing', 'secured', 'contacted', 'paid', 'completed', 'canceled']);
  assert.equal(statusLabel('secured'), '확보');
  assert.equal(statusLabel('weird'), 'weird');
});

test('번호 마스킹·표시', () => {
  assert.equal(maskPhone('01012345678'), '010-****-5678');
  assert.equal(maskPhone('0111234567'), '011-***-4567');
  assert.equal(formatPhone('01012345678'), '010-1234-5678');
  assert.equal(formatPhone('0111234567'), '011-123-4567');
  assert.equal(maskPhone('abc'), 'abc');
});

test('KST 시각', () => {
  assert.equal(formatKst('2026-10-13T07:44:53Z'), '10.13 16:44');
  assert.equal(formatKst('2026-10-13T15:30:00Z'), '10.14 00:30');
  assert.equal(formatKst('bad'), '—');
});

test('상태별 건수(모르는 상태는 기타)', () => {
  assert.deepEqual(summarize(rows), { total: 3, received: 1, sourcing: 0, secured: 1, contacted: 0, paid: 0, completed: 0, canceled: 0, other: 1 });
});

test('필터 — 상태 · 검색(이름·번호·모델번호·접수번호·메모)', () => {
  assert.deepEqual(filterRecords(rows, { status: 'secured' }).map((r) => r.id), ['b']);
  assert.deepEqual(filterRecords(rows, { q: 'ld0274' }).map((r) => r.id), ['a', 'c']);
  assert.deepEqual(filterRecords(rows, { q: '9999' }).map((r) => r.id), ['c']);
  assert.deepEqual(filterRecords(rows, { q: '저녁' }).map((r) => r.id), ['b']);
  assert.equal(filterRecords(rows, {}).length, 3);
});

test('최신순 — 시각이 깨진 행은 맨 뒤', () => {
  assert.deepEqual(sortNewest(rows).map((r) => r.id), ['b', 'a', 'c']);
});

test('신청 사이즈의 신청 당시 시세(대소문자 무시) — 없으면 null', () => {
  assert.deepEqual(sizeQuoteFor(rows[0]), { size: 'L', price: '319,000원', basis: '판매 입찰' });
  assert.deepEqual(sizeQuoteFor(rows[2]), { size: 'XL', price: '317,000원', basis: '최근 거래' });
  assert.equal(sizeQuoteFor(rows[1]), null);
});

test('CSV — BOM · 따옴표 이스케이프 · 번호는 전체(내보내기는 운영자용)', () => {
  const csv = toCsv([rows[1]]);
  assert.ok(csv.startsWith('﻿접수번호,접수시각(KST),상태'));
  assert.match(csv, /"저녁 연락, ""급함"""/);
  assert.match(csv, /011-123-4567/);
});

test('JSON 가져오기 — 배열 또는 { applications }, id 없는 행은 건너뛴다', () => {
  assert.deepEqual(normalizeImported([{ id: 'a' }, { x: 1 }]), { records: [{ id: 'a' }], skipped: 1 });
  assert.deepEqual(normalizeImported({ applications: [{ id: 'b' }] }), { records: [{ id: 'b' }], skipped: 0 });
  assert.throws(() => normalizeImported({ nope: 1 }), /형식/);
});
