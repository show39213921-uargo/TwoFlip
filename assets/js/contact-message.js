// 관리자 연락 문구(3단계 B2) — 「재고 있음」 기록을 보고 고객에게 보낼 글 초안을 만든다. 순수 함수(브라우저 · node:test 공용).
// 넣는 것: 상품명 · 사이즈 · 판매처 종류(매장 · 공식몰 · 해외몰) · 접수번호. 해요체.
// 넣지 않는 것: 판매처 이름 · 기록한 가격(매입가에 가깝다) · 메모 · 다른 고객 정보. 가격은 운영자가 직접 적게 빈칸으로 둔다.

const BUYABLE = new Set(['in', 'low']);
const PLACE = { offline: '매장', official: '공식몰', overseas: '해외몰', other: '판매처' };
export const PRICE_BLANK = '[가격을 적어 주세요]';

// 받침이 있으면 「을」, 없으면 「를」 — 한글이나 숫자로 끝날 때만 고르고, 나머지는 「을(를)」
function eulReul(word) {
  const ch = String(word || '').trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 ? '을' : '를';
  if (/[0-9]/.test(ch)) return '013678'.includes(ch) ? '을' : '를';
  return '을(를)';
}

/** 가장 최근 「재고 있음 · 소량」 기록. 없으면 null */
export function latestBuyable(record) {
  const list = Array.isArray(record && record.sourcing) ? record.sourcing : [];
  return list.filter((c) => BUYABLE.has(c.stock)).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0] || null;
}

/** 연락 문구 초안 — 살 수 있는 기록이 없으면 null */
export function contactDraft(record, { title = '' } = {}) {
  const hit = latestBuyable(record);
  if (!hit) return null;
  const name = String(title || '').trim() || '상품';
  const size = String(record.size || '').trim();
  const thing = size ? `${name}(${size})` : name;
  return [
    '안녕하세요, TWOFLIP이에요.',
    `신청하신 ${thing}${eulReul(name)} ${PLACE[hit.type] || PLACE.other}에서 찾았어요.`,
    `가격: ${PRICE_BLANK}`,
    '구매를 원하시면 이 메시지에 답장 주세요.',
    `접수번호 ${record.id}`,
  ].join('\n');
}

/** 문자 앱을 번호 · 글을 채워 여는 주소(iOS · 안드로이드 공용 형식) */
export function smsHref(phone, body) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return `sms:${digits}?&body=${encodeURIComponent(body || '')}`;
}
