// 관리자 판단 규칙 — 찾아보기 미리 채움 · 안내 줄 결과 문장. 순수 함수(브라우저 · node:test 공용).
// 화면 코드(admin.js · admin-items.js)는 칸을 읽어 여기에 넘기고 돌려받은 값을 칸에 쓴다(오픈 전 회귀 테스트 고정 · 동작은 그대로).

import { josa, statusLabel } from './admin-view.js';
import { stockLabel } from './stock.js';

const DOMESTIC = new Set(['official', 'offline']);

/**
 * 찾아보기 링크를 눌렀을 때 05 칸에 쓸 값(13차 QA B-1 · 15차 QA U-1).
 * now = { name, nameAuto, currency, currencyAuto, manual } — 지금 칸 값 · 미리 채운 표시 · 운영자가 통화를 직접 골랐는지
 * p = findPrefill() 값 + label — { type, name, currency, label }
 * 미리 채운 값 그대로(또는 빈칸)일 때만 바꾸고(매장 = 판매처 비움 · 외화 → KRW), 고친 판매처 · 고른 통화는 둔다.
 * 국내(공식몰 · 오프라인)는 통화를 KRW 로 맞추고(국내 통화 막기), 고른 외화를 바꿨으면 그렇게 알린다.
 */
export function planPrefill(now, p) {
  const nameFree = !String(now.name || '').trim() || now.name === now.nameAuto;
  const curFree = !now.manual;
  const curBefore = now.currency;
  let currency = now.currency;
  let currencyAuto = now.currencyAuto || null;
  let manual = Boolean(now.manual);
  if (DOMESTIC.has(p.type) && currency !== 'KRW') { currency = 'KRW'; currencyAuto = null; manual = false; }
  let name = now.name;
  let nameAuto = now.nameAuto || null;
  if (nameFree) { name = p.name || ''; nameAuto = p.name || null; }
  let curFilled = false;
  if (curFree && p.currency) { currency = p.currency; currencyAuto = p.currency; curFilled = true; }
  else if (curFree && currencyAuto && currency === currencyAuto) { currency = 'KRW'; currencyAuto = null; }
  else if (curFree) currencyAuto = null;

  const filled = [nameFree && p.name ? '판매처' : '', '종류', curFilled ? '통화' : ''].filter(Boolean).join(' · ');
  const kept = [!nameFree ? '직접 고친 판매처' : '', !curFree && p.currency && currency !== p.currency ? `고른 통화(${currency})` : ''].filter(Boolean).join(' · ');
  const hint = `「${p.label}」 링크를 열었습니다 — ${filled}를 미리 채웠습니다.`
    + (kept ? ` ${kept}는 그대로 뒀습니다.` : (nameFree && !p.name ? ' 매장 이름은 직접 적어 주세요.' : ''))
    + (!curFree && curBefore !== 'KRW' && currency === 'KRW' ? ` 국내 판매처라 고른 통화(${curBefore})를 KRW 로 바꿨습니다.` : '');
  return { type: p.type, name, nameAuto, currency, currencyAuto, manual, hint };
}

// ── 안내 줄(#src-note) 결과 문장(15차 QA B-1 · 16차 QA U-1) ──
// 신청은 접수번호 · 판매처 이름 · 상태만, 확보 상품은 상품 번호만. 고객 이름 · 전화번호 · 매입가 · 메모는 받아도 쓰지 않는다
/** QA 가 만든 값인가 — 이름 · 오류 메시지에 [QA] 가 들어 있다(서버 규칙과 같다) */
export const isQa = (s) => String(s ?? '').includes('[QA]');
const quoted = (label) => `「${label}」${josa(label, '으로', '로')}`;
const seller = (c) => (c && c.name) || '판매처';

export const notes = {
  status: (r, status) => `${r.id} 상태를 ${quoted(statusLabel(status))} 바꿨습니다.`,
  brand: (r) => `${r.id} 브랜드 · 모델번호를 저장했습니다.`,
  assignee: (r) => `${r.id} 담당자를 바꿨습니다.`,
  checkAdded: (c) => `${seller(c)} · ${stockLabel(c.stock)}${josa(stockLabel(c.stock), '을', '를')} 기록했습니다.`,
  checkStock: (c, stock) => `${seller(c)} 재고를 ${quoted(stockLabel(stock))} 바꿨습니다.`,
  checkTouched: (c) => `${seller(c)} 확인 시각을 지금으로 바꿨습니다.`,
  checkRemoved: (c) => `${seller(c)} 기록을 지웠습니다.`,
  caseOn: (r) => `${r.id} 사례를 공개했습니다 — 첫 페이지 · 소개에는 1분 안에 보입니다.`,
  caseOff: (r) => `${r.id} 사례 공개를 껐습니다 — 1분 안에 사라집니다.`,
  appRemoved: (r) => `접수번호 ${r.id} 를 지웠습니다.`,
  itemRegistered: (it) => (it.status === 'on_sale'
    ? `상품 ${it.id} 를 등록했습니다 — 「바로 구매」 페이지에 바로 보입니다.`
    : `상품 ${it.id} 를 등록했습니다(비공개). 공개하려면 상태를 「판매 중」으로 바꾸세요.`),
  itemStatus: (it, label) => `상품 ${it.id} 상태를 ${quoted(label)} 바꿨습니다.`,
  itemSaved: (it) => `상품 ${it.id} 를 저장했습니다.`,
  itemNoChange: (it) => `상품 ${it.id} — 바뀐 칸이 없습니다.`,
  itemRemoved: (it) => `상품 ${it.id} 를 지웠습니다.`,
  // 19차 U-1 — [QA] 요청 예약은 공개 목록에서 빠진다(18차 A) — 문장도 사실대로
  itemReserved: (it, req) => (isQa(req && req.name)
    ? `상품 ${it.id} 를 접수번호 ${req.id} 요청으로 예약했습니다 — [QA] 요청이라 「바로 구매」에는 보이지 않습니다.`
    : `상품 ${it.id} 를 접수번호 ${req.id} 요청으로 예약했습니다 — 「바로 구매」 페이지에서 「예약 중」으로 보입니다.`),
  qaErrorsCleared: (n) => `[QA] 오류 기록 ${n}건을 지웠습니다.`,
};
