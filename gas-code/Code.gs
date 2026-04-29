var SPREADSHEET_ID = '1lgAsrtoeqv1-g3Nh3D21zTyuGLdAZuP5jSXxftlIxh0';

function getSettings() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var s = ss.getSheetByName('\uc124\uc815');
  var data = s.getRange(1, 1, 5, 2).getValues();
  return {
    active:      String(data[0][1]).trim(),
    startDate:   data[1][1] ? new Date(data[1][1]) : null,
    endDate:     data[2][1] ? new Date(data[2][1]) : null,
    maxCount:    data[3][1] ? parseInt(data[3][1]) : null,
    keywordDays: data[4][1] ? parseInt(data[4][1]) : 90
  };
}

function checkAccess() {
  var cfg = getSettings();
  var now = new Date();

  if (cfg.active !== 'ON') return { ok: false, reason: '\uc2e0\uccad\uc744 \ubc1b\uc9c0 \uc54a\uace0 \uc788\uc5b4\uc694' };

  if (cfg.startDate) {
    cfg.startDate.setHours(0,0,0,0);
    if (now < cfg.startDate) {
      var diff = Math.ceil((cfg.startDate - now) / 86400000);
      return { ok: false, reason: diff + '\uc77c \ud6c4 \uc2e0\uccad \uac00\ub2a5\ud569\ub2c8\ub2e4' };
    }
  }

  if (cfg.endDate) {
    cfg.endDate.setHours(23,59,59,999);
    if (now > cfg.endDate) return { ok: false, reason: '\uc2e0\uccad \uae30\uac04\uc774 \ub9c8\uac10\ub418\uc5c8\uc5b4\uc694' };
  }

  if (cfg.maxCount !== null) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('\uc2e0\uccad \ub0b4\uc5ed');
    var count = Math.max(0, sheet.getLastRow() - 1);
    if (count >= cfg.maxCount) return { ok: false, reason: '\uc2e0\uccad \uc778\uc6d0\uc774 \ub9c8\uac10\ub418\uc5c8\uc5b4\uc694' };
  }

  return { ok: true };
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var result;

    if (action === 'checkAccess') {
      var access = checkAccess();
      var cfg = getSettings();
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheet = ss.getSheetByName('\uc2e0\uccad \ub0b4\uc5ed');
      var currentCount = Math.max(0, sheet.getLastRow() - 1);
      result = {
        ok: access.ok,
        reason: access.reason || '',
        startDate: cfg.startDate ? Utilities.formatDate(cfg.startDate, 'Asia/Seoul', 'yyyy.MM.dd') : '',
        endDate: cfg.endDate ? Utilities.formatDate(cfg.endDate, 'Asia/Seoul', 'yyyy.MM.dd') : '',
        maxCount: cfg.maxCount || 0,
        currentCount: currentCount
      };
    } else if (action === 'checkKeyword') {
      result = checkKeyword(payload.keyword);
    } else if (action === 'fetchPlaceInfo') {
      result = fetchPlaceInfo(payload.url);
    } else if (action === 'checkPlaceUrl') {
      result = checkPlaceUrl(payload.url);
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

function checkPlaceUrl(url) {
  if (!url) return { available: true };
  var cfg = getSettings();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('\uc2e0\uccad \ub0b4\uc5ed');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { available: true };
  var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  var normalizedInput = url.trim().toLowerCase();

  var periodStart = null, periodEnd = null;
  if (cfg.startDate) { periodStart = new Date(cfg.startDate); periodStart.setHours(0, 0, 0, 0); }
  if (cfg.endDate)   { periodEnd   = new Date(cfg.endDate);   periodEnd.setHours(23, 59, 59, 999); }

  for (var i = 0; i < data.length; i++) {
    var rowUrl = String(data[i][3]).trim().toLowerCase();
    if (rowUrl !== normalizedInput) continue;

    if (!periodStart && !periodEnd) return { available: false };

    var rowDate = new Date(data[i][0]);
    var inPeriod = true;
    if (periodStart && rowDate < periodStart) inPeriod = false;
    if (periodEnd   && rowDate > periodEnd)   inPeriod = false;
    if (inPeriod) return { available: false };
  }
  return { available: true };
}

function checkKeyword(keyword) {
  if (!keyword || keyword.trim() === '') return { available: true };
  var normalizedInput = keyword.trim().replace(/\s+/g, '');
  var cfg = getSettings();
  var limitDays = cfg.keywordDays || 90;
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('\uc644\ub8cc \ub0b4\uc5ed');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { available: true };
  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  for (var i = 0; i < data.length; i++) {
    if (!data[i][0]) continue;
    var completedDate = new Date(data[i][0]);
    var normalizedStored = String(data[i][1]).trim().replace(/\s+/g, '');
    if (normalizedStored === normalizedInput) {
      completedDate.setHours(0, 0, 0, 0);
      var diffDays = Math.floor((today - completedDate) / (1000 * 60 * 60 * 24));
      if (diffDays < limitDays) {
        return { available: false, remainingDays: limitDays - diffDays };
      }
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
      var mMatch = ogTitleMatch[1].match(/\uc6d4\s+([0-9~,]+)/);
      if (mMatch) result.monthly = mMatch[1] + '\ub9cc\uc6d0';
      var dMatch = ogTitleMatch[1].match(/\ubcf4\s+([0-9~,]+)/);
      if (dMatch) result.deposit = dMatch[1] + '\ub9cc\uc6d0';
    }

    var ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (!ogDescMatch) ogDescMatch = html.match(/<meta\s+content="([^"]+)"\s+property="og:description"/i);
    if (ogDescMatch) {
      result.ogDesc = ogDescMatch[1];
      var wMatch = ogDescMatch[1].match(/([\uac00-\ud7a3]+\uc5ed\s+\ub3c4\ubcf4\s+[0-9]+\ubd84)/);
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

function submitForm(formData) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var urlCheck = checkPlaceUrl(formData.placeUrl);
  if (!urlCheck.available) return { success: false, reason: 'duplicate_url' };

  var sheet = ss.getSheetByName('\uc2e0\uccad \ub0b4\uc5ed');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['\uc2e0\uccad\uc77c\uc2dc', '\uc774\ub984', '\uc804\ud654\ubc88\ud638', '\uc9c0\uc810 URL', '\ud0a4\uc6cc\ub4dc1', '\ud0a4\uc6cc\ub4dc2', '\ud0a4\uc6cc\ub4dc3', '\uac15\uc870 \ub0b4\uc6a9', '\ubcf4\uc99d\uae08', '\uc6d4\uc138', '\ub3c4\ubcf4\uc815\ubcf4', '\uc791\uc131 \ud0c0\uc785', '\uc0c1\ud0dc', '\uc644\ub8cc\uc77c', '\ube14\ub85c\uadf8 URL']);
    sheet.getRange(1, 1, 1, 15).setFontWeight('bold').setBackground('#f0f0f0');
  }
  var now = new Date();
  sheet.appendRow([now, formData.name, formData.phone, formData.placeUrl, formData.keyword1, formData.keyword2 || '', formData.keyword3 || '', formData.description, formData.deposit || '', formData.monthly || '', formData.walking || '', formData.templateType || 'A', '\uc2e0\uccad\uc644\ub8cc', '', '']);

  // \uc644\ub8cc \ub0b4\uc5ed\uc5d0 \uc9c0\uc810URL(C\uc5f4), \uc2e0\uccad\uc790\ubc88\ud638(E\uc5f4)\ub9cc \ucd94\uac00 \u2014 \ub098\uba38\uc9c0 \uc5f4 \uac74\ub4dc\ub9ac\uc9c0 \uc54a\uc74c
  var doneSheet = ss.getSheetByName('\uc644\ub8cc \ub0b4\uc5ed');
  if (doneSheet) {
    // 완료일(A), 키워드(B), 전화번호(C), 지점URL(D), 블로그URL(E)
    doneSheet.appendRow(['', '', formData.phone || '', formData.placeUrl || '', '']);
  }

  // 신청 접수 이메일 알림
  try {
    var NOTIFY_EMAIL = 'archoit94@neoflat.net';
    var subject = '[고방 블로그] 새 신청 접수 — ' + formData.name + ' / ' + (formData.keyword1 || '');
    var body = [
      '새로운 블로그 신청이 접수됐어요.',
      '',
      '신청일시: ' + Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
      '이름: ' + formData.name,
      '전화번호: ' + formData.phone,
      '지점 URL: ' + formData.placeUrl,
      '키워드: ' + [formData.keyword1, formData.keyword2, formData.keyword3].filter(Boolean).join(' / '),
      '작성 타입: ' + (formData.templateType || 'A') + '타입',
      '',
      '▶ 신청 내역 확인: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID,
    ].join('\n');
    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
  } catch(mailErr) {}

  return { success: true };
}

function testAuth() {
  var ss = SpreadsheetApp.openById('1lgAsrtoeqv1-g3Nh3D21zTyuGLdAZuP5jSXxftlIxh0');
  Logger.log(ss.getName());
}
