# 배포 — 서브도메인 → GitHub Pages

`main` 에 머지되면 GitHub Actions(`.github/workflows/pages.yml`)가 테스트를 돌리고, 통과하면
`index.html` 과 `assets/` 만 GitHub Pages 에 올린다. 빌드 단계는 없다.

## 한 번만 하는 설정 (레포 주인이 직접)

### 0. 플랜 확인 — 비공개 레포

이 레포는 **private** 이다. GitHub Pages 를 private 레포에서 쓰려면 **GitHub Pro 이상**이 필요하다.
무료 플랜이면 셋 중 하나를 고른다.

| 선택 | 비용 | 비고 |
|---|---|---|
| GitHub Pro 로 올린다 | 유료 | 설정은 아래 그대로 |
| 레포를 public 으로 바꾼다 | 무료 | 페이지 코드는 어차피 공개된다. 비밀값은 레포에 없어야 한다(`config.js` 주석 참고) |
| Cloudflare Pages 등에 레포를 연결 | 무료 | 같은 정적 파일. 이 워크플로 대신 그쪽 git 연동을 쓴다 |

### 1. Pages 켜기

Settings → Pages → **Build and deployment → Source: GitHub Actions**

### 2. DNS — 서브도메인 연결

도메인 DNS 관리 화면에서 레코드 하나를 추가한다.

| 타입 | 이름(호스트) | 값 |
|---|---|---|
| `CNAME` | 쓸 서브도메인 (예: `flip`) | `show39213921-uargo.github.io` |

- 루트 도메인이 아니라 서브도메인이라 A 레코드는 필요 없다.
- Cloudflare 를 쓰면 처음엔 프록시(주황 구름)를 끄고(DNS only) 인증서 발급이 끝난 뒤 판단한다.

### 3. 커스텀 도메인 등록

Settings → Pages → **Custom domain** 에 `flip.<도메인>` 을 넣고 Save → DNS 확인이 끝나면 **Enforce HTTPS** 체크.

- Actions 배포에서는 `CNAME` 파일이 필요 없다. 도메인은 이 설정 화면에 저장된다.
- 도메인 탈취 방지: 계정 Settings → Pages → **Verified domains** 에서 루트 도메인을 인증해 둔다(TXT 레코드).

### 4. API 연결

테스트 엔드포인트를 받으면 `assets/js/config.js` 의 `API_BASE_URL` 을 채워 PR → 머지.
API 쪽 CORS 허용 주소에 `https://flip.<도메인>` 을 넣어야 브라우저가 요청을 보낸다(`docs/api-contract.md` §보안).

## 확인

- Actions 탭에서 `Deploy Pages` 가 초록인지
- `https://flip.<도메인>` 이 열리고, 신청 버튼이 「준비 중」이 아니라 활성인지(엔드포인트 설정 후)
- 브라우저 개발자 도구 Network 에서 `POST …/applications` 가 201 인지, CORS 오류가 없는지
