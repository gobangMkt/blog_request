// 북마크 "NF 결제 가져오기"의 본문(잔디 탭에서 실행). 읽기만 하고 판정·등록은 하지 않는다.
// scripts/build-bookmarklet.js 가 jandi-reader.js 와 이 파일을 이어 붙여 js/jandi-bookmarklet.txt(javascript: 한 줄)를 만든다.
// 접근 코드·시트 정보는 보지도 받지도 않는다. 보내는 곳은 paste.html 배포 주소의 출처 하나뿐이다.
// 바뀌면 2대(토미, 스티브)에서 북마크를 다시 끌어다 놓아야 하므로 READER_VERSION 을 올린다.
var READER_VERSION = '1';
var ROOM_ID = '35912598';
var ROOM_NAME = 'U사장님-콘텐츠상품';
var PASTE_URL = 'https://gobangmkt.github.io/blog_request/addon-direct-pay/paste.html';
var PASTE_ORIGIN = 'https://gobangmkt.github.io';
var PANEL_ID = 'nf-jandi-panel';

function nfBox() {
  var old = document.getElementById(PANEL_ID);
  if (old) { old.remove(); }
  var box = document.createElement('div');
  box.id = PANEL_ID;
  box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:300px;padding:14px 16px;' +
    'background:#fff;color:#191F28;border:1px solid #E5E8EB;border-radius:14px;box-shadow:0 8px 24px rgba(25,31,40,.18);' +
    'font:14px/1.6 Pretendard,-apple-system,sans-serif;word-break:keep-all;';
  var title = document.createElement('div');
  title.textContent = 'NF 결제 가져오기';
  title.style.cssText = 'font-weight:800;font-size:15px;margin-bottom:4px;';
  var msg = document.createElement('div');
  msg.style.cssText = 'color:#4E5968;';
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-top:10px;';
  box.appendChild(title);
  box.appendChild(msg);
  box.appendChild(row);
  document.body.appendChild(box);
  return { box: box, msg: msg, row: row };
}

function nfButton(row, label, primary, onClick) {
  var b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = 'flex:1;height:40px;border-radius:10px;font:700 14px Pretendard,-apple-system,sans-serif;cursor:pointer;' +
    (primary ? 'border:0;background:#3182F6;color:#fff;' : 'border:1.5px solid #E5E8EB;background:#fff;color:#4E5968;');
  b.addEventListener('click', onClick);
  if (primary) { row.insertBefore(b, row.firstChild); } else { row.appendChild(b); }
  return b;
}

// 방 확인: 주소의 방 번호 또는 화면에 보이는 방 제목이 맞아야 한다
function nfRoomOk() {
  if (location.hash.indexOf('/room/' + ROOM_ID) >= 0) { return true; }
  var head = document.querySelector('header, [class*="header"], [class*="title"]');
  return (document.title || '').indexOf(ROOM_NAME) >= 0 || !!(head && (head.innerText || '').indexOf(ROOM_NAME) >= 0);
}

// 읽기 결과를 paste.html 창으로 보낸다. 사용자가 누른 클릭 안에서 창을 열어 팝업 차단을 피한다.
function nfSend(ui, result) {
  var win = window.open(PASTE_URL, 'nf_paste');
  if (!win) { ui.msg.textContent = '창이 막혔어요. 주소창 오른쪽의 팝업 허용을 켠 뒤 다시 눌러 주세요.'; return; }
  ui.msg.textContent = '결과 화면을 여는 중이에요.';
  var done = false;
  function onMessage(ev) {
    if (ev.origin !== PASTE_ORIGIN || ev.source !== win || !ev.data || ev.data.type !== 'nf-ready') { return; }
    done = true;
    window.removeEventListener('message', onMessage);
    win.postMessage({ type: 'nf-jandi', readerVersion: READER_VERSION, result: result }, PASTE_ORIGIN);
    ui.msg.textContent = '보냈어요. 열린 창에서 확인해 주세요.';
  }
  window.addEventListener('message', onMessage);
  setTimeout(function () {
    if (done) { return; }
    window.removeEventListener('message', onMessage);
    ui.msg.textContent = '결과 화면과 연결되지 않았어요. 다시 눌러 주세요.';
  }, 30000);
}

(async function nfMain() {
  var ui = nfBox();
  nfButton(ui.row, '닫기', false, function () { ui.box.remove(); });
  if (location.hostname !== 'neoflat.jandi.com' || !nfRoomOk()) {
    ui.msg.textContent = '방을 열고 눌러 주세요. (' + ROOM_NAME + ')';
    return;
  }
  if (!document.querySelector('.msg-layout-flex')) {
    ui.msg.textContent = '잔디 화면 구조가 바뀐 것 같아요. 개발팀에 알려 주세요.';
    return;
  }
  var started = Date.now();
  var timer = setInterval(function () {
    ui.msg.textContent = '방을 끝까지 읽는 중이에요 (' + Math.round((Date.now() - started) / 1000) + '초). 이 탭을 그대로 두세요.';
  }, 1000);
  var result;
  try {
    result = await globalThis.JandiReader.run({ maxSteps: 260, maxMs: 180000 });
  } catch (e) {
    clearInterval(timer);
    ui.msg.textContent = '읽는 중 오류가 났어요. 다시 눌러 주세요.';
    return;
  }
  clearInterval(timer);
  if (!result || !result.ok) {
    ui.msg.textContent = '잔디 화면 구조가 바뀐 것 같아요. 개발팀에 알려 주세요.';
    return;
  }
  var complete = result.reachedTop && !result.aborted && !result.bottomStale;
  ui.msg.textContent = '글 ' + result.total + '개를 읽고 결제 후보 ' + result.candidates.length + '개를 골랐어요.' +
    (complete ? '' : ' 끝까지 읽지 못했어요.');
  nfButton(ui.row, '결과 화면으로 보내기', true, function () { nfSend(ui, result); });
})();
