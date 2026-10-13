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

신청·미리보기 API 는 private 레포 `twoflip_backend`. 서버에 올리면:

1. `assets/js/config.js` 의 `API_BASE_URL` 을 그 주소(HTTPS)로 채워 PR → 머지.
2. 백엔드 `.env` 의 `ALLOWED_ORIGINS` 에 `https://twoflip.u-argo.com` 이 있는지 확인(기본값에 포함).
3. DB 를 쓰게 되면 RDS 인바운드는 **백엔드 서버의 IP(또는 보안그룹)만** 연다. GitHub Pages IP 를 열 이유는 없다 — Pages 는 DB 에 접속하지 않는다.

## 확인

- Actions 탭에서 `Deploy Pages` 가 초록인지
- `https://twoflip.u-argo.com` 이 열리고, 신청 버튼이 「준비 중」이 아니라 활성인지(엔드포인트 설정 후)
- 브라우저 개발자 도구 Network 에서 `GET …/kream/preview` 200 · `POST …/applications` 201, CORS 오류가 없는지
