// 관리자 연락 문구(3단계 B2) — 「재고 있음」 기록을 보고 고객에게 보낼 글 초안을 만든다. 순수 함수(브라우저 · node:test 공용).
// 넣는 것: 상품명 · 사이즈 · 판매처 종류(매장 · 공식몰 · 해외몰) · 접수번호. 해요체.
// 넣지 않는 것: 판매처 이름 · 기록한 가격(매입가에 가깝다) · 메모 · 다른 고객 정보. 가격은 운영자가 직접 적게 빈칸으로 둔다.

const BUYABLE = new Set(['in', 'low']);
const PLACE = { offline: '매장', official: '공식몰', overseas: '해외몰', other: '판매처' };
export const PRICE_BLANK = '[가격을 적어 주세요]';

// 받침 — 한글 · 숫자로 끝날 때만 안다(true/false), 영문 등은 null
function hasBatchim(word) {
  const ch = String(word || '').trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return '013678'.includes(ch);
  return null;
}

// 받침이 있으면 「을」, 없으면 「를」 — 한글이나 숫자로 끝날 때만 고르고, 모르면 null(문장을 「~, 매장에서 찾았어요」로 바꾼다 · 13차 QA U-1)
function eulReul(word) {
  const ch = String(word || '').trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 ? '을' : '를';
  if (/[0-9]/.test(ch)) return '013678'.includes(ch) ? '을' : '를';
  return null;
}

/** 가장 최근 「재고 있음 · 소량」 기록. 없으면 null */
export function latestBuyable(record) {
  const list = Array.isArray(record && record.sourcing) ? record.sourcing : [];
  return list.filter((c) => BUYABLE.has(c.stock)).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0] || null;
}

/** 06 문구 종류 기본값(4단계 B-2) — 재고 있음 · 소량이 있으면 「찾았어요」, 기록이 있는데 모두 품절 · 확인 불가면 「못 찾았어요」 */
export function defaultContactKind(record) {
  if (latestBuyable(record)) return 'found';
  const list = Array.isArray(record && record.sourcing) ? record.sourcing : [];
  return list.length ? 'not_found' : 'found';
}

/** 「못 찾았어요」 초안(4단계 B-2) — 새 약속(재입고 알림 등)은 넣지 않는다. 받침 · 상품명 없을 때 규칙은 「찾았어요」와 같다 */
export function notFoundDraft(record, { title = '', statusUrl = '' } = {}) {
  const name = String(title || '').trim() || '상품';
  const size = String((record && record.size) || '').trim();
  const thing = size ? `${name}(사이즈 ${size})` : name;
  const b = hasBatchim(name);
  const rest = '공식몰 · 매장 · 해외를 확인했지만 이번엔 찾지 못했어요.';
  return [
    '안녕하세요, TWOFLIP이에요.',
    b === null ? `신청하신 ${thing}, ${rest}` : `신청하신 ${thing}${b ? '은' : '는'} ${rest}`,
    '다른 상품도 KREAM 링크만 보내 주시면 찾아볼게요.',
    ...(statusUrl ? [`진행 상황: ${statusUrl}`] : []),
    `접수번호 ${record.id}`,
  ].join('\n');
}

/** 연락 문구 초안 — 살 수 있는 기록이 없으면 null.
 *  확인 링크가 있으면 「아래 링크에서 「구매할게요」를…」 + 주소만 한 줄(문자 앱이 링크로 잡게 — 22차 QA U-1),
 *  없으면(토큰을 못 만듦) 예전처럼 「이 메시지에 답장 주세요」 */
export function contactDraft(record, { title = '', statusUrl = '' } = {}) {
  const hit = latestBuyable(record);
  if (!hit) return null;
  const name = String(title || '').trim() || '상품';
  const size = String(record.size || '').trim();
  const thing = size ? `${name}(사이즈 ${size})` : name; // 「자켓(L)」은 사이즈인지 모른다 — 「(사이즈 L)」
  const josa = eulReul(name); // 괄호 뒤 조사는 괄호 앞 낱말 받침을 따른다
  const place = PLACE[hit.type] || PLACE.other;
  return [
    '안녕하세요, TWOFLIP이에요.',
    josa ? `신청하신 ${thing}${josa} ${place}에서 찾았어요.` : `신청하신 ${thing}, ${place}에서 찾았어요.`,
    `가격: ${PRICE_BLANK}`,
    ...(statusUrl
      ? ['아래 링크에서 「구매할게요」를 눌러 주세요. 문자로 답하셔도 돼요.', statusUrl]
      : ['구매를 원하시면 이 메시지에 답장 주세요.']),
    `접수번호 ${record.id}`,
  ].join('\n');
}

/** 문자 앱을 번호 · 글을 채워 여는 주소(iOS · 안드로이드 공용 형식) */
export function smsHref(phone, body) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return `sms:${digits}?&body=${encodeURIComponent(body || '')}`;
}
