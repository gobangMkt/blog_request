// 실행: node tests/trend-calc.test.js (addon-direct-pay 폴더에서)
const assert = require('assert');
const T = require('../js/trend-calc.js');

const D = (s) => T.parseDay(s);
const row = (day, price, kind) => ({ day: D(day), price, kind: kind || '일반형' });

// 시간대: UTC 15:00 = KST 다음날 00:00
assert.strictEqual(T.kstToday(Date.UTC(2026, 10, 14, 14, 59)), D('2026-11-14'));
assert.strictEqual(T.kstToday(Date.UTC(2026, 10, 14, 15, 0)), D('2026-11-15'));

// 파싱: 날짜가 아니면 NaN
assert.ok(isNaN(T.parseDay('')));
assert.strictEqual(T.parseDay('2026-11-09 16:30'), D('2026-11-09'));

// 창: 일간 7칸, 주간은 월요일 시작(2026-11-15는 일요일), 월간은 월 경계
const today = D('2026-11-15');
const wd = T.windowOf('day', 7, today);
assert.strictEqual(wd.cells.length, 7);
assert.strictEqual(wd.start, D('2026-11-09'));
const ww = T.windowOf('week', 2, today);
assert.strictEqual(ww.start, D('2026-11-02'));
assert.strictEqual(ww.cells[1].s, D('2026-11-09'));
assert.strictEqual(ww.cells[1].e, D('2026-11-15'));
const wm = T.windowOf('month', 3, today);
assert.strictEqual(wm.start, D('2026-09-01'));
assert.strictEqual(wm.cells[0].e, D('2026-09-30'));
assert.strictEqual(wm.cells[2].s, D('2026-11-01'));

// 합계: 범위 밖·미래 제외, 단가 0 건수 집계, 부가세는 합계에서 한 번만
const rows = [row('2026-11-10', 70000), row('2026-11-10', 70000), row('2026-11-12', 150000, '고급형'), row('2026-11-20', 70000), row('2026-11-13', 0, '기존 폼')];
const t = T.sumRange(rows, D('2026-11-09'), today);
assert.deepStrictEqual([t.n, t.amt, t.zero], [4, 290000, 1]);
assert.strictEqual(T.vat(290000), 263636);
assert.strictEqual(T.vat(70000 * 3), 190909); // 건별 반올림(63636*3=190908)과 다르다

// 0건·1건
assert.deepStrictEqual(T.sumRange([], 0, 1), { n: 0, amt: 0, zero: 0 });
assert.strictEqual(T.cadence([], D('2026-11-09'), today).gapMedian, null);
const one = T.cadence([row('2026-11-10', 1)], D('2026-11-09'), today);
assert.deepStrictEqual([one.payDays, one.gapMedian, one.activeSpan], [1, null, 6]);

// 주기: 같은 날 여러 건은 하루로, 간격 중앙값·평균
const cr = [row('2026-11-09', 1), row('2026-11-09', 1), row('2026-11-11', 1), row('2026-11-15', 1)];
const c = T.cadence(cr, D('2026-11-09'), today);
assert.deepStrictEqual([c.payDays, c.gapMedian, c.gapMean, c.activeSpan], [3, 3, 3, 7]);
// 기간 밖 결제는 주기에서 제외, 마지막 결제는 기간과 무관
assert.strictEqual(T.cadence(cr, D('2026-11-10'), today).payDays, 2);
assert.deepStrictEqual(T.lastPay(cr.concat([row('2026-11-30', 1)]), today), { day: D('2026-11-15'), since: 0 });
assert.strictEqual(T.lastPay([], today), null);

// 평균: 기록이 단위보다 짧으면 null
assert.strictEqual(T.perUnit(10, 6, 7), null);
assert.strictEqual(T.perUnit(10, 7, 7), 10);
assert.strictEqual(T.perUnit(10, 14, 7), 5);

// 유형별
const bk = T.byKind(rows, D('2026-11-09'), today);
assert.deepStrictEqual(bk['일반형'], { n: 2, amt: 140000 });
assert.deepStrictEqual(bk['고급형'], { n: 1, amt: 150000 });

// 임의 기간: 일간은 양끝 포함, 주간은 월요일 칸을 기간으로 자르고, 월간은 달 경계를 기간으로 자른다
const cdy = T.cellsOf('day', D('2026-11-09'), D('2026-11-15'));
assert.strictEqual(cdy.length, 7);
assert.strictEqual(cdy[6].s, D('2026-11-15'));
const cwk = T.cellsOf('week', D('2026-11-04'), D('2026-11-15')); // 수요일 시작
assert.strictEqual(cwk.length, 2);
assert.deepStrictEqual([cwk[0].ws, cwk[0].s, cwk[0].e], [D('2026-11-02'), D('2026-11-04'), D('2026-11-08')]);
assert.deepStrictEqual([cwk[1].s, cwk[1].e], [D('2026-11-09'), D('2026-11-15')]);
const cmo = T.cellsOf('month', D('2026-09-20'), D('2026-11-05'));
assert.strictEqual(cmo.length, 3);
assert.deepStrictEqual([cmo[0].s, cmo[0].e], [D('2026-09-20'), D('2026-09-30')]);
assert.deepStrictEqual([cmo[2].ws, cmo[2].s, cmo[2].e], [D('2026-11-01'), D('2026-11-01'), D('2026-11-05')]);
assert.strictEqual(T.cellsOf('day', D('2026-11-15'), D('2026-11-15')).length, 1);

console.log('trend-calc: all passed');
