// 테스트 모드용 API — 서버 대신 브라우저 저장소에 넣는다. createApiClient 와 같은 모양으로 답한다.
// KREAM 미리보기는 서버가 KREAM 을 읽어야 해서(브라우저는 CORS 로 못 읽는다) 테스트 모드에선 안내만 한다.

const randomId = () => {
  const a = new Uint8Array(4);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
};

export function createLocalApi({ store, now = Date.now, newId = randomId }) {
  async function submitApplication(payload) {
    const record = {
      id: newId(),
      status: 'received',
      receivedAt: new Date(now()).toISOString(),
      ...payload,
      kream: null,
      sourcing: [],
      source: 'demo',
    };
    try {
      store.create(record);
    } catch (e) {
      return { ok: false, error: { kind: 'storage', message: e.message } };
    }
    return { ok: true, data: { id: record.id, status: record.status, receivedAt: record.receivedAt } };
  }

  async function preview() {
    return { ok: false, error: { kind: 'demo', message: '테스트 모드에서는 KREAM 상품 정보를 불러오지 않습니다(서버 연결 후 표시).' } };
  }

  async function health() {
    return { ok: true, data: { ok: true, demo: true } };
  }

  return { submitApplication, preview, health };
}
