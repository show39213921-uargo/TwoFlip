// 18차 — 오류 알림(보내는 값 · 10분 5건) · 결정 대기 자리(비면 아무것도 안 함)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, allowSend, maskMessage, reasonText, MAX_SENDS, WINDOW_MS } from '../assets/js/error-report.js';
import { pendingLines, pendingFaq, fillPendingSlots } from '../assets/js/pending.js';
import { PENDING } from '../assets/js/config.js';

test('오류 보고 — 경로 · 파일은 쿼리 · # 빼고, 메시지는 200자 · 따옴표 값 · 긴 숫자 · 이메일 가림', () => {
  const r = buildReport({
    message: 'TypeError: "홍길동" 010-1234-5678 a@b.co ' + '가'.repeat(300),
    filename: 'https://twoflip.u-argo.com/assets/js/shop.js?v=a84a3f9d53f6', lineno: 42,
    path: '/shop.html?preview=abc&name=홍길동#i-1', release: 'a84a3f9d53f6',
  });
  assert.equal(r.path, '/shop.html');
  assert.equal(r.where, 'https://twoflip.u-argo.com/assets/js/shop.js');
  assert.equal(r.line, 42);
  assert.equal(r.release, 'a84a3f9d53f6');
  assert.ok(r.message.startsWith('TypeError: "…" # @…'), r.message);
  assert.equal(r.message.length, 200);
  for (const leak of ['홍길동', '1234', 'a@b.co', 'preview=']) assert.ok(!JSON.stringify(r).includes(leak), leak);
  assert.deepEqual(Object.keys(r), ['path', 'message', 'where', 'line', 'release'], '보내는 칸은 이것뿐(입력값 · 이름 · 번호 · 쿠키 없음)');
});

test('오류 보고 — 다른 사이트 「Script error.」 · 확장 프로그램 오류 · 빈 메시지는 보내지 않음, 배포 번호 모양이 아니면 null', () => {
  assert.equal(buildReport({ message: 'Script error.' }), null);
  assert.equal(buildReport({ message: 'x', filename: 'chrome-extension://abc/content.js' }), null);
  assert.equal(buildReport({ message: '   ' }), null);
  assert.equal(buildReport({ message: 'x', release: '<script>' }).release, null);
  assert.equal(buildReport({ message: 'x', release: 'dev' }).release, 'dev');
  assert.equal(reasonText(new RangeError('범위')), 'RangeError: 범위');
  assert.equal(reasonText('문자열'), '문자열');
  assert.equal(maskMessage('번호 01012345678 끝'), '번호 # 끝');
});

test('오류 보고 — 같은 브라우저 10분 5건까지', () => {
  let times = [];
  const t0 = 1_760_500_000_000;
  for (let i = 0; i < MAX_SENDS; i++) { const g = allowSend(times, t0 + i); assert.ok(g.ok); times = g.times; }
  assert.equal(allowSend(times, t0 + 10).ok, false, '6번째는 막힘');
  assert.equal(allowSend(times, t0 + WINDOW_MS + 1).ok, true, '10분 지나면 다시');
  assert.equal(allowSend('깨진 값', t0).ok, true);
});

test('결정 대기 — 기본값은 전부 비어 있다(화면에 아무것도 안 나옴)', () => {
  assert.deepEqual(PENDING, { contact: '', fee: '', payment: '', notFound: '', faq: [] });
  assert.deepEqual(pendingLines('contact notFound payment'), []);
  assert.deepEqual(pendingFaq(), []);
});

test('결정 대기 — 값이 있으면 자리 순서대로 글자만, 빈 값 · 모르는 키 · 반쪽 FAQ 는 뺀다', () => {
  const p = { contact: ' 카카오톡 채널로 문의해 주세요. ', fee: '', payment: '찾은 뒤 결정하시면 그때 결제해요.', notFound: '<b>x</b>', faq: [{ q: '수수료는요?', a: '' }, { q: ' 결제는 언제요? ', a: '찾은 뒤에요.' }] };
  assert.deepEqual(pendingLines('contact fee payment bogus', p), ['카카오톡 채널로 문의해 주세요.', '찾은 뒤 결정하시면 그때 결제해요.']);
  assert.deepEqual(pendingLines('notFound', p), ['<b>x</b>'], '글자 그대로(textContent 로 넣는다)');
  assert.deepEqual(pendingFaq(p), [{ q: '결제는 언제요?', a: '찾은 뒤에요.' }]);
  assert.doesNotThrow(() => fillPendingSlots(undefined, p), 'document 가 없어도 죽지 않음');
});
