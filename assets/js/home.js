// 첫 페이지(신청)에서 바로 구매로 가는 길 — 히어로 두 갈래의 「지금 있는 상품 N개」와 진행 순서 아래 미리보기 한 줄.
// 결정 ②(4차 QA R-1 · U-1): 공개 상품이 있을 때만 보인다. N 은 실제 공개 수(판매 중 · 예약 중) — 지어낸 숫자를 쓰지 않는다.
// 목록을 못 받으면(준비 전 · 오류 · 접수 준비 중) 아무것도 보이지 않는다 — 신청 흐름을 막지 않는다.

import { CONFIG } from './config.js';
import { createApiClient } from './api.js';
import { createLocalApi } from './local-api.js';
import { createLocalStore, browserStorage } from './local-store.js';
import { itemCardModel } from './items-view.js';

const PEEK_MAX = 6;
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
  $('path-shop-label').textContent = `확보해 둔 상품 ${items.length}개` + (onSale < items.length ? ` · 요청 가능 ${onSale}개` : '');
  $('path-shop').hidden = false;

  $('peek-row').replaceChildren(...items.slice(0, PEEK_MAX).map((it) => peekCard(itemCardModel(it))));
  $('peek').hidden = false;
}

function peekCard(m) {
  const a = el('a', 'peek-card' + (m.reserved ? ' is-reserved' : ''));
  a.href = `shop.html#i-${encodeURIComponent(m.id)}`;
  const img = el('div', 'peek-img');
  if (m.image) {
    const i = Object.assign(document.createElement('img'), { src: m.image, alt: '', loading: 'lazy' });
    i.referrerPolicy = 'no-referrer';
    img.append(i);
  }
  if (m.reserved) img.append(el('span', 'shop-flag', '예약 중'));
  // 사진 작게 + 이름 한 줄 + 사이즈·가격·상태 — 미리보기 높이를 줄여 신청 칸이 덜 밀리게(5차 QA U-2 · D-1). 칩은 실제로 입력된 값만
  const text = el('span', 'peek-text');
  text.append(el('span', 'peek-title', m.title), el('span', 'peek-meta', [`사이즈 ${m.size}`, m.price, ...(m.noteChips || []).slice(0, 1)].join(' · ')));
  a.append(img, text);
  return a;
}

load();
