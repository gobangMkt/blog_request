// 북마크릿(잔디 탭) -> paste.html 수신부(순수 함수). 출처 검증, 메시지 모양 검증, 북마크 버전 비교.
// 잔디에서 온 글은 믿지 않는 입력이다: 출처가 다르면 버리고, 글자는 문자열만 받아 길이를 자른다.
// 시험: node tests/jandi-bridge.test.js
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JandiBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var JANDI_ORIGIN = 'https://neoflat.jandi.com';
  var EXPECTED_VERSION = '2'; // jandi-reader.js · jandi-bookmarklet-src.js 의 READER_VERSION 과 같아야 한다
  var MAX_MESSAGES = 500;     // GAS JANDI_MAX_MESSAGES 와 같다
  var MAX_TEXT = 4000;

  var NOTICE = {
    old: '북마크가 오래됐어요. 설치 방법에서 북마크를 다시 끌어다 놓아 주세요.',
    newer: '이 화면이 북마크보다 오래됐어요. 화면을 새로고침해 주세요.',
    structure: '잔디 화면 구조가 바뀐 것 같아요. 개발팀에 알려 주세요.',
    shape: '잔디에서 받은 내용을 읽지 못했어요. 북마크를 다시 눌러 주세요.',
    too_many: '결제 후보 글이 너무 많아요(' + MAX_MESSAGES + '건 초과). 개발팀에 알려 주세요.'
  };

  function isJandiOrigin(origin) { return origin === JANDI_ORIGIN; }

  // 버전 글자 비교: 작으면 -1(북마크가 오래됨), 같으면 0, 크면 1. 숫자가 아니면 오래된 것으로 본다
  function compareVersion(v, expected) {
    var a = /^\d+$/.test(String(v == null ? '' : v)) ? Number(v) : -1;
    var b = Number(expected);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  // 읽기 결과 -> 서버로 보낼 scan 객체. 끝까지(방 처음 또는 지난 수집 이후 겹침 구간까지) 읽은 것만 complete(그래야 수집 시각이 갱신된다)
  function scanOf(result) {
    var r = result || {};
    var complete = r.ok === true && !r.aborted && (r.reachedTop === true || r.stoppedAtRange === true) && !r.bottomStale;
    return {
      complete: complete, reachedTop: r.reachedTop === true, aborted: String(r.aborted || ''),
      total: Number(r.total) || 0, newestId: r.newestId == null ? '' : String(r.newestId),
      oldestId: r.oldestId == null ? '' : String(r.oldestId), oldestAt: r.oldestAt ? String(r.oldestAt) : ''
    };
  }

  function messagesOf(result) {
    var out = [];
    (result && result.candidates || []).forEach(function (c) {
      var t = c && typeof c === 'object' ? c.text : c;
      if (typeof t === 'string' && t.trim()) out.push(t.slice(0, MAX_TEXT));
    });
    return out;
  }

  // postMessage 한 건을 받아 판정한다.
  // { ok:true, messages, scan, imageOnly, total } | { ok:false, ignore:true } (우리 메시지가 아님, 조용히 버림)
  // | { ok:false, code, text } (사람에게 알릴 사유)
  function receive(origin, data, expected) {
    if (!isJandiOrigin(origin)) return { ok: false, ignore: true, code: 'origin' };
    if (!data || typeof data !== 'object' || data.type !== 'nf-jandi') return { ok: false, ignore: true, code: 'type' };
    var cmp = compareVersion(data.readerVersion, expected == null ? EXPECTED_VERSION : expected);
    if (cmp < 0) return { ok: false, code: 'old', text: NOTICE.old };
    if (cmp > 0) return { ok: false, code: 'newer', text: NOTICE.newer };
    var res = data.result;
    if (!res || typeof res !== 'object') return { ok: false, code: 'shape', text: NOTICE.shape };
    if (res.ok !== true) {
      return res.reason === 'structure' ? { ok: false, code: 'structure', text: NOTICE.structure }
        : { ok: false, code: 'shape', text: NOTICE.shape };
    }
    if (!Array.isArray(res.candidates) || typeof res.total !== 'number') return { ok: false, code: 'shape', text: NOTICE.shape };
    var messages = messagesOf(res);
    if (messages.length > MAX_MESSAGES) return { ok: false, code: 'too_many', text: NOTICE.too_many };
    return { ok: true, messages: messages, scan: scanOf(res), imageOnly: Number(res.imageOnly) || 0, total: res.total };
  }

  // 북마크릿이 연 창이면 준비됐다고 알린다(북마크릿은 이 신호를 받은 뒤에만 글을 보낸다)
  function announceReady(opener) {
    if (!opener || typeof opener.postMessage !== 'function') return false;
    try { opener.postMessage({ type: 'nf-ready' }, JANDI_ORIGIN); return true; } catch (e) { return false; }
  }

  // 등록까지 끝났으면 북마크가 다음 읽기 범위를 정하도록 이 읽기의 최신 글 번호를 알린다(끝까지 읽은 경우만)
  function announceCommit(opener, scan) {
    if (!opener || typeof opener.postMessage !== 'function' || !scan || scan.complete !== true) return false;
    if (!/^\d+$/.test(String(scan.newestId || ''))) return false;
    try { opener.postMessage({ type: 'nf-commit', newestId: String(scan.newestId) }, JANDI_ORIGIN); return true; } catch (e) { return false; }
  }

  return { JANDI_ORIGIN: JANDI_ORIGIN, EXPECTED_VERSION: EXPECTED_VERSION, MAX_MESSAGES: MAX_MESSAGES,
    isJandiOrigin: isJandiOrigin, compareVersion: compareVersion, scanOf: scanOf, messagesOf: messagesOf,
    receive: receive, announceReady: announceReady, announceCommit: announceCommit };
});
