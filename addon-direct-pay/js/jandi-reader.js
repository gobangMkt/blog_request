// 잔디 방 읽기(슬라이스 1 시험용). 잔디 탭 안에서 돌고, 읽기만 한다(보내기·등록·로그인 토큰 접근 없음).
// 결과 = { ok, readerVersion, imageOnly, total, withId, byType, quoteCopiesDropped, candidates[{id,type,text}], newestId, oldestId,
//          steps, gaps, reachedTop, lateAdds, aborted, elapsedMs }
// 잔디 목록은 맨 아래·맨 위에서 글을 비동기로 더 불러온다. 불러오는 중에 끝났다고 판단하면
// 최신 글이나 오래된 글이 조용히 빠지므로, 높이와 글 개수가 멈출 때까지 기다린 뒤에만 끝을 인정한다.
(function (root) {
  'use strict';

  var READER_VERSION = '1'; // 북마크릿(jandi-bookmarklet-src.js)의 READER_VERSION과 같아야 한다(build-bookmarklet.js가 확인)
  var NUM = /^\d+$/;
  var LOOSE = /결제|상품|\[Web발신\]|블로그|빌리투어/;
  var PAY_KEY = /\((\d+)\)[\s\S]*?결제일시:\s*([\d.]+\s+[\d:]+)/;

  function payKey(text) {
    var m = PAY_KEY.exec(text);
    return m ? m[1] + '|' + m[2] : '';
  }

  // 답글·인용 복사본(content-type이 text가 아닌 글)은 같은 결제를 원본 옆에 한 번 더 싣는다. 원본이 있으면 버린다.
  function dropQuoteCopies(list) {
    var textKeys = {};
    list.forEach(function (m) {
      var k = m.type === 'text' ? payKey(m.text) : '';
      if (k) { textKeys[k] = true; }
    });
    var dropped = 0;
    var kept = list.filter(function (m) {
      if (m.type === 'text') { return true; }
      var k = payKey(m.text);
      if (k && textKeys[k]) { dropped++; return false; }
      return true;
    });
    return { kept: kept, dropped: dropped };
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) | 0; }
    return String(h);
  }

  function messageOf(el) {
    var node = el, id = null, type = '';
    while (node && node !== document.body) {
      if (!type && node.getAttribute && node.getAttribute('content-type')) {
        type = node.getAttribute('content-type');
      }
      if (node.id && NUM.test(node.id)) { id = node.id; break; }
      node = node.parentElement;
    }
    var text = (el.innerText || '').replace(/[ \t]+\n/g, '\n').trim();
    return { id: id, type: type, text: text, key: id || 'h:' + hash(text.slice(0, 80)) };
  }

  function count() { return document.querySelectorAll('.msg-layout-flex').length; }

  function screenKeys() {
    return Array.prototype.map.call(document.querySelectorAll('.msg-layout-flex'), function (el) {
      return messageOf(el).key;
    });
  }

  function harvest(map) {
    var added = 0;
    document.querySelectorAll('.msg-layout-flex').forEach(function (el) {
      var m = messageOf(el);
      if (map.has(m.key)) { return; }
      map.set(m.key, { id: m.id, type: m.type, text: m.text });
      added++;
    });
    return added;
  }

  // 높이와 글 개수가 연속 두 번 같을 때까지 기다린다(최대 maxPolls번).
  async function settle(sc, maxPolls) {
    var lastH = -1, lastN = -1, same = 0;
    for (var i = 0; i < maxPolls; i++) {
      await sleep(600);
      var h = sc.scrollHeight, n = count();
      if (h === lastH && n === lastN) { same++; } else { same = 0; }
      if (same >= 2) { return true; }
      lastH = h; lastN = n;
    }
    return false;
  }

  // 위로 올렸다 오면 잔디가 최신 글을 메모리에서 내려 둔다. 이때 오른쪽 아래에 "맨 아래로" 버튼이 떠 있고,
  // 누르면 최신 글을 다시 불러온다. 버튼이 없어질 때까지 눌러야 진짜 맨 아래다.
  function jumpBtn() {
    var b = document.querySelector('.scroll-to-bottom-container');
    return b && (b.offsetWidth || b.offsetHeight) ? b : null;
  }

  async function toBottom(sc, map) {
    for (var i = 0; i < 5; i++) {
      sc.scrollTop = sc.scrollHeight;
      await settle(sc, 10);
      var b = jumpBtn();
      if (!b) { break; }
      b.click();
      await sleep(900);
    }
    sc.scrollTop = sc.scrollHeight;
    await sleep(500);
    return harvest(map);
  }

  async function run(opts) {
    opts = opts || {};
    var maxSteps = opts.maxSteps || 80;
    var maxMs = opts.maxMs || 90000;
    var sc = document.getElementById('msgs_container');
    if (!sc || !document.querySelector('.msg-layout-flex')) { return { ok: false, reason: 'structure' }; }

    var map = new Map();
    var started = Date.now();
    var steps = 0, flat = 0, gaps = 0, reachedTop = false, aborted = '', lateAdds = 0;

    await toBottom(sc, map);

    while (true) {
      if (steps >= maxSteps) { aborted = 'steps'; break; }
      if (Date.now() - started > maxMs) { aborted = 'time'; break; }
      var before = map.size;
      sc.scrollTop = Math.max(0, sc.scrollTop - sc.clientHeight * 0.6);
      await sleep(500);
      if (sc.scrollTop === 0) {
        var h0 = sc.scrollHeight;
        for (var w = 0; w < 6 && sc.scrollHeight === h0; w++) { await sleep(500); }
      }
      var overlap = screenKeys().some(function (k) { return map.has(k); });
      if (!overlap) {
        gaps++;
        sc.scrollTop = sc.scrollTop + sc.clientHeight * 0.3;
        await sleep(500);
      }
      harvest(map);
      steps++;
      if (sc.scrollTop === 0 && map.size === before) { flat++; } else { flat = 0; }
      if (flat >= 2) { reachedTop = true; break; }
    }

    for (var pass = 0; pass < 3; pass++) {
      var late = await toBottom(sc, map);
      lateAdds += late;
      if (late === 0) { break; }
    }

    var all = Array.from(map.values());
    var byType = {};
    var withId = 0;
    var ids = [];
    all.forEach(function (m) {
      byType[m.type || '?'] = (byType[m.type || '?'] || 0) + 1;
      if (m.id) { withId++; ids.push(Number(m.id)); }
    });
    var imageOnly = all.filter(function (m) { return !m.text; }).length; // 글자 없이 이미지·파일만 있는 글(읽지 않고 세기만)
    var picked = dropQuoteCopies(all.filter(function (m) { return LOOSE.test(m.text); }));
    return {
      ok: true,
      readerVersion: READER_VERSION,
      imageOnly: imageOnly,
      total: all.length,
      withId: withId,
      byType: byType,
      quoteCopiesDropped: picked.dropped,
      candidates: picked.kept,
      newestId: ids.length ? Math.max.apply(null, ids) : null,
      oldestId: ids.length ? Math.min.apply(null, ids) : null,
      steps: steps,
      gaps: gaps,
      reachedTop: reachedTop,
      lateAdds: lateAdds,
      bottomStale: !!jumpBtn(),
      aborted: aborted,
      elapsedMs: Date.now() - started
    };
  }

  var api = { run: run };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  root.JandiReader = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
