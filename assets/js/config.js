// 배포 설정 — 백엔드(twoflip_backend)를 서버에 올리면 API_BASE_URL 한 줄만 바꾼다.
//
// ⚠ 이 파일은 공개 페이지와 같이 배포돼 누구나 읽는다. API 키·DB 접속 정보 같은 비밀값을 절대 넣지 않는다.
//   DB 연결은 백엔드 서버 안에서만 한다(docs/api-contract.md §보안).

const API_BASE_URL = ''; // 예: 'https://api.u-argo.com/twoflip' — 비어 있으면 신청 버튼이 「준비 중」을 보인다

// 로컬 개발: 프론트(npm run dev, 4400) + 백엔드(twoflip_backend npm start, 4410)
const isLocal = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname);
const LOCAL_API = 'http://localhost:4410';

export const CONFIG = {
  apiBaseUrl: isLocal ? LOCAL_API : API_BASE_URL,
  isLocal,
};
