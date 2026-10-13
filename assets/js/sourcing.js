// 소싱 후보(발품으로 찾은 판매처·가격) — 원화 환산 · 최저가 · KREAM 대비. 순수 함수.
//
// 환율은 관리자가 직접 넣는다(JPY 는 1엔당 원 — AI Office Sourcing 과 같은 규칙).
// 해외 원가는 물품가 × 환율까지만이다. 카드 수수료·관세·부가세·배송비는 들어 있지 않다(화면에 「별도」 표시).

export const CANDIDATE_TYPES = [
  { key: 'official', label: '공식몰(국내)' },
  { key: 'offline', label: '오프라인 매장' },
  { key: 'overseas', label: '해외' },
  { key: 'other', label: '기타' },
];
export const CURRENCIES = ['KRW', 'USD', 'JPY', 'EUR', 'GBP', 'CNY', 'HKD'];
const FOREIGN = CURRENCIES.filter((c) => c !== 'KRW');

const won = (n) => (n < 0 ? '−' : '+') + Math.abs(n).toLocaleString('ko-KR') + '원';

export function toKrw(price, currency, rates = {}) {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return null;
  if (currency === 'KRW') return Math.round(p);
  const r = Number(rates[currency]);
  return Number.isFinite(r) && r > 0 ? Math.round(p * r) : null;
}

export function rankCandidates(candidates, rates) {
  const list = (Array.isArray(candidates) ? candidates : [])
    .map((c) => ({ ...c, krw: toKrw(c.price, c.currency, rates) }))
    .sort((a, b) => (a.krw ?? Infinity) - (b.krw ?? Infinity));
  const first = list.find((c) => c.krw != null);
  return { list, cheapestId: first ? first.id : null, unconverted: list.filter((c) => c.krw == null).length };
}

export function compareToKream(krw, kreamPrice) {
  if (krw == null || kreamPrice == null) return null;
  const diff = krw - kreamPrice;
  return { diff, label: 'KREAM 대비 ' + won(diff).replace('+0원', '±0원'), cheaper: diff < 0 };
}

export function validateCandidate(input = {}) {
  const errors = {};
  const type = String(input.type || '');
  if (!CANDIDATE_TYPES.some((t) => t.key === type)) errors.type = '종류를 골라 주세요.';
  const name = String(input.name ?? '').trim();
  if (!name) errors.name = '판매처 이름을 적어 주세요.';
  else if (name.length > 60) errors.name = '60자 이내로 적어 주세요.';
  const price = Number(String(input.price ?? '').replace(/,/g, ''));
  if (!Number.isFinite(price) || price <= 0) errors.price = '가격을 숫자로 적어 주세요.';
  const currency = String(input.currency || '').toUpperCase();
  if (!CURRENCIES.includes(currency)) errors.currency = '통화를 골라 주세요.';
  const url = String(input.url ?? '').trim();
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) errors.url = 'http(s) 주소만 넣을 수 있습니다.';
  const note = String(input.note ?? '').trim().slice(0, 200);

  if (Object.keys(errors).length) return { ok: false, errors, value: null };
  return { ok: true, errors, value: { type, name, price, currency, url, note } };
}

export function parseRates(input = {}) {
  const out = {};
  for (const c of FOREIGN) {
    const n = Number(String(input[c] ?? '').replace(/,/g, '').trim());
    if (String(input[c] ?? '').trim() && Number.isFinite(n) && n > 0) out[c] = n;
  }
  return out;
}
