// 잔디 가져오기 화면 데이터(순수 함수). previewJandi 응답과 읽기 결과를 화면이 그릴 모양으로 바꾼다.
// DOM·네트워크를 쓰지 않는다(그리기는 jandi-ui.js). 시험: node tests/jandi-recon.test.js
// 시각은 모두 KST 벽시계 글자 'yyyy-MM-dd HH:mm'로 다룬다(lastScan.at만 ISO라 KST로 바꿔 쓴다).
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JandiRecon = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var STALE_DAYS = 3;
  var DAYMS = 86400000;
  var KIND_TEXT = { basic: '일반형', premium: '고급형', billy: '빌리투어' };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function stampParts(s) {
    var m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    return m ? { y: m[1], mo: m[2], d: m[3], h: m[4] || '', mi: m[5] || '' } : null;
  }
  function md(s) { var p = stampParts(s); return p ? p.mo + '.' + p.d : ''; }
  function mdhm(s) { var p = stampParts(s); return p ? p.mo + '.' + p.d + (p.h ? ' ' + p.h + ':' + p.mi : '') : ''; }
  function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }

  // lastScan.at(ISO 또는 KST 글자) -> 밀리초. 못 읽으면 NaN
  function msOf(at) {
    var s = String(at || '');
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) { // KST 벽시계 글자
      var p = stampParts(s);
      return Date.UTC(+p.y, +p.mo - 1, +p.d, +p.h - 9, +p.mi);
    }
    return Date.parse(s);
  }
  function kstStamp(ms) {
    var d = new Date(ms + 9 * 3600000);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()) + ' ' +
      pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes());
  }

  // 머리의 "마지막 수집 mm.dd HH:mm". 3일 이상 안 눌렀거나 기록이 없으면 stale + 강조 글자
  function lastScanInfo(lastScan, nowMs) {
    var ms = lastScan && lastScan.at ? msOf(lastScan.at) : NaN;
    if (isNaN(ms)) return { text: '잔디 결제를 아직 가져오지 않았어요', stale: true, chip: '가져오기 필요' };
    var days = Math.floor((nowMs - ms) / DAYMS);
    var stale = days >= STALE_DAYS;
    return { text: '마지막 수집 ' + mdhm(kstStamp(ms)), stale: stale, chip: stale ? days + '일 지났어요' : '' };
  }

  var GROUPS = [
    { id: 'known', label: '이미 시트에 있음', chip: '시트에 있음', tone: 'notified', always: true },
    { id: 'newBasic', label: '새로 등록할 일반형', chip: '등록 전', tone: 'writing', always: true, rows: true },
    { id: 'needPhone', label: '전화번호가 필요한 고급형', chip: '번호 필요', tone: 'sendwait', always: true, rows: true, open: 'phone' },
    { id: 'billy', label: '빌리투어 쌓을 것', chip: '쌓기 전', tone: 'writing', always: true, rows: true },
    { id: 'review', label: '확인 필요', chip: '확인 필요', tone: 'sendwait', always: true, rows: true, open: 'raw' },
    { id: 'notTarget', label: '대상 아님', chip: '대상 아님', tone: 'notified', always: true, rows: true },
    { id: 'guide', label: '안내 글', chip: '안내', tone: 'notified', always: true },
    { id: 'billyExists', label: '이미 쌓은 빌리투어', chip: '쌓음', tone: 'notified' },
    { id: 'dup', label: '같은 글이 두 번 들어옴', chip: '중복', tone: 'notified' },
    { id: 'closed', label: '종결한 건(숨김)', chip: '종결', tone: 'notified' },
    { id: 'other', label: '분류하지 못한 조각', chip: '확인 필요', tone: 'sendwait' }
  ];

  function groupOf(p, closedKeys) {
    var s = p.status;
    var closedable = s === '번호필요' || s === '확인필요';
    if (closedable && (p.closed === true || (p.key && closedKeys[p.key]))) return 'closed';
    if (s === '이미있음') return 'known';
    if (s === '새로등록') return 'newBasic';
    if (s === '번호필요') return 'needPhone';
    if (s === '빌리투어쌓기') return p.exists ? 'billyExists' : 'billy';
    if (s === '확인필요') return 'review';
    if (s === '대상아님') return 'notTarget';
    if (s === '안내글') return 'guide';
    if (s === '잡담') return 'chat';
    if (s === '중복') return 'dup';
    return 'other';
  }

  function rawOf(messages, idx) {
    var m = messages[idx];
    return typeof m === 'string' ? m : (m && m.text) || '';
  }

  function rowOf(p, messages, gid) {
    var no = p.branchNo || '';
    var who = p.branch ? p.branch + (no && p.branch.indexOf('(' + no + ')') < 0 ? '(' + no + ')' : '')
      : (no ? '지점번호 ' + no : '지점 미확인');
    var reason = String(p.reason || '');
    if (gid === 'needPhone') reason = reason.replace(/^전화번호가 필요한 고급형 · /, '');
    var regAction = '';
    if (gid === 'review' && p.extracted && no && p.paidAt) regAction = p.kind === 'billy' ? 'billy' : p.kind === 'basic' ? 'basic' : '';
    return {
      key: p.key || '', kind: KIND_TEXT[p.kind] || '', kindKey: p.kind || '', group: gid,
      who: who, branch: p.branch || '', branchNo: no, paidAt: p.paidAt || '', when: mdhm(p.paidAt),
      product: p.product || '', amount: p.unitPrice || null, reason: reason, warnings: (p.warnings || []).slice(),
      raw: rawOf(messages, p.messageIndex), extracted: !!p.extracted, regAction: regAction
    };
  }

  function sortDesc(a, b) { return a.paidAt < b.paidAt ? 1 : a.paidAt > b.paidAt ? -1 : 0; }
  function uniq(list) { var seen = {}; return list.filter(function (k) { if (!k || seen[k]) return false; seen[k] = 1; return true; }); }

  // preview = previewJandi 응답, scan = JandiBridge.scanOf 결과, opts = { messages, imageOnly, closedKeys }
  function build(preview, scan, opts) {
    opts = opts || {}; scan = scan || {}; preview = preview || {};
    var results = preview.results || [], counts = preview.counts || {};
    var messages = opts.messages || [], closedKeys = opts.closedKeys || {};
    var buckets = {}, pieces = [], paid = [];
    GROUPS.forEach(function (g) { buckets[g.id] = []; });
    buckets.chat = [];
    results.forEach(function (x) { (x.pieces || []).forEach(function (p) { pieces.push(p); }); });
    pieces.forEach(function (p) {
      var gid = groupOf(p, closedKeys);
      buckets[gid].push(rowOf(p, messages, gid));
      if (p.paidAt) paid.push(p.paidAt);
    });

    var nMessages = results.length;
    var chat = buckets.chat.length;
    var read = nMessages - chat; // 결제 알림이 아닌 잡담은 읽은 글에 세지 않는다
    var split = pieces.length - nMessages;
    var groups = GROUPS.map(function (g) {
      var rows = buckets[g.id].slice().sort(sortDesc);
      return { id: g.id, label: g.label, chip: g.chip, tone: g.tone, open: g.open || '', count: rows.length,
        rows: g.rows ? rows : [], show: !!g.always || rows.length > 0 };
    }).filter(function (g) { return g.show; });

    // 합계 점검: 읽은 N = 각 줄 합 - 한 글에서 나뉜 추가 조각
    var termIds = ['known', 'newBasic', 'needPhone', 'billy', 'review', 'notTarget'];
    ['billyExists', 'closed', 'guide', 'dup', 'other'].forEach(function (id) { if (buckets[id].length) termIds.push(id); });
    var terms = termIds.map(function (id) { return buckets[id].length; });
    var sum = terms.reduce(function (a, b) { return a + b; }, 0);
    var sumOk = counts.sumOk === true && pieces.length === counts.pieces && sum - split === read &&
      buckets.other.length === 0;
    var checkText = '읽은 ' + read + '건 = ' + terms.join(' + ') + (split > 0 ? ' - 한 글 안 추가 조각 ' + split : '');

    // 범위 요약
    var oldest = scan.oldestAt && stampParts(scan.oldestAt) ? String(scan.oldestAt) : '';
    paid.sort();
    if (!oldest && paid.length) oldest = paid[0];
    var newest = paid.length ? paid[paid.length - 1] : '';
    var complete = scan.complete === true;
    var sumText = '';
    if (complete) sumText = (oldest ? md(oldest) + (newest ? ' ~ ' + md(newest) : '') + ' · ' : '') +
      (scan.reachedTop ? '방 처음까지 읽음' : '정한 범위까지 읽음');
    else sumText = oldest ? md(oldest) + ' 까지만 읽었어요' : '끝까지 읽지 못했어요';

    var warnings = [];
    if (!complete) warnings.push({ id: 'incomplete', title: '끝까지 읽지 못했어요',
      text: '수집 시각은 갱신하지 않아요. 잔디 탭에서 다시 눌러 주세요.' });
    var miss = (preview.regression && preview.regression.missing) || [];
    if (miss.length) {
      var shown = miss.slice(0, 3).map(function (m) { return (m.branch || m.key) + ' ' + mdhm(m.paidAt); }).join(', ');
      warnings.push({ id: 'regression', title: '지난번엔 있었는데 ' + miss.length + '건이 안 보여요',
        text: shown + (miss.length > 3 ? ' 외 ' + (miss.length - 3) + '건' : '') + ' · 읽기가 덜 됐을 수 있어요. 다시 읽어 보세요.' });
    }
    if (!sumOk) warnings.push({ id: 'sum', title: '건수가 안 맞아요', text: '등록을 잠갔어요. 개발팀에 알려 주세요.' });

    // 등록 대상: 일반형 새로등록 = basic, 빌리투어 쌓기 = billy (확인 필요는 자동으로 넣지 않는다)
    var basic = uniq(buckets.newBasic.map(function (r) { return r.key; }));
    var billy = uniq(buckets.billy.map(function (r) { return r.key; }));
    var targets = basic.map(function (k) { return { key: k, action: 'basic' }; })
      .concat(billy.map(function (k) { return { key: k, action: 'billy' }; }));
    var reg = { basic: basic.length, billy: billy.length, review: buckets.review.length, needPhone: buckets.needPhone.length,
      targets: targets, mode: 'register', disabled: false, label: '' };
    if (!sumOk) { reg.disabled = true; reg.label = '건수가 안 맞아 등록할 수 없어요'; }
    else if (!targets.length) { reg.mode = 'logonly'; reg.label = '읽은 기록 남기기'; }
    else reg.label = '시트에 등록하기 (일반형 ' + reg.basic + '건, 빌리투어 ' + reg.billy + '건)';

    var byKey = {};
    GROUPS.concat([{ id: 'chat' }]).forEach(function (g) {
      (buckets[g.id] || []).forEach(function (r) { if (r.key && !byKey[r.key + ':' + r.kindKey]) byKey[r.key + ':' + r.kindKey] = r; if (r.key && !byKey[r.key]) byKey[r.key] = r; });
    });

    return {
      title: read > 0 ? '잔디에서 결제 알림 ' + read + '건 읽었어요' : '잔디에서 읽은 결제 알림이 없어요',
      sum: sumText, read: read, complete: complete, warnings: warnings, groups: groups,
      image: opts.imageOnly > 0 ? { count: opts.imageOnly, text: '읽지 않은 이미지 ' + opts.imageOnly + '건' } : null,
      check: { text: checkText, ok: sumOk }, register: reg, byKey: byKey
    };
  }

  // 등록 확인 팝업 문구
  function confirmText(view) {
    var r = view.register, lines = [];
    if (r.mode === 'logonly') {
      lines.push('새로 등록할 건은 없어요.');
      lines.push(view.complete ? '읽은 시각이 마지막 수집으로 남아요.' : '끝까지 읽지 못해 수집 시각은 갱신하지 않아요.');
      if (r.review) lines.push('확인 필요 ' + r.review + '건은 목록에 남겨 둬요.');
      return { title: '읽은 기록만 남길까요?', lines: lines, yes: '남기기' };
    }
    if (r.review) lines.push('확인 필요 ' + r.review + '건은 등록하지 않아요');
    if (r.needPhone) lines.push('전화번호가 필요한 고급형 ' + r.needPhone + '건은 등록하지 않아요');
    if (!view.complete) lines.push('끝까지 읽지 못해 수집 시각은 갱신하지 않아요');
    return { title: '일반형 ' + r.basic + '건, 빌리투어 ' + r.billy + '건을 등록합니다', lines: lines, yes: '등록하기' };
  }

  // importJandi 응답 -> 결과 카드 데이터
  function resultView(resp, view) {
    var counts = resp.counts || {}, items = [];
    (resp.results || []).forEach(function (x) {
      var row = view && view.byKey ? (view.byKey[x.key + ':' + (x.action === 'billy' ? 'billy' : x.action === 'basic' ? 'basic' : '')] || view.byKey[x.key]) : null;
      var cls = x.status === 'added' ? 'added' : x.status === 'error' ? 'bad' : 'skip';
      items.push({ cls: cls, status: x.status, who: row ? row.who : x.key, when: row ? row.when : '',
        kind: x.action === 'billy' ? '빌리투어' : x.action === 'basic' ? '일반형' : '', reason: x.reason || '' });
    });
    return {
      title: '등록 ' + (counts.added || 0) + '건',
      sum: '이미 있음 ' + (counts.duplicate || 0) + ' · 종결 ' + (counts.closed || 0) + ' · 건너뜀 ' + (counts.skipped || 0) +
        ' · 오류 ' + (counts.error || 0),
      items: items
    };
  }

  // 빌리투어 읽기 전용 표
  function billyView(billy) {
    var rows = (billy || []).map(function (b) {
      var no = b.branchNo || '';
      return { when: mdhm(b.paidAt), who: (b.branch || '지점 미확인') + (no ? '(' + no + ')' : ''), product: b.product || '빌리투어',
        amount: Number(b.amount) || 0, status: b.status || '-' };
    });
    var total = rows.reduce(function (a, r) { return a + r.amount; }, 0);
    return { rows: rows, title: '빌리투어 ' + rows.length + '건', sum: rows.length ? '결제액 ' + won(total) + ' · 읽기 전용' : '읽기 전용' };
  }

  // 결제 추이 구분(빌리투어)에 넣을 항목. kind 글자와 stage는 추이 계산(trend-calc inScope)이 읽는다
  function billyTrendItems(billy) {
    var out = [];
    (billy || []).forEach(function (b) {
      var p = stampParts(b.paidAt);
      if (!p) return;
      out.push({ kind: '빌리투어', label: b.branch || '', paidAt: p.y + '-' + p.mo + '-' + p.d + ' ' + (p.h || '00') + ':' + (p.mi || '00'),
        price: Number(b.amount) || 0, stage: 'paid' });
    });
    return out;
  }

  return { build: build, confirmText: confirmText, resultView: resultView, billyView: billyView,
    billyTrendItems: billyTrendItems, lastScanInfo: lastScanInfo, STALE_DAYS: STALE_DAYS };
});
