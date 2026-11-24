// 잔디 결제 알림 분류기(순수 함수, 읽기 전용). 시트·속성·화면을 건드리지 않는다.
// 이 파일은 gas-code/JandiClassify.gs 와 글자까지 같아야 한다(tests/jandi-classify.test.js 가 확인).
// 시각은 모두 KST 벽시계 문자열 'yyyy-MM-dd HH:mm'로 다룬다(시간대 계산 없음).
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JandiClassify = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var PRICE = { basic: 70000, premium: 150000, billy: 400000 };
  var WINDOW_MIN = 14 * 24 * 60; // 고급형 폼 제출이 결제 뒤 14일 안이라는 가정(스펙 4-2, 미확인)

  var RE_START = /^\[Web발신\]/;
  var RE_HEAD = /\[상품\s*결제완료\]/;
  var RE_BRANCH = /\[상품\s*결제완료\][ \t]*\n[ \t]*(.+)\((\d+)\)[ \t]*(?:\n|$)/;
  var RE_ITEMS = /결제상품[ \t]*:([\s\S]*?)결제금액[ \t]*:/;
  var RE_AMOUNT = /결제금액[ \t]*:[ \t]*([\d,]+)/;
  var RE_PAID = /결제일시[ \t]*:[ \t]*(\d{2})\.(\d{2})\.(\d{2})[ \t]+(\d{1,2}):(\d{2})(?!\d)/;
  var LOOSE_DATE = /\s*(\d{2})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})\s+(\d{1,2})\s*[:：]\s*(\d{2})/;
  var RE_PAID_LOOSE = new RegExp('결\\s*[제재]\\s*일\\s*시\\s*[:：]?' + LOOSE_DATE.source);
  var RE_DATE_ANY = /(\d{2})\.(\d{2})\.(\d{2})\s+(\d{1,2}):(\d{2})/g;
  var RE_BRANCH_LINE = /^\s*(.+?)\s*[(（]\s*(\d{3,8})\s*[)）]\s*$/;
  var RE_NAME_NO_MID = /\S[(（]\s*\d{3,8}\s*[)）]/;
  var RE_BRANCH_MID = /^(.*?)[(（]\s*(\d{3,8})\s*[)）]/;
  var RE_LABELISH = /결[제재]|일시|금액|상품|등록/;
  var RE_TYPO_PRODUCT = /블로[그거]|블러그|빌리투|빌리/;

  function normalizeText(s) {
    return String(s == null ? '' : s)
      .replace(/\r\n?/g, '\n')
      .replace(/[​-‍﻿]/g, '')
      .replace(/ /g, ' ')
      .trim();
  }

  // 느슨한 규칙용: 전각 -> 반각
  function fold(s) {
    return String(s).replace(/[！-～]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
    }).replace(/　/g, ' ');
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // yy.mm.dd HH:mm 이 실제 달력에 있으면 'yyyy-MM-dd HH:mm', 아니면 ''
  function stampFromParts(yy, mm, dd, hh, mi) {
    var y = 2000 + Number(yy), mo = Number(mm), d = Number(dd), h = Number(hh), m = Number(mi);
    if (mo < 1 || mo > 12 || d < 1 || h > 23 || m > 59) return '';
    var t = new Date(Date.UTC(y, mo - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return '';
    return y + '-' + pad2(mo) + '-' + pad2(d) + ' ' + pad2(h) + ':' + pad2(m);
  }

  // 'yyyy-MM-dd HH:mm(:ss)' 글자에서 분 단위 시각 글자를 뽑는다. 못 읽으면 ''
  function stampOf(v) {
    var m = String(v == null ? '' : v).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] : '';
  }

  function minutesOf(stamp) {
    var m = String(stamp).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : NaN;
  }

  function keyStamp(stamp) { return String(stamp).replace(/\D/g, ''); }

  // 괄호 밖 쉼표로만 나눈다. "블로그 일반형, 빌리투어 (영상, 사진)" -> 2조각
  function splitTopLevel(line) {
    var out = [], depth = 0, cur = '', i, c;
    for (i = 0; i < line.length; i++) {
      c = line.charAt(i);
      if (c === '(' || c === '[' || c === '（') depth++;
      else if ((c === ')' || c === ']' || c === '）') && depth > 0) depth--;
      if ((c === ',' || c === '，') && depth === 0) { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out.map(function (x) { return x.replace(/\s+/g, ' ').trim(); })
      .filter(function (x) { return x; });
  }

  function fragmentsOf(itemsText) {
    var out = [];
    String(itemsText).split('\n').forEach(function (ln) {
      var t = ln.trim().replace(/^[-•·*]\s*/, '');
      if (t) out = out.concat(splitTopLevel(t));
    });
    return out;
  }

  function classifyFragment(f) {
    var blog = f.match(/블로그\s*(일반형|고급형)/);
    var billy = /빌리투어/.test(f);
    if (blog && billy) return { type: 'both' };
    if (blog) return { type: 'blog', grade: blog[1], product: '블로그 ' + blog[1] };
    if (billy) {
      var opt = f.match(/\(([^)]*)\)/);
      return { type: 'billy', product: f, option: opt ? opt[1].trim() : '' };
    }
    if (/플랜|직접입력/.test(f)) return { type: 'plan' };
    return { type: 'other' };
  }

  // 1차 엄격 규칙. 통과하면 { ok: true, d }, 아니면 { ok: false, fails: [사유...] }
  function parseStrict(t) {
    var fails = [];
    var startOk = RE_START.test(t);
    var headOk = RE_HEAD.test(t);
    var br = t.match(RE_BRANCH);
    var items = t.match(RE_ITEMS);
    var amt = t.match(RE_AMOUNT);
    var dt = t.match(RE_PAID);
    var stamp = dt ? stampFromParts(dt[1], dt[2], dt[3], dt[4], dt[5]) : '';
    if (!startOk) fails.push('글이 [Web발신]으로 시작하지 않아요');
    if (!headOk) fails.push('[상품 결제완료] 줄이 달라요');
    else if (!br) fails.push('지점명(번호) 줄을 못 읽었어요');
    if (!items) fails.push('결제상품~결제금액 줄을 못 읽었어요');
    if (!dt) fails.push('결제일시 형식이 달라요');
    else if (!stamp) fails.push('결제일시가 달력에 없는 날짜예요');
    if (fails.length) return { ok: false, fails: fails };
    return {
      ok: true,
      d: {
        branch: br[1].trim(), branchNo: br[2], paidAt: stamp, itemsText: items[1],
        amount: amt ? Number(amt[1].replace(/,/g, '')) : null
      }
    };
  }

  // 느슨한 규칙의 신호 수(스펙 3-3)
  function looseSignals(t) {
    var f = fold(t).replace(/\s+/g, '').toLowerCase();
    var lines = fold(t).split('\n');
    var n = 0, done = /결[제재]완료/.test(f);
    if (done) n++;
    if (/결[제재]상품/.test(f)) n++;
    if (/결[제재]금액/.test(f)) n++;
    if (/결[제재]일시/.test(f)) n++;
    if (/web발신/.test(f)) n++;
    if (lines.some(function (l) { return /\(\d{3,8}\)\s*$/.test(l); })) n++;
    if (/\d{2}\.\d{2}\.\d{2}/.test(f)) n++;
    if (/블로[그거]|빌리투어/.test(f)) n++;
    // 사람이 쓴 결제 안내: 지점명(숫자) + 블로그·빌리투어 + 결제 표현이 한 글에 같이 있으면 후보
    var manual = RE_NAME_NO_MID.test(fold(t)) && /블로[그거]|빌리투어/.test(f) && /결[제재]/.test(f);
    return { n: n, done: done, candidate: n >= 3 || (done && n >= 2) || manual };
  }

  function looseHeadIndex(lines) {
    var i;
    for (i = 0; i < lines.length; i++) {
      if (/결[제재]\s*완\s*료/.test(lines[i].replace(/\s+/g, ''))) return i;
    }
    return -1;
  }

  // 안내 글(양식 인용): 자리표시 글자가 있으면 안내 글이다(스펙 3-6)
  function isGuide(t) {
    if (/yy\s*\.\s*mm\s*\.\s*dd/i.test(t)) return true;
    var lines = fold(t).split('\n');
    var h = looseHeadIndex(lines);
    var ln = h >= 0 && h + 1 < lines.length ? lines[h + 1].trim() : '';
    if (!ln) return false;
    return /지점\s*명|지점\s*이름|OOO|○{2,}|x{3,}/i.test(ln) ||
      /\(\s*(지점\s*번호|번호|숫자|n+|0+)\s*\)\s*$/i.test(ln);
  }

  // 느슨하게 지점·번호·결제일시·상품을 다시 뽑는다
  function extractLoose(t) {
    var lines = fold(t).split('\n');
    var h = looseHeadIndex(lines);
    var branch = '', no = '', paid = '', products = [], i, m, order = [];
    if (h >= 0) order.push(h + 1);
    for (i = 0; i < lines.length; i++) order.push(i);
    for (i = 0; i < order.length && !no; i++) {
      m = (lines[order[i]] || '').match(RE_BRANCH_LINE);
      if (m && !RE_LABELISH.test(m[1])) { branch = m[1].trim(); no = m[2]; }
    }
    for (i = 0; i < lines.length && !no; i++) {
      m = lines[i].match(RE_BRANCH_MID);
      if (m && m[1].trim() && !RE_LABELISH.test(m[1])) { branch = m[1].trim(); no = m[2]; }
    }
    m = fold(t).match(RE_PAID_LOOSE);
    if (m) paid = stampFromParts(m[1], m[2], m[3], m[4], m[5]);
    else {
      var last = null, any;
      RE_DATE_ANY.lastIndex = 0;
      while ((any = RE_DATE_ANY.exec(fold(t)))) last = any;
      if (last) paid = stampFromParts(last[1], last[2], last[3], last[4], last[5]);
    }
    var flat = fold(t).replace(/\s+/g, '');
    var bg = flat.match(/블로[그거](일반|고급)/);
    if (bg) products.push({ kind: 'blog', grade: bg[1] + '형', product: '블로그 ' + bg[1] + '형' });
    if (/빌리투어/.test(flat)) products.push({ kind: 'billy', product: '빌리투어' });
    return { branch: branch, no: no, paid: paid, products: products };
  }

  function amountOf(t) {
    var m = t.match(RE_AMOUNT);
    return m ? Number(m[1].replace(/,/g, '')) : null;
  }

  function blank(over) {
    var o = {
      class: 'ignore', status: '', branch: '', branchNo: '', paidAt: '', product: '',
      amount: null, unitPrice: null, reason: '', key: '', kind: '', warnings: []
    };
    Object.keys(over || {}).forEach(function (k) { o[k] = over[k]; });
    return o;
  }

  // 공백을 뺀 글의 djb2 해시(8자리 16진). 같은 글은 늘 같은 열쇠가 된다
  function hashText(raw) {
    var s = normalizeText(raw).replace(/\s+/g, ''), h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function comma(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function keyOf(no, stamp) { return no && stamp ? no + '_' + keyStamp(stamp) : ''; }

  // 글 하나를 조각 목록으로 쪼갠다. 시트 대조 전의 1차 분류만 한다.
  function parseMessage(raw) {
    var t = normalizeText(raw);
    var sig = looseSignals(t);
    if (!t || !sig.candidate) {
      return [blank({ status: '잡담', reason: '결제 알림이 아니에요' })];
    }
    if (isGuide(t)) {
      return [blank({ status: '안내글', reason: '결제 양식을 인용한 안내 글이에요' })];
    }
    var s = parseStrict(t);
    if (!s.ok) return reviewFromLoose(t, s.fails);
    var d = s.d, pieces = [], hasPlan = false, sum = 0;
    fragmentsOf(d.itemsText).forEach(function (f) {
      var c = classifyFragment(f);
      var base = { branch: d.branch, branchNo: d.branchNo, paidAt: d.paidAt, amount: d.amount,
        key: keyOf(d.branchNo, d.paidAt) };
      if (c.type === 'plan') { hasPlan = true; return; }
      if (c.type === 'both') {
        pieces.push(blank(Object.assign(base, { class: 'needs_review', status: '확인필요',
          product: f, reason: '한 줄에 블로그와 빌리투어가 같이 있어요(쉼표 없음)' })));
      } else if (c.type === 'blog') {
        var kind = c.grade === '고급형' ? 'premium' : 'basic';
        sum += PRICE[kind];
        pieces.push(blank(Object.assign(base, { class: 'blog_new', kind: kind,
          product: c.product, unitPrice: PRICE[kind] })));
      } else if (c.type === 'billy') {
        sum += PRICE.billy;
        pieces.push(blank(Object.assign(base, { class: 'billy', status: '빌리투어쌓기', kind: 'billy',
          product: c.product, unitPrice: PRICE.billy, option: c.option,
          reason: '빌리투어 새 탭에 쌓을 건이에요' })));
      } else if (RE_TYPO_PRODUCT.test(fold(f).replace(/\s+/g, ''))) {
        pieces.push(blank(Object.assign(base, { class: 'needs_review', status: '확인필요',
          product: f, reason: '상품 문구가 블로그·빌리투어와 비슷한데 달라요' })));
      }
    });
    if (!pieces.length) {
      var shown = fragmentsOf(d.itemsText).join(', ');
      return [blank({ status: '대상아님', branch: d.branch, branchNo: d.branchNo, paidAt: d.paidAt,
        product: shown, amount: d.amount, key: keyOf(d.branchNo, d.paidAt),
        reason: '블로그·빌리투어 상품이 아니에요' })];
    }
    if (!hasPlan && d.amount != null && pieces.every(function (p) { return p.unitPrice; }) &&
      sum !== d.amount) {
      pieces.forEach(function (p) {
        p.warnings.push('결제금액 ' + comma(d.amount) + '원이 단가 합 ' + comma(sum) + '원과 달라요');
      });
    }
    return pieces;
  }

  // 1차 실패한 후보: 느슨하게 다시 읽어 사람이 확인할 목록으로 보낸다(자동 등록 안 함)
  function reviewFromLoose(t, fails) {
    var L = extractLoose(t);
    var missing = [];
    if (!L.no) missing.push('지점 번호');
    if (!L.paid) missing.push('결제일시');
    if (!L.products.length) missing.push('상품');
    var hasHead = looseHeadIndex(t.split('\n')) >= 0;
    if (!RE_START.test(t) && hasHead && (!L.no || !L.paid)) {
      return [blank({ status: '안내글',
        reason: '[Web발신]으로 시작하지 않고 지점·결제일시가 비어 있어요(안내 글로 봤어요)' })];
    }
    var why = fails.join(' / ');
    var base = { class: 'needs_review', status: '확인필요', branch: L.branch, branchNo: L.no,
      paidAt: L.paid, amount: amountOf(fold(t)), key: keyOf(L.no, L.paid), extracted: true };
    if (missing.length) {
      return [blank(Object.assign(base, { product: L.products.map(function (p) {
        return p.product; }).join(', '),
        reason: why + ' · 못 읽은 항목: ' + missing.join(', ') }))];
    }
    return L.products.map(function (p) {
      return blank(Object.assign({}, base, { product: p.product,
        kind: p.kind === 'billy' ? 'billy' : (p.grade === '고급형' ? 'premium' : 'basic'),
        reason: why + ' · 읽은 값을 확인하고 건별로 등록해 주세요' }));
    });
  }

  function normExisting(list) {
    return (list || []).map(function (r) {
      return { type: String(r.type || '').trim(), no: String(r.no || '').replace(/\D/g, ''),
        stamp: stampOf(r.paidAt), used: false };
    }).filter(function (r) { return r.no && r.stamp; });
  }

  function dayGap(a, b) { return Math.round((minutesOf(b) - minutesOf(a)) / 1440); }

  // 시트 대조. 고급형 직A/직B는 한 행이 한 결제와 한 번만 짝이 된다(스펙 4-2)
  function matchSheet(pieces, existingRaw) {
    var ex = normExisting(existingRaw);
    function find(type, no, stamp) {
      for (var i = 0; i < ex.length; i++) {
        if (ex[i].type === type && ex[i].no === no && ex[i].stamp === stamp) return ex[i];
      }
      return null;
    }
    function markKnown(p, why) { p.class = 'blog_known'; p.status = '이미있음'; p.reason = why; }
    function pick(kind, cls) {
      return pieces.filter(function (p) { return p.kind === kind && p.class === cls; });
    }
    var basics = pick('basic', 'blog_new');
    var prem = pick('premium', 'blog_new');
    var billies = pick('billy', 'billy');

    basics.forEach(function (p) {
      if (find('직-일반', p.branchNo, p.paidAt)) markKnown(p, '시트에 직-일반 행이 있어요');
      else { p.status = '새로등록'; p.reason = '시트에 없는 일반형이에요'; }
    });
    billies.forEach(function (p) {
      if (find('billy', p.branchNo, p.paidAt)) p.exists = true;
    });

    // ① 같은 분의 직A/직B 행을 먼저 짝지어 쓴 행으로 표시
    prem.forEach(function (p) {
      var r = find('직A', p.branchNo, p.paidAt) || find('직B', p.branchNo, p.paidAt);
      if (r && !r.used) { r.used = true; markKnown(p, '직A·직B 행이 있어요(결제일시 같음)'); }
    });
    // ② 알림톡 발송 기록, 직-대기 행
    prem.forEach(function (p) {
      if (p.class === 'blog_known') return;
      if (find('PF', p.branchNo, p.paidAt)) markKnown(p, '알림톡 발송 기록이 있어요');
      else if (find('직-대기', p.branchNo, p.paidAt)) markKnown(p, '직-대기 행이 있어요');
    });
    // ③ 결제 뒤 14일 안에 제출된 직A/직B 행(시간순 1:1)
    prem.slice().sort(function (a, b) { return minutesOf(a.paidAt) - minutesOf(b.paidAt); })
      .forEach(function (p) {
        if (p.class === 'blog_known') return;
        var best = null, i, r, diff;
        for (i = 0; i < ex.length; i++) {
          r = ex[i];
          if (r.used || r.no !== p.branchNo || (r.type !== '직A' && r.type !== '직B')) continue;
          diff = minutesOf(r.stamp) - minutesOf(p.paidAt);
          if (diff >= 0 && diff <= WINDOW_MIN && (!best || diff < best.diff)) {
            best = { r: r, diff: diff };
          }
        }
        if (best) {
          best.r.used = true;
          markKnown(p, '직A·직B 행이 있어요(결제 ' + Math.round(best.diff / 1440) + '일 뒤 제출)');
        }
      });
    // ④ 못 찾은 고급형은 전화번호가 필요한 건
    prem.forEach(function (p) {
      if (p.class === 'blog_known') return;
      var near = null, i, r;
      for (i = 0; i < ex.length; i++) {
        r = ex[i];
        if (r.no === p.branchNo && (r.type === '직A' || r.type === '직B') && !r.used) near = r;
      }
      p.status = '번호필요';
      p.needPhone = true;
      p.reason = '전화번호가 필요한 고급형 · ' + (near
        ? '같은 지점 ' + near.type + ' 행 있음(차이 ' + dayGap(p.paidAt, near.stamp) + '일)'
        : '시트·발송 기록에 이 지점이 없어요');
    });
  }

  function messageSummary(index, pieces) {
    var first = pieces[0];
    var hasBlog = false, hasBilly = false;
    pieces.forEach(function (p) {
      if (p.class === 'blog_known' || p.class === 'blog_new') hasBlog = true;
      if (p.class === 'billy') hasBilly = true;
    });
    var cls;
    if (pieces.length === 1) cls = first.class;
    else if (hasBlog && hasBilly) cls = 'blog_billy';
    else if (pieces.some(function (p) { return p.class === 'needs_review'; })) cls = 'needs_review';
    else if (pieces.some(function (p) { return p.class === 'blog_new'; })) cls = 'blog_new';
    else cls = first.class;
    var reasons = [];
    pieces.forEach(function (p) {
      if (p.reason && reasons.indexOf(p.reason) < 0) reasons.push(p.reason);
    });
    return {
      index: index, class: cls, branch: first.branch, branchNo: first.branchNo,
      paidAt: first.paidAt,
      product: pieces.map(function (p) { return p.product; }).filter(Boolean).join(', '),
      amount: first.amount, reason: reasons.join(' / '), pieces: pieces
    };
  }

  function emptyCounts() {
    return { messages: 0, pieces: 0, known: 0, newBasic: 0, needPhone: 0, billy: 0, billyExists: 0,
      review: 0, notTarget: 0, guide: 0, chat: 0, dupInBatch: 0, splitExtra: 0, sumOk: false };
  }

  // messages: 글 원문 배열(글자 또는 { text }). existing: [{ type, no, paidAt }] 시트·발송 기록 행
  //   type = '직-일반' | '직-대기' | '직A' | '직B' | 'PF'(알림톡 발송 기록) | 'billy'(부가상품 결제 탭)
  //   paidAt = 'yyyy-MM-dd HH:mm'(직A·직B는 시트 B열 값)
  function classifyMessages(messages, existing) {
    var all = [], results = [], seen = {}, counts = emptyCounts();
    (messages || []).forEach(function (m, idx) {
      var raw = m && typeof m === 'object' && m.text !== undefined ? m.text : m;
      var pieces = parseMessage(raw);
      pieces.forEach(function (p) {
        p.messageIndex = idx;
        var k = p.key && p.kind ? p.kind + ':' + p.key : '';
        if (k && seen[k]) {
          p.class = 'ignore'; p.status = '중복'; p.reason = '같은 글이 두 번 들어왔어요';
        } else if (k) seen[k] = true;
        // 지점번호·결제일시를 못 읽은 확인필요 글도 로그·종결에 쓸 열쇠가 있어야 한다
        if (!p.key && p.status === '확인필요') p.key = 'X_' + hashText(raw);
      });
      results.push(pieces);
      pieces.forEach(function (p) { all.push(p); });
    });
    matchSheet(all.filter(function (p) { return p.status !== '중복'; }), existing);
    all.forEach(function (p) {
      counts.pieces++;
      if (p.status === '이미있음') counts.known++;
      else if (p.status === '새로등록') counts.newBasic++;
      else if (p.status === '번호필요') counts.needPhone++;
      else if (p.status === '빌리투어쌓기') { counts.billy++; if (p.exists) counts.billyExists++; }
      else if (p.status === '확인필요') counts.review++;
      else if (p.status === '대상아님') counts.notTarget++;
      else if (p.status === '안내글') counts.guide++;
      else if (p.status === '잡담') counts.chat++;
      else if (p.status === '중복') counts.dupInBatch++;
    });
    counts.messages = results.length;
    counts.splitExtra = counts.pieces - counts.messages;
    var sum = counts.known + counts.newBasic + counts.needPhone + counts.billy + counts.review +
      counts.notTarget + counts.guide + counts.chat + counts.dupInBatch;
    counts.sumOk = sum === counts.pieces;
    return {
      results: results.map(function (pcs, i) { return messageSummary(i, pcs); }),
      counts: counts
    };
  }

  return {
    PRICE: PRICE,
    classifyMessages: classifyMessages,
    parseStrict: parseStrict,
    splitTopLevel: splitTopLevel,
    stampOf: stampOf
  };
});
