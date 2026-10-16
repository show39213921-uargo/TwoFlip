// 오류 알림(18차 C) — 브라우저 오류(window error · unhandledrejection)를 백엔드 /client-error 로 한 줄씩 보낸다.
// 보내는 것: 페이지 경로(쿼리 · # 제외) · 메시지 앞 200자 · 파일:줄 · 배포 번호. 시각은 서버가 붙인다.
// 보내지 않는 것: 입력값 · 이름 · 번호 · 쿠키. 메시지 속 따옴표 값 · 6자리 넘는 숫자 · 이메일은 여기서도 가린다(서버도 한 번 더).
// 같은 브라우저에서 10분 5건까지만(서버도 IP 당 10분 30건). 이 파일을 import 하면 한 번만 붙는다.

import { CONFIG } from './config.js';

export const MAX_SENDS = 5;
export const WINDOW_MS = 10 * 60 * 1000;
const SENT_KEY = 'twoflip.err.sent';

export function maskMessage(s) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '@…')
    .replace(/(["'])(?:(?!\1).){1,500}\1/g, '$1…$1')
    .replace(/\d[\d\s-]{5,}\d/g, '#')
    .trim()
    .slice(0, 200);
}

const stripQuery = (s) => String(s ?? '').replace(/[?#].*$/s, '').slice(0, 200);

/** 오류 이벤트 값 → 보낼 본문. 보낼 필요가 없으면 null(다른 사이트 스크립트의 「Script error.」 · 확장 프로그램 오류) */
export function buildReport({ message, filename = '', lineno = 0, path = '/', release = null }) {
  const msg = maskMessage(message);
  if (!msg || /^Script error\.?$/i.test(msg)) return null;
  if (/^(chrome|moz|safari(-web)?)-extension:/.test(filename)) return null;
  return {
    path: stripQuery(path) || '/',
    message: msg,
    where: stripQuery(filename),
    line: Number.isInteger(lineno) && lineno > 0 ? lineno : 0,
    release: release && /^(?:[0-9a-f]{6,40}|dev)$/.test(release) ? release : null,
  };
}

/** 지난 10분에 보낸 시각들(ms) → 지금 보내도 되나 + 남길 목록 */
export function allowSend(sentTimes, nowMs) {
  const recent = (Array.isArray(sentTimes) ? sentTimes : []).filter((t) => Number.isFinite(t) && nowMs - t < WINDOW_MS);
  if (recent.length >= MAX_SENDS) return { ok: false, times: recent };
  return { ok: true, times: [...recent, nowMs] };
}

/** rejection 이유 → 메시지(Error 면 「이름: 메시지」) */
export function reasonText(reason) {
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  try { return typeof reason === 'string' ? reason : JSON.stringify(reason) ?? String(reason); } catch { return String(reason); }
}

// ── 브라우저에서만 ──
function release() {
  try { return new URL(import.meta.url).searchParams.get('v') || 'dev'; } catch { return 'dev'; }
}

function send(body) {
  if (!CONFIG.apiBaseUrl || !body) return;
  let times = [];
  try { times = JSON.parse(localStorage.getItem(SENT_KEY) || '[]'); } catch { /* 처음 · 저장 불가 */ }
  const gate = allowSend(times, Date.now());
  if (!gate.ok) return;
  try { localStorage.setItem(SENT_KEY, JSON.stringify(gate.times)); } catch { /* 저장 못 하면 이번 페이지만 센다 */ }
  const url = `${CONFIG.apiBaseUrl}/client-error`;
  const text = JSON.stringify(body);
  // text/plain 이라 CORS 사전 요청이 없다. 응답은 읽지 않는다
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([text], { type: 'text/plain' }))) return;
  } catch { /* 아래로 */ }
  try { fetch(url, { method: 'POST', body: text, keepalive: true, mode: 'no-cors', headers: { 'Content-Type': 'text/plain' } }).catch(() => {}); } catch { /* 포기 */ }
}

if (typeof window !== 'undefined' && !window.__twoflipErrorReport) {
  window.__twoflipErrorReport = true;
  const rel = release();
  window.addEventListener('error', (e) => {
    if (e.target && e.target !== window) return; // 이미지 · 스크립트 못 불러옴(리소스 오류)은 화면이 따로 처리한다
    send(buildReport({ message: e.message || (e.error && reasonText(e.error)), filename: e.filename, lineno: e.lineno, path: location.pathname, release: rel }));
  }, true);
  window.addEventListener('unhandledrejection', (e) => {
    send(buildReport({ message: reasonText(e.reason), path: location.pathname, release: rel }));
  });
}
