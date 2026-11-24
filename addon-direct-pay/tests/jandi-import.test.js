// 실행: node tests/jandi-import.test.js (addon-direct-pay 폴더에서)
// importJandi · previewJandi(종결·회귀) · listStatus(billy·lastScan) · 붙여넣기 등록 불변을
// 시트·속성 목(tests/gas-mock.js)으로 시험한다. 자료는 실제 잔디 원문 22건(tests/fixtures/jandi-real-22.json).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { makeEnv, appRow, kstDate, APPLY_HEADER, ROOT, formatDate } = require('./gas-mock.js');
// 목에서 JSON으로 풀린 날짜(ISO 글자)를 KST 'yyyy-MM-dd HH:mm'로
const stampJ = (v) => formatDate(new Date(v), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');

const REAL = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/jandi-real-22.json'), 'utf8'));
const TEXTS = REAL.map((m) => m.text);

let pass = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) {
    failures.push(name);
    console.log('FAIL ' + name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n     '));
  }
}

const K = {
  basic: '20917_202611091200', billy: '20933_202611131152', combo: '6610_202611121155',
  combo2: '20975_202611231430', prem: '20897_202611061001', manualOk: '11221_202611041535'
};
const fresh = (extra) => makeEnv(Object.assign({ sheets: { '신청 내역': [APPLY_HEADER] } }, extra || {}));
const run = (env, confirm, scan, texts) => env.plain(env.ctx.importJandi({
  token: 'tok', messages: texts || TEXTS, confirm: confirm || [], scan
}));
const rowsOf = (env, name) => (env.sheet(name) ? env.plain(env.sheet(name).rows) : null);
const logRows = (env) => rowsOf(env, '잔디 수집 로그').slice(1);
const cnt = (env, name) => (rowsOf(env, name) || []).length;

// ── 입력 검증 ──
test('importJandi: 틀린 접근 코드·빈 입력·501건·confirm이 배열 아님은 거절, 시트는 안 건드림', () => {
  const env = fresh();
  const call = (p) => env.plain(env.ctx.importJandi(p));
  assert.strictEqual(call({ token: 'bad', messages: ['x'] }).reason, 'unauthorized');
  assert.strictEqual(call({ messages: ['x'] }).reason, 'unauthorized');
  assert.strictEqual(call({ token: 'tok', messages: [] }).reason, 'bad_request');
  assert.strictEqual(call({ token: 'tok', messages: 'x' }).reason, 'bad_request');
  assert.strictEqual(call({ token: 'tok', messages: new Array(501).fill('x') }).reason, 'too_many');
  assert.strictEqual(call({ token: 'tok', messages: ['x'], confirm: 'a' }).reason, 'bad_request');
  assert.strictEqual(call({ token: 'tok', messages: ['x'], confirm: new Array(501).fill({}) }).reason, 'too_many');
  assert.deepStrictEqual(env.writes, []);
});
test('importJandi: confirm 한 줄이 잘못돼도(열쇠 없음·알 수 없는 action) 그 줄만 error', () => {
  const env = fresh();
  const r = run(env, [{ key: '', action: 'basic' }, { key: K.basic, action: 'zzz' }, { action: 'close' }]);
  assert.deepStrictEqual(r.results.map((x) => x.status), ['error', 'error', 'error']);
  assert.strictEqual(r.counts.error, 3);
});

// ── 일반형 등록 ──
test('basic 등록: 직-일반 행 1줄(작성타입·상태·단가 70,000), 잠금 안에서 실행', () => {
  const env = fresh();
  const r = run(env, [{ key: K.basic, action: 'basic' }]);
  assert.strictEqual(r.success, true);
  assert.deepStrictEqual([r.results[0].status, r.counts.added], ['added', 1]);
  const rows = rowsOf(env, '신청 내역');
  assert.strictEqual(rows.length, 2);
  const row = rows[1];
  assert.deepStrictEqual([row[2], row[12], row[13], row[15]], ['하이스테이 성남4502(20917)', '직-일반', '신청완료', 70000]);
  assert.strictEqual(stampJ(row[1]), '2026-11-09 12:00');
  assert.strictEqual(stampJ(row[0]), '2026-11-09 12:00');
  assert.deepStrictEqual([env.locks, env.unlocks], [1, 1]);
});
test('멱등: 같은 호출을 두 번 보내면 둘째는 duplicate이고 행이 늘지 않는다', () => {
  const env = fresh();
  const req = [{ key: K.basic, action: 'basic' }, { key: K.billy, action: 'billy' }];
  const a = run(env, req);
  const before = [cnt(env, '신청 내역'), cnt(env, '부가상품 결제'), cnt(env, '잔디 수집 로그')];
  const b = run(env, req);
  assert.deepStrictEqual(a.results.map((x) => x.status), ['added', 'added']);
  assert.deepStrictEqual(b.results.map((x) => x.status), ['duplicate', 'duplicate']);
  assert.deepStrictEqual(
    [cnt(env, '신청 내역'), cnt(env, '부가상품 결제'), cnt(env, '잔디 수집 로그')], before);
  assert.deepStrictEqual(b.counts, { added: 0, duplicate: 2, closed: 0, skipped: 0, error: 0 });
});
test('같은 키 중복: 한 호출에 같은 요청이 두 번 와도 한 줄만 쓴다', () => {
  const env = fresh();
  const r = run(env, [{ key: K.basic, action: 'basic' }, { key: K.basic, action: 'basic' }]);
  assert.deepStrictEqual(r.results.map((x) => x.status), ['added', 'duplicate']);
  assert.strictEqual(cnt(env, '신청 내역'), 2);
});
test('이미 시트에 있는 일반형(같은 번호·같은 분)은 등록 요청해도 duplicate', () => {
  const env = makeEnv({ sheets: { '신청 내역': [APPLY_HEADER,
    appRow('직-일반', kstDate(2026, 11, 9, 12, 0), '하이스테이 성남4502(20917)')] } });
  const r = run(env, [{ key: K.basic, action: 'basic' }]);
  assert.strictEqual(r.results[0].status, 'duplicate');
  assert.strictEqual(cnt(env, '신청 내역'), 2);
});
test('고급형은 자동 등록 안 함(skipped, 전화번호 필요), 키가 목록에 없어도 skipped', () => {
  const env = fresh();
  const r = run(env, [{ key: K.prem, action: 'basic' }, { key: '99999_202601010000', action: 'basic' },
    { key: K.basic, action: 'billy' }]);
  assert.deepStrictEqual(r.results.map((x) => x.status), ['skipped', 'skipped', 'skipped']);
  assert.ok(/전화번호/.test(r.results[0].reason), r.results[0].reason);
  assert.strictEqual(cnt(env, '신청 내역'), 1);
});

// ── 빌리투어 ──
test('billy 등록: 탭 자동 생성(맨 뒤, 머리글 6칸), 금액 400,000, 상태 진행전, 상품 원문 그대로', () => {
  const env = fresh({ sheets: { '신청 내역': [APPLY_HEADER], '설정': [['x']] } });
  const r = run(env, [{ key: K.billy, action: 'billy' }]);
  assert.strictEqual(r.results[0].status, 'added');
  assert.strictEqual(env.book.sheets[env.book.sheets.length - 1].name, '잔디 수집 로그');
  assert.strictEqual(env.book.sheets[env.book.sheets.length - 2].name, '부가상품 결제');
  const rows = rowsOf(env, '부가상품 결제');
  assert.deepStrictEqual(rows[0], ['결제일시', '지점명', '지점번호', '상품', '금액', '상태']);
  assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows[1].slice(1), ['서울스테이', '20933', '빌리투어 (투어영상)', 400000, '진행전']);
  assert.strictEqual(stampJ(rows[1][0]), '2026-11-13 11:52');
  assert.strictEqual(cnt(env, '신청 내역'), 1, '신청 내역에는 빌리투어를 섞지 않는다');
});
test('한 글에 블로그+빌리투어(20975): 일반형은 신청 내역 1줄, 빌리투어는 부가상품 결제 탭에 조각만 1줄', () => {
  const env = fresh();
  const r = run(env, [{ key: K.combo2, action: 'basic' }, { key: K.combo2, action: 'billy' }]);
  assert.deepStrictEqual(r.results.map((x) => x.status), ['added', 'added']);
  const basic = rowsOf(env, '신청 내역')[1];
  assert.deepStrictEqual([basic[2], basic[12], basic[15]], ['마이스테이 강동점(20975)', '직-일반', 70000]);
  const billy = rowsOf(env, '부가상품 결제')[1];
  assert.deepStrictEqual([billy[3], billy[4]], ['빌리투어 (투어영상)', 400000]);
  assert.strictEqual(cnt(env, '부가상품 결제'), 2);
});
test('고급형+빌리투어(6610): 빌리투어만 등록되고 같은 열쇠의 고급형은 skipped', () => {
  const env = fresh();
  const r = run(env, [{ key: K.combo, action: 'billy' }, { key: K.combo, action: 'basic' }]);
  assert.deepStrictEqual(r.results.map((x) => x.status), ['added', 'skipped']);
  assert.strictEqual(cnt(env, '신청 내역'), 1);
  assert.strictEqual(cnt(env, '부가상품 결제'), 2);
});
test('빌리투어 중복 키(지점번호+결제일시 분): 탭에 이미 있으면 duplicate', () => {
  const env = fresh({ sheets: { '신청 내역': [APPLY_HEADER], '부가상품 결제': [
    ['결제일시', '지점명', '지점번호', '상품', '금액', '상태'],
    [kstDate(2026, 11, 13, 11, 52), '서울스테이', 20933, '빌리투어 (투어영상)', 400000, '진행전']] } });
  const r = run(env, [{ key: K.billy, action: 'billy' }]);
  assert.strictEqual(r.results[0].status, 'duplicate');
  assert.strictEqual(cnt(env, '부가상품 결제'), 2);
});

// ── 로그 탭·확인 없는 호출 ──
test('confirm 없는 호출: 신청 내역·부가상품 결제 행은 그대로, 확인필요·번호필요 7건만 로그에 남는다', () => {
  const env = fresh();
  const r = run(env, []);
  assert.deepStrictEqual(r.counts, { added: 0, duplicate: 0, closed: 0, skipped: 0, error: 0 });
  assert.strictEqual(r.logged, 7);
  assert.strictEqual(cnt(env, '신청 내역'), 1);
  assert.strictEqual(env.sheet('부가상품 결제'), null);
  assert.deepStrictEqual(rowsOf(env, '잔디 수집 로그')[0], ['수집일시', '키', '지점', '판정', '사유', '원문',
    '같은 글의 동반 상품', '메시지 결제금액', '종결일시']);
  const rows = logRows(env);
  assert.strictEqual(rows.length, 7);
  assert.strictEqual(rows.filter((x) => x[3] === '번호필요').length, 5);
  assert.strictEqual(rows.filter((x) => x[3] === '확인필요').length, 2);
  const combo = rows.find((x) => x[1] === K.combo);
  assert.deepStrictEqual([combo[2], combo[6], combo[7], combo[8]], ['더하우스 스테이', '빌리투어 (투어영상)', 766000, '']);
  assert.ok(combo[5].indexOf('[Web발신]') === 0 && combo[5].length <= 1000);
  assert.ok(rows.some((x) => /^X_[0-9a-f]{8}$/.test(x[1]) && x[3] === '확인필요'), '키 없는 수기 글에도 열쇠가 있다');
});
test('로그: 같은 키+같은 판정은 다시 쓰지 않는다(여러 번 호출해도 7건), 원문은 1,000자까지', () => {
  const env = fresh();
  run(env, []); run(env, []); run(env, [{ key: K.basic, action: 'basic' }]);
  assert.strictEqual(logRows(env).length, 7);
  const long = TEXTS[3] + '\n' + 'ㄱ'.repeat(3000);
  const e2 = fresh();
  run(e2, [], undefined, [long]);
  assert.strictEqual(logRows(e2)[0][5].length, 1000);
});
test('로그 원문이 = + - @ 로 시작해도 수식으로 읽히지 않는다(작은따옴표 접두)', () => {
  const env = fresh();
  run(env, [], undefined, ['@스티브\n' + TEXTS[2].replace('@스티브\n', '')]);
  const rows = logRows(env);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0][5][0], "'");
});

// ── 종결 ──
test('close: 로그 종결일시를 채우고 되풀이해도 같은 결과(closed), 줄이 늘지 않는다', () => {
  const env = fresh();
  run(env, []);
  const req = [{ key: K.prem, action: 'close' }];
  const a = run(env, req), n1 = logRows(env).length;
  const b = run(env, req);
  assert.deepStrictEqual([a.results[0].status, b.results[0].status, a.counts.closed], ['closed', 'closed', 1]);
  assert.strictEqual(logRows(env).length, n1);
  const row = logRows(env).find((x) => x[1] === K.prem);
  assert.ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(row[8]), row[8]);
});
test('close: 로그 탭이 아직 없어도 종결로 남고, 이 스캔의 나머지 확인필요·번호필요도 로그에 쌓인다', () => {
  const env = fresh();
  const r = run(env, [{ key: K.prem, action: 'close' }]);
  assert.strictEqual(r.results[0].status, 'closed');
  const rows = logRows(env);
  assert.strictEqual(rows.length, 7);
  assert.strictEqual(rows.filter((x) => x[8]).length, 1);
  assert.strictEqual(rows.find((x) => x[8])[1], K.prem);
});
test('close: 종결할 항목이 없는 열쇠는 skipped', () => {
  const env = fresh();
  const r = run(env, [{ key: K.basic, action: 'close' }, { key: 'nope', action: 'close' }]);
  assert.deepStrictEqual(r.results.map((x) => x.status), ['skipped', 'skipped']);
});
test('종결된 키는 previewJandi에서 class 유지 + closed:true + reason 종결됨, 다른 조각은 그대로', () => {
  const env = fresh();
  run(env, [{ key: K.prem, action: 'close' }]);
  const v = env.plain(env.ctx.previewJandi(TEXTS, 'tok'));
  const x = v.results.find((m) => m.branchNo === '20897');
  assert.strictEqual(x.class, 'blog_new');
  assert.strictEqual(x.pieces[0].closed, true);
  assert.ok(/종결됨/.test(x.pieces[0].reason) && /종결됨/.test(x.reason), x.reason);
  const others = [].concat(...v.results.map((m) => m.pieces)).filter((p) => p.closed);
  assert.strictEqual(others.length, 1);
  assert.strictEqual(v.counts.needPhone, 5, '종결해도 건수 분류는 그대로(화면이 숨김)');
});
test('확인필요 글(11221)을 읽은 값으로 빌리투어 등록하면 등록되고 그 확인필요는 종결된다', () => {
  const env = fresh();
  const r = run(env, [{ key: K.manualOk, action: 'billy' }]);
  assert.strictEqual(r.results[0].status, 'added');
  const row = rowsOf(env, '부가상품 결제')[1];
  assert.deepStrictEqual([row[2], row[4]], ['11221', 400000]);
  const lg = logRows(env).find((x) => x[1] === K.manualOk);
  assert.ok(lg && lg[8], '종결일시가 채워진다');
  const again = run(env, [{ key: K.manualOk, action: 'billy' }]);
  assert.strictEqual(again.results[0].status, 'duplicate');
  assert.strictEqual(cnt(env, '부가상품 결제'), 2);
});

// ── 스캔 기록 ──
test('불완전 스캔(complete:false·aborted 있음·scan 없음)은 JANDI_LAST_SCAN을 갱신하지 않는다', () => {
  const env = fresh();
  assert.strictEqual(run(env, [], { complete: false, reachedTop: false, aborted: '' }).lastScan, null);
  assert.strictEqual(run(env, [], { complete: true, aborted: 'timeout' }).lastScan, null);
  assert.strictEqual(run(env, [], { complete: 'yes' }).lastScan, null);
  assert.strictEqual(run(env, []).lastScan, null);
  assert.ok(!('JANDI_LAST_SCAN' in env.props));
});
test('완전 스캔은 JANDI_LAST_SCAN에 at(ISO)·oldestAt·newestId 저장, 이후 불완전 스캔은 그대로 둔다', () => {
  const env = fresh();
  const r = run(env, [], { complete: true, reachedTop: true, aborted: '', total: 171, newestId: '5165202316',
    oldestId: '5125384030', oldestAt: '2026-10-29 16:23' });
  assert.strictEqual(r.lastScan.complete, true);
  assert.ok(!isNaN(Date.parse(r.lastScan.at)));
  const saved = JSON.parse(env.props.JANDI_LAST_SCAN);
  assert.deepStrictEqual([saved.oldestAt, saved.newestId], ['2026-10-29 16:23', '5165202316']);
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(saved.at));
  const before = env.props.JANDI_LAST_SCAN;
  const r2 = run(env, [], { complete: false, aborted: 'timeout' });
  assert.strictEqual(env.props.JANDI_LAST_SCAN, before);
  assert.strictEqual(r2.lastScan.at, saved.at);
});

// ── previewJandi: 읽기 전용 + 회귀 점검 ──
test('previewJandi는 읽기 전용: 로그·부가상품 탭이 있어도 쓰기 호출이 하나도 없다(쓰면 에러)', () => {
  const env = makeEnv({ readOnly: true, sheets: {
    '신청 내역': [APPLY_HEADER, appRow('직-일반', kstDate(2026, 11, 9, 12, 0), '하이스테이 성남4502(20917)')],
    '부가상품 결제': [['결제일시', '지점명', '지점번호', '상품', '금액', '상태']],
    '잔디 수집 로그': [['수집일시', '키', '지점', '판정', '사유', '원문', '동반', '금액', '종결일시'],
      ['2026-11-24 10:00', K.prem, '휴식 교대점', '번호필요', 'x', 'raw', '', 560400, '']] } });
  const v = env.plain(env.ctx.previewJandi(TEXTS, 'tok'));
  assert.strictEqual(v.success, true);
  assert.deepStrictEqual(env.writes, []);
  assert.strictEqual(v.counts.known, 1);
});
test('previewJandi 회귀: 로그에 있던 키가 이번 범위 안인데 글 목록에 없으면 missing, 더 오래된 키·로그 없음은 제외', () => {
  const header = ['수집일시', '키', '지점', '판정', '사유', '원문', '동반', '금액', '종결일시'];
  const env = makeEnv({ sheets: { '신청 내역': [APPLY_HEADER], '잔디 수집 로그': [header,
    ['t', '20990_202611231101', '우리고시텔 신림역점', '확인필요', '', '', '', '', ''],
    ['t', '99999_202611201000', '사라진 지점', '번호필요', '', '', '', '', ''],
    ['t', '99999_202611201000', '사라진 지점', '확인필요', '', '', '', '', ''],
    ['t', '88888_202611151000', '이번 범위보다 옛 지점', '번호필요', '', '', '', '', ''],
    ['t', 'X_0badc0de', '수기 글', '확인필요', '', '', '', '', '']] } });
  const batch = [TEXTS[18], TEXTS[19], TEXTS[16]]; // 16861 11.23 11:12, 20990 11.23 11:01, 20973 11.18 09:56
  const v = env.plain(env.ctx.previewJandi(batch, 'tok'));
  assert.deepStrictEqual(v.regression, { missing: [{ key: '99999_202611201000', branch: '사라진 지점',
    paidAt: '2026-11-20 10:00' }] });
  const none = makeEnv({ sheets: { '신청 내역': [APPLY_HEADER] } });
  assert.deepStrictEqual(none.plain(none.ctx.previewJandi(batch, 'tok')).regression, { missing: [] });
});

// ── listStatus ──
test('listStatus: 기존 items·truncated·build 필드는 그대로, billy 배열과 lastScan이 더해진다', () => {
  const env = makeEnv({ sheets: {
    '신청 내역': [APPLY_HEADER,
      appRow('직-일반', kstDate(2026, 11, 9, 12, 0), '하이스테이 성남4502(20917)', '', '작성완료', 70000)],
    '부가상품 결제': [['결제일시', '지점명', '지점번호', '상품', '금액', '상태'],
      [kstDate(2026, 11, 3, 15, 35), '스테이플러스', 20906, '빌리투어 (투어영상)', 400000, '진행전'],
      [kstDate(2026, 11, 13, 11, 52), '서울스테이', 20933, '빌리투어 (투어영상)', 400000, '진행전']] },
  props: { JANDI_LAST_SCAN: JSON.stringify({ at: '2026-11-24T05:00:00.000Z', oldestAt: 'x', newestId: 'y' }) } });
  const r = env.plain(env.ctx.listStatus('tok'));
  assert.deepStrictEqual(Object.keys(r), ['success', 'items', 'truncated', 'build', 'billy', 'lastScan']);
  assert.deepStrictEqual(r.items, [{ kind: '일반형', label: '하이스테이 성남4502(20917)',
    paidAt: '2026-11-09 12:00', stage: 'basic_done', price: 70000, row: 2 }]);
  assert.deepStrictEqual([r.success, r.truncated], [true, false]);
  assert.deepStrictEqual(r.billy, [
    { paidAt: '2026-11-13 11:52', branch: '서울스테이', branchNo: '20933', product: '빌리투어 (투어영상)',
      amount: 400000, status: '진행전' },
    { paidAt: '2026-11-03 15:35', branch: '스테이플러스', branchNo: '20906', product: '빌리투어 (투어영상)',
      amount: 400000, status: '진행전' }]);
  assert.deepStrictEqual(r.lastScan, { at: '2026-11-24T05:00:00.000Z', complete: true });
});
test('listStatus: 부가상품 탭·스캔 기록이 없으면 billy [] · lastScan null, 잘못된 토큰 응답은 그대로', () => {
  const env = fresh();
  const r = env.plain(env.ctx.listStatus('tok'));
  assert.deepStrictEqual([r.billy, r.lastScan, r.items], [[], null, []]);
  const bad = env.plain(env.ctx.listStatus('x'));
  assert.deepStrictEqual(bad, { success: false, reason: 'unauthorized', build: env.ctx.BUILD });
  assert.deepStrictEqual(env.writes, []);
});
test('BUILD 값과 배포 bat의 findstr 값이 같다', () => {
  const env = fresh();
  const bat = fs.readFileSync(path.join(ROOT, 'GAS 배포 (딸깍).bat'), 'utf8');
  assert.ok(bat.indexOf('findstr /c:"' + env.ctx.BUILD + '"') >= 0, env.ctx.BUILD);
  assert.notStrictEqual(env.ctx.BUILD, '2026-11-23-pending2');
});

// ── doPost 연결·붙여넣기 등록 불변 ──
test('doPost: importJandi·previewJandi·listStatus 분기가 이어진다(기존 checkToken 유지)', () => {
  const env = fresh();
  const post = (o) => JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(o) } }).content);
  assert.strictEqual(post({ action: 'importJandi', token: 'tok', messages: TEXTS.slice(4, 5),
    confirm: [{ key: K.basic, action: 'basic' }] }).counts.added, 1);
  assert.strictEqual(post({ action: 'previewJandi', token: 'tok', messages: TEXTS.slice(4, 5) }).counts.known, 1);
  assert.strictEqual(post({ action: 'listStatus', token: 'tok' }).items.length, 1);
  assert.strictEqual(post({ action: 'checkToken', token: 'tok' }).success, true);
  assert.strictEqual(post({ action: 'importJandi', token: 'no', messages: ['x'] }).reason, 'unauthorized');
  assert.ok(/Unknown action/.test(post({ action: 'nope' }).error));
});
test('registerPayment(붙여넣기)는 그대로: 일반형 등록·중복·고급형 번호필요·알림 아님', () => {
  const env = fresh();
  const alert = TEXTS[6]; // 머문스테이 오산역점(20919) 일반형
  const a = env.plain(env.ctx.registerPayment(alert, 'tok'));
  assert.deepStrictEqual(a.results.map((x) => [x.status, x.branch, x.paidAt]),
    [['added', '머문스테이 오산역점(20919)', '2026-11-09 16:05']]);
  const row = rowsOf(env, '신청 내역')[1];
  assert.deepStrictEqual([row[12], row[13], row[15]], ['직-일반', '신청완료', 70000]);
  assert.strictEqual(env.plain(env.ctx.registerPayment(alert, 'tok')).results[0].status, 'duplicate');
  const prem = env.plain(env.ctx.registerPayment(TEXTS[3], 'tok')).results[0];
  assert.deepStrictEqual([prem.status, prem.branchNo], ['premium_need_phone', '20897']);
  assert.strictEqual(env.plain(env.ctx.registerPayment('잡담', 'tok')).reason, 'no_alert');
  assert.strictEqual(env.plain(env.ctx.registerPayment(alert, 'bad')).reason, 'unauthorized');
  assert.strictEqual(cnt(env, '신청 내역'), 2);
});
test('일반형 중복 확인은 최근 200행이 아니라 2,000행까지 본다', () => {
  const rows = [APPLY_HEADER, appRow('직-일반', kstDate(2026, 11, 9, 16, 5), '머문스테이 오산역점(20919)')];
  for (let i = 0; i < 500; i++) rows.push(appRow('A', kstDate(2026, 11, 10, 9, 0), '옛 폼 ' + i));
  const env = makeEnv({ sheets: { '신청 내역': rows } });
  const r = env.plain(env.ctx.registerPayment(TEXTS[6], 'tok'));
  assert.strictEqual(r.results[0].status, 'duplicate');
  assert.strictEqual(cnt(env, '신청 내역'), 502);
});

console.log('\n통과 ' + pass + ' / 실패 ' + failures.length + ' / 전체 ' + (pass + failures.length));
if (failures.length) {
  console.log('실패: ' + failures.join(' | '));
  process.exit(1);
}
