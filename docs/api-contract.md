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
{ "id": "a1b2c3d4", "status": "received", "receivedAt": "2026-10-13T07:30:00Z", "statusToken": "a1b2c3d4.Zx…(32자)" }
```

`statusToken` 은 서버에 `STATUS_SECRET` 이 있을 때만 붙는다(4단계). 완료 카드 「진행 상황 보기 →」가 `status.html?t=<statusToken>` 으로 간다. 없으면 버튼은 `status.html`(직접 조회)로 간다.

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

운영자가 먼저 사 둔 상품을 공개하고 고객이 구매 요청을 남긴다. 화면은 바로 구매 페이지 `shop.html`(`assets/js/shop.js`) · 관리자 「확보 상품」(`assets/js/admin-items.js`).
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
- 같은 IP 10분 600회를 넘으면 429 `rate_limited`. 미리보기(40회)와 따로 센다 — 첫 페이지·바로 구매를 열 때마다 부르므로(9차 QA B-1, backend #12). 막히면 화면은 「다시 불러오기」를 보이고 첫 페이지는 사진 줄을 숨긴다.
- 200 응답은 `Cache-Control: public, max-age=60` — 브라우저가 60초 재사용한다(오류 · 429 는 `no-store`). 「예약 중이라 요청 못 함」(409) 직후와 「다시 불러오기」는 `items({ fresh: true })` 로 캐시를 건너뛴다. 구매 요청 자체는 서버가 상태를 다시 보므로 낡은 목록으로 예약 중 상품에 요청이 들어가지 않는다.

### `POST /items/{id}/requests`

요청 `{ name, phone, memo, consent, website }` — 신청서와 같은 검증(상품·사이즈는 서버가 상품 것으로 고정, 고객이 보낸 값은 무시). 응답 `201 { id, status, receivedAt }` — 신청 표에 `itemId` 가 달린 신청 한 건이 생긴다.

| 상태 | code | 언제 |
|---|---|---|
| 404 | `item_not_found` | 비공개 · 판매 완료 · 없는 상품 |
| 409 | `item_reserved` | 예약 중 — 화면은 목록을 다시 받는다 |
| 422 · 429 | `invalid` · `rate_limited` | 신청과 같음 |

요청은 다 받고, 운영자가 관리자 화면에서 하나를 골라 「예약 중」으로 바꾼다(`PATCH /admin/items/{id}` `{ status: 'reserved', reservedApplicationId }`). 관리자 API 전체는 `twoflip_backend` README.

## 최근 진행 사례 — 10-14(개편 A-3)

### `GET /cases`

```json
{ "cases": [
  { "date": "2026-10-12", "brand": "Salomon", "name": "살로몬 UNI 크로스 인슐레이션 자켓", "size": "L", "result": "found_store", "image": "https://kream-phinf.pstatic.net/…png" }
] }
```

- `image`(1단계 1-2, backend #15): 켤 때 떠 둔 사진 주소(https) — 바로 구매 요청이면 그 확보 상품 사진, 아니면 신청의 KREAM 사진. 없으면 `null`(화면은 「사진 준비 중」), `not_found` 는 항상 `null`(화면은 사진 칸 없이). 마이그레이션 `2026-10-15_case_image` 전이면 늘 `null`.

- 운영자가 관리자 화면 「사례 공개」를 켠 완료·취소 신청만, 최근 5건. **자동 공개는 없다.**
- `result`: `found_store`(매장에서 찾음 · 연락 완료) · `found_online`(공식몰에서 찾음 · 연락 완료) · `not_found`(이번엔 못 찾았어요). 화면 문구는 `assets/js/cases-view.js`.
- **이름 · 번호 · 가격 · 접수번호는 응답에 절대 없다** — 서버가 켤 때 공개용 칸만 따로 떠 두고 그것만 읽는다. `date` 는 완료·취소로 바뀐 한국 날짜.
- 제한·캐시는 `GET /items` 와 같다(같은 IP 10분 600회 · 200 은 60초 캐시). 사례 표가 아직 없으면 `{ cases: [] }`. 0건이거나 실패하면 화면은 구역을 숨긴다.
- 관리자: `PUT /admin/applications/{id}/case` `{ result }` 켜기 · `DELETE` 끄기(완료 = 찾음 둘, 취소 = 못 찾음). 신청 목록 각 건에 `case: { result, date } | null`.
- 응답 칸(`date · brand · name · size · result · image`)은 백엔드 테스트로 고정돼 있다(18차 B) — 칸이 늘거나 이름 · 번호 · 접수번호 · 판매처 · 가격 · 메모가 나오면 실패.

## 미리보기 · 오류 알림 — 10-15(18차)

### 미리보기(관리자 세션 전용 — 공개 응답은 그대로)
- `GET /admin/items/{id}/preview` → `{ item }` — 상태와 상관없이 `GET /items` 한 건과 같은 칸. `X-TwoFlip-Key` 필요(없으면 401).
- `POST /admin/items/{id}/preview-requests` — 본문은 `POST /items/{id}/requests` 와 같다. **이름에 `[QA]` 가 있을 때만** 201, 아니면 422 `preview_only`(「미리보기 상품에는 요청할 수 없습니다.」). 예약 중 · 판매 완료면 409.
- 바로 구매 화면은 `shop.html?preview={id}` 이고, 이 브라우저에 관리자 세션 키가 있을 때만 위 둘을 부른다. 없으면 `preview` 를 무시한다.
- `GET /items` 는 **`[QA]` 구매 요청으로 예약된 상품을 빼고** 준다 — 비공개 상품을 미리보기로 예약해도 「예약 중」으로 드러나지 않게. 실제 손님 예약은 그대로 보인다. 예약한 요청(신청)이 지워져 없는 「예약 중」 상품도 뺀다(19차).

### 오류 알림
- `POST /client-error` — 본문 `{ path, message, where, line, release }`(text/plain JSON, `sendBeacon`). 204, 같은 IP 10분 30건(넘으면 429). 브라우저도 10분 5건까지만 보낸다(`assets/js/error-report.js`).
  저장은 경로(쿼리 · # 제외) · 메시지 앞 200자(따옴표 속 값 · 6자리 넘는 숫자 · 이메일 가림) · 파일:줄 · 배포 번호 · 서버 시각뿐. 입력값 · 이름 · 번호 · 쿠키 · IP 는 받지도 남기지도 않는다.
- 서버 500 도 같은 표에 한 줄(요청 경로 · 예외 종류와 메시지 앞 200자, 같은 가림).
- `GET /admin/errors` → `{ count, qaCount, ready, recent: [...], qa: [...] }` — 각 줄 `{ source: front|back, path, message, location, release, at }`. `count` · `recent` 는 최근 24시간 **진짜 오류**(최근 20건), 메시지에 `[QA]` 가 든 오류(QA 가 일부러 낸 것)는 `qaCount` · `qa` 로 따로 준다(19차 U-3). 표가 없으면(마이그레이션 `2026-10-15_errors` 전) `{ count: 0, qaCount: 0, recent: [], qa: [], ready: false }`.
- `DELETE /admin/errors/qa` → `{ deleted }` — `[QA]` 오류 기록만 지운다. 다른 오류는 지우는 API 가 없다(30일 지나면 로그인 때 자동 정리).

## 진행 상황 조회 · 확인 링크 · 답하기 — 10-16(4단계)

토큰 = `{접수번호}.{HMAC-SHA256(STATUS_SECRET, "status:"+접수번호) 앞 32자, URL-safe}`. **DB 에 저장하지 않는다** — 같은 신청이면 완료 카드 · 관리자 06 이 늘 같은 링크를 쓴다. 접수 뒤 30일이 지나면 410. `STATUS_SECRET` 이 없거나 마이그레이션 `2026-10-16_status` 전이면 아래 전부 503 `status_unavailable`. 응답은 모두 `Cache-Control: no-store`, 토큰은 로그 · 오류 기록에 남기지 않는다. **토큰은 본문으로만 받는다** — API 주소(쿼리)에 실으면 웹서버 접속 로그에 남아서 `GET /status?t=` 는 없다(404). 고객 화면도 주소창의 `t=` 를 읽자마자 지운다.

| 요청 | 본문 | 응답 |
|---|---|---|
| `POST /status/view` | `{ t }` | 200 보기 · 404 「링크를 다시 확인해 주세요. 접수번호와 번호 뒤 4자리로도 확인할 수 있어요.」 · 410 `link_expired` |
| `POST /status/lookup` | `{ id, last4 }` | 200 보기 · 404 「접수번호나 번호를 다시 확인해 주세요.」 · 429 「잠시 후 다시 시도해 주세요.」(같은 IP 10분 20회, 같은 접수번호 5번 틀리면 10분 잠김 — 맞는 번호도) |
| `POST /status/reply` | `{ t, answer }` 또는 `{ id, last4, answer }` · answer = `buy` \| `pass` | 200 보기 · 409 `reply_not_open`(찾았어요 단계 아님) · `reply_locked`(답한 지 30분 지남 — 「답을 바꾸시려면 문자로 연락 주세요.」) · `reply_closed`(답장 기한 지남, 아직 답 없음) |

보기 칸은 **이것뿐**이다(백엔드 스냅샷 테스트로 고정) — 가격 · 판매처 · 이름 · 번호는 나가지 않는다.

```json
{ "name": "살로몬 크로스 자켓", "size": "L", "receivedDate": "2026-10-16", "stage": "found", "reply": null, "replyAt": null, "replyDeadline": "2026-10-17T05:00:00Z" }
```

- `stage`: `received` → `searching`(탐색 중 · 확보, 또는 연락 완료인데 재고 있음 기록 없음) → `found`(「찾았어요」 연락 보냄, 또는 연락 완료 + 재고 있음 기록) / `not_found`(「못 찾았어요」 연락 · 취소) → `done`(결제 완료 · 완료). `name` 은 KREAM 한글명 → 영문명 → null.
- `replyDeadline`: 설정 「답장 기한」이 있고 `found` 일 때만 = 연락 보낸 시각 + 기한. 없으면 null(화면에 기한 줄 없음).
- 답하면 상태는 그대로 두고 상태 이력에 「고객 답: 구매할게요 / 이번엔 괜찮아요」 한 줄을 남긴다.

관리자(세션 키 필요):
- `GET /admin/applications/{id}/status-link` → `{ token }` (위와 같은 값, 없으면 503).
- `PUT /admin/applications/{id}/contact` `{ kind: found | not_found }` → `{ application }` — 「연락 보냄」 시각을 남긴다. 신청 행에 `contact: { kind, at }` · `reply: { answer, at }`(없으면 null)이 붙는다.
- `GET/PUT /admin/settings` 에 `replyHours`(1~168 정수, `null` · `''` = 없음).

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
