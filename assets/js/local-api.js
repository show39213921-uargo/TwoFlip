// 테스트 모드용 API — 서버 대신 브라우저 저장소에 넣는다. createApiClient 와 같은 모양으로 답한다.
// KREAM 미리보기는 서버가 KREAM 을 읽어야 해서(브라우저는 CORS 로 못 읽는다) 테스트 모드에선 안내만 한다.

const randomId = () => {
  const a = new Uint8Array(4);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
};

// 테스트 모드 바로 구매 목록 — 샘플 파일(실제 KREAM 스냅샷 + 가상 판매가)
async function loadSampleItems() {
  const res = await fetch('assets/demo/sample-items.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('샘플 상품을 불러오지 못했습니다.');
  return res.json();
}

export function createLocalApi({ store, now = Date.now, newId = randomId, loadItems = loadSampleItems }) {
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

  async function items() {
    try {
      const list = await loadItems();
      return { ok: true, data: { items: (Array.isArray(list) ? list : []).map(({ kream, kreamUrl, ...pub }) => pub) } };
    } catch (e) {
      return { ok: false, error: { kind: 'demo', message: e.message } };
    }
  }

  // 구매 요청 → 이 브라우저에 신청 한 건(itemId 달림) — 관리자 「이 브라우저」 에서 「바로 구매」 표시로 보인다
  async function requestItem(id, payload) {
    let item;
    try { item = (await loadItems()).find((x) => x.id === id); } catch { item = null; }
    if (!item || item.status !== 'on_sale') return { ok: false, error: { kind: 'http', status: 409, code: 'item_reserved', message: '예약 중인 상품이라 지금은 요청할 수 없습니다.' } };
    const record = {
      id: newId(),
      status: 'received',
      receivedAt: new Date(now()).toISOString(),
      kreamUrl: item.kreamUrl,
      kreamProductId: String(item.kreamUrl || '').split('/').pop(),
      size: item.size,
      name: payload.name,
      phone: payload.phone,
      memo: payload.memo || '',
      consent: true,
      kream: item.kream || null,
      sourcing: [],
      itemId: item.id,
      source: 'demo',
    };
    try {
      store.create(record);
    } catch (e) {
      return { ok: false, error: { kind: 'storage', message: e.message } };
    }
    return { ok: true, data: { id: record.id, status: record.status, receivedAt: record.receivedAt } };
  }

  return { submitApplication, preview, health, items, requestItem };
}
