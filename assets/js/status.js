// 진행 상황(status.html · 4단계) — 확인 링크(?t=) 또는 접수번호 + 뒤 4자리로 열고, 「찾았어요」면 답을 받는다.
// 화면 값은 status-view.js(순수), 여기는 DOM 만. 외부 문자열은 textContent 로만 넣는다.
// 확인 링크 토큰은 읽자마자 주소창에서 지우고(캡처 · 공유 · 기록으로 안 새게) 이 탭(sessionStorage)에만 둔다.
// 둔 토큰은 새로고침 · 뒤로가기 때만 다시 쓴다 — 링크(바닥글 「신청한 상품 확인하기」 등)로 오면 조회 칸부터(다른 신청도 볼 수 있게).

import './error-report.js'; // 오류 알림(18차 C) — 주소 쿼리는 원래 보내지 않는다
import { CONFIG } from './config.js';
import { createApiClient } from './api.js';
import { createLocalApi } from './local-api.js';
import { createLocalStore, browserStorage } from './local-store.js';
import { statusModel, lookupCheck, REPLY_DONE, LATER } from './status-view.js';

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
let focusTo = ''; // 다시 그린 뒤 초점 — 'buy'(답 바꾸기 뒤 「구매할게요」) · 'done'(답한 뒤 결과 문장) — 22차 QA U-4

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
  for (const f of [$('st-id'), $('st-last4')]) { f.removeAttribute('aria-invalid'); f.removeAttribute('aria-describedby'); }
}

// 조회 실패 — 오류 문장(role=alert)을 칸에 잇고 초점을 첫 칸으로(바로 고치게) — 23차 QA U-1
// 서버가 거절하면 어느 칸이 틀렸는지 말하지 않으니 두 칸 다, 화면 검사(빈 칸 · 모양)면 문제 칸만 — 24차 QA U-1
function lookupFailed(text, fields = [$('st-id'), $('st-last4')]) {
  showError(text);
  for (const f of fields) { f.setAttribute('aria-invalid', 'true'); f.setAttribute('aria-describedby', 'status-error'); }
  fields[0].focus();
}

const failText = (r) => (r.error && r.error.status && r.error.message ? r.error.message : LATER); // 연결 실패 · 시간 초과는 한 가지로

function render() {
  const m = statusModel(view, Date.now(), { changing });
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
    if (focusTo === 'buy') buy.focus();
    focusTo = '';
    return;
  }
  if (kind === 'answered') {
    const parts = [];
    let done = null;
    if (justDone) { done = el('p', 'answer-done', justDone); done.setAttribute('role', 'status'); done.tabIndex = -1; parts.push(done); }
    parts.push(el('p', 'answer-sub', r.text));
    if (r.canChange) {
      const change = el('button', 'answer-link', '답 바꾸기');
      change.type = 'button';
      change.addEventListener('click', () => { changing = true; justDone = ''; focusTo = 'buy'; render(); });
      parts.push(change);
    }
    box.replaceChildren(...parts);
    if (focusTo === 'done' && done) done.focus();
    focusTo = '';
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
  focusTo = 'done';
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
  const last4 = $('st-last4').value.trim();
  const bad = lookupCheck(id, last4); // 화면 검사로 걸리면 서버에 보내지 않는다(조회 횟수 · 잠금에 안 들어감)
  if (bad) { lookupFailed(bad.message, bad.fields.map((k) => $(k === 'id' ? 'st-id' : 'st-last4'))); return; }
  const btn = $('status-submit');
  btn.disabled = true;
  showError('');
  const r = await openWith({ id, last4 }, () => api.statusLookup(id, last4));
  btn.disabled = false;
  if (!r.ok) { lookupFailed(failText(r)); return; }
  // 조회 성공 — 결과가 나온 걸 알 수 있게 상품 제목 줄로 초점 · 스크롤(동작 줄이기면 css 가 바로 이동) — 23차 QA U-1
  // 확인 링크(?t=)로 바로 열 때는 옮기지 않는다(첫 진입은 브라우저 기본)
  const title = $('st-title');
  title.focus({ preventScroll: true });
  title.scrollIntoView({ block: 'start' });
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
