// 관리자(임시) — 서버 없이 「이 브라우저에 저장된 테스트 신청」과 「직접 연 JSON 파일」만 읽는다. 밖으로 보내는 요청 없음.
// 계산·표시 값은 순수 모듈(admin-view · brands · sourcing)에서 오고, 여기는 DOM 만 다룬다.
// 신청자·KREAM·판매처 문자열은 전부 textContent 로 넣는다(HTML 로 해석하지 않는다).

import { createLocalStore, browserStorage } from './local-store.js';
import {
  STATUSES, statusLabel, maskPhone, formatPhone, formatKst, summarize, filterRecords, sortNewest,
  sizeQuoteFor, kreamPriceFor, toCsv, normalizeImported,
} from './admin-view.js';
import { brandLinks } from './brands.js';
import { CANDIDATE_TYPES, CURRENCIES, rankCandidates, compareToKream, validateCandidate, parseRates } from './sourcing.js';
import { formatWon } from './preview-view.js';

const store = createLocalStore(browserStorage());
const SETTINGS_KEY = 'twoflip.admin.settings.v1';
const $ = (id) => document.getElementById(id);

const state = {
  source: 'browser',
  file: null, // { name, records, dirty }
  filter: { status: '', q: '' },
  msg: null, // 방금 한 동작의 결과 한 줄 { kind, text }
  open: new Set(),
  reveal: new Set(),
  settings: loadSettings(),
};

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

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { area: typeof s.area === 'string' ? s.area : '', rates: parseRates(s.rates || {}) };
  } catch { return { area: '', rates: {} }; }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch { /* 이번 화면에서만 */ }
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

// ── 데이터 출처 ───────────────────────────────────────
function records() {
  return state.source === 'browser' ? store.list() : (state.file ? state.file.records : []);
}

function save(id, patch) {
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

function removeRecord(id) {
  if (!confirm(`접수번호 ${id} 신청을 지울까요?`)) return;
  try {
    if (state.source === 'browser') store.remove(id);
    else if (state.file) {
      state.file.records = state.file.records.filter((r) => r.id !== id);
      state.file.dirty = true;
    }
  } catch (e) { flash('error', e.message); }
  render();
}

function setSource(src) {
  state.source = src;
  state.msg = null;
  render();
}

// ── 화면 ──────────────────────────────────────────────
function renderToolbar() {
  const browserCount = store.list().length;
  $('count-browser').textContent = String(browserCount);
  $('count-file').textContent = state.file ? String(state.file.records.length) : '—';
  $('src-browser').setAttribute('aria-selected', String(state.source === 'browser'));
  $('src-file').setAttribute('aria-selected', String(state.source === 'file'));
  $('src-file').disabled = !state.file;
  $('btn-clear').hidden = state.source !== 'browser';
  $('btn-sample').hidden = state.source !== 'browser';

  // 우선순위: 깨진 데이터 > 방금 한 동작의 결과 > 파일 상태 > 기본 안내
  if (state.source === 'browser' && store.isCorrupt()) {
    note('error', '이 브라우저에 저장된 테스트 데이터가 깨져 있습니다. 「이 브라우저 데이터 비우기」로 초기화해 주세요.');
  } else if (state.msg) {
    note(state.msg.kind, state.msg.text);
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

function renderList(all) {
  const rows = sortNewest(filterRecords(all, state.filter));
  const list = $('list');
  if (!all.length) {
    list.replaceChildren(h('div', { class: 'empty' },
      h('p', { text: state.source === 'browser' ? '이 브라우저에 저장된 신청이 없습니다.' : '파일에 신청이 없습니다.' }),
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

  const statusSel = h('select', {
    class: 'status-sel', 'data-status': r.status, 'aria-label': '상태',
    onclick: (e) => e.stopPropagation(),
    onchange: (e) => save(r.id, { status: e.target.value }),
  }, ...STATUSES.map((s) => h('option', { value: s.key, selected: s.key === r.status }, s.label)),
  STATUSES.some((s) => s.key === r.status) ? null : h('option', { value: r.status, selected: true }, statusLabel(r.status)));

  const summary = h('summary', {},
    h('div', { class: 'thumb' }, img ? h('img', { src: img, alt: '', referrerpolicy: 'no-referrer', loading: 'lazy' }) : '이미지 없음'),
    h('div', {},
      h('div', { class: 'cell-k clip' }, brand || '브랜드 미상', r.source === 'sample' ? h('span', { class: 'tag', text: '샘플' }) : null, r.source === 'demo' ? h('span', { class: 'tag', text: '테스트' }) : null),
      h('div', { class: 'cell-v clip', text: title }),
      h('div', { class: 'cell-s mono clip', text: modelNo || '모델번호 없음' })),
    h('div', { class: 'hide-md' },
      h('div', { class: 'cell-k', text: '사이즈' }),
      h('div', { class: 'cell-v', text: r.size || '—' }),
      h('div', { class: 'cell-s', text: quote ? `${quote.price} · ${quote.basis}` : 'KREAM 시세 없음' })),
    h('div', { class: 'hide-md' },
      h('div', { class: 'cell-k', text: formatKst(r.receivedAt) }),
      h('div', { class: 'cell-v clip', text: r.name || '—' }),
      h('div', { class: 'cell-s mono', text: revealed ? formatPhone(r.phone) : maskPhone(r.phone) })),
    statusSel);

  const det = h('details', { class: 'app-card', open: state.open.has(r.id) }, summary, renderDetail(r, { k, brand, modelNo, revealed }));
  det.addEventListener('toggle', () => { if (det.open) state.open.add(r.id); else state.open.delete(r.id); });
  return det;
}

function linkList(items, empty) {
  if (!items.length) return h('p', { class: 'muted', text: empty });
  return h('ul', { class: 'links' }, ...items.map((it) => h('li', {}, ext(it.url, h('span', {}, it.country ? h('span', { class: 'country', text: it.country }) : null, it.label)))));
}

function renderDetail(r, { k, brand, modelNo, revealed }) {
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
    links.known ? null : h('p', { class: 'muted', style: 'margin-top:8px', text: '등록되지 않은 브랜드 — 일반 검색으로 연결합니다(assets/js/brands.js 에 추가 가능).' }));
  const offlinePanel = h('div', { class: 'panel' }, h('h3', {}, h('span', { class: 'n', text: '03' }), '근처 오프라인 판매처'),
    linkList(links.offline, '브랜드를 알 수 없어 지도 검색을 만들지 못했습니다.'),
    h('p', { class: 'muted', style: 'margin-top:8px', text: `기준 지역: ${state.settings.area || '없음(지도에서 현재 위치 기준)'} — 위 「설정」에서 바꿉니다. 매장 재고는 전화·방문으로 확인합니다.` }));
  const overseasPanel = h('div', { class: 'panel' }, h('h3', {}, h('span', { class: 'n', text: '04' }), '해외 공식몰'),
    linkList(links.overseas, links.known ? '모델번호가 없어 해외 검색을 만들지 못했습니다.' : '등록된 해외 공식몰이 없는 브랜드입니다.'));

  return h('div', { class: 'detail' }, kreamPanel, officialPanel, offlinePanel, overseasPanel, sourcingPanel(r, kPrice), customerPanel(r, revealed));
}

function manualForm(r) {
  const m = r.manual || {};
  const b = h('input', { type: 'text', placeholder: '브랜드 (예: Nike)', value: m.brand || '', maxlength: '40', 'aria-label': '브랜드' });
  const mo = h('input', { type: 'text', placeholder: '모델번호 (예: DD1391-100)', value: m.modelNo || '', maxlength: '30', 'aria-label': '모델번호' });
  return h('div', { class: 'manual' }, b, mo, h('button', {
    type: 'button', class: 'btn-sm', text: '적용',
    onclick: () => save(r.id, { manual: { brand: b.value.trim(), modelNo: mo.value.trim().toUpperCase() } }),
  }));
}

function sourcingPanel(r, kPrice) {
  const cands = Array.isArray(r.sourcing) ? r.sourcing : [];
  const ranked = rankCandidates(cands, state.settings.rates);
  const typeLabel = (t) => (CANDIDATE_TYPES.find((x) => x.key === t) || { label: t }).label;

  const table = ranked.list.length
    ? h('table', { class: 'mini-table' },
      h('thead', {}, h('tr', {}, ...['판매처', '종류', '현지가', '원화', 'KREAM 대비', '메모', ''].map((t) => h('th', { text: t })))),
      h('tbody', {}, ...ranked.list.map((c) => {
        const cmp = compareToKream(c.krw, kPrice);
        const url = httpUrl(c.url);
        return h('tr', { class: c.id === ranked.cheapestId ? 'hl' : null },
          h('td', { class: 'left' }, url ? ext(url, c.name) : c.name, c.id === ranked.cheapestId ? h('span', { class: 'cheapest', text: '최저' }) : null),
          h('td', { text: typeLabel(c.type) }),
          h('td', { text: c.currency === 'KRW' ? formatWon(c.price) : `${Number(c.price).toLocaleString('ko-KR')} ${c.currency}` }),
          h('td', { text: c.krw != null ? formatWon(c.krw) : '환율 필요' }),
          h('td', { class: cmp ? (cmp.cheaper ? 'diff-neg' : 'diff-pos') : null, text: cmp ? cmp.label.replace('KREAM 대비 ', '') : '—' }),
          h('td', { class: 'left', text: c.note || '' }),
          h('td', {}, h('button', {
            type: 'button', class: 'x-btn', 'aria-label': `${c.name} 후보 삭제`, text: '✕',
            onclick: () => save(r.id, { sourcing: cands.filter((x) => x.id !== c.id) }),
          })));
      })))
    : h('p', { class: 'muted', text: '아직 찾은 판매처가 없습니다. 위 링크로 찾은 곳을 아래에 기록하세요.' });

  const f = {
    type: h('select', { 'aria-label': '종류' }, ...CANDIDATE_TYPES.map((t) => h('option', { value: t.key }, t.label))),
    name: h('input', { type: 'text', placeholder: '판매처 (예: 나이키 강남점)', maxlength: '60', 'aria-label': '판매처' }),
    price: h('input', { type: 'text', inputmode: 'decimal', placeholder: '가격', 'aria-label': '가격' }),
    currency: h('select', { 'aria-label': '통화' }, ...CURRENCIES.map((c) => h('option', { value: c }, c))),
    url: h('input', { type: 'url', placeholder: 'https://… (선택)', 'aria-label': '주소' }),
    note: h('input', { type: 'text', placeholder: '메모 (재고·사이즈 등)', maxlength: '200', 'aria-label': '메모' }),
  };
  const err = h('p', { class: 'form-err', 'aria-live': 'polite' });
  f.type.addEventListener('change', () => { if (f.type.value !== 'overseas') f.currency.value = 'KRW'; });
  const add = h('button', {
    type: 'button', class: 'btn-sm primary', text: '추가',
    onclick: () => {
      const v = validateCandidate({ type: f.type.value, name: f.name.value, price: f.price.value, currency: f.currency.value, url: f.url.value, note: f.note.value });
      if (!v.ok) { err.textContent = Object.values(v.errors).join(' '); return; }
      save(r.id, { sourcing: [...cands, { id: newId(), ...v.value, at: new Date().toISOString() }] });
    },
  });

  const best = ranked.list.find((c) => c.id === ranked.cheapestId);
  const bestCmp = best ? compareToKream(best.krw, kPrice) : null;
  return h('div', { class: 'panel full' },
    h('h3', {}, h('span', { class: 'n', text: '05' }), '소싱 후보 — 어디가 가장 싼가'),
    best ? h('p', { class: 'muted', style: 'margin-bottom:8px' },
      '최저: ', h('strong', { text: `${best.name} ${formatWon(best.krw)}` }),
      bestCmp ? ` · ${bestCmp.label}` : (kPrice == null ? ' · KREAM 시세 없음' : ''),
      ranked.unconverted ? ` · 환율이 없어 비교에서 빠진 후보 ${ranked.unconverted}건` : '') : null,
    table,
    h('div', { class: 'cand-form' }, f.type, f.name, f.price, f.currency, f.url, f.note, add, err),
    h('p', { class: 'muted', style: 'margin-top:6px', text: '해외 원화 = 물품가 × 환율(설정). 카드 수수료·관세·부가세·배송비는 별도입니다.' }));
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
      h('dt', { text: '요청사항' }), h('dd', { text: r.memo || '—' })),
    h('div', { class: 'row-actions' }, h('button', { type: 'button', class: 'btn-sm danger', text: '이 신청 삭제', onclick: () => removeRecord(r.id) })));
}

function render() {
  renderToolbar();
  const all = records();
  renderKpis(all);
  renderList(all);
}

// ── 설정 · 이벤트 ────────────────────────────────────
function initSettings() {
  const area = $('set-area');
  area.value = state.settings.area;
  area.addEventListener('change', () => { state.settings.area = area.value.trim(); saveSettings(); render(); });

  const box = $('set-rates');
  const inputs = {};
  for (const c of CURRENCIES.filter((x) => x !== 'KRW')) {
    inputs[c] = h('input', { type: 'text', inputmode: 'decimal', value: state.settings.rates[c] ?? '', placeholder: c === 'JPY' ? '예: 9.3' : '예: 1400' });
    inputs[c].addEventListener('change', () => {
      state.settings.rates = parseRates(Object.fromEntries(Object.entries(inputs).map(([kk, el]) => [kk, el.value])));
      saveSettings();
      render();
    });
    box.append(h('label', {}, c === 'JPY' ? 'JPY (1엔당 원)' : `${c} (원)`, inputs[c]));
  }
}

function initFilters() {
  const sel = $('f-status');
  sel.replaceChildren(h('option', { value: '' }, '모든 상태'), ...STATUSES.map((s) => h('option', { value: s.key }, s.label)));
  sel.addEventListener('change', () => { state.filter.status = sel.value; render(); });
  $('f-q').addEventListener('input', (e) => { state.filter.q = e.target.value; render(); });
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
      state.source = 'file';
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
      const { records: sample } = normalizeImported(await res.json());
      const have = new Set(store.list().map((r) => r.id));
      const add = sample.filter((r) => !have.has(r.id));
      store.replaceAll([...store.list(), ...add]);
      state.source = 'browser';
      flash('', add.length ? `샘플 ${add.length}건을 넣었습니다(실제 KREAM 스냅샷 + 가상 고객·후보 가격).` : '샘플이 이미 들어 있습니다.');
      render();
    } catch (err) {
      flash('error', `샘플을 넣지 못했습니다: ${err.message}`);
      render();
    }
  });

  $('btn-export-json').addEventListener('click', () => {
    download(`twoflip-applications-${stamp()}.json`, JSON.stringify(records(), null, 2) + '\n', 'application/json');
    if (state.file) state.file.dirty = false;
    render();
  });
  $('btn-export-csv').addEventListener('click', () => download(`twoflip-applications-${stamp()}.csv`, toCsv(sortNewest(records())), 'text/csv;charset=utf-8'));

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
render();
