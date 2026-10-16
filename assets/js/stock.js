// 재고 확인 — 고객이 보낸 링크(상품·사이즈)를 기준으로 「어디에, 그 사이즈가, 언제 확인했을 때 있었나」. 순수 함수.
//
// 사업계획서 MVP-03 규칙을 따른다:
//   · 확인 시점을 남기고, 기준 시간이 지난 확인은 「오래됨」으로 구분한다.
//   · 지금은 전부 사람이 확인해 적는 수동 기록이다(method: 'manual'). 자동 조회처럼 보이지 않게 한다.
//   · 재고 확인은 구매가 아니다 — 확인만으로 「확보」가 되지 않는다(상태는 사람이 바꾼다).
// 최저가는 「신청 사이즈 · 살 수 있음(재고 있음·소량) · 최근 확인」만으로 낸다.
// 저장 위치는 신청 레코드의 sourcing 배열(예전 「소싱 후보」와 같은 칸 — 예전 기록은 재고 「확인 불가」로 읽는다).

import { CANDIDATE_TYPES, CURRENCIES, rankCandidates, toKrw } from './sourcing.js';
import { formatWon } from './preview-view.js';

export const STOCK_STATES = [
  { key: 'in', label: '재고 있음', buyable: true },
  { key: 'low', label: '소량', buyable: true },
  { key: 'out', label: '품절', buyable: false },
  { key: 'unknown', label: '확인 불가', buyable: false },
];
export const DEFAULT_STALE_HOURS = 24; // 화면 「설정」에서 바꾼다
export const STALE_HOURS_RANGE = [1, 168]; // 1시간 ~ 7일 — 백엔드 PUT /admin/settings 와 같은 범위

// 설정 「재고 확인 유효 시간」 입력 검사 — 범위 밖이면 저장하지 않는다(3명 공용 설정이라)
export function parseStaleHours(raw) {
  const s = String(raw ?? '').trim();
  const [min, max] = STALE_HOURS_RANGE;
  if (!/^\d+$/.test(s) || Number(s) < min || Number(s) > max) return { ok: false, error: `${min}~${max} 사이 시간(정수)으로 적어 주세요. 저장하지 않았습니다.` };
  return { ok: true, value: Number(s) };
}
export const METHOD_LABELS = { manual: '수동', auto: '자동' };

const STATE_KEYS = new Set(STOCK_STATES.map((s) => s.key));
const BUYABLE = new Set(STOCK_STATES.filter((s) => s.buyable).map((s) => s.key));
export const stockLabel = (key) => (STOCK_STATES.find((s) => s.key === key) || { label: '확인 불가' }).label;
const normSize = (s) => String(s ?? '').trim().toUpperCase();

export function isStale(at, nowMs, staleHours) {
  const t = Date.parse(at);
  return !Number.isFinite(t) || nowMs - t > staleHours * 3600000;
}

export function normalizeCheck(c, fallbackSize) {
  return {
    ...c,
    size: normSize(c.size) || normSize(fallbackSize),
    stock: STATE_KEYS.has(c.stock) ? c.stock : 'unknown',
    price: c.price == null || c.price === '' ? null : Number(c.price),
    method: c.method === 'auto' ? 'auto' : 'manual',
  };
}

export function validateCheck(input = {}) {
  const errors = {};
  const type = String(input.type || '');
  if (!CANDIDATE_TYPES.some((t) => t.key === type)) errors.type = '종류를 골라 주세요.';
  const name = String(input.name ?? '').trim();
  if (!name) errors.name = '판매처(매장·사이트) 이름을 적어 주세요.';
  else if (name.length > 60) errors.name = '판매처 이름은 60자 이내로 적어 주세요.';
  const size = normSize(input.size);
  if (!size) errors.size = '확인한 사이즈를 적어 주세요.';
  else if (size.length > 20) errors.size = '사이즈는 20자 이내로 적어 주세요.';
  const stock = String(input.stock || '');
  if (!STATE_KEYS.has(stock)) errors.stock = '재고 상태를 골라 주세요.';
  const rawPrice = String(input.price ?? '').replace(/,/g, '').trim();
  const price = rawPrice ? Number(rawPrice) : null;
  if (rawPrice && (!Number.isFinite(price) || price <= 0)) errors.price = '가격은 0보다 큰 숫자로 적어 주세요(모르면 비워 두기).';
  const currency = String(input.currency || 'KRW').toUpperCase();
  if (!CURRENCIES.includes(currency)) errors.currency = '통화를 골라 주세요.';
  const url = String(input.url ?? '').trim();
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) errors.url = '주소는 http(s) 만 넣을 수 있습니다.';
  const note = String(input.note ?? '').trim().slice(0, 200);

  if (Object.keys(errors).length) return { ok: false, errors, value: null };
  return { ok: true, errors, value: { type, name, size, stock, price, currency, url, note, method: 'manual' } };
}

export function stockSummary(record, { rates = {}, now = Date.now(), staleHours = DEFAULT_STALE_HOURS } = {}) {
  const want = normSize(record && record.size);
  const checks = (Array.isArray(record && record.sourcing) ? record.sourcing : []).map((c) => {
    const n = normalizeCheck(c, want);
    return { ...n, stale: isStale(n.at, now, staleHours), sameSize: !want || n.size === want };
  });
  const mine = checks.filter((c) => c.sameSize);
  const fresh = mine.filter((c) => !c.stale);
  const freshBuyable = fresh.filter((c) => BUYABLE.has(c.stock));
  const staleBuyable = mine.filter((c) => c.stale && BUYABLE.has(c.stock));

  const pick = (list) => {
    const r = rankCandidates(list.filter((c) => c.price != null), rates);
    return r.cheapestId ? r.list.find((c) => c.id === r.cheapestId) : null;
  };
  let cheapest = pick(freshBuyable);
  let cheapestStale = false;
  if (!cheapest && !freshBuyable.length) {
    cheapest = pick(staleBuyable);
    cheapestStale = !!cheapest;
  }

  // 최저가를 못 냈을 때 이유 — 가격을 적었는데 원화로 못 바꿨으면(그 통화 환율이 비어 있음) 「환율 필요」, 가격 칸이 비었으면 「가격 미기록」
  const noPriceReason = (list) => (list.some((c) => c.price != null) ? '환율 필요' : '가격 미기록');
  // 최저가는 냈지만 환율이 없어 비교에서 빠진 곳 — 말없이 빼지 않고 배지에 남긴다(2차 QA B-4)
  const unconverted = freshBuyable.filter((c) => c.price != null && toKrw(c.price, c.currency, rates) == null).length;
  let label;
  if (!mine.length) label = '재고 미확인';
  else if (freshBuyable.length) {
    label = `재고 있음 ${freshBuyable.length}곳 · ` + (cheapest ? `최저 ${formatWon(cheapest.krw)}` + (unconverted ? ` · 환율 필요 ${unconverted}곳` : '') : noPriceReason(freshBuyable));
  }
  else if (staleBuyable.length) label = '오래된 확인만' + (cheapest ? ` · 최저 ${formatWon(cheapest.krw)}(다시 확인)` : ' · 다시 확인');
  else if (fresh.length) label = `재고 없음(${fresh.length}곳 확인)`;
  else label = '오래된 확인만 · 다시 확인';

  return {
    checks,
    total: mine.length,
    buyable: freshBuyable.length,
    stale: mine.filter((c) => c.stale).length,
    otherSize: checks.length - mine.length,
    cheapest: cheapest ? { id: cheapest.id, name: cheapest.name, krw: cheapest.krw } : null,
    cheapestStale,
    // 확인할 일이 남았나 — 기록이 없거나, 최근 확인이 하나도 없을 때
    needsCheck: !fresh.length,
    label,
  };
}

// 목록 거르기 알약(3단계 B3) — 순서 그대로 보인다. 값은 matchesStockFilter 의 키
export const STOCK_PILLS = [
  { key: 'unchecked', label: '기록 없음' },
  { key: 'stale', label: '오래됨' },
  { key: 'available', label: '재고 있음' },
  { key: 'none', label: '재고 없음' },
  { key: 'waiting', label: '답장 대기' }, // 4단계 B-3 — 「찾았어요」 연락 뒤 고객 답이 없음
  { key: '', label: '전체' },
];

export function matchesStockFilter(record, filter, opts) {
  if (!filter) return true;
  const s = stockSummary(record, opts);
  if (filter === 'unchecked') return s.total === 0; // 신청 사이즈로 한 번도 기록하지 않음
  if (filter === 'stale') return s.total > 0 && s.needsCheck; // 기록은 있는데 전부 유효 시간이 지남
  if (filter === 'needs') return s.needsCheck;
  if (filter === 'available') return s.buyable > 0;
  if (filter === 'none') return !s.needsCheck && s.buyable === 0;
  if (filter === 'waiting') return Boolean(['received', 'sourcing', 'secured', 'contacted'].includes(record.status) && record.contact && record.contact.kind === 'found' && !record.reply); // admin-view isWaitingReply 와 같다
  return true;
}
