// 진행 상황(status.html · 4단계) — 확인 링크(?t=) 또는 접수번호 + 뒤 4자리로 열고, 「찾았어요」면 답을 받는다.
// 화면 값은 status-view.js(순수), 여기는 DOM 만. 외부 문자열은 textContent 로만 넣는다.
// 확인 링크 토큰은 읽자마자 주소창에서 지우고(캡처 · 공유 · 기록으로 안 새게) 이 탭(sessionStorage)에만 둔다.
// 둔 토큰은 새로고침 · 뒤로가기 때만 다시 쓴다 — 링크(바닥글 「신청한 상품 확인하기」 등)로 오면 조회 칸부터(다른 신청도 볼 수 있게).

import './error-report.js'; // 오류 알림(18차 C) — 주소 쿼리는 원래 보내지 않는다
import { CONFIG } from './config.js';
import { createApiClient } from './api.js';
import { createLocalApi } from './local-api.js';
import { createLocalStore, browserStorage } from './local-store.js';
import { statusModel, REPLY_DONE, LATER } from './status-view.js';

const api = CONFIG.mode === 'demo'
  ? createLocalApi({ store: createLocalStore(browserStorage()) })
  : createApiClient({ baseUrl: CONFIG.apiBaseUrl });
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});
const TOKEN_KEY = 'twoflip.status.t';

if (CONFIG.mode === 'demo') $('demo-banner').hidden = false;

let auth = null;   // { t } 또는 { id, last4 } — 답할 때 같은 걸로
let view = null;   // 서버가 준 칸 7개
let justDone = ''; // 방금 답했을 때 한 줄(새로 그려도 남게)
let changing = false;

function takeToken() {
  const url = new URL(location.href);
  const t = url.searchParams.get('t');
  if (t) {
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* 이번 화면만 */ }
    url.searchParams.delete('t');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    return t;
  }
  const nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
  const again = Boolean(nav && (nav.type === 'reload' || nav.type === 'back_forward'));
  try {
    if (again) return sessionStorage.getItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* 저장 불가 */ }
  return null;
}

function showError(text) {
  const e = $('status-error');
  e.textContent = text || '';
  e.hidden = !text;
}

const failText = (r) => (r.error && r.error.status && r.error.message ? r.error.message : LATER); // 연결 실패 · 시간 초과는 한 가지로

function render() {
  const m = statusModel(view, Date.now());
  $('status-form').hidden = true;
  $('status-lede').hidden = true; // 조회한 뒤에는 「접수번호와 … 확인해요」 안내가 필요 없다(접수 날짜는 카드에)
  $('st-title').textContent = m.size ? `${m.title} · ` : m.title;
  if (m.size) $('st-title').append(el('strong', null, m.size));
  $('st-meta').textContent = m.received;
  $('st-steps').replaceChildren(...m.steps.map((s) => {
    const li = el('li', s.state === 'now' ? 'is-now' : s.state === 'done' ? 'is-done' : s.state === 'miss' ? 'is-miss' : null);
    if (s.state === 'now' || s.state === 'miss') li.setAttribute('aria-current', 'step');
    const dot = el('span', 'done-dot');
    dot.setAttribute('aria-hidden', 'true');
    if (s.state === 'now' || s.state === 'done') dot.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>'; // 고정 그림
    li.append(dot, el('span', null, s.label));
    return li;
  }));
  $('st-line').textContent = m.line;
  $('st-line').hidden = !m.line;
  $('status-result').hidden = false;
  renderAnswer(m.reply);
  $('st-note').hidden = view.stage === 'not_found' || view.stage === 'done';
  $('st-apply').hidden = view.stage !== 'not_found';
}

function renderAnswer(r) {
  const box = $('st-answer');
  const kind = changing && r.kind === 'answered' ? 'ask' : r.kind;
  box.hidden = kind === 'hidden';
  if (kind === 'hidden') { box.replaceChildren(); return; }
  if (kind === 'ask') {
    const buy = el('button', 'btn btn-lime btn-block', '구매할게요');
    const pass = el('button', 'btn btn-on-dark btn-block', '이번엔 괜찮아요');
    buy.type = 'button';
    pass.type = 'button';
    buy.addEventListener('click', () => answer('buy', [buy, pass]));
    pass.addEventListener('click', () => answer('pass', [buy, pass]));
    const parts = [];
    if (r.deadline) parts.push(el('p', 'answer-sub', r.deadline));
    const err = el('p', 'answer-err');
    err.id = 'st-answer-err';
    err.setAttribute('role', 'alert');
    err.hidden = true;
    box.replaceChildren(...parts, buy, pass, err);
    return;
  }
  if (kind === 'answered') {
    const parts = [];
    if (justDone) { const p = el('p', 'answer-done', justDone); p.setAttribute('role', 'status'); parts.push(p); }
    parts.push(el('p', 'answer-sub', r.text));
    if (r.canChange) {
      const change = el('button', 'answer-link', '답 바꾸기');
      change.type = 'button';
      change.addEventListener('click', () => { changing = true; justDone = ''; render(); });
      parts.push(change);
    }
    box.replaceChildren(...parts);
    return;
  }
  box.replaceChildren(el('p', 'answer-done', r.text)); // expired
}

async function answer(kind, buttons) {
  for (const b of buttons) b.disabled = true;
  const r = await api.statusReply(auth, kind);
  if (!r.ok) {
    for (const b of buttons) b.disabled = false;
    const err = $('st-answer-err');
    if (err) { err.textContent = failText(r); err.hidden = false; }
    return;
  }
  view = r.data;
  changing = false;
  justDone = REPLY_DONE[kind];
  render();
}

async function openWith(nextAuth, fetcher) {
  const r = await fetcher();
  if (!r.ok) return r;
  auth = nextAuth;
  view = r.data;
  render();
  return r;
}

$('status-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('st-id').value.trim().toLowerCase();
  const last4 = $('st-last4').value.replace(/\D/g, '');
  if (!id || last4.length !== 4) { showError('접수번호나 번호를 다시 확인해 주세요.'); return; }
  const btn = $('status-submit');
  btn.disabled = true;
  showError('');
  const r = await openWith({ id, last4 }, () => api.statusLookup(id, last4));
  btn.disabled = false;
  if (!r.ok) showError(failText(r));
});
$('st-last4').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });

const t = takeToken();
if (t) {
  openWith({ t }, () => api.status(t)).then((r) => {
    if (r.ok) return;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* 없음 */ }
    showError(failText(r)); // 링크가 틀렸거나 기한이 지났으면 직접 조회로
  });
}
