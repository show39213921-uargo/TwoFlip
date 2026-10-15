// 최근 진행 사례(개편 A-3) — 화면 값만 만든다(순수). 데이터는 서버 GET /cases(운영자가 고른 것만, 공개용 칸만).
// 이름·번호·가격은 서버가 애초에 주지 않는다. 여기서도 받은 칸 중 아래 여섯 개만 쓴다(사진 image — 1단계 1-2).

// 결과 — 고객 화면 문구(해요체) · 관리자 선택지(짧게). 값은 백엔드 Repo::CASE_RESULTS 와 같다
export const CASE_RESULTS = {
  found_store: { label: '매장에서 찾음 · 연락 완료', admin: '매장에서 찾음', found: true },
  found_online: { label: '공식몰에서 찾음 · 연락 완료', admin: '공식몰에서 찾음', found: true },
  not_found: { label: '이번엔 못 찾았어요', admin: '못 찾음', found: false },
};

// 관리자 — 상태별로 고를 수 있는 결과(완료 = 찾음, 취소 = 못 찾음). 다른 상태는 공개할 수 없다
export function caseChoices(status) {
  if (status === 'completed') return ['found_store', 'found_online'];
  if (status === 'canceled') return ['not_found'];
  return [];
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const httpsUrl = (v) => (typeof v === 'string' && v.startsWith('https://') ? v : null);

// 상대 시각(3단계 P2) — 사례 날짜(한국 날짜 YYYY-MM-DD)를 오늘(한국)과 견줘 「오늘 · 어제 · n일 전」, 7일 넘으면 MM.DD.
// 날짜를 못 읽으면 빈 칸. 서버 시계가 앞서 미래 날짜면 「오늘」
const DAY = 86400000;
export function relativeDay(date, nowMs = Date.now()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(date));
  if (!m) return '';
  const today = new Date(nowMs + 9 * 3600000);
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.round((t0 - Date.UTC(+m[1], +m[2] - 1, +m[3])) / DAY);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return `${m[2]}.${m[3]}`;
}

/** 서버 한 건 → 카드 값. 알 수 없는 결과·이름 없는 건은 null(보이지 않음) */
export function caseCardModel(c, nowMs = Date.now()) {
  if (!c || typeof c !== 'object') return null;
  const r = CASE_RESULTS[c.result];
  const name = str(c.name);
  if (!r || !name) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(c.date));
  return {
    date: m ? `${m[2]}.${m[3]}` : '',
    title: [str(c.brand), name, str(c.size)].filter(Boolean).join(' · '),
    // 3단계 P2 — 브랜드(작고 굵게, 없으면 줄 없음) · 오른쪽 위 상대 시각 · 상품명 · 사이즈(굵게)
    brand: str(c.brand),
    name,
    size: str(c.size),
    when: relativeDay(c.date, nowMs),
    label: r.label,
    found: r.found,
    // 찾은 건만 사진 칸이 있다(없거나 못 불러오면 「사진 준비 중」). 못 찾은 건은 사진 칸 없이 — 흐리게 하지 않는다
    image: r.found ? httpsUrl(c.image) : null,
  };
}

/** 목록 → 보일 카드들(최대 5) */
export function caseCards(list, nowMs = Date.now()) {
  return (Array.isArray(list) ? list : []).map((c) => caseCardModel(c, nowMs)).filter(Boolean).slice(0, 5);
}
