# 신청 API 계약 (초안 v0.2)

공개 페이지는 DB 를 모른다. 페이지는 **API 에 JSON 을 보내고**, API 서버가 **안에서 저장**한다.

```
[브라우저: twoflip.u-argo.com] ──HTTPS JSON──▶ [twoflip_backend] ──▶ 저장소(지금 JSON 파일 → 이후 DB)
                                                 └ DB 접속 정보·쿼리는 여기(private 레포 + 서버 .env)에만 있다
```

- 페이지 쪽 구현: `assets/js/api.js` (전송) · `assets/js/validate.js` (검증 규칙) · `assets/js/preview-view.js` (미리보기 표시)
- 서버 쪽 구현: private 레포 `show39213921-uargo/twoflip_backend` — 이 문서가 그 레포의 정본 계약이다.
- 엔드포인트 주소는 `assets/js/config.js` 의 `API_BASE_URL` 한 곳에서 바꾼다. 로컬에서는 자동으로 `http://localhost:4410`.
- 항목은 **사업계획서 확정 전 초안**이다. 바꾸면 이 문서 · 두 레포의 `validate.js` · 테스트를 같이 바꾼다.

아래 경로는 모두 `API_BASE_URL` 뒤에 붙는다.

## `GET /health`

연결 확인용. 200 이면 된다. 본문 예: `{ "ok": true }`

## `GET /kream/preview?url=<KREAM 상품 주소>`

신청 화면에서 링크를 붙여 넣으면 부른다. **실패해도 신청은 막지 않는다** — 화면은 안내 문구만 보인다.

```json
{
  "productId": "1068133",
  "url": "https://kream.co.kr/products/1068133",
  "product": {
    "name": "Salomon UNI Cross Insulation Jacket Light Grey",
    "nameKo": "살로몬 UNI 크로스 인슐레이션 자켓 라이트 그레이",
    "brand": "Salomon",
    "modelNo": "LD0274200",
    "image": "https://kream-phinf.pstatic.net/…",
    "buyNowPrice": 317000,
    "sizes": [ { "size": "L", "recentPrice": 334000, "recentAgo": "56분 전", "lowestAsk": null, "highestBid": null } ]
  },
  "checkedAt": "2026-10-13T07:44:35.002Z", "ageMin": 0, "cached": false, "stale": false
}
```

- `buyNowPrice` = KREAM 즉시 구매가(전체 사이즈 최저 판매입찰). `sizes` 는 비로그인 페이지의 최근 5건씩이라 사이즈마다 있는 값이 다르다(없으면 `null`).
- 서버는 상품별로 30분 캐시하고, KREAM 이 5xx(요청량 제한)를 주면 2분 → 30분 동안 KREAM 에 요청하지 않는다. 그동안은 마지막 성공값(`stale: true`)을 주거나 503.

| 상태 | code | 언제 |
|---|---|---|
| 400 | `invalid_url` | KREAM 상품 주소가 아님 |
| 404 | `kream_not_found` | KREAM 에 없는 상품 |
| 429 | `rate_limited` | 같은 IP 조회 과다(10분 40회) |
| 502 | `kream_unavailable` | KREAM 페이지를 못 읽음 |
| 503 | `kream_busy` | KREAM 요청량 제한 중. `Retry-After` 헤더 |
| 503 | `kream_off` | 서버가 KREAM 을 읽지 않는 설정(`KREAM_SERVER=off`). 화면은 미리보기를 접고 「접수 후 확인」 안내만, 이 화면에서는 다시 묻지 않는다. KREAM 정보는 같은 상품 최근 신청에서 복사하거나(6시간) 사무실 PC 도구가 채운다 |

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
서버는 저장할 때 KREAM 상품 스냅샷(이름·모델번호·즉시 구매가·사이즈별 시세)을 최대 4초 기다려 같이 남긴다. 못 받으면 `kream: null` 로 저장하고 접수는 그대로 한다(`KREAM_SERVER=off` 면 처음부터 `null`).

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
| 429 | `rate_limited` | 같은 IP 반복 신청(10분 5회) |
| 5xx | `internal` | DB 저장 실패 등 |

## 바로 구매(확보 상품) — 10-14

운영자가 먼저 사 둔 상품을 공개하고 고객이 구매 요청을 남긴다. 화면은 신청 화면 「바로 구매」(`assets/js/shop.js`) · 관리자 「확보 상품」(`assets/js/admin-items.js`).
DB 저장일 때만 열린다 — 서버에 표(`twoflip_items`)가 아직 없으면 `503 items_unavailable` 이고, 화면은 메뉴째 숨는다.

### `GET /items`

```json
{ "items": [
  { "id": "df175970", "status": "on_sale", "size": "M", "title": null,
    "name": "Salomon UNI Cross Insulation Jacket Light Grey", "nameKo": "살로몬 UNI 크로스 인슐레이션 자켓 라이트 그레이",
    "brand": "Salomon", "modelNo": "LD0274200", "image": "https://kream-phinf.pstatic.net/…",
    "salePrice": 299000, "note": "새상품 · 택 있음" }
] }
```

- `status` 는 `on_sale`(판매 중) · `reserved`(예약 중)만 온다. 판매 중이 먼저.
- `salePrice` 가 `null` 이면 화면은 「가격 문의」. 「KREAM 보다 싸다」 같은 비교 문구는 쓰지 않는다.
- **매입가 · 내부 메모 · 구매 요청은 이 응답에 절대 없다.**

### `POST /items/{id}/requests`

요청 `{ name, phone, memo, consent, website }` — 신청서와 같은 검증(상품·사이즈는 서버가 상품 것으로 고정, 고객이 보낸 값은 무시). 응답 `201 { id, status, receivedAt }` — 신청 표에 `itemId` 가 달린 신청 한 건이 생긴다.

| 상태 | code | 언제 |
|---|---|---|
| 404 | `item_not_found` | 비공개 · 판매 완료 · 없는 상품 |
| 409 | `item_reserved` | 예약 중 — 화면은 목록을 다시 받는다 |
| 422 · 429 | `invalid` · `rate_limited` | 신청과 같음 |

요청은 다 받고, 운영자가 관리자 화면에서 하나를 골라 「예약 중」으로 바꾼다(`PATCH /admin/items/{id}` `{ status: 'reserved', reservedApplicationId }`). 관리자 API 전체는 `twoflip_backend` README.

## 보안 — API 쪽에서 반드시

1. **CORS**: `Access-Control-Allow-Origin` 에 신청 페이지 주소(서브도메인)만 허용한다. `*` 금지. `OPTIONS` 사전 요청에 `Content-Type` 헤더를 허용한다.
2. **재검증**: 페이지 검증은 누구나 건너뛴다. 위 표의 규칙을 서버에서 다시 검사한다.
3. **비밀값은 서버에만**: 페이지에 API 키를 넣어 인증하는 방식은 의미가 없다(공개 파일이라 누구나 읽는다). 대신 요청량 제한(429)과 필요하면 캡차로 막는다.
4. **DB 계정**: 신청 테이블에 INSERT 만 되는 전용 계정을 쓴다. 다른 서비스와 같은 계정·같은 스키마를 공유하지 않는다.
5. **개인정보**: 이름·휴대폰 번호는 개인정보다. 보관 기간과 파기 기준을 사업계획서에서 정한다. 로그에 번호를 그대로 찍지 않는다.

## 저장 — 지금은 JSON 파일

`twoflip_backend` 의 `data/applications.json`(git 제외)에 배열로 쌓는다. 레코드 = 요청 필드 + `id` · `status` · `receivedAt` · `kream`(스냅샷) · `clientIp`.
DB 로 옮길 때는 아래 테이블에 같은 필드를 넣는다(`kream` 은 JSON 컬럼).

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
  kream_snapshot   JSON         NULL,      -- 신청 시점 KREAM 상품·시세
  received_at      DATETIME     NOT NULL,
  client_ip        VARCHAR(45)  NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_size (kream_product_id, size),
  INDEX idx_status (status)
);
```

`status` 의 단계는 사업계획서의 운영 흐름이 오면 확정한다.
