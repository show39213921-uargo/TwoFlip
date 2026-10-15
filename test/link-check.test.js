import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkCheckText, QUICK_SIZES, showQuickSizes, readClipboardText, PASTE_NOTES } from '../assets/js/link-check.js';

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

test('붙여넣기 안내는 해요체, 막히면 길게 눌러 붙여넣기', () => {
  assert.equal(PASTE_NOTES.denied, '칸을 길게 눌러 붙여넣어 주세요.');
  for (const v of Object.values(PASTE_NOTES)) assert.doesNotMatch(v, /습니다/);
});
