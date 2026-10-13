// 배포 설정 — 테스트 엔드포인트를 받으면 API_BASE_URL 한 줄만 바꾼다.
//
// ⚠ 이 파일은 공개 페이지와 같이 배포돼 누구나 읽는다. API 키·DB 접속 정보 같은 비밀값을 절대 넣지 않는다.
//   DB 연결은 API 서버 안에서만 한다(docs/api-contract.md §보안).

const API_BASE_URL = ''; // 예: 'https://api.example.com/twoflip/v1' — 비어 있으면 신청 버튼이 「준비 중」을 보인다

// 로컬 개발(npm run dev)에서는 같은 서버의 목업 API 로 보낸다.
const isLocal = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname);

export const CONFIG = {
  apiBaseUrl: isLocal ? '/api' : API_BASE_URL,
  isLocal,
};
