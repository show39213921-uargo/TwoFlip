import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStore } from '../assets/js/local-store.js';
import { createLocalApi } from '../assets/js/local-api.js';

function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    dump: (k) => m.get(k),
  };
}

test('비어 있으면 빈 목록 → 추가·수정·삭제·전체 비우기', () => {
  const s = createLocalStore(fakeStorage(), 'k');
  assert.deepEqual(s.list(), []);
  s.create({ id: 'a', status: 'received' });
  s.create({ id: 'b', status: 'received' });
  s.update('a', { status: 'sourcing' });
  assert.equal(s.list().find((r) => r.id === 'a').status, 'sourcing');
  s.remove('b');
  assert.deepEqual(s.list().map((r) => r.id), ['a']);
  s.clear();
  assert.deepEqual(s.list(), []);
});

test('replaceAll 은 id 없는 행을 버린다', () => {
  const s = createLocalStore(fakeStorage(), 'k');
  s.replaceAll([{ id: 'x' }, { nope: 1 }, null]);
  assert.deepEqual(s.list(), [{ id: 'x' }]);
});

test('저장값이 깨져 있으면 덮어쓰지 않고 오류 — 초기화는 사람이 고른다', () => {
  const st = fakeStorage({ k: '{깨짐' });
  const s = createLocalStore(st, 'k');
  assert.equal(s.isCorrupt(), true);
  assert.deepEqual(s.list(), []);
  assert.throws(() => s.create({ id: 'a' }), /깨져/);
  assert.equal(st.dump('k'), '{깨짐');
  s.clear();
  assert.equal(s.isCorrupt(), false);
});

test('저장소를 못 쓰는 브라우저(사생활 모드 등)는 이유를 담아 실패', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
  const s = createLocalStore(broken, 'k');
  assert.deepEqual(s.list(), []);
  assert.throws(() => s.create({ id: 'a' }), /저장소/);
});

test('데모 신청 → 브라우저 저장, 서버와 같은 응답 모양', async () => {
  const store = createLocalStore(fakeStorage(), 'k');
  const api = createLocalApi({ store, now: () => Date.parse('2026-10-13T08:00:00Z'), newId: () => 'demo0001' });
  const r = await api.submitApplication({ kreamUrl: 'https://kream.co.kr/products/1', kreamProductId: '1', size: 'L', name: '가', phone: '01000000000', memo: '', consent: true });
  assert.deepEqual(r, { ok: true, data: { id: 'demo0001', status: 'received', receivedAt: '2026-10-13T08:00:00.000Z', statusToken: 'demo0001.demo' } }); // 4단계 — 서버처럼 확인 링크 토큰
  const saved = store.list()[0];
  assert.equal(saved.source, 'demo');
  assert.equal(saved.kream, null);
  assert.equal(saved.size, 'L');
});

test('데모 미리보기는 서버가 없어 안내만', async () => {
  const api = createLocalApi({ store: createLocalStore(fakeStorage(), 'k') });
  const r = await api.preview('https://kream.co.kr/products/1');
  assert.equal(r.ok, false);
  assert.match(r.error.message, /테스트 모드/);
});

test('데모 저장 실패는 신청 실패로 보인다(접수됐다고 말하지 않는다)', async () => {
  const api = createLocalApi({ store: createLocalStore(fakeStorage({ k: '{깨짐' }), 'k') });
  const r = await api.submitApplication({ size: 'L' });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /깨져/);
});
