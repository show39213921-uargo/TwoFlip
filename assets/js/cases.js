// 최근 진행 사례(개편 A-3) — 첫 페이지 · 소개 페이지의 #cases 구역을 채운다. 화면 값은 cases-view.js(순수), 여기는 DOM 만.
// 운영자가 「사례로 공개」를 켠 건만 서버가 준다. 0건이거나 못 받으면 구역째 숨긴 채 둔다(빈 칸 금지).
// 외부 문자열(상품명)은 textContent 로만 넣는다.

import { CONFIG } from './config.js';
import { createApiClient } from './api.js';
import { createLocalApi } from './local-api.js';
import { createLocalStore, browserStorage } from './local-store.js';
import { caseCards } from './cases-view.js';

const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});

// 소개 페이지는 이 스크립트만 쓴다 — 테스트 모드 띠도 여기서 켠다(10차 QA B-1). 첫 페이지는 app.js 도 켜지만 같은 동작이라 겹쳐도 된다
if (CONFIG.mode === 'demo') {
  const banner = document.getElementById('demo-banner');
  if (banner) banner.hidden = false;
}

async function load() {
  const box = document.getElementById('cases');
  const list = document.getElementById('cases-list');
  if (!box || !list || CONFIG.mode === 'closed') return;
  const api = CONFIG.mode === 'demo'
    ? createLocalApi({ store: createLocalStore(browserStorage()) })
    : createApiClient({ baseUrl: CONFIG.apiBaseUrl });
  const r = await api.cases();
  const cards = caseCards(r.ok ? r.data.cases : []);
  if (!cards.length) return;
  list.replaceChildren(...cards.map((m) => {
    const li = el('li', 'case' + (m.found ? '' : ' no-thumb'));
    const body = el('span', 'case-body');
    body.append(el('span', 'case-date mono', m.date), el('span', 'case-title', m.title), el('span', 'case-result' + (m.found ? ' is-found' : ''), m.label));
    if (m.found) li.append(thumb(m.image)); // 1단계 1-2 — 찾은 건만 사진 칸(못 찾은 건은 사진 없이, 흐리게 하지 않는다)
    li.append(body);
    return li;
  }));
  box.hidden = false;
}

// 사진 칸 — 꾸밈(alt="", 상품명은 옆 글자로 읽힌다). 없거나 못 불러오면 사진 줄과 같은 옷걸이 그림 + 「사진 준비 중」
function thumb(src) {
  const box = el('span', 'case-thumb');
  box.setAttribute('aria-hidden', 'true'); // 「사진 준비 중」까지 꾸밈 — 카드는 날짜 · 상품 · 결과만 읽힌다
  if (src) {
    const img = Object.assign(document.createElement('img'), { alt: '', loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer' });
    img.addEventListener('error', () => box.replaceChildren(...fallback()), { once: true });
    img.src = src;
    box.append(img);
  } else {
    box.append(...fallback());
  }
  return box;
}

function fallback() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('strip-fallback');
  for (const d of ['M24 14a4 4 0 1 1 4-4', 'M24 14v4L6 32h36L24 18']) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return [svg, el('span', 'strip-fallback-k', '사진 준비 중')];
}

load();
