// 실행: node tests/billy-mark.test.js (addon-direct-pay 폴더에서)
// markBilly: 부가상품 결제 탭 상태를 완료 <-> 진행전으로 바꾸고, 행이 밀렸으면(stale) 쓰지 않는다.
const assert = require('assert');
const { makeEnv, kstDate, APPLY_HEADER } = require('./gas-mock.js');

let pass = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { failures.push(name); console.log('FAIL ' + name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n     ')); }
}
const fresh = () => makeEnv({ sheets: {
  '신청 내역': [APPLY_HEADER],
  '부가상품 결제': [['결제일시', '지점명', '지점번호', '상품', '금액', '상태'],
    [kstDate(2026, 11, 13, 11, 52), '서울스테이', 20933, '빌리투어 (투어영상)', 400000, '진행전']] } });

test('맞는 행이면 완료로, 다시 누르면 진행전으로', () => {
  const env = fresh();
  let r = env.plain(env.ctx.markBilly({ token: 'tok', row: 2, paidAt: '2026-11-13 11:52', branchNo: '20933', done: true }));
  assert.deepStrictEqual(r, { success: true, stage: 'basic_done', status: '완료' });
  assert.strictEqual(env.sheet('부가상품 결제').rows[1][5], '완료');
  r = env.plain(env.ctx.markBilly({ token: 'tok', row: 2, paidAt: '2026-11-13 11:52', branchNo: '20933', done: false }));
  assert.strictEqual(r.stage, 'writing');
  assert.strictEqual(env.sheet('부가상품 결제').rows[1][5], '진행전');
});
test('결제일시·지점번호가 다르거나 행이 없으면 stale, 시트는 그대로', () => {
  const env = fresh();
  assert.strictEqual(env.ctx.markBilly({ token: 'tok', row: 2, paidAt: '2026-11-13 11:53', branchNo: '20933', done: true }).reason, 'stale');
  assert.strictEqual(env.ctx.markBilly({ token: 'tok', row: 2, paidAt: '2026-11-13 11:52', branchNo: '1', done: true }).reason, 'stale');
  assert.strictEqual(env.ctx.markBilly({ token: 'tok', row: 9, paidAt: '2026-11-13 11:52', branchNo: '20933', done: true }).reason, 'stale');
  assert.strictEqual(env.sheet('부가상품 결제').rows[1][5], '진행전');
});
test('토큰이 틀리면 거부', () => {
  const env = fresh();
  assert.strictEqual(env.ctx.markBilly({ token: 'x', row: 2, done: true }).reason, 'unauthorized');
});
console.log('\n' + pass + ' passed, ' + failures.length + ' failed');
if (failures.length) process.exit(1);
