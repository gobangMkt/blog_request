/* ═══════════════════════════════════════════════════════════
   부가상품 직접결제 — 블로그 고급형 신청 GAS (독립 프로젝트)
   - 고방U사장님에서 부가상품(블로그 고급형 15만원, VAT 포함)을 이미 결제한 원장님 전용 폼.
   - 같은 구글시트(SPREADSHEET_ID)의 '신청 내역'에 쌓는다. 작성 타입 '직A'/'직B'로 기존 폼 건과 구분.
   - 결제가 먼저 끝난 건이라: 결제요청 알림톡 없음 · 결제완료일 자동 기입 · 팀 알림메일(키워드·요청사항 포함).
   - 이 프로젝트에는 시트 편집 트리거(onSheetEdit)·리마인드 트리거를 두지 않는다
     (기존 15만원/10만원 GAS의 트리거와 중복 발동 방지). 설치하지 말 것.
   - 설정 시트의 신청기간·최대 신청수·ON/OFF는 읽지 않는다(기존 폼 전용). 링크 발급·서명 없음 — 공개 폼.
   - 결제 확인은 마케팅팀이 원장님께 폼 주소를 보내기 전에 한다(제출은 결제완료로 기록되고 팀 알림메일이 나간다).
   ═══════════════════════════════════════════════════════════ */
var SPREADSHEET_ID = '1lgAsrtoeqv1-g3Nh3D21zTyuGLdAZuP5jSXxftlIxh0';
var PRICE_DIRECT_PREMIUM = 150000; // 직A/직B — 고급형, 부가세 포함 (2026-11-09 결제화면 기준)
var DIRECT_TYPES   = ['직A', '직B'];
// 고급형 키워드 폼 안내 알림톡 템플릿(솔라피, 변수 #{지점명}). 스크립트 속성 TEMPLATE_PREMIUM_FORM이 있으면 그 값이 우선한다.
var TEMPLATE_PREMIUM_FORM = 'KA01TP2611091218516116IoNk3cbXeW';
// 작업완료 알림톡(기존 15만원·10만원 GAS의 TEMPLATE_COMPLETE와 같은 템플릿, 변수 #{지점URL}·#{장악키워드}·#{블로그URL})
var TEMPLATE_COMPLETE = 'KA01TP2605150533203936iNKdKqNSyV';

// 신청 내역 행 배경색 — 결제완료일 있으면 노랑(기존 폼과 동일 규칙), 작성완료 주황(10만원 GAS ROW_BG_DONE과 동일).
// 직-일반만 결제완료를 연파랑으로 칠해 직A/직B(노랑)와 구분한다(토미 11.11). 10만원 GAS onSheetEdit도 같은 예외를 둔다.
var ROW_BG_PAID  = '#FFE599';
var ROW_BG_BASIC = '#CFE2F3';
var ROW_BG_DONE  = '#ff9900';

function getSettings() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var s = ss.getSheetByName('설정');
  var data = s.getRange(1, 1, 6, 2).getValues();
  return {
    keywordDays:  data[4][1] ? parseInt(data[4][1]) : 90,
    notifyEmails: data[5]
      ? String(data[5][1] || '').split(/[,\s]+/).filter(function(x){ return x; }).join(',')
      : ''
  };
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var result;
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    if (action === 'checkKeyword') {
      result = checkKeyword(payload.keyword);
    } else if (action === 'fetchPlaceInfo') {
      result = fetchPlaceInfo(payload.url);
    } else if (action === 'submitForm') {
      result = submitForm(payload);
    } else if (action === 'registerPayment') {
      result = registerPayment(payload.text, payload.token);
    } else if (action === 'registerPremium') {
      result = registerPremium(payload);
    } else if (action === 'listStatus') {
      result = listStatus(payload.token);
    } else if (action === 'markBasic') {
      result = markBasic(payload);
    } else if (action === 'completePremium') {
      result = completePremium(payload);
    } else if (action === 'checkToken') {
      // paste.html 입장 시 접근 코드 한 번 확인(시트는 읽지 않는다)
      var saved = PropertiesService.getScriptProperties().getProperty('INBOX_TOKEN');
      result = { success: !!saved && String(payload.token || '') === saved };
    } else {
      result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.toString() };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// 키워드 선점 중복 체크 — 완료 내역 시트(G=완료일, E=장악 키워드) 기준, 기존 폼과 동일 규칙.
function checkKeyword(keyword) {
  if (!keyword || keyword.trim() === '') return { available: true };
  var normalizedInput = keyword.trim().replace(/\s+/g, '');
  var limitDays = getSettings().keywordDays || 90;
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('완료 내역');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { available: true };
  var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  for (var i = 0; i < data.length; i++) {
    if (!data[i][6]) continue;
    var completedDate = new Date(data[i][6]);
    var normalizedStored = String(data[i][4]).trim().replace(/\s+/g, '');
    if (normalizedStored === normalizedInput) {
      completedDate.setHours(0, 0, 0, 0);
      var diffDays = Math.floor((today - completedDate) / (1000 * 60 * 60 * 24));
      if (diffDays < limitDays) return { available: false, remainingDays: limitDays - diffDays };
    }
  }
  return { available: true };
}

function fetchPlaceInfo(url) {
  try {
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    var html = response.getContentText('UTF-8');
    var result = { deposit: '', monthly: '', walking: '', ogTitle: '', ogDesc: '', ogImage: '' };

    var ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    if (!ogTitleMatch) ogTitleMatch = html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
    if (ogTitleMatch) {
      result.ogTitle = ogTitleMatch[1];
      var mMatch = ogTitleMatch[1].match(/월\s+([0-9~,]+)/);
      if (mMatch) result.monthly = mMatch[1] + '만원';
      var dMatch = ogTitleMatch[1].match(/보\s+([0-9~,]+)/);
      if (dMatch) result.deposit = dMatch[1] + '만원';
    }

    var ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (!ogDescMatch) ogDescMatch = html.match(/<meta\s+content="([^"]+)"\s+property="og:description"/i);
    if (ogDescMatch) {
      result.ogDesc = ogDescMatch[1];
      var wMatch = ogDescMatch[1].match(/([가-힣]+역\s+도보\s+[0-9]+분)/);
      if (wMatch) result.walking = wMatch[1];
    }

    var ogImgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (!ogImgMatch) ogImgMatch = html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
    if (ogImgMatch) result.ogImage = ogImgMatch[1];

    return result;
  } catch(e) {
    return { error: true, msg: e.toString() };
  }
}

// 같은 지점 URL의 직접결제 건이 최근 10분 안에 이미 있으면 중복 제출(더블클릭)로 본다.
// 기존 폼처럼 "지점당 1회"로 막지 않는다 — 이미 결제한 원장님을 돌려보내면 안 된다(재구매·타 폼 이력 무관).
function isRecentDuplicate_(sheet, placeUrl) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var from = Math.max(2, lastRow - 29);
  var data = sheet.getRange(from, 1, lastRow - from + 1, 13).getValues();
  var target = String(placeUrl || '').trim().toLowerCase();
  var cutoff = new Date().getTime() - 10 * 60 * 1000;
  for (var i = 0; i < data.length; i++) {
    var t = String(data[i][12] || '').trim();
    if (DIRECT_TYPES.indexOf(t) < 0) continue;
    if (String(data[i][4] || '').trim().toLowerCase() !== target) continue;
    if (data[i][0] && new Date(data[i][0]).getTime() > cutoff) return true;
  }
  return false;
}

function submitForm(formData) {
  var tmplType = String(formData.templateType || '').trim();
  if (DIRECT_TYPES.indexOf(tmplType) < 0) return { success: false, reason: 'invalid_type' };

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('신청 내역');
  if (isRecentDuplicate_(sheet, formData.placeUrl)) return { success: false, reason: 'duplicate_url' };

  var kw = checkKeyword(formData.keyword1);
  if (!kw.available) return { success: false, reason: 'keyword_taken', remainingDays: kw.remainingDays };

  var now = new Date();
  // 신청일시, 결제완료일(=신청일: 결제는 이미 끝났고 D-day는 작성 시작일 기준), 신청자, 전화번호, 지점URL,
  // 키워드1~3, 강조내용, 보증금, 월세, 도보, 작성타입, 상태
  sheet.appendRow([now, now, formData.name, formData.phone, formData.placeUrl,
    formData.keyword1, formData.keyword2 || '', formData.keyword3 || '', formData.description,
    formData.deposit || '', formData.monthly || '', formData.walking || '', tmplType, '신청완료']);
  var newRow = sheet.getLastRow();
  setPriceByType_(sheet, newRow, tmplType); // P열(16) 단가
  sheet.getRange(newRow, 1, 1, sheet.getLastColumn()).setBackground(ROW_BG_PAID);

  var doneSheet = ss.getSheetByName('완료 내역');
  if (doneSheet) {
    // D-day(A), 신청자(B), 전화번호(C), 지점URL(D), 장악키워드(E), 블로그URL(F), 완료일(G), 발송상태(H), 발송시간(I)
    doneSheet.appendRow(['', formData.name || '', formData.phone || '', formData.placeUrl || '', '', '', '', '', '']);
    doneSheet.getRange(doneSheet.getLastRow(), 8).setValue('발송대기');
  }

  // 프로그래밍 setValue는 시트 편집 트리거를 발동시키지 않으므로 후속 작업(D-day 갱신 + 팀 알림메일)을 직접 호출한다.
  try {
    applyBlogPaymentComplete_(ss, sheet, newRow, now);
  } catch (err) {
    Logger.log('결제완료 후속작업 실패: ' + err);
  }

  return { success: true };
}

// ── 결제 알림(U사장님 운영팀 "[상품 결제완료]" 문자) 붙여넣기 → 직-일반 행 자동 등록 ──
// 마케팅팀 전용 페이지(paste.html)에서 호출한다. 스크립트 속성 INBOX_TOKEN과 같은 값을 보내야 한다.
// 블로그 일반형만 행을 만든다. 고급형은 원장님이 폼을 제출할 때 행이 생기므로 건너뛴다.
// 완료 내역 행은 만들지 않는다(원장님 완료 알림톡이 나갈 수 없게). 팀 알림메일도 없다(붙여넣은 사람이 곧 마케팅팀).
var PRICE_DIRECT_BASIC = 70000; // 직-일반 — 부가세 포함

function registerPayment(text, token) {
  var saved = PropertiesService.getScriptProperties().getProperty('INBOX_TOKEN');
  if (!saved || String(token || '') !== saved) return { success: false, reason: 'unauthorized' };
  var blocks = String(text || '').split(/\[Web발신\]/).filter(function (b) { return /상품\s*결제완료/.test(b); });
  if (!blocks.length) return { success: false, reason: 'no_alert' };
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('신청 내역');
  var results = blocks.map(function (b) {
    try { return registerOnePayment_(sheet, b); }
    catch (err) { return { status: 'error', msg: String(err) }; }
  });
  return { success: true, results: results };
}

function parsePaymentAlert_(block) {
  var br = block.match(/상품\s*결제완료\]\s*\r?\n\s*(.+)\((\d+)\)[ \t]*\r?\n/);
  var dt = block.match(/결제일시:\s*(\d{2})\.(\d{2})\.(\d{2})\s+(\d{1,2}):(\d{2})/);
  // 붙여넣은 글에 뒤따르는 대화가 섞일 수 있으니 결제상품~결제금액 사이에서만 상품을 찾는다.
  var items = block.match(/결제상품:([\s\S]*?)결제금액:/);
  var bl = items ? items[1].match(/블로그\s*(일반형|고급형)/) : null;
  return {
    branch: br ? br[1].trim() : '',
    branchNo: br ? br[2] : '',
    paidAt: dt ? new Date(2000 + parseInt(dt[1], 10), parseInt(dt[2], 10) - 1, parseInt(dt[3], 10),
      parseInt(dt[4], 10), parseInt(dt[5], 10)) : null,
    blog: bl ? bl[1] : ''
  };
}

function registerOnePayment_(sheet, block) {
  var p = parsePaymentAlert_(block);
  if (!p.branch || !p.paidAt) return { status: 'parse_error', branch: p.branch };
  var label = p.branch + '(' + p.branchNo + ')';
  var tag = { branch: label, paidAt: Utilities.formatDate(p.paidAt, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') };
  if (!p.blog) return { status: 'no_blog', branch: tag.branch, paidAt: tag.paidAt };
  if (p.blog === '고급형') {
    // 이미 알림톡을 보낸 건이면 다시 묻지 않는다. 아니면 담당자가 전화번호를 넣어 저장·발송한다.
    if (PropertiesService.getScriptProperties().getProperty(premiumKey_(p.branchNo, p.paidAt))) {
      return { status: 'duplicate', branch: tag.branch, paidAt: tag.paidAt };
    }
    return { status: 'premium_need_phone', branch: p.branch, branchNo: p.branchNo, paidAt: tag.paidAt };
  }

  // 같은 지점·같은 결제일시가 이미 있으면 중복 붙여넣기로 본다.
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var from = Math.max(2, lastRow - 199);
    var data = sheet.getRange(from, 1, lastRow - from + 1, 13).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][12] || '').trim() !== '직-일반') continue;
      if (String(data[i][2] || '').trim() !== label) continue;
      if (data[i][1] && Utilities.formatDate(new Date(data[i][1]), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') === tag.paidAt) {
        return { status: 'duplicate', branch: tag.branch, paidAt: tag.paidAt };
      }
    }
  }
  // 신청일시, 결제완료일(=결제일시), 신청자(지점명+번호), 전화번호(알림에 없음), 지점URL, 키워드1~3, 강조내용,
  // 보증금, 월세, 도보, 작성타입, 상태
  sheet.appendRow([p.paidAt, p.paidAt, label, '', '', '', '', '', '', '', '', '', '직-일반', '신청완료']);
  var row = sheet.getLastRow();
  if (!sheet.getRange(1, 16).getValue()) sheet.getRange(1, 16).setValue('단가');
  var cell = sheet.getRange(row, 16);
  cell.setValue(PRICE_DIRECT_BASIC);
  cell.setNumberFormat('₩#,##0');
  sheet.getRange(row, 1, 1, sheet.getLastColumn()).setBackground(ROW_BG_BASIC);
  return { status: 'added', branch: tag.branch, paidAt: tag.paidAt, row: row };
}

// ── 고급형: 알림 붙여넣기 → 담당자가 사장님 전화번호 입력 → 키워드 폼 링크 알림톡 발송 ──
// 시트에는 쓰지 않는다. 사장님이 폼을 제출하면 submitForm이 행을 만든다(기존과 같다).
// 알림톡 템플릿 ID는 스크립트 속성 TEMPLATE_PREMIUM_FORM(변수 #{지점명} 하나). 없으면 발송하지 않는다.
// 발송 기록은 스크립트 속성 PF_<지점번호>_<결제일시>. 같은 건에 알림톡이 두 번 나가지 않게 한다.
function premiumKey_(branchNo, paidAt) {
  return 'PF_' + String(branchNo) + '_' + Utilities.formatDate(paidAt, 'Asia/Seoul', 'yyyyMMddHHmm');
}

function registerPremium(payload) {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('INBOX_TOKEN');
  if (!saved || String(payload.token || '') !== saved) return { success: false, reason: 'unauthorized' };

  var branchNo = String(payload.branchNo || '').replace(/\D/g, '');
  var branch = String(payload.branch || '').trim();
  var m = String(payload.paidAt || '').match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!branchNo || !branch || !m) return { success: false, reason: 'bad_request' };
  var digits = String(payload.phone || '').replace(/\D/g, '');
  if (!/^01[016789]\d{7,8}$/.test(digits)) return { success: false, reason: 'bad_phone' };
  var paidAt = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), parseInt(m[4], 10), parseInt(m[5], 10));
  var key = premiumKey_(branchNo, paidAt);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (props.getProperty(key)) return { success: true, status: 'already_sent' };
    var tmpl = props.getProperty('TEMPLATE_PREMIUM_FORM') || TEMPLATE_PREMIUM_FORM;
    if (!tmpl) return { success: true, status: 'no_template' };
    var sent = sendAlimtalk(digits, tmpl, { '#{지점명}': branch });
    if (!sent.ok) return { success: true, status: 'send_failed', msg: sent.msg };
    // 값 = 발송시각|지점명 (지점명은 현황 탭 표기용. 옛 건은 발송시각만 있다)
    props.setProperty(key, Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') + '|' + branch);
    return { success: true, status: 'sent' };
  } finally {
    lock.releaseLock();
  }
}

// ── 현황 탭: 부가상품 직접결제 건을 시트처럼 결제 시간순으로 (읽기 전용, paste.html 현황 탭) ──
// 상태(stage):
//   notified   = 고급형 알림 붙여넣기 → 사장님께 키워드 폼 알림톡을 보냄(스크립트 속성 PF_ 기록, 최근 30일). 사실만 보여 준다.
//                폼은 지점번호를 받지 않아 어느 제출이 이 건인지 알 수 없으므로 짝짓지 않는다(11.11 개발팀장 리뷰).
//   writing    = 작성 전(직A/직B는 완료 내역 완료일 없음, 직-일반은 N열 신청완료)
//   sendwait   = 고급형 작성 완료, 사장님 완료 알림톡 전(완료 내역 H 발송대기)
//   sent       = 고급형 완료 알림톡 보냄(완료 내역 H 발송완료)
//   basic_done = 직-일반 N열 작성완료(현황 탭 체크로 바꾼다)
function listStatus(token) {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('INBOX_TOKEN');
  if (!saved || String(token || '') !== saved) return { success: false, reason: 'unauthorized' };

  var TZ = 'Asia/Seoul';
  var DAY = 24 * 60 * 60 * 1000;
  var now = new Date().getTime();
  function fmt(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm'); }
  function ymd(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
  function asDate(v) { var d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d : null; }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('신청 내역');
  var lastRow = sheet.getLastRow();
  var firstRow = Math.max(2, lastRow - 499);
  var rows = lastRow >= 2 ? sheet.getRange(firstRow, 1, lastRow - firstRow + 1, 14).getValues() : [];

  // 완료 내역: 지점 URL → 행 목록(위에서 아래 순). 직A/직B 건은 D-day(A열 = 결제완료일 + 7일)가 같은 행으로 대조하고,
  // 없으면 그 URL의 가장 아래 행을 쓴다(같은 URL로 다른 폼이 들어와 빈 행이 붙어도 끝난 건이 되돌아가지 않게).
  var done = {};
  var doneSheet = ss.getSheetByName('완료 내역');
  if (doneSheet && doneSheet.getLastRow() >= 2) {
    doneSheet.getRange(2, 1, doneSheet.getLastRow() - 1, 9).getValues().forEach(function (r, di) {
      var u = String(r[3] || '').trim().toLowerCase();
      if (!u) return;
      var dd = asDate(r[0]);
      (done[u] = done[u] || []).push({
        row: di + 2, dDay: dd ? ymd(dd) : '', doneAt: r[6], sent: String(r[7] || '').trim(), sentAt: r[8],
        kw: String(r[4] || '').trim(), blog: String(r[5] || '').trim(), tail: String(r[2] || '').replace(/\D/g, '').slice(-4)
      });
    });
  }
  function premiumStage(url, paid) {
    var list = done[String(url || '').trim().toLowerCase()];
    if (!list || !list.length) return { stage: 'writing', hit: null };
    var want = ymd(new Date(paid.getTime() + 7 * DAY));
    var hit = null;
    for (var i = list.length - 1; i >= 0; i--) { if (list[i].dDay === want) { hit = list[i]; break; } }
    if (!hit) hit = list[list.length - 1];
    if (hit.sent === '발송완료' || hit.sentAt) return { stage: 'sent', hit: hit };
    return { stage: hit.doneAt ? 'sendwait' : 'writing', hit: hit };
  }

  var items = [];
  rows.forEach(function (r, idx) {
    var type = String(r[12] || '').trim();
    if (type !== '직-일반' && DIRECT_TYPES.indexOf(type) < 0) return;
    var paidB = asDate(r[1]);
    var paid = paidB || asDate(r[0]);
    if (!paid) return;
    var name = String(r[2] || '').trim();
    var item = { kind: '', label: name || '(이름 없음)', paidAt: fmt(paid), ts: paid.getTime(), stage: '' };
    if (type === '직-일반') {
      item.kind = '일반형';
      var st = String(r[13] || '').trim();
      item.stage = st === '작성완료' ? 'basic_done' : 'writing';
      // 체크는 markBasic이 다시 대조할 수 있는 행에만 준다(B 결제완료일·C 신청자가 있고 N이 신청완료/작성완료)
      if (paidB && name && (st === '신청완료' || st === '작성완료')) item.row = firstRow + idx;
    } else {
      item.kind = '고급형';
      // 폼의 지점 URL(gobang.kr/place/<지점번호>)에서 지점번호를 읽어 알림톡 발송 기록과 짝짓는다
      var pm = String(r[4] || '').match(/\/place\/(\d+)/);
      item.no = pm ? pm[1] : '';
      if (item.no) item.label = item.label + '(' + item.no + ')';
      var ps = premiumStage(r[4], paid);
      item.stage = ps.stage;
      // 완료 알림 팝업에 필요한 값: 완료 내역 행이 있고 아직 안 보낸 건에만 준다(completePremium이 다시 대조)
      if (ps.hit && ps.stage !== 'sent' && paidB) {
        item.reqRow = firstRow + idx;
        item.doneRow = ps.hit.row;
        item.kws = [r[5], r[6], r[7]].map(function (x) { return String(x || '').trim(); }).filter(function (x) { return x; });
        item.kw = ps.hit.kw;
        item.blog = ps.hit.blog;
        item.tail = ps.hit.tail;
      }
    }
    items.push(item);
  });

  // 고급형 키워드 폼 알림톡 보낸 기록 (스크립트 속성 PF_<지점번호>_<결제일시>, 값 = 발송시각|지점명).
  // 같은 지점번호로 그 결제 뒤에 폼이 들어왔으면 그 폼 행이 이 건이다: 발송 기록 줄은 빼고 지점명만 폼 행에 옮긴다.
  // 폼 지점 URL에 지점번호가 들어 있어 짝지을 수 있다(11.11 확인, 이전엔 짝짓지 않았다).
  var pfs = [];
  var all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    var m = k.match(/^PF_(\d+)_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (!m) return;
    var paid = new Date(+m[2], +m[3] - 1, +m[4], +m[5], +m[6]);
    if (now - paid.getTime() > 30 * DAY) return;
    pfs.push({ no: m[1], ts: paid.getTime(), name: String(all[k]).split('|').slice(1).join('|').trim() });
  });
  pfs.sort(function (a, b) { return b.ts - a.ts; });
  var forms = items.filter(function (it) { return it.kind === '고급형' && it.no; })
    .sort(function (a, b) { return a.ts - b.ts; });
  pfs.forEach(function (pf) {
    var form = null;
    for (var i = 0; i < forms.length; i++) {
      if (!forms[i].paired && forms[i].no === pf.no && forms[i].ts >= pf.ts) { form = forms[i]; break; }
    }
    if (form) {
      form.paired = true;
      if (pf.name) form.label = pf.name + '(' + pf.no + ')';
      return;
    }
    items.push({
      kind: '고급형', label: pf.name ? pf.name + '(' + pf.no + ')' : '지점번호 ' + pf.no,
      paidAt: fmt(new Date(pf.ts)), ts: pf.ts, stage: 'notified'
    });
  });

  items.sort(function (a, b) { return b.ts - a.ts; });
  items.forEach(function (it) { delete it.ts; delete it.paired; });
  return { success: true, items: items };
}

// 현황 탭 체크: 직-일반 행 N열을 작성완료 ↔ 신청완료로 바꾸고 행 색도 맞춘다(작성완료 주황 / 결제완료 연파랑).
// 행이 밀렸을 수 있어 행 번호만 믿지 않고 작성 타입·신청자·결제일시가 그대로인지 확인한다.
// N열이 신청완료·작성완료가 아니면(보류·취소 등 다른 값) 덮어쓰지 않는다.
function markBasic(payload) {
  var saved = PropertiesService.getScriptProperties().getProperty('INBOX_TOKEN');
  if (!saved || String(payload.token || '') !== saved) return { success: false, reason: 'unauthorized' };
  var row = parseInt(payload.row, 10);
  if (!(row >= 2)) return { success: false, reason: 'bad_request' };
  var done = payload.done === true;

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('신청 내역');
    if (row > sheet.getLastRow()) return { success: false, reason: 'stale' };
    var v = sheet.getRange(row, 1, 1, 14).getValues()[0];
    var paid = v[1] ? new Date(v[1]) : null;
    var st = String(v[13] || '').trim();
    if (String(v[12] || '').trim() !== '직-일반'
        || String(v[2] || '').trim() !== String(payload.label || '').trim()
        || !paid || isNaN(paid.getTime())
        || Utilities.formatDate(paid, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') !== String(payload.paidAt || '')
        || (st !== '신청완료' && st !== '작성완료')) {
      return { success: false, reason: 'stale' };
    }
    sheet.getRange(row, 14).setValue(done ? '작성완료' : '신청완료');
    sheet.getRange(row, 1, 1, sheet.getLastColumn()).setBackground(done ? ROW_BG_DONE : ROW_BG_BASIC);
    return { success: true, stage: done ? 'basic_done' : 'writing' };
  } finally {
    lock.releaseLock();
  }
}

// 고급형 작성 완료 → 사장님 작업완료 알림톡 (paste.html 시트 DB 체크 → 팝업).
// 기존 시트 흐름(완료 내역 H열 '발송하기', 10만원·15만원 GAS onSheetEdit)과 같은 템플릿·같은 칸을 쓴다:
// E 장악키워드 · F 블로그URL · G 완료일 · H 발송완료 · I 발송시각, 신청 내역 행은 주황.
// 행이 밀렸을 수 있어 신청 내역 행(작성 타입·결제일시·지점 URL)과 완료 내역 행(같은 지점 URL)을 다시 대조한다.
// 이미 보낸 건(H 발송완료 또는 I 발송시각)은 다시 보내지 않는다.
function completePremium(payload) {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('INBOX_TOKEN');
  if (!saved || String(payload.token || '') !== saved) return { success: false, reason: 'unauthorized' };
  var reqRow = parseInt(payload.reqRow, 10), doneRow = parseInt(payload.doneRow, 10);
  var kw = String(payload.keyword || '').trim();
  var blog = String(payload.blogUrl || '').trim();
  if (!(reqRow >= 2) || !(doneRow >= 2)) return { success: false, reason: 'bad_request' };
  if (!kw || kw.length > 60) return { success: false, reason: 'bad_keyword' };
  if (!/^https?:\/\/\S+$/.test(blog)) return { success: false, reason: 'bad_url' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var req = ss.getSheetByName('신청 내역');
    var doneSheet = ss.getSheetByName('완료 내역');
    if (!doneSheet || reqRow > req.getLastRow() || doneRow > doneSheet.getLastRow()) return { success: false, reason: 'stale' };
    var v = req.getRange(reqRow, 1, 1, 14).getValues()[0];
    var d = doneSheet.getRange(doneRow, 1, 1, 9).getValues()[0];
    var paid = v[1] ? new Date(v[1]) : null;
    var url = String(v[4] || '').trim();
    if (DIRECT_TYPES.indexOf(String(v[12] || '').trim()) < 0
        || !paid || isNaN(paid.getTime())
        || Utilities.formatDate(paid, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') !== String(payload.paidAt || '')
        || !url || String(d[3] || '').trim().toLowerCase() !== url.toLowerCase()) {
      return { success: false, reason: 'stale' };
    }
    if (String(d[7] || '').trim() === '발송완료' || d[8]) return { success: true, status: 'already_sent' };
    var phone = String(d[2] || '').replace(/\D/g, '');
    if (!/^01[016789]\d{7,8}$/.test(phone)) return { success: true, status: 'no_phone' };

    // 다시 열었을 때 그대로 보이게 먼저 적는다. 완료일(G)은 보낸 뒤에 적는다(키워드 선점 90일이 완료일 기준).
    doneSheet.getRange(doneRow, 5, 1, 2).setValues([[kw, blog]]);
    var sent = sendAlimtalk(phone, TEMPLATE_COMPLETE, { '#{지점URL}': url, '#{장악키워드}': kw, '#{블로그URL}': blog });
    if (!sent.ok) return { success: true, status: 'send_failed', msg: sent.msg };
    var now = new Date();
    doneSheet.getRange(doneRow, 7, 1, 3).setValues([[now, '발송완료', Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')]]);
    req.getRange(reqRow, 1, 1, req.getLastColumn()).setBackground(ROW_BG_DONE);
    return { success: true, status: 'sent', stage: 'sent' };
  } finally {
    lock.releaseLock();
  }
}

// SOLAPI 알림톡 발송 (기존 10만원·15만원 GAS와 같은 방식). SOLAPI_API_KEY·SOLAPI_API_SECRET·SOLAPI_PF_ID 스크립트 속성 필요.
function sendAlimtalk(to, templateId, variables) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('SOLAPI_API_KEY');
  var apiSecret = props.getProperty('SOLAPI_API_SECRET');
  var pfId = props.getProperty('SOLAPI_PF_ID');
  if (!apiKey || !apiSecret || !pfId) return { ok: false, msg: 'SOLAPI 스크립트 속성이 없어요' };
  var date = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  var salt = Utilities.getUuid();
  var signature = Utilities.computeHmacSha256Signature(date + salt, apiSecret)
    .map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  var res = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'HMAC-SHA256 apiKey=' + apiKey + ', date=' + date + ', salt=' + salt + ', signature=' + signature },
    payload: JSON.stringify({ message: {
      to: String(to).replace(/[^0-9]/g, ''),
      kakaoOptions: { pfId: pfId, templateId: templateId, variables: variables }
    } }),
    muteHttpExceptions: true
  });
  var body = res.getContentText();
  Logger.log('알림톡 응답: ' + body);
  var code = res.getResponseCode();
  var j = {};
  try { j = JSON.parse(body); } catch (e) {}
  if (code >= 200 && code < 300 && !j.errorCode) return { ok: true };
  return { ok: false, msg: String(j.errorMessage || j.errorCode || ('HTTP ' + code)).slice(0, 120) };
}

// SOLAPI 스크립트 속성 점검 — 값 노출 없이 존재 여부만 로그 (편집기에서 직접 실행)
function checkSolapiProps() {
  var props = PropertiesService.getScriptProperties();
  ['SOLAPI_API_KEY', 'SOLAPI_API_SECRET', 'SOLAPI_PF_ID', 'TEMPLATE_PREMIUM_FORM', 'INBOX_TOKEN'].forEach(function (k) {
    Logger.log(k + ': ' + (props.getProperty(k) ? '있음' : '없음'));
  });
}

// P열(16) 단가 — 직A/직B(부가상품 고급형, 부가세 포함) = 150,000
function setPriceByType_(sheet, row, tmplType) {
  if (!sheet.getRange(1, 16).getValue()) sheet.getRange(1, 16).setValue('단가');
  var cell = sheet.getRange(row, 16);
  cell.setValue(PRICE_DIRECT_PREMIUM);
  cell.setNumberFormat('₩#,##0');
}

// 완료내역 D-day 갱신(결제완료일 + 7일) + 팀원 알림메일. 기존 폼의 applyBlogPaymentComplete_와 동일 동작.
function applyBlogPaymentComplete_(ss, sheet, row, paymentDate) {
  var dDay = new Date(paymentDate);
  dDay.setDate(dDay.getDate() + 7);
  var placeUrl = sheet.getRange(row, 5).getValue();
  if (placeUrl) {
    var doneSheet = ss.getSheetByName('완료 내역');
    if (doneSheet) {
      var lastRow = doneSheet.getLastRow();
      if (lastRow >= 2) {
        var doneUrls = doneSheet.getRange(2, 4, lastRow - 1, 1).getValues();
        var normalizedUrl = String(placeUrl).trim().toLowerCase();
        // 같은 URL이 여러 행이면 가장 최근 행(아래쪽)이 이번 건이다
        for (var i = doneUrls.length - 1; i >= 0; i--) {
          if (String(doneUrls[i][0]).trim().toLowerCase() === normalizedUrl) {
            doneSheet.getRange(i + 2, 1).setValue(dDay);
            break;
          }
        }
      }
    }
  }
  try {
    var notifyTo = getSettings().notifyEmails;
    if (notifyTo) {
      var rowData = sheet.getRange(row, 1, 1, 14).getValues()[0];
      var name = String(rowData[2] || '');
      var subject = '[고방 블로그] 부가상품 결제완료(고급형) — ' + name;
      var body = [
        '부가상품(블로그 고급형)을 결제한 원장님이 신청서를 제출했어요.',
        '',
        '신청일: ' + Utilities.formatDate(new Date(paymentDate), 'Asia/Seoul', 'yyyy-MM-dd'),
        '신청자: ' + name,
        '전화번호: ' + String(rowData[3] || ''),
        '지점 URL: ' + String(rowData[4] || ''),
        '키워드1: ' + String(rowData[5] || ''),
        '키워드2: ' + String(rowData[6] || ''),
        '키워드3: ' + String(rowData[7] || ''),
        '강조 내용(요청사항): ' + String(rowData[8] || ''),
        '작성 타입: ' + String(rowData[12] || '') + ' (' + PRICE_DIRECT_PREMIUM + '원, 부가세 포함)',
        '',
        '▶ 신청 내역 확인: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID
      ].join('\n');
      MailApp.sendEmail(notifyTo, subject, body);
    }
  } catch (mailErr) {}
}
