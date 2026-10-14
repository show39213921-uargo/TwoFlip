// 관리자(임시) — 데이터 출처 세 가지:
//   서버       : 백엔드 DB(twoflip_backend 관리자 API). 아이디·비밀번호로 로그인(세션 키) — 3명이 같은 데이터를 본다
//   이 브라우저: 테스트 모드(?demo=1) 신청 · 샘플 — 이 브라우저에만
//   JSON 파일  : 직접 연 파일(예전 서버 JSON 저장분 등) — 바꾸면 「JSON 내보내기」로 저장
// 모든 변경은 ops 를 거친다 — 브라우저·파일은 그 자리에서, 서버는 API 로 보내고 돌아온 신청으로 바꿔 끼운다.
// 계산·표시 값은 순수 모듈(admin-view · brands · sourcing · stock)에서 오고, 여기는 DOM 만 다룬다.
// 신청자·KREAM·판매처 문자열은 전부 textContent 로 넣는다(HTML 로 해석하지 않는다).

import { CONFIG } from './config.js';
import { createAdminClient, looksLikeKey, loginAdmin } from './admin-api.js';
import { createLocalStore, browserStorage } from './local-store.js';
import {
  STATUSES, statusLabel, maskPhone, formatPhone, formatKst, summarize, filterRecords, sortNewest,
  sizeQuoteFor, kreamPriceFor, toCsv, normalizeImported, shiftSampleTimes,
} from './admin-view.js';
import { brandLinks } from './brands.js';
import { CANDIDATE_TYPES, CURRENCIES, checkRate, compareToKream, parseRates, toKrw } from './sourcing.js';
import { STOCK_STATES, DEFAULT_STALE_HOURS, METHOD_LABELS, validateCheck, stockSummary, matchesStockFilter, parseStaleHours } from './stock.js';
import { formatWon } from './preview-view.js';

const store = createLocalStore(browserStorage());
const SETTINGS_KEY = 'twoflip.admin.settings.v1';
const KEY_STORAGE = 'twoflip.admin.key';
const $ = (id) => document.getElementById(id);

const state = {
  source: 'browser',
  file: null, // { name, records, dirty }
  server: { key: '', member: null, members: [], records: [], loading: false, loaded: false },
  filter: { status: '', q: '', stock: '' },
  msg: null, // 방금 한 동작의 결과 한 줄 { kind, text }
  open: new Set(),
  reveal: new Set(),
  history: new Map(), // 신청 id → 서버에서 받은 상태 이력
  checkForm: new Map(), // 신청 id → 05 재고 기록 칸의 직전 종류·통화·사이즈
  jumpToRecord: null, // 접힌 카드의 「재고 기록」 — 다음 그리기 때 그 카드 05 기록 칸으로
  localSettings: loadSettings(),
  settings: null,
};
state.settings = state.localSettings;

// ── 작은 도구 ─────────────────────────────────────────
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const httpUrl = (u) => (typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u) ? u : null);
const kreamUrl = (u) => (typeof u === 'string' && /^https:\/\/kream\.co\.kr\/products\/\d+$/.test(u) ? u : null);
const ext = (url, ...kids) => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, ...kids);
const newId = () => Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();
const isServer = () => state.source === 'server';

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const hours = Number(s.staleHours);
    return {
      area: typeof s.area === 'string' ? s.area : '',
      rates: parseRates(s.rates || {}),
      staleHours: Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_STALE_HOURS,
    };
  } catch { return { area: '', rates: {}, staleHours: DEFAULT_STALE_HOURS }; }
}
const stockOpts = () => ({ rates: state.settings.rates, now: Date.now(), staleHours: state.settings.staleHours });

// 확인 시각 → 「3시간 전」
function ago(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '시각 없음';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 60) return `${m}분 전`;
  if (m < 48 * 60) return `${Math.round(m / 60)}시간 전`;
  return `${Math.round(m / 1440)}일 전`;
}

function note(kind, text) {
  const el = $('src-note');
  el.dataset.kind = kind || '';
  el.textContent = text || '';
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace(/[-:T]/g, '');

// ── 접속 키 보관 — 기본은 이 탭(sessionStorage), 「이 기기에서 기억」이면 localStorage ──
function readKey() {
  try { return sessionStorage.getItem(KEY_STORAGE) || localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}
function writeKey(key, remember) {
  try {
    sessionStorage.setItem(KEY_STORAGE, key);
    if (remember) localStorage.setItem(KEY_STORAGE, key); else localStorage.removeItem(KEY_STORAGE);
  } catch { /* 저장 못 하면 이번 화면에서만 */ }
}
function forgetKey() {
  try { sessionStorage.removeItem(KEY_STORAGE); localStorage.removeItem(KEY_STORAGE); } catch { /* 없음 */ }
}
const adminApi = () => createAdminClient({ baseUrl: CONFIG.apiBaseUrl, key: state.server.key });

// ── 데이터 출처 ───────────────────────────────────────
function records() {
  if (state.source === 'server') return state.server.records;
  return state.source === 'browser' ? store.list() : (state.file ? state.file.records : []);
}

// 브라우저·파일 출처의 변경
function saveLocal(id, patch) {
  try {
    if (state.source === 'browser') store.update(id, patch);
    else if (state.file) {
      state.file.records = state.file.records.map((r) => (r.id === id ? { ...r, ...patch } : r));
      state.file.dirty = true;
    }
    state.msg = null;
  } catch (e) { flash('error', e.message); }
  render();
}

function serverFail(res) {
  if (res.error.kind === 'auth') {
    logout(false);
    showGate('로그인이 만료됐거나 막힌 계정입니다. 다시 로그인해 주세요.');
    return;
  } else {
    const fields = res.error.fields ? Object.values(res.error.fields).join(' ') : '';
    flash('error', `서버에 저장하지 못했습니다: ${fields || res.error.message}`);
  }
  render();
}

function replaceServerRecord(app) {
  if (!app) return;
  state.server.records = state.server.records.map((r) => (r.id === app.id ? app : r));
  state.history.delete(app.id); // 이력은 다음에 열 때 다시 받는다
}

// 같은 동작을 출처에 맞게 — local: 바꿀 칸 / remote: 서버 호출
async function apply(r, local, remote) {
  if (!isServer()) { saveLocal(r.id, local()); return; }
  const res = await remote(adminApi());
  if (!res.ok) { serverFail(res); return; }
  replaceServerRecord(res.data.application);
  state.msg = null;
  render();
}

const cands = (r) => (Array.isArray(r.sourcing) ? r.sourcing : []);
const ops = {
  setStatus: (r, status) => apply(r, () => ({ status }), (api) => api.patchApplication(r.id, { status })),
  setManual: (r, manual) => apply(r, () => ({ manual }), (api) => api.patchApplication(r.id, { manual })),
  setAssignee: (r, assigneeId) => apply(r, () => ({ assigneeId }), (api) => api.patchApplication(r.id, { assigneeId })),
  addCheck: (r, v) => apply(r,
    () => ({ sourcing: [...cands(r), { id: newId(), ...v, at: nowIso() }] }),
    (api) => api.addCheck(r.id, { type: v.type, name: v.name, size: v.size, stock: v.stock, price: v.price ?? '', currency: v.currency, url: v.url, note: v.note })),
  // patch = { stock } 이면 재고 상태 변경, {} 이면 「지금 다시 확인함」 — 둘 다 확인 시각 갱신
  updateCheck: (r, checkId, patch) => apply(r,
    () => ({ sourcing: cands(r).map((c) => (c.id === checkId ? { ...c, ...patch, at: nowIso(), method: 'manual' } : c)) }),
    (api) => (patch.stock ? api.patchCheck(checkId, { stock: patch.stock }) : api.touchCheck(checkId))),
  removeCheck: (r, checkId) => apply(r, () => ({ sourcing: cands(r).filter((c) => c.id !== checkId) }), (api) => api.deleteCheck(checkId)),
  async removeApp(r) {
    if (!confirm(`접수번호 ${r.id} 신청을 지울까요?` + (isServer() ? ' 서버 DB 에서 지워지고 되돌릴 수 없습니다.' : ''))) return;
    if (isServer()) {
      const res = await adminApi().deleteApplication(r.id);
      if (!res.ok) { serverFail(res); return; }
      state.server.records = state.server.records.filter((x) => x.id !== r.id);
      flash('', `접수번호 ${r.id} 를 지웠습니다.`);
      render();
      return;
    }
    try {
      if (state.source === 'browser') store.remove(r.id);
      else if (state.file) {
        state.file.records = state.file.records.filter((x) => x.id !== r.id);
        state.file.dirty = true;
      }
    } catch (e) { flash('error', e.message); }
    render();
  },
};

// ── 로그인 화면 — 로그인 전에는 관리자 화면 전체를 감춘다 ──
// (페이지 코드는 공개 정적 파일이라 감추는 건 화면이고, 데이터는 서버가 로그인 없이는 주지 않는 것으로 지킨다)
function gateMsg(text, kind = 'error') {
  const el = $('gate-msg');
  el.textContent = text || '';
  el.dataset.kind = kind;
}

function showGate(text = '', kind = 'error') {
  $('gate').hidden = false;
  $('admin-app').hidden = true;
  $('server-session').hidden = true;
  gateMsg(text, kind);
  setTimeout(() => ($('gate-id').value ? $('gate-pw') : $('gate-id')).focus(), 0);
}

function showApp() {
  $('gate').hidden = true;
  $('admin-app').hidden = false;
  $('server-session').hidden = false;
  $('server-who').textContent = `${state.server.member.name} 님`;
  $('server-logout').title = `${state.server.member.name} 님 로그아웃`; // 좁은 화면에선 이름을 숨긴다
}

// 아이디·비밀번호 → 세션 키 → 그 키로 시작
async function loginWithPassword(loginId, password, remember) {
  const r = await loginAdmin({ baseUrl: CONFIG.apiBaseUrl, loginId, password, remember });
  if (!r.ok) {
    gateMsg(r.error.status === 401 || r.error.status === 429 || r.error.kind === 'input' ? r.error.message : `서버에 연결하지 못했습니다: ${r.error.message}`);
    return false;
  }
  return useSession(r.data.token, remember, r.data.member);
}

// 세션 키(방금 받았거나 기억해 둔 것)로 시작 — 만료됐으면 로그인 화면으로
async function useSession(key, remember, member = null) {
  state.server.key = key.trim();
  if (!member) {
    const me = await adminApi().me();
    if (!me.ok) {
      state.server.key = '';
      forgetKey();
      showGate(me.error.kind === 'auth' ? '로그인이 만료됐습니다. 다시 로그인해 주세요.' : `서버에 연결하지 못했습니다: ${me.error.message}`);
      return false;
    }
    member = me.data.member;
  }
  state.server.member = member;
  writeKey(state.server.key, remember);
  state.source = 'server';
  useSettings();
  showApp();
  await loadServer();
  return true;
}

async function loadServer() {
  state.server.loading = true;
  render();
  const [list, settings] = await Promise.all([adminApi().list(), adminApi().getSettings()]);
  state.server.loading = false;
  if (!list.ok) { serverFail(list); return; }
  state.server.records = list.data.applications || [];
  state.server.members = list.data.members || [];
  state.server.loaded = true;
  if (settings.ok) {
    const s = settings.data.settings;
    state.server.settings = { area: s.area || '', rates: parseRates(s.fxRates || {}), staleHours: Number(s.staleHours) || DEFAULT_STALE_HOURS };
  }
  if (isServer()) useSettings();
  flash('', `서버에서 신청 ${state.server.records.length}건을 불러왔습니다(최신 500건까지).`);
  render();
}

function logout(clearMsg = true) {
  if (clearMsg && state.server.key) adminApi().logout(); // 서버 세션도 끊는다(결과는 기다리지 않음)
  forgetKey();
  state.server = { key: '', member: null, members: [], records: [], loading: false, loaded: false };
  state.history.clear();
  state.open.clear();
  state.reveal.clear();
  state.checkForm.clear();
  state.msg = null;
  useSettings();
  render(); // 감춘 화면에도 신청자 정보가 남지 않게 비운다
  showGate(clearMsg ? '로그아웃했습니다.' : '', 'info');
}

// 출처에 맞는 설정 — 서버면 3명이 같이 쓰는 공용 설정, 아니면 이 브라우저 설정
function useSettings() {
  state.settings = isServer() && state.server.settings ? state.server.settings : state.localSettings;
  fillSettingsInputs();
}

// 설정 칸 옆 한 줄 — 저장되면 잠깐 「저장됨」, 거절·실패는 고칠 때까지
function fieldMsg(el, kind, text) {
  clearTimeout(el._timer);
  el.dataset.kind = kind;
  el.textContent = text;
  if (kind === 'ok') el._timer = setTimeout(() => { el.textContent = ''; }, 2500);
}

async function persistSettings(msgEl) {
  if (isServer() && state.server.member) {
    const res = await adminApi().putSettings({ area: state.settings.area, fxRates: state.settings.rates, staleHours: state.settings.staleHours });
    if (!res.ok) { fieldMsg(msgEl, 'error', '저장하지 못했습니다.'); serverFail(res); return; }
    fieldMsg(msgEl, 'ok', '저장됨 · 3명에게 적용');
  } else {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.localSettings)); } catch { /* 이번 화면에서만 */ }
    fieldMsg(msgEl, 'ok', '저장됨 · 이 브라우저');
  }
  render();
}

function setSource(src) {
  state.source = src;
  state.msg = null;
  useSettings();
  render();
  if (src === 'server' && state.server.member && !state.server.loaded && !state.server.loading) loadServer();
}

// ── 화면 ──────────────────────────────────────────────
function renderToolbar() {
  $('count-browser').textContent = String(store.list().length);
  $('count-file').textContent = state.file ? String(state.file.records.length) : '—';
  $('count-server').textContent = state.server.loaded ? String(state.server.records.length) : '—';
  for (const s of ['server', 'browser', 'file']) $(`src-${s}`).setAttribute('aria-selected', String(state.source === s));
  $('src-file').disabled = !state.file;
  $('btn-clear').hidden = state.source !== 'browser';
  $('btn-sample').hidden = state.source !== 'browser';
  $('server-refresh').disabled = state.server.loading;

  // 우선순위: 깨진 데이터 > 방금 한 동작의 결과 > 출처별 기본 안내
  if (state.source === 'browser' && store.isCorrupt()) {
    note('error', '이 브라우저에 저장된 테스트 데이터가 깨져 있습니다. 「이 브라우저 데이터 비우기」로 초기화해 주세요.');
  } else if (state.server.loading && isServer()) {
    note('', '서버에서 불러오는 중…');
  } else if (state.msg) {
    note(state.msg.kind, state.msg.text);
  } else if (isServer()) {
    note('', '서버 DB 의 신청입니다. 상태·재고 확인·설정을 바꾸면 3명 모두에게 바로 반영됩니다.');
  } else if (state.source === 'file' && state.file) {
    note(state.file.dirty ? 'warn' : '', `파일: ${state.file.name}` + (state.file.dirty ? ' — 바꾼 내용은 파일에 저장되지 않았습니다. 「JSON 내보내기」로 받아 두세요.' : ' — 바꾼 내용은 「JSON 내보내기」로 저장합니다.'));
  } else {
    note('', '테스트 모드 신청(신청 화면 ?demo=1)이 여기에 쌓입니다.');
  }
}

// 동작 결과 한 줄 — 다음 동작(출처 전환·저장)까지 유지
function flash(kind, text) { state.msg = { kind, text }; }

function renderKpis(all) {
  const s = summarize(all);
  const items = [{ key: '', label: '전체', v: s.total }, ...STATUSES.map((x) => ({ key: x.key, label: x.label, v: s[x.key] }))];
  $('kpis').replaceChildren(...items.map((it) => h('button', {
    type: 'button', class: 'kpi', 'aria-pressed': String(state.filter.status === it.key),
    onclick: () => { state.filter.status = it.key; $('f-status').value = it.key; render(); },
  }, h('div', { class: 'k', text: it.label }), h('div', { class: 'v', text: String(it.v) }))));
}

function emptyText() {
  if (isServer()) return state.server.member ? '서버 DB 에 신청이 없습니다.' : '로그인하면 서버 DB 의 신청이 여기에 보입니다.';
  return state.source === 'browser' ? '이 브라우저에 저장된 신청이 없습니다.' : '파일에 신청이 없습니다.';
}

function renderList(all) {
  const opts = stockOpts();
  const rows = sortNewest(filterRecords(all, state.filter).filter((r) => matchesStockFilter(r, state.filter.stock, opts)));
  const list = $('list');
  if (!all.length) {
    list.replaceChildren(h('div', { class: 'empty' },
      h('p', { text: emptyText() }),
      state.source === 'browser' ? h('p', {}, '신청 화면을 ', ext('./?demo=1', '테스트 모드'), '로 열어 신청하거나, 위의 「샘플 넣기」·「JSON 열기」를 써 보세요.') : null));
    return;
  }
  if (!rows.length) {
    list.replaceChildren(h('div', { class: 'empty' }, h('p', { text: '조건에 맞는 신청이 없습니다.' })));
    return;
  }
  list.replaceChildren(...rows.map(renderCard));
}

function renderCard(r) {
  const k = r.kream || null;
  const manual = r.manual || {};
  const brand = (k && k.brand) || manual.brand || '';
  const modelNo = (k && k.modelNo) || manual.modelNo || '';
  const title = (k && (k.nameKo || k.name)) || (manual.modelNo ? `${manual.brand || ''} ${manual.modelNo}`.trim() : '상품 정보 없음');
  const quote = sizeQuoteFor(r);
  const img = k && typeof k.image === 'string' && k.image.startsWith('https://') ? k.image : null;
  const revealed = state.reveal.has(r.id);
  const stock = stockSummary(r, stockOpts());
  const stockTone = stock.buyable ? 'ok' : (stock.needsCheck ? 'warn' : 'none');
  const assignee = r.assigneeId ? state.server.members.find((m) => m.id === r.assigneeId) : null;

  const statusSel = h('select', {
    class: 'status-sel', 'data-status': r.status, 'aria-label': '상태',
    onclick: (e) => e.stopPropagation(),
    onchange: (e) => ops.setStatus(r, e.target.value),
  }, ...STATUSES.map((s) => h('option', { value: s.key, selected: s.key === r.status }, s.label)),
  STATUSES.some((s) => s.key === r.status) ? null : h('option', { value: r.status, selected: true }, statusLabel(r.status)));

  const summary = h('summary', {},
    h('div', { class: 'thumb' }, img ? h('img', { src: img, alt: '', referrerpolicy: 'no-referrer', loading: 'lazy' }) : '이미지 없음'),
    h('div', { class: 'sum-prod' },
      h('div', { class: 'cell-k clip' }, brand || '브랜드 미상', r.source === 'sample' ? h('span', { class: 'tag', text: '샘플' }) : null, r.source === 'demo' ? h('span', { class: 'tag', text: '테스트' }) : null,
        assignee ? h('span', { class: 'tag', text: `담당 ${assignee.name}` }) : null),
      h('div', { class: 'cell-v clip', text: title }),
      h('div', { class: 'cell-s mono clip', text: modelNo || '모델번호 없음' }),
      // 좁은 화면(사이즈·신청자 칸이 숨을 때)만 — 사이즈 · 이름 · 접수 시각 · 접수번호
      h('div', { class: 'cell-s clip sum-meta' }, `${r.size || '—'} · ${r.name || '—'} · ${formatKst(r.receivedAt)} `, h('span', { class: 'mono rid', text: r.id }))),
    h('div', { class: 'hide-md' },
      h('div', { class: 'cell-k', text: '사이즈' }),
      h('div', { class: 'cell-v', text: r.size || '—' }),
      h('div', { class: 'cell-s', text: quote ? `${quote.price} · ${quote.basis}` : 'KREAM 시세 없음' })),
    h('div', { class: 'hide-md' },
      h('div', { class: 'cell-k clip' }, formatKst(r.receivedAt), ' ', h('span', { class: 'mono rid', text: r.id })),
      h('div', { class: 'cell-v clip', text: r.name || '—' }),
      h('div', { class: 'cell-s mono', text: revealed ? formatPhone(r.phone) : maskPhone(r.phone) })),
    h('div', { class: 'sum-stock' },
      h('div', { class: 'cell-k', text: '재고' }),
      h('div', { class: `stock-badge ${stockTone}`, text: stock.label, title: stock.label })),
    statusSel,
    // 좁은 화면에서만 보인다 — 매장에서 펼쳐 05 까지 내려가지 않고 바로 기록(2차 QA U-5)
    h('button', {
      type: 'button', class: 'rec-btn', text: '05 재고 기록하기',
      onclick: (e) => { e.preventDefault(); e.stopPropagation(); state.open.add(r.id); state.jumpToRecord = r.id; render(); },
    }));

  const det = h('details', { class: 'app-card', 'data-id': r.id, open: state.open.has(r.id) }, summary, renderDetail(r, { k, brand, modelNo, revealed, stock }));
  det.addEventListener('toggle', () => { if (det.open) state.open.add(r.id); else state.open.delete(r.id); });
  return det;
}

function linkList(items, empty) {
  if (!items.length) return h('p', { class: 'muted', text: empty });
  return h('ul', { class: 'links' }, ...items.map((it) => h('li', {}, ext(it.url, h('span', {}, it.country ? h('span', { class: 'country', text: it.country }) : null, it.label)))));
}

function renderDetail(r, { k, brand, modelNo, revealed, stock }) {
  const links = brandLinks({ brand, modelNo, name: k && k.name, area: state.settings.area });
  const kPrice = kreamPriceFor(r);
  const quote = sizeQuoteFor(r);
  const kUrl = kreamUrl(r.kreamUrl);

  // 1. KREAM
  const kreamPanel = h('div', { class: 'panel' }, h('h3', {}, h('span', { class: 'n', text: '01' }), 'KREAM'),
    h('dl', { class: 'kv' },
      h('dt', { text: '상품 주소' }), h('dd', {}, kUrl ? ext(kUrl, kUrl.replace('https://', '')) : (r.kreamUrl || '—')),
      h('dt', { text: '즉시 구매가' }), h('dd', { text: (k && formatWon(k.buyNowPrice)) || '—' }),
      h('dt', { text: `사이즈 ${r.size || ''}` }), h('dd', { text: quote ? `${quote.price} (${quote.basis})` : '시세 없음' }),
      h('dt', { text: '확인 시각' }), h('dd', { text: k ? formatKst(k.checkedAt) + (k.cached ? ' · 캐시' : '') : '—' })),
    k && Array.isArray(k.sizes) && k.sizes.length
      ? h('table', { class: 'mini-table' },
        h('thead', {}, h('tr', {}, ...['사이즈', '최근 거래', '판매 입찰', '구매 입찰'].map((t) => h('th', { text: t })))),
        h('tbody', {}, ...k.sizes.map((s) => h('tr', { class: String(s.size).toUpperCase() === String(r.size || '').toUpperCase() ? 'hl' : null },
          h('td', { text: s.size }),
          h('td', { text: s.recentPrice != null ? formatWon(s.recentPrice) + (s.recentAgo ? ` · ${s.recentAgo}` : '') : '—' }),
          h('td', { text: formatWon(s.lowestAsk) || '—' }),
          h('td', { text: formatWon(s.highestBid) || '—' })))))
      : h('div', {},
        h('p', { class: 'muted', text: '신청 당시 KREAM 정보가 없습니다(테스트 모드 신청이거나 서버 조회 실패). 브랜드·모델번호를 넣으면 아래 링크가 만들어집니다.' }),
        manualForm(r)));

  // 2~4. 공식 홈페이지 · 오프라인 · 해외
  const officialPanel = h('div', { class: 'panel' }, h('h3', {}, h('span', { class: 'n', text: '02' }), '공식 홈페이지'),
    linkList(links.official, '브랜드를 알 수 없어 링크를 만들지 못했습니다.'),
    links.known ? null : h('p', { class: 'muted', style: 'margin-top:8px', text: '등록되지 않은 브랜드 — 일반 검색으로 연결합니다.' }));
  const offlinePanel = h('div', { class: 'panel' }, h('h3', {}, h('span', { class: 'n', text: '03' }), '근처 오프라인 판매처'),
    linkList(links.offline, '브랜드를 알 수 없어 지도 검색을 만들지 못했습니다.'),
    h('p', { class: 'muted', style: 'margin-top:8px', text: `기준 지역: ${state.settings.area || '없음(지도에서 현재 위치 기준)'} — 위 「설정」에서 바꿉니다. 매장 재고는 전화·방문으로 확인합니다.` }));
  const overseasPanel = h('div', { class: 'panel' }, h('h3', {}, h('span', { class: 'n', text: '04' }), '해외 공식몰'),
    linkList(links.overseas, links.known ? '모델번호가 없어 해외 검색을 만들지 못했습니다.' : '등록된 해외 공식몰이 없는 브랜드입니다.'));

  return h('div', { class: 'detail' }, kreamPanel, officialPanel, offlinePanel, overseasPanel, stockPanel(r, kPrice, stock), customerPanel(r, revealed));
}

function manualForm(r) {
  const m = r.manual || {};
  const b = h('input', { type: 'text', placeholder: '브랜드 (예: Nike)', value: m.brand || '', maxlength: '40', 'aria-label': '브랜드' });
  const mo = h('input', { type: 'text', placeholder: '모델번호 (예: DD1391-100)', value: m.modelNo || '', maxlength: '30', 'aria-label': '모델번호' });
  return h('div', { class: 'manual' }, b, mo, h('button', {
    type: 'button', class: 'btn-sm', text: '적용',
    onclick: () => ops.setManual(r, { brand: b.value.trim(), modelNo: mo.value.trim().toUpperCase() }),
  }));
}

// 05. 재고 확인 — 고객이 보낸 상품·사이즈를 어디서, 언제 확인했나(지금은 전부 수동 기록)
function stockPanel(r, kPrice, stock) {
  const typeLabel = (t) => (CANDIDATE_TYPES.find((x) => x.key === t) || { label: t }).label;
  const want = String(r.size || '').trim().toUpperCase();

  // 신청 사이즈 → 최근 확인 → 살 수 있는 곳 순, 그 안에서는 원화 싼 순
  const rows = stock.checks.slice().sort((a, b) =>
    (b.sameSize - a.sameSize) || (a.stale - b.stale)
    || ((STOCK_STATES.findIndex((s) => s.key === a.stock)) - (STOCK_STATES.findIndex((s) => s.key === b.stock)))
    || ((toKrw(a.price, a.currency, state.settings.rates) ?? Infinity) - (toKrw(b.price, b.currency, state.settings.rates) ?? Infinity)));

  const table = rows.length
    ? h('table', { class: 'mini-table stock-table' },
      h('thead', {}, h('tr', {}, ...['확인', '판매처', '종류', '사이즈', '재고', '가격', '원화', 'KREAM 대비', '메모', ''].map((t) => h('th', { text: t })))),
      h('tbody', {}, ...rows.map((c) => {
        const krw = toKrw(c.price, c.currency, state.settings.rates);
        const isBest = stock.cheapest && c.id === stock.cheapest.id;
        const buyable = STOCK_STATES.some((s) => s.key === c.stock && s.buyable);
        const cmpWanted = buyable && (isBest || (c.sameSize && !c.stale)); // 못 사는 곳은 비교하지 않는다
        const cmp = cmpWanted ? compareToKream(krw, kPrice) : null;
        const cmpText = cmp ? cmp.label.replace('KREAM 대비 ', '') : (cmpWanted && krw != null && kPrice == null ? '시세 미확인' : '—');
        const url = httpUrl(c.url);
        const stockSel = h('select', {
          class: `stock-sel s-${c.stock}`, 'aria-label': `${c.name} 재고 상태`,
          onchange: (e) => ops.updateCheck(r, c.id, { stock: e.target.value }),
        }, ...STOCK_STATES.map((s) => h('option', { value: s.key, selected: s.key === c.stock }, s.label)));
        return h('tr', { class: [isBest ? 'hl' : '', c.stale ? 'stale' : '', c.sameSize ? '' : 'other'].filter(Boolean).join(' ') || null },
          h('td', { class: 'left c-when' },
            h('div', { text: ago(c.at) }),
            h('div', { class: 'sub' }, formatKst(c.at), ' · ', METHOD_LABELS[c.method] || '수동', c.checkedBy ? ` · ${c.checkedBy}` : '', c.stale ? h('span', { class: 'tag warn', text: '오래됨' }) : null),
            h('button', { type: 'button', class: 'link-btn', text: '지금 다시 확인함', onclick: () => ops.updateCheck(r, c.id, {}) })),
          h('td', { class: 'left c-name' }, url ? ext(url, c.name) : c.name, isBest ? h('span', { class: 'cheapest', text: stock.cheapestStale ? '최저(오래됨)' : '최저' }) : null),
          h('td', { class: 'c-type', text: typeLabel(c.type) }),
          h('td', { class: 'c-size' }, c.size || '—', c.sameSize ? null : h('span', { class: 'tag', text: '다른 사이즈' })),
          h('td', { class: 'c-stock' }, stockSel),
          h('td', { class: 'c-price', 'data-label': '가격', text: c.price == null ? '미기록' : (c.currency === 'KRW' ? formatWon(c.price) : `${Number(c.price).toLocaleString('ko-KR')} ${c.currency}`) }),
          h('td', { class: 'c-krw', 'data-label': '원화', text: c.price == null ? '—' : (krw != null ? formatWon(krw) : '환율 필요') }),
          h('td', { class: 'c-cmp' + (cmp ? (cmp.cheaper ? ' diff-neg' : ' diff-pos') : ''), 'data-label': 'KREAM 대비', text: cmpText }),
          h('td', { class: 'left c-note', text: c.note || '' }),
          h('td', { class: 'c-x' }, h('button', {
            type: 'button', class: 'x-btn', 'aria-label': `${c.name} 확인 기록 삭제`, text: '✕',
            onclick: () => ops.removeCheck(r, c.id),
          })));
      })))
    : h('p', { class: 'muted', text: '아직 확인한 곳이 없습니다. 위 02~04 링크로 공식몰·매장·해외를 확인하고 결과를 아래에 기록하세요.' });

  const f = {
    type: h('select', { 'aria-label': '종류' }, ...CANDIDATE_TYPES.map((t) => h('option', { value: t.key }, t.label))),
    name: h('input', { type: 'text', placeholder: '판매처 (예: 나이키 강남점)', maxlength: '60', 'aria-label': '판매처' }),
    size: h('input', { type: 'text', value: want, maxlength: '20', 'aria-label': '확인한 사이즈' }),
    stock: h('select', { 'aria-label': '재고 상태' }, ...STOCK_STATES.map((s) => h('option', { value: s.key }, s.label))),
    price: h('input', { type: 'text', inputmode: 'decimal', placeholder: '가격(모르면 비움)', 'aria-label': '가격' }),
    currency: h('select', { 'aria-label': '통화' }, ...CURRENCIES.map((c) => h('option', { value: c }, c))),
    url: h('input', { type: 'url', placeholder: 'https://… (선택)', 'aria-label': '주소' }),
    note: h('input', { type: 'text', placeholder: '메모 (수량·통화한 직원 등)', maxlength: '200', 'aria-label': '메모' }),
  };
  // 같은 신청에서 이어 기록할 때 종류·통화·사이즈는 직전 값 유지(U-3) — 판매처·가격·주소·메모만 비우고 커서는 판매처로
  const last = state.checkForm.get(r.id);
  if (last) {
    f.type.value = last.type;
    f.currency.value = last.currency;
    f.size.value = last.size;
    if (last.focus) { last.focus = false; setTimeout(() => f.name.focus(), 0); }
  }
  // 접힌 카드의 「재고 기록」으로 들어왔으면 기록 칸으로 바로(2차 QA U-5)
  if (state.jumpToRecord === r.id) {
    state.jumpToRecord = null;
    setTimeout(() => { f.name.scrollIntoView({ block: 'center' }); f.name.focus({ preventScroll: true }); }, 0);
  }
  const err = h('p', { class: 'form-err', 'aria-live': 'polite' });
  f.type.addEventListener('change', () => { if (f.type.value !== 'overseas') f.currency.value = 'KRW'; });
  const add = h('button', {
    type: 'button', class: 'btn-sm primary', text: '기록',
    onclick: () => {
      const v = validateCheck({ type: f.type.value, name: f.name.value, size: f.size.value, stock: f.stock.value, price: f.price.value, currency: f.currency.value, url: f.url.value, note: f.note.value });
      if (!v.ok) { err.textContent = Object.values(v.errors).join(' '); return; }
      state.checkForm.set(r.id, { type: v.value.type, currency: v.value.currency, size: v.value.size, focus: true });
      ops.addCheck(r, v.value);
    },
  });

  const bestCmp = stock.cheapest ? compareToKream(stock.cheapest.krw, kPrice) : null;
  return h('div', { class: 'panel full' },
    h('h3', {}, h('span', { class: 'n', text: '05' }), `재고 확인 — 신청 사이즈 ${want || '미지정'}`),
    h('p', { class: 'stock-line' },
      h('span', { class: `stock-badge ${stock.buyable ? 'ok' : (stock.needsCheck ? 'warn' : 'none')}`, text: stock.label }),
      bestCmp ? h('span', { class: bestCmp.cheaper ? 'diff-neg' : 'diff-pos', text: ` ${bestCmp.label}(KREAM 수수료·배송비 전)` })
        : (stock.cheapest && kPrice == null ? h('span', { class: 'sub', text: ` KREAM 대비 — (사이즈 ${want || '?'} 시세 미확인)` }) : null),
      h('span', { class: 'sub', text: ` · 최근 확인 기준 ${state.settings.staleHours}시간(설정) · 오래된 확인 ${stock.stale}건` + (stock.otherSize ? ` · 다른 사이즈 ${stock.otherSize}건` : '') })),
    table,
    h('div', { class: 'cand-form stock-form' }, f.type, f.name, f.size, f.stock, f.price, f.currency, f.url, f.note, add, err),
    h('p', { class: 'muted', style: 'margin-top:6px', text: '재고 확인은 구매가 아닙니다 — 실제로 사면 위 상태를 「확보」로 바꾸세요. 지금 기록은 전부 사람이 확인한 수동 기록입니다. 해외 원화 = 물품가 × 환율(카드 수수료·관세·부가세·배송비 별도).' }));
}

// 서버 출처에서만 — 담당자 · 상태 변경 이력
function serverExtras(r) {
  if (!isServer()) return [];
  const assignee = h('select', {
    'aria-label': '담당자', class: 'assignee-sel',
    onchange: (e) => ops.setAssignee(r, e.target.value ? Number(e.target.value) : null),
  }, h('option', { value: '' }, '담당자 없음'), ...state.server.members.map((m) => h('option', { value: String(m.id), selected: m.id === r.assigneeId }, m.name)));

  const hist = state.history.get(r.id);
  const histBox = hist
    ? (hist.length
      ? h('ol', { class: 'history' }, ...hist.map((x) => h('li', {},
        h('span', { class: 'mono', text: formatKst(x.changedAt) }), ' ',
        `${x.fromStatus ? statusLabel(x.fromStatus) : '—'} → ${statusLabel(x.toStatus)}`,
        h('span', { class: 'sub', text: x.changedBy ? ` · ${x.changedBy.name}` : '' }))))
      : h('p', { class: 'muted', text: '아직 상태를 바꾼 적이 없습니다.' }))
    : h('button', {
      type: 'button', class: 'btn-sm', text: '상태 변경 이력 보기',
      onclick: async () => {
        const res = await adminApi().history(r.id);
        if (!res.ok) { serverFail(res); return; }
        state.history.set(r.id, res.data.history || []);
        render();
      },
    });
  return [h('dt', { text: '담당자' }), h('dd', {}, assignee), h('dt', { text: '상태 이력' }), h('dd', {}, histBox)];
}

function customerPanel(r, revealed) {
  return h('div', { class: 'panel full' },
    h('h3', {}, h('span', { class: 'n', text: '06' }), '신청자'),
    h('dl', { class: 'kv' },
      h('dt', { text: '접수번호' }), h('dd', { class: 'mono', text: r.id }),
      h('dt', { text: '접수 시각' }), h('dd', { text: formatKst(r.receivedAt) + ' (KST)' }),
      h('dt', { text: '이름' }), h('dd', { text: r.name || '—' }),
      h('dt', { text: '휴대폰' }), h('dd', {},
        h('span', { class: 'mono', text: revealed ? formatPhone(r.phone) : maskPhone(r.phone) }), ' ',
        h('button', { type: 'button', class: 'btn-sm', text: revealed ? '가리기' : '보기', onclick: () => { if (revealed) state.reveal.delete(r.id); else state.reveal.add(r.id); render(); } })),
      h('dt', { text: '요청사항' }), h('dd', { text: r.memo || '—' }),
      ...serverExtras(r)),
    h('div', { class: 'row-actions' }, h('button', { type: 'button', class: 'btn-sm danger', text: '이 신청 삭제', onclick: () => ops.removeApp(r) })));
}

function render() {
  renderToolbar();
  const all = records();
  renderKpis(all);
  renderList(all);
}

// ── 설정 · 이벤트 ────────────────────────────────────
const rateInputs = {};
const rateMsgs = {};

function fillSettingsInputs() {
  $('set-area').value = state.settings.area;
  $('set-stale').value = String(state.settings.staleHours);
  for (const [c, el] of Object.entries(rateInputs)) el.value = state.settings.rates[c] ?? '';
  // 출처를 바꾸면 이전 출처의 안내·오류 표시는 지운다
  for (const el of [$('set-area'), $('set-stale'), ...Object.values(rateInputs)]) el.removeAttribute('aria-invalid');
  for (const el of [$('msg-area'), $('msg-stale'), ...Object.values(rateMsgs)]) fieldMsg(el, '', '');
  $('settings-scope').textContent = isServer() && state.server.settings ? '(서버 공용 — 3명 모두에게 적용)' : '(이 브라우저에만)';
}

// 잘못된 값은 저장하지 않고 칸 아래에 이유를 남긴다(B-3) — 3명 공용 설정이 한 번의 오타로 바뀌지 않게
function initSettings() {
  const area = $('set-area');
  area.addEventListener('change', () => { state.settings.area = area.value.trim(); persistSettings($('msg-area')); });

  const stale = $('set-stale');
  stale.addEventListener('change', () => {
    const v = parseStaleHours(stale.value);
    if (!v.ok) { stale.setAttribute('aria-invalid', 'true'); fieldMsg($('msg-stale'), 'error', v.error); return; }
    stale.removeAttribute('aria-invalid');
    stale.value = String(v.value);
    state.settings.staleHours = v.value;
    persistSettings($('msg-stale'));
  });

  const box = $('set-rates');
  for (const c of CURRENCIES.filter((x) => x !== 'KRW')) {
    const msg = h('span', { class: 'field-msg', id: `msg-rate-${c}`, role: 'status' });
    const input = h('input', { type: 'text', inputmode: 'decimal', placeholder: c === 'JPY' ? '예: 9.3' : '예: 1400', 'aria-describedby': msg.id });
    input.addEventListener('change', () => {
      const v = checkRate(input.value);
      if (!v.ok) { input.setAttribute('aria-invalid', 'true'); fieldMsg(msg, 'error', v.error); return; }
      input.removeAttribute('aria-invalid');
      const rates = { ...state.settings.rates };
      if (v.value == null) delete rates[c]; else rates[c] = v.value;
      state.settings.rates = rates;
      persistSettings(msg);
    });
    rateInputs[c] = input;
    rateMsgs[c] = msg;
    box.append(h('label', {}, c === 'JPY' ? 'JPY (1엔당 원)' : `${c} (원)`, input, msg));
  }
  fillSettingsInputs();
}

function initFilters() {
  const sel = $('f-status');
  sel.replaceChildren(h('option', { value: '' }, '모든 상태'), ...STATUSES.map((s) => h('option', { value: s.key }, s.label)));
  sel.addEventListener('change', () => { state.filter.status = sel.value; render(); });
  $('f-q').addEventListener('input', (e) => { state.filter.q = e.target.value; render(); });
  $('f-stock').addEventListener('change', (e) => { state.filter.stock = e.target.value; render(); });
}

// 들어올 때 — 기억해 둔 로그인이 살아 있으면 바로 관리자 화면, 아니면 로그인 화면
function initGate() {
  $('src-server').addEventListener('click', () => setSource('server'));
  $('server-refresh').addEventListener('click', () => loadServer());
  $('server-logout').addEventListener('click', () => logout());

  $('gate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('gate-submit');
    btn.disabled = true;
    gateMsg('확인 중…', 'info');
    const ok = await loginWithPassword($('gate-id').value, $('gate-pw').value, $('gate-remember').checked);
    $('gate-pw').value = ''; // 비밀번호는 성공·실패와 상관없이 지운다
    if (ok) $('gate-id').value = '';
    btn.disabled = false;
  });

  if (!CONFIG.apiBaseUrl) {
    showGate('서버 주소가 설정되지 않아 로그인할 수 없습니다(assets/js/config.js).');
    $('gate-submit').disabled = true;
    return;
  }
  const saved = readKey();
  if (looksLikeKey(saved)) {
    showGate('로그인 상태를 확인하는 중…', 'info');
    useSession(saved, (() => { try { return localStorage.getItem(KEY_STORAGE) === saved; } catch { return false; } })());
  } else {
    showGate();
  }
}

function initToolbar() {
  $('src-browser').addEventListener('click', () => setSource('browser'));
  $('src-file').addEventListener('click', () => { if (state.file) setSource('file'); });

  $('file-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { records: recs, skipped } = normalizeImported(JSON.parse(await file.text()));
      state.file = { name: file.name, records: recs, dirty: false };
      setSource('file');
      state.msg = skipped ? { kind: 'warn', text: `파일: ${file.name} — 접수번호가 없는 ${skipped}건은 건너뛰었습니다.` } : null;
      render();
    } catch (err) {
      flash('error', `파일을 읽지 못했습니다: ${err instanceof SyntaxError ? 'JSON 형식이 아닙니다.' : err.message}`);
      render();
    }
  });

  $('btn-sample').addEventListener('click', async () => {
    try {
      const res = await fetch('assets/demo/sample-applications.json', { cache: 'no-store' });
      const { records: loaded } = normalizeImported(await res.json());
      const sample = shiftSampleTimes(loaded, Date.now());
      const have = new Set(store.list().map((r) => r.id));
      const add = sample.filter((r) => !have.has(r.id));
      store.replaceAll([...store.list(), ...add]);
      setSource('browser');
      flash('', add.length ? `샘플 ${add.length}건을 넣었습니다(실제 KREAM 스냅샷 + 가상 고객·후보 가격).` : '샘플이 이미 들어 있습니다.');
      render();
    } catch (err) {
      flash('error', `샘플을 넣지 못했습니다: ${err.message}`);
      render();
    }
  });

  $('btn-export-json').addEventListener('click', () => {
    download(`twoflip-applications-${stamp()}.json`, JSON.stringify(records(), null, 2) + '\n', 'application/json');
    if (state.file && state.source === 'file') state.file.dirty = false;
    render();
  });
  $('btn-export-csv').addEventListener('click', () => download(`twoflip-applications-${stamp()}.csv`, toCsv(sortNewest(records()), (r) => stockSummary(r, stockOpts()).label), 'text/csv;charset=utf-8'));

  $('btn-clear').addEventListener('click', () => {
    if (!confirm('이 브라우저에 저장된 테스트 신청을 모두 지울까요? 되돌릴 수 없습니다.')) return;
    store.clear();
    flash('', '이 브라우저 데이터를 비웠습니다.');
    render();
  });
}

initSettings();
initFilters();
initToolbar();
initGate();
render();
