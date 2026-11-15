// 결제 추이 계산(순수 함수). 화면(paste.html)은 이 파일의 결과만 그린다.
// 날짜는 모두 "UTC 자정 ms" 하루 단위로 다룬다(시간대에 흔들리지 않게). 오늘만 KST 기준으로 만든다.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrendCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  var DAYMS = 86400000;
  var VAT = 1.1;

  function parseDay(s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }
  // 시트는 KST 기준이라 브라우저 시간대와 상관없이 KST의 오늘을 쓴다
  function kstToday(nowMs) {
    var d = new Date(nowMs + 9 * 3600000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  function mondayOf(ms) { return ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAYMS; }
  function monthStart(ms, add) { var d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + add, 1); }

  // 기간 시작일과 칸 목록(칸마다 [s, e] 날짜 범위). 주는 월요일 시작, 마지막 칸은 오늘이 든 칸
  function windowOf(unit, n, today) {
    var start, i, cells = [];
    if (unit === 'day') start = today - (n - 1) * DAYMS;
    else if (unit === 'week') start = mondayOf(today) - (n - 1) * 7 * DAYMS;
    else start = monthStart(today, -(n - 1));
    for (i = 0; i < n; i++) {
      if (unit === 'day') cells.push({ s: start + i * DAYMS, e: start + i * DAYMS });
      else if (unit === 'week') cells.push({ s: start + i * 7 * DAYMS, e: start + i * 7 * DAYMS + 6 * DAYMS });
      else cells.push({ s: monthStart(start, i), e: monthStart(start, i + 1) - DAYMS });
    }
    return { start: start, cells: cells };
  }

  // 임의 기간 [from, to]의 칸 목록. 주는 월요일 칸, 월은 달 칸을 기간으로 자른다(양끝 칸은 일부만 든다).
  // ws = 그 칸의 원래 시작일(주 월요일·달 1일): 축 라벨과 툴팁 제목에 쓴다
  function cellsOf(unit, from, to) {
    var cells = [], s;
    if (unit === 'day') {
      for (s = from; s <= to; s += DAYMS) cells.push({ s: s, e: s, ws: s });
    } else if (unit === 'week') {
      for (s = mondayOf(from); s <= to; s += 7 * DAYMS) cells.push({ s: Math.max(s, from), e: Math.min(s + 6 * DAYMS, to), ws: s });
    } else {
      for (s = monthStart(from, 0); s <= to; s = monthStart(s, 1)) {
        cells.push({ s: Math.max(s, from), e: Math.min(monthStart(s, 1) - DAYMS, to), ws: s });
      }
    }
    return cells;
  }

  // rows = [{day, price, kind}]. 합계는 먼저 구하고 부가세는 합계에서 한 번만 뗀다(건별 반올림 금지)
  function sumRange(rows, s, e) {
    var n = 0, amt = 0, zero = 0;
    rows.forEach(function (r) {
      if (r.day >= s && r.day <= e) { n++; amt += r.price; if (!(r.price > 0)) zero++; }
    });
    return { n: n, amt: amt, zero: zero };
  }
  function vat(amt) { return Math.round(amt / VAT); }

  // 기록이 그 단위(7일·30일)보다 짧으면 계산하지 않는다
  function perUnit(v, span, days) { return span >= days ? v / span * days : null; }

  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // 결제 주기: 같은 날 여러 건은 하루로 합친 뒤 결제 있던 날 사이 간격(일)을 센다
  function cadence(rows, eff, today) {
    var seen = {}, days = [], gaps = [], i, sum = 0;
    rows.forEach(function (r) {
      if (r.day >= eff && r.day <= today && !seen[r.day]) { seen[r.day] = 1; days.push(r.day); }
    });
    days.sort(function (a, b) { return a - b; });
    for (i = 1; i < days.length; i++) gaps.push((days[i] - days[i - 1]) / DAYMS);
    gaps.forEach(function (g) { sum += g; });
    return {
      payDays: days.length,
      activeSpan: days.length ? Math.round((today - days[0]) / DAYMS) + 1 : 0, // 첫 결제일부터 오늘까지(오늘 포함)
      gapMedian: gaps.length ? median(gaps) : null,
      gapMean: gaps.length ? sum / gaps.length : null
    };
  }
  // 오늘까지 가장 최근 결제일(기간과 무관). 없으면 null
  function lastPay(rows, today) {
    var last = null;
    rows.forEach(function (r) { if (r.day <= today && (last === null || r.day > last)) last = r.day; });
    return last === null ? null : { day: last, since: Math.round((today - last) / DAYMS) };
  }
  // 유형별 건수·결제액
  function byKind(rows, s, e) {
    var out = {};
    rows.forEach(function (r) {
      if (r.day < s || r.day > e) return;
      var o = out[r.kind] || (out[r.kind] = { n: 0, amt: 0 });
      o.n++; o.amt += r.price;
    });
    return out;
  }

  return {
    DAYMS: DAYMS, parseDay: parseDay, kstToday: kstToday, mondayOf: mondayOf, monthStart: monthStart,
    windowOf: windowOf, cellsOf: cellsOf, sumRange: sumRange, vat: vat, perUnit: perUnit, median: median,
    cadence: cadence, lastPay: lastPay, byKind: byKind
  };
});
