// 페이지 동작 모드 — 순수 함수.
//   api    : 백엔드로 보낸다(API 주소가 있을 때)
//   demo   : 브라우저 저장소에 넣는다(주소에 ?demo=1 — 같은 탭에서는 계속 유지, ?demo=0 으로 끈다)
//   closed : 신청을 받지 않는다(「준비 중」)
// 공개 사이트에서 일반 방문자가 테스트 모드로 신청하고 「접수됐다」고 믿는 일이 없도록, 데모는 주소로 직접 켤 때만이다.

export function resolveMode({ search = '', sessionFlag = null, apiBaseUrl = '' } = {}) {
  const q = new URLSearchParams(search).get('demo');
  const demoFlag = q === '1' || q === '0' ? q : null;
  const demo = demoFlag ? demoFlag === '1' : sessionFlag === '1';
  if (demo) return { mode: 'demo', demo: true, demoFlag };
  return { mode: apiBaseUrl ? 'api' : 'closed', demo: false, demoFlag };
}
