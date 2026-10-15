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
    const li = el('li', 'case');
    const body = el('span', 'case-body');
    body.append(el('span', 'case-title', m.title), el('span', 'case-result' + (m.found ? ' is-found' : ''), m.label));
    li.append(el('span', 'case-date mono', m.date), body);
    return li;
  }));
  box.hidden = false;
}

load();
