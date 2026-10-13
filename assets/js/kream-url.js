// KREAM 상품 URL 검증·정규화 — 순수 함수. 브라우저와 node:test 가 같은 파일을 쓴다.
//
// 형식: https://kream.co.kr/products/<숫자>  (예: products/1068133)
// 쿼리(?size=…)·해시·끝 슬래시·www 는 버리고 정규 주소 하나로 만든다 — 같은 상품이 주소 모양만 달라
// 두 건으로 접수되지 않게. 사이즈는 쿼리에서 추측하지 않고 신청자가 따로 적는다.

const HOSTS = new Set(['kream.co.kr', 'www.kream.co.kr']);

export const KREAM_URL_MESSAGES = {
  empty: 'KREAM 상품 주소를 붙여 넣어 주세요.',
  invalid: '주소 형식이 올바르지 않습니다.',
  not_kream: 'KREAM(kream.co.kr) 상품 주소만 받습니다.',
  not_product: 'KREAM 상품 페이지 주소(kream.co.kr/products/숫자)를 넣어 주세요.',
};

export function parseKreamUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, reason: 'empty' };

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (!HOSTS.has(url.hostname.toLowerCase())) return { ok: false, reason: 'not_kream' };

  const m = url.pathname.match(/^\/products\/(\d+)\/?$/);
  if (!m) return { ok: false, reason: 'not_product' };

  const productId = m[1];
  return { ok: true, productId, url: `https://kream.co.kr/products/${productId}` };
}
