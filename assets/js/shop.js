// 바로 구매 페이지(shop.html) — 저희가 먼저 확보해 둔 상품 목록 · 구매 요청 시트. 화면 값·검증은 items-view.js(순수), 여기는 DOM 만.
// 외부 문자열(상품명·설명)은 textContent 로만 넣는다.
// 신청(index.html)과 다른 페이지다(10-14 재영 결정 — 위아래 한 페이지에서 나눔).
// 목록을 못 받으면(서버 준비 전 · 오류 · 접수 준비 중) 빈 껍데기 대신 이유와 다음 할 일을 보인다.

import './error-report.js'; // 오류 알림(18차 C)
import './pending.js'; // 결정 대기 자리(18차 D) — 값이 비면 아무것도 안 함
import { CONFIG } from './config.js';
import { createApiClient } from './api.js';
import { createLocalApi } from './local-api.js';
import { createLocalStore, browserStorage } from './local-store.js';
import { itemCardModel, validateItemRequest } from './items-view.js';
import { createAdminClient, looksLikeKey } from './admin-api.js';

const api = CONFIG.mode === 'demo'
  ? createLocalApi({ store: createLocalStore(browserStorage()) })
  : createApiClient({ baseUrl: CONFIG.apiBaseUrl });
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});

const list = $('shop-list');
const sheet = $('item-sheet');
const form = $('item-form');
let current = null; // 시트에 열린 상품(화면 값)

if (CONFIG.mode === 'demo') $('demo-banner').hidden = false;

// 미리보기(18차 A) — 관리자 「확보 상품」의 「미리보기 ↗」(shop.html?preview=<id>). 이 브라우저에 관리자 로그인 세션이 있을 때만
// 그 상품 하나(비공개여도)를 띠와 함께 보이고, 구매 요청은 관리자 API 로 보낸다(이름에 [QA] 가 있을 때만 서버가 받는다).
// 세션이 없거나 못 불러오면 preview 는 조용히 무시 — 일반 화면과 같다. 공개 목록 응답은 그대로다
const previewId = (() => { try { const v = new URLSearchParams(location.search).get('preview'); return v && /^[0-9a-z]{1,16}$/.test(v) ? v : null; } catch { return null; } })();
const adminKey = (() => { try { return sessionStorage.getItem('twoflip.admin.key') || localStorage.getItem('twoflip.admin.key') || ''; } catch { return ''; } })();
const admin = previewId && CONFIG.mode === 'api' && looksLikeKey(adminKey) ? createAdminClient({ baseUrl: CONFIG.apiBaseUrl, key: adminKey }) : null;
async function withPreview(items) {
  if (!admin) return items;
  const r = await admin.previewItem(previewId);
  if (!r.ok || !r.data || !r.data.item) return items;
  return [{ ...r.data.item, preview: true }, ...items.filter((x) => x.id !== r.data.item.id)];
}

// 목록을 못 받았을 때 — 이유 한 줄 + 다음 할 일(다시 시도 · 신청으로)
function notice(text, retry) {
  const box = el('div', 'shop-empty');
  box.append(el('p', null, text));
  const links = el('p', 'shop-empty-actions');
  if (retry) {
    const b = el('button', 'btn btn-outline', '다시 불러오기');
    b.type = 'button';
    b.addEventListener('click', () => load({ fresh: true }));
    links.append(b);
  }
  const a = Object.assign(el('a', 'btn btn-primary', 'KREAM 링크로 신청하기'), { href: './#apply' });
  links.append(a);
  box.append(links);
  list.classList.remove('is-single');
  list.replaceChildren(box);
}

async function load({ fresh = false } = {}) {
  if (CONFIG.mode === 'closed') { notice('바로 구매는 준비 중이에요.', false); return; }
  const r = await api.items({ fresh });
  if (!r.ok) {
    if (r.error.code === 'items_unavailable') notice('바로 구매는 준비 중이에요. 원하는 상품은 KREAM 링크로 신청해 주세요.', false);
    else notice('상품 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', true);
    return;
  }
  render(await withPreview(r.data.items || []));
  // 첫 페이지 미리보기에서 눌러 왔으면(shop.html#i-<id>) 그 카드로
  const target = location.hash.startsWith('#i-') ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (target) { target.scrollIntoView({ block: 'center' }); target.classList.add('is-target'); }
}

// 이 탭에서 이미 보낸 구매 요청 — 같은 상품을 또 누르면 알려 주기만 한다(결정 ④ — 막지 않음, 계정이 없어서)
const REQ_KEY = 'twoflip.item.requests';
function requestedIds(itemId) {
  try { return (JSON.parse(sessionStorage.getItem(REQ_KEY) || '{}')[itemId]) || []; } catch { return []; }
}
function rememberRequest(itemId, receipt) {
  try {
    const all = JSON.parse(sessionStorage.getItem(REQ_KEY) || '{}');
    all[itemId] = [...(all[itemId] || []), receipt];
    sessionStorage.setItem(REQ_KEY, JSON.stringify(all));
  } catch { /* 저장 못 하면 알림만 못 한다 */ }
}

let shown = [];
function render(items) {
  shown = items;
  if (!items.length) {
    notice('지금 바로 구매할 수 있는 상품이 없어요. 원하는 상품은 KREAM 링크로 신청해 주세요.', false);
    return;
  }
  // 2단계 2-2 — 1개면 2열 반쪽 카드 대신 한 줄 전체 큰 카드 + 「지금은 이 물건 하나예요」(빈 오른쪽 칸이 남지 않게)
  const single = items.length === 1;
  list.classList.toggle('is-single', single);
  const cards = items.map((it) => card({ ...itemCardModel(it), preview: it.preview === true }));
  if (single) {
    const note = el('p', 'shop-one-note', '지금은 이 물건 하나예요. 찾는 게 없으면 ');
    note.append(Object.assign(el('a', null, 'KREAM 링크로 부탁하기 →'), { href: './#apply' }));
    cards.push(note);
  }
  list.replaceChildren(...cards);
}

function card(m) {
  const box = el('article', 'shop-card' + (m.reserved ? ' is-reserved' : '') + (m.preview ? ' is-preview' : ''));
  box.id = `i-${m.id}`;
  const mine = requestedIds(m.id);
  const imgBox = el('div', 'shop-img');
  if (m.image) {
    const img = Object.assign(document.createElement('img'), { src: m.image, alt: m.title, loading: 'lazy' });
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { img.remove(); imgBox.textContent = '이미지 없음'; };
    imgBox.append(img);
  } else imgBox.textContent = '이미지 없음';
  if (m.reserved) imgBox.append(el('span', 'shop-flag', '예약 중'));

  const body = el('div', 'shop-body');
  if (m.sub) body.append(el('p', 'shop-sub', m.sub));
  body.append(el('h3', 'shop-title', m.title));
  const meta = el('p', 'shop-meta');
  meta.append(el('span', 'shop-size', `사이즈 ${m.size}`), el('strong', m.priceKnown ? 'shop-price' : 'shop-price ask', m.price));
  body.append(meta);
  if (m.priceHint) body.append(el('p', 'shop-hint', m.priceHint));
  // 이 탭에서 요청한 상품이 예약 중이면 누가 예약됐는지 화면은 모른다 — 「다른 분께」라고 단정하지 않는다(5차 QA B-1)
  if (m.reserved) body.append(el('p', 'shop-hint', mine.length ? '요청하신 상품이 예약 중이에요 — 확인 후 연락드려요' : m.reservedNote));
  // 공개 설명 — 짧은 조각이면 칩(「새상품」「택 있음」), 아니면 글 그대로(3차 QA D-3)
  if (m.noteChips) {
    const chipsBox = el('p', 'shop-chips');
    chipsBox.append(...m.noteChips.map((t) => el('span', 'shop-chip', t)));
    body.append(chipsBox);
  }
  if (m.note) body.append(el('p', 'shop-note', m.note)); // 칩으로 안 나뉜 설명은 글로(상태 칩과 같이 보일 수 있다)

  if (mine.length) body.append(el('p', 'shop-mine', `요청함 · 접수번호 ${mine.join(', ')}`));
  const btn = el('button', 'btn ' + (m.reserved ? 'btn-outline' : (mine.length ? 'btn-outline' : 'btn-primary')), m.reserved ? '예약 중' : (mine.length ? '다시 요청' : '구매 요청'));
  btn.type = 'button';
  btn.disabled = m.reserved;
  // 화면 낭독기에선 「구매 요청」만 여러 번 들린다 — 어느 상품인지 붙인다(6차 QA U-2)
  btn.setAttribute('aria-label', `${m.title} 사이즈 ${m.size} ${btn.textContent}`);
  btn.addEventListener('click', () => {
    const ids = requestedIds(m.id);
    if (ids.length && !confirm(`이미 요청하셨어요(접수번호 ${ids.join(', ')}).\n새로 보낼까요?`)) return;
    openSheet(m);
  });
  if (m.preview) box.append(el('p', 'shop-preview-band', '미리보기 — 고객에게는 안 보입니다')); // 관리자 세션에서만(18차 A)
  box.append(imgBox, body, btn);
  return box;
}

// ── 구매 요청 시트 ─────────────────────────────────────
function openSheet(m) {
  current = m;
  const img = $('sheet-img');
  img.hidden = !m.image;
  if (m.image) img.src = m.image; else img.removeAttribute('src');
  $('sheet-sub').textContent = m.sub || '';
  $('sheet-name').textContent = m.title;
  $('sheet-size').textContent = `사이즈 ${m.size}`;
  $('sheet-price').textContent = m.price;
  // 카드에선 3줄로 잘린 설명을 여기선 전부(6차 QA U-1)
  $('sheet-desc').textContent = m.note;
  $('sheet-desc').hidden = !m.note;
  form.reset();
  showErrors({});
  setStatus(null);
  form.hidden = false;
  $('item-done').hidden = true;
  if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
  // 이름 칸에 바로 커서를 두지 않는다 — 휴대폰 키보드가 먼저 올라와 상품 요약·보내기 버튼을 가린다(3차 QA U-3). 첫 포커스는 닫기 ✕
  // 뒤로 가기가 페이지를 떠나지 않고 시트만 닫게 기록을 하나 쌓는다(8차 QA U-1)
  if (!sheetEntry) { history.pushState({ sheet: true }, ''); sheetEntry = true; }
}

// 시트를 열며 쌓은 기록이 아직 남아 있나 — ✕·Esc·바깥으로 닫으면 그 기록을 되돌리고, 뒤로 가기로 닫으면 이미 빠진 것
let sheetEntry = false;
if (history.state && history.state.sheet) history.replaceState(null, ''); // 시트가 열린 채 새로고침한 경우
function closeSheet() {
  if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open');
  sheetClosed(); // close 이벤트는 나중에 온다(늦거나 안 오는 환경도 있다) — 여기서 바로 정리하고, 이벤트는 두 번째엔 아무것도 안 한다
}
function sheetClosed() {
  if (!sheetEntry) return;
  sheetEntry = false;
  history.back();
}
sheet.addEventListener('cancel', sheetClosed); // Esc — 이건 바로 온다
sheet.addEventListener('close', sheetClosed);
window.addEventListener('popstate', () => {
  if (!sheetEntry) return;
  sheetEntry = false;
  closeSheet();
});
$('sheet-close').addEventListener('click', closeSheet);
$('item-done-close').addEventListener('click', closeSheet);
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); }); // 바깥(어두운 곳) 누르면 닫기

function readForm() {
  const fd = new FormData(form);
  return { name: fd.get('name'), phone: fd.get('phone'), memo: fd.get('memo'), consent: fd.get('consent') === 'yes', website: fd.get('website') };
}

function showErrors(errors) {
  for (const p of form.querySelectorAll('[data-error-for]')) {
    const key = p.dataset.errorFor;
    p.textContent = errors[key] || '';
    const input = form.elements[key];
    if (input && input.setAttribute) input.setAttribute('aria-invalid', errors[key] ? 'true' : 'false');
  }
  const first = Object.keys(errors)[0];
  if (first && form.elements[first] && form.elements[first].focus) form.elements[first].focus();
}

// 오류가 떠 있는 칸 — 입력 중엔 맞으면 지우기만, 칸을 벗어날 때 다시 검사(신청 화면과 같은 규칙)
for (const p of form.querySelectorAll('[data-error-for]')) {
  const key = p.dataset.errorFor;
  const input = form.elements[key];
  if (!input || !input.setAttribute) continue;
  p.id = `it-err-${key}`;
  input.setAttribute('aria-describedby', p.id);
  const recheck = (typing) => {
    if (!p.textContent) return;
    const msg = validateItemRequest(readForm()).errors[key] || '';
    if (typing && msg) return;
    p.textContent = msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  input.addEventListener('input', () => recheck(true));
  for (const ev of ['change', 'blur']) input.addEventListener(ev, () => recheck(false));
}
$('it-name').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('it-phone').focus(); } });
$('it-phone').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('it-phone').blur(); } });

function setStatus(kind, text) {
  const s = $('item-status');
  s.hidden = !text;
  s.dataset.kind = kind || '';
  s.textContent = text || '';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!current) return;
  setStatus(null);
  const v = validateItemRequest(readForm());
  if (v.spam) { done('-'); return; }
  showErrors(v.errors);
  if (!v.ok) return;

  const btn = $('item-submit');
  btn.disabled = true;
  btn.textContent = '보내는 중…';
  const r = current.preview && admin ? await admin.previewRequest(current.id, v.payload) : await api.requestItem(current.id, v.payload);
  btn.disabled = false;
  btn.textContent = '구매 요청 보내기';
  if (r.ok) { rememberRequest(current.id, r.data.id); done(r.data.id); return; }
  setStatus('error', r.error.message);
  if (r.error.code === 'item_reserved' || r.error.code === 'item_not_found') load({ fresh: true }); // 그 사이 예약·판매됨 — 캐시를 건너뛰고 목록을 새로
});

function done(id) {
  if (shown.length) render(shown); // 뒤 카드에 「요청함 · 접수번호」가 바로 보이게
  form.hidden = true;
  $('item-done-id').textContent = id;
  const real = '확인 후 적어 주신 번호로 연락드려요. 연락 시점은 상품마다 달라요 — 접수번호를 남겨 두세요. 같은 상품에 요청이 여러 건이면 저희가 확인해 한 분께 예약을 드려요.';
  $('item-done-msg').textContent = CONFIG.mode === 'demo' ? `[테스트 — 이 브라우저에만 저장, 관리자 화면에서 확인] ${real}` : real; // 5차 QA U-4
  $('item-done-copy').textContent = '복사';
  $('item-done').hidden = false;
  $('item-done').focus();
}
$('item-done-copy').addEventListener('click', async () => {
  let ok = false;
  try { await navigator.clipboard.writeText($('item-done-id').textContent); ok = true; } catch { /* 권한 없음 */ }
  $('item-done-copy').textContent = ok ? '복사됨' : '길게 눌러 복사';
});

load();
