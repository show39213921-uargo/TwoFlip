import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caseCardModel, caseCards, caseChoices, CASE_RESULTS, relativeDay } from '../assets/js/cases-view.js';

test('사례 카드 — 날짜 MM.DD · 브랜드·상품명·사이즈 한 줄 · 결과 문구', () => {
  const now = Date.parse('2026-10-15T03:00:00Z'); // 한국 10-15 12:00
  assert.deepEqual(caseCardModel({ date: '2026-10-12', brand: 'Salomon', name: '살로몬 자켓', size: 'L', result: 'found_store' }, now),
    { date: '10.12', title: 'Salomon · 살로몬 자켓 · L', brand: 'Salomon', name: '살로몬 자켓', size: 'L', when: '3일 전', label: '매장에서 찾음 · 연락 완료', found: true, image: null });
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
  assert.deepEqual(Object.keys(m).sort(), ['brand', 'date', 'found', 'image', 'label', 'name', 'size', 'title', 'when']);
  assert.ok(!JSON.stringify(m).includes('홍길동') && !JSON.stringify(m).includes('0101234'));
});

test('사례 사진 — 찾은 건만, https 만, 못 찾은 건은 사진이 와도 싣지 않는다(1단계 1-2)', () => {
  const base = { date: '2026-10-12', name: 'A', size: 'L' };
  assert.equal(caseCardModel({ ...base, result: 'found_store', image: 'https://kream-phinf.pstatic.net/a.png' }).image, 'https://kream-phinf.pstatic.net/a.png');
  assert.equal(caseCardModel({ ...base, result: 'found_online', image: 'http://x.com/a.png' }).image, null, 'http 는 안 쓴다');
  assert.equal(caseCardModel({ ...base, result: 'found_online', image: 'javascript:alert(1)' }).image, null);
  assert.equal(caseCardModel({ ...base, result: 'found_store' }).image, null, '없으면 null(사진 준비 중)');
  assert.equal(caseCardModel({ ...base, result: 'not_found', image: 'https://kream-phinf.pstatic.net/a.png' }).image, null, '못 찾음은 사진 없음');
});

test('상대 시각 — 한국 날짜 기준 오늘 · 어제 · n일 전 · 7일 넘으면 MM.DD(3단계 P2)', () => {
  const now = Date.parse('2026-10-15T16:30:00Z'); // 한국 10-16 01:30 — 자정이 지나 날짜가 바뀐 때
  assert.equal(relativeDay('2026-10-16', now), '오늘');
  assert.equal(relativeDay('2026-10-15', now), '어제');
  assert.equal(relativeDay('2026-10-13', now), '3일 전');
  assert.equal(relativeDay('2026-10-10', now), '6일 전');
  assert.equal(relativeDay('2026-10-09', now), '10.09');
  assert.equal(relativeDay('2026-10-20', now), '오늘', '미래 날짜는 오늘');
  assert.equal(relativeDay('', now), '');
  assert.equal(relativeDay('10.12', now), '');
});

test('관리자 선택지 — 완료는 찾음 둘, 취소는 못 찾음, 나머지는 없음', () => {
  assert.deepEqual(caseChoices('completed'), ['found_store', 'found_online']);
  assert.deepEqual(caseChoices('canceled'), ['not_found']);
  assert.deepEqual(caseChoices('sourcing'), []);
  for (const k of Object.keys(CASE_RESULTS)) assert.ok(CASE_RESULTS[k].admin && CASE_RESULTS[k].label);
});
