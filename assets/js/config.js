// 배포 설정 — 백엔드(twoflip_backend)를 서버에 올리면 API_BASE_URL 한 줄만 바꾼다.
//
// ⚠ 이 파일은 공개 페이지와 같이 배포돼 누구나 읽는다. API 키·DB 접속 정보 같은 비밀값을 절대 넣지 않는다.
//   DB 연결은 백엔드 서버 안에서만 한다(docs/api-contract.md §보안).

import { resolveMode } from './mode.js';

// twoflip_backend(PHP) — wms.fivespace.kr/Testtwo 에 배포. 서버에 mod_rewrite 가 없어 /index.php/… 모양으로 부른다.
// 2026-10-14 외부 IP 배포 점검(tools/check-deploy.php) 전부 통과 후 연결. 비우면 「준비 중」(테스트 모드는 ?demo=1)
const API_BASE_URL = 'https://wms.fivespace.kr/Testtwo/index.php';

// 로컬 개발: 프론트(npm run dev, 4400) + 백엔드(twoflip_backend npm start, 4410)
const isLocal = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname);
const LOCAL_API = 'http://localhost:4410';
const apiBaseUrl = isLocal ? LOCAL_API : API_BASE_URL;

const DEMO_SESSION_KEY = 'twoflip.demo';
function sessionGet() { try { return globalThis.sessionStorage?.getItem(DEMO_SESSION_KEY) ?? null; } catch { return null; } }
function sessionSet(v) { try { if (v === '1') globalThis.sessionStorage?.setItem(DEMO_SESSION_KEY, '1'); else globalThis.sessionStorage?.removeItem(DEMO_SESSION_KEY); } catch { /* 저장 불가 — 이번 페이지만 */ } }

const m = resolveMode({ search: globalThis.location?.search || '', sessionFlag: sessionGet(), apiBaseUrl });
if (m.demoFlag) sessionSet(m.demoFlag);

export const CONFIG = {
  apiBaseUrl,
  isLocal,
  mode: m.mode, // 'api' | 'demo' | 'closed'
};
