import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateApplication, applicationKey } from '../assets/js/validate.js';

const good = {
  kreamUrl: 'https://kream.co.kr/products/1068133?size=270',
  size: ' 270 ',
  name: ' 홍길동 ',
  phone: '010-1234-5678',
  memo: '',
  consent: true,
  website: '',
};

test('정상 입력 → 정리된 payload', () => {
  const r = validateApplication(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.payload, {
    kreamUrl: 'https://kream.co.kr/products/1068133',
    kreamProductId: '1068133',
    size: '270',
    name: '홍길동',
    phone: '01012345678',
    memo: '',
    consent: true,
  });
});

test('필수값이 빠지면 칸별 오류', () => {
  const r = validateApplication({});
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['consent', 'kreamUrl', 'name', 'phone', 'size']);
  assert.equal(r.payload, null);
});

test('휴대폰 번호는 010 등 이동통신 번호만, 숫자만 남긴다', () => {
  assert.equal(validateApplication({ ...good, phone: '010 1234 5678' }).payload.phone, '01012345678');
  assert.equal(validateApplication({ ...good, phone: '011-123-4567' }).payload.phone, '0111234567');
  assert.ok(validateApplication({ ...good, phone: '02-123-4567' }).errors.phone);
  assert.ok(validateApplication({ ...good, phone: '010-12-34' }).errors.phone);
});

test('동의는 true 일 때만 통과("on" 같은 문자열 아님)', () => {
  assert.ok(validateApplication({ ...good, consent: 'on' }).errors.consent);
  assert.ok(validateApplication({ ...good, consent: false }).errors.consent);
});

test('길이 제한', () => {
  assert.ok(validateApplication({ ...good, size: 'x'.repeat(21) }).errors.size);
  assert.ok(validateApplication({ ...good, name: 'x'.repeat(31) }).errors.name);
  assert.ok(validateApplication({ ...good, memo: 'x'.repeat(501) }).errors.memo);
});

test('KREAM 주소 오류는 kreamUrl 칸에 이유 문구로', () => {
  const r = validateApplication({ ...good, kreamUrl: 'https://www.musinsa.com/products/1' });
  assert.match(r.errors.kreamUrl, /KREAM/);
});

test('봇 함정 칸(website)이 채워지면 spam 으로 거절', () => {
  const r = validateApplication({ ...good, website: 'http://spam' });
  assert.equal(r.ok, false);
  assert.equal(r.spam, true);
});

test('applicationKey: 같은 상품·사이즈면 같은 열쇠(대소문자·띄어쓰기 무시), 사이즈가 다르면 다른 열쇠', () => {
  const a = applicationKey({ kreamProductId: '12345', size: 'free' });
  assert.equal(a, applicationKey({ kreamProductId: '12345', size: ' FREE ' }));
  assert.equal(applicationKey({ kreamProductId: '12345', size: '27 0' }), applicationKey({ kreamProductId: '12345', size: '270' }));
  assert.notEqual(applicationKey({ kreamProductId: '12345', size: '270' }), applicationKey({ kreamProductId: '12345', size: '275' }));
  assert.notEqual(applicationKey({ kreamProductId: '12345', size: '270' }), applicationKey({ kreamProductId: '99999', size: '270' }));
});

test('동의 오류는 해요체(8차 QA B-1)', () => {
  assert.equal(validateApplication({ consent: false }).errors.consent, '개인정보 수집·이용에 동의해야 신청할 수 있어요.');
});
