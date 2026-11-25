// 잔디 가져오기 화면 연결(paste.html 전용). 판정은 jandi-recon.js·jandi-bridge.js(순수 함수)가 하고, 여기서는 그리기와 이벤트만 한다.
// 잔디에서 온 글은 믿지 않는 입력이라 모든 글자는 textContent로만 그린다(innerHTML에는 우리가 쓴 고정 SVG만).
// paste.html 인라인 코드가 init({ post, confirmBox, askCard, loadStatus, showGate, hideOut, KIND_SVG })를 한 번 부른다.
(function (root) {
  'use strict';

  var JANDI_ROOM_URL = 'https://neoflat.jandi.com/app/#!/room/35912598';
  var BOOKMARK_TXT = 'js/jandi-bookmarklet.txt';
  var BILLY_SHOW_MAX = 50;
  var TIP_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M8 7.2v3.8M8 5v.1" stroke-linecap="round"/></svg>';
  // 빌리투어 유형 아이콘: 카메라 + 재생 삼각형(문서·왕관·클립보드와 다른 실루엣), fill 전용, 회청 한 계열
  var BILLY_SVG = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="1.5" y="5" width="12" height="10" rx="3" fill="#7C8CA1"/><path d="M14.5 8.6 18.5 6.2V13.8L14.5 11.4Z" fill="#7C8CA1"/><path d="M6 8.2 9.6 10 6 11.8Z" fill="#FFFFFF"/></svg>';

  var api = null;
  var S = { ready: false, pending: null, data: null, preview: null, view: null, closedKeys: {}, busy: false, billy: null, tab: '', foldOpen: false };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function act(e, name) { e.setAttribute('data-act', name); return e; }
  function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }
  function icon(kind) { return kind === '빌리투어' ? BILLY_SVG : (api && api.KIND_SVG && api.KIND_SVG[kind]) || ''; }

  function tip(lines) {
    var t = el('span', 'tip'), box = el('span', 'tip-box'), ul = el('ul');
    t.tabIndex = 0; t.setAttribute('aria-label', '도움말');
    t.innerHTML = TIP_SVG;
    box.setAttribute('role', 'tooltip');
    lines.forEach(function (l) { ul.appendChild(el('li', '', l)); });
    box.appendChild(ul); t.appendChild(box);
    return t;
  }

  function kindCell(kind) {
    var c = el('span', 'c-kind'); c.title = kind;
    c.innerHTML = icon(kind);
    c.appendChild(el('span', 'kt', kind));
    return c;
  }

  // ── 머리: 마지막 수집 ──
  function drawLastScan(lastScan) {
    var p = $('lastScan'); if (!p) return;
    var info = root.JandiRecon.lastScanInfo(lastScan, Date.now());
    p.textContent = info.text;
    if (info.chip) { p.appendChild(document.createTextNode(' ')); p.appendChild(el('span', 'chip sendwait', info.chip)); }
  }

  // ── 빌리투어 탭: 읽기 전용 표 ──
  function drawBilly(billy) {
    var pane = $('billyPane'); if (!pane) return;
    S.billy = billy || [];
    var v = root.JandiRecon.billyView(S.billy);
    pane.innerHTML = '';
    pane.appendChild(el('p', 'res-title', v.title));
    pane.appendChild(el('p', 'res-sum', v.sum));
    if (!v.rows.length) { pane.appendChild(el('p', 'empty', '아직 쌓인 빌리투어 결제가 없어요.')); return; }
    var th = el('div', 'tr th');
    ['유형', '결제', '지점', '금액', '상태', ''].forEach(function (t, i) { th.appendChild(el('span', i === 3 ? 'r' : '', t)); });
    pane.appendChild(th);
    v.rows.slice(0, BILLY_SHOW_MAX).forEach(function (r) {
      var row = el('div', 'tr');
      var who = el('span', 'c-who', r.who); who.title = r.who;
      var kind = kindCell('빌리투어'); kind.title = r.product;
      var st = el('span', 'c-st'); st.appendChild(el('span', 'chip notified', r.status));
      row.appendChild(kind); row.appendChild(el('span', 'c-date', r.when)); row.appendChild(who);
      row.appendChild(el('span', 'c-price', r.amount > 0 ? won(r.amount) : '-')); row.appendChild(st); row.appendChild(el('span', 'c-ck'));
      pane.appendChild(row);
    });
    if (v.rows.length > BILLY_SHOW_MAX) pane.appendChild(el('p', 'empty', '오래된 ' + (v.rows.length - BILLY_SHOW_MAX) + '건은 시트에서 확인해 주세요.'));
  }

  // ── 전면 팝업(결과·설치 안내): 뒤 화면 스크롤을 잠그고, 둘 다 닫히면 푼다 ──
  function popOpen(id) { var p = $(id); return !!(p && !p.hidden); }
  function lockScroll() {
    if (document.body) document.body.style.overflow = (popOpen('reconPop') || popOpen('setupPop')) ? 'hidden' : '';
  }
  function setPop(id, open) { var p = $(id); if (p) p.hidden = !open; lockScroll(); }

  // ── 대조 카드(전면 팝업 본문) ──
  function card() { var c = $('recon'); c.innerHTML = ''; c.hidden = false; setPop('reconPop', true); return c; }
  function hideCard() { var c = $('recon'); if (c) { c.hidden = true; c.innerHTML = ''; } setPop('reconPop', false); }

  function warnList(items) {
    var ul = el('ul', 'res');
    items.forEach(function (w) {
      var li = el('li', 'bad'), b = el('b', '', w.title);
      li.appendChild(b); li.appendChild(document.createTextNode(w.text)); ul.appendChild(li);
    });
    return ul;
  }

  function okButton() {
    var b = act(el('button', 'res-ok', '확인'), 'recon-ok'); b.type = 'button';
    b.addEventListener('click', hideCard);
    return b;
  }

  function showNotice(title, text) {
    var c = card();
    c.appendChild(el('p', 'res-title', title));
    c.appendChild(warnList([{ title: text, text: '' }]));
    c.appendChild(okButton());
  }

  function showLoading() {
    var c = card();
    c.appendChild(el('p', 'res-title', '시트와 맞춰 보는 중이에요'));
    c.appendChild(el('p', 'res-sum', '잠시만 기다려 주세요'));
  }

  function importCall(confirm) {
    return api.post({ action: 'importJandi', messages: S.data.messages, confirm: confirm, scan: S.data.scan });
  }

  // 잔디 읽기 결과 한 건을 받아 시트와 대조한다
  function run(rec) {
    S.data = rec; S.closedKeys = {}; S.busy = false; S.preview = null; S.tab = ''; S.foldOpen = false;
    api.hideOut();
    if (!rec.messages.length) {
      S.preview = { success: true, results: [], counts: { sumOk: true, pieces: 0, messages: 0 }, regression: { missing: [] } };
      draw(); return;
    }
    showLoading();
    api.post({ action: 'previewJandi', messages: rec.messages, scan: rec.scan })
      .then(function (d) {
        if (d.reason === 'unauthorized') { S.pending = rec; hideCard(); api.showGate('접근 코드가 바뀌었어요. 다시 입력해 주세요.'); return; }
        if (!d.success) { showNotice('시트와 맞춰 보지 못했어요', d.reason === 'too_many' ? '결제 후보 글이 너무 많아요. 개발팀에 알려 주세요.' : '잠시 뒤 잔디에서 다시 눌러 주세요.'); return; }
        S.preview = d; draw();
      })
      .catch(function () { showNotice('시트와 맞춰 보지 못했어요', '연결에 실패했어요. 잠시 뒤 다시 눌러 주세요.'); });
  }

  function groupRow(g) {
    var r = el('div', 'tr' + (g.count ? '' : ' fin'));
    r.setAttribute('data-row', 'grp');
    r.appendChild(el('span', 'c-who', g.label));
    r.appendChild(el('span', 'c-price', g.count + '건'));
    var st = el('span', 'c-st');
    if (g.count && !g.rows.length) st.appendChild(el('span', 'chip ' + g.tone, g.chip));
    r.appendChild(st);
    return r;
  }

  function noteOf(row, gid) {
    var parts = [];
    if (gid === 'notTarget' && row.product) parts.push(row.product);
    else if ((gid === 'needPhone' || gid === 'review') && row.reason) parts.push(row.reason);
    row.warnings.forEach(function (w) { parts.push(w); });
    return parts.join(' · ');
  }

  var seq = 0;

  // 줄 끝 칸의 펼침 버튼 + 그 아래 펼침 영역. fill(hold)이 펼칠 때 한 번 내용을 채운다
  function holdToggle(label, fill) {
    var hold = el('div', 'hold'); hold.hidden = true; hold.id = 'hold' + (++seq);
    var tgl = act(el('button', 'tgl', label), 'recon-open');
    tgl.type = 'button'; tgl.setAttribute('aria-expanded', 'false'); tgl.setAttribute('aria-controls', hold.id);
    tgl.addEventListener('click', function () {
      var open = hold.hidden;
      if (open && !hold.firstChild) fill(hold);
      hold.hidden = !open; tgl.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    return { tgl: tgl, hold: hold };
  }

  function oneRow(g, row, list) {
    var tr = el('div', 'tr');
    var who = el('span', 'c-who', row.who); who.title = row.who;
    var st = el('span', 'c-st'); st.appendChild(el('span', 'chip ' + g.tone, g.chip));
    tr.appendChild(el('span', 'c-date', row.when)); tr.appendChild(who);
    tr.appendChild(row.kind ? kindCell(row.kind) : el('span', 'c-kind', '-'));
    tr.appendChild(el('span', 'c-price', row.amount ? won(row.amount) : '-')); tr.appendChild(st);
    var cell = el('span', 'c-ck');
    var note = noteOf(row, g.id);
    var h = g.open ? holdToggle(g.open === 'phone' ? '번호 넣기' : '원문 보기', function (hold) { fillHold(hold, g.open, row); }) : null;
    if (h) cell.appendChild(h.tgl);
    tr.appendChild(cell);
    if (note) tr.appendChild(el('p', '', note));
    list.appendChild(tr);
    if (h) list.appendChild(h.hold);
  }

  // 같은 지점·같은 사유가 반복되면 한 줄로 묶고, 원문은 펼쳐서 건마다 본다
  function clusterRow(g, cl, list) {
    var first = cl.rows[0], n = cl.rows.length;
    var tr = el('div', 'tr');
    var who = el('span', 'c-who', first.who); who.title = first.who;
    var st = el('span', 'c-st'); st.appendChild(el('span', 'chip ' + g.tone, g.chip));
    tr.appendChild(el('span', 'c-date', first.when)); tr.appendChild(who);
    tr.appendChild(first.kind ? kindCell(first.kind) : el('span', 'c-kind', '-'));
    tr.appendChild(el('span', 'c-price', n + '건')); tr.appendChild(st);
    var cell = el('span', 'c-ck');
    var h = holdToggle('원문 ' + n + '건', function (hold) {
      cl.rows.forEach(function (row) { var item = el('div', 'hold-item'); fillHold(item, 'raw', row); hold.appendChild(item); });
    });
    cell.appendChild(h.tgl); tr.appendChild(cell);
    var note = noteOf(first, g.id);
    tr.appendChild(el('p', '', (note ? note + ' · ' : '') + '같은 글 ' + n + '건'));
    list.appendChild(tr); list.appendChild(h.hold);
  }

  function itemRows(g, list) {
    if (g.clusters && g.clusters.length) {
      g.clusters.forEach(function (cl) { if (cl.rows.length > 1) clusterRow(g, cl, list); else oneRow(g, cl.rows[0], list); });
      return;
    }
    g.rows.forEach(function (row) { oneRow(g, row, list); });
  }

  function holdBtn(label, name, onClick) {
    var b = act(el('button', 'tgl', label), name); b.type = 'button'; b.addEventListener('click', function () { onClick(b); });
    return b;
  }

  function holdMsg(hold, text) {
    var p = hold.querySelector('.err');
    if (!p) { p = el('p', 'err'); hold.appendChild(p); }
    p.textContent = text;
  }

  function fillHold(hold, kind, row) {
    var actions = el('div');
    if (kind === 'phone') {
      var ul = el('ul', 'res'), li = api.askCard({ branch: row.branch, branchNo: row.branchNo, paidAt: row.paidAt });
      ul.appendChild(li); hold.appendChild(ul);
      if (root.MutationObserver) { // 알림톡을 보내면 현황 표를 다시 불러온다
        var obs = new MutationObserver(function () { if (li.className === 'done') { obs.disconnect(); api.loadStatus(); } });
        obs.observe(li, { attributes: true, attributeFilter: ['class'] });
      }
      actions.appendChild(holdBtn('해당 없음으로 닫기', 'recon-close', function () { closeOne(hold, row); }));
    } else {
      hold.appendChild(el('p', '', row.raw || '(원문이 비어 있어요)'));
      if (row.regAction) actions.appendChild(holdBtn('이 내용으로 등록', 'recon-reg-one', function () { registerOne(hold, row); }));
      if (row.key) actions.appendChild(holdBtn('처리함으로 닫기', 'recon-close', function () { closeOne(hold, row); }));
      actions.appendChild(holdBtn('원문 복사', 'recon-copy', function (b) {
        try { root.navigator.clipboard.writeText(row.raw).then(function () { b.textContent = '복사했어요'; }); } catch (e) { b.textContent = '복사하지 못했어요'; }
      }));
    }
    hold.appendChild(actions);
  }

  function afterWrite(d, hold, fallback) { // 공통 실패 처리. 성공이면 true
    if (d.reason === 'unauthorized') { hideCard(); api.showGate('접근 코드가 바뀌었어요. 다시 입력해 주세요.'); return false; }
    if (!d.success) { holdMsg(hold, fallback); return false; }
    return true;
  }

  function closeOne(hold, row) {
    api.confirmBox('이 건을 닫을까요?', [row.who + (row.when ? ' · ' + row.when : ''), '닫으면 다음 가져오기에도 다시 뜨지 않아요.'], '닫기')
      .then(function (ok) {
        if (!ok) return;
        importCall([{ key: row.key, action: 'close' }]).then(function (d) {
          if (!afterWrite(d, hold, '닫지 못했어요. 잠시 뒤 다시 눌러 주세요.')) return;
          var r = (d.results || [])[0];
          if (!r || r.status !== 'closed') { holdMsg(hold, (r && r.reason) || '닫지 못했어요.'); return; }
          S.closedKeys[row.key] = true; draw();
        }).catch(function () { holdMsg(hold, '연결에 실패했어요. 잠시 뒤 다시 눌러 주세요.'); });
      });
  }

  function registerOne(hold, row) {
    api.confirmBox('읽은 값으로 등록할까요?', [row.who + (row.when ? ' · ' + row.when : ''), row.kind + ' 1건이 시트에 들어가요.'], '등록하기')
      .then(function (ok) {
        if (!ok) return;
        importCall([{ key: row.key, action: row.regAction }]).then(function (d) {
          if (!afterWrite(d, hold, '등록하지 못했어요. 잠시 뒤 다시 눌러 주세요.')) return;
          var r = (d.results || [])[0];
          if (!r || (r.status !== 'added' && r.status !== 'duplicate')) { holdMsg(hold, (r && r.reason) || '등록하지 못했어요.'); return; }
          S.closedKeys[row.key] = true; draw(); api.loadStatus(); // 등록되면 서버가 그 확인 필요를 종결한다
        }).catch(function () { holdMsg(hold, '연결에 실패했어요. 잠시 뒤 다시 눌러 주세요.'); });
      });
  }

  function register() {
    var v = S.view, t = root.JandiRecon.confirmText(v), logonly = v.register.mode === 'logonly';
    api.confirmBox(t.title, t.lines, t.yes).then(function (ok) {
      if (!ok) return;
      S.busy = true; draw();
      importCall(v.register.targets).then(function (d) {
        S.busy = false;
        if (d.reason === 'unauthorized') { hideCard(); api.showGate('접근 코드가 바뀌었어요. 다시 입력해 주세요.'); return; }
        if (!d.success) { draw(); var c = $('recon'); c.insertBefore(warnList([{ title: '등록하지 못했어요', text: '잠시 뒤 다시 눌러 주세요.' }]), c.firstChild); return; }
        drawResult(root.JandiRecon.resultView(d, v), logonly, d, v);
        drawLastScan(d.lastScan);
        api.loadStatus();
        if (v.complete && root.JandiBridge.announceCommit) root.JandiBridge.announceCommit(root.opener, S.data.scan); // 다음 읽기 범위의 기준
      }).catch(function () {
        S.busy = false; draw(); var c = $('recon');
        c.insertBefore(warnList([{ title: '연결에 실패했어요', text: '잠시 뒤 다시 눌러 주세요.' }]), c.firstChild);
      });
    });
  }

  function drawResult(rv, logonly, d, v) {
    var c = card();
    c.appendChild(el('p', 'res-title', logonly ? '읽은 기록을 남겼어요' : rv.title));
    c.appendChild(el('p', 'res-sum', logonly ? (v.complete ? '마지막 수집 시각이 갱신됐어요' : '끝까지 읽지 못해 수집 시각은 갱신하지 않았어요') : rv.sum));
    if (rv.items.length) {
      var ul = el('ul', 'res');
      rv.items.forEach(function (it) {
        var li = el('li', it.cls), b = el('b', '', it.who + (it.when ? ' · ' + it.when : ''));
        li.appendChild(b); li.appendChild(document.createTextNode((it.kind ? it.kind + ' · ' : '') + it.reason)); ul.appendChild(li);
      });
      c.appendChild(ul);
    }
    c.appendChild(okButton());
  }

  function groupList(groups) {
    var list = el('div');
    groups.forEach(function (g) { list.appendChild(groupRow(g)); itemRows(g, list); });
    return list;
  }

  // 탭 = 상품(블로그·빌리투어). 선택은 테두리 하나로만 말한다(.ptab 어휘)
  function tabsBar(v) {
    var bar = el('div', 'ptabs pop-tabs'); bar.setAttribute('role', 'tablist');
    v.tabs.forEach(function (t) {
      var b = act(el('button', 'ptab', t.label + ' ' + t.count), 'recon-tab');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', S.tab === t.id ? 'true' : 'false');
      b.addEventListener('click', function () { S.tab = t.id; draw(); });
      bar.appendChild(b);
    });
    return bar;
  }

  // 상품과 무관한 줄(대상 아님·안내·중복·종결)은 탭 밖에 접어 둔다
  function foldBox(v) {
    var box = el('div', 'fold');
    var body = el('div'); body.hidden = !S.foldOpen;
    var tgl = act(el('button', 'tgl', '해당 없음 ' + v.fold.count + '건'), 'recon-fold');
    tgl.type = 'button'; tgl.setAttribute('aria-expanded', S.foldOpen ? 'true' : 'false');
    tgl.addEventListener('click', function () {
      S.foldOpen = body.hidden; body.hidden = !S.foldOpen; tgl.setAttribute('aria-expanded', S.foldOpen ? 'true' : 'false');
    });
    body.appendChild(groupList(v.fold.groups));
    box.appendChild(tgl); box.appendChild(body);
    return box;
  }

  function draw() {
    var v = root.JandiRecon.build(S.preview, S.data.scan, { messages: S.data.messages, imageOnly: S.data.imageOnly, closedKeys: S.closedKeys });
    S.view = v;
    if (!S.tab || !v.tabs.some(function (t) { return t.id === S.tab; })) { // 처음엔 일이 있는 탭을 연다
      var busy = v.tabs.filter(function (t) { return t.groups.some(function (g) { return g.count && g.id !== 'known' && g.id !== 'billyExists'; }); })[0];
      S.tab = (busy || v.tabs[0]).id;
    }
    var c = card();
    if (v.warnings.length) c.appendChild(warnList(v.warnings));
    var head = el('div', 'res-title res-title-row', v.title); head.id = 'reconTitle';
    head.appendChild(tip(['텍스트 결제 알림 기준이에요. 이미지 캡처는 읽지 않아요.', v.check.text]));
    c.appendChild(head);
    c.appendChild(el('p', 'res-sum', v.sum));
    if (v.image) c.appendChild(el('p', 'res-sum', v.image.text + '은 읽지 않았어요'));
    c.appendChild(tabsBar(v));
    var tab = v.tabs.filter(function (t) { return t.id === S.tab; })[0];
    c.appendChild(groupList(tab.groups));
    if (v.fold.count) c.appendChild(foldBox(v));
    var reg = v.register;
    var foot = el('div', 'pop-foot');
    var btn = act(el('button', 'cta', S.busy ? '등록하는 중이에요' : reg.label), 'recon-register');
    btn.type = 'button'; btn.disabled = reg.disabled || S.busy;
    btn.addEventListener('click', register);
    foot.appendChild(btn);
    c.appendChild(foot);
  }

  // ── 설치 방법: 북마크 끌어다 놓기 ──
  var bmLoaded = false;
  function loadBookmark() {
    if (bmLoaded) return;
    bmLoaded = true;
    fetch(BOOKMARK_TXT, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('x'); return r.text(); })
      .then(function (t) { var a = $('bmLink'); a.href = t.trim(); a.removeAttribute('aria-disabled'); })
      .catch(function () { bmLoaded = false; $('bmNote').textContent = '북마크를 불러오지 못했어요. 새로고침 뒤 다시 열어 주세요.'; });
  }

  function onMessage(ev) {
    var r = root.JandiBridge.receive(ev.origin, ev.data);
    if (r.ignore) return;
    var rec = r.ok ? { messages: r.messages, scan: r.scan, imageOnly: r.imageOnly } : { notice: r.text };
    if (S.ready) deliver(rec); else S.pending = rec;
  }
  function deliver(rec) {
    if (rec.notice) { api.hideOut(); showNotice('잔디에서 받은 내용을 쓸 수 없어요', rec.notice); return; }
    run(rec);
  }

  // listStatus 응답마다 부른다: 머리의 마지막 수집, 빌리투어 표, 기다리던 가져오기 결과
  function onStatus(d) {
    S.ready = true;
    drawLastScan(d.lastScan);
    drawBilly(d.billy);
    if (S.pending) { var rec = S.pending; S.pending = null; deliver(rec); }
  }

  function closeSetup() {
    setPop('setupPop', false);
    var tg = $('setupToggle'); if (tg) { tg.setAttribute('aria-expanded', 'false'); if (tg.focus) tg.focus(); }
  }

  function confirmOpen() { return popOpen('modal') || popOpen('cModal'); }

  function init(a) {
    api = a;
    $('fetchJandi').href = JANDI_ROOM_URL;
    var tg = $('setupToggle');
    tg.addEventListener('click', function () { // 설치 방법은 전면 팝업으로 연다
      setPop('setupPop', true); tg.setAttribute('aria-expanded', 'true');
      loadBookmark();
    });
    var sx = $('setupX'); if (sx) sx.addEventListener('click', closeSetup);
    var rx = $('reconX'); if (rx) rx.addEventListener('click', hideCard);
    root.addEventListener('keydown', function (e) { // 확인 팝업이 떠 있으면 그쪽 Esc가 먼저다
      if (e.key !== 'Escape' || confirmOpen()) return;
      if (popOpen('setupPop')) closeSetup(); else if (popOpen('reconPop')) hideCard();
    }, true); // 캡처 단계: 확인 팝업의 Esc 처리(document.onkeydown)가 모달을 닫기 전에 본다
    $('bmLink').addEventListener('click', function (e) {
      e.preventDefault(); $('bmNote').textContent = '눌러서 쓰는 게 아니에요. 북마크바로 끌어다 놓아 주세요.';
    });
    root.addEventListener('message', onMessage);
    root.JandiBridge.announceReady(root.opener); // 북마크릿이 연 창이면 "받을 준비가 됐다"고 알린다
  }

  root.JandiUI = { init: init, onStatus: onStatus, hideCard: hideCard };
})(window);
