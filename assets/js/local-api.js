// 테스트 모드용 API — 서버 대신 브라우저 저장소에 넣는다. createApiClient 와 같은 모양으로 답한다.
// KREAM 미리보기는 서버가 KREAM 을 읽어야 해서(브라우저는 CORS 로 못 읽는다) 테스트 모드에선 안내만 한다.

import { viewOfRecord, WRONG } from './status-view.js';

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

// 테스트 모드 최근 진행 사례 — 「[샘플]」 이 붙은 가짜 3건(찾음 둘 · 못 찾음 하나)
async function loadSampleCases() {
  const res = await fetch('assets/demo/sample-cases.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('샘플 사례를 불러오지 못했습니다.');
  return res.json();
}

// 진행 상황(4단계) 테스트 모드 — 확인 링크는 「접수번호.demo」, 샘플 접수번호 demo0001 · 뒤 4자리 0000(「찾았어요」 단계)
export const DEMO_STATUS_ID = 'demo0001';
const DEMO_STATUS_KEY = 'twoflip.demo.status';

export function createLocalApi({ store, now = Date.now, newId = randomId, loadItems = loadSampleItems, loadCases = loadSampleCases, session = globalThis.sessionStorage }) {
  // 샘플 한 건 — 이 탭에만(답은 sessionStorage). 연락은 2시간 전에 보낸 것으로, 답장 기한은 두지 않는다
  function demoRecord() {
    let reply = null;
    try { reply = JSON.parse(session.getItem(DEMO_STATUS_KEY) || 'null'); } catch { /* 처음 */ }
    return {
      id: DEMO_STATUS_ID, status: 'contacted', receivedAt: new Date(now() - 26 * 3600 * 1000).toISOString(), size: 'L', phone: '01000000000',
      kream: { nameKo: '[샘플] 살로몬 UNI 크로스 인슐레이션 자켓' }, sourcing: [{ stock: 'in' }],
      contact: { kind: 'found', at: new Date(now() - 2 * 3600 * 1000).toISOString() }, reply,
    };
  }
  function findRecord(id) {
    if (id === DEMO_STATUS_ID) return demoRecord();
    return store.list().find((r) => r && r.id === id) || null;
  }
  const toView = (r) => ({ ok: true, data: viewOfRecord(r) });
  const nope = (message = WRONG, status = 404) => ({ ok: false, error: { kind: 'http', status, code: 'not_found', message } });
  function byAuth(auth) {
    if (auth && auth.t) {
      const m = /^([0-9a-z]{1,16})\.demo$/.exec(String(auth.t));
      return m ? findRecord(m[1]) : null;
    }
    const r = auth ? findRecord(String(auth.id || '').trim().toLowerCase()) : null;
    const last4 = String((auth && auth.last4) || '').replace(/\D/g, '');
    return r && last4.length === 4 && String(r.phone || '').replace(/\D/g, '').slice(-4) === last4 ? r : null;
  }
  async function status(t) {
    const r = byAuth({ t });
    return r ? toView(r) : nope('링크를 다시 확인해 주세요. 접수번호와 번호 뒤 4자리로도 확인할 수 있어요.');
  }
  async function statusLookup(id, last4) {
    const r = byAuth({ id, last4 });
    return r ? toView(r) : nope();
  }
  async function statusReply(auth, answer) {
    const r = byAuth(auth);
    if (!r) return nope();
    if (viewOfRecord(r).stage !== 'found') return nope('지금은 답할 수 있는 단계가 아니에요.', 409);
    const reply = { answer, at: new Date(now()).toISOString() };
    try {
      if (r.id === DEMO_STATUS_ID) session.setItem(DEMO_STATUS_KEY, JSON.stringify(reply));
      else store.update(r.id, { reply });
    } catch (e) { return { ok: false, error: { kind: 'storage', message: e.message } }; }
    return toView({ ...r, reply });
  }

  async function cases() {
    try {
      const list = await loadCases();
      return { ok: true, data: { cases: Array.isArray(list) ? list : [] } };
    } catch (e) {
      return { ok: false, error: { kind: 'demo', message: e.message } };
    }
  }

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
    return { ok: true, data: { id: record.id, status: record.status, receivedAt: record.receivedAt, statusToken: `${record.id}.demo` } };
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

  return { submitApplication, preview, health, items, requestItem, cases, status, statusLookup, statusReply };
}
