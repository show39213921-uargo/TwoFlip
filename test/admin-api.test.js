import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminClient, looksLikeKey } from '../assets/js/admin-api.js';

function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init }); return handler(url, init); };
  fn.calls = calls;
  return fn;
}
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const KEY = 'tf_0123456789abcdef0123456789abcdef';

test('접속 키 모양 — tf_ + 32자리 16진수(앞뒤 공백 허용)', () => {
  assert.equal(looksLikeKey(KEY), true);
  assert.equal(looksLikeKey('  ' + KEY + ' '), true);
  assert.equal(looksLikeKey('tf_xyz'), false);
  assert.equal(looksLikeKey(''), false);
});

test('모든 요청에 X-TwoFlip-Key 헤더, 키는 주소에 넣지 않는다', async () => {
  const f = fakeFetch(() => json(200, { member: { id: 1, name: '재영' } }));
  const api = createAdminClient({ baseUrl: 'https://a/index.php/', key: ' ' + KEY + ' ', fetchImpl: f });
  const r = await api.me();
  assert.equal(r.ok, true);
  assert.equal(f.calls[0].url, 'https://a/index.php/admin/me');
  assert.equal(f.calls[0].init.headers['X-TwoFlip-Key'], KEY);
  assert.ok(!f.calls[0].url.includes(KEY));
});

test('경로·메서드 — 목록·상태·재고 확인·설정', async () => {
  const f = fakeFetch(() => json(200, {}));
  const api = createAdminClient({ baseUrl: 'https://a', key: KEY, fetchImpl: f });
  await api.list();
  await api.patchApplication('ab12', { status: 'sourcing' });
  await api.deleteApplication('ab12');
  await api.history('ab12');
  await api.addCheck('ab12', { type: 'offline' });
  await api.patchCheck('7', { stock: 'out' });
  await api.touchCheck('7');
  await api.deleteCheck('7');
  await api.getSettings();
  await api.putSettings({ area: '강남' });
  assert.deepEqual(f.calls.map((c) => `${c.init.method} ${c.url.replace('https://a', '')}`), [
    'GET /admin/applications',
    'PATCH /admin/applications/ab12',
    'DELETE /admin/applications/ab12',
    'GET /admin/applications/ab12/history',
    'POST /admin/applications/ab12/stock-checks',
    'PATCH /admin/stock-checks/7',
    'PATCH /admin/stock-checks/7',
    'DELETE /admin/stock-checks/7',
    'GET /admin/settings',
    'PUT /admin/settings',
  ]);
  assert.deepEqual(JSON.parse(f.calls[6].init.body), { touch: true });
});

test('id 는 주소에 넣기 전에 인코딩(경로 조작 방지)', async () => {
  const f = fakeFetch(() => json(200, {}));
  await createAdminClient({ baseUrl: 'https://a', key: KEY, fetchImpl: f }).patchApplication('../x', { status: 'paid' });
  assert.equal(f.calls[0].url, 'https://a/admin/applications/..%2Fx');
});

test('401 → auth 오류로(다시 로그인), 422 → 칸별 사유 전달', async () => {
  const f = fakeFetch((url) => (url.endsWith('/me')
    ? json(401, { error: { code: 'unauthorized', message: '관리자 키가 없거나 맞지 않습니다.' } })
    : json(422, { error: { code: 'invalid', message: '종류를 골라 주세요.', fields: { type: '종류를 골라 주세요.' } } })));
  const api = createAdminClient({ baseUrl: 'https://a', key: KEY, fetchImpl: f });
  const me = await api.me();
  assert.equal(me.ok, false);
  assert.equal(me.error.kind, 'auth');
  const add = await api.addCheck('a1', {});
  assert.equal(add.error.status, 422);
  assert.deepEqual(add.error.fields, { type: '종류를 골라 주세요.' });
});

test('키 모양이 틀리면 요청하지 않고 auth 오류', async () => {
  const f = fakeFetch(() => json(200, {}));
  const r = await createAdminClient({ baseUrl: 'https://a', key: 'nope', fetchImpl: f }).me();
  assert.equal(r.error.kind, 'auth');
  assert.equal(f.calls.length, 0);
});
