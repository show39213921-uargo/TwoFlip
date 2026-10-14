import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caseCardModel, caseCards, caseChoices, CASE_RESULTS } from '../assets/js/cases-view.js';

test('사례 카드 — 날짜 MM.DD · 브랜드·상품명·사이즈 한 줄 · 결과 문구', () => {
  assert.deepEqual(caseCardModel({ date: '2026-10-12', brand: 'Salomon', name: '살로몬 자켓', size: 'L', result: 'found_store' }),
    { date: '10.12', title: 'Salomon · 살로몬 자켓 · L', label: '매장에서 찾음 · 연락 완료', found: true });
  const miss = caseCardModel({ date: '2026-10-10', brand: null, name: 'Cap', size: 'FREE', result: 'not_found' });
  assert.equal(miss.title, 'Cap · FREE', '브랜드 없으면 빼고');
  assert.equal(miss.label, '이번엔 못 찾았어요');
  assert.equal(miss.found, false);
});

test('사례 카드 — 모르는 결과 · 이름 없음 · 이상한 값은 보이지 않는다', () => {
  assert.equal(caseCardModel({ date: '2026-10-12', name: 'x', size: 'L', result: 'sold' }), null);
  assert.equal(caseCardModel({ date: '2026-10-12', name: '  ', size: 'L', result: 'found_store' }), null);
  assert.equal(caseCardModel(null), null);
  assert.equal(caseCardModel({ name: 'x', result: 'found_online' }).date, '', '날짜 없으면 빈 칸');
});

test('사례 목록 — 걸러내고 최대 5건, 배열이 아니면 빈 목록', () => {
  const one = { date: '2026-10-12', name: 'A', size: 'L', result: 'found_store' };
  assert.equal(caseCards([one, { result: 'x' }, one, one, one, one, one]).length, 5);
  assert.deepEqual(caseCards(undefined), []);
});

test('사례 카드에 이름·번호·가격 칸이 끼어들지 않는다', () => {
  const m = caseCardModel({ date: '2026-10-12', name: 'A', size: 'L', result: 'found_store', customer: '홍길동', phone: '01012345678', price: 300000 });
  assert.deepEqual(Object.keys(m).sort(), ['date', 'found', 'label', 'title']);
  assert.ok(!JSON.stringify(m).includes('홍길동') && !JSON.stringify(m).includes('0101234'));
});

test('관리자 선택지 — 완료는 찾음 둘, 취소는 못 찾음, 나머지는 없음', () => {
  assert.deepEqual(caseChoices('completed'), ['found_store', 'found_online']);
  assert.deepEqual(caseChoices('canceled'), ['not_found']);
  assert.deepEqual(caseChoices('sourcing'), []);
  for (const k of Object.keys(CASE_RESULTS)) assert.ok(CASE_RESULTS[k].admin && CASE_RESULTS[k].label);
});
