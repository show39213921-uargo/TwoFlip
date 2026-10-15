import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactDraft, latestBuyable, smsHref, PRICE_BLANK } from '../assets/js/contact-message.js';

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
