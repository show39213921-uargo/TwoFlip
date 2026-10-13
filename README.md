# TwoFlip

KREAM 상품 링크로 신청받아, 공식몰·오프라인 매장에서 상품을 확보한 뒤 신청자에게 연락해 전달하는 구매대행 서비스.

- 공개 페이지: https://twoflip.u-argo.com (이 레포, public · GitHub Pages)
- API: private 레포 `twoflip_backend` (신청 저장 · KREAM 상품 미리보기)

> 상태: v0.3 — 신청 페이지 + KREAM 미리보기 + **임시 관리자 화면** + **테스트 모드**. 신청 저장은 백엔드의 JSON 파일(이후 DB). 서비스 소개·가격 기준·운영 흐름은 사업계획서 확정 후 채운다.

## 서버 없이 화면만으로 확인하기

| 주소 | 하는 일 |
|---|---|
| `/?demo=1` | **테스트 모드** — 신청이 서버로 가지 않고 이 브라우저(localStorage)에 저장된다. 상단 연두색 띠로 표시. `/?demo=0` 으로 끈다. 주소로 직접 켤 때만 켜진다(일반 방문자는 「준비 중」 그대로) |
| `/admin.html` | **임시 관리자** — 「이 브라우저」의 테스트 신청, 또는 「JSON 열기」로 연 파일(백엔드 `data/applications.json` 등)을 본다. 밖으로 보내는 요청이 없어 공개돼도 노출되는 데이터가 없다 |

관리자 화면의 신청 한 건 = ① KREAM(주소·즉시 구매가·신청 사이즈 시세·사이즈표) ② 공식 홈페이지(공식몰·모델번호 검색) ③ 근처 오프라인 판매처(「지역 + 브랜드 매장」 네이버·카카오 지도, 나이키는 매장 찾기) ④ 해외 공식몰(나라별 모델번호 검색) ⑤ 소싱 후보(발품으로 찾은 가격 기록 → 원화 환산 → 최저가 · KREAM 대비) ⑥ 신청자.
상태 7단계(접수 → 탐색 중 → 확보 → 연락 완료 → 결제 완료 → 완료 / 취소), 필터·검색, JSON·CSV 내보내기, 샘플 넣기.
브랜드 표는 `assets/js/brands.js` — 2026-10-13 에 주소를 열어 확인한 8개 브랜드. 모르는 브랜드는 일반 검색으로 보낸다.

## 구조

```
index.html                 공개 신청 페이지
admin.html                 임시 관리자(서버 없음 — 이 브라우저 데이터 · 직접 연 JSON)
assets/js/config.js        API 엔드포인트 한 곳 + 모드(api · demo · closed) — 비밀값 금지(공개 파일)
assets/js/mode.js          모드 판정(?demo=1/0)
assets/js/local-store.js   테스트 모드 저장소(localStorage) · local-api.js 가 서버 대신 쓴다
assets/js/admin*.js        관리자 화면(admin-view.js = 순수 계산)
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
