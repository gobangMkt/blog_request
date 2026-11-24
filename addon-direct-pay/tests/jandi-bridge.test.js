// 실행: node tests/jandi-bridge.test.js (addon-direct-pay 폴더에서)
// 수신부: 출처 검증, 메시지 모양 검증, 북마크 버전 비교, scan 만들기
const assert = require('assert');
const B = require('../js/jandi-bridge.js');

let pass = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { failures.push(name); console.log('FAIL ' + name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n     ')); }
}

const OK_ORIGIN = 'https://neoflat.jandi.com';
const good = (over) => ({
  type: 'nf-jandi', readerVersion: '1',
  result: Object.assign({ ok: true, readerVersion: '1', imageOnly: 25, total: 171, newestId: 5164296884, oldestId: 5125384030,
    reachedTop: true, aborted: '', bottomStale: false, candidates: [{ id: '1', type: 'text', text: '[Web발신]\n[상품 결제완료]' }, { id: '2', type: 'text', text: '두 번째' }] }, over || {})
});

test('출처가 잔디가 아니면 조용히 버린다(ignore)', () => {
  ['https://evil.example', 'http://neoflat.jandi.com', 'https://neoflat.jandi.com.evil.example', 'https://jandi.com', '', null, undefined, 'null']
    .forEach((o) => { const r = B.receive(o, good()); assert.strictEqual(r.ok, false); assert.strictEqual(r.ignore, true); });
});

test('우리 메시지 모양이 아니면 버린다(type 없음, 문자열, null, 다른 type)', () => {
  [null, undefined, 'nf-jandi', 42, {}, { type: 'other' }].forEach((d) => {
    const r = B.receive(OK_ORIGIN, d); assert.strictEqual(r.ok, false); assert.strictEqual(r.ignore, true);
  });
});

test('정상 메시지: 글자 목록, scan, 이미지 건수를 돌려준다', () => {
  const r = B.receive(OK_ORIGIN, good());
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.messages, ['[Web발신]\n[상품 결제완료]', '두 번째']);
  assert.deepStrictEqual(r.scan, { complete: true, reachedTop: true, aborted: '', total: 171, newestId: '5164296884', oldestId: '5125384030', oldestAt: '' });
  assert.strictEqual(r.imageOnly, 25);
  assert.strictEqual(r.total, 171);
});

test('버전 비교: 낮거나 없으면 "북마크가 오래됐어요", 높으면 화면 새로고침 안내', () => {
  const old = B.receive(OK_ORIGIN, Object.assign(good(), { readerVersion: '0' }));
  assert.strictEqual(old.code, 'old');
  assert.ok(old.text.indexOf('북마크가 오래됐어요') === 0);
  const none = good(); delete none.readerVersion;
  assert.strictEqual(B.receive(OK_ORIGIN, none).code, 'old');
  assert.strictEqual(B.receive(OK_ORIGIN, Object.assign(good(), { readerVersion: 'abc' })).code, 'old');
  assert.strictEqual(B.receive(OK_ORIGIN, Object.assign(good(), { readerVersion: '2' })).code, 'newer');
  assert.strictEqual(B.receive(OK_ORIGIN, Object.assign(good(), { readerVersion: '2' }), '2').ok, true);
  assert.strictEqual(B.compareVersion('10', '9'), 1);
});

test('구조 변경(reason structure)이면 안내만 하고 보내지 않는다', () => {
  const r = B.receive(OK_ORIGIN, { type: 'nf-jandi', readerVersion: '1', result: { ok: false, reason: 'structure' } });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'structure');
  assert.ok(r.text.indexOf('잔디 화면 구조가 바뀐 것 같아요') === 0);
});

test('모양이 틀린 결과(후보가 배열 아님, total 없음, result 없음)는 shape 오류', () => {
  assert.strictEqual(B.receive(OK_ORIGIN, good({ candidates: 'x' })).code, 'shape');
  assert.strictEqual(B.receive(OK_ORIGIN, good({ total: undefined })).code, 'shape');
  assert.strictEqual(B.receive(OK_ORIGIN, { type: 'nf-jandi', readerVersion: '1' }).code, 'shape');
  assert.strictEqual(B.receive(OK_ORIGIN, { type: 'nf-jandi', readerVersion: '1', result: { ok: false } }).code, 'shape');
});

test('글자가 아닌 후보·빈 글은 걸러내고 너무 긴 글은 자른다', () => {
  const long = 'a'.repeat(9000);
  const r = B.receive(OK_ORIGIN, good({ candidates: [{ text: '  ' }, { text: 5 }, null, { text: long }, '문자열 후보'] }));
  assert.strictEqual(r.messages.length, 2);
  assert.strictEqual(r.messages[0].length, 4000);
  assert.strictEqual(r.messages[1], '문자열 후보');
});

test('후보가 500건을 넘으면 거절(서버 상한과 같다)', () => {
  const many = []; for (let i = 0; i < 501; i++) many.push({ text: 'x' + i });
  assert.strictEqual(B.receive(OK_ORIGIN, good({ candidates: many })).code, 'too_many');
});

test('scan.complete는 맨 위까지 읽고, 중단 없고, 맨 아래가 최신일 때만 true', () => {
  assert.strictEqual(B.scanOf({ ok: true, reachedTop: true, aborted: '' }).complete, true);
  assert.strictEqual(B.scanOf({ ok: true, reachedTop: false, aborted: 'time' }).complete, false);
  assert.strictEqual(B.scanOf({ ok: true, reachedTop: true, aborted: 'steps' }).complete, false);
  assert.strictEqual(B.scanOf({ ok: true, reachedTop: true, aborted: '', bottomStale: true }).complete, false);
  assert.strictEqual(B.scanOf({ ok: false }).complete, false);
  assert.strictEqual(B.scanOf(null).complete, false);
  assert.strictEqual(B.scanOf({ ok: true, reachedTop: true, oldestAt: '2026-10-29 16:15' }).oldestAt, '2026-10-29 16:15');
});

test('준비 신호는 잔디 출처로만 보낸다', () => {
  const sent = [];
  const win = { postMessage: (d, o) => sent.push([d, o]) };
  assert.strictEqual(B.announceReady(win), true);
  assert.deepStrictEqual(sent, [[{ type: 'nf-ready' }, 'https://neoflat.jandi.com']]);
  assert.strictEqual(B.announceReady(null), false);
  assert.strictEqual(B.announceReady({}), false);
  assert.strictEqual(B.announceReady({ postMessage() { throw new Error('x'); } }), false);
});

console.log('\n' + pass + ' passed, ' + failures.length + ' failed');
if (failures.length) { console.log('FAILED: ' + failures.join(', ')); process.exit(1); }
