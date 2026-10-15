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

/** 서버 한 건 → 카드 값. 알 수 없는 결과·이름 없는 건은 null(보이지 않음) */
export function caseCardModel(c) {
  if (!c || typeof c !== 'object') return null;
  const r = CASE_RESULTS[c.result];
  const name = str(c.name);
  if (!r || !name) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(c.date));
  return {
    date: m ? `${m[2]}.${m[3]}` : '',
    title: [str(c.brand), name, str(c.size)].filter(Boolean).join(' · '),
    label: r.label,
    found: r.found,
    // 찾은 건만 사진 칸이 있다(없거나 못 불러오면 「사진 준비 중」). 못 찾은 건은 사진 칸 없이 — 흐리게 하지 않는다
    image: r.found ? httpsUrl(c.image) : null,
  };
}

/** 목록 → 보일 카드들(최대 5) */
export function caseCards(list) {
  return (Array.isArray(list) ? list : []).map(caseCardModel).filter(Boolean).slice(0, 5);
}
