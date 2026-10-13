// 관리자 화면 값 — 상태 · 번호 표시 · 시각 · 집계 · 필터 · CSV · JSON 가져오기. 순수 함수.

import { sizeChip } from './preview-view.js';

export const STATUSES = [
  { key: 'received', label: '접수' },
  { key: 'sourcing', label: '탐색 중' },
  { key: 'secured', label: '확보' },
  { key: 'contacted', label: '연락 완료' },
  { key: 'paid', label: '결제 완료' },
  { key: 'completed', label: '완료' },
  { key: 'canceled', label: '취소' },
];

export const statusLabel = (key) => (STATUSES.find((s) => s.key === key) || { label: key }).label;

function splitPhone(p) {
  const d = String(p || '');
  if (/^01\d{9}$/.test(d)) return [d.slice(0, 3), d.slice(3, 7), d.slice(7)];
  if (/^01\d{8}$/.test(d)) return [d.slice(0, 3), d.slice(3, 6), d.slice(6)];
  return null;
}
export function formatPhone(p) {
  const s = splitPhone(p);
  return s ? s.join('-') : String(p || '');
}
export function maskPhone(p) {
  const s = splitPhone(p);
  return s ? [s[0], '*'.repeat(s[1].length), s[2]].join('-') : String(p || '');
}

export function formatKst(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const d = new Date(t + 9 * 3600000);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function summarize(records) {
  const out = { total: records.length, other: 0 };
  for (const s of STATUSES) out[s.key] = 0;
  for (const r of records) {
    if (r && Object.hasOwn(out, r.status) && r.status !== 'total' && r.status !== 'other') out[r.status] += 1;
    else out.other += 1;
  }
  return out;
}

export function filterRecords(records, { status = '', q = '' } = {}) {
  const needle = String(q).trim().toLowerCase();
  return records.filter((r) => {
    if (status && r.status !== status) return false;
    if (!needle) return true;
    const hay = [r.id, r.name, r.phone, r.memo, r.size, r.kream && r.kream.modelNo, r.kream && r.kream.name, r.kream && r.kream.nameKo]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(needle);
  });
}

export function sortNewest(records) {
  const t = (r) => { const v = Date.parse(r.receivedAt); return Number.isFinite(v) ? v : -Infinity; };
  return records.slice().sort((a, b) => t(b) - t(a));
}

// 신청한 사이즈의 「신청 당시」 KREAM 시세
export function sizeQuoteFor(record) {
  const sizes = record && record.kream && Array.isArray(record.kream.sizes) ? record.kream.sizes : [];
  const want = String(record && record.size || '').trim().toUpperCase();
  const hit = sizes.find((s) => String(s.size).toUpperCase() === want);
  if (!hit) return null;
  const chip = sizeChip(hit);
  return chip.price ? chip : null;
}

// 그 사이즈 KREAM 가격(숫자) — 최저가 비교용. 최근 거래 → 판매 입찰 → 구매 입찰 → 즉시 구매가
export function kreamPriceFor(record) {
  const sizes = record && record.kream && Array.isArray(record.kream.sizes) ? record.kream.sizes : [];
  const want = String(record && record.size || '').trim().toUpperCase();
  const s = sizes.find((x) => String(x.size).toUpperCase() === want);
  const v = s ? (s.recentPrice ?? s.lowestAsk ?? s.highestBid) : null;
  return v ?? (record && record.kream ? record.kream.buyNowPrice ?? null : null);
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function toCsv(records) {
  const head = ['접수번호', '접수시각(KST)', '상태', '이름', '휴대폰', '사이즈', '모델번호', '상품명', '신청 당시 KREAM 시세', 'KREAM 주소', '요청사항'];
  const lines = records.map((r) => {
    const q = sizeQuoteFor(r);
    return [
      r.id, formatKst(r.receivedAt), statusLabel(r.status), r.name, formatPhone(r.phone), r.size,
      r.kream && r.kream.modelNo, r.kream && (r.kream.nameKo || r.kream.name), q ? `${q.price}(${q.basis})` : '', r.kreamUrl, r.memo,
    ].map(csvCell).join(',');
  });
  return '﻿' + [head.join(','), ...lines].join('\r\n');
}

export function normalizeImported(data) {
  const arr = Array.isArray(data) ? data : (data && Array.isArray(data.applications) ? data.applications : null);
  if (!arr) throw new Error('JSON 형식이 다릅니다 — 신청 배열(또는 { applications: [...] })이어야 합니다.');
  const records = arr.filter((r) => r && typeof r === 'object' && r.id);
  return { records, skipped: arr.length - records.length };
}
