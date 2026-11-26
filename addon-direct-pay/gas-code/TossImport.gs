/**
 * 토스 결제 엑셀 가져오기 (11.26, 핫딜 gas/lib.js·Code.js 방식 이식).
 * 사람이 토스페이먼츠 상점관리자에서 주문내역 엑셀을 내려받아 드라이브 폴더에 넣으면,
 * 10분 트리거가 새 파일만 읽어 블로그 상품 주문을 '토스 결제' 탭에 주문번호 기준으로 합친다.
 * 시트 DB(listStatus)는 기존 폼 '결제 전' 행을 연락처로 이 탭과 대조해 결제 완료로 보여 준다(시트 결제완료일은 안 바꿈).
 * 순수 로직(toss* 중 파일·시트 API를 안 쓰는 것)은 tests/toss-import.test.js가 시험한다.
 */

var TOSS_TAB = '토스 결제';
var TOSS_LOG_TAB = '토스 가져오기 기록';
var TOSS_HEADERS = ['거래일시', '주문번호', '구매상품', '옵션명', '구매자명', '연락처', '주문상태', '총결제금액', '가져온시각'];
// 블로그 전용 폴더 + 핫딜 폴더(같은 상점 엑셀이면 핫딜용으로 받은 파일 하나로 블로그도 채운다). 첫 폴더만 없으면 만든다.
var TOSS_FOLDERS = ['블로그 토스 결제 엑셀', '핫딜 주문 엑셀'];
var TOSS_PROCESSED_KEY = 'TOSS_PROCESSED_FILES';
var TOSS_BLOG_PRODUCT = /블로그/; // 토스 결제링크 상품명에 '블로그'가 들어간 주문만 블로그 결제로 본다
var TOSS_MATCH_BEFORE_MS = 24 * 60 * 60 * 1000;      // 신청 하루 전 결제까지 같은 건으로 본다
var TOSS_MATCH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;  // 신청 뒤 30일 안 결제

// ── 순수 로직 ──
function tossDecodeXml_(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(parseInt(d, 10)); })
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function tossTextOf_(xml) {
  var out = '';
  var re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  var m;
  while ((m = re.exec(xml)) !== null) out += m[1];
  return tossDecodeXml_(out);
}

function tossColIndex_(ref) {
  var letters = /^[A-Z]+/.exec(ref)[0];
  var n = 0;
  for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

/** entries: { 'xl/sharedStrings.xml': '<xml>', 'xl/worksheets/sheet1.xml': '<xml>' } -> 2차원 문자열 배열 */
function tossParseXlsxRows(entries) {
  var shared = [];
  var ssXml = entries['xl/sharedStrings.xml'];
  if (ssXml) {
    var siRe = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
    var sm;
    while ((sm = siRe.exec(ssXml)) !== null) shared.push(tossTextOf_(sm[1]));
  }
  var sheetKey = Object.keys(entries)
    .filter(function (k) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(k); })
    .sort()[0];
  if (!sheetKey) throw new Error('엑셀에서 시트를 찾지 못했습니다.');
  var rows = [];
  var rowRe = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;
  var rm;
  while ((rm = rowRe.exec(entries[sheetKey])) !== null) {
    var row = [];
    var cellRe = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    var cm;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      var ref = /r="([A-Z]+\d+)"/.exec(cm[1]);
      if (!ref) continue;
      var type = (/t="([^"]+)"/.exec(cm[1]) || [])[1];
      var body = cm[2] || '';
      var v = /<v>([\s\S]*?)<\/v>/.exec(body);
      var value = '';
      if (type === 's') value = v ? shared[parseInt(v[1], 10)] || '' : '';
      else if (type === 'inlineStr') value = tossTextOf_(body);
      else value = v ? tossDecodeXml_(v[1]) : '';
      row[tossColIndex_(ref[1])] = value;
    }
    for (var i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
    rows.push(row);
  }
  return rows;
}

function tossPhone(v) {
  var d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length === 10 && d.charAt(0) === '1') d = '0' + d; // 엑셀이 숫자로 읽어 앞 0이 빠진 경우
  return d;
}

function tossPad_(n) { return (n < 10 ? '0' : '') + n; }

/** 거래일시 칸 → 'yyyy-MM-dd HH:mm'(KST). 글자(2026-11-26 10:12:33, 2026.11.26 ...)와 엑셀 날짜 숫자를 모두 읽는다. */
function tossStamp(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 30000) {
    var d = new Date(Math.round((Number(s) - 25569) * 86400000)); // 엑셀 숫자는 벽시계 시각 → UTC 필드로 읽는다
    return d.getUTCFullYear() + '-' + tossPad_(d.getUTCMonth() + 1) + '-' + tossPad_(d.getUTCDate()) + ' ' +
      tossPad_(d.getUTCHours()) + ':' + tossPad_(d.getUTCMinutes());
  }
  var m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2}):(\d{2}))?/);
  if (!m) return s;
  return m[1] + '-' + tossPad_(+m[2]) + '-' + tossPad_(+m[3]) + ' ' + tossPad_(m[4] ? +m[4] : 0) + ':' + (m[5] || '00');
}

/** 'yyyy-MM-dd HH:mm'(KST) → epoch ms */
function tossMs(stamp) {
  var m = String(stamp || '').match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 9 * 60 * 60 * 1000;
}

function tossClean_(v) {
  var s = String(v == null ? '' : v).trim();
  return s === '-' ? '' : s;
}

/** 토스 주문내역 rows → 주문 배열. 헤더가 2줄 병합이어도 '주문번호' 열이 있는 줄을 헤더로 잡는다. */
function tossExtractOrders(rows) {
  var headerIdx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].some(function (c) { return String(c).replace(/\s/g, '') === '주문번호'; })) { headerIdx = i; break; }
  }
  if (headerIdx < 0) throw new Error('토스 주문내역 엑셀 형식이 아닙니다(주문번호 열 없음).');
  var idx = {};
  rows[headerIdx].forEach(function (c, i) {
    var name = String(c).replace(/\s/g, '');
    if (name && idx[name] === undefined) idx[name] = i;
  });
  ['주문번호', '연락처', '주문상태'].forEach(function (k) {
    if (idx[k] === undefined) throw new Error('필수 열이 없습니다: ' + k);
  });
  var get = function (r, k) { return idx[k] === undefined ? '' : tossClean_(r[idx[k]]); };
  var seen = {};
  var out = [];
  for (var r = headerIdx + 1; r < rows.length; r++) {
    var no = get(rows[r], '주문번호');
    if (!no || no.replace(/\s/g, '') === '주문번호') continue;
    var o = {
      orderedAt: tossStamp(get(rows[r], '거래일시')), orderNo: no, product: get(rows[r], '구매상품'),
      option: get(rows[r], '옵션명'), buyer: get(rows[r], '구매자명'), phone: tossPhone(get(rows[r], '연락처')),
      status: get(rows[r], '주문상태'), amount: get(rows[r], '총결제금액')
    };
    if (seen[no] !== undefined) out[seen[no]] = o; // 같은 주문번호가 반복되면 마지막 값
    else { seen[no] = out.length; out.push(o); }
  }
  return out;
}

function tossIsBlog(product) { return TOSS_BLOG_PRODUCT.test(String(product || '')); }

/** 결제가 살아 있는 주문인지(취소·환불·대기·실패는 결제로 안 센다) */
function tossIsPaid(status) {
  var s = String(status || '').trim();
  return !!s && !/(취소|환불|대기|실패|만료)/.test(s);
}

/**
 * 기존 폼 결제 전 행과 토스 결제를 짝짓는다. 연락처가 같고 신청 하루 전~30일 뒤 결제면 같은 건.
 * 결제 하나는 행 하나에만 쓴다(오래된 신청부터, 가장 이른 결제를 가져간다).
 * legacy: [{ key, phone, ts }], orders: [{ orderNo, orderedAt, phone, status }] → { key: order }
 */
function tossMatchLegacy(legacy, orders) {
  var pool = orders.filter(function (o) { return tossIsPaid(o.status) && o.phone && !isNaN(tossMs(o.orderedAt)); })
    .map(function (o) { return { o: o, ms: tossMs(o.orderedAt), used: false }; })
    .sort(function (a, b) { return a.ms - b.ms; });
  var out = {};
  legacy.slice().sort(function (a, b) { return a.ts - b.ts; }).forEach(function (l) {
    var phone = tossPhone(l.phone);
    if (!phone) return;
    for (var i = 0; i < pool.length; i++) {
      var p = pool[i];
      if (p.used || p.o.phone !== phone) continue;
      if (p.ms < l.ts - TOSS_MATCH_BEFORE_MS || p.ms > l.ts + TOSS_MATCH_AFTER_MS) continue;
      p.used = true;
      out[l.key] = p.o;
      return;
    }
  });
  return out;
}

// ── 시트·드라이브 ──
function tossNow_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); }

function tossEnsureTab_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

/** '토스 결제' 탭 → 주문 배열(탭이 없으면 빈 배열) */
function loadTossOrders_(ss) {
  var sh = ss.getSheetByName(TOSS_TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, TOSS_HEADERS.length).getValues().map(function (r) {
    var at = Object.prototype.toString.call(r[0]) === '[object Date]'
      ? Utilities.formatDate(r[0], 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : tossStamp(r[0]);
    return {
      orderedAt: at, orderNo: String(r[1] || '').trim(), product: String(r[2] || ''),
      buyer: String(r[4] || ''), phone: tossPhone(r[5]), status: String(r[6] || ''), amount: r[7]
    };
  }).filter(function (o) { return o.orderNo; });
}

/** 엑셀 rows → 블로그 주문만 '토스 결제' 탭에 주문번호 기준으로 합친다. 결과 한 줄을 돌려준다. */
function tossImportRows_(rawRows) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var all = tossExtractOrders(rawRows);
    var blog = all.filter(function (o) { return tossIsBlog(o.product); });
    var others = {};
    all.forEach(function (o) { if (!tossIsBlog(o.product)) others[o.product || '(상품명 없음)'] = 1; });
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = tossEnsureTab_(ss, TOSS_TAB, TOSS_HEADERS);
    var rowOf = {};
    if (sh.getLastRow() >= 2) {
      sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().forEach(function (r, i) {
        var no = String(r[0] || '').trim();
        if (no) rowOf[no] = i + 2;
      });
    }
    var now = tossNow_();
    var added = 0, updated = 0;
    var appends = [];
    blog.forEach(function (o) {
      var vals = [o.orderedAt, o.orderNo, o.product, o.option, o.buyer, o.phone, o.status, o.amount, now];
      if (rowOf[o.orderNo]) { sh.getRange(rowOf[o.orderNo], 1, 1, vals.length).setValues([vals]); updated++; }
      else { appends.push(vals); added++; }
    });
    if (appends.length) {
      var start = sh.getLastRow() + 1;
      sh.getRange(start, 1, appends.length, 2).setNumberFormat('@'); // 거래일시·주문번호 글자 그대로
      sh.getRange(start, 6, appends.length, 1).setNumberFormat('@'); // 연락처 앞 0 보존
      sh.getRange(start, 1, appends.length, TOSS_HEADERS.length).setValues(appends);
    }
    var otherNames = Object.keys(others);
    return '블로그 ' + blog.length + '건: 신규 ' + added + ' · 갱신 ' + updated +
      (otherNames.length ? ' · 블로그 외 ' + (all.length - blog.length) + '건 제외(' + otherNames.slice(0, 5).join(', ') + ')' : '');
  } finally {
    lock.releaseLock();
  }
}

function tossXlsxRows_(blob) {
  var entries = {};
  var zip = blob.copyBlob().setContentType(MimeType.ZIP); // xlsx blob 그대로는 unzip이 거부한다
  Utilities.unzip(zip).forEach(function (b) { entries[b.getName()] = b.getDataAsString('UTF-8'); });
  return tossParseXlsxRows(entries);
}

function tossFileRows_(f) {
  if (f.getMimeType() === MimeType.GOOGLE_SHEETS) {
    return SpreadsheetApp.openById(f.getId()).getSheets()[0].getDataRange().getDisplayValues();
  }
  return tossXlsxRows_(f.getBlob());
}

/** 폴더들의 .xlsx·구글 시트 파일을 오래된 순으로. 첫 폴더가 없으면 만든다. */
function tossListFiles_() {
  var out = [];
  TOSS_FOLDERS.forEach(function (name, fi) {
    var any = false;
    var folders = DriveApp.getFoldersByName(name);
    while (folders.hasNext()) {
      var folder = folders.next();
      if (folder.isTrashed()) continue;
      any = true;
      var files = folder.getFiles();
      while (files.hasNext()) {
        var f = files.next();
        if (f.isTrashed() || f.getId() === SPREADSHEET_ID) continue;
        if (/\.xlsx$/i.test(f.getName()) || f.getMimeType() === MimeType.GOOGLE_SHEETS) out.push(f);
      }
    }
    if (!any && fi === 0) DriveApp.createFolder(name);
  });
  out.sort(function (x, y) { return x.getDateCreated() - y.getDateCreated(); });
  return out;
}

function tossLog_(fileName, result) {
  var sh = tossEnsureTab_(SpreadsheetApp.openById(SPREADSHEET_ID), TOSS_LOG_TAB, ['시각', '파일', '결과']);
  sh.appendRow([tossNow_(), fileName, result]);
}

/** 10분 트리거. 새로 올라왔거나 바뀐 파일(파일ID+수정시각)만 가져온다. 실패한 파일도 같은 상태로는 다시 안 한다. */
function tossAutoImport() {
  var props = PropertiesService.getScriptProperties();
  var done = JSON.parse(props.getProperty(TOSS_PROCESSED_KEY) || '{}');
  tossListFiles_().forEach(function (f) {
    var key = f.getId() + ':' + f.getLastUpdated().getTime();
    if (done[key]) return;
    try {
      var msg = tossImportRows_(tossFileRows_(f));
      done[key] = tossNow_();
      tossLog_(f.getName(), msg);
    } catch (e) {
      done[key] = 'FAIL ' + tossNow_();
      tossLog_(f.getName(), '실패: ' + e.message);
    }
  });
  var keys = Object.keys(done);
  if (keys.length > 200) keys.slice(0, keys.length - 200).forEach(function (k) { delete done[k]; });
  props.setProperty(TOSS_PROCESSED_KEY, JSON.stringify(done));
}

/** 편집기에서 한 번 실행: 드라이브 권한 승인 + 10분 트리거 설치 + 지금 한 번 가져오기 */
function setupTossImport() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'tossAutoImport') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('tossAutoImport').timeBased().everyMinutes(10).create();
  tossAutoImport();
  Logger.log('토스 가져오기 켬. 폴더: ' + TOSS_FOLDERS.join(', ') + ' / 결과는 "' + TOSS_LOG_TAB + '" 탭');
}

function removeTossImport() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'tossAutoImport') ScriptApp.deleteTrigger(t);
  });
}
