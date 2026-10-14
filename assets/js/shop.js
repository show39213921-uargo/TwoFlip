// 바로 구매 — 저희가 먼저 확보해 둔 상품 목록 · 구매 요청 시트. 화면 값·검증은 items-view.js(순수), 여기는 DOM 만.
// 외부 문자열(상품명·설명)은 textContent 로만 넣는다.
//
// 목록을 못 받으면(서버에 표가 아직 없음 · 오류 · 접수 준비 중) 메뉴와 구역을 통째로 숨긴다 — 빈 껍데기를 보이지 않는다.

import { CONFIG } from './config.js';
import { createApiClient } from './api.js';
import { createLocalApi } from './local-api.js';
import { createLocalStore, browserStorage } from './local-store.js';
import { itemCardModel, validateItemRequest } from './items-view.js';

const api = CONFIG.mode === 'demo'
  ? createLocalApi({ store: createLocalStore(browserStorage()) })
  : createApiClient({ baseUrl: CONFIG.apiBaseUrl });
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});

const section = $('shop');
const list = $('shop-list');
const sheet = $('item-sheet');
const form = $('item-form');
let current = null; // 시트에 열린 상품(화면 값)

async function load() {
  if (CONFIG.mode === 'closed') return;
  const r = await api.items();
  if (!r.ok) return; // 준비 전(503)·오류 — 숨긴 채로 둔다
  section.hidden = false;
  $('nav-shop').hidden = false;
  render(r.data.items || []);
}

function render(items) {
  if (!items.length) {
    list.replaceChildren(el('p', 'shop-empty', '지금 바로 구매할 수 있는 상품이 없어요. 원하는 상품은 위에서 KREAM 링크로 신청해 주세요.'));
    return;
  }
  list.replaceChildren(...items.map((it) => card(itemCardModel(it))));
}

function card(m) {
  const box = el('article', 'shop-card' + (m.reserved ? ' is-reserved' : ''));
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
  if (m.reservedNote) body.append(el('p', 'shop-hint', m.reservedNote));
  // 공개 설명 — 짧은 조각이면 칩(「새상품」「택 있음」), 아니면 글 그대로(3차 QA D-3)
  if (m.noteChips) {
    const chipsBox = el('p', 'shop-chips');
    chipsBox.append(...m.noteChips.map((t) => el('span', 'shop-chip', t)));
    body.append(chipsBox);
  } else if (m.note) body.append(el('p', 'shop-note', m.note));

  const btn = el('button', 'btn ' + (m.reserved ? 'btn-outline' : 'btn-primary'), m.reserved ? '예약 중' : '구매 요청');
  btn.type = 'button';
  btn.disabled = m.reserved;
  btn.addEventListener('click', () => openSheet(m));
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
  form.reset();
  showErrors({});
  setStatus(null);
  form.hidden = false;
  $('item-done').hidden = true;
  if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
  // 이름 칸에 바로 커서를 두지 않는다 — 휴대폰 키보드가 먼저 올라와 상품 요약·보내기 버튼을 가린다(3차 QA U-3). 첫 포커스는 닫기 ✕
}

function closeSheet() {
  if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open');
}
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
  const r = await api.requestItem(current.id, v.payload);
  btn.disabled = false;
  btn.textContent = '구매 요청 보내기';
  if (r.ok) { done(r.data.id); return; }
  setStatus('error', r.error.message);
  if (r.error.code === 'item_reserved' || r.error.code === 'item_not_found') load(); // 그 사이 예약·판매됨 — 목록을 새로
});

function done(id) {
  form.hidden = true;
  $('item-done-id').textContent = id;
  $('item-done-msg').textContent = CONFIG.mode === 'demo'
    ? '테스트 요청이라 이 브라우저에만 저장됐어요. 관리자 화면에서 확인할 수 있어요.'
    : '확인 후 적어 주신 번호로 연락드려요. 같은 상품에 요청이 여러 건이면 저희가 확인해 한 분께 예약을 드려요.';
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
