import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKreamUrl } from '../assets/js/kream-url.js';

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
