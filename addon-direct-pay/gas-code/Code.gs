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
// 직-대기 = 고급형 키워드 폼 알림톡을 보냈고 사장님 폼 제출을 기다리는 건(작성 스타일 A/B를 아직 안 고른 상태).
// 알림톡 발송 때 행이 생기고, 사장님이 폼을 내면 같은 행이 직A/직B로 바뀐다(같은 지점번호 가장 오래된 대기 행).
// 폼 제출 흐름(DIRECT_TYPES)과 섞이지 않게 따로 둔다: 폼 타입 검증·완료 알림톡·10분 중복 판정은 직-대기를 보지 않는다.
var PENDING_TYPE   = '직-대기';
var PENDING_STATUS = '응답대기';
var HOLD_STATUS    = '보류'; // 현황 탭에서 응답 대기를 지우면 행은 두고 상태만 보류로 바꾼다
// 고급형 키워드 폼 안내 알림톡 템플릿(솔라피, 변수 #{지점명}). 스크립트 속성 TEMPLATE_PREMIUM_FORM이 있으면 그 값이 우선한다.
var TEMPLATE_PREMIUM_FORM = 'KA01TP2611091218516116IoNk3cbXeW';
// 고급형 접수 완료 알림톡(사장님이 폼을 낸 직후, 변수 #{지점명}·#{키워드}). 카카오 심사 통과 뒤 템플릿 ID를 스크립트 속성
// TEMPLATE_PREMIUM_RECEIVED에 넣는다. 비어 있으면 발송하지 않는다(폼 제출은 그대로 성공).
var TEMPLATE_PREMIUM_RECEIVED = '';
// 작업완료 알림톡(기존 15만원·10만원 GAS의 TEMPLATE_COMPLETE와 같은 템플릿, 변수 #{지점URL}·#{장악키워드}·#{블로그URL})
var TEMPLATE_COMPLETE = 'KA01TP2605150533203936iNKdKqNSyV';

// 신청 내역 행 배경색 — 결제완료일 있으면 노랑(기존 폼과 동일 규칙), 작성완료 주황(10만원 GAS ROW_BG_DONE과 동일).
// 직-일반만 결제완료를 연파랑으로 칠해 직A/직B(노랑)와 구분한다(토미 11.11). 10만원 GAS onSheetEdit도 같은 예외를 둔다.
var ROW_BG_PAID  = '#FFE599';
var ROW_BG_BASIC = '#CFE2F3';
var ROW_BG_DONE  = '#ff9900';
var ROW_BG_PENDING = '#EFEFEF';

// ── 지점명·직-대기 공용 도우미 ──
function placeNo_(url) {
  var m = String(url || '').match(/\/place\/(\d+)/);
  return m ? m[1] : '';
}

function placeUrlOf_(no) { return 'https://gobang.kr/place/' + no; }

function fmtPhone_(digits) {
  var d = String(digits || '').replace(/\D/g, '');
  if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  return d;
}

// 고방 지점 페이지에서 지점명을 읽는다. og:title "[고시원] 월 38~41 / 보 10 - 하이리빙텔 영등포역"의 마지막 " - " 뒤,
// 없으면 <title> "하이리빙텔 영등포역 - 영등포동3가 고시원/고시텔"의 첫 " - " 앞. 못 읽으면 빈 문자열.
var PLACE_FETCH_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

function branchNameFromHtml_(html) {
  var og = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) || html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
  if (og && og[1].indexOf(' - ') >= 0) return og[1].split(' - ').pop().trim();
  var t = html.match(/<title>([^<]+)<\/title>/i);
  if (t && t[1].indexOf(' - ') >= 0) return t[1].split(' - ')[0].trim();
  return '';
}

function branchNameOfPlace_(url) {
  try {
    var html = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: PLACE_FETCH_HEADERS }).getContentText('UTF-8');
    return branchNameFromHtml_(html);
  } catch (e) {}
  return '';
}

// 같은 지점번호의 가장 오래된 직-대기 행 번호(보류 제외). 없으면 0.
function findPendingRow_(sheet, no) {
  var lastRow = sheet.getLastRow();
  if (!no || lastRow < 2) return 0;
  var first = Math.max(2, lastRow - 1999);
  var data = sheet.getRange(first, 1, lastRow - first + 1, 14).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][12] || '').trim() !== PENDING_TYPE) continue;
    if (String(data[i][13] || '').trim() === HOLD_STATUS) continue;
    if (placeNo_(data[i][4]) === no) return first + i;
  }
  return 0;
}

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
    } else if (action === 'hideNotified') {
      result = hideNotified(payload);
    } else if (action === 'previewFill') {
      result = previewFill(payload);
    } else if (action === 'fillPending') {
      result = fillPending(payload);
    } else if (action === 'previewJandi') {
      result = previewJandi(payload.messages, payload.token);
    } else if (action === 'importJandi') {
      result = importJandi(payload);
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

// ── 고급형 응답 대기 5일 경과: 지점에 맞춰 키워드·강조 내용을 알아서 채워 작성을 시작한다 ──
// 사장님이 키워드 폼을 안 낸 직-대기 건이 결제일시(B열)로부터 5일 지나면 마케팅팀이 직접 쓴다. 폼 제출과 같은 경로(submitForm)로
// 직-대기 행을 직A/직B로 바꾸고 완료 내역 행을 만든다. 사실은 지점 페이지에서 읽은 값만 쓰고 지어내지 않는다.
var FILL_AFTER_DAYS = 5;

// 지점 페이지 글자(og:title, <title>, og:description)에서 추천에 쓸 사실만 뽑는다.
function placeFacts_(html) {
  var f = { name: branchNameFromHtml_(html), type: '', dong: '', station: '', walking: '', monthly: '', deposit: '' };
  var og = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) || html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
  if (og) {
    var tm = og[1].match(/^\s*\[([^\]]+)\]/); if (tm) f.type = tm[1].trim();
    var mm = og[1].match(/월\s+([0-9~,]+)/); if (mm) f.monthly = mm[1] + '만원';
    var dm = og[1].match(/보\s+([0-9~,]+)/); if (dm) f.deposit = dm[1] + '만원';
  }
  var t = html.match(/<title>([^<]+)<\/title>/i);
  if (t && t[1].indexOf(' - ') >= 0) {
    var after = t[1].split(' - ').slice(1).join(' - ');
    var dg = after.match(/([가-힣]+동)\d*가?/); if (dg) f.dong = dg[1];
  }
  var desc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) || html.match(/<meta\s+content="([^"]+)"\s+property="og:description"/i);
  var wk = desc && desc[1].match(/([가-힣]+역)\s+도보\s+([0-9]+)분/);
  if (wk) { f.station = wk[1]; f.walking = wk[1] + ' 도보 ' + wk[2] + '분'; }
  if (!f.station) { var sn = String(f.name).match(/([가-힣]+역)/); if (sn) f.station = sn[1]; }
  return f;
}

// 사실(f)로 키워드 후보와 강조 내용 한 덩어리를 만든다. 키워드는 가까운 역·동 + 유형 순.
function suggestFill_(f) {
  var type = f.type || '고시원';
  var alt = type === '고시원' ? '고시텔' : '고시원';
  var cands = [];
  function add(k) { k = String(k || '').replace(/\s+/g, ' ').trim(); if (k && cands.indexOf(k) < 0) cands.push(k); }
  if (f.station) add(f.station + ' ' + type);
  if (f.dong) add(f.dong + ' ' + type);
  add(f.name);
  if (f.station) add(f.station + ' ' + alt);
  if (f.dong) add(f.dong + ' ' + alt);
  var facts = [];
  if (f.monthly) facts.push('월세 ' + f.monthly);
  if (f.deposit) facts.push('보증금 ' + f.deposit);
  if (f.walking) facts.push(f.walking);
  var lead = (f.name || '이 지점') + (f.dong ? '(' + f.dong + ')' : '') + ' ' + type + '입니다.';
  var description = lead + (facts.length ? ' 지점 페이지 기준 ' + facts.join(', ') + '.' : '') + ' 위치와 방 구조, 생활 편의가 잘 보이도록 작성해 주세요.';
  return { candidates: cands, description: description };
}

function toDate_(v) {
  var d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// 5일이 지난 직-대기 행 정보. 못 쓰면 이유(no_row·no_date·not_due)를 준다.
function pendingForFill_(sheet, no) {
  var row = findPendingRow_(sheet, String(no || ''));
  if (!row) return { reason: 'no_row' };
  var r = sheet.getRange(row, 1, 1, 14).getValues()[0];
  var paid = toDate_(r[1]) || toDate_(r[0]);
  if (!paid) return { reason: 'no_date' };
  var days = Math.floor((new Date().getTime() - paid.getTime()) / (24 * 60 * 60 * 1000));
  if (days < FILL_AFTER_DAYS) return { reason: 'not_due', days: days };
  return { row: row, name: String(r[2] || '').trim(), phone: String(r[3] || '').trim(), url: String(r[4] || '').trim() || placeUrlOf_(no), days: days };
}

function authOk_(token) {
  var saved = PropertiesService.getScriptProperties().getProperty('INBOX_TOKEN');
  return !!saved && String(token || '') === saved;
}

// 채우기 미리보기: 추천 키워드(90일 선점 안 걸린 것 3개까지)와 강조 내용. 시트는 쓰지 않는다.
function previewFill(payload) {
  if (!authOk_(payload.token)) return { success: false, reason: 'unauthorized', build: BUILD };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('신청 내역');
  var pend = pendingForFill_(sheet, payload.no);
  if (!pend.row) return { success: false, reason: pend.reason, days: pend.days };
  var html = '';
  try { html = UrlFetchApp.fetch(pend.url, { muteHttpExceptions: true, headers: PLACE_FETCH_HEADERS }).getContentText('UTF-8'); } catch (e) {}
  var facts = placeFacts_(html);
  var sug = suggestFill_(facts);
  var keywords = [], taken = [];
  sug.candidates.forEach(function (k) {
    if (keywords.length >= 3) return;
    if (checkKeyword(k).available) keywords.push(k); else taken.push(k);
  });
  return { success: true, branch: pend.name, days: pend.days, keywords: keywords, taken: taken, description: sug.description, type: '직A' };
}

// 채우기 실행: 직-대기 행을 직A/직B로 바꾼다(폼 제출과 같은 경로). 신청자 칸은 `지점명(번호)` 그대로 둔다.
function fillPending(payload) {
  if (!authOk_(payload.token)) return { success: false, reason: 'unauthorized', build: BUILD };
  var type = String(payload.templateType || '').trim();
  var kws = (payload.keywords || []).map(function (k) { return String(k || '').trim(); });
  var description = String(payload.description || '').trim();
  if (['직A', '직B'].indexOf(type) < 0 || !kws[0] || !description) return { success: false, reason: 'bad_request' };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var pend = pendingForFill_(ss.getSheetByName('신청 내역'), payload.no);
  if (!pend.row) return { success: false, reason: pend.reason === 'no_row' ? 'stale' : pend.reason };
  return submitForm({
    templateType: type, name: pend.name, phone: pend.phone, placeUrl: pend.url,
    keyword1: kws[0], keyword2: kws[1] || '', keyword3: kws[2] || '', description: description,
    skipReceipt: true // 담당자가 대신 시작하는 건이라 사장님께 접수 알림톡을 보내지 않는다
  });
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
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var newRow;
  try {
    // 같은 지점번호로 알림톡을 보내 둔 직-대기 행이 있으면 새 행 대신 그 행을 이어 쓴다.
    // 이때 결제완료일(B)은 알림 원문의 실제 결제일시를 그대로 두고, 신청일시(A)만 제출 시각으로 바꾼다.
    // D-day(결제완료일+7일)는 예전과 같이 제출일 기준(작성 시작일)으로 갱신한다.
    var pendRow = findPendingRow_(sheet, placeNo_(formData.placeUrl));
    // 접수 알림톡의 #{지점명}: 대기 행 신청자 칸 "지점명(번호)"에서 번호를 뗀다(setValues가 덮어쓰기 전에 읽는다).
    var receiptBranch = pendRow ? String(sheet.getRange(pendRow, 3).getValue() || '').replace(/\(\d+\)\s*$/, '').trim() : '';
    // 신청일시, 결제완료일(=신청일: 결제는 이미 끝났고 D-day는 작성 시작일 기준), 신청자, 전화번호, 지점URL,
    // 키워드1~3, 강조내용, 보증금, 월세, 도보, 작성타입, 상태
    var vals = [now, now, formData.name, formData.phone, formData.placeUrl,
      formData.keyword1, formData.keyword2 || '', formData.keyword3 || '', formData.description,
      formData.deposit || '', formData.monthly || '', formData.walking || '', tmplType, '신청완료'];
    if (pendRow) {
      vals[1] = sheet.getRange(pendRow, 2).getValue() || now;
      sheet.getRange(pendRow, 1, 1, 14).setValues([vals]);
      newRow = pendRow;
    } else {
      sheet.appendRow(vals);
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
  } finally {
    lock.releaseLock();
  }

  // 접수 완료 알림톡: 시트 기록이 끝난 뒤 락 밖에서 보낸다. 실패해도 제출은 성공으로 둔다(로그만).
  if (!formData.skipReceipt) {
    try {
      var tmplId = PropertiesService.getScriptProperties().getProperty('TEMPLATE_PREMIUM_RECEIVED') || TEMPLATE_PREMIUM_RECEIVED;
      if (tmplId && formData.phone) {
        var r = sendAlimtalk(formData.phone, tmplId, {
          '#{지점명}': receiptBranch || String(formData.name || '').trim(),
          '#{키워드}': String(formData.keyword1 || '').trim()
        });
        if (!r.ok) Logger.log('접수 완료 알림톡 실패: ' + r.msg);
      }
    } catch (err) {
      Logger.log('접수 완료 알림톡 오류: ' + err);
    }
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
  return appendBasicRow_(sheet, p.branch, p.branchNo, p.paidAt);
}

// 직-일반 행 한 줄 등록(붙여넣기 registerPayment와 잔디 importJandi가 같이 쓴다).
// 같은 지점·같은 결제일시가 최근 2,000행(listStatus 상한과 같음) 안에 이미 있으면 중복으로 보고 쓰지 않는다.
function appendBasicRow_(sheet, branch, branchNo, paidAt) {
  var label = branch + '(' + branchNo + ')';
  var tag = { branch: label, paidAt: Utilities.formatDate(paidAt, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') };
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var from = Math.max(2, lastRow - 1999);
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
  sheet.appendRow([paidAt, paidAt, label, '', '', '', '', '', '', '', '', '', '직-일반', '신청완료']);
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

// 알림톡 발송 직후 신청 내역에 직-대기 행을 만든다. 같은 지점번호+결제일시 행이 이미 있으면 만들지 않는다.
// 신청일시·결제완료일 = 알림 원문 결제일시, 지점URL = gobang.kr/place/<번호>(폼 제출 때 같은 번호로 이 행을 찾는다),
// 신청자 칸에는 일반형처럼 `지점명(번호)`를 넣는다(사장님이 폼을 내면 그 칸이 성함으로 바뀐다). 단가 150,000, 행 회색.
function addPendingRow_(branch, branchNo, paidAt, digits) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('신청 내역');
  var stamp = Utilities.formatDate(paidAt, 'Asia/Seoul', 'yyyyMMddHHmm');
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var first = Math.max(2, lastRow - 1999);
    var data = sheet.getRange(first, 1, lastRow - first + 1, 14).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][12] || '').trim() !== PENDING_TYPE) continue;
      if (placeNo_(data[i][4]) !== String(branchNo) || !data[i][1]) continue;
      if (Utilities.formatDate(new Date(data[i][1]), 'Asia/Seoul', 'yyyyMMddHHmm') === stamp) return;
    }
  }
  sheet.appendRow([paidAt, paidAt, branch + '(' + branchNo + ')', fmtPhone_(digits), placeUrlOf_(branchNo), '', '', '', '', '', '', '', PENDING_TYPE, PENDING_STATUS]);
  var row = sheet.getLastRow();
  setPriceByType_(sheet, row, PENDING_TYPE);
  sheet.getRange(row, 1, 1, sheet.getLastColumn()).setBackground(ROW_BG_PENDING);
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
    // 시트에도 직-대기 행으로 남긴다(폼을 안 낸 결제자가 시트에서 빠지지 않게). 실패해도 알림톡은 이미 나갔으니
    // 발송 성공으로 답하고, 현황 탭은 발송 기록(PF_)으로 계속 보여 준다.
    try { addPendingRow_(branch, branchNo, paidAt, digits); } catch (err) { Logger.log('직-대기 행 기록 실패: ' + err); }
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
// 배포 확인용 표식: 배포 뒤 틀린 토큰으로 listStatus를 불러 이 값이 응답에 오는지 보면 새 코드가 올라간 것(배포.bat이 확인한다)
var BUILD = '2026-11-25-fill-pending';
function listStatus(token) {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('INBOX_TOKEN');
  if (!saved || String(token || '') !== saved) return { success: false, reason: 'unauthorized', build: BUILD };

  var TZ = 'Asia/Seoul';
  var DAY = 24 * 60 * 60 * 1000;
  var now = new Date().getTime();
  function fmt(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm'); }
  function ymd(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
  function asDate(v) { var d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d : null; }
  // 옛 폼 행은 날짜가 "2026. 5. 6 오전 9:51:08" 같은 글자로 들어 있을 수 있어 글자도 읽는다
  function asDateLoose(v) {
    var d = asDate(v); if (d) return d;
    var m = String(v == null ? '' : v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\D+(오전|오후)?\s*(\d{1,2}):(\d{2}))?/);
    if (!m) return null;
    var h = m[5] ? +m[5] : 0;
    if (m[4] === '오후' && h < 12) h += 12;
    if (m[4] === '오전' && h === 12) h = 0;
    return new Date(+m[1], +m[2] - 1, +m[3], h, m[6] ? +m[6] : 0);
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('신청 내역');
  var lastRow = sheet.getLastRow();
  var firstRow = Math.max(2, lastRow - 1999); // 시트 전체(기존 폼 건 포함)를 읽는다. 2,000행 상한
  var rows = lastRow >= 2 ? sheet.getRange(firstRow, 1, lastRow - firstRow + 1, 16).getValues() : [];
  // 결제 추이 집계용 단가(P열, 부가세 포함). 비어 있으면 현재 단가 상수를 쓴다
  function priceOf(v, dflt) { var n = Number(String(v == null ? '' : v).replace(/[^\d.]/g, '')); return n > 0 ? n : dflt; }

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
  var pendingIds = {}; // 직-대기 행이 있는 발송 기록 id(지점번호_결제일시)
  rows.forEach(function (r, idx) {
    var type = String(r[12] || '').trim();
    if (type !== '직-일반' && type !== PENDING_TYPE && DIRECT_TYPES.indexOf(type) < 0) {
      // 15만원·10만원 폼 건(A·B·10-A·10-B): 읽기 전용으로 보여 준다. 결제완료일(B)이 있으면 결제 완료, 없으면 결제 전.
      if (!type) return; // 작성 타입이 없는 행(공지·빈 줄)
      var lp = asDateLoose(r[1]), ld = lp || asDateLoose(r[0]);
      if (!ld) return;
      items.push({
        kind: '기존 폼', label: String(r[2] || '').trim() || '(이름 없음)', paidAt: fmt(ld), ts: ld.getTime(),
        stage: lp ? 'paid' : 'unpaid', price: priceOf(r[15], 0), form: type, no: placeNo_(r[4])
      });
      return;
    }
    var paidB = asDateLoose(r[1]); // 글자로 저장된 날짜도 읽는다(조용히 누락되지 않게)
    var paid = paidB || asDateLoose(r[0]); // 부가상품은 결제 뒤에 등록되는 건이라 결제완료일이 비어도 결제 건이다
    if (!paid) return;
    var name = String(r[2] || '').trim();
    var item = { kind: '', label: name || '(이름 없음)', paidAt: fmt(paid), ts: paid.getTime(), stage: '' };
    if (type === '직-일반') {
      item.kind = '일반형';
      item.price = priceOf(r[15], PRICE_DIRECT_BASIC);
      var st =String(r[13] || '').trim();
      item.stage = st === '작성완료' ? 'basic_done' : 'writing';
      // 체크는 markBasic이 다시 대조할 수 있는 행에만 준다(B 결제완료일·C 신청자가 있고 N이 신청완료/작성완료)
      if (paidB && name && (st === '신청완료' || st === '작성완료')) item.row = firstRow + idx;
    } else {
      item.kind = '고급형';
      item.price = priceOf(r[15], PRICE_DIRECT_PREMIUM);
      // 폼의 지점 URL(gobang.kr/place/<지점번호>)에서 지점번호를 읽어 알림톡 발송 기록과 짝짓는다
      item.no = placeNo_(r[4]);
      // 직-대기 행의 신청자 칸은 이미 `지점명(번호)`라 번호를 또 붙이지 않는다
      if (item.no && type !== PENDING_TYPE) item.label = item.label + '(' + item.no + ')';
      if (type === PENDING_TYPE) {
        // 알림톡만 보내고 폼은 아직인 건. 발송 기록(PF_)과 같은 건이라 아래 발송 기록 줄은 이 행으로 대신한다.
        // 상태 칸이 보류면 현황 탭에서 지운 건이라 보이지 않는다(시트에는 남아 있다).
        item.pending = true;
        item.pfId = item.no + '_' + Utilities.formatDate(paid, TZ, 'yyyyMMddHHmm');
        pendingIds[item.pfId] = true;
        if (String(r[13] || '').trim() === HOLD_STATUS) return;
        item.stage = 'notified';
        item.pf = item.pfId;
        items.push(item);
        return;
      }
      var ps = premiumStage(r[4], asDateLoose(r[0]) || paid);
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
    var pfId = m[1] + '_' + m[2] + m[3] + m[4] + m[5] + m[6];
    pfs.push({ no: m[1], ts: paid.getTime(), name: String(all[k]).split('|').slice(1).join('|').trim(), id: pfId, hidden: !!all['PFX_' + pfId] });
  });
  pfs.sort(function (a, b) { return b.ts - a.ts; });
  var forms = items.filter(function (it) { return it.kind === '고급형' && it.no && !it.pending; })
    .sort(function (a, b) { return a.ts - b.ts; });
  pfs.forEach(function (pf) {
    if (pendingIds[pf.id]) return; // 직-대기 행이 이 건을 대신 보여 준다
    var form = null;
    for (var i = 0; i < forms.length; i++) {
      if (!forms[i].paired && forms[i].no === pf.no && forms[i].ts >= pf.ts) { form = forms[i]; break; }
    }
    if (form) {
      form.paired = true;
      if (pf.name) form.label = pf.name + '(' + pf.no + ')';
      return;
    }
    if (pf.hidden) return; // 시트 DB에서 지운 응답 대기 건
    items.push({
      kind: '고급형', label: pf.name ? pf.name + '(' + pf.no + ')' : '지점번호 ' + pf.no, no: pf.no,
      paidAt: fmt(new Date(pf.ts)), ts: pf.ts, stage: 'notified', pf: pf.id, price: PRICE_DIRECT_PREMIUM
    });
  });

  // 기존 폼 건: 신청자(원장님 이름) 대신 지점명으로 보여 준다. 지점 URL(E열)의 지점번호로 이름을 찾는다.
  // 이미 아는 이름(발송 기록·직-대기 행) → 저장해 둔 이름(BN_) → 고방 지점 페이지 순. 한 번에 최대 30곳만 읽고
  // 나머지는 다음 새로고침에서 채운다. 이름을 못 찾은 건은 원래 신청자 이름 그대로 둔다.
  var nameByNo = {};
  Object.keys(all).forEach(function (k) {
    var bm = k.match(/^BN_(\d+)$/);
    if (bm && all[k]) nameByNo[bm[1]] = all[k];
  });
  pfs.forEach(function (pf) { if (pf.name) nameByNo[pf.no] = pf.name; });
  items.forEach(function (it) {
    if (it.pending && it.no) { var pn = String(it.label).replace(/\(\d+\)$/, '').trim(); if (pn) nameByNo[it.no] = pn; }
  });
  var needNo = [];
  items.forEach(function (it) {
    if (it.kind === '기존 폼' && it.no && !nameByNo[it.no] && needNo.indexOf(it.no) < 0) needNo.push(it.no);
  });
  needNo = needNo.slice(0, 30);
  if (needNo.length) {
    try {
      var fetched = UrlFetchApp.fetchAll(needNo.map(function (n) {
        return { url: placeUrlOf_(n), muteHttpExceptions: true, headers: PLACE_FETCH_HEADERS };
      }));
      var learned = {};
      fetched.forEach(function (rs, fi) {
        var nm = rs.getResponseCode() === 200 ? branchNameFromHtml_(rs.getContentText('UTF-8')) : '';
        if (nm) { nameByNo[needNo[fi]] = nm; learned['BN_' + needNo[fi]] = nm; }
      });
      if (Object.keys(learned).length) props.setProperties(learned);
    } catch (e) {}
  }
  items.forEach(function (it) {
    if (it.kind === '기존 폼' && it.no && nameByNo[it.no]) it.label = nameByNo[it.no] + '(' + it.no + ')';
  });

  items.sort(function (a, b) { return b.ts - a.ts; });
  items.forEach(function (it) { delete it.ts; delete it.paired; delete it.pending; delete it.pfId; });
  // truncated = 2,000행 상한에 걸려 오래된 행이 빠졌다는 뜻(추이의 기록 시작일·평균이 틀어지므로 화면에 알린다)
  return { success: true, items: items, truncated: lastRow - 1 > 2000, build: BUILD,
    billy: loadBillyList_(ss), lastScan: readLastScan_() };
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

// 응답 대기 지우기: 사장님이 응답하지 않거나 취소된 건을 시트 DB 목록에서 뺀다.
// 발송 기록(PF_)은 지우지 않는다(같은 건으로 키워드 폼 알림톡이 다시 나가지 않게 막는 기록이라). 숨김 표시 PFX_만 단다.
function hideNotified(payload) {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('INBOX_TOKEN');
  if (!saved || String(payload.token || '') !== saved) return { success: false, reason: 'unauthorized' };
  var id = String(payload.pf || '');
  if (!/^\d+_\d{12}$/.test(id) || !props.getProperty('PF_' + id)) return { success: false, reason: 'stale' };
  props.setProperty('PFX_' + id, Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'));
  // 같은 건의 직-대기 행은 지우지 않고 상태만 보류로 바꾼다(시트에 이력이 남고, 현황 탭에서는 빠진다).
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('신청 내역');
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var first = Math.max(2, lastRow - 1999);
      var data = sheet.getRange(first, 1, lastRow - first + 1, 14).getValues();
      for (var i = 0; i < data.length; i++) {
        if (String(data[i][12] || '').trim() !== PENDING_TYPE || !data[i][1]) continue;
        var rid = placeNo_(data[i][4]) + '_' + Utilities.formatDate(new Date(data[i][1]), 'Asia/Seoul', 'yyyyMMddHHmm');
        if (rid !== id) continue;
        sheet.getRange(first + i, 14).setValue(HOLD_STATUS);
        break;
      }
    }
  } finally {
    lock.releaseLock();
  }
  return { success: true };
}

// 지금까지 보낸 고급형 키워드 폼 알림톡 중 시트에 행이 없는 건을 직-대기 행으로 만든다(편집기에서 직접 실행, 몇 번 돌려도 같은 결과).
// 근거는 발송 기록(스크립트 속성 PF_<지점번호>_<결제일시>, 값 = 발송시각|지점명)이다. 같은 지점번호로 그 결제 뒤에 들어온
// 직A/직B 폼 행이 있으면 폼을 낸 건이라 만들지 않고(발송 기록과 폼 행을 오래된 순으로 하나씩 짝지음), 이미 직-대기 행이 있는 건도 건너뛴다.
// 현황에서 지운 건(PFX_)은 상태 보류로 만든다. 전화번호는 발송 기록에 없어 빈 칸이다. 옛 기록은 지점명이 없어 고방 지점 페이지에서 읽는다.
// 발송 기록이 없는 건(스티브가 손으로 보낸 안내 등)은 만들 수 없다.
function backfillPendingRows() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('신청 내역');
  var lastRow = sheet.getLastRow();
  var rows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 14).getValues() : [];
  var STAMP = 'yyyyMMddHHmm';
  var pfs = [];
  Object.keys(props).forEach(function (k) {
    var m = k.match(/^PF_(\d+)_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (!m) return;
    pfs.push({ no: m[1], id: m[1] + '_' + m[2] + m[3] + m[4] + m[5] + m[6], ts: new Date(+m[2], +m[3] - 1, +m[4], +m[5], +m[6]),
      name: String(props[k]).split('|').slice(1).join('|').trim(), hidden: !!props['PFX_' + m[1] + '_' + m[2] + m[3] + m[4] + m[5] + m[6]] });
  });
  pfs.sort(function (a, b) { return a.ts - b.ts; });
  var havePending = {};
  var forms = [];
  rows.forEach(function (r) {
    var type = String(r[12] || '').trim();
    var no = placeNo_(r[4]);
    if (type === PENDING_TYPE && r[1]) havePending[no + '_' + Utilities.formatDate(new Date(r[1]), 'Asia/Seoul', STAMP)] = true;
    else if (DIRECT_TYPES.indexOf(type) >= 0 && no) {
      var t = r[1] ? new Date(r[1]) : (r[0] ? new Date(r[0]) : null);
      if (t && !isNaN(t.getTime())) forms.push({ no: no, ts: t.getTime(), used: false });
    }
  });
  forms.sort(function (a, b) { return a.ts - b.ts; });
  var made = 0, skippedForm = 0, skippedHave = 0;
  pfs.forEach(function (pf) {
    if (havePending[pf.id]) { skippedHave++; return; }
    for (var i = 0; i < forms.length; i++) {
      if (!forms[i].used && forms[i].no === pf.no && forms[i].ts >= pf.ts.getTime()) { forms[i].used = true; skippedForm++; return; }
    }
    var name = pf.name || branchNameOfPlace_(placeUrlOf_(pf.no));
    sheet.appendRow([pf.ts, pf.ts, name ? name + '(' + pf.no + ')' : '지점번호 ' + pf.no, '', placeUrlOf_(pf.no), '', '', '', '', '', '', '', PENDING_TYPE, pf.hidden ? HOLD_STATUS : PENDING_STATUS]);
    var row = sheet.getLastRow();
    setPriceByType_(sheet, row, PENDING_TYPE);
    sheet.getRange(row, 1, 1, sheet.getLastColumn()).setBackground(ROW_BG_PENDING);
    made++;
  });
  Logger.log('직-대기 행 생성 ' + made + '건, 폼 제출로 이미 행 있음 ' + skippedForm + '건, 대기 행 이미 있음 ' + skippedHave + '건');
  return { made: made, skippedForm: skippedForm, skippedHave: skippedHave };
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
  ['SOLAPI_API_KEY', 'SOLAPI_API_SECRET', 'SOLAPI_PF_ID', 'TEMPLATE_PREMIUM_FORM', 'TEMPLATE_PREMIUM_RECEIVED', 'INBOX_TOKEN'].forEach(function (k) {
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

// ── 잔디 결제 알림 분류 미리보기 (읽기 전용, 슬라이스 2·7) ──
// 분류기 본체는 JandiClassify.gs(= js/jandi-classify.js 와 글자까지 같은 파일, 테스트가 확인한다).
// 이 구간의 함수는 시트·스크립트 속성을 읽기만 한다(쓰기 호출이 없다는 것을 테스트가 확인한다).
// 쓰는 함수는 아래 "잔디 결제 알림 등록" 구간에만 둔다.
var JANDI_MAX_MESSAGES = 500;
var JANDI_LOG_TAB = '잔디 수집 로그';
var JANDI_BILLY_TAB = '부가상품 결제';
var JANDI_PENDING = ['번호필요', '확인필요']; // 로그에 남기는 판정(사람이 할 일)

function jandiStamp_(v) {
  var d = Object.prototype.toString.call(v) === '[object Date]' ? v : null;
  if (d && !isNaN(d.getTime())) return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  return JandiClassify.stampOf(v);
}

function jandiText_(m) {
  return String(m && typeof m === 'object' && m.text !== undefined ? m.text : (m == null ? '' : m));
}

// 대조에 쓸 기존 행: 신청 내역(직-일반·직-대기·직A·직B), 알림톡 발송 기록(PF_), 부가상품 결제 탭(있으면)
function loadJandiExisting_(ss) {
  ss = ss || SpreadsheetApp.openById(SPREADSHEET_ID);
  var out = [];
  var sheet = ss.getSheetByName('신청 내역');
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var first = Math.max(2, lastRow - 1999);
    sheet.getRange(first, 1, lastRow - first + 1, 14).getValues().forEach(function (r) {
      var type = String(r[12] || '').trim();
      var stamp = jandiStamp_(r[1]) || jandiStamp_(r[0]);
      if (type === '직-일반') {
        var m = String(r[2] || '').match(/\((\d+)\)\s*$/);
        if (m) out.push({ type: type, no: m[1], paidAt: stamp });
      } else if (type === PENDING_TYPE || DIRECT_TYPES.indexOf(type) >= 0) {
        var no = placeNo_(r[4]);
        if (no) out.push({ type: type, no: no, paidAt: stamp });
      }
    });
  }
  var all = PropertiesService.getScriptProperties().getProperties();
  Object.keys(all).forEach(function (k) {
    var m = k.match(/^PF_(\d+)_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (m) out.push({ type: 'PF', no: m[1], paidAt: m[2] + '-' + m[3] + '-' + m[4] + ' ' + m[5] + ':' + m[6] });
  });
  var billy = ss.getSheetByName(JANDI_BILLY_TAB);
  if (billy && billy.getLastRow() >= 2) {
    var bFirst = Math.max(2, billy.getLastRow() - 1999);
    billy.getRange(bFirst, 1, billy.getLastRow() - bFirst + 1, 3).getValues().forEach(function (r) {
      var no = String(r[2] || '').replace(/\D/g, '');
      if (no) out.push({ type: 'billy', no: no, paidAt: jandiStamp_(r[0]) });
    });
  }
  return out;
}

// 수집 로그 탭(없으면 빈 목록): 열 = 수집일시, 키, 지점, 판정, 사유, 원문, 동반 상품, 메시지 결제금액, 종결일시
function loadJandiLog_(ss) {
  var sheet = ss.getSheetByName(JANDI_LOG_TAB);
  var rows = [];
  if (sheet && sheet.getLastRow() >= 2) {
    var first = Math.max(2, sheet.getLastRow() - 4999);
    sheet.getRange(first, 1, sheet.getLastRow() - first + 1, 9).getValues().forEach(function (r, i) {
      rows.push({
        row: first + i, key: String(r[1] || '').trim(), branch: String(r[2] || '').trim(),
        judgment: String(r[3] || '').trim(), closed: !!r[8]
      });
    });
  }
  return { sheet: sheet, rows: rows };
}

function jandiLogHas_(log, key, judgment) {
  return log.rows.some(function (r) { return r.key === key && r.judgment === judgment; });
}

// 종결된 확인필요·번호필요 조각에 closed:true와 reason "종결됨"을 붙인다(class는 그대로)
function jandiApplyClosed_(results, log) {
  results.forEach(function (x) {
    var any = false;
    x.pieces.forEach(function (p) {
      var hit = log.rows.some(function (r) {
        return r.closed && r.key === p.key && r.judgment === p.status;
      });
      if (hit) { p.closed = true; p.reason = (p.reason ? p.reason + ' · ' : '') + '종결됨'; any = true; }
    });
    if (any) {
      var reasons = [];
      x.pieces.forEach(function (p) { if (p.reason && reasons.indexOf(p.reason) < 0) reasons.push(p.reason); });
      x.reason = reasons.join(' / ');
    }
  });
}

// 읽기 회귀 점검: 로그에 있던 결제가 이번 읽은 범위 안인데 이번 글 목록에 없으면 읽기가 덜 됐다는 신호다
function jandiRegression_(results, log) {
  var seen = {}, oldest = '', missing = [], done = {};
  results.forEach(function (x) {
    x.pieces.forEach(function (p) {
      if (p.key) seen[p.key] = true;
      if (p.paidAt && (!oldest || p.paidAt < oldest)) oldest = p.paidAt;
    });
  });
  if (!oldest) return { missing: missing };
  log.rows.forEach(function (r) {
    var m = r.key.match(/^\d+_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (!m || seen[r.key] || done[r.key]) return;
    var stamp = m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5];
    if (stamp < oldest) return;
    done[r.key] = true;
    missing.push({ key: r.key, branch: r.branch, paidAt: stamp });
  });
  return { missing: missing };
}

// 마지막으로 끝까지 읽은 수집 기록(스크립트 속성 JANDI_LAST_SCAN). 없으면 null
function readLastScan_() {
  var raw = PropertiesService.getScriptProperties().getProperty('JANDI_LAST_SCAN');
  if (!raw) return null;
  try {
    var o = JSON.parse(raw);
    return o && o.at ? { at: o.at, complete: true } : null;
  } catch (e) { return null; }
}

function previewJandi(messages, token) {
  var saved = PropertiesService.getScriptProperties().getProperty('INBOX_TOKEN');
  if (!saved || String(token || '') !== saved) return { success: false, reason: 'unauthorized' };
  if (!Array.isArray(messages) || !messages.length) return { success: false, reason: 'bad_request' };
  if (messages.length > JANDI_MAX_MESSAGES) return { success: false, reason: 'too_many' };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var log = loadJandiLog_(ss);
  var r = JandiClassify.classifyMessages(messages, loadJandiExisting_(ss));
  jandiApplyClosed_(r.results, log);
  return {
    success: true, readOnly: true, results: r.results, counts: r.counts,
    regression: jandiRegression_(r.results, log)
  };
}

// ── 잔디 결제 알림 등록 (importJandi, 슬라이스 4·6·7) ──
// 서버가 원문을 다시 분류하고 confirm에 든 열쇠(key)만 쓴다(화면의 분류를 믿지 않는다).
// 스크립트 잠금 안에서 실행하고, 같은 호출을 되풀이해도 행이 늘지 않는다(중복 키 = 지점번호 + 결제일시 분).
// 고급형은 전화번호가 필요해 자동 등록하지 않는다(registerPremium 흐름).
function jandiDate_(stamp) {
  // KST 벽시계 글자 -> 시각. 스크립트 시간대와 상관없이 같은 순간이 된다
  var m = String(stamp).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5])) : null;
}

// 시트 수식으로 읽히지 않게 = + - @ 로 시작하는 글자 앞에 작은따옴표를 붙인다
function jandiSafe_(v) {
  var s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function jandiEnsureTab_(ss, name, header) {
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  sheet = ss.insertSheet(name, ss.getSheets().length); // 맨 뒤(첫 탭 gid 0·위치로 읽는 코드를 건드리지 않는다)
  sheet.appendRow(header);
  return sheet;
}

// 부가상품 결제 탭에 빌리투어 한 줄. 같은 지점번호 + 결제일시(분)가 이미 있으면 쓰지 않는다. 금액은 조각 단가.
function appendBillyRow_(ss, p) {
  var sheet = jandiEnsureTab_(ss, JANDI_BILLY_TAB, ['결제일시', '지점명', '지점번호', '상품', '금액', '상태']);
  var last = sheet.getLastRow();
  if (last >= 2) {
    var first = Math.max(2, last - 1999);
    var data = sheet.getRange(first, 1, last - first + 1, 3).getValues();
    for (var i = 0; i < data.length; i++) {
      if (jandiStamp_(data[i][0]) === p.paidAt && String(data[i][2] || '').replace(/\D/g, '') === p.branchNo) {
        return { status: 'duplicate' };
      }
    }
  }
  sheet.appendRow([jandiDate_(p.paidAt), jandiSafe_(p.branch), p.branchNo, jandiSafe_(p.product),
    JandiClassify.PRICE.billy, '진행전']);
  var row = sheet.getLastRow();
  sheet.getRange(row, 1).setNumberFormat('yyyy-MM-dd HH:mm');
  sheet.getRange(row, 5).setNumberFormat('₩#,##0');
  return { status: 'added', row: row };
}

function jandiLogAdd_(ss, log, p, text, companions, closedAt) {
  var sheet = jandiEnsureTab_(ss, JANDI_LOG_TAB, ['수집일시', '키', '지점', '판정', '사유', '원문',
    '같은 글의 동반 상품', '메시지 결제금액', '종결일시']);
  log.sheet = sheet;
  sheet.appendRow([jandiNow_(), p.key, jandiSafe_(p.branch), p.status, jandiSafe_(p.reason),
    jandiSafe_(String(text).slice(0, 1000)), jandiSafe_(companions), p.amount == null ? '' : p.amount,
    closedAt || '']);
  log.rows.push({ row: sheet.getLastRow(), key: p.key, branch: p.branch, judgment: p.status,
    closed: !!closedAt });
}

// 열쇠가 같은 로그 줄의 종결일시를 채운다. 바뀐 줄 수를 돌려준다
function jandiLogClose_(log, key) {
  var n = 0;
  log.rows.forEach(function (r) {
    if (r.key !== key || r.closed) return;
    log.sheet.getRange(r.row, 9).setValue(jandiNow_());
    r.closed = true;
    n++;
  });
  return n;
}

function jandiNow_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); }

function importJandi(payload) {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('INBOX_TOKEN');
  if (!saved || String(payload.token || '') !== saved) return { success: false, reason: 'unauthorized' };
  var messages = payload.messages;
  if (!Array.isArray(messages) || !messages.length) return { success: false, reason: 'bad_request' };
  if (messages.length > JANDI_MAX_MESSAGES) return { success: false, reason: 'too_many' };
  var confirm = payload.confirm == null ? [] : payload.confirm;
  if (!Array.isArray(confirm)) return { success: false, reason: 'bad_request' };
  if (confirm.length > JANDI_MAX_MESSAGES) return { success: false, reason: 'too_many' };
  var scan = payload.scan || {};

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('신청 내역');
    var log = loadJandiLog_(ss);
    var cls = JandiClassify.classifyMessages(messages, loadJandiExisting_(ss));
    var pieces = [];
    cls.results.forEach(function (x) { x.pieces.forEach(function (p) { pieces.push(p); }); });

    var results = [], seen = {}, closedNow = {};
    var counts = { added: 0, duplicate: 0, closed: 0, skipped: 0, error: 0 };

    function findPiece(key, kind) {
      return pieces.filter(function (p) { return p.key === key && p.kind === kind && p.status !== '중복'; })[0];
    }
    function confirmAdd(res, key, action) {
      var kind = action === 'basic' ? 'basic' : 'billy';
      var p = findPiece(key, kind);
      if (!p) {
        res.reason = findPiece(key, 'premium')
          ? '고급형은 자동 등록하지 않아요(전화번호가 필요해요)' : '이번 글 목록에 없는 열쇠예요';
        return;
      }
      var review = p.status === '확인필요';
      if (p.status === '이미있음' || p.exists) {
        res.status = 'duplicate'; res.reason = '이미 시트에 있어요';
      } else if (p.status === '새로등록' || p.status === '빌리투어쌓기' ||
        (review && p.extracted && p.branchNo && p.paidAt)) {
        var r = kind === 'basic'
          ? appendBasicRow_(sheet, p.branch, p.branchNo, jandiDate_(p.paidAt))
          : appendBillyRow_(ss, p);
        res.status = r.status === 'added' ? 'added' : 'duplicate';
        res.reason = r.status === 'added' ? '시트에 등록했어요(' + r.row + '행)' : '이미 시트에 있어요';
      } else {
        res.reason = '등록할 수 없는 상태예요(' + p.status + ')';
        return;
      }
      // 사람이 읽은 값을 확인하고 등록한 확인필요 글은 처리된 것이라 종결한다
      if (review) { jandiLogClose_(log, key); closedNow[key] = true; }
    }
    function confirmClose(res, key) {
      var changed = jandiLogClose_(log, key);
      var had = log.rows.some(function (r) { return r.key === key; });
      var p = pieces.filter(function (q) {
        return q.key === key && JANDI_PENDING.indexOf(q.status) >= 0 && !jandiLogHas_(log, key, q.status);
      })[0];
      if (p) {
        jandiLogAdd_(ss, log, p, jandiText_(messages[p.messageIndex]), '', jandiNow_());
        closedNow[key] = true;
      }
      if (changed || p || had) { res.status = 'closed'; res.reason = '종결로 기록했어요'; }
      else res.reason = '종결할 항목이 없어요';
    }

    confirm.forEach(function (c) {
      var key = String(c && c.key != null ? c.key : '').trim();
      var action = String(c && c.action != null ? c.action : '').trim();
      var res = { key: key, action: action, status: 'skipped', reason: '' };
      try {
        if (!key || ['basic', 'billy', 'close'].indexOf(action) < 0) {
          res.status = 'error'; res.reason = 'bad_request';
        } else if (seen[action + ':' + key]) {
          res.status = 'duplicate'; res.reason = '같은 요청이 한 호출에 두 번 들어왔어요';
        } else {
          seen[action + ':' + key] = true;
          if (action === 'close') confirmClose(res, key); else confirmAdd(res, key, action);
        }
      } catch (err) {
        res.status = 'error'; res.reason = String(err);
      }
      counts[res.status]++;
      results.push(res);
    });

    // confirm이 비어 있어도 이번 스캔의 확인필요·번호필요 조각은 로그에 남긴다(같은 열쇠+같은 판정은 다시 쓰지 않는다)
    var logged = 0;
    pieces.forEach(function (p) {
      if (JANDI_PENDING.indexOf(p.status) < 0 || !p.key || jandiLogHas_(log, p.key, p.status)) return;
      var comps = [];
      pieces.forEach(function (q) {
        if (q !== p && q.messageIndex === p.messageIndex && q.product && comps.indexOf(q.product) < 0) {
          comps.push(q.product);
        }
      });
      jandiLogAdd_(ss, log, p, jandiText_(messages[p.messageIndex]), comps.join(', '),
        closedNow[p.key] ? jandiNow_() : '');
      logged++;
    });

    // 끝까지 읽은 스캔만 마지막 수집 기록을 갱신한다
    if (scan.complete === true && !scan.aborted) {
      props.setProperty('JANDI_LAST_SCAN', JSON.stringify({
        at: new Date().toISOString(), oldestAt: String(scan.oldestAt || ''), newestId: String(scan.newestId || '')
      }));
    }
    return { success: true, results: results, counts: counts, logged: logged, lastScan: readLastScan_() };
  } finally {
    lock.releaseLock();
  }
}

// 현황 탭용: 부가상품 결제 탭(없으면 빈 목록)을 결제 최신순으로. 읽기 전용
function loadBillyList_(ss) {
  var sheet = ss.getSheetByName(JANDI_BILLY_TAB);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var first = Math.max(2, sheet.getLastRow() - 1999);
  var out = [];
  sheet.getRange(first, 1, sheet.getLastRow() - first + 1, 6).getValues().forEach(function (r) {
    var paidAt = jandiStamp_(r[0]);
    if (!paidAt) return;
    out.push({
      paidAt: paidAt, branch: String(r[1] || '').trim(), branchNo: String(r[2] || '').replace(/\D/g, ''),
      product: String(r[3] || '').trim(), amount: Number(String(r[4] == null ? '' : r[4]).replace(/[^\d.]/g, '')) || 0,
      status: String(r[5] || '').trim()
    });
  });
  out.sort(function (a, b) { return a.paidAt < b.paidAt ? 1 : (a.paidAt > b.paidAt ? -1 : 0); });
  return out;
}
