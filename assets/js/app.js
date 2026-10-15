// 신청 페이지 연결부 — 검증(validate.js)·전송(api.js)·미리보기 값(preview-view.js)은 순수 모듈이고, 여기는 DOM 만 다룬다.
// 외부(KREAM) 문자열은 textContent 로만 넣는다.

import { CONFIG } from './config.js';
import { createApiClient } from './api.js';
import { createLocalApi } from './local-api.js';
import { createLocalStore, browserStorage } from './local-store.js';
import { validateApplication, applicationKey } from './validate.js';
import { parseKreamUrl, extractKreamUrl } from './kream-url.js';
import { buildPreviewModel, previewFailText } from './preview-view.js';
import { linkCheckText, QUICK_SIZES, showQuickSizes, readClipboardText, PASTE_NOTES } from './link-check.js';

// demo: 서버 대신 이 브라우저에 저장(?demo=1 로만 켜진다) · api: 백엔드 · closed: 「준비 중」
const api = CONFIG.mode === 'demo'
  ? createLocalApi({ store: createLocalStore(browserStorage()) })
  : createApiClient({ baseUrl: CONFIG.apiBaseUrl });
const $ = (id) => document.getElementById(id);

const form = $('apply-form');
const submitBtn = $('apply-submit');
const statusBox = $('apply-status');
const urlInput = $('kreamUrl');
const sizeInput = $('size');
const preview = $('preview');
const chips = $('size-chips');
const sizeHint = $('size-hint');
const urlBox = $('url-box');
const pasteBtn = $('url-paste');
const clearBtn = $('url-clear');
const quick = $('size-quick');

// ── 신청서 ─────────────────────────────────────────────
function readForm() {
  const fd = new FormData(form);
  return {
    kreamUrl: fd.get('kreamUrl'),
    size: fd.get('size'),
    name: fd.get('name'),
    phone: fd.get('phone'),
    memo: fd.get('memo'),
    consent: fd.get('consent') === 'yes',
    website: fd.get('website'),
  };
}

function showErrors(errors) {
  for (const el of form.querySelectorAll('[data-error-for]')) {
    const key = el.dataset.errorFor;
    const msg = errors[key] || '';
    el.textContent = msg;
    const input = form.elements[key];
    if (input && input.setAttribute) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  const first = Object.keys(errors)[0];
  const el = first && form.elements[first];
  if (el && el.focus) el.focus();
}

// 칸마다 오류 문구 연결(aria-describedby) · 오류가 떠 있는 칸은 고칠 때마다 다시 검사해 바꾸거나 지운다(U-10)
for (const el of form.querySelectorAll('[data-error-for]')) {
  const key = el.dataset.errorFor;
  const input = form.elements[key];
  if (!input || !input.setAttribute) continue;
  if (!el.id) el.id = `err-${key}`;
  const ids = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  ids.add(el.id);
  input.setAttribute('aria-describedby', [...ids].join(' '));
  // 입력 중(input)에는 맞게 고쳐졌을 때 지우기만 한다 — 「010」까지만 쳤는데 오류를 바꿔 띄우지 않는다(2차 QA U-4).
  // 칸을 벗어날 때(blur·change)는 다시 검사해 문구를 바꾼다.
  const recheck = (typing) => {
    if (!el.textContent) return; // 아직 오류가 없는 칸은 입력 중에 다그치지 않는다
    const msg = validateApplication(readForm()).errors[key] || '';
    if (typing && msg) return;
    el.textContent = msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  input.addEventListener('input', () => recheck(true));
  for (const ev of ['change', 'blur']) input.addEventListener(ev, () => recheck(false));
}

// 휴대폰 키보드의 「다음」으로 다음 칸, 마지막 칸은 「완료」로 키보드를 닫는다(2차 QA U-6) — Enter 가 신청을 보내지 않게
const ORDER = ['kreamUrl', 'size', 'name', 'phone'];
ORDER.forEach((key, i) => {
  const input = form.elements[key];
  input.setAttribute('enterkeyhint', i < ORDER.length - 1 ? 'next' : 'done');
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const next = form.elements[ORDER[i + 1]];
    if (next) next.focus(); else input.blur();
  });
});

// 「신청하기」(헤더·히어로)를 누르면 신청 칸으로 가서 주소 칸에 바로 커서 — 한 번 더 누르지 않고 붙여 넣게(2차 QA U-1).
// 누른 그 순간에 focus 해야 iOS 에서 키보드가 뜬다
for (const a of document.querySelectorAll('a[href="#apply"]')) {
  a.addEventListener('click', (e) => {
    if (form.hidden) return; // 접수 완료 화면이면 그 자리로만
    e.preventDefault();
    urlInput.focus({ preventScroll: true });
    urlInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

function setStatus(kind, parts) {
  statusBox.replaceChildren();
  statusBox.hidden = !parts;
  if (!parts) return;
  statusBox.dataset.kind = kind;
  for (const p of [].concat(parts)) {
    statusBox.append(typeof p === 'string' ? document.createTextNode(p) : Object.assign(document.createElement('strong'), { textContent: p.strong }));
  }
}

if (CONFIG.mode === 'closed') {
  submitBtn.disabled = true;
  setStatus('info', '신청 접수 준비 중이에요. 곧 열려요.');
}
if (CONFIG.mode === 'demo') $('demo-banner').hidden = false;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('', null);
  tidyUrlInput(); // 붙여 넣고 바로 누른 경우

  const v = validateApplication(readForm());
  if (v.spam) { setStatus('ok', '신청이 접수됐어요.'); form.reset(); return; } // 봇에게 거절 사유를 알려주지 않는다
  showErrors(v.errors);
  if (!v.ok) return;
  // 같은 탭에서 같은 상품·사이즈를 다시 보내면 한 번 묻는다 — 막지는 않는다(8차 QA U-2, 바로 구매의 「다시 요청」과 같은 동작)
  const key = applicationKey(v.payload);
  const before = appliedIds(key);
  if (before.length && !confirm(`이미 같은 상품·사이즈로 신청하셨어요(접수번호 ${before.join(', ')}).\n다른 사이즈라면 사이즈를 바꿔 주세요. 그래도 다시 보낼까요?`)) return;

  submitBtn.disabled = true;
  submitBtn.textContent = '보내는 중…';
  const r = await api.submitApplication(v.payload);
  submitBtn.disabled = false;
  submitBtn.textContent = '이 상품 찾아 주세요';

  if (r.ok) {
    rememberApplied(key, r.data.id);
    // 10차 QA U-2 — 「다른 상품 신청하기」로 이어 신청할 때 이름·휴대폰·동의는 다시 쓰지 않게 상품 칸만 비운다(이 화면 안에서만, 저장하지 않음)
    for (const n of ['kreamUrl', 'size', 'memo']) form.elements[n].value = '';
    resetPreview();
    autoSize = null;
    renderSizeHint();
    syncQuick();
    updateLinkUi();
    showDone(r.data.id);
  } else {
    setStatus('error', r.error.message);
  }
});

// 이 탭에서 보낸 신청(같은 상품·사이즈 → 접수번호). 탭을 닫으면 잊는다 — 바로 구매의 twoflip.item.requests 와 같은 방식
const APPLIED_KEY = 'twoflip.apply.requests';
function appliedIds(key) {
  try { return (JSON.parse(sessionStorage.getItem(APPLIED_KEY) || '{}')[key]) || []; } catch { return []; }
}
function rememberApplied(key, id) {
  try {
    const all = JSON.parse(sessionStorage.getItem(APPLIED_KEY) || '{}');
    all[key] = [...(all[key] || []), id];
    sessionStorage.setItem(APPLIED_KEY, JSON.stringify(all));
  } catch { /* 저장 못 하면 안내만 빠진다 */ }
}

// ── 접수 완료 카드 — 폼 자리를 바꿔 끼운다(2차 QA U-3: 화면 밖 안내 · 입력이 비워져 접수번호를 놓침) ──
// 연락 시점은 아직 정해지지 않았다 — 「확보되면 연락」까지만 쓴다
const done = $('apply-done');
function showDone(id) {
  $('done-id').textContent = id;
  // 4차 QA R-4 — 정해지지 않은 시점은 정해진 것처럼 쓰지 않는다. 테스트 모드도 실제 문구를 그대로 보인다(5차 QA U-4)
  // 개편 A-4 — 연락 시점 안내는 단계 표시 아래 한 줄(「찾는 데 걸리는 시간은 상품마다 달라요」)로 옮겼다
  const real = '찾으면 적어 주신 번호로 연락드려요. 접수번호를 남겨 두세요(캡처해 두면 편해요).';
  $('done-msg').textContent = CONFIG.mode === 'demo' ? `[테스트 — 이 브라우저에만 저장, 관리자 화면에서 확인] ${real}` : real;
  $('done-copy').textContent = '복사';
  form.hidden = true;
  done.hidden = false;
  done.focus({ preventScroll: true });
  done.scrollIntoView({ block: 'center' }); // 부드러운 스크롤은 느린 기기·탭에서 멈출 수 있어 바로 옮긴다
}
$('done-copy').addEventListener('click', async () => {
  const id = $('done-id').textContent;
  let ok = false;
  try { await navigator.clipboard.writeText(id); ok = true; } catch { /* 권한 없음 — 아래에서 글자를 선택해 둔다 */ }
  if (!ok) {
    const range = document.createRange();
    range.selectNodeContents($('done-id'));
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  }
  $('done-copy').textContent = ok ? '복사됨' : '선택됨 — 길게 눌러 복사';
});
$('done-again').addEventListener('click', () => {
  done.hidden = true;
  form.hidden = false;
  urlInput.focus({ preventScroll: true });
  urlInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
});

// ── KREAM 미리보기 ─────────────────────────────────────
let previewSeq = 0;
let lastPreviewId = null;
let debounce;

function resetPreview() {
  previewSeq += 1;
  lastPreviewId = null;
  preview.hidden = true;
  chips.hidden = true;
  chips.replaceChildren();
  chipsNote = '';
  renderSizeHint();
  updateLinkUi();
}

// 사이즈 칸 아래 안내 한 줄 — 시세 칩 안내만. 주소에서 넣은 사이즈는 링크 확인 칩(「· 사이즈 270」)으로, 미리보기가 꺼졌을 때의
// 「사이즈는 직접 확인」 안내는 사이즈 빠른 선택으로 바꿨다(1단계 1-1)
let chipsNote = '';
let autoSize = null; // 주소의 ?size= 로 채운 값 — 사람이 바꾸면 칩에서 사이즈를 뺀다
function renderSizeHint() {
  const text = chipsNote;
  sizeHint.textContent = text;
  sizeHint.hidden = !text;
}

function setPreviewState(state) {
  preview.hidden = false;
  preview.dataset.state = state;
}

function renderChips(model) {
  chips.replaceChildren();
  const usable = model.sizes.filter((s) => s.price);
  chips.hidden = usable.length === 0;
  for (const s of usable) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'size-chip';
    b.setAttribute('aria-label', `사이즈 ${s.size} — ${s.basis} ${s.price}`);
    b.setAttribute('aria-pressed', String(sizeInput.value.trim().toUpperCase() === s.size));
    b.append(
      Object.assign(document.createElement('span'), { className: 's', textContent: s.size }),
      Object.assign(document.createElement('span'), { className: 'p', textContent: s.price }),
      Object.assign(document.createElement('span'), { className: 'b', textContent: s.basis }),
    );
    b.addEventListener('click', () => {
      sizeInput.value = s.size;
      syncChips();
      sizeInput.dispatchEvent(new Event('input'));
    });
    chips.append(b);
  }
  chipsNote = usable.length ? model.note + ' · 목록에 없는 사이즈는 직접 적어 주세요.' : '';
  renderSizeHint();
  updateLinkUi(); // 시세 칩이 있으면 사이즈 빠른 선택은 접는다
}

function syncChips() {
  const v = sizeInput.value.trim().toUpperCase();
  for (const b of chips.querySelectorAll('.size-chip')) {
    b.setAttribute('aria-pressed', String(b.querySelector('.s').textContent === v));
  }
}

function renderPreview(model) {
  $('pv-brand').textContent = model.brand || '';
  $('pv-title').textContent = model.title;
  $('pv-subtitle').textContent = model.subtitle || '';
  $('pv-model').textContent = model.modelNo || '';
  $('pv-buynow').textContent = model.buyNow || '';
  const img = $('pv-image');
  const box = img.parentElement;
  box.classList.toggle('no-img', !model.image);
  if (model.image) {
    img.hidden = false;
    img.onerror = () => { img.hidden = true; box.classList.add('no-img'); };
    img.src = model.image;
    img.alt = model.title;
  } else {
    img.hidden = true;
    img.removeAttribute('src');
  }
  setPreviewState('ready');
  renderChips(model);
}

// 서버가 KREAM 을 읽지 않는 설정(KREAM_SERVER=off) — 미리보기 자리를 접고 주소 칸 아래 안내 한 줄만. 이 화면에서는 다시 묻지 않는다.
let previewDisabled = false;
function previewOff() {
  previewDisabled = true;
  resetPreview();
  $('url-hint').textContent = '상품명·가격은 접수 후 저희가 확인해요.';
  updateLinkUi(); // 링크가 맞을 때만 칩 아래에 보인다
}

async function loadPreview() {
  if (previewDisabled) return;
  const k = parseKreamUrl(urlInput.value);
  if (!k.ok) { resetPreview(); return; }
  if (k.productId === lastPreviewId) return;
  if (CONFIG.mode === 'closed') return;

  const seq = ++previewSeq;
  lastPreviewId = k.productId;
  setPreviewState('loading');
  chips.hidden = true;

  const r = await api.preview(k.url);
  if (seq !== previewSeq) return; // 그 사이 주소가 바뀌었다
  if (!r.ok && r.error.code === 'kream_off') { previewOff(); return; }
  const model = r.ok ? buildPreviewModel(r.data) : null;
  if (model) {
    renderPreview(model);
  } else {
    lastPreviewId = null; // 다음에 다시 시도할 수 있게
    $('pv-error').textContent = previewFailText(r.ok ? '' : r.error.message);
    setPreviewState('error');
    chips.hidden = true;
    chipsNote = '';
    renderSizeHint();
  }
}

// 찾은 주소를 칸에 넣고, 주소의 ?size= 는 사이즈 칸이 비었을 때만 채운다
function applyExtracted(ex, raw) {
  // 같은 상품을 다시 정리할 때(칸에는 ?size= 가 지워져 있다) 처음 찾은 사이즈를 잃지 않게
  if (linkInfo.productId !== ex.productId || ex.size) linkInfo = { productId: ex.productId, size: ex.size };
  if (!parseKreamUrl(raw).ok) {
    urlInput.value = ex.url;
    urlInput.dispatchEvent(new Event('change')); // 떠 있던 주소 오류를 다시 검사
  }
  if (ex.size && !sizeInput.value.trim()) {
    sizeInput.value = ex.size;
    autoSize = ex.size;
    sizeInput.dispatchEvent(new Event('input'));
  }
}

// 칸에 들어간 글에 KREAM 주소가 하나 있으면 그 주소만 남긴다(U-1 · U-2)
function tidyUrlInput() {
  const ex = extractKreamUrl(urlInput.value);
  if (ex) applyExtracted(ex, urlInput.value);
}

urlInput.addEventListener('input', () => {
  showUrlNote('');
  updateLinkUi();
  clearTimeout(debounce);
  debounce = setTimeout(() => { tidyUrlInput(); loadPreview(); }, 450);
});
// 붙여 넣을 때는 클립보드 원문(줄바꿈 포함)에서 찾는다 — 주소 칸(type=url)은 줄바꿈을 지워 앞 글자와 붙여 버린다(2차 QA B-1)
urlInput.addEventListener('paste', (e) => {
  const text = e.clipboardData ? e.clipboardData.getData('text') : '';
  const ex = text ? extractKreamUrl(text) : null;
  if (ex) {
    e.preventDefault();
    urlInput.value = '';
    applyExtracted(ex, '');
  }
  clearTimeout(debounce);
  debounce = setTimeout(() => { tidyUrlInput(); loadPreview(); updateLinkUi(); }, 0);
});
sizeInput.addEventListener('input', () => { syncChips(); syncQuick(); renderSizeHint(); updateLinkUi(); });

// ── 링크 칸 보조(1단계 1-1) — 붙여넣기 버튼 · 링크 확인 칩 · 사이즈 빠른 선택 ──────────
// 클립보드 읽기가 없는 브라우저는 버튼을 숨긴다. 막히면(권한 거절 · 카카오톡 등 인앱) 오류창 없이 칸 아래 안내만
const canPaste = Boolean(navigator.clipboard && typeof navigator.clipboard.readText === 'function');
// 버튼이 칸 오른쪽을 차지하니 긴 안내 문구는 줄인다(버튼에 「붙여넣기」가 이미 있다)
if (canPaste) urlInput.placeholder = '「공유 → 링크 복사」 주소';
let linkInfo = { productId: null, size: null }; // 마지막으로 찾은 주소의 상품 번호 · ?size= (붙여 넣으면 칸에서는 ?size= 가 지워진다)

function showUrlNote(text) {
  $('url-note').textContent = text;
  $('url-note').hidden = !text;
}

function updateLinkUi() {
  const has = urlInput.value.trim() !== '';
  pasteBtn.hidden = !canPaste || has;
  clearBtn.hidden = !has;
  urlBox.classList.toggle('has-paste', !pasteBtn.hidden);
  urlBox.classList.toggle('has-clear', has);
  const k = parseKreamUrl(urlInput.value);
  if (!k.ok) linkInfo = { productId: null, size: null };
  else if (linkInfo.productId !== k.productId) {
    const ex = extractKreamUrl(urlInput.value); // 붙여넣기 없이 직접 친 주소
    linkInfo = { productId: k.productId, size: ex ? ex.size : null };
  }
  const shownSize = autoSize && sizeInput.value.trim().toUpperCase() === autoSize ? autoSize : null;
  $('url-check-text').textContent = k.ok ? linkCheckText(k.productId, shownSize) : '';
  $('url-check').hidden = !k.ok;
  $('url-hint').hidden = !(k.ok && previewDisabled);
  quick.hidden = !showQuickSizes({ linkOk: k.ok, linkSize: linkInfo.size, priceChips: !chips.hidden });
}

pasteBtn.addEventListener('click', async () => {
  const r = await readClipboardText(navigator.clipboard);
  if (!r.ok) {
    showUrlNote(PASTE_NOTES[r.reason]);
    urlInput.focus(); // 바로 길게 눌러 붙여 넣을 수 있게
    return;
  }
  showUrlNote('');
  // 칸에 붙여 넣을 때(paste)와 같은 처리 — 공유 문구에서 주소만 뽑고 ?size= 는 빈 사이즈 칸에만
  const ex = extractKreamUrl(r.text);
  if (ex) {
    urlInput.value = '';
    applyExtracted(ex, '');
  } else {
    urlInput.value = r.text.trim();
    urlInput.dispatchEvent(new Event('change')); // 주소가 아니면 원래 오류 문구
  }
  clearTimeout(debounce);
  tidyUrlInput();
  loadPreview();
  updateLinkUi();
  clearBtn.focus(); // 누른 버튼이 사라지니 같은 자리(지우기)로 — 키보드를 띄우지 않는다
});

clearBtn.addEventListener('click', () => {
  // 주소에서 넣은 사이즈는 그 주소와 같이 지운다(사람이 고친 사이즈는 남긴다)
  if (autoSize && sizeInput.value.trim().toUpperCase() === autoSize) sizeInput.value = '';
  autoSize = null;
  urlInput.value = '';
  showUrlNote('');
  clearTimeout(debounce);
  resetPreview();
  syncChips();
  syncQuick();
  updateLinkUi();
  urlInput.focus();
});

for (const [i, group] of QUICK_SIZES.entries()) {
  if (i) {
    const sep = Object.assign(document.createElement('span'), { className: 'size-quick-sep' });
    sep.setAttribute('aria-hidden', 'true');
    quick.append(sep);
  }
  for (const size of group) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'size-quick-chip', textContent: size });
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      sizeInput.value = size;
      autoSize = null;
      sizeInput.dispatchEvent(new Event('input'));
      sizeInput.dispatchEvent(new Event('change')); // 떠 있던 사이즈 오류를 지운다
    });
    quick.append(b);
  }
}

function syncQuick() {
  const v = sizeInput.value.trim().toUpperCase();
  for (const b of quick.querySelectorAll('.size-quick-chip')) b.setAttribute('aria-pressed', String(b.textContent === v));
}

updateLinkUi();
