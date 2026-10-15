// 신청서 링크 칸 보조(1단계 1-1) — 붙여넣기 버튼 · 링크 확인 칩 · 사이즈 빠른 선택. 순수 함수만(브라우저 · node:test 공용).
// 상품명은 쓰지 않는다 — 실제 모드는 KREAM 상품명을 모른다(지어내지 않는다).

// 링크 확인 칩 문구. size 는 주소의 ?size= 로 넣었고 아직 그대로일 때만 붙인다
export function linkCheckText(productId, size) {
  if (!productId) return '';
  return `KREAM 상품 ${productId} 확인했어요` + (size ? ` · 사이즈 ${size}` : '');
}

// 사이즈 빠른 선택 — 무리(숫자 · 글자 · FREE) 사이에 가는 칸막이
export const QUICK_SIZES = [
  ['230', '240', '250', '260', '270', '280'],
  ['S', 'M', 'L', 'XL'],
  ['FREE'],
];

// 사이즈 칩 줄은 라디오 묶음(11차 QA U-1) — Tab 한 번으로 들어가 ←→(↑↓) · Home · End 로 옮긴다. 끝에서 처음으로 돈다.
// 다른 키면 null(기본 동작 그대로)
export function rovingIndex(current, key, count) {
  if (!count) return null;
  const i = current < 0 ? 0 : current;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (i + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (i - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

// 링크가 맞고, 주소에 사이즈가 없고, KREAM 시세 칩도 없을 때만 보인다
export function showQuickSizes({ linkOk, linkSize, priceChips }) {
  return Boolean(linkOk && !linkSize && !priceChips);
}

// 붙여넣기 버튼 — 클립보드 읽기. 오류를 던지지 않고 결과만 돌려준다(오류창을 띄우지 않게)
//   unsupported: 읽기 기능 없음(버튼을 숨긴다) · denied: 권한 거절 · 인앱 브라우저 · empty: 복사한 글 없음
export async function readClipboardText(clipboard) {
  if (!clipboard || typeof clipboard.readText !== 'function') return { ok: false, reason: 'unsupported' };
  let text;
  try { text = await clipboard.readText(); } catch { return { ok: false, reason: 'denied' }; }
  if (!String(text ?? '').trim()) return { ok: false, reason: 'empty' };
  return { ok: true, text: String(text) };
}

export const PASTE_NOTES = {
  unsupported: '칸을 길게 눌러 붙여넣어 주세요.',
  denied: '칸을 길게 눌러 붙여넣어 주세요.',
  empty: '복사한 링크가 없어요. KREAM 앱에서 「공유 → 링크 복사」를 먼저 해 주세요.',
};
