// 결정 대기 자리(18차 D) — 문의 창구 · 수수료 · 결제 시점 · 「못 찾으면」 안내. 값은 config.js 의 PENDING(재영 결정 후 채움).
// 값이 비어 있으면 아무것도 만들지 않는다(자리 요소는 hidden 그대로 — 화면은 한 픽셀도 바뀌지 않는다).
// 값은 해요체 문장 그대로 글자로만 넣는다(textContent). 이 파일을 import 하면 지금 페이지의 자리를 한 번 채운다.
//
// 자리(HTML 의 data-pending):
//   첫 페이지 완료 카드 아래   data-pending="contact notFound payment"
//   바로 구매 요청 창 안내     data-pending="fee payment contact"
//   소개 「자주 묻는 질문」 끝  data-pending-faq

import { PENDING } from './config.js';

const KEYS = ['contact', 'fee', 'payment', 'notFound'];

/** 자리 하나에 넣을 문장들 — 비었거나 글자가 아닌 값은 뺀다 */
export function pendingLines(spec, pending = PENDING) {
  return String(spec || '').split(/\s+/).filter((k) => KEYS.includes(k))
    .map((k) => (typeof pending?.[k] === 'string' ? pending[k].trim() : ''))
    .filter(Boolean);
}

/** 소개 「자주 묻는 질문」에 붙일 { q, a } — 둘 다 있는 것만 */
export function pendingFaq(pending = PENDING) {
  return (Array.isArray(pending?.faq) ? pending.faq : [])
    .filter((x) => x && typeof x.q === 'string' && typeof x.a === 'string' && x.q.trim() && x.a.trim())
    .map((x) => ({ q: x.q.trim(), a: x.a.trim() }));
}

export function fillPendingSlots(doc = globalThis.document, pending = PENDING) {
  if (!doc) return;
  for (const slot of doc.querySelectorAll('[data-pending]')) {
    const lines = pendingLines(slot.dataset.pending, pending);
    if (!lines.length) continue;
    slot.replaceChildren(...lines.map((t) => Object.assign(doc.createElement('p'), { textContent: t })));
    slot.hidden = false;
  }
  for (const slot of doc.querySelectorAll('[data-pending-faq]')) {
    const faq = pendingFaq(pending);
    if (!faq.length) continue;
    // 소개 페이지 기존 질문과 같은 모양(<details><summary>…</summary><p>…</p></details>)
    slot.replaceWith(...faq.map(({ q, a }) => {
      const d = doc.createElement('details');
      if (slot.dataset.pendingFaq) d.className = slot.dataset.pendingFaq;
      d.append(Object.assign(doc.createElement('summary'), { textContent: q }), Object.assign(doc.createElement('p'), { textContent: a }));
      return d;
    }));
  }
}

fillPendingSlots();
