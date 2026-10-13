import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMode } from '../assets/js/mode.js';

const prod = { hostname: 'twoflip.u-argo.com', search: '', sessionFlag: null, apiBaseUrl: '' };

test('운영 · API 미설정 → closed(준비 중)', () => {
  assert.deepEqual(resolveMode(prod), { mode: 'closed', demo: false, demoFlag: null });
});

test('운영 · API 설정 → api', () => {
  assert.equal(resolveMode({ ...prod, apiBaseUrl: 'https://api.x' }).mode, 'api');
});

test('?demo=1 → demo, 세션에 기억(1) / ?demo=0 → 해제(0)', () => {
  assert.deepEqual(resolveMode({ ...prod, search: '?demo=1' }), { mode: 'demo', demo: true, demoFlag: '1' });
  assert.deepEqual(resolveMode({ ...prod, search: '?demo=0', sessionFlag: '1' }), { mode: 'closed', demo: false, demoFlag: '0' });
});

test('세션에 남은 데모 표시는 주소에 없어도 이어진다', () => {
  assert.equal(resolveMode({ ...prod, sessionFlag: '1' }).mode, 'demo');
});

test('데모는 API 설정보다 우선 — 서버가 있어도 화면만 따로 시험할 수 있다', () => {
  assert.equal(resolveMode({ ...prod, apiBaseUrl: 'https://api.x', search: '?demo=1' }).mode, 'demo');
});

test('demo 값이 1·0 이 아니면 무시', () => {
  assert.deepEqual(resolveMode({ ...prod, search: '?demo=yes' }), { mode: 'closed', demo: false, demoFlag: null });
});
