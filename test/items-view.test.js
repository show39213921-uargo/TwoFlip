import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemCardModel, validateItem, validateItemRequest, itemStatusLabel, noteChips } from '../assets/js/items-view.js';
import { createLocalApi } from '../assets/js/local-api.js';
import { createLocalStore } from '../assets/js/local-store.js';

const item = {
  id: 'i1', status: 'on_sale', size: 'M', title: null, name: 'Salomon Jacket', nameKo: '살로몬 자켓', brand: 'Salomon',
  modelNo: 'LD0274200', image: 'https://img/x.png', salePrice: 299000, note: '새상품',
};

test('공개 카드 — 판매가 있으면 원화, 없으면 「가격 문의」 · 예약 중 표시 · https 이미지만', () => {
  const m = itemCardModel(item);
  assert.deepEqual([m.title, m.sub, m.price, m.priceKnown, m.priceHint, m.reserved, m.reservedNote, m.image], ['살로몬 자켓', 'Salomon', '299,000원', true, null, false, null, 'https://img/x.png']);
  const q = itemCardModel({ ...item, salePrice: null, status: 'reserved', image: 'http://x/y.png', title: '직접 이름' });
  assert.deepEqual([q.title, q.sub, q.price, q.priceKnown, q.priceHint, q.reserved, q.reservedNote, q.image], ['직접 이름', 'Salomon', '가격 문의', false, '가격은 연락드릴 때 안내해요', true, '다른 분께 먼저 안내 중이에요', null]);
  assert.equal(itemCardModel({ id: 'x' }).title, '상품 정보 준비 중');
  assert.equal(itemStatusLabel('sold'), '판매 완료');
});

test('확보 상품 입력 검증 — 등록(주소·사이즈 필수, 가격은 비우면 null, 사진은 https) · 수정은 넘긴 칸만', () => {
  const ok = validateItem({ kreamUrl: 'kream.co.kr/products/1068133?size=m', size: 'm', salePrice: '299,000', costPrice: '', note: ' 새상품 ', imageUrl: '', status: 'on_sale' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { kreamUrl: 'https://kream.co.kr/products/1068133', size: 'M', title: null, note: '새상품', internalMemo: '', salePrice: 299000, costPrice: null, condition: null, channel: null, imageUrl: null, status: 'on_sale' });

  const bad = validateItem({ kreamUrl: 'https://musinsa.com/1', size: '', salePrice: '-1', imageUrl: 'http://x', status: 'sold' });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['imageUrl', 'kreamUrl', 'salePrice', 'size', 'status']);

  assert.deepEqual(validateItem({ salePrice: '' }, false).value, { salePrice: null });
  assert.equal(validateItem({ note: 'x'.repeat(301) }, false).ok, false);
});

test('구매 요청 검증 — 이름·휴대폰·동의만, 봇 함정', () => {
  assert.deepEqual(validateItemRequest({ name: ' 민지 ', phone: '010 1234 5678', memo: '', consent: true }), { ok: true, errors: {}, payload: { name: '민지', phone: '01012345678', memo: '', consent: true } });
  const bad = validateItemRequest({ name: '', phone: '02', consent: false });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['consent', 'name', 'phone']);
  assert.equal(bad.errors.consent, '개인정보 수집·이용에 동의해야 구매 요청을 보낼 수 있어요.');
  assert.equal(validateItemRequest({ name: 'a', phone: '01012345678', consent: true, website: 'x' }).spam, true);
});

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('테스트 모드 — 공개 목록에서 KREAM 원본·주소를 빼고, 구매 요청은 이 브라우저에 itemId 달린 신청으로', async () => {
  const store = createLocalStore(memStorage());
  const sample = [{ ...item, kreamUrl: 'https://kream.co.kr/products/1068133', kream: { name: 'Salomon Jacket' } }, { ...item, id: 'i2', status: 'reserved' }];
  const api = createLocalApi({ store, now: () => Date.parse('2026-10-14T00:00:00Z'), newId: () => 'abcd1234', loadItems: async () => sample });
  const list = await api.items();
  assert.equal(list.ok, true);
  assert.equal('kream' in list.data.items[0] || 'kreamUrl' in list.data.items[0], false);
  const r = await api.requestItem('i1', { name: '민지', phone: '01012345678', memo: '', consent: true });
  assert.deepEqual(r.data.id, 'abcd1234');
  const saved = store.list()[0];
  assert.deepEqual([saved.itemId, saved.size, saved.kreamProductId, saved.kream.name, saved.source], ['i1', 'M', '1068133', 'Salomon Jacket', 'demo']);
  assert.equal((await api.requestItem('i2', { name: '민지', phone: '01012345678', consent: true })).error.code, 'item_reserved');
});

test('공개 설명 → 칩(짧은 조각 2~5개일 때만, 아니면 글 그대로)', () => {
  assert.deepEqual(noteChips('새상품 · 택 있음 · 매장 구매'), ['새상품', '택 있음', '매장 구매']);
  assert.deepEqual(noteChips('새상품, 박스 있음'), ['새상품', '박스 있음']);
  assert.equal(noteChips('새상품'), null);
  assert.equal(noteChips('오프라인 매장에서 어제 직접 구매한 새상품 · 택'), null);
  assert.equal(noteChips(''), null);
});

test('상품 상태 · 구매처(4차 QA R-5) — 정해진 값만, 카드 칩 맨 앞, 칩으로 안 나뉜 설명은 글로', () => {
  const v = validateItem({ kreamUrl: 'kream.co.kr/products/1', size: 'M', condition: 'new', channel: 'store' });
  assert.deepEqual([v.value.condition, v.value.channel], ['new', 'store']);
  assert.deepEqual(Object.keys(validateItem({ condition: '정품', channel: 'kream' }, false).errors).sort(), ['channel', 'condition']);
  assert.deepEqual(validateItem({ condition: '' }, false).value, { condition: null });

  const a = itemCardModel({ ...item, condition: 'new', channel: 'store', note: '택 있음 · 박스 있음' });
  assert.deepEqual([a.noteChips, a.note], [['새상품', '매장 구매', '택 있음', '박스 있음'], '']);
  const b = itemCardModel({ ...item, condition: 'used', channel: null, note: '오른쪽 소매 끝에 아주 작은 얼룩이 있어요' });
  assert.deepEqual([b.noteChips, b.note], [['사용감 있음'], '오른쪽 소매 끝에 아주 작은 얼룩이 있어요']);
  const c = itemCardModel({ ...item, condition: null, channel: null, note: '' });
  assert.deepEqual([c.noteChips, c.note], [null, '']);
});
