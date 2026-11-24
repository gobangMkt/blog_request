// 실행: node tests/jandi-ui.test.js (addon-direct-pay 폴더에서)
// 브라우저 없이 가짜 DOM으로 js/jandi-ui.js의 흐름을 돌린다: 수신 -> 미리보기 -> 대조 카드 -> 등록 -> 결과.
// 실제 화면 모양(CSS·줄 맞춤)은 이 시험이 보지 못한다. 글자·건수·호출 내용·출처 거부만 확인한다.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const J = require('../js/jandi-classify.js');

class El {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.className = ''; this.hidden = false; this.style = {}; this._text = ''; this.id = ''; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children = []; }
  set innerHTML(v) { this._html = v; this.children = []; this._text = ''; }
  get firstChild() { return this.children[0] || null; }
  get lastChild() { return this.children[this.children.length - 1] || null; }
  appendChild(c) { this.children.push(c); return c; }
  insertBefore(c, ref) { const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(n, f) { (this.listeners[n] = this.listeners[n] || []).push(f); }
  click() { (this.listeners.click || []).forEach((f) => f({ preventDefault() {} })); }
  all(pred, out) { out = out || []; this.children.forEach((c) => { if (c instanceof El) { if (pred(c)) out.push(c); c.all(pred, out); } }); return out; }
  querySelector(sel) { const cls = sel.replace('.', ''); return this.all((e) => e.className.split(' ').indexOf(cls) >= 0)[0] || null; }
}
const byId = {};
['recon', 'lastScan', 'billyPane', 'fetchJandi', 'setupToggle', 'setupBox', 'bmLink', 'bmNote'].forEach((id) => { byId[id] = new El('x'); byId[id].id = id; });
byId.recon.hidden = true; byId.setupBox.hidden = true;
global.window = global;
global.document = { getElementById: (id) => byId[id], createElement: (t) => new El(t), createTextNode: (t) => { const e = new El('#text'); e._text = t; return e; } };
let onMessage = null;
global.addEventListener = (n, f) => { if (n === 'message') onMessage = f; };
global.opener = null;
global.JandiRecon = require('../js/jandi-recon.js');
global.JandiBridge = require('../js/jandi-bridge.js');
require('../js/jandi-ui.js');

const TEXTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/jandi-real-22.json'), 'utf8')).map((m) => m.text);
const EXISTING = [['직-일반', '20917', '2026-11-09 12:00'], ['PF', '20897', '2026-11-06 10:01']].map(([type, no, paidAt]) => ({ type, no, paidAt }));
const cls = J.classifyMessages(TEXTS, EXISTING);

let pass = 0;
const failures = [];
function test(name, fn) {
  return Promise.resolve().then(fn).then(() => { pass++; console.log('PASS ' + name); })
    .catch((e) => { failures.push(name); console.log('FAIL ' + name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n     ')); });
}
const tick = () => new Promise((r) => setTimeout(r, 5));

const calls = [];
let reloaded = 0, outHidden = 0, gate = 0;
const api = {
  post: (body) => {
    calls.push(body);
    if (body.action === 'previewJandi') return Promise.resolve({ success: true, readOnly: true, results: cls.results, counts: cls.counts, regression: { missing: [] } });
    if (body.action === 'importJandi') {
      return Promise.resolve({ success: true, counts: { added: body.confirm.length, duplicate: 0, closed: 0, skipped: 0, error: 0 },
        results: body.confirm.map((c) => Object.assign({ status: 'added', reason: '시트에 등록했어요' }, c)), lastScan: { at: '2026-11-24T05:21:00.000Z', complete: true } });
    }
    return Promise.resolve({ success: false });
  },
  confirmBox: (title, lines, yes) => { api.lastConfirm = { title, lines, yes }; return Promise.resolve(true); },
  askCard: () => new El('li'), loadStatus: () => { reloaded++; }, showGate: () => { gate++; }, hideOut: () => { outHidden++; },
  KIND_SVG: { '일반형': '<svg/>', '고급형': '<svg/>' }
};
const msg = (origin, data) => onMessage({ origin, data });
const GOOD = () => ({ type: 'nf-jandi', readerVersion: '1', result: { ok: true, readerVersion: '1', total: 171, imageOnly: 25, reachedTop: true, aborted: '', bottomStale: false,
  newestId: 5164296884, oldestId: 5125384030, candidates: TEXTS.map((t, i) => ({ id: String(i), type: 'text', text: t })) } });

(async () => {
  global.JandiUI.init(api);

  await test('가져오기 링크가 잔디 방 주소를 가리킨다', () => {
    assert.strictEqual(byId.fetchJandi.href, 'https://neoflat.jandi.com/app/#!/room/35912598');
  });

  await test('준비 전에 온 결과는 기다렸다가 첫 현황 응답 뒤에 처리한다', async () => {
    msg('https://neoflat.jandi.com', GOOD());
    await tick();
    assert.strictEqual(calls.length, 0);
    global.JandiUI.onStatus({ lastScan: null, billy: [{ paidAt: '2026-11-23 14:30', branch: '마이스테이 강동점', branchNo: '20975', product: '빌리투어 (투어영상)', amount: 400000, status: '진행전' }] });
    await tick();
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].action, 'previewJandi');
    assert.strictEqual(calls[0].messages.length, 22);
    assert.strictEqual(calls[0].scan.complete, true);
    assert.strictEqual(calls[0].token, undefined); // 토큰은 인라인 post만 붙인다. 북마크릿 메시지에는 없다
  });

  await test('머리: 기록이 없으면 마지막 수집 안내 + 강조 칩', () => {
    assert.ok(byId.lastScan.textContent.indexOf('잔디 결제를 아직 가져오지 않았어요') === 0);
    assert.ok(byId.lastScan.all((e) => e.className === 'chip sendwait').length === 1);
  });

  await test('빌리투어 탭: 읽기 전용 표(제목·합계·행)', () => {
    const t = byId.billyPane.textContent;
    assert.ok(t.indexOf('빌리투어 1건') >= 0 && t.indexOf('결제액 400,000원 · 읽기 전용') >= 0);
    assert.ok(t.indexOf('마이스테이 강동점(20975)') >= 0 && t.indexOf('400,000원') >= 0 && t.indexOf('진행전') >= 0);
  });

  await test('대조 카드: 제목·범위·줄·합계 점검·등록 버튼 라벨', () => {
    const t = byId.recon.textContent;
    assert.strictEqual(byId.recon.hidden, false);
    assert.ok(t.indexOf('잔디에서 결제 알림 22건 읽었어요') >= 0, t.slice(0, 80));
    assert.ok(t.indexOf('10.29 ~ 11.23 · 방 처음까지 읽음') >= 0);
    assert.ok(t.indexOf('읽지 않은 이미지 25건') >= 0);
    assert.ok(t.indexOf('읽은 22건 = ') >= 0);
    const reg = byId.recon.all((e) => e.attrs['data-act'] === 'recon-register')[0];
    assert.strictEqual(reg.textContent, '시트에 등록하기 (일반형 8건, 빌리투어 7건)');
    assert.ok(!reg.disabled);
  });

  await test('확인 필요·고급형 줄에는 펼침 토글(.tgl)이 있고 원문은 textContent로만 들어간다', () => {
    const opens = byId.recon.all((e) => e.attrs['data-act'] === 'recon-open');
    assert.strictEqual(opens.length, 6); // 번호 필요 4(20897은 발송 기록이 있음) + 확인 필요 2
    const raw = opens.find((b) => b.textContent === '원문 보기');
    raw.click();
    const hold = byId.recon.all((e) => e.className === 'hold' && !e.hidden)[0];
    assert.ok(hold && hold.textContent.indexOf('[Web발신]') >= 0 || hold.textContent.indexOf('스티브') >= 0);
    assert.strictEqual(hold.all((e) => e.tag === 'p').some((p) => p._html !== undefined), false);
  });

  await test('등록 버튼: 확인 팝업 문구 -> importJandi 호출 내용 -> 결과 카드 + 현황 다시 불러오기', async () => {
    const reg = byId.recon.all((e) => e.attrs['data-act'] === 'recon-register')[0];
    reg.click(); await tick(); await tick();
    assert.strictEqual(api.lastConfirm.title, '일반형 8건, 빌리투어 7건을 등록합니다');
    assert.ok(api.lastConfirm.lines.indexOf('확인 필요 2건은 등록하지 않아요') >= 0);
    const imp = calls.filter((c) => c.action === 'importJandi')[0];
    assert.strictEqual(imp.confirm.length, 15);
    assert.strictEqual(imp.confirm.filter((c) => c.action === 'basic').length, 8);
    assert.strictEqual(imp.confirm.filter((c) => c.action === 'billy').length, 7);
    assert.strictEqual(imp.scan.complete, true);
    assert.ok(byId.recon.textContent.indexOf('등록 15건') === 0);
    assert.ok(byId.lastScan.textContent.indexOf('마지막 수집 11.24 14:21') === 0);
    assert.ok(reloaded >= 1);
  });

  await test('출처가 잔디가 아닌 메시지는 무시한다(카드·호출 변화 없음)', async () => {
    const n = calls.length, before = byId.recon.textContent;
    msg('https://evil.example', GOOD()); await tick();
    assert.strictEqual(calls.length, n);
    assert.strictEqual(byId.recon.textContent, before);
  });

  await test('오래된 북마크 버전이면 안내 카드만 그리고 서버를 부르지 않는다', async () => {
    const n = calls.length;
    msg('https://neoflat.jandi.com', Object.assign(GOOD(), { readerVersion: '0' })); await tick();
    assert.strictEqual(calls.length, n);
    assert.ok(byId.recon.textContent.indexOf('북마크가 오래됐어요') >= 0);
  });

  await test('후보가 0건이면 서버를 부르지 않고 0건 카드를 그린다', async () => {
    const n = calls.length;
    const d = GOOD(); d.result.candidates = [];
    msg('https://neoflat.jandi.com', d); await tick();
    assert.strictEqual(calls.length, n);
    assert.ok(byId.recon.textContent.indexOf('잔디에서 읽은 결제 알림이 없어요') >= 0);
  });

  await test('끝까지 못 읽은 결과면 카드 맨 위에 경고', async () => {
    const d = GOOD(); d.result.reachedTop = false; d.result.aborted = 'time';
    msg('https://neoflat.jandi.com', d); await tick(); await tick();
    assert.ok(byId.recon.textContent.indexOf('끝까지 읽지 못했어요') === 0);
  });

  console.log('\n' + pass + ' passed, ' + failures.length + ' failed');
  if (failures.length) { console.log('FAILED: ' + failures.join(', ')); process.exit(1); }
})();
