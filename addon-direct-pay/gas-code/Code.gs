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

// 신청 내역 행 배경색 — 결제완료일 있으면 노랑(기존 폼과 동일 규칙)
var ROW_BG_PAID = '#FFE599';

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
  // 알림톡 링크(?b=지점번호)로 들어온 제출이면 붙여넣기로 만든 '직-고급' 대기 행을 채운다(새 행을 만들지 않는다).
  var branchNo = String(formData.branchNo || '').replace(/\D/g, '');
  var pendingRow = branchNo ? findPendingPremiumRow_(sheet, branchNo, null) : 0;
  var newRow;
  if (pendingRow) {
    // 신청일시(A)·결제완료일(B)=제출일(D-day는 작성 시작일 기준), 신청자(C)는 지점명(지점번호) 그대로 둔다.
    sheet.getRange(pendingRow, 1, 1, 2).setValues([[now, now]]);
    sheet.getRange(pendingRow, 4, 1, 10).setValues([[formData.phone, formData.placeUrl,
      formData.keyword1, formData.keyword2 || '', formData.keyword3 || '', formData.description,
      formData.deposit || '', formData.monthly || '', formData.walking || '', tmplType]]);
    newRow = pendingRow;
  } else {
    // 신청일시, 결제완료일(=신청일: 결제는 이미 끝났고 D-day는 작성 시작일 기준), 신청자, 전화번호, 지점URL,
    // 키워드1~3, 강조내용, 보증금, 월세, 도보, 작성타입, 상태
    sheet.appendRow([now, now, formData.name, formData.phone, formData.placeUrl,
      formData.keyword1, formData.keyword2 || '', formData.keyword3 || '', formData.description,
      formData.deposit || '', formData.monthly || '', formData.walking || '', tmplType, '신청완료']);
    newRow = sheet.getLastRow();
  }
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
  sheet.getRange(row, 1, 1, sheet.getLastColumn()).setBackground(ROW_BG_PAID);
  return { status: 'added', branch: tag.branch, paidAt: tag.paidAt, row: row };
}

// ── 고급형: 알림 붙여넣기 → 담당자가 사장님 전화번호 입력 → 시트 저장 + 키워드 폼 링크 알림톡 ──
// 행은 작성 타입 '직-고급'(대기)으로 만들고, 사장님이 폼(?b=지점번호)을 제출하면 그 행이 직A/직B로 채워진다.
// 알림톡 템플릿 ID는 스크립트 속성 TEMPLATE_PREMIUM_FORM. 없으면 저장만 하고 발송하지 않는다.
// 발송 기록은 스크립트 속성 PF_<지점번호>_<결제일시>. 같은 건에 알림톡이 두 번 나가지 않게 한다.
function premiumKey_(branchNo, paidAt) {
  return 'PF_' + String(branchNo) + '_' + Utilities.formatDate(paidAt, 'Asia/Seoul', 'yyyyMMddHHmm');
}

// '직-고급' 대기 행을 아래에서부터 찾는다. paidAt이 있으면 결제일시까지 같아야 한다.
function findPendingPremiumRow_(sheet, branchNo, paidAt) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var from = Math.max(2, lastRow - 199);
  var data = sheet.getRange(from, 1, lastRow - from + 1, 13).getValues();
  var want = paidAt ? Utilities.formatDate(paidAt, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '';
  for (var i = data.length - 1; i >= 0; i--) {
    if (String(data[i][12] || '').trim() !== '직-고급') continue;
    var m = String(data[i][2] || '').match(/\((\d+)\)\s*$/);
    if (!m || m[1] !== String(branchNo)) continue;
    if (want && (!data[i][0] || Utilities.formatDate(new Date(data[i][0]), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') !== want)) continue;
    return from + i;
  }
  return 0;
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
  var phone = digits.length === 11 ? digits.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3')
                                   : digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
  var paidAt = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), parseInt(m[4], 10), parseInt(m[5], 10));
  var key = premiumKey_(branchNo, paidAt);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (props.getProperty(key)) return { success: true, status: 'already_sent' };
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('신청 내역');
    var label = branch + '(' + branchNo + ')';
    var row = findPendingPremiumRow_(sheet, branchNo, paidAt);
    if (row) {
      sheet.getRange(row, 4).setValue(phone);
    } else {
      sheet.appendRow([paidAt, paidAt, label, phone, '', '', '', '', '', '', '', '', '직-고급', '신청완료']);
      row = sheet.getLastRow();
      if (!sheet.getRange(1, 16).getValue()) sheet.getRange(1, 16).setValue('단가');
      var cell = sheet.getRange(row, 16);
      cell.setValue(PRICE_DIRECT_PREMIUM);
      cell.setNumberFormat('₩#,##0');
      sheet.getRange(row, 1, 1, sheet.getLastColumn()).setBackground(ROW_BG_PAID);
    }

    var tmpl = props.getProperty('TEMPLATE_PREMIUM_FORM');
    if (!tmpl) return { success: true, status: 'saved_not_sent', row: row };
    var sent = sendAlimtalk(digits, tmpl, { '#{지점명}': branch, '#{지점번호}': branchNo });
    if (!sent.ok) return { success: true, status: 'send_failed', row: row, msg: sent.msg };
    props.setProperty(key, Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'));
    return { success: true, status: 'sent', row: row };
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
