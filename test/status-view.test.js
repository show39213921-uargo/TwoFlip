// 4단계 — 진행 상황 화면 규칙(단계 · 한 줄 · 답하기) · 테스트 모드 흐름
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageOf, stepsOf, replyModel, statusModel, viewOfRecord, kstTime, STAGE_LINE, REPLY_DONE } from '../assets/js/status-view.js';
import { createLocalApi, DEMO_STATUS_ID } from '../assets/js/local-api.js';
import { createLocalStore } from '../assets/js/local-store.js';

const VIEW_KEYS = ['name', 'size', 'receivedDate', 'stage', 'reply', 'replyAt', 'replyDeadline'];

test('단계 잇기 — 백엔드 Stage::of 와 같은 표', () => {
  assert.equal(stageOf('received', null, false), 'received');
  assert.equal(stageOf('sourcing', null, true), 'searching');
  assert.equal(stageOf('secured', null, false), 'searching');
  assert.equal(stageOf('contacted', null, true), 'found');
  assert.equal(stageOf('contacted', null, false), 'searching');
  assert.equal(stageOf('sourcing', 'found', false), 'found');
  assert.equal(stageOf('contacted', 'not_found', true), 'not_found');
  assert.equal(stageOf('canceled', 'found', true), 'not_found');
  assert.equal(stageOf('paid', null, true), 'done');
  assert.equal(stageOf('completed', 'found', true), 'done');
});

test('4칸 — 지금 칸 · 지난 칸 · 못 찾음은 세 번째 칸 이름이 바뀐다', () => {
  assert.deepEqual(stepsOf('received').map((s) => s.state), ['now', 'todo', 'todo', 'todo']);
  assert.deepEqual(stepsOf('searching').map((s) => s.state), ['done', 'now', 'todo', 'todo']);
  assert.deepEqual(stepsOf('found').map((s) => `${s.label}:${s.state}`), ['접수됨:done', '찾는 중:done', '찾았어요:now', '마무리:todo']);
  assert.deepEqual(stepsOf('not_found').map((s) => `${s.label}:${s.state}`), ['접수됨:done', '찾는 중:done', '이번엔 못 찾았어요:miss', '마무리:todo']);
  assert.deepEqual(stepsOf('done').map((s) => s.state), ['done', 'done', 'done', 'now']);
});

test('한 줄 안내 — 브리프 문구 그대로(해요체), 마무리는 문장 없음', () => {
  assert.equal(STAGE_LINE.received, '저희가 확인하고 찾기 시작할게요.');
  assert.equal(STAGE_LINE.searching, '공식몰 · 매장 · 해외를 직접 확인하고 있어요.');
  assert.equal(STAGE_LINE.found, '문자로 가격을 보내 드렸어요. 아래에서 답해 주세요.');
  assert.equal(STAGE_LINE.not_found, '이번엔 찾지 못했어요. 다른 상품도 링크만 보내 주시면 찾아볼게요.');
  assert.equal(STAGE_LINE.done, '');
  assert.equal(REPLY_DONE.buy, '답을 받았어요. 입금 방법을 곧 문자로 알려 드릴게요.');
  assert.equal(REPLY_DONE.pass, '알겠어요. 다음에 또 찾을 게 있으면 링크만 보내 주세요.');
  for (const s of Object.values(STAGE_LINE)) assert.doesNotMatch(s, /습니다|보장|최저가|무조건/);
});

test('답하기 — 찾았어요에서만 · 기한 줄 · 답한 뒤 30분만 바꾸기 · 기한 지나면 안내', () => {
  const t0 = Date.parse('2026-10-16T05:00:00Z'); // 한국 14:00
  assert.equal(replyModel({ stage: 'searching' }, t0).kind, 'hidden');
  assert.deepEqual(replyModel({ stage: 'found', reply: null, replyDeadline: null }, t0), { kind: 'ask', deadline: '' });
  assert.deepEqual(replyModel({ stage: 'found', reply: null, replyDeadline: '2026-10-17T09:00:00Z' }, t0), { kind: 'ask', deadline: '10.17(토) 18:00까지 답해 주시면 잡아 둘게요.' });
  assert.deepEqual(replyModel({ stage: 'found', reply: null, replyDeadline: '2026-10-16T04:00:00Z' }, t0), { kind: 'expired', text: '답장 기한이 지났어요. 문자로 연락 주세요.' });
  const ans = { stage: 'found', reply: 'buy', replyAt: '2026-10-16T04:50:00Z', replyDeadline: '2026-10-16T04:00:00Z' };
  assert.deepEqual(replyModel(ans, t0), { kind: 'answered', text: '10.16 13:50에 「구매할게요」로 답하셨어요.', canChange: true }, '기한이 지났어도 답했으면 답이 보인다');
  assert.equal(replyModel(ans, t0 + 21 * 60 * 1000).canChange, false, '30분 지나면 바꾸기 없음');
  assert.equal(replyModel({ ...ans, reply: 'pass' }, t0).text, '10.16 13:50에 「이번엔 괜찮아요」로 답하셨어요.');
  assert.equal(kstTime('2026-10-16T15:05:00Z'), '10.17 00:05', '한국 날짜로 넘어감');
});

test('화면 값 — 상품명이 없으면 「신청하신 상품」, 접수 날짜', () => {
  const m = statusModel({ name: null, size: '270', receivedDate: '2026-10-15', stage: 'not_found', reply: null, replyAt: null, replyDeadline: null }, Date.now());
  assert.deepEqual([m.title, m.size, m.received, m.reply.kind], ['신청하신 상품', '270', '10.15 접수', 'hidden']);
});

test('테스트 모드 — 신청 기록 → 서버와 같은 칸 7개(이름 · 번호 · 판매처 · 가격 · 메모 없음)', () => {
  const r = { id: 'a1', status: 'contacted', receivedAt: '2026-10-15T16:00:00Z', size: 'L', name: '홍길동', phone: '01012345678', memo: '비밀',
    kream: { nameKo: '살로몬 자켓' }, sourcing: [{ name: '판매처갑', stock: 'in', price: 287000 }], contact: { kind: 'found', at: '2026-10-16T01:00:00Z' }, reply: null };
  const v = viewOfRecord(r, { replyHours: 24 });
  assert.deepEqual(Object.keys(v), VIEW_KEYS);
  assert.deepEqual(v, { name: '살로몬 자켓', size: 'L', receivedDate: '2026-10-16', stage: 'found', reply: null, replyAt: null, replyDeadline: '2026-10-17T01:00:00Z' });
  for (const leak of ['홍길동', '1234', '비밀', '판매처갑', '287']) assert.ok(!JSON.stringify(v).includes(leak), leak);
});

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }

test('테스트 모드 흐름 — 샘플 demo0001 · 0000 은 「찾았어요」, 틀리면 같은 문구, 답 → 다시 열어도 답 · 신청한 건은 접수번호.demo 링크', async () => {
  const store = createLocalStore(fakeStorage(), 'k');
  const api = createLocalApi({ store, session: fakeStorage(), now: () => Date.parse('2026-10-16T05:00:00Z'), newId: () => 'q1w2e3r4' });
  const s = await api.statusLookup(DEMO_STATUS_ID, '0000');
  assert.equal(s.ok, true);
  assert.deepEqual(Object.keys(s.data), VIEW_KEYS);
  assert.equal(s.data.stage, 'found');
  assert.equal((await api.statusLookup(DEMO_STATUS_ID, '1111')).error.message, '접수번호나 번호를 다시 확인해 주세요.');
  assert.equal((await api.statusLookup('nope', '0000')).error.message, '접수번호나 번호를 다시 확인해 주세요.');
  const rep = await api.statusReply({ id: DEMO_STATUS_ID, last4: '0000' }, 'buy');
  assert.equal(rep.data.reply, 'buy');
  assert.equal((await api.status(`${DEMO_STATUS_ID}.demo`)).data.reply, 'buy');

  const sub = await api.submitApplication({ kreamUrl: 'https://kream.co.kr/products/1', kreamProductId: '1', size: 'L', name: '[QA] 이름', phone: '010-0000-0000', memo: '', consent: true });
  assert.equal(sub.data.statusToken, 'q1w2e3r4.demo');
  const mine = await api.status(sub.data.statusToken);
  assert.equal(mine.data.stage, 'received');
  assert.equal((await api.statusReply({ t: sub.data.statusToken }, 'buy')).error.status, 409, '찾았어요 전에는 답 못 함');
  assert.equal((await api.status('q1w2e3r4.wrong')).ok, false);
});
