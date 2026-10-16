// 진행 상황 화면(4단계) — 단계 · 한 줄 안내 · 답하기 모양. 순수 함수(브라우저 · node:test 공용).
// 단계 규칙은 백엔드 src/Status/Stage.php 와 같다(테스트 모드는 이 파일로 계산한다).

export const STAGE_LINE = {
  received: '저희가 확인하고 찾기 시작할게요.',
  searching: '공식몰 · 매장 · 해외를 직접 확인하고 있어요.',
  found: '문자로 가격을 보내 드렸어요. 아래에서 답해 주세요.',
  not_found: '이번엔 찾지 못했어요. 다른 상품도 링크만 보내 주시면 찾아볼게요.',
  done: '', // 마무리 — 안내 문장은 두지 않는다(브리프에 없음)
};
// 답이 있거나 기한이 지나 버튼이 없을 때 「찾았어요」 한 줄(22차 QA U-2)
export const FOUND_LINE_DONE = '문자로 가격을 보내 드렸어요.';
export const REPLY_LABEL = { buy: '구매할게요', pass: '이번엔 괜찮아요' };
export const REPLY_DONE = {
  buy: '답을 받았어요. 입금 방법을 곧 문자로 알려 드릴게요.',
  pass: '알겠어요. 다음에 또 찾을 게 있으면 링크만 보내 주세요.',
};
export const CHANGE_MIN = 30;
export const WRONG = '접수번호나 번호를 다시 확인해 주세요.';
export const LATER = '잠시 후 다시 시도해 주세요.';

/** 관리자 상태 · 연락 종류 · 살 수 있는 기록 → 단계(백엔드 Stage::of 와 같다) */
export function stageOf(status, contactKind, hasBuyable) {
  if (status === 'paid' || status === 'completed') return 'done';
  if (status === 'canceled') return 'not_found';
  if (contactKind === 'not_found') return 'not_found';
  if (contactKind === 'found') return 'found';
  if (status === 'contacted') return hasBuyable ? 'found' : 'searching';
  if (status === 'sourcing' || status === 'secured') return 'searching';
  return 'received';
}

/** 4칸 — 완료 카드와 같은 모양. state: done(지난 칸) · now(지금) · miss(못 찾음) · todo */
export function stepsOf(stage) {
  const third = stage === 'not_found' ? '이번엔 못 찾았어요' : '찾았어요';
  const at = { received: 0, searching: 1, found: 2, not_found: 2, done: 3 }[stage] ?? 0;
  return ['접수됨', '찾는 중', third, '마무리'].map((label, i) => ({
    label,
    state: i < at ? 'done' : i > at ? 'todo' : (stage === 'not_found' ? 'miss' : 'now'),
  }));
}

// 한국 시각 — 「10.16 14:20」 · 기한은 요일까지 「10.17(금) 18:00」
const KST = 9 * 3600 * 1000;
const pad = (n) => String(n).padStart(2, '0');
export function kstTime(iso, { weekday = false } = {}) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t + KST);
  const wd = weekday ? `(${'일월화수목금토'[d.getUTCDay()]})` : '';
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}${wd} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export function receivedText(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  return m ? `${Number(m[2])}.${Number(m[3])} 접수` : '';
}

/**
 * 답하기 상자 — 「찾았어요」 단계에서만.
 * ask(버튼 둘 · 기한 줄) · answered(답한 시각 · 30분 안이면 「답 바꾸기」) · expired(기한 지남) · hidden
 */
export function replyModel(view, nowMs) {
  if (!view || view.stage !== 'found') return { kind: 'hidden' };
  if (view.reply === 'buy' || view.reply === 'pass') {
    const at = Date.parse(view.replyAt);
    return {
      kind: 'answered',
      text: `${kstTime(view.replyAt)}에 「${REPLY_LABEL[view.reply]}」로 답하셨어요.`,
      canChange: Number.isFinite(at) && nowMs - at <= CHANGE_MIN * 60 * 1000,
    };
  }
  const dl = Date.parse(view.replyDeadline);
  if (Number.isFinite(dl) && nowMs > dl) return { kind: 'expired', text: '답장 기한이 지났어요. 문자로 연락 주세요.' };
  return { kind: 'ask', deadline: Number.isFinite(dl) ? `${kstTime(view.replyDeadline, { weekday: true })}까지 답해 주시면 잡아 둘게요.` : '' };
}

/** 화면에 그릴 값 하나로 — changing = 「답 바꾸기」를 눌러 버튼을 다시 보이는 중 */
export function statusModel(view, nowMs, { changing = false } = {}) {
  const reply = replyModel(view, nowMs);
  const noButtons = reply.kind === 'expired' || (reply.kind === 'answered' && !changing);
  return {
    title: view.name || '신청하신 상품',
    size: view.size || '',
    received: receivedText(view.receivedDate),
    steps: stepsOf(view.stage),
    line: view.stage === 'found' && noButtons ? FOUND_LINE_DONE : (STAGE_LINE[view.stage] ?? ''),
    reply,
  };
}

/** 테스트 모드(이 브라우저) — 신청 기록 → 서버와 같은 칸 7개 */
export function viewOfRecord(r, { replyHours = null } = {}) {
  const k = r.kream || {};
  const hasBuyable = (r.sourcing || []).some((c) => c && (c.stock === 'in' || c.stock === 'low'));
  const stage = stageOf(r.status, r.contact && r.contact.kind, hasBuyable);
  const sent = r.contact && Date.parse(r.contact.at);
  const t = Date.parse(r.receivedAt);
  return {
    name: (k.nameKo || k.name || '').trim() || null,
    size: String(r.size || ''),
    receivedDate: Number.isFinite(t) ? new Date(t + KST).toISOString().slice(0, 10) : null,
    stage,
    reply: r.reply ? r.reply.answer : null,
    replyAt: r.reply ? r.reply.at : null,
    replyDeadline: stage === 'found' && replyHours && Number.isFinite(sent) ? new Date(sent + replyHours * 3600 * 1000).toISOString().replace('.000Z', 'Z') : null,
  };
}
