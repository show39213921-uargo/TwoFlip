# 배포 — twoflip.u-argo.com (GitHub Pages)

`main` 에 머지되면 GitHub Actions(`.github/workflows/pages.yml`)가 테스트를 돌리고, 통과하면
`index.html` 과 `assets/` 만 GitHub Pages 에 올린다. 빌드 단계는 없다. **머지 = 배포**다.

## 현재 설정 (2026-10-13)

| 항목 | 값 |
|---|---|
| 레포 공개 여부 | **public** — 무료 플랜은 private 레포에 Pages 를 켤 수 없다(API 422 실측). 비밀값은 이 레포에 두지 않는다 |
| Pages 소스 | GitHub Actions |
| 커스텀 도메인 | `twoflip.u-argo.com` · HTTPS 강제 |
| DNS (iwinv) | `twoflip` `CNAME` → `show39213921-uargo.github.io` |

- 계정의 사용자 Pages 가 이미 `u-argo.com` 이라, 커스텀 도메인 없이도 `u-argo.com/TwoFlip/` 으로 열린다.
- Actions 배포에서는 `CNAME` 파일이 필요 없다. 도메인은 Settings → Pages 에 저장돼 있다.
- 도메인 탈취 방지: 계정 Settings → Pages → **Verified domains** 에서 `u-argo.com` 을 인증해 두면 좋다(TXT 레코드).

## 백엔드 연결

신청·미리보기 API 는 private 레포 `twoflip_backend`(PHP). **2026-10-14 연결:** `API_BASE_URL = 'https://wms.fivespace.kr/Testtwo/index.php'`.

| 항목 | 상태 |
|---|---|
| 배포 | `wms.fivespace.kr/Testtwo` 에 git pull (Apache 2.4.58 · mod_rewrite 꺼짐 → `/index.php/…` 모양으로 부른다) |
| 외부 점검 | `php tools/check-deploy.php https://wms.fivespace.kr/Testtwo` 전부 통과(API 200 · CORS 204 · 숨길 파일 12개 403/404) |
| 저장 | 서버 `DATA_DIR`(웹 루트 밖)의 `applications.json` — 관리자 화면 「JSON 열기」로 본다 |
| KREAM 미리보기 | **서버 IP 에서 막힘(추정)** — 쿨다운 뒤 두 번 모두 10초 대기 후 5xx(Resale 실측 차단 패턴). 같은 시각 사무실 PC 에서는 2.5초 정상. 막힌 동안은 0.1초 만에 「지금은 불러올 수 없습니다 · 신청은 그대로」로 답하고, 2→30분마다 한 번만 다시 시도해 풀리면 저절로 돌아온다. 신청은 KREAM 정보 없이 저장된다(관리자에서 브랜드·모델번호 직접 입력) |

- 백엔드 `.env` 의 `ALLOWED_ORIGINS` 에 `https://twoflip.u-argo.com` 이 있어야 한다(기본값).
- DB 를 쓰게 되면 RDS 인바운드는 **백엔드 서버의 IP(또는 보안그룹)만** 연다. GitHub Pages IP 를 열 이유는 없다 — Pages 는 DB 에 접속하지 않는다.

## 배포 순서 — 백엔드 먼저(19차)

18차에 화면(프런트)이 백엔드보다 먼저 올라가 QA 가 두 번 멈췄다. 백엔드가 바뀌는 회차는 이 순서로 한다.

1. **백엔드 + SQL 먼저** — 서버 `/Testtwo` 에서 `git pull` → 그 회차 `sql/migrations/*.sql` 실행 → `php tools/check-deploy.php https://wms.fivespace.kr/Testtwo` 전부 PASS
2. **공개 확인 주소 1개로 반영 확인** — 그 회차에 새로 생긴 공개 주소를 credentials 없이 한 번 부른다.
   예: 18차 이후 `POST /client-error` 를 본문 `{}` 로 보내면 **204**(옛 코드면 404 「없는 API 입니다.」). `/admin/…` 은 로그인 없이 부르면 없는 주소도 401 이라 반영 확인에 못 쓴다.
3. **프런트 `?v=` 올리기** — 프런트 PR 머지(Pages 배포가 `?v=커밋` 을 붙인다) → 실서버 페이지 소스의 `?v=` 가 바뀌었는지.

프런트가 먼저 올라가도 고객 화면은 깨지지 않게 만들어 두었다(19차 로컬 확인: 새 프런트 + 18차 이전 백엔드).
- 오류 전송(`/client-error`)이 404 · 네트워크 오류면 조용히 멈춘다. 다시 보내지 않고, 같은 브라우저 10분 5건 제한도 그대로다.
- 미리보기 API 가 404 면 미리보기 없이 일반 바로 구매 화면이다. 관리자 오류 조회가 404 면 「오류」 줄을 숨긴다.
- 브라우저 개발자 도구에 없는 주소를 부른 네트워크 줄(「Failed to load resource: 404」)은 남을 수 있다. 화면 코드 오류(JS)는 0이다.

## 확인

- Actions 탭에서 `Deploy Pages` 가 초록인지
- `https://twoflip.u-argo.com` 이 열리고, 신청 버튼이 「준비 중」이 아니라 활성인지(엔드포인트 설정 후)
- 브라우저 개발자 도구 Network 에서 `GET …/kream/preview` 200 · `POST …/applications` 201, CORS 오류가 없는지
