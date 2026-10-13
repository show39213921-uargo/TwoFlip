import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../assets/js/api.js';

function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  fn.calls = calls;
  return fn;
}

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

test('엔드포인트가 비어 있으면 요청하지 않고 config 오류', async () => {
  const f = fakeFetch(() => json(200, {}));
  const api = createApiClient({ baseUrl: '', fetchImpl: f });
  const r = await api.submitApplication({ a: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'config');
  assert.equal(f.calls.length, 0);
});

test('신청 → POST {base}/applications, JSON 본문, 끝 슬래시 정리', async () => {
  const f = fakeFetch(() => json(201, { id: 'a1', status: 'received', receivedAt: '2026-10-13T00:00:00Z' }));
  const api = createApiClient({ baseUrl: 'https://api.example.com/v1/', fetchImpl: f });
  const r = await api.submitApplication({ size: '270' });
  assert.equal(r.ok, true);
  assert.equal(r.data.id, 'a1');
  assert.equal(f.calls[0].url, 'https://api.example.com/v1/applications');
  assert.equal(f.calls[0].init.method, 'POST');
  assert.equal(f.calls[0].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { size: '270' });
});

test('4xx/5xx → http 오류, 서버 메시지 전달', async () => {
  const f = fakeFetch(() => json(422, { error: { code: 'invalid', message: '사이즈 확인' } }));
  const api = createApiClient({ baseUrl: 'https://api.example.com', fetchImpl: f });
  const r = await api.submitApplication({});
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'http');
  assert.equal(r.error.status, 422);
  assert.equal(r.error.message, '사이즈 확인');
});

test('본문이 JSON 이 아니어도 죽지 않는다', async () => {
  const f = fakeFetch(() => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('x'); } }));
  const r = await createApiClient({ baseUrl: 'https://a', fetchImpl: f }).submitApplication({});
  assert.equal(r.error.kind, 'http');
  assert.equal(r.error.status, 502);
});

test('성공 응답인데 id 가 없으면 invalid_response — 저장됐다고 말하지 않는다', async () => {
  const f = fakeFetch(() => json(200, { status: 'received' }));
  const r = await createApiClient({ baseUrl: 'https://a', fetchImpl: f }).submitApplication({});
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'invalid_response');
});

test('네트워크 실패 → network 오류', async () => {
  const f = fakeFetch(() => { throw new TypeError('fetch failed'); });
  const r = await createApiClient({ baseUrl: 'https://a', fetchImpl: f }).submitApplication({});
  assert.equal(r.error.kind, 'network');
});

test('제한 시간을 넘기면 timeout 오류', async () => {
  const f = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  const r = await createApiClient({ baseUrl: 'https://a', fetchImpl: f, timeoutMs: 20 }).submitApplication({});
  assert.equal(r.error.kind, 'timeout');
});

test('미리보기 → GET {base}/kream/preview?url=…(인코딩), 결과 그대로', async () => {
  const f = fakeFetch(() => json(200, { productId: '1', product: { name: 'x' } }));
  const r = await createApiClient({ baseUrl: 'https://a/', fetchImpl: f }).preview('https://kream.co.kr/products/1?size=L');
  assert.equal(r.ok, true);
  assert.equal(r.data.product.name, 'x');
  assert.equal(f.calls[0].url, 'https://a/kream/preview?url=' + encodeURIComponent('https://kream.co.kr/products/1?size=L'));
  assert.equal(f.calls[0].init.method, 'GET');
});

test('미리보기 503(요청량 제한) → http 오류로, 서버 문구 전달', async () => {
  const f = fakeFetch(() => json(503, { error: { code: 'kream_busy', message: '지금은 KREAM 정보를 불러올 수 없습니다.' } }));
  const r = await createApiClient({ baseUrl: 'https://a', fetchImpl: f }).preview('kream.co.kr/products/1');
  assert.equal(r.ok, false);
  assert.equal(r.error.status, 503);
  assert.match(r.error.message, /KREAM/);
});

test('health → GET {base}/health', async () => {
  const f = fakeFetch(() => json(200, { ok: true }));
  const r = await createApiClient({ baseUrl: 'https://a/', fetchImpl: f }).health();
  assert.equal(r.ok, true);
  assert.equal(f.calls[0].url, 'https://a/health');
  assert.equal(f.calls[0].init.method, 'GET');
});
