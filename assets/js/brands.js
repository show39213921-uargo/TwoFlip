// 브랜드 → 공식 홈페이지 · 오프라인 매장 찾기 · 해외 공식몰. 데이터가 아니라 코드다 — 새 브랜드는 한 줄씩.
//
// 주소는 2026-10-13 에 열어 보고 확인한 것만 넣는다(200, 또는 봇 차단 403 = 사이트는 있음).
// 상품 페이지 주소 규칙은 브랜드마다 달라 추측하지 않는다 — 대신 「모델번호 + site:공식몰」 검색 링크를 준다.
// 오프라인은 「지역 + 브랜드 매장」 지도 검색. 매장 찾기 페이지는 확인된 브랜드만(지금은 나이키).
// 모르는 브랜드는 지어내지 않고 일반 검색으로 보낸다.

export const BRANDS = [
  { key: 'nike', ko: '나이키', match: ['nike', 'jordan', '나이키', '조던'],
    home: 'https://www.nike.com/kr', site: 'nike.com/kr', storeFinder: 'https://www.nike.com/kr/retail',
    overseas: [{ country: 'US', site: 'nike.com' }, { country: 'JP', site: 'nike.com/jp' }] },
  { key: 'adidas', ko: '아디다스', match: ['adidas', '아디다스'],
    home: 'https://www.adidas.co.kr/', site: 'adidas.co.kr',
    overseas: [{ country: 'US', site: 'adidas.com/us' }, { country: 'JP', site: 'adidas.jp' }] },
  { key: 'newbalance', ko: '뉴발란스', match: ['new balance', 'newbalance', '뉴발란스'],
    home: 'https://www.nbkorea.com/', site: 'nbkorea.com',
    overseas: [{ country: 'US', site: 'newbalance.com' }] },
  { key: 'salomon', ko: '살로몬', match: ['salomon', '살로몬'],
    home: 'https://salomon.co.kr/', site: 'salomon.co.kr',
    overseas: [{ country: 'US', site: 'salomon.com' }, { country: 'JP', site: 'salomon.jp' }] },
  { key: 'asics', ko: '아식스', match: ['asics', '아식스'],
    home: 'https://www.asics.co.kr/', site: 'asics.co.kr', overseas: [] },
  { key: 'arcteryx', ko: '아크테릭스', match: ["arc'teryx", 'arcteryx', 'arc’teryx', '아크테릭스'],
    home: 'https://arcteryx.co.kr/', site: 'arcteryx.co.kr',
    overseas: [{ country: 'CA', site: 'arcteryx.com' }] },
  { key: 'thenorthface', ko: '노스페이스', match: ['the north face', 'north face', '노스페이스'],
    home: 'https://www.thenorthfacekorea.co.kr/', site: 'thenorthfacekorea.co.kr',
    overseas: [{ country: 'US', site: 'thenorthface.com' }] },
  { key: 'stussy', ko: '스투시', match: ['stussy', 'stüssy', '스투시'],
    home: 'https://kr.stussy.com/', site: 'kr.stussy.com',
    overseas: [{ country: 'US', site: 'stussy.com' }] },
];

const norm = (s) => String(s || '').trim().toLowerCase();

export function findBrand(name) {
  const n = norm(name);
  if (!n) return null;
  return BRANDS.find((b) => b.match.some((m) => n === m || n.startsWith(m + ' '))) || null;
}

const google = (q) => 'https://www.google.com/search?q=' + encodeURIComponent(q);
const naverMap = (q) => 'https://map.naver.com/p/search/' + encodeURIComponent(q);
const kakaoMap = (q) => 'https://map.kakao.com/?q=' + encodeURIComponent(q);
const naverShop = (q) => 'https://search.shopping.naver.com/search/all?query=' + encodeURIComponent(q);

export function brandLinks({ brand, modelNo, name, area } = {}) {
  const b = findBrand(brand);
  const term = modelNo || name || '';
  const where = String(area || '').trim();
  const brandLabel = b ? b.ko : String(brand || '').trim();
  const mapQuery = [where, brandLabel, '매장'].filter(Boolean).join(' ');

  const official = [];
  if (b) {
    official.push({ label: `${b.ko} 공식 홈페이지`, url: b.home });
    if (term) official.push({ label: `공식몰에서 「${term}」 검색`, url: google(`"${term}" site:${b.site}`) });
  } else if (brandLabel) {
    official.push({ label: `「${brandLabel}」 공식 홈페이지 찾기`, url: google(`${brandLabel} 공식 홈페이지`) });
    if (term) official.push({ label: `「${term}」 웹 검색`, url: google(`"${term}"`) });
  }
  if (term) official.push({ label: `네이버 쇼핑에서 「${term}」`, url: naverShop(term) });

  const offline = brandLabel ? [
    { label: `네이버 지도 — ${mapQuery}`, url: naverMap(mapQuery) },
    { label: `카카오맵 — ${mapQuery}`, url: kakaoMap(mapQuery) },
  ] : [];
  if (b && b.storeFinder) offline.push({ label: `${b.ko} 공식 매장 찾기`, url: b.storeFinder });

  const overseas = b && term
    ? b.overseas.map((o) => ({ country: o.country, label: `${o.site} 에서 「${term}」 검색`, url: google(`"${term}" site:${o.site}`) }))
    : [];

  return { known: !!b, brandKo: b ? b.ko : null, official, offline, overseas };
}
