/* ═══════════════════════════════════════════════════════════
   부가상품 직접결제 — 블로그 고급형 신청 GAS (독립 프로젝트)
   - 고방U사장님에서 부가상품(블로그 고급형 15만원, VAT 포함)을 이미 결제한 원장님 전용 폼.
   - 같은 구글시트(SPREADSHEET_ID)의 '신청 내역'에 쌓는다. 작성 타입 '직A'/'직B'로 기존 폼 건과 구분.
   - 결제가 먼저 끝난 건이라: 결제요청 알림톡 없음 · 결제완료일 자동 기입 · 팀 알림메일(키워드·요청사항 포함).
   - 이 프로젝트에는 시트 편집 트리거(onSheetEdit)·리마인드 트리거를 두지 않는다
     (기존 15만원/10만원 GAS의 트리거와 중복 발동 방지). 설치하지 말 것.
   - 설정 시트의 신청기간·최대 신청수·ON/OFF는 읽지 않는다(기존 폼 전용). 접근 제어 = 서명 링크 유효기간뿐.
   ═══════════════════════════════════════════════════════════ */
var SPREADSHEET_ID = '1lgAsrtoeqv1-g3Nh3D21zTyuGLdAZuP5jSXxftlIxh0';
var FORM_BASE_URL  = 'https://gobangmkt.github.io/blog_request/부가상품-직접결제/';
var LINK_TTL_DAYS  = 14; // 발급일 + 14일이 마감 (결제 후 원장님이 작성할 시간)
var PRICE_DIRECT_PREMIUM = 150000; // 직A/직B — 고급형, 부가세 포함 (2026-11-09 결제화면 기준)
var DIRECT_TYPES   = ['직A', '직B'];

// 신청 내역 행 배경색 — 결제완료일 있으면 노랑(기존 폼과 동일 규칙)
var ROW_BG_PAID = '#FFE599';

// ── 서명 링크 (URL 위조 방지) ───────────────────────────────────────
// 비밀키는 스크립트 속성에 1회 자동 생성·보관 → 코드/깃에 노출되지 않음(repo는 public).
function getLinkSecret() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('LINK_SECRET');
  if (!s) {
    s = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('LINK_SECRET', s);
  }
  return s;
}

function makeSig(from) {
  var raw = Utilities.computeHmacSha256Signature(String(from), getLinkSecret());
  return Utilities.base64EncodeWebSafe(raw).replace(/[=]+$/, '').slice(0, 16);
}

function linkEndDate(from) {
  var y = parseInt(from.slice(0, 4), 10), mo = parseInt(from.slice(4, 6), 10), d = parseInt(from.slice(6, 8), 10);
  return new Date(new Date(y, mo - 1, d, 0, 0, 0, 0).getTime() + LINK_TTL_DAYS * 86400000);
}

// 서명·기간 검증 — 서버 최종 방어선. 클라가 from/sig를 조작해도 여기서 막힌다.
function verifyLink(from, sig) {
  from = String(from || '');
  if (!/^\d{8}$/.test(from))          return { ok: false, reason: '유효하지 않은 링크예요' };
  if (sig !== makeSig(from))          return { ok: false, reason: '유효하지 않은 링크예요' };
  if (new Date() > linkEndDate(from)) return { ok: false, reason: '신청 기간이 마감되었어요' };
  return { ok: true };
}

// 설정 시트에서 이 폼이 쓰는 값만 읽는다: 5행 키워드 선점 일수, 6행 알림 수신 메일.
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

// ── 서명 링크 발급 (운영자 토큰 필요) ────────────────────────────────
function checkInboxToken_(token) {
  var t = PropertiesService.getScriptProperties().getProperty('INBOX_TOKEN');
  return !!t && token === t;
}

function genLink(token, from) {
  if (!checkInboxToken_(token)) return { ok: false, reason: 'unauthorized' };
  from = String(from || '');
  if (!/^\d{8}$/.test(from)) return { ok: false, reason: 'invalid_date' };
  var link = encodeURI(FORM_BASE_URL) + '?from=' + from + '&sig=' + makeSig(from);
  var end  = Utilities.formatDate(linkEndDate(from), 'Asia/Seoul', 'yyyy.MM.dd');
  return { ok: true, link: link, end: end };
}

function doGet(e) {
  if (e && e.parameter && e.parameter.gen !== undefined) return renderLinkGenerator();
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 운영자용 발급 페이지 — 웹앱 URL 뒤에 ?gen 을 붙여 접속
function renderLinkGenerator() {
  var SELF = ScriptApp.getService().getUrl();
  var h =
  '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"><title>신청 링크 발급</title><style>' +
  '*{box-sizing:border-box;margin:0;padding:0}' +
  'body{font-family:-apple-system,"Segoe UI",sans-serif;background:#F2F4F6;color:#191F28;padding:34px 18px;line-height:1.5}' +
  '.wrap{max-width:520px;margin:0 auto}h1{font-size:20px;font-weight:800;margin-bottom:6px}' +
  '.desc{font-size:14px;color:#8B95A1;margin-bottom:22px;word-break:keep-all}' +
  'label{display:block;font-size:13px;font-weight:700;color:#4A5568;margin:0 0 7px}' +
  'input{width:100%;padding:13px 14px;border:1.5px solid #E5E8EB;border-radius:10px;font-size:15px;font-family:inherit;margin-bottom:14px}' +
  'button{width:100%;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;padding:14px;background:#3182F6;color:#fff}' +
  '.card{background:#fff;border:1px solid #E5E8EB;border-radius:14px;padding:20px;margin-top:20px}' +
  '.link{font-size:13px;word-break:break-all;background:#F8FAFF;border:1px solid #D0E2FF;border-radius:9px;padding:12px 14px;color:#1B6CF2;margin-bottom:12px}' +
  '.copy{background:#00A0B0}.meta{font-size:13px;color:#8B95A1;margin-top:12px;text-align:center}' +
  '.err{color:#D92B2B;font-size:14px;font-weight:600;margin-top:16px}' +
  '</style></head><body><div class="wrap">' +
  '<h1>부가상품 신청 링크 발급</h1>' +
  '<div class="desc">운영자 토큰과 날짜를 입력하면 위조 방지 서명이 붙은 신청 링크가 생성돼요. 결제한 원장님께만 전달하세요.</div>' +
  '<label>운영자 토큰</label><input type="password" id="tk" placeholder="발급 토큰" autocomplete="off">' +
  '<label>시작 날짜 (이 날부터 ' + LINK_TTL_DAYS + '일간 유효)</label><input type="date" id="dt">' +
  '<button id="gb">링크 생성</button><div id="out"></div></div><script>' +
  'var SELF=' + JSON.stringify(SELF) + ';' +
  '(function(){var d=new Date();document.getElementById("dt").value=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");' +
  'var s=sessionStorage.getItem("gentk");if(s)document.getElementById("tk").value=s;})();' +
  'document.getElementById("gb").addEventListener("click",function(){' +
  'var tk=document.getElementById("tk").value.trim();var v=document.getElementById("dt").value;var b=this;var o=document.getElementById("out");' +
  'if(!tk||!v){o.innerHTML="<div class=\\"err\\">토큰과 날짜를 입력하세요</div>";return;}' +
  'sessionStorage.setItem("gentk",tk);b.disabled=true;b.textContent="생성 중...";' +
  'fetch(SELF,{method:"POST",body:JSON.stringify({action:"genLink",token:tk,from:v.replace(/-/g,"")})}).then(function(r){return r.json();}).then(function(d){' +
  'b.disabled=false;b.textContent="링크 생성";' +
  'if(!d.ok){o.innerHTML="<div class=\\"err\\">"+(d.reason==="unauthorized"?"토큰이 올바르지 않습니다.":"날짜가 올바르지 않습니다.")+"</div>";return;}' +
  'o.innerHTML="<div class=\\"card\\"><div class=\\"link\\" id=\\"lnk\\"></div><button class=\\"copy\\" id=\\"cpb\\">링크 복사</button><div class=\\"meta\\"></div></div>";' +
  'document.getElementById("lnk").textContent=d.link;o.querySelector(".meta").textContent="마감 "+d.end+" (발급일 +' + LINK_TTL_DAYS + '일)";' +
  'document.getElementById("cpb").addEventListener("click",function(){navigator.clipboard.writeText(d.link);this.textContent="복사됐어요";});' +
  '}).catch(function(){b.disabled=false;b.textContent="링크 생성";o.innerHTML="<div class=\\"err\\">오류가 발생했어요</div>";});});' +
  '</script></body></html>';
  return HtmlService.createHtmlOutput(h).setTitle('신청 링크 발급')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  var result;
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    if (action === 'checkAccess') {
      var link = verifyLink(payload.from, payload.sig);
      result = { ok: link.ok, reason: link.reason || '' };
    } else if (action === 'checkKeyword') {
      result = checkKeyword(payload.keyword);
    } else if (action === 'fetchPlaceInfo') {
      result = fetchPlaceInfo(payload.url);
    } else if (action === 'submitForm') {
      result = submitForm(payload);
    } else if (action === 'genLink') {
      result = genLink(payload.token, payload.from);
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
  // 서버 최종 방어선 — 서명·기간 검증
  var link = verifyLink(formData.from, formData.sig);
  if (!link.ok) return { success: false, reason: link.reason };

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
