// 신청 페이지 연결부 — 검증(validate.js)과 전송(api.js)은 순수 모듈이고, 여기는 DOM 만 다룬다.

import { CONFIG } from './config.js';
import { createApiClient } from './api.js';
import { validateApplication } from './validate.js';

const api = createApiClient({ baseUrl: CONFIG.apiBaseUrl });

const form = document.getElementById('apply-form');
const submitBtn = document.getElementById('apply-submit');
const statusBox = document.getElementById('apply-status');

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
    const msg = errors[el.dataset.errorFor] || '';
    el.textContent = msg;
    const input = form.elements[el.dataset.errorFor];
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  const first = Object.keys(errors)[0];
  if (first && form.elements[first]) form.elements[first].focus();
}

function setStatus(kind, text) {
  statusBox.hidden = !text;
  statusBox.dataset.kind = kind;
  statusBox.textContent = text;
}

if (!CONFIG.apiBaseUrl) {
  submitBtn.disabled = true;
  setStatus('info', '신청 접수 준비 중입니다. 곧 열립니다.');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('', '');

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
    setStatus('ok', `신청이 접수되었습니다. 접수번호 ${r.data.id} — 상품을 확보하면 적어 주신 번호로 연락드립니다.`);
  } else {
    setStatus('error', r.error.message);
  }
});
