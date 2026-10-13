# 신청 API 계약 (초안 v0.1)

공개 페이지는 DB 를 모른다. 페이지는 **API 에 JSON 을 보내고**, API 서버가 **안에서 DB 에 연결해 저장**한다.

```
[브라우저: 서브도메인 정적 페이지] ──HTTPS JSON──▶ [신청 API] ──DB 접속──▶ [DB]
                                                   └ DB 접속 정보는 여기에만 있다
```

- 페이지 쪽 구현: `assets/js/api.js` (전송) · `assets/js/validate.js` (검증 규칙)
- 엔드포인트 주소는 `assets/js/config.js` 의 `API_BASE_URL` 한 곳에서 바꾼다.
- 로컬 목업: `dev/server.js` 가 이 문서의 모양을 그대로 흉내 낸다.
- 항목은 **사업계획서 확정 전 초안**이다. 바꾸면 이 문서 · `validate.js` · 테스트를 같이 바꾼다.

아래 경로는 모두 `API_BASE_URL` 뒤에 붙는다.

## `GET /health`

연결 확인용. 200 이면 된다. 본문 예: `{ "ok": true }`

## `POST /applications`

### 요청

`Content-Type: application/json`

| 필드 | 타입 | 규칙 |
|---|---|---|
| `kreamUrl` | string | 정규화된 `https://kream.co.kr/products/<숫자>` (쿼리·www 제거됨) |
| `kreamProductId` | string | 위 주소의 숫자 부분 |
| `size` | string | 1~20자 |
| `name` | string | 1~30자 |
| `phone` | string | 숫자만, `^01[016789]\d{7,8}$` |
| `memo` | string | 0~500자 |
| `consent` | boolean | `true` 만 허용 (개인정보 수집·이용 동의) |

```json
{
  "kreamUrl": "https://kream.co.kr/products/1068133",
  "kreamProductId": "1068133",
  "size": "270",
  "name": "홍길동",
  "phone": "01012345678",
  "memo": "",
  "consent": true
}
```

### 응답

**성공 — 201 (또는 200)**. `id` 가 **반드시** 있어야 한다. 페이지는 `id` 가 없으면 접수됐다고 보이지 않는다.

```json
{ "id": "a1b2c3d4", "status": "received", "receivedAt": "2026-10-13T07:30:00Z" }
```

**실패 — 4xx/5xx**. 페이지는 `error.message` 를 그대로 신청자에게 보여 준다(한국어로).

```json
{ "error": { "code": "invalid", "message": "사이즈를 적어 주세요.", "fields": { "size": "…" } } }
```

| 상태 | code | 언제 |
|---|---|---|
| 400 | `bad_json` | 본문이 JSON 이 아님 |
| 413 | `too_large` | 본문이 너무 큼(목업 기준 16KB) |
| 422 | `invalid` | 검증 실패. `fields` 에 칸별 사유 |
| 429 | `rate_limited` | 같은 IP·번호 반복 신청 |
| 5xx | `internal` | DB 저장 실패 등 |

## 보안 — API 쪽에서 반드시

1. **CORS**: `Access-Control-Allow-Origin` 에 신청 페이지 주소(서브도메인)만 허용한다. `*` 금지. `OPTIONS` 사전 요청에 `Content-Type` 헤더를 허용한다.
2. **재검증**: 페이지 검증은 누구나 건너뛴다. 위 표의 규칙을 서버에서 다시 검사한다.
3. **비밀값은 서버에만**: 페이지에 API 키를 넣어 인증하는 방식은 의미가 없다(공개 파일이라 누구나 읽는다). 대신 요청량 제한(429)과 필요하면 캡차로 막는다.
4. **DB 계정**: 신청 테이블에 INSERT 만 되는 전용 계정을 쓴다. 다른 서비스와 같은 계정·같은 스키마를 공유하지 않는다.
5. **개인정보**: 이름·휴대폰 번호는 개인정보다. 보관 기간과 파기 기준을 사업계획서에서 정한다. 로그에 번호를 그대로 찍지 않는다.

## 저장 테이블 초안

```sql
CREATE TABLE applications (
  id               VARCHAR(16)  PRIMARY KEY,
  status           VARCHAR(20)  NOT NULL DEFAULT 'received', -- received → sourcing → secured → contacted → paid → completed | canceled
  kream_url        VARCHAR(255) NOT NULL,
  kream_product_id VARCHAR(20)  NOT NULL,
  size             VARCHAR(20)  NOT NULL,
  name             VARCHAR(30)  NOT NULL,
  phone            VARCHAR(11)  NOT NULL,
  memo             VARCHAR(500) NOT NULL DEFAULT '',
  consent_at       DATETIME     NOT NULL,
  client_ip        VARCHAR(45)  NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_size (kream_product_id, size),
  INDEX idx_status (status)
);
```

`status` 의 단계는 사업계획서의 운영 흐름이 오면 확정한다.
