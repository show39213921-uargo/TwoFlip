import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkCheckText, QUICK_SIZES, showQuickSizes, readClipboardText, PASTE_NOTES, rovingIndex } from '../assets/js/link-check.js';

test('링크 확인 칩 — 상품 번호만, 주소에서 넣은 사이즈가 있으면 붙인다', () => {
  assert.equal(linkCheckText('1068133', null), 'KREAM 상품 1068133 확인했어요');
  assert.equal(linkCheckText('1068133', '270'), 'KREAM 상품 1068133 확인했어요 · 사이즈 270');
  assert.equal(linkCheckText('', '270'), '');
});

test('사이즈 빠른 선택 — 지시서 순서 그대로, 칸막이 셋 무리', () => {
  assert.deepEqual(QUICK_SIZES.flat(), ['230', '240', '250', '260', '270', '280', 'S', 'M', 'L', 'XL', 'FREE']);
  assert.equal(QUICK_SIZES.length, 3);
});

test('사이즈 빠른 선택은 링크가 맞고 주소에 사이즈가 없고 시세 칩이 없을 때만', () => {
  assert.equal(showQuickSizes({ linkOk: true, linkSize: null, priceChips: false }), true);
  assert.equal(showQuickSizes({ linkOk: false, linkSize: null, priceChips: false }), false);
  assert.equal(showQuickSizes({ linkOk: true, linkSize: '270', priceChips: false }), false);
  assert.equal(showQuickSizes({ linkOk: true, linkSize: null, priceChips: true }), false);
});

test('클립보드 읽기 — 없음 · 거절 · 빈 글 · 성공, 던지지 않는다', async () => {
  assert.deepEqual(await readClipboardText(undefined), { ok: false, reason: 'unsupported' });
  assert.deepEqual(await readClipboardText({}), { ok: false, reason: 'unsupported' });
  assert.deepEqual(await readClipboardText({ readText: async () => { throw new Error('NotAllowedError'); } }), { ok: false, reason: 'denied' });
  assert.deepEqual(await readClipboardText({ readText: async () => '  \n ' }), { ok: false, reason: 'empty' });
  assert.deepEqual(await readClipboardText({ readText: async () => '[KREAM] https://kream.co.kr/products/1?size=270' }), { ok: true, text: '[KREAM] https://kream.co.kr/products/1?size=270' });
});

test('사이즈 칩 줄 화살표 이동 — 좌우·상하 · 처음/끝 · 돌기 · 다른 키는 그대로(11차 QA U-1)', () => {
  assert.equal(rovingIndex(0, 'ArrowRight', 11), 1);
  assert.equal(rovingIndex(10, 'ArrowRight', 11), 0, '끝에서 처음으로');
  assert.equal(rovingIndex(0, 'ArrowLeft', 11), 10, '처음에서 끝으로');
  assert.equal(rovingIndex(4, 'ArrowDown', 11), 5);
  assert.equal(rovingIndex(4, 'ArrowUp', 11), 3);
  assert.equal(rovingIndex(4, 'Home', 11), 0);
  assert.equal(rovingIndex(4, 'End', 11), 10);
  assert.equal(rovingIndex(-1, 'ArrowRight', 11), 1, '고른 칩이 없으면 첫 칩 기준');
  assert.equal(rovingIndex(4, 'Tab', 11), null);
  assert.equal(rovingIndex(4, ' ', 11), null, '스페이스는 버튼 기본 동작(고르기)');
  assert.equal(rovingIndex(0, 'ArrowRight', 0), null);
});

test('붙여넣기 안내는 해요체, 막히면 길게 눌러 붙여넣기', () => {
  assert.equal(PASTE_NOTES.denied, '칸을 길게 눌러 붙여넣어 주세요.');
  for (const v of Object.values(PASTE_NOTES)) assert.doesNotMatch(v, /습니다/);
});
