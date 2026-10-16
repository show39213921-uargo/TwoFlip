import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactDraft, notFoundDraft, defaultContactKind, latestBuyable, smsHref, PRICE_BLANK } from '../assets/js/contact-message.js';

const rec = (sourcing) => ({
  id: 'a3f9c210', size: 'L', name: '홍길동', phone: '01012345678', memo: '비밀 메모',
  sourcing,
});

test('연락 문구 — 살 수 있는 기록이 없으면 만들지 않는다', () => {
  assert.equal(contactDraft(rec([])), null);
  assert.equal(contactDraft(rec([{ type: 'offline', name: 'A', stock: 'out', at: '2026-10-15T01:00:00Z' }])), null);
  assert.equal(contactDraft({ id: 'x', size: 'L' }), null);
});

test('연락 문구 — 가장 최근 「재고 있음 · 소량」 기록의 판매처 종류, 가격은 빈칸, 해요체', () => {
  const r = rec([
    { type: 'official', name: '살로몬 공식몰', stock: 'in', price: 300000, at: '2026-10-15T01:00:00Z' },
    { type: 'offline', name: '살로몬 하남점', stock: 'low', price: 289000, currency: 'KRW', note: '직원 김○○', at: '2026-10-15T02:00:00Z' },
    { type: 'overseas', name: 'salomon.com (US)', stock: 'out', at: '2026-10-15T03:00:00Z' },
  ]);
  assert.equal(latestBuyable(r).name, '살로몬 하남점');
  const t = contactDraft(r, { title: '살로몬 크로스 인슐레이션 자켓' });
  assert.equal(t, [
    '안녕하세요, TWOFLIP이에요.',
    '신청하신 살로몬 크로스 인슐레이션 자켓(사이즈 L)을 매장에서 찾았어요.',
    `가격: ${PRICE_BLANK}`,
    '구매를 원하시면 이 메시지에 답장 주세요.',
    '접수번호 a3f9c210',
  ].join('\n'));
  assert.doesNotMatch(t, /습니다/);
});

test('연락 문구 — 판매처 이름 · 기록한 가격 · 메모 · 고객 이름 · 번호가 들어가지 않는다', () => {
  const r = rec([{ type: 'offline', name: '살로몬 하남점', stock: 'in', price: 289000, note: '직원 김○○', at: '2026-10-15T02:00:00Z' }]);
  const t = contactDraft(r, { title: '자켓' });
  for (const leak of ['하남점', '289', '직원', '비밀', '홍길동', '01012345678']) assert.ok(!t.includes(leak), leak);
});

test('연락 문구 — 「(사이즈 X)」, 받침에 맞춰 을/를, 상품명이 없으면 「상품」, 판매처 종류', () => {
  const one = (type, title, size = 'L') => contactDraft({ ...rec([{ type, name: 'x', stock: 'in', at: '2026-10-15T00:00:00Z' }]), size }, { title }).split('\n')[1];
  assert.equal(one('official', '나이키 에어 포스 1'), '신청하신 나이키 에어 포스 1(사이즈 L)을 공식몰에서 찾았어요.');
  assert.equal(one('overseas', '뉴발란스 2002'), '신청하신 뉴발란스 2002(사이즈 L)를 해외몰에서 찾았어요.');
  assert.equal(one('other', '볼캡 블루'), '신청하신 볼캡 블루(사이즈 L)를 판매처에서 찾았어요.');
  assert.equal(one('offline', ''), '신청하신 상품(사이즈 L)을 매장에서 찾았어요.');
  assert.equal(one('offline', '자켓', ''), '신청하신 자켓을 매장에서 찾았어요.');
});

test('연락 문구 — 받침을 모르는 이름(영문 등)은 「을(를)」 대신 쉼표로 이어 쓴다(13차 QA U-1)', () => {
  const one = (title) => contactDraft(rec([{ type: 'offline', name: 'x', stock: 'in', at: '2026-10-15T00:00:00Z' }]), { title }).split('\n')[1];
  assert.equal(one('Cap'), '신청하신 Cap(사이즈 L), 매장에서 찾았어요.');
  assert.equal(one('XT-6 GTX'), '신청하신 XT-6 GTX(사이즈 L), 매장에서 찾았어요.');
  for (const t of ['Cap', 'XT-6 GTX', '자켓', '']) assert.doesNotMatch(one(t), /\(를\)|을\(/);
});

test('문자로 열기 주소 — 숫자만, 글은 인코딩, 번호가 없으면 null', () => {
  assert.equal(smsHref('010-1234-5678', '안녕 & 하세요'), 'sms:01012345678?&body=' + encodeURIComponent('안녕 & 하세요'));
  assert.equal(smsHref('', 'x'), null);
});

// 오픈 전 회귀 고정(17차 A-1) — 06 연락 문구 초안 전체 모양
test('연락 문구 회귀 — 받침 · 영문 · 상품명 없음 · 사이즈 없음 · 판매처 종류 3가지 · 금지 내용 · 가격 빈칸', () => {
  const r = (type, extra = {}) => ({
    id: 'a3f9c210', size: 'L', name: '홍길동', phone: '010-1234-5678', memo: '비밀 메모', ...extra,
    sourcing: [{ type, name: '[QA] 매장 A', stock: 'in', price: 289000, currency: 'KRW', note: '직원 김', at: '2026-10-15T01:00:00Z' }],
  });
  const line = (rec, title) => contactDraft(rec, { title }).split('\n')[1];
  assert.equal(line(r('offline'), '살로몬 UNI 크로스 인슐레이션 자켓 라이트 그레이'), '신청하신 살로몬 UNI 크로스 인슐레이션 자켓 라이트 그레이(사이즈 L)를 매장에서 찾았어요.');
  assert.equal(line(r('offline'), '살로몬 자켓'), '신청하신 살로몬 자켓(사이즈 L)을 매장에서 찾았어요.');
  assert.equal(line(r('offline'), 'Cap'), '신청하신 Cap(사이즈 L), 매장에서 찾았어요.');
  assert.equal(line(r('offline'), ''), '신청하신 상품(사이즈 L)을 매장에서 찾았어요.');
  assert.equal(line(r('offline', { size: '' }), '살로몬 자켓'), '신청하신 살로몬 자켓을 매장에서 찾았어요.');
  assert.equal(line(r('official'), '살로몬 자켓'), '신청하신 살로몬 자켓(사이즈 L)을 공식몰에서 찾았어요.');
  assert.equal(line(r('overseas'), '살로몬 자켓'), '신청하신 살로몬 자켓(사이즈 L)을 해외몰에서 찾았어요.');
  const all = contactDraft(r('offline'), { title: '살로몬 자켓' });
  assert.equal(all.split('\n')[2], '가격: [가격을 적어 주세요]');
  for (const leak of ['[QA] 매장 A', '289000', '289,000', '직원 김', '비밀 메모', '홍길동', '010-1234-5678', '01012345678']) assert.ok(!all.includes(leak), leak);
});

// ── 4단계 B-1 · B-2 ──
const URL1 = 'https://twoflip.u-argo.com/status.html?t=a3f9c210.abcdefghijklmnopqrstuvwxyz012345';

test('22차 U-1 — 「찾았어요」: 확인 링크가 있으면 답하는 길은 링크 하나(주소만 한 줄), 없으면 「답장 주세요」', () => {
  const r = rec([{ type: 'offline', name: '살로몬 하남점', stock: 'in', price: 289000, note: '직원 김', at: '2026-10-15T02:00:00Z' }]);
  const t = contactDraft(r, { title: '살로몬 크로스 인슐레이션 자켓', statusUrl: URL1 });
  assert.equal(t, [
    '안녕하세요, TWOFLIP이에요.',
    '신청하신 살로몬 크로스 인슐레이션 자켓(사이즈 L)을 매장에서 찾았어요.',
    `가격: ${PRICE_BLANK}`,
    '아래 링크에서 「구매할게요」를 눌러 주세요. 문자로 답하셔도 돼요.',
    URL1,
    '접수번호 a3f9c210',
  ].join('\n'));
  assert.ok(!t.includes('진행 상황'), '링크 앞에 이름표를 붙이지 않는다');
  assert.ok(!t.includes('이 메시지에 답장'), '답하는 길이 두 개가 되지 않게');
  for (const leak of ['하남점', '289', '직원', '비밀', '홍길동', '01012345678']) assert.ok(!t.includes(leak), leak);
  assert.doesNotMatch(t, /습니다/);
  // 링크가 없으면(토큰을 못 만듦) 예전 줄
  const plain = contactDraft(r, { title: '살로몬 자켓' }).split('\n');
  assert.equal(plain[3], '구매를 원하시면 이 메시지에 답장 주세요.');
  assert.equal(plain.length, 5);
  // 상품명 없음 · 받침 없음 · 영문 이름도 같은 꼴
  const second = (title) => contactDraft(r, { title, statusUrl: URL1 }).split('\n')[1];
  assert.equal(second(''), '신청하신 상품(사이즈 L)을 매장에서 찾았어요.');
  assert.equal(second('뉴발란스 2002'), '신청하신 뉴발란스 2002(사이즈 L)를 매장에서 찾았어요.');
  assert.equal(second('Arc\'teryx Beta'), "신청하신 Arc'teryx Beta(사이즈 L), 매장에서 찾았어요.");
});

test('4단계 — 「못 찾았어요」 문구: 정해진 다섯 줄, 새 약속 · 판매처 · 가격 · 이름 없음', () => {
  const r = rec([{ type: 'offline', name: '살로몬 하남점', stock: 'out', price: 289000, note: '직원 김', at: '2026-10-15T02:00:00Z' }]);
  const t = notFoundDraft(r, { title: '살로몬 크로스 인슐레이션 자켓', statusUrl: URL1 });
  assert.equal(t, [
    '안녕하세요, TWOFLIP이에요.',
    '신청하신 살로몬 크로스 인슐레이션 자켓(사이즈 L)은 공식몰 · 매장 · 해외를 확인했지만 이번엔 찾지 못했어요.',
    '다른 상품도 KREAM 링크만 보내 주시면 찾아볼게요.',
    `진행 상황: ${URL1}`,
    '접수번호 a3f9c210',
  ].join('\n'));
  for (const x of ['하남점', '289000', '직원 김', '홍길동', '01012345678', '비밀 메모', '재입고', '알려 드릴까요']) assert.ok(!t.includes(x), x);
});

test('4단계 — 「못 찾았어요」 받침 · 상품명 없음 · 사이즈 없음', () => {
  const r = { id: 'b1', size: '' };
  assert.match(notFoundDraft(r, { title: '나이키 덩크' }), /신청하신 나이키 덩크는 공식몰/);
  assert.match(notFoundDraft(r, { title: '아식스 젤 카야노 14' }), /신청하신 아식스 젤 카야노 14는 공식몰/);
  assert.match(notFoundDraft(r, { title: '' }), /신청하신 상품은 공식몰/);
  assert.match(notFoundDraft(r, { title: 'Arc\'teryx Beta' }), /신청하신 Arc'teryx Beta, 공식몰/);
  assert.ok(!notFoundDraft(r, { title: '' }).includes('진행 상황'), '링크가 없으면 줄도 없다');
});

test('4단계 — 문구 종류 기본값: 재고 있음 · 소량이 있으면 찾았어요, 기록이 모두 품절 · 확인 불가면 못 찾았어요', () => {
  assert.equal(defaultContactKind(rec([])), 'found', '기록이 없으면 아직 판단하지 않는다');
  assert.equal(defaultContactKind(rec([{ stock: 'out', at: '2026-10-15T01:00:00Z' }, { stock: 'unknown', at: '2026-10-15T02:00:00Z' }])), 'not_found');
  assert.equal(defaultContactKind(rec([{ stock: 'out', at: '2026-10-15T01:00:00Z' }, { stock: 'low', at: '2026-10-15T02:00:00Z' }])), 'found');
});
