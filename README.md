# TwoFlip

KREAM 상품 링크로 신청받아, 공식몰·오프라인 매장에서 상품을 확보한 뒤 신청자에게 연락해 전달하는 구매대행 서비스.

> 상태: 기초 셋팅(v0.1). 서비스 소개·가격 기준·운영 흐름은 사업계획서 확정 후 채운다.

## 구조

```
index.html              공개 신청 페이지 (서브도메인으로 배포)
assets/js/config.js     API 엔드포인트 한 곳 — 비밀값 금지(공개 파일)
assets/js/api.js        신청 API 클라이언트 (POST /applications)
assets/js/validate.js   신청서 검증 규칙 — 페이지·목업 API 공용
assets/js/kream-url.js  KREAM 상품 URL 검증·정규화
dev/server.js           로컬 개발 서버 + 목업 API (배포 안 됨)
docs/api-contract.md    API 요청·응답 계약, 보안, 저장 테이블 초안
docs/deploy.md          서브도메인 DNS · GitHub Pages 설정
```

페이지는 DB 를 모른다. 신청 데이터는 API 로 보내고, API 서버가 안에서 DB 에 연결해 저장한다.

## 로컬 실행

Node 20 이상. 설치할 패키지 없음.

```bash
npm run dev     # http://localhost:4400 — 목업 API 로 신청이 dev/data/applications.json 에 쌓인다
npm test
```

## 배포

`main` 머지 → Actions 가 테스트 후 GitHub Pages 로 배포. 처음 한 번의 Pages·DNS 설정은 [docs/deploy.md](docs/deploy.md).

## 엔드포인트 연결

테스트 엔드포인트를 받으면 `assets/js/config.js` 의 `API_BASE_URL` 만 바꾼다. 응답 모양은 [docs/api-contract.md](docs/api-contract.md).
