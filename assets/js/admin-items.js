// 관리자 「확보 상품」(바로 구매) — 등록 · 공개 상태 · 판매가 · 구매 요청 중 하나를 골라 예약.
// 서버(DB)에서만 관리한다. 화면 값·검증은 items-view.js(순수), 여기는 DOM 만.
// 매입가 · 내부 메모는 이 화면에만 있다(공개 API 는 보내지 않는다). 차액·예상 수익은 계산해 보이지 않는다(미정 비용이 빠진 값이라).

import { ITEM_STATUSES, itemStatusLabel, validateItem } from './items-view.js';
import { maskPhone, formatPhone, formatKst, statusLabel } from './admin-view.js';
import { formatWon } from './preview-view.js';

const FIELDS = [
  { key: 'kreamUrl', label: 'KREAM 상품 주소', placeholder: 'https://kream.co.kr/products/…', create: true, wide: true },
  { key: 'size', label: '사이즈', placeholder: '예: 270, L' },
  { key: 'salePrice', label: '판매가(원) — 비우면 「가격 문의」', placeholder: '예: 299000', mode: 'numeric' },
  { key: 'costPrice', label: '매입가(원) · 관리자만', placeholder: '예: 259000', mode: 'numeric' },
  { key: 'title', label: '공개 상품명(선택) — 비우면 KREAM 이름', placeholder: '' , wide: true },
  { key: 'note', label: '공개 설명(선택)', placeholder: '예: 새상품 · 택 있음 · 매장 구매', wide: true },
  { key: 'imageUrl', label: '사진 주소(선택, https) — 비우면 KREAM 이미지', placeholder: 'https://…', wide: true },
  { key: 'internalMemo', label: '내부 메모 · 관리자만', placeholder: '예: 강남점에서 구매, 영수증 보관', wide: true },
];

export function createItemsView({ root, h, ext, getApi, onFail, onRender = () => {} }) {
  const st = { items: [], loaded: false, loading: false, msg: null, open: new Set(), reveal: new Set() };
  const flash = (kind, text) => { st.msg = text ? { kind, text } : null; };

  async function load() {
    st.loading = true;
    render();
    const r = await getApi().listItems();
    st.loading = false;
    if (!r.ok) {
      if (r.error.kind === 'auth') { onFail(r); return; }
      flash('error', r.error.code === 'items_unavailable' ? r.error.message : `확보 상품을 불러오지 못했습니다: ${r.error.message}`);
    } else {
      st.items = r.data.items || [];
      st.loaded = true;
    }
    render();
  }

  async function call(promise, okText) {
    const r = await promise;
    if (!r.ok) {
      if (r.error.kind === 'auth') { onFail(r); return null; }
      const fields = r.error.fields ? Object.values(r.error.fields).join(' ') : '';
      flash('error', `저장하지 못했습니다: ${fields || r.error.message}`);
      render();
      return null;
    }
    if (r.data && r.data.item) st.items = st.items.map((x) => (x.id === r.data.item.id ? r.data.item : x));
    flash('', okText || '');
    render();
    return r;
  }

  // ── 등록 ─────────────────────────────────────────────
  function registerForm() {
    const inputs = {};
    const errs = {};
    const grid = h('div', { class: 'item-form-grid' }, ...FIELDS.map((f) => {
      inputs[f.key] = h('input', { type: 'text', placeholder: f.placeholder, inputmode: f.mode || null, 'aria-label': f.label });
      errs[f.key] = h('span', { class: 'field-msg', 'data-kind': 'error' });
      return h('label', { class: f.wide ? 'wide' : null }, f.label, inputs[f.key], errs[f.key]);
    }));
    const status = h('select', { 'aria-label': '처음 상태' },
      h('option', { value: 'hidden' }, '비공개로 등록(나중에 공개)'), h('option', { value: 'on_sale' }, '바로 판매 중으로 공개'));
    const submit = h('button', {
      type: 'submit', class: 'btn-sm primary', text: '등록',
    });
    const form = h('form', {
      class: 'item-register', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const raw = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value]));
        const v = validateItem({ ...raw, status: status.value }, true);
        for (const [k, el] of Object.entries(errs)) el.textContent = v.errors[k] || '';
        if (!v.ok) return;
        submit.disabled = true;
        const r = await getApi().createItem(v.value);
        submit.disabled = false;
        if (!r.ok) {
          if (r.error.kind === 'auth') { onFail(r); return; }
          for (const [k, el] of Object.entries(errs)) el.textContent = (r.error.fields && r.error.fields[k]) || '';
          flash('error', `등록하지 못했습니다: ${r.error.message}`);
          render();
          return;
        }
        st.items = [r.data.item, ...st.items];
        st.open.add(r.data.item.id);
        flash('', r.data.item.status === 'on_sale'
          ? '등록했습니다 — 「바로 구매」 페이지에 바로 보입니다.'
          : '등록했습니다(비공개). 공개하려면 상태를 「판매 중」으로 바꾸세요.');
        render();
      },
    }, grid, h('div', { class: 'item-register-actions' }, status, submit),
    h('p', { class: 'muted', text: 'KREAM 상품명·이미지는 같은 상품의 최근(6시간) 정보가 있으면 바로, 없으면 사무실 PC 가 30분 안에 채웁니다.' }));
    return h('details', { class: 'settings item-register-box', open: st.loaded && !st.items.length ? true : null },
      h('summary', {}, '＋ 확보 상품 등록'), form);
  }

  // ── 목록 ─────────────────────────────────────────────
  function card(it) {
    const k = it.kream || {};
    const img = it.imageUrl || k.image;
    const title = it.title || k.nameKo || k.name || 'KREAM 정보 대기 중';
    const reqs = it.requests || [];
    const statusSel = h('select', {
      class: 'status-sel item-status', 'data-status': it.status, 'aria-label': '공개 상태',
      onclick: (e) => e.stopPropagation(),
      onchange: (e) => {
        const to = e.target.value;
        if (it.status === 'reserved' && to !== 'sold' && !confirm('예약을 풀까요? 다른 요청을 받을 수 있게 됩니다.')) { render(); return; }
        call(getApi().patchItem(it.id, { status: to }), `「${itemStatusLabel(to)}」(으)로 바꿨습니다.`);
      },
    }, ...ITEM_STATUSES.map((s) => h('option', {
      value: s.key, selected: s.key === it.status,
      disabled: s.key === 'reserved' && it.status !== 'reserved' ? true : null, // 예약은 아래 구매 요청에서 골라서만
    }, s.key === 'reserved' && it.status !== 'reserved' ? '예약 중(요청에서 고르기)' : s.label)));

    const summary = h('summary', {},
      h('div', { class: 'thumb' }, img && String(img).startsWith('https://') ? h('img', { src: img, alt: '', referrerpolicy: 'no-referrer', loading: 'lazy' }) : '이미지 없음'),
      h('div', { class: 'sum-prod' },
        h('div', { class: 'cell-k clip' }, k.brand || '브랜드 미상', h('span', { class: 'mono rid', text: ` ${it.id}` })),
        h('div', { class: 'cell-v clip', text: title }),
        h('div', { class: 'cell-s clip' }, `${it.size} · ${formatWon(it.salePrice) || '가격 문의'}`, reqs.length ? h('span', { class: 'tag', text: `요청 ${reqs.length}` }) : null)),
      statusSel);

    const det = h('details', { class: 'app-card item-card', 'data-id': it.id, open: st.open.has(it.id) }, summary, detail(it, reqs));
    det.addEventListener('toggle', () => { if (det.open) st.open.add(it.id); else st.open.delete(it.id); });
    return det;
  }

  function detail(it, reqs) {
    const k = it.kream || {};
    // 편집 — 바꾼 칸만 보낸다
    const edits = {};
    const errs = {};
    const editable = FIELDS.filter((f) => !f.create);
    const grid = h('div', { class: 'item-form-grid' }, ...editable.map((f) => {
      const cur = it[f.key];
      edits[f.key] = h('input', { type: 'text', value: cur == null ? '' : String(cur), inputmode: f.mode || null, 'aria-label': f.label });
      errs[f.key] = h('span', { class: 'field-msg', 'data-kind': 'error' });
      return h('label', { class: f.wide ? 'wide' : null }, f.label, edits[f.key], errs[f.key]);
    }));
    const save = h('button', {
      type: 'button', class: 'btn-sm primary', text: '저장',
      onclick: () => {
        const changed = {};
        for (const f of editable) {
          const now = edits[f.key].value.trim();
          const was = it[f.key] == null ? '' : String(it[f.key]);
          if (now !== was) changed[f.key] = now;
        }
        if (!Object.keys(changed).length) { flash('', '바뀐 칸이 없습니다.'); render(); return; }
        const v = validateItem(changed, false);
        for (const [key, el] of Object.entries(errs)) el.textContent = v.errors[key] || '';
        if (!v.ok) return;
        call(getApi().patchItem(it.id, v.value), '저장했습니다.');
      },
    });

    const kUrl = typeof it.kreamUrl === 'string' && /^https:\/\/kream\.co\.kr\/products\/\d+$/.test(it.kreamUrl) ? it.kreamUrl : null;
    const kreamLine = h('p', { class: 'muted' }, 'KREAM: ', kUrl ? ext(kUrl, kUrl.replace('https://', '')) : '—',
      ` · ${it.kream ? `확인 ${formatKst(k.checkedAt)}${k.via === 'copy' ? ' · 같은 상품 정보 복사' : k.via === 'office' ? ' · 사무실 PC' : ''}` : 'KREAM 정보 대기 중(사무실 PC 가 채움)'}`,
      ` · 등록 ${formatKst(it.createdAt)}${it.createdBy ? ` · ${it.createdBy}` : ''}`);

    // 같은 번호로 여러 번 요청 — 막지 않고 표시만(결정 ④)
    const byPhone = reqs.reduce((m, q) => m.set(q.phone, (m.get(q.phone) || 0) + 1), new Map());
    const reqList = reqs.length
      ? h('ol', { class: 'item-requests' }, ...reqs.map((q) => {
        const mine = it.reservedApplicationId === q.id;
        const shown = st.reveal.has(q.id);
        const dup = byPhone.get(q.phone) || 1;
        return h('li', { class: mine ? 'is-reserved' : null },
          h('div', {},
            h('strong', { text: q.name }), ' ', dup > 1 ? h('span', { class: 'tag warn', text: `같은 번호 요청 ${dup}건` }) : null, ' ',
            h('span', { class: 'mono', text: shown ? formatPhone(q.phone) : maskPhone(q.phone) }), ' ',
            h('button', { type: 'button', class: 'link-btn', text: shown ? '가리기' : '보기', onclick: () => { if (shown) st.reveal.delete(q.id); else st.reveal.add(q.id); render(); } }),
            h('div', { class: 'sub' }, `${formatKst(q.receivedAt)} · 접수번호 `, h('span', { class: 'mono', text: q.id }), ` · 신청 상태 ${statusLabel(q.status)}`, q.memo ? ` · 「${q.memo}」` : '')),
          mine
            ? h('span', { class: 'tag ok-tag', text: '예약됨' })
            : h('button', {
              type: 'button', class: 'btn-sm', text: '이 요청으로 예약', disabled: it.status === 'sold' ? true : null,
              onclick: () => {
                // 한 번 누르면 바로 공개 화면이 바뀌므로 한 번 묻는다(3차 QA U-5)
                if (!confirm(`${q.name} 님 요청으로 예약할까요?
「바로 구매」 페이지에 「예약 중」으로 바뀌고, 새 구매 요청은 받지 않습니다.`)) return;
                call(getApi().patchItem(it.id, { status: 'reserved', reservedApplicationId: q.id }), `${q.name} 님 요청으로 예약했습니다 — 「바로 구매」 페이지에서 「예약 중」으로 보입니다.`);
              },
            }));
      }))
      : h('p', { class: 'muted', text: '아직 구매 요청이 없습니다.' });

    const del = h('button', {
      type: 'button', class: 'btn-sm danger', text: '이 상품 삭제', disabled: reqs.length ? true : null,
      title: reqs.length ? '구매 요청이 있어 지울 수 없습니다 — 「비공개」나 「판매 완료」로 바꾸세요.' : null,
      onclick: async () => {
        if (!confirm('이 확보 상품을 지울까요? 되돌릴 수 없습니다.')) return;
        const r = await getApi().deleteItem(it.id);
        if (!r.ok) { if (r.error.kind === 'auth') { onFail(r); return; } flash('error', r.error.message); render(); return; }
        st.items = st.items.filter((x) => x.id !== it.id);
        flash('', '지웠습니다.');
        render();
      },
    });

    return h('div', { class: 'detail' },
      h('div', { class: 'panel full' }, h('h3', {}, h('span', { class: 'n', text: '01' }), '상품 · 공개 정보'), kreamLine, grid,
        h('div', { class: 'row-actions' }, save)),
      h('div', { class: 'panel full' }, h('h3', {}, h('span', { class: 'n', text: '02' }), `구매 요청 ${reqs.length}건`),
        reqList,
        h('p', { class: 'muted', style: 'margin-top:8px', text: '요청은 「신청」 목록에도 「바로 구매」 표시로 들어옵니다 — 연락·상태 변경은 거기서. 예약을 풀려면 위 상태를 「판매 중」으로.' }),
        h('div', { class: 'row-actions' }, del)));
  }

  function render() {
    const head = h('div', { class: 'items-head' },
      h('p', { class: 'src-note', 'data-kind': st.msg ? st.msg.kind : '', text: st.loading ? '불러오는 중…' : (st.msg ? st.msg.text : `확보 상품 ${st.items.length}건 — 「판매 중」·「예약 중」만 「바로 구매」 페이지에 보입니다.`) }),
      h('button', { type: 'button', class: 'btn-sm', text: '새로고침', disabled: st.loading ? true : null, onclick: () => load() }));
    root.replaceChildren(head, registerForm(),
      h('div', { class: 'app-list' }, ...(st.items.length ? st.items.map(card) : [h('div', { class: 'empty' }, h('p', { text: st.loaded ? '등록한 확보 상품이 없습니다. 위 「확보 상품 등록」으로 시작하세요.' : '' }))])));
    onRender();
  }

  const titleOf = (id) => {
    const it = st.items.find((x) => x.id === id);
    if (!it) return null;
    const k = it.kream || {};
    return `${it.title || k.nameKo || k.name || 'KREAM 정보 대기 중'} · ${it.size}`;
  };

  async function openItem(id) {
    st.open.add(id);
    if (!st.loaded) await load(); else render();
    const el = root.querySelector(`.item-card[data-id="${CSS.escape(id)}"]`);
    if (el) el.scrollIntoView({ block: 'start' });
    else { flash('error', '그 확보 상품을 찾지 못했습니다(지워졌을 수 있습니다).'); render(); }
  }

  return {
    titleOf,
    openItem,
    preload() { if (!st.loaded && !st.loading) load(); },
    show() { if (!st.loaded && !st.loading) load(); else render(); },
    reset() { st.items = []; st.loaded = false; st.msg = null; st.open.clear(); st.reveal.clear(); root.replaceChildren(); },
    count: () => (st.loaded ? st.items.length : null),
  };
}
