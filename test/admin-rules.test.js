// 오픈 전 회귀 고정(17차) — 찾아보기 미리 채움 규칙 · 안내 줄 결과 문장. 화면 코드(admin.js · admin-items.js)가 이 함수를 그대로 쓴다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPrefill, notes } from '../assets/js/admin-rules.js';
import { findPrefill } from '../assets/js/brands.js';

// 브랜드 표(brands.js)가 주는 값을 그대로 쓴다 — 표가 바뀌면 여기서 먼저 깨진다
const link = (kind) => {
  const extra = kind === 'overseas' ? { country: 'US', site: 'salomon.com' } : undefined;
  const p = findPrefill(kind, { brand: 'Salomon', overseas: extra });
  return { ...p, label: { official: '공식몰', offline: '근처 매장', overseas: '해외 US' }[kind] };
};
const empty = { name: '', nameAuto: null, currency: 'KRW', currencyAuto: null, manual: false };
const press = (now, kind) => planPrefill(now, link(kind));
const pick = (s) => ({ type: s.type, name: s.name, currency: s.currency });

test('미리 채움 ① 공식몰 → 매장: 판매처 빈칸 · offline · KRW', () => {
  const a = press(empty, 'official');
  assert.equal(a.type, 'official');
  assert.ok(a.name, '공식몰은 판매처를 채운다');
  assert.deepEqual(pick(press(a, 'offline')), { type: 'offline', name: '', currency: 'KRW' });
});

test('미리 채움 ② 매장 → 해외 US: salomon.com (US) · USD', () => {
  assert.deepEqual(pick(press(press(empty, 'offline'), 'overseas')), { type: 'overseas', name: 'salomon.com (US)', currency: 'USD' });
});

test('미리 채움 ③ 직접 고친 판매처는 다른 링크에서도 유지 · 안내에 「그대로 뒀습니다」', () => {
  const edited = { ...press(empty, 'official'), name: '[QA] 공식몰' };
  const b = press(edited, 'overseas');
  assert.deepEqual(pick(b), { type: 'overseas', name: '[QA] 공식몰', currency: 'USD' });
  assert.match(b.hint, /직접 고친 판매처는 그대로 뒀습니다/);
  assert.equal(press(b, 'offline').name, '[QA] 공식몰');
  assert.equal(press({ ...edited, name: '' }, 'overseas').name, 'salomon.com (US)', '비우면 다시 채운다');
});

test('미리 채움 ④ 직접 고른 통화(EUR)는 해외 링크에서 유지', () => {
  const chosen = { ...press(empty, 'overseas'), currency: 'EUR', currencyAuto: null, manual: true };
  const b = press(chosen, 'overseas');
  assert.equal(b.currency, 'EUR');
  assert.match(b.hint, /고른 통화\(EUR\)는 그대로 뒀습니다/);
});

test('미리 채움 ⑤ 해외 → EUR 직접 → 매장: KRW + 「국내 판매처라 고른 통화(EUR)를 KRW 로 바꿨습니다.」', () => {
  const chosen = { ...press(empty, 'overseas'), currency: 'EUR', currencyAuto: null, manual: true };
  const b = press(chosen, 'offline');
  assert.deepEqual(pick(b), { type: 'offline', name: '', currency: 'KRW' });
  assert.equal(b.manual, false, '국내로 바꾸면 직접 고른 표시도 풀린다');
  assert.ok(b.hint.endsWith(' 국내 판매처라 고른 통화(EUR)를 KRW 로 바꿨습니다.'), b.hint);
  assert.equal(press(b, 'overseas').currency, 'USD', '그다음 해외 링크는 다시 USD');
});

// ── 안내 줄 결과 문장 ──
// 고객 이름 · 전화번호 · 매입가 · 메모 · 공개 설명을 일부러 넣고, 문장에 없어야 한다
const SECRET = ['홍길동', '01012345678', '010-1234-5678', '289000', '직원 김', '비밀 메모', '[QA] 테스트 상품', '내부 메모'];
const app = { id: 'a3f9c210', name: '홍길동', phone: '01012345678', memo: '비밀 메모', size: 'L' };
const check = { id: 7, name: '[QA] 매장 A', stock: 'in', price: 289000, note: '직원 김', currency: 'KRW' };
const item = { id: 'q9001abc', status: 'hidden', costPrice: 289000, internalMemo: '내부 메모', note: '[QA] 테스트 상품', title: '[QA] 테스트 상품' };
const req = { id: '8357525a', name: '홍길동', phone: '010-1234-5678', memo: '비밀 메모' };
const clean = (s) => { for (const x of SECRET) assert.ok(!s.includes(x), `「${x}」가 들어감: ${s}`); return s; };

test('안내 줄 — 신청 동작마다 문장 하나, 접수번호 · 판매처 · 상태만', () => {
  assert.equal(clean(notes.status(app, 'sourcing')), 'a3f9c210 상태를 「탐색 중」으로 바꿨습니다.');
  assert.equal(clean(notes.status(app, 'secured')), 'a3f9c210 상태를 「확보」로 바꿨습니다.');
  assert.equal(clean(notes.checkAdded({ ...check, stock: 'in' })), '[QA] 매장 A · 재고 있음을 기록했습니다.');
  assert.equal(clean(notes.checkAdded({ ...check, stock: 'out' })), '[QA] 매장 A · 품절을 기록했습니다.');
  assert.equal(clean(notes.checkAdded({ ...check, stock: 'low' })), '[QA] 매장 A · 소량을 기록했습니다.');
  assert.equal(clean(notes.checkAdded({ ...check, stock: 'unknown' })), '[QA] 매장 A · 확인 불가를 기록했습니다.');
  assert.equal(clean(notes.checkStock(check, 'out')), '[QA] 매장 A 재고를 「품절」로 바꿨습니다.');
  assert.equal(clean(notes.checkTouched(check)), '[QA] 매장 A 확인 시각을 지금으로 바꿨습니다.');
  assert.equal(clean(notes.checkRemoved(check)), '[QA] 매장 A 기록을 지웠습니다.');
  assert.equal(clean(notes.brand(app)), 'a3f9c210 브랜드 · 모델번호를 저장했습니다.');
  assert.equal(clean(notes.assignee(app)), 'a3f9c210 담당자를 바꿨습니다.');
  assert.equal(clean(notes.appRemoved(app)), '접수번호 a3f9c210 를 지웠습니다.');
  clean(notes.caseOn(app)); clean(notes.caseOff(app));
  assert.equal(notes.checkRemoved({}), '판매처 기록을 지웠습니다.', '판매처 이름이 없으면 「판매처」');
});

test('안내 줄 — 확보 상품은 상품 번호만(예약도 고객 이름 대신 접수번호)', () => {
  assert.equal(clean(notes.itemRegistered(item)), '상품 q9001abc 를 등록했습니다(비공개). 공개하려면 상태를 「판매 중」으로 바꾸세요.');
  assert.equal(clean(notes.itemRegistered({ ...item, status: 'on_sale' })), '상품 q9001abc 를 등록했습니다 — 「바로 구매」 페이지에 바로 보입니다.');
  assert.equal(clean(notes.itemStatus(item, '판매 중')), '상품 q9001abc 상태를 「판매 중」으로 바꿨습니다.');
  assert.equal(clean(notes.itemStatus(item, '비공개')), '상품 q9001abc 상태를 「비공개」로 바꿨습니다.', '예약 풀기도 같은 문장');
  assert.equal(clean(notes.itemSaved(item)), '상품 q9001abc 를 저장했습니다.');
  assert.equal(clean(notes.itemNoChange(item)), '상품 q9001abc — 바뀐 칸이 없습니다.');
  assert.equal(clean(notes.itemRemoved(item)), '상품 q9001abc 를 지웠습니다.');
  assert.equal(clean(notes.itemReserved(item, req)), '상품 q9001abc 를 접수번호 8357525a 요청으로 예약했습니다 — 「바로 구매」 페이지에서 「예약 중」으로 보입니다.');
});
