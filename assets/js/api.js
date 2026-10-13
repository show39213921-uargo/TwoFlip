// 신청 API 클라이언트. 페이지는 DB 를 모른다 — 엔드포인트에 JSON 을 보내고, 저장은 API 쪽이 DB 에 연결해 한다.
// 계약은 docs/api-contract.md. 결과는 던지지 않고 { ok, data } | { ok:false, error:{ kind, status?, message } } 로 돌려준다.
//
// kind: config(엔드포인트 미설정) · network · timeout · http(4xx/5xx) · invalid_response(성공인데 id 없음)
// 성공 응답에 id 가 없으면 「접수됐다」고 말하지 않는다 — 저장 여부를 모르는 채 고객에게 완료를 보이면 안 된다.

const DEFAULT_TIMEOUT_MS = 10000;

export function createApiClient({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const base = String(baseUrl || '').replace(/\/+$/, '');

  async function request(method, path, body) {
    if (!base) return fail('config', '신청 서버 주소가 아직 설정되지 않았습니다.');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(base + path, {
        method,
        headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') return fail('timeout', '서버 응답이 늦습니다. 잠시 후 다시 시도해 주세요.');
      return fail('network', '서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.');
    } finally {
      clearTimeout(timer);
    }

    let data = null;
    try { data = await res.json(); } catch { data = null; }

    if (!res.ok) {
      const msg = data && data.error && data.error.message;
      return fail('http', msg || `요청이 처리되지 않았습니다. (HTTP ${res.status})`, res.status);
    }
    return { ok: true, data };
  }

  async function submitApplication(payload) {
    const r = await request('POST', '/applications', payload);
    if (r.ok && !(r.data && r.data.id)) return fail('invalid_response', '접수 확인 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return r;
  }

  // KREAM 상품 미리보기 — 실패해도 신청은 막지 않는다(화면이 안내만 한다).
  function preview(kreamUrl) {
    return request('GET', '/kream/preview?url=' + encodeURIComponent(String(kreamUrl || '')));
  }

  function health() {
    return request('GET', '/health');
  }

  return { submitApplication, preview, health };
}

function fail(kind, message, status) {
  const error = { kind, message };
  if (status !== undefined) error.status = status;
  return { ok: false, error };
}
