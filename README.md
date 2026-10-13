# TwoFlip

KREAM 상품 링크로 신청받아, 공식몰·오프라인 매장에서 상품을 확보한 뒤 신청자에게 연락해 전달하는 구매대행 서비스.

- 공개 페이지: https://twoflip.u-argo.com (이 레포, public · GitHub Pages)
- API: private 레포 `twoflip_backend` (신청 저장 · KREAM 상품 미리보기)

> 상태: v0.2 — 신청 페이지 + KREAM 미리보기. 신청 저장은 백엔드의 JSON 파일(이후 DB). 서비스 소개·가격 기준·운영 흐름은 사업계획서 확정 후 채운다.

## 구조

```
index.html                 공개 신청 페이지
assets/js/config.js        API 엔드포인트 한 곳 — 비밀값 금지(공개 파일)
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
