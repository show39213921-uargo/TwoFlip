// 신청 페이지 연결부 — 검증(validate.js)·전송(api.js)·미리보기 값(preview-view.js)은 순수 모듈이고, 여기는 DOM 만 다룬다.
// 외부(KREAM) 문자열은 textContent 로만 넣는다.

import { CONFIG } from './config.js';
import { createApiClient } from './api.js';
import { createLocalApi } from './local-api.js';
import { createLocalStore, browserStorage } from './local-store.js';
import { validateApplication } from './validate.js';
import { parseKreamUrl } from './kream-url.js';
import { buildPreviewModel } from './preview-view.js';

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
  setStatus('info', '신청 접수 준비 중입니다. 곧 열립니다.');
}
if (CONFIG.mode === 'demo') $('demo-banner').hidden = false;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('', null);

  const v = validateApplication(readForm());
  if (v.spam) { setStatus('ok', '신청이 접수되었습니다.'); form.reset(); return; } // 봇에게 거절 사유를 알려주지 않는다
  showErrors(v.errors);
  if (!v.ok) return;

  submitBtn.disabled = true;
  submitBtn.textContent = '보내는 중…';
  const r = await api.submitApplication(v.payload);
  submitBtn.disabled = false;
  submitBtn.textContent = '신청하기';

  if (r.ok) {
    form.reset();
    resetPreview();
    if (CONFIG.mode === 'demo') setStatus('ok', ['테스트 신청이 이 브라우저에 저장되었습니다. 접수번호 ', { strong: r.data.id }, ' — 관리자 화면에서 확인하세요.']);
    else setStatus('ok', ['신청이 접수되었습니다. 접수번호 ', { strong: r.data.id }, ' — 상품을 확보하면 적어 주신 번호로 연락드립니다.']);
    statusBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else {
    setStatus('error', r.error.message);
  }
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
  sizeHint.hidden = true;
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
  sizeHint.hidden = usable.length === 0;
  sizeHint.textContent = model.note + ' · 목록에 없는 사이즈는 직접 적어 주세요.';
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

async function loadPreview() {
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
  const model = r.ok ? buildPreviewModel(r.data) : null;
  if (model) {
    renderPreview(model);
  } else {
    lastPreviewId = null; // 다음에 다시 시도할 수 있게
    $('pv-error').textContent = (r.ok ? '상품 정보를 읽지 못했습니다.' : r.error.message) + ' 신청은 그대로 진행할 수 있어요.';
    setPreviewState('error');
    chips.hidden = true;
    sizeHint.hidden = true;
  }
}

urlInput.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(loadPreview, 450);
});
urlInput.addEventListener('paste', () => {
  clearTimeout(debounce);
  debounce = setTimeout(loadPreview, 0);
});
sizeInput.addEventListener('input', syncChips);
