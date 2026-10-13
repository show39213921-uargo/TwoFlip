// 신청서 검증 — 순수 함수. 브라우저(제출 전)와 개발용 목업 API(dev/server.js)가 같은 규칙을 쓴다.
// 실제 API 도 같은 규칙으로 **다시** 검증해야 한다 — 공개 페이지의 검증은 누구나 건너뛸 수 있다.
//
// 항목은 초안이다. 사업계획서가 오면 여기서 늘리거나 줄인다(docs/api-contract.md 와 같이).

import { parseKreamUrl, KREAM_URL_MESSAGES } from './kream-url.js';

export const LIMITS = { size: 20, name: 30, memo: 500 };

// 이동통신 번호만(010·011·016·017·018·019). 유선·인터넷전화는 연락 수단으로 받지 않는다.
const MOBILE_RE = /^01[016789]\d{7,8}$/;

const str = (v) => (v == null ? '' : String(v)).trim();

export function validateApplication(input = {}) {
  const errors = {};

  // 봇 함정 — 사람 눈엔 안 보이는 칸이 채워졌으면 봇으로 본다.
  if (str(input.website)) return { ok: false, spam: true, errors: {}, payload: null };

  const kream = parseKreamUrl(input.kreamUrl);
  if (!kream.ok) errors.kreamUrl = KREAM_URL_MESSAGES[kream.reason];

  const size = str(input.size);
  if (!size) errors.size = '사이즈를 적어 주세요. (예: 270, L, FREE)';
  else if (size.length > LIMITS.size) errors.size = `사이즈는 ${LIMITS.size}자 이내로 적어 주세요.`;

  const name = str(input.name);
  if (!name) errors.name = '이름을 적어 주세요.';
  else if (name.length > LIMITS.name) errors.name = `이름은 ${LIMITS.name}자 이내로 적어 주세요.`;

  const phone = str(input.phone).replace(/[\s-]/g, '');
  if (!MOBILE_RE.test(phone)) errors.phone = '연락 가능한 휴대폰 번호를 적어 주세요. (예: 010-1234-5678)';

  const memo = str(input.memo);
  if (memo.length > LIMITS.memo) errors.memo = `요청사항은 ${LIMITS.memo}자 이내로 적어 주세요.`;

  if (input.consent !== true) errors.consent = '개인정보 수집·이용에 동의해야 신청할 수 있습니다.';

  if (Object.keys(errors).length) return { ok: false, errors, payload: null };

  return {
    ok: true,
    errors,
    payload: {
      kreamUrl: kream.url,
      kreamProductId: kream.productId,
      size,
      name,
      phone,
      memo,
      consent: true,
    },
  };
}
