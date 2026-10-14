import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKreamUrl, extractKreamUrl } from '../assets/js/kream-url.js';

test('정상 상품 URL → 상품번호와 정규 주소', () => {
  const r = parseKreamUrl('https://kream.co.kr/products/1068133');
  assert.deepEqual(r, { ok: true, productId: '1068133', url: 'https://kream.co.kr/products/1068133' });
});

test('www·쿼리·해시·끝 슬래시는 버리고 같은 정규 주소로', () => {
  for (const input of [
    'https://www.kream.co.kr/products/1068133',
    'https://kream.co.kr/products/1068133/',
    'https://kream.co.kr/products/1068133?size=270',
    'https://kream.co.kr/products/1068133#trades',
    'http://KREAM.co.kr/products/1068133',
  ]) {
    const r = parseKreamUrl(input);
    assert.equal(r.ok, true, input);
    assert.equal(r.url, 'https://kream.co.kr/products/1068133', input);
  }
});

test('스킴 없이 붙여 넣어도 받는다', () => {
  assert.equal(parseKreamUrl('  kream.co.kr/products/42  ').productId, '42');
});

test('빈 값·KREAM 아닌 주소·상품 아닌 페이지는 이유와 함께 거절', () => {
  assert.deepEqual(parseKreamUrl(''), { ok: false, reason: 'empty' });
  assert.deepEqual(parseKreamUrl(null), { ok: false, reason: 'empty' });
  assert.equal(parseKreamUrl('https://www.musinsa.com/products/1').reason, 'not_kream');
  assert.equal(parseKreamUrl('https://kream.co.kr.evil.com/products/1').reason, 'not_kream');
  assert.equal(parseKreamUrl('https://kream.co.kr/search?keyword=dunk').reason, 'not_product');
  assert.equal(parseKreamUrl('https://kream.co.kr/products/abc').reason, 'not_product');
  assert.equal(parseKreamUrl('https://kream.co.kr/products/1/reviews').reason, 'not_product');
});

test('URL 로 해석이 안 되는 문자열은 invalid', () => {
  assert.equal(parseKreamUrl('http://').reason, 'invalid');
});

test('붙여 넣은 글에서 KREAM 주소 하나 찾기(U-1) · ?size= 는 사이즈로(U-2)', () => {
  assert.deepEqual(extractKreamUrl('[KREAM] 살로몬 자켓 https://kream.co.kr/products/1068133'), { productId: '1068133', url: 'https://kream.co.kr/products/1068133', size: null });
  assert.deepEqual(extractKreamUrl('https://kream.co.kr/products/1068133?size=270'), { productId: '1068133', url: 'https://kream.co.kr/products/1068133', size: '270' });
  assert.equal(extractKreamUrl('보세요 kream.co.kr/products/42?size=l 이거').size, 'L');
  assert.equal(extractKreamUrl('(https://www.kream.co.kr/products/7)').url, 'https://kream.co.kr/products/7');
  assert.equal(extractKreamUrl('kream.co.kr/products/7 그리고 kream.co.kr/products/7?size=M').size, null, '같은 상품 두 번이면 첫 번째');
});

test('주소 찾기 — 못 찾거나 고르지 않는 경우(기존 검증 유지)', () => {
  assert.equal(extractKreamUrl(''), null);
  assert.equal(extractKreamUrl('https://www.musinsa.com/products/1068133'), null);
  assert.equal(extractKreamUrl('https://kream.co.kr/search?keyword=nike'), null);
  assert.equal(extractKreamUrl('https://kream.co.kr.evil.com/products/1068133'), null);
  assert.equal(extractKreamUrl('https://evil.com/kream.co.kr/products/1068133'), null);
  assert.equal(extractKreamUrl('https://evil.com/?r=kream.co.kr/products/1068133'), null);
  assert.equal(extractKreamUrl('https://kream.co.kr/products/1 https://kream.co.kr/products/2'), null, '상품이 둘이면 고르지 않음');
  assert.equal(extractKreamUrl('kream.co.kr/products/12abc'), null);
});
