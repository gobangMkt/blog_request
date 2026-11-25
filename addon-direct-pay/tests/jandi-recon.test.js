// 실행: node tests/jandi-recon.test.js (addon-direct-pay 폴더에서)
// 실제 잔디 원문 22건(tests/fixtures/jandi-real-22.json)을 분류기로 돌린 결과를 입력으로, 화면 데이터(줄 건수·문구·잠금·경고)를 고정한다.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const J = require('../js/jandi-classify.js');
const R = require('../js/jandi-recon.js');

const TEXTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/jandi-real-22.json'), 'utf8')).map((m) => m.text);

let pass = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { failures.push(name); console.log('FAIL ' + name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n     ')); }
}

// 시트에는 일반형 5건, 알림톡 발송 기록(PF) 4건이 이미 있다고 둔다
const EXISTING = [
  ['직-일반', '20917', '2026-11-09 12:00'], ['직-일반', '20919', '2026-11-09 16:05'], ['직-일반', '20920', '2026-11-09 16:56'],
  ['직-일반', '8625', '2026-11-11 06:10'], ['직-일반', '12532', '2026-11-11 09:46'],
  ['PF', '20897', '2026-11-06 10:01'], ['PF', '17169', '2026-11-10 16:44'], ['PF', '6610', '2026-11-12 11:55'],
  ['PF', '20973', '2026-11-18 09:56']
].map(([type, no, paidAt]) => ({ type, no, paidAt }));
const COMPLETE = { complete: true, reachedTop: true, aborted: '', total: 171, newestId: '5164296884', oldestId: '5125384030', oldestAt: '' };

function preview(over) {
  const r = J.classifyMessages(TEXTS, EXISTING);
  return Object.assign({ success: true, readOnly: true, results: r.results, counts: r.counts, regression: { missing: [] } }, over || {});
}
const build = (pv, scan, opts) => R.build(pv || preview(), scan || COMPLETE, Object.assign({ messages: TEXTS, imageOnly: 25 }, opts || {}));
const g = (v, id) => v.groups.find((x) => x.id === id);
const counts = (v) => v.groups.map((x) => x.id + ':' + x.count).join(' ');

const V = build();

test('제목 = 읽은 글 건수, 범위 요약 = 가장 이른 결제 ~ 가장 늦은 결제 · 방 처음까지', () => {
  assert.strictEqual(V.title, '잔디에서 결제 알림 22건 읽었어요');
  assert.strictEqual(V.sum, '10.29 ~ 11.23 · 방 처음까지 읽음');
});

test('줄 건수: 이미 있음 9, 일반형 4, 고급형 1, 빌리투어 7, 확인 필요 2, 대상 아님 1, 안내 0', () => {
  assert.strictEqual(counts(V), 'known:9 newBasic:4 needPhone:1 billy:7 review:2 notTarget:1 guide:0');
  assert.deepStrictEqual(V.groups.map((x) => x.label), ['이미 시트에 있음', '새로 등록할 일반형', '전화번호가 필요한 고급형',
    '빌리투어 쌓을 것', '확인 필요', '대상 아님', '안내 글']);
});

test('합계 점검 한 줄: 읽은 22 = 9+4+1+7+2+1 - 한 글 안 추가 조각 2, 통과', () => {
  assert.strictEqual(V.check.text, '읽은 22건 = 9 + 4 + 1 + 7 + 2 + 1 - 한 글 안 추가 조각 2');
  assert.strictEqual(V.check.ok, true);
  assert.deepStrictEqual(V.warnings, []);
});

test('읽지 않은 이미지 참고 줄(합계에 안 넣음)', () => {
  assert.deepStrictEqual(V.image, { count: 25, text: '읽지 않은 이미지 25건' });
  assert.strictEqual(build(null, null, { imageOnly: 0 }).image, null);
});

test('고급형 번호 필요 줄: 지점·결제일시·사유(앞 문구는 줄 제목이 말하므로 뺀다)', () => {
  const r = g(V, 'needPhone').rows[0];
  assert.strictEqual(r.who, '이레고시원(이레하우스)(16861)');
  assert.strictEqual(r.when, '11.23 11:12');
  assert.strictEqual(r.key, '16861_202611231112');
  assert.strictEqual(r.reason, '시트·발송 기록에 이 지점이 없어요');
  assert.strictEqual(g(V, 'needPhone').open, 'phone');
});

test('등록 대상: 일반형 4(basic), 빌리투어 7(billy). 확인 필요는 넣지 않는다', () => {
  const reg = V.register;
  assert.strictEqual(reg.basic, 4);
  assert.strictEqual(reg.billy, 7);
  assert.strictEqual(reg.review, 2);
  assert.strictEqual(reg.targets.length, 11);
  assert.ok(reg.targets.some((t) => t.key === '20975_202611231430' && t.action === 'basic'));
  assert.ok(reg.targets.some((t) => t.key === '20975_202611231430' && t.action === 'billy'));
  assert.ok(!reg.targets.some((t) => t.key === '16861_202611231112'));
  assert.strictEqual(reg.label, '시트에 등록하기 (일반형 4건, 빌리투어 7건)');
  assert.strictEqual(reg.disabled, false);
});

test('확인 팝업 문구: 일반형 N건, 빌리투어 N건을 등록합니다 + 확인 필요는 등록 안 함', () => {
  const t = R.confirmText(V);
  assert.strictEqual(t.title, '일반형 4건, 빌리투어 7건을 등록합니다');
  assert.deepStrictEqual(t.lines, ['확인 필요 2건은 등록하지 않아요', '전화번호가 필요한 고급형 1건은 등록하지 않아요']);
  assert.strictEqual(t.yes, '등록하기');
});

test('확인 필요 줄: 11221은 읽은 값으로 등록 가능(billy), 20803은 열쇠가 X_ 해시라 등록 불가, 둘 다 원문 펼침', () => {
  const rows = g(V, 'review').rows;
  const a = rows.find((r) => r.branchNo === '11221');
  const b = rows.find((r) => r.branchNo === '20803');
  assert.strictEqual(a.regAction, 'billy');
  assert.strictEqual(a.key, '11221_202611041535');
  assert.ok(a.raw.indexOf('@스티브') === 0);
  assert.strictEqual(b.regAction, '');
  assert.ok(/^X_[0-9a-f]{8}$/.test(b.key), b.key);
  assert.ok(b.raw.indexOf('20803') >= 0);
  assert.strictEqual(g(V, 'review').open, 'raw');
});

test('끝까지 못 읽음: 맨 위 경고 + "mm.dd 까지만 읽었어요"', () => {
  const v = build(null, Object.assign({}, COMPLETE, { complete: false, reachedTop: false, aborted: 'time' }));
  assert.strictEqual(v.sum, '10.29 까지만 읽었어요');
  assert.strictEqual(v.warnings[0].id, 'incomplete');
  assert.strictEqual(v.warnings[0].title, '끝까지 읽지 못했어요');
  assert.ok(v.warnings[0].text.indexOf('수집 시각은 갱신하지 않아요') >= 0);
  assert.strictEqual(v.register.disabled, false);
  assert.ok(R.confirmText(v).lines.indexOf('끝까지 읽지 못해 수집 시각은 갱신하지 않아요') >= 0);
});

test('읽기 회귀: regression.missing이 있으면 "지난번엔 있었는데 N건이 안 보여요"', () => {
  const v = build(preview({ regression: { missing: [{ key: '20897_202611061001', branch: '휴식 교대점', paidAt: '2026-11-06 10:01' },
    { key: '1_202611010000', branch: 'A', paidAt: '2026-11-01 00:00' }] } }));
  const w = v.warnings.find((x) => x.id === 'regression');
  assert.strictEqual(w.title, '지난번엔 있었는데 2건이 안 보여요');
  assert.ok(w.text.indexOf('휴식 교대점 11.06 10:01') === 0);
  assert.strictEqual(v.check.ok, true);
});

test('합계 불일치: counts.sumOk false면 "건수가 안 맞아요" + 등록 잠금(이유가 라벨)', () => {
  const pv = preview(); pv.counts = Object.assign({}, pv.counts, { sumOk: false });
  const v = build(pv);
  assert.strictEqual(v.check.ok, false);
  assert.strictEqual(v.warnings.find((x) => x.id === 'sum').title, '건수가 안 맞아요');
  assert.strictEqual(v.register.disabled, true);
  assert.strictEqual(v.register.label, '건수가 안 맞아 등록할 수 없어요');
});

test('합계 불일치: 조각 수가 서버 counts와 다르면 잠근다', () => {
  const pv = preview(); pv.counts = Object.assign({}, pv.counts, { pieces: 99 });
  assert.strictEqual(build(pv).register.disabled, true);
});

test('종결된 조각(closed:true)은 숨기고 줄 건수에서 뺀다. 합계 점검은 통과, 종결 건수는 한 줄로만', () => {
  const pv = preview();
  pv.results.forEach((x) => x.pieces.forEach((p) => { if (p.key === '16861_202611231112' || p.branchNo === '20803') p.closed = true; }));
  const v = build(pv);
  assert.strictEqual(counts(v), 'known:9 newBasic:4 needPhone:0 billy:7 review:1 notTarget:1 guide:0 closed:2');
  assert.strictEqual(g(v, 'closed').rows.length, 0); // 숨김
  assert.strictEqual(v.check.text, '읽은 22건 = 9 + 4 + 0 + 7 + 1 + 1 + 2 - 한 글 안 추가 조각 2');
  assert.strictEqual(v.check.ok, true);
  assert.strictEqual(v.register.review, 1);
});

test('방금 화면에서 닫은 건(closedKeys)도 같은 방식으로 숨긴다', () => {
  const v = build(null, null, { closedKeys: { '16861_202611231112': true } });
  assert.strictEqual(g(v, 'needPhone').count, 0);
  assert.strictEqual(g(v, 'closed').count, 1);
  assert.strictEqual(v.check.ok, true);
});

test('이미 쌓은 빌리투어(exists)는 등록 대상에서 빼고 별도 줄로 센다', () => {
  const pv = preview();
  pv.results.forEach((x) => x.pieces.forEach((p) => { if (p.key === '20906_202611031535') p.exists = true; }));
  const v = build(pv);
  assert.strictEqual(g(v, 'billy').count, 6);
  assert.strictEqual(g(v, 'billyExists').count, 1);
  assert.strictEqual(v.register.billy, 6);
  assert.strictEqual(v.check.ok, true);
});

test('등록할 건이 없으면 "읽은 기록 남기기"(수집 시각만)', () => {
  const pv = preview();
  pv.results.forEach((x) => x.pieces.forEach((p) => {
    if (p.status === '새로등록') { p.status = '이미있음'; p.class = 'blog_known'; }
    if (p.status === '빌리투어쌓기') p.exists = true;
  }));
  const v = build(pv);
  assert.strictEqual(v.register.mode, 'logonly');
  assert.strictEqual(v.register.label, '읽은 기록 남기기');
  assert.strictEqual(R.confirmText(v).title, '읽은 기록만 남길까요?');
});

test('같은 글이 두 번 들어오거나 안내 글이면 줄이 더 생기고 합계가 맞는다', () => {
  const texts = TEXTS.concat([TEXTS[4], '[Web발신]\n[상품 결제완료]\n지점명(숫자)\n결제상품: 블로그 일반형\n결제일시: yy.mm.dd HH:mm']);
  const r = J.classifyMessages(texts, EXISTING);
  const v = R.build({ success: true, results: r.results, counts: r.counts, regression: { missing: [] } }, COMPLETE, { messages: texts });
  assert.strictEqual(g(v, 'dup').count, 1);
  assert.strictEqual(g(v, 'guide').count, 1);
  assert.strictEqual(v.read, 24);
  assert.strictEqual(v.check.ok, true);
});

test('잡담은 읽은 글에 세지 않는다', () => {
  const texts = TEXTS.concat(['결제 얘기는 내일 해요']);
  const r = J.classifyMessages(texts, EXISTING);
  const v = R.build({ success: true, results: r.results, counts: r.counts }, COMPLETE, { messages: texts });
  assert.strictEqual(v.read, 22);
  assert.strictEqual(v.check.ok, true);
});

test('결과가 0건이면 제목이 달라진다', () => {
  const v = R.build({ success: true, results: [], counts: { sumOk: true, pieces: 0 } }, COMPLETE, {});
  assert.strictEqual(v.title, '잔디에서 읽은 결제 알림이 없어요');
});

test('importJandi 응답 -> 결과 카드 줄', () => {
  const rv = R.resultView({ results: [
    { key: '20518_202611211637', action: 'basic', status: 'added', reason: '시트에 등록했어요(9행)' },
    { key: '20975_202611231430', action: 'billy', status: 'duplicate', reason: '이미 시트에 있어요' },
    { key: '16861_202611231112', action: 'billy', status: 'skipped', reason: '고급형은 자동 등록하지 않아요(전화번호가 필요해요)' },
    { key: 'zzz', action: 'basic', status: 'error', reason: 'bad_request' }
  ], counts: { added: 1, duplicate: 1, closed: 0, skipped: 1, error: 1 } }, V);
  assert.strictEqual(rv.title, '등록 1건');
  assert.strictEqual(rv.sum, '이미 있음 1 · 종결 0 · 건너뜀 1 · 오류 1');
  assert.deepStrictEqual(rv.items.map((x) => x.cls), ['added', 'skip', 'skip', 'bad']);
  assert.strictEqual(rv.items[0].who, '스테이블 한대앞역점(20518)');
  assert.strictEqual(rv.items[0].when, '11.21 16:37');
});

test('마지막 수집: 3일 미만은 글자만, 3일 이상·기록 없음은 강조 글자', () => {
  const now = Date.parse('2026-11-24T07:00:00Z'); // KST 11.24 16:00
  assert.deepStrictEqual(R.lastScanInfo({ at: '2026-11-24T05:21:00.000Z', complete: true }, now),
    { text: '마지막 수집 11.24 14:21', stale: false, chip: '' });
  assert.deepStrictEqual(R.lastScanInfo({ at: '2026-11-21T05:21:00.000Z' }, now),
    { text: '마지막 수집 11.21 14:21', stale: true, chip: '3일 지났어요' });
  assert.deepStrictEqual(R.lastScanInfo({ at: '2026-11-22T05:21:00.000Z' }, now).stale, false);
  assert.deepStrictEqual(R.lastScanInfo(null, now), { text: '잔디 결제를 아직 가져오지 않았어요', stale: true, chip: '가져오기 필요' });
  assert.strictEqual(R.lastScanInfo({ at: '2026-11-24 14:21' }, now).text, '마지막 수집 11.24 14:21'); // KST 글자도 읽는다
});

test('빌리투어 표·추이 항목: 금액은 billy 배열의 amount', () => {
  const billy = [{ paidAt: '2026-11-23 14:30', branch: '마이스테이 강동점', branchNo: '20975', product: '빌리투어 (투어영상)', amount: 400000, status: '진행전' },
    { paidAt: '2026-11-13 11:52', branch: '서울스테이', branchNo: '20933', product: '빌리투어 (투어영상)', amount: 400000, status: '진행전' }];
  const bv = R.billyView(billy);
  assert.strictEqual(bv.title, '빌리투어 2건');
  assert.strictEqual(bv.sum, '결제액 800,000원 · 읽기 전용');
  assert.deepStrictEqual(bv.rows[0], { when: '11.23 14:30', who: '마이스테이 강동점(20975)', product: '빌리투어 (투어영상)', amount: 400000, status: '진행전' });
  const items = R.billyTrendItems(billy.concat([{ paidAt: '', amount: 1 }]));
  assert.strictEqual(items.length, 2);
  assert.deepStrictEqual(items[0], { kind: '빌리투어', label: '마이스테이 강동점', paidAt: '2026-11-23 14:30', price: 400000, stage: 'paid' });
  assert.strictEqual(R.billyView([]).title, '빌리투어 0건');
  assert.deepStrictEqual(R.billyTrendItems(undefined), []);
});

test('탭 = 상품. 한 줄은 한 탭에만, 상품과 무관한 줄은 탭 밖 해당 없음', () => {
  const t = V.tabs;
  assert.deepStrictEqual(t.map((x) => x.id + ':' + x.count), ['blog:15', 'billy:8']);
  assert.deepStrictEqual(t[0].groups.map((x) => x.id), ['newBasic', 'needPhone', 'review', 'known']);
  assert.deepStrictEqual(t[1].groups.map((x) => x.id), ['billy', 'review']);
  const reviewRows = t.map((x) => x.groups.find((y) => y.id === 'review').rows.length);
  assert.strictEqual(reviewRows[0] + reviewRows[1], g(V, 'review').count);
  assert.strictEqual(V.fold.count, 1);
  assert.deepStrictEqual(V.fold.groups.map((x) => x.id), ['notTarget']);
  assert.strictEqual(t[0].count + t[1].count + V.fold.count, V.groups.reduce((a, x) => a + x.count, 0));
});

test('같은 지점·같은 사유가 반복되면 한 묶음으로 센다', () => {
  const row = (k, who, reason) => ({ key: k, who: who, reason: reason, warnings: [] });
  const c = R.clusterRows([row('a', '가나다점(1)', '줄이 달라요'), row('b', '가나다점(1)', '줄이 달라요'), row('c', '가나다점(1)', '형식이 달라요'), row('d', '다른점(2)', '줄이 달라요')]);
  assert.deepStrictEqual(c.map((x) => x.rows.length), [2, 1, 1]);
  assert.deepStrictEqual(c[0].rows.map((r) => r.key), ['a', 'b']);
});

test('지난 수집 이후까지 읽은 범위 요약 글자', () => {
  const v = build(null, Object.assign({}, COMPLETE, { reachedTop: false }));
  assert.ok(v.sum.indexOf('지난 수집 이후까지 읽음') > 0, v.sum);
  assert.strictEqual(v.complete, true);
});

console.log('\n' + pass + ' passed, ' + failures.length + ' failed');
if (failures.length) { console.log('FAILED: ' + failures.join(', ')); process.exit(1); }
