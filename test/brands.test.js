import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBrand, brandLinks, findPrefill } from '../assets/js/brands.js';

test('찾아보기 미리 채움(3단계 B1) — 공식몰 = 「브랜드 공식몰」 · 원화, 매장은 이름 비움, 해외 = 「사이트 (나라)」 · 나라 통화', () => {
  assert.deepEqual(findPrefill('official', { brand: 'Salomon' }), { type: 'official', name: '살로몬 공식몰', currency: 'KRW' });
  assert.deepEqual(findPrefill('official', { brand: 'Unknown Label' }), { type: 'official', name: 'Unknown Label 공식몰', currency: 'KRW' });
  assert.deepEqual(findPrefill('official', { brand: '' }), { type: 'official', name: '', currency: 'KRW' });
  assert.deepEqual(findPrefill('offline', { brand: 'Nike' }), { type: 'offline', name: '', currency: 'KRW' });
  const us = brandLinks({ brand: 'Salomon', modelNo: 'LD0274200' }).overseas[0];
  assert.deepEqual(findPrefill('overseas', { brand: 'Salomon', overseas: us }), { type: 'overseas', name: 'salomon.com (US)', currency: 'USD' });
  const ca = brandLinks({ brand: "Arc'teryx", modelNo: 'X0001' }).overseas[0];
  assert.equal(findPrefill('overseas', { overseas: ca }).currency, null, '모르는 나라 통화는 건드리지 않는다');
  assert.equal(findPrefill('overseas', {}), null);
});

test('브랜드 찾기 — 대소문자·한글·조던=나이키', () => {
  assert.equal(findBrand('Salomon').key, 'salomon');
  assert.equal(findBrand('JORDAN').key, 'nike');
  assert.equal(findBrand('뉴발란스').key, 'newbalance');
  assert.equal(findBrand("Arc'teryx").key, 'arcteryx');
  assert.equal(findBrand('Unknown Label'), null);
  assert.equal(findBrand(null), null);
});

test('알려진 브랜드 — 공식 홈페이지 + 모델번호 사이트 검색 + 네이버 쇼핑', () => {
  const l = brandLinks({ brand: 'Salomon', modelNo: 'LD0274200', area: '강남' });
  assert.equal(l.known, true);
  assert.equal(l.brandKo, '살로몬');
  assert.deepEqual(l.official[0], { label: '살로몬 공식 홈페이지', url: 'https://salomon.co.kr/' });
  assert.equal(l.official[1].url, 'https://www.google.com/search?q=' + encodeURIComponent('"LD0274200" site:salomon.co.kr'));
  assert.equal(l.official[2].url, 'https://search.shopping.naver.com/search/all?query=LD0274200');
});

test('오프라인 — 지역+브랜드 지도 검색(네이버·카카오), 매장 찾기는 확인된 브랜드만', () => {
  const s = brandLinks({ brand: 'Salomon', modelNo: 'LD0274200', area: '강남' });
  assert.deepEqual(s.offline.map((x) => x.url), [
    'https://map.naver.com/p/search/' + encodeURIComponent('강남 살로몬 매장'),
    'https://map.kakao.com/?q=' + encodeURIComponent('강남 살로몬 매장'),
  ]);
  const n = brandLinks({ brand: 'Nike', modelNo: 'DD1391-100', area: '' });
  assert.equal(n.offline[0].url, 'https://map.naver.com/p/search/' + encodeURIComponent('나이키 매장'));
  assert.ok(n.offline.some((x) => x.url === 'https://www.nike.com/kr/retail'));
});

test('해외 — 나라별 공식몰에서 모델번호 검색', () => {
  const n = brandLinks({ brand: 'Nike', modelNo: 'DD1391-100' });
  assert.deepEqual(n.overseas.map((x) => x.country), ['US', 'JP']);
  assert.equal(n.overseas[1].url, 'https://www.google.com/search?q=' + encodeURIComponent('"DD1391-100" site:nike.com/jp'));
});

test('모르는 브랜드 — 지어내지 않고 일반 검색으로', () => {
  const l = brandLinks({ brand: 'Some Label', modelNo: 'AB1234567', area: '홍대' });
  assert.equal(l.known, false);
  assert.equal(l.official[0].url, 'https://www.google.com/search?q=' + encodeURIComponent('Some Label 공식 홈페이지'));
  assert.equal(l.offline[0].url, 'https://map.naver.com/p/search/' + encodeURIComponent('홍대 Some Label 매장'));
  assert.deepEqual(l.overseas, []);
});

test('모델번호가 없으면 상품명으로 검색', () => {
  const l = brandLinks({ brand: 'Salomon', modelNo: null, name: 'Cross Jacket' });
  assert.equal(l.official[1].url, 'https://www.google.com/search?q=' + encodeURIComponent('"Cross Jacket" site:salomon.co.kr'));
});
