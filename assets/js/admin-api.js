// 관리자 API 클라이언트 — 로그인으로 받은 세션 키(X-TwoFlip-Key 헤더)로 백엔드(twoflip_backend Admin\Api)를 부른다.
// 키는 주소(쿼리)에 절대 넣지 않는다 — 서버 로그·브라우저 기록에 남는다.
// 응답 모양은 api.js 와 같다: { ok, data } | { ok:false, error:{ kind, status?, code?, message, fields? } }. 401 은 kind 'auth'.

import { createRequester } from './api.js';

const KEY_RE = /^tf_[0-9a-f]{32}$/;
export const looksLikeKey = (k) => KEY_RE.test(String(k ?? '').trim());

// 로그인 페이지 — 아이디·비밀번호 → 세션 키(이후 모든 요청의 X-TwoFlip-Key). 「기억」이면 서버가 30일, 아니면 12시간짜리를 준다.
export async function loginAdmin({ baseUrl, loginId, password, remember = false, fetchImpl = globalThis.fetch, timeoutMs } = {}) {
  const id = String(loginId ?? '').trim();
  const pw = String(password ?? '');
  if (!id || !pw) return { ok: false, error: { kind: 'input', message: '아이디와 비밀번호를 넣어 주세요.' } };
  const r = await createRequester({ baseUrl, fetchImpl, timeoutMs })('POST', '/admin/login', { loginId: id, password: pw, remember: !!remember });
  if (r.ok && !(r.data && looksLikeKey(r.data.token))) return { ok: false, error: { kind: 'invalid_response', message: '로그인 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.' } };
  return r;
}

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
    logout: () => call('POST', '/admin/logout', {}),
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
