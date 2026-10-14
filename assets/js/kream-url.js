// KREAM 상품 URL 검증·정규화 — 순수 함수. 브라우저와 node:test 가 같은 파일을 쓴다.
//
// 형식: https://kream.co.kr/products/<숫자>  (예: products/1068133)
// 쿼리(?size=…)·해시·끝 슬래시·www 는 버리고 정규 주소 하나로 만든다 — 같은 상품이 주소 모양만 달라
// 두 건으로 접수되지 않게. 사이즈는 신청자가 따로 적는다(화면은 ?size= 를 빈 사이즈 칸의 기본값으로만 쓴다 — extractKreamUrl).

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

// 붙여 넣은 글(「[KREAM] 상품명 https://kream.co.kr/products/1068133?size=270」 등)에서 KREAM 상품 주소 하나를 찾는다.
// 화면 편의용 — 검증은 그대로 parseKreamUrl 이 한다(찾은 주소도 parseKreamUrl 을 통과해야 한다).
//   · 주소 앞은 글의 처음 · 공백 · 괄호/따옴표만 — 「evil.com/kream.co.kr/products/1」 · 「kream.co.kr.evil.com/…」 은 못 찾는다
//   · 서로 다른 상품이 둘 이상이면 고르지 않는다(null)
//   · size: 주소의 ?size= 값(없으면 null) — 사이즈 칸이 비었을 때만 화면이 채운다
const FIND = /(?:^|[\s"'(<[「])((?:https?:\/\/)?(?:www\.)?kream\.co\.kr\/products\/\d+(?!\w)\/?(?:[?#][^\s"'<>)\]」]*)?)/gi;

export function extractKreamUrl(input) {
  const found = new Map();
  for (const m of String(input ?? '').matchAll(FIND)) {
    const p = parseKreamUrl(m[1]);
    if (p.ok && !found.has(p.productId)) found.set(p.productId, { ...p, raw: m[1] });
  }
  if (found.size !== 1) return null;
  const hit = [...found.values()][0];
  let size = null;
  try {
    const s = new URL(/^https?:\/\//i.test(hit.raw) ? hit.raw : 'https://' + hit.raw).searchParams.get('size');
    if (s && s.trim()) size = s.trim().toUpperCase().slice(0, 20);
  } catch { /* 사이즈 없음 */ }
  return { productId: hit.productId, url: hit.url, size };
}
