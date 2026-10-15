# TwoFlip

KREAM 상품 링크로 신청받아, 공식몰·오프라인 매장에서 상품을 확보한 뒤 신청자에게 연락해 전달하는 구매대행 서비스.

- 공개 페이지: https://twoflip.u-argo.com (이 레포, public · GitHub Pages)
- API: private 레포 `twoflip_backend` (신청 저장 · KREAM 상품 미리보기)

> 상태: v0.3 — 신청 페이지 + KREAM 미리보기 + **임시 관리자 화면** + **테스트 모드**. 신청 저장은 백엔드의 JSON 파일(이후 DB). 서비스 소개·가격 기준·운영 흐름은 사업계획서 확정 후 채운다.

## 서버 없이 화면만으로 확인하기

| 주소 | 하는 일 |
|---|---|
| `/?demo=1` | **테스트 모드** — 신청이 서버로 가지 않고 이 브라우저(localStorage)에 저장된다. 상단 연두색 띠로 표시. `/?demo=0` 으로 끈다. 주소로 직접 켤 때만 켜진다(일반 방문자는 「준비 중」 그대로) |
| `/admin.html` | **관리자** — 출처 세 가지. **서버**: 운영자 아이디·비밀번호로 로그인해 백엔드 DB 의 실제 신청을 보고 고친다(3명이 같은 데이터, 누가 바꿨는지 기록. 계정은 서버에서 `php tools/team.php add`). **이 브라우저**: 테스트 모드 신청·샘플. **JSON 파일**: 직접 연 파일. 로그인 없이는 서버 데이터가 하나도 안 보인다 |

관리자 화면의 신청 한 건 = ① KREAM(주소·즉시 구매가·신청 사이즈 시세·사이즈표) ② 공식 홈페이지(공식몰·모델번호 검색) ③ 근처 오프라인 판매처(「지역 + 브랜드 매장」 네이버·카카오 지도, 나이키는 매장 찾기) ④ 해외 공식몰(나라별 모델번호 검색) ⑤ **재고 확인**(고객이 보낸 상품·사이즈를 어디서·언제 확인했나 — 재고 있음/소량/품절/확인 불가, 확인 시각·「오래됨」, 지금 다시 확인함, 신청 사이즈·살 수 있음·최근 확인만으로 최저가 → 원화 · KREAM 대비) ⑥ 신청자.
목록에 신청마다 재고 요약(재고 미확인 / 재고 있음 N곳 · 최저 / 재고 없음 / 오래된 확인만), 「재고 확인 필요」 필터. 지금 재고 기록은 전부 수동이다(자동 조회처럼 표시하지 않음). 재고 확인은 구매가 아니다 — 사면 상태를 「확보」로 바꾼다.
상태 7단계(접수 → 탐색 중 → 확보 → 연락 완료 → 결제 완료 → 완료 / 취소), 필터·검색, JSON·CSV 내보내기, 샘플 넣기.
브랜드 표는 `assets/js/brands.js` — 2026-10-13 에 주소를 열어 확인한 8개 브랜드. 모르는 브랜드는 일반 검색으로 보낸다.

## 구조

```
index.html                 공개 신청 페이지
admin.html                 임시 관리자(서버 없음 — 이 브라우저 데이터 · 직접 연 JSON)
assets/js/config.js        API 엔드포인트 한 곳 + 모드(api · demo · closed) — 비밀값 금지(공개 파일)
assets/js/mode.js          모드 판정(?demo=1/0)
assets/js/local-store.js   테스트 모드 저장소(localStorage) · local-api.js 가 서버 대신 쓴다
assets/js/admin*.js        관리자 화면(admin-view.js = 순수 계산, admin-api.js = 서버 관리자 API 클라이언트)
assets/js/brands.js        브랜드 → 공식 홈페이지 · 매장 찾기 · 해외 공식몰(확인된 주소만)
assets/js/sourcing.js      소싱 후보 원화 환산 · 최저가 · KREAM 대비
assets/demo/               샘플 신청(실제 KREAM 스냅샷 + 가상 고객·후보 가격)
assets/js/api.js           API 클라이언트 (POST /applications · GET /kream/preview)
assets/js/validate.js      신청서 검증 규칙 — 백엔드와 같은 파일
assets/js/kream-url.js     KREAM 상품 URL 검증·정규화 — 백엔드와 같은 파일
assets/js/preview-view.js  미리보기 응답 → 화면 값(외부 문자열은 textContent 로만)
dev/server.js              로컬 정적 서버 (배포 안 됨)
docs/api-contract.md       API 요청·응답 계약 — 두 레포의 정본
docs/deploy.md             도메인·DNS·Pages 현재 설정
docs/design-guide.md       디자인 가이드 — 원칙 · 브랜드 · 색 · 글자 · 부품 · 문구 · 정리 계획(QA 디자인 제안의 판단 기준)
docs/operating.md          운영자 3명용 한 쪽 — 신청 1건 처리 순서(375 기준 14번) · 주의
docs/qa-template.md        정기 QA 틀(Claude in Chrome 용) — 매 회차 0번(회차 · 배포 번호 · 이번에 바뀐 것)만 채워 넘긴다(12차~)
docs/qa-prompt.md          (지난 기록) 화면 QA · UI/UX 제안 지시서 — 다른 세션·사람에게 그대로 넘긴다(계정 비밀번호는 별도 전달)
docs/ux-review-mobile-prompt.md  2차 UI/UX · 소비자 편의 디자인 제안 지시서(모바일 우선, 10-14 반영분 기준) — Claude in Chrome 용
assets/img/                워드마크(twoflip-logo-white.svg) · 스플래시(twoflip-splash.svg) · 공유 미리보기(og-home.png · og-shop.png, 1200×630)
dev/stamp.js               배포 때 CSS·JS 주소와 모듈 import 에 ?v=커밋 을 붙인다(Pages 10분 캐시로 새 HTML·옛 CSS 가 섞이지 않게) — pages.yml 에서 실행
404.html                   없는 주소 화면(GitHub Pages 가 어느 주소에서나 보여 줌 — 경로는 전부 / 로 시작)
about.html                 소개 페이지 — 진행 순서 그림 3컷 · 누가 하나요 · 자주 묻는 질문(첫 페이지는 신청서만, 개편 A-2)
shop.html                  바로 구매 페이지(신청 index.html 과 따로 — 헤더 「소개 · 바로 구매 · 신청하기」로 오간다)
test/site-files.test.js    맨 위 페이지가 배포 복사 목록(pages.yml)과 로컬 서버 공개 목록에 모두 있는지
assets/js/shop.js          바로 구매 — 확보 상품 목록 · 구매 요청 시트(목록을 못 받으면 이유와 「신청하기」 안내)
assets/js/admin-items.js   관리자 「확보 상품」 — 등록 · 공개 상태 · 판매가 · 구매 요청 중 하나를 골라 예약
assets/js/items-view.js    바로 구매 화면 값 · 입력 검증(순수, 백엔드 validateItem 과 같은 규칙)
assets/demo/sample-items.json  테스트 모드(?demo=1) 바로 구매 샘플 3개(판매 중 · 가격 문의 · 예약 중)
assets/demo/sample-cases.json  테스트 모드 최근 진행 사례 샘플 3개(「[샘플]」 — 찾음 둘(사진 있음 · 사진 없음) · 못 찾음 하나)
assets/js/cases.js · cases-view.js  최근 진행 사례(개편 A-3) — 첫 페이지 · 소개 페이지 구역 채우기 · 화면 값(순수). 관리자 「사례 공개」는 admin.js
assets/js/splash.js        처음 진입 스플래시 → 헤더 로고로 이동(이 탭 첫 진입만 · 움직임 줄이기면 건너뜀)
```

페이지는 DB 를 모른다. 신청 데이터는 API 로 보내고, 저장은 백엔드가 한다.

## 로컬 실행

Node 20 이상. 설치할 패키지 없음. 백엔드를 같이 띄운다.

```bash
npm run dev     # http://localhost:4400 — API 는 자동으로 http://localhost:4410 (twoflip_backend 의 npm start)
npm test
```

## 배포

`main` 머지 → Actions 가 테스트 후 GitHub Pages 로 배포. 설정은 [docs/deploy.md](docs/deploy.md).
