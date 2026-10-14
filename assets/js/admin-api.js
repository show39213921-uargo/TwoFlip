// 관리자 API 클라이언트 — 운영자 개인 접속 키(X-TwoFlip-Key 헤더)로 백엔드(twoflip_backend Admin\Api)를 부른다.
// 키는 주소(쿼리)에 절대 넣지 않는다 — 서버 로그·브라우저 기록에 남는다.
// 응답 모양은 api.js 와 같다: { ok, data } | { ok:false, error:{ kind, status?, code?, message, fields? } }. 401 은 kind 'auth'.

import { createRequester } from './api.js';

const KEY_RE = /^tf_[0-9a-f]{32}$/;
export const looksLikeKey = (k) => KEY_RE.test(String(k ?? '').trim());

export function createAdminClient({ baseUrl, key, fetchImpl = globalThis.fetch, timeoutMs } = {}) {
  const k = String(key ?? '').trim();
  const request = createRequester({ baseUrl, fetchImpl, timeoutMs, extraHeaders: { 'X-TwoFlip-Key': k } });
  const enc = encodeURIComponent;

  async function call(method, path, body) {
    if (!KEY_RE.test(k)) return { ok: false, error: { kind: 'auth', message: '접속 키 모양이 아닙니다(tf_ 로 시작하는 35자).' } };
    const r = await request(method, path, body);
    if (!r.ok && r.error.status === 401) r.error.kind = 'auth';
    return r;
  }

  return {
    me: () => call('GET', '/admin/me'),
    list: () => call('GET', '/admin/applications'),
    patchApplication: (id, patch) => call('PATCH', `/admin/applications/${enc(id)}`, patch),
    deleteApplication: (id) => call('DELETE', `/admin/applications/${enc(id)}`),
    history: (id) => call('GET', `/admin/applications/${enc(id)}/history`),
    addCheck: (id, value) => call('POST', `/admin/applications/${enc(id)}/stock-checks`, value),
    patchCheck: (checkId, patch) => call('PATCH', `/admin/stock-checks/${enc(checkId)}`, patch),
    touchCheck: (checkId) => call('PATCH', `/admin/stock-checks/${enc(checkId)}`, { touch: true }),
    deleteCheck: (checkId) => call('DELETE', `/admin/stock-checks/${enc(checkId)}`),
    getSettings: () => call('GET', '/admin/settings'),
    putSettings: (s) => call('PUT', '/admin/settings', s),
  };
}
