// KREAM 미리보기 응답(GET /kream/preview) → 화면에 그릴 값. 순수 함수.
// 값은 전부 문자열로 만들고, 화면은 textContent 로만 넣는다 — 외부(KREAM) 문자열을 HTML 로 해석하지 않는다.
//
// 사이즈 칩의 가격은 「무엇의 값인지」를 같이 보인다. 비로그인 KREAM 은 사이즈를 합쳐 최근 5건뿐이라
// 사이즈마다 있는 값이 다르다: 최근 거래 → 판매 입찰(최저) → 구매 입찰(최고) 순으로 하나만.

export function formatWon(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('ko-KR') + '원' : null;
}

export function sizeChip(s) {
  if (s.recentPrice != null) return { size: s.size, price: formatWon(s.recentPrice), basis: '최근 거래' };
  if (s.lowestAsk != null) return { size: s.size, price: formatWon(s.lowestAsk), basis: '판매 입찰' };
  if (s.highestBid != null) return { size: s.size, price: formatWon(s.highestBid), basis: '구매 입찰' };
  return { size: s.size, price: null, basis: null };
}

// 미리보기 실패 문구 — 서버 문구 끝의 「신청은 그대로 …」를 떼고 한 번만 붙인다(서버·테스트 모드 문구가 달라도 한 문장)
export const STILL_APPLY = '신청은 그대로 진행할 수 있어요.';
export function previewFailText(message) {
  const base = String(message || '').replace(/\s*신청은 그대로 (?:진행)?할 수 있(?:습니다|어요)\.?\s*$/, '').trim() || '상품 정보를 읽지 못했습니다.';
  return `${base} ${STILL_APPLY}`;
}

function checkedNote(d) {
  const when = !d.cached || !d.ageMin ? '방금 확인' : `${d.ageMin}분 전 확인`;
  return 'KREAM 기준 · ' + when + (d.stale ? '(지금은 새로 못 불러옴)' : '');
}

export function buildPreviewModel(d) {
  const p = d && d.product;
  if (!p || !p.name) return null;
  return {
    title: p.nameKo || p.name,
    subtitle: p.nameKo ? p.name : null,
    brand: p.brand || null,
    modelNo: p.modelNo || null,
    image: typeof p.image === 'string' && p.image.startsWith('https://') ? p.image : null,
    buyNow: formatWon(p.buyNowPrice),
    sizes: (Array.isArray(p.sizes) ? p.sizes : []).map(sizeChip),
    note: checkedNote(d),
    url: d.url || null,
  };
}
