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
