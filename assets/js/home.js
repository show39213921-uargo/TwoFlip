// 첫 페이지(신청)에서 바로 구매로 가는 길 — 히어로 두 갈래의 「지금 N개 있어요」와 그 바로 아래 상품 사진 줄.
// 결정 ②(4차 QA R-1 · U-1): 공개 상품이 있을 때만 보인다. N 은 실제 공개 수(판매 중 · 예약 중) — 지어낸 숫자를 쓰지 않는다.
// 사진 줄(분위기 개선 1단계 · 가이드 §6): 진행 순서 아래 있던 미리보기 한 줄을 히어로로 올려 합쳤다 — 신청 칸이 더 밀리지 않게.
// 목록을 못 받으면(준비 전 · 오류 · 접수 준비 중) 아무것도 보이지 않는다 — 신청 흐름을 막지 않는다.

import { CONFIG } from './config.js';
import { createApiClient } from './api.js';
import { createLocalApi } from './local-api.js';
import { createLocalStore, browserStorage } from './local-store.js';
import { itemCardModel } from './items-view.js';

const STRIP_MAX = 4; // 좁은 화면은 CSS 로 3장까지
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});

async function load() {
  if (CONFIG.mode === 'closed') return;
  const api = CONFIG.mode === 'demo'
    ? createLocalApi({ store: createLocalStore(browserStorage()) })
    : createApiClient({ baseUrl: CONFIG.apiBaseUrl });
  const r = await api.items();
  const items = r.ok && Array.isArray(r.data.items) ? r.data.items : [];
  if (!items.length) return;

  const onSale = items.filter((i) => i.status === 'on_sale').length;
  $('path-shop-label').textContent = `지금 ${items.length}개 있어요` + (onSale < items.length ? ` · 요청 가능 ${onSale}개` : '');
  $('path-shop').hidden = false;

  // 요청할 수 있는 것부터 — 사진 줄이 「예약 중」으로만 차지 않게
  const shown = [...items].sort((a, b) => (a.status === 'on_sale' ? 0 : 1) - (b.status === 'on_sale' ? 0 : 1)).slice(0, STRIP_MAX);
  $('strip-row').replaceChildren(...shown.map((it) => stripItem(itemCardModel(it))));
  $('strip').hidden = false;
}

function stripItem(m) {
  const a = el('a', 'strip-item' + (m.reserved ? ' is-reserved' : ''));
  a.href = `shop.html#i-${encodeURIComponent(m.id)}`;
  const state = m.reserved ? '예약 중' : m.price;
  a.setAttribute('aria-label', `${m.title} 사이즈 ${m.size} ${state}`);
  const img = el('span', 'strip-img');
  if (m.image) {
    const i = Object.assign(document.createElement('img'), { src: m.image, alt: '', loading: 'lazy', decoding: 'async' });
    i.referrerPolicy = 'no-referrer';
    i.addEventListener('error', () => i.replaceWith(...fallback()), { once: true }); // KREAM 이미지 서버 실패
    img.append(i);
  } else {
    img.append(...fallback());
  }
  if (m.reserved) img.append(el('span', 'shop-flag', '예약 중'));
  const cap = el('span', 'strip-cap');
  cap.append(`${m.size} · `, el(m.reserved || !m.priceKnown ? 'span' : 'strong', null, state));
  a.append(img, cap);
  return a;
}

// 사진을 못 불러올 때 — 옷걸이 그림 + 한 줄(빈 흰 칸으로 두지 않는다)
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
