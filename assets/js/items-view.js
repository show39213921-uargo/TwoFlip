// 바로 구매(확보 상품) — 화면 값 · 입력 검증. 순수 함수(브라우저와 node:test 가 같은 파일을 쓴다).
//
// 운영자가 요청받은 상품을 구하러 갔다가 먼저 사 둔 상품을 공개하고, 고객이 구매 요청을 남긴다(10-14 재영 결정).
//   · 가격: 판매가를 정했으면 그 값, 아니면 「가격 문의」 — 「KREAM 보다 싸다」 같은 비교·보장 문구는 쓰지 않는다
//   · 요청: 다 받고 운영자가 하나를 골라 「예약 중」. 예약 중이면 고객 화면 요청 버튼을 막는다
//   · 매입가 · 내부 메모는 관리자 화면에만(공개 API 는 아예 보내지 않는다)
// 규칙은 백엔드(twoflip_backend Admin\Api::validateItem)와 같다 — 바꿀 때 같이.

import { parseKreamUrl, KREAM_URL_MESSAGES } from './kream-url.js';
import { validateApplication } from './validate.js';
import { formatWon } from './preview-view.js';

export const ITEM_STATUSES = [
  { key: 'hidden', label: '비공개' },
  { key: 'on_sale', label: '판매 중' },
  { key: 'reserved', label: '예약 중' },
  { key: 'sold', label: '판매 완료' },
];
export const itemStatusLabel = (key) => (ITEM_STATUSES.find((s) => s.key === key) || { label: key || '—' }).label;

const httpsUrl = (u) => (typeof u === 'string' && /^https:\/\/\S+$/i.test(u) ? u : null);

/** 공개 카드 한 장 — 서버 GET /items 한 건 → 화면 값(전부 문자열, textContent 로만 넣는다) */
export function itemCardModel(item) {
  const i = item || {};
  const title = i.title || i.nameKo || i.name || '상품 정보 준비 중';
  const priceKnown = typeof i.salePrice === 'number';
  return {
    id: String(i.id || ''),
    title,
    sub: i.brand || null, // 브랜드만 — 영문 상품명을 되풀이하면 2열 카드에서 잘린다(3차 QA D-3)
    modelNo: i.modelNo || null,
    image: httpsUrl(i.image),
    size: i.size || '—',
    price: formatWon(i.salePrice) || '가격 문의',
    priceKnown,
    // 카드만 보고도 뜻을 알게(3차 QA U-4) — 보장·확정 표현 없이
    priceHint: priceKnown ? null : '가격은 연락드릴 때 안내해요',
    reserved: i.status === 'reserved',
    reservedNote: i.status === 'reserved' ? '다른 분께 먼저 안내 중이에요' : null,
    statusLabel: itemStatusLabel(i.status),
    note: i.note || '',
    noteChips: noteChips(i.note),
  };
}

// 공개 설명 「새상품 · 택 있음 · 매장 구매」 → 칩 3개(3차 QA D-3). 조각이 하나뿐이거나 길거나 많으면 칩으로 만들지 않고 글로 둔다(null)
export function noteChips(note) {
  const parts = String(note || '').split(/\s*[·,|/]\s*/).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 5 || parts.some((x) => x.length > 16)) return null;
  return parts;
}

/** 관리자 — 확보 상품 등록·수정 입력. create=false 면 넘긴 칸만 본다. 값은 서버로 보낼 모양 */
export function validateItem(input = {}, create = true) {
  const errors = {};
  const value = {};
  const has = (k) => create || Object.prototype.hasOwnProperty.call(input, k);
  const str = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');

  if (create) {
    const k = parseKreamUrl(input.kreamUrl);
    if (!k.ok) errors.kreamUrl = KREAM_URL_MESSAGES[k.reason];
    else value.kreamUrl = k.url;
  }
  if (has('size')) {
    const size = str(input.size).toUpperCase();
    if (!size) errors.size = '사이즈를 적어 주세요.';
    else if (size.length > 20) errors.size = '사이즈는 20자 이내로 적어 주세요.';
    else value.size = size;
  }
  for (const [f, label, max] of [['title', '상품명', 100], ['note', '공개 설명', 300], ['internalMemo', '내부 메모', 500]]) {
    if (!has(f)) continue;
    const s = str(input[f]);
    if (s.length > max) errors[f] = `${label}은 ${max}자 이내로 적어 주세요.`;
    else value[f] = f === 'title' && !s ? null : s;
  }
  for (const [f, label] of [['salePrice', '판매가'], ['costPrice', '매입가']]) {
    if (!has(f)) continue;
    const raw = str(input[f]).replace(/,/g, '');
    if (!raw) value[f] = null;
    else if (!/^\d{1,9}$/.test(raw) || Number(raw) < 1) errors[f] = `${label}는 1원 이상 숫자로 적어 주세요(정하지 않았으면 비워 두기).`;
    else value[f] = Number(raw);
  }
  if (has('imageUrl')) {
    const u = str(input.imageUrl);
    if (!u) value.imageUrl = null;
    else if (!httpsUrl(u) || u.length > 1000) errors.imageUrl = '사진 주소는 https:// 로 시작하는 주소만 넣을 수 있습니다.';
    else value.imageUrl = u;
  }
  if (create) {
    const st = input.status || 'hidden';
    if (st !== 'hidden' && st !== 'on_sale') errors.status = '처음 등록은 「비공개」나 「판매 중」만 고를 수 있습니다.';
    else value.status = st;
  }
  const ok = Object.keys(errors).length === 0;
  return { ok, errors, value: ok ? value : null };
}

// 구매 요청 폼 — 신청서 검증을 그대로 쓴다(상품·사이즈는 고객이 고르지 않으므로 그 두 칸은 빼고 본다)
const ANY_KREAM = 'https://kream.co.kr/products/1';
export function validateItemRequest(input = {}) {
  const v = validateApplication({ ...input, kreamUrl: ANY_KREAM, size: 'X' });
  if (v.spam) return { ok: false, spam: true, errors: {}, payload: null };
  const { kreamUrl, size, ...errors } = v.errors;
  if (errors.consent) errors.consent = '개인정보 수집·이용에 동의해야 구매 요청을 보낼 수 있어요.'; // 신청서 문구를 그대로 쓰지 않는다(3차 QA B-3)
  if (Object.keys(errors).length) return { ok: false, errors, payload: null };
  const { name, phone, memo, consent } = v.payload;
  return { ok: true, errors: {}, payload: { name, phone, memo, consent } };
}
