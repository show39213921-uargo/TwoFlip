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

## 확인

- Actions 탭에서 `Deploy Pages` 가 초록인지
- `https://twoflip.u-argo.com` 이 열리고, 신청 버튼이 「준비 중」이 아니라 활성인지(엔드포인트 설정 후)
- 브라우저 개발자 도구 Network 에서 `GET …/kream/preview` 200 · `POST …/applications` 201, CORS 오류가 없는지
