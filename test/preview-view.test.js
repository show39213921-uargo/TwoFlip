import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPreviewModel, formatWon } from '../assets/js/preview-view.js';

const data = {
  productId: '1068133',
  url: 'https://kream.co.kr/products/1068133',
  checkedAt: '2026-10-13T00:00:00Z', ageMin: 0, cached: false, stale: false,
  product: {
    name: 'Salomon UNI Cross Insulation Jacket Light Grey',
    nameKo: '살로몬 UNI 크로스 인슐레이션 자켓 라이트 그레이',
    brand: 'Salomon', modelNo: 'LD0274200',
    image: 'https://kream-phinf.pstatic.net/a.png',
    buyNowPrice: 320000,
    sizes: [
      { size: 'M', recentPrice: 338000, recentAgo: '1시간 전', lowestAsk: null, highestBid: null },
      { size: 'XL', recentPrice: null, recentAgo: null, lowestAsk: 320000, highestBid: null },
      { size: 'XXL', recentPrice: null, recentAgo: null, lowestAsk: null, highestBid: 356000 },
    ],
  },
};

test('원 표기', () => {
  assert.equal(formatWon(320000), '320,000원');
  assert.equal(formatWon(null), null);
  assert.equal(formatWon(NaN), null);
});

test('제목은 한글 이름 우선, 영문은 부제', () => {
  const m = buildPreviewModel(data);
  assert.equal(m.title, '살로몬 UNI 크로스 인슐레이션 자켓 라이트 그레이');
  assert.equal(m.subtitle, 'Salomon UNI Cross Insulation Jacket Light Grey');
  assert.equal(m.brand, 'Salomon');
  assert.equal(m.modelNo, 'LD0274200');
  assert.equal(m.buyNow, '320,000원');
  assert.equal(m.image, 'https://kream-phinf.pstatic.net/a.png');
});

test('사이즈 칩 — 최근 체결 → 판매입찰 → 구매입찰 순으로 무엇의 값인지 같이', () => {
  const [m, xl, xxl] = buildPreviewModel(data).sizes;
  assert.deepEqual(m, { size: 'M', price: '338,000원', basis: '최근 거래' });
  assert.deepEqual(xl, { size: 'XL', price: '320,000원', basis: '판매 입찰' });
  assert.deepEqual(xxl, { size: 'XXL', price: '356,000원', basis: '구매 입찰' });
});

test('확인 시각 문구 — 방금 / n분 전 / 이전 조회값', () => {
  assert.equal(buildPreviewModel(data).note, 'KREAM 기준 · 방금 확인');
  assert.equal(buildPreviewModel({ ...data, ageMin: 12, cached: true }).note, 'KREAM 기준 · 12분 전 확인');
  assert.equal(buildPreviewModel({ ...data, ageMin: 90, cached: true, stale: true }).note, 'KREAM 기준 · 90분 전 확인(지금은 새로 못 불러옴)');
});

test('한글 이름이 없으면 영문이 제목, 부제 없음 · https 아닌 이미지는 버린다', () => {
  const m = buildPreviewModel({ ...data, product: { ...data.product, nameKo: null, image: 'http://x/a.png' } });
  assert.equal(m.title, 'Salomon UNI Cross Insulation Jacket Light Grey');
  assert.equal(m.subtitle, null);
  assert.equal(m.image, null);
});

test('product 가 없으면 null', () => {
  assert.equal(buildPreviewModel({}), null);
  assert.equal(buildPreviewModel(null), null);
});
