// 실행: node tests/jandi-classify.test.js (addon-direct-pay 폴더에서)
// 시험 자료 2종류:
//  - 실제 원문: tests/fixtures/jandi-real-partial.json (11.24 잔디 읽기에서 대화 기록에 남은 2건뿐)
//  - 합성: 아래 SYNTH_*. 실제 21건 원문이 아니라 "14 이미 있음(시트 13 + PF 1) / 번호필요 0 / 빌리투어 8 / 대상 아님 1"
//    구조를 실제 원문 형식으로 흉내 낸 것이다. 실제 21건 시험은 원문 파일(jandi-21.json)을 구하면 같은 시험을 돌린다.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const J = require('../js/jandi-classify.js');
const REAL = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/jandi-real-partial.json'), 'utf8'));

let pass = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { failures.push(name); console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n')[0]); }
}

// 실제 원문과 같은 형식(결제방법·먼슬리플랜 줄 포함)으로 글을 만든다
function msg(branch, no, paid, items, amount, opt) {
  const o = opt || {};
  return [
    '[Web발신]', '[상품 결제완료]', branch + '(' + no + ')', '결제방법: 카드결제',
    '결제상품: ', ...(o.plan === false ? [] : ['- [베이직] 먼슬리플랜 - 3개월']),
    ...items.map((x) => '- ' + x), '결제금액: ' + amount.toLocaleString('en-US') + '원',
    '등록일시: ' + paid, '결제일시: ' + paid + (o.suffix === false ? '' : '[M1]')
  ].join('\n');
}
const stamp = (yymmdd, hhmm) => '20' + yymmdd.replace(/\./g, '-') + ' ' + hhmm;

// ── 합성 21건 (실제 21건 구조 흉내) ──
const BASIC = [
  ['20001', '26.10.29', '09:10'], ['20002', '26.11.02', '14:20'], ['20003', '26.11.09', '10:05'],
  ['20004', '26.11.09', '11:40'], ['20005', '26.11.10', '16:30'], ['20006', '26.11.16', '13:00'],
  ['20007', '26.11.18', '09:55']
];
const COMBO = [['20008', '26.11.12', '10:30'], ['20009', '26.11.20', '15:15']];
const PREM = [
  ['20010', '26.11.09', '12:00', '직B', '2026-11-12 09:00'], // 폼 제출은 결제 3일 뒤
  ['20011', '26.11.16', '12:10', '직B', '2026-11-19 18:20'],
  ['20012', '26.11.21', '10:10', '직-대기', '2026-11-21 10:10'],
  ['20013', '26.11.23', '11:12', '직-대기', '2026-11-23 11:12']
];
const BILLY = [
  ['20021', '26.11.03', '10:00'], ['20022', '26.11.06', '11:00'], ['20023', '26.11.11', '12:00'],
  ['20024', '26.11.13', '13:00'], ['20025', '26.11.17', '14:00'], ['20026', '26.11.23', '15:00']
];
const SYNTH_MESSAGES = [];
const SYNTH_EXISTING = [];
BASIC.forEach(([no, d, t]) => {
  SYNTH_MESSAGES.push(msg('고시원' + no, no, d + ' ' + t, ['블로그 일반형'], 286000));
  SYNTH_EXISTING.push({ type: '직-일반', no, paidAt: stamp(d, t) });
});
COMBO.forEach(([no, d, t]) => {
  SYNTH_MESSAGES.push(msg('고시원' + no, no, d + ' ' + t, ['블로그 일반형, 빌리투어 (투어영상)'], 756000));
  SYNTH_EXISTING.push({ type: '직-일반', no, paidAt: stamp(d, t) });
});
PREM.forEach(([no, d, t, type, rowAt]) => {
  SYNTH_MESSAGES.push(msg('고시원' + no, no, d + ' ' + t, ['블로그 고급형'], 336000));
  SYNTH_EXISTING.push({ type, no, paidAt: rowAt });
});
SYNTH_MESSAGES.push(msg('휴식 교대점', '20897', '26.11.06 10:01', ['블로그 고급형'], 560400));
// 20897은 시트 행 없이 알림톡 발송 기록(PF_20897_202611061001)만 있는 옛 건이다(지점명 없음)
SYNTH_EXISTING.push({ type: 'PF', no: '20897', paidAt: '2026-11-06 10:01' });
BILLY.forEach(([no, d, t], i) => {
  SYNTH_MESSAGES.push(msg('고시원' + no, no, d + ' ' + t,
    [i === 2 ? '빌리투어 (영상, 사진)' : '빌리투어 (투어영상)'], 756000));
});
SYNTH_MESSAGES.push(msg('고시원29999', '29999', '26.11.04 10:00', ['- [프라임] 먼슬리플랜 - 3개월'
  .replace('- ', '')], 286000, { plan: false }));

const cls = (r) => r.results.map((x) => x.class);

// ── 실제 원문 2건 ──
test('실제 원문 2건: 형식 읽기(지점·번호·결제일시·금액·상품, 먼슬리플랜 줄은 상품이 아님)', () => {
  assert.strictEqual(REAL.messages.length, 2);
  const r = J.classifyMessages(REAL.messages, []);
  const a = r.results[0], b = r.results[1];
  assert.deepStrictEqual(
    [a.branch, a.branchNo, a.paidAt, a.amount, a.product, a.class],
    ['이레고시원(이레하우스)', '16861', '2026-11-23 11:12', 336000, '블로그 고급형', 'blog_new']);
  assert.deepStrictEqual(
    [b.branch, b.branchNo, b.paidAt, b.amount, b.product, b.class],
    ['우리고시텔 신림역점', '20990', '2026-11-23 11:01', 286000, '블로그 일반형', 'blog_new']);
  assert.strictEqual(a.pieces.length, 1);
  assert.strictEqual(a.pieces[0].status, '번호필요');
  assert.strictEqual(b.pieces[0].status, '새로등록');
});
test('실제 원문 2건: 시트에 있으면 이미 있음(직-대기·직-일반)', () => {
  const r = J.classifyMessages(REAL.messages, [
    { type: '직-대기', no: '16861', paidAt: '2026-11-23 11:12' },
    { type: '직-일반', no: '20990', paidAt: '2026-11-23 11:01:00' }
  ]);
  assert.deepStrictEqual(cls(r), ['blog_known', 'blog_known']);
});

// ── 합성 21건: 기대 구조 ──
test('합성 21건: 글 21 · 조각 23(쉼표 붙은 2건이 둘로 갈림)', () => {
  assert.strictEqual(SYNTH_MESSAGES.length, 21);
  const c = J.classifyMessages(SYNTH_MESSAGES, SYNTH_EXISTING).counts;
  assert.strictEqual(c.messages, 21);
  assert.strictEqual(c.pieces, 23);
  assert.strictEqual(c.splitExtra, 2);
});
test('합성 21건: 이미 있음 14(시트 13 + PF 1) · 번호필요 0 · 새로등록 0 · 빌리투어 8 · 확인필요 0 · 대상아님 1', () => {
  const c = J.classifyMessages(SYNTH_MESSAGES, SYNTH_EXISTING).counts;
  assert.deepStrictEqual(
    [c.known, c.newBasic, c.needPhone, c.billy, c.review, c.notTarget, c.guide, c.chat],
    [14, 0, 0, 8, 0, 1, 0, 0]);
  assert.strictEqual(c.sumOk, true);
});
test('합성 21건: 합계 점검 21 = 14+0+0+8+0+1 - 2', () => {
  const c = J.classifyMessages(SYNTH_MESSAGES, SYNTH_EXISTING).counts;
  assert.strictEqual(c.known + c.newBasic + c.needPhone + c.billy + c.review + c.notTarget - c.splitExtra,
    c.messages);
});
test('합성 21건: 20897은 PF 발송 기록으로 blog_known(이미 있음), 번호 필요가 아님', () => {
  const r = J.classifyMessages(SYNTH_MESSAGES, SYNTH_EXISTING);
  const x = r.results.find((m) => m.branchNo === '20897');
  assert.strictEqual(x.class, 'blog_known');
  assert.strictEqual(x.paidAt, '2026-11-06 10:01');
  assert.strictEqual(x.amount, 560400);
  assert.strictEqual(x.pieces[0].status, '이미있음');
  assert.ok(!x.pieces[0].needPhone);
  assert.ok(/알림톡 발송 기록/.test(x.reason), x.reason);
});
test('PF 기록이 없는 고급형(가상 지점 40001)은 blog_new + 번호필요, reason에 전화번호 필요·시트에 없음', () => {
  const m = msg('가상고시원', '40001', '26.11.06 10:01', ['블로그 고급형'], 560400);
  const r = J.classifyMessages([m], SYNTH_EXISTING);
  const x = r.results[0];
  assert.strictEqual(x.class, 'blog_new');
  assert.strictEqual(x.pieces[0].status, '번호필요');
  assert.strictEqual(x.pieces[0].needPhone, true);
  assert.ok(/전화번호가 필요한 고급형/.test(x.reason) && /이 지점이 없어요/.test(x.reason), x.reason);
  assert.strictEqual(r.counts.needPhone, 1);
});
test('합성 21건에서 PF를 빼면 20897이 번호필요 1건이 된다(대조 증거)', () => {
  const ex = SYNTH_EXISTING.filter((e) => e.type !== 'PF');
  const c = J.classifyMessages(SYNTH_MESSAGES, ex).counts;
  assert.deepStrictEqual([c.known, c.needPhone], [13, 1]);
});
test('PF만 있고 지점명이 비어 있어도(name 없음·빈 값·null) 분류가 깨지지 않는다', () => {
  const m = msg('휴식 교대점', '20897', '26.11.06 10:01', ['블로그 고급형'], 560400);
  [{}, { name: '' }, { name: null }, { branch: undefined }].forEach((extra) => {
    const pf = Object.assign({ type: 'PF', no: '20897', paidAt: '2026-11-06 10:01' }, extra);
    const x = J.classifyMessages([m], [pf]).results[0];
    assert.strictEqual(x.pieces[0].status, '이미있음');
  });
  // PF의 결제일시가 1분 어긋나면 같은 건이 아니다
  const off = J.classifyMessages([m], [{ type: 'PF', no: '20897', paidAt: '2026-11-06 10:02' }]);
  assert.strictEqual(off.results[0].pieces[0].status, '번호필요');
});
test('합성 21건: 쉼표로 붙은 글은 blog_billy, 조각은 블로그(이미 있음)+빌리투어', () => {
  const r = J.classifyMessages(SYNTH_MESSAGES, SYNTH_EXISTING);
  const x = r.results.find((m) => m.branchNo === '20008');
  assert.strictEqual(x.class, 'blog_billy');
  assert.deepStrictEqual(x.pieces.map((p) => p.class), ['blog_known', 'billy']);
  assert.strictEqual(x.pieces[1].option, '투어영상');
});
test('합성 21건: 괄호 안 쉼표는 한 조각(빌리투어 (영상, 사진))', () => {
  const r = J.classifyMessages(SYNTH_MESSAGES, SYNTH_EXISTING);
  const x = r.results.find((m) => m.branchNo === '20023');
  assert.strictEqual(x.pieces.length, 1);
  assert.strictEqual(x.pieces[0].option, '영상, 사진');
  assert.strictEqual(x.class, 'billy');
});
test('합성 21건: 대상 아님은 숨기지 않고 상품 문구를 남긴다', () => {
  const r = J.classifyMessages(SYNTH_MESSAGES, SYNTH_EXISTING);
  const x = r.results.find((m) => m.branchNo === '29999');
  assert.strictEqual(x.class, 'ignore');
  assert.strictEqual(x.pieces[0].status, '대상아님');
  assert.ok(x.pieces[0].product.indexOf('먼슬리플랜') >= 0);
});
test('합성 21건: 시트가 비어 있으면 일반형 9는 새로등록, 고급형 5는 번호필요', () => {
  const c = J.classifyMessages(SYNTH_MESSAGES, []).counts;
  assert.deepStrictEqual([c.known, c.newBasic, c.needPhone], [0, 9, 5]);
});

// ── 오타·형식 변형: 조용히 버리지 않고 확인 필요로 ──
function review(text, expectIn) {
  const r = J.classifyMessages([text], []);
  const x = r.results[0];
  assert.strictEqual(x.class, 'needs_review', JSON.stringify(x));
  assert.strictEqual(r.counts.review, 1);
  assert.strictEqual(r.counts.sumOk, true);
  if (expectIn) assert.ok(x.reason.indexOf(expectIn) >= 0, x.reason);
  return x;
}
const GOOD = msg('우리고시텔', '20990', '26.11.23 11:01', ['블로그 일반형'], 286000);
test('오타 결재완료 -> needs_review, 느슨하게 읽은 값 표시', () => {
  const x = review(GOOD.replace('결제완료', '결재완료'), '[상품 결제완료] 줄이 달라요');
  assert.deepStrictEqual([x.branchNo, x.paidAt, x.product], ['20990', '2026-11-23 11:01', '블로그 일반형']);
});
test('공백 변형 [상품 결 제 완 료] -> needs_review', () => {
  review(GOOD.replace('결제완료', '결 제 완 료'));
});
test('공백 변형 "결제 일시:" -> needs_review', () => review(GOOD.replace('결제일시:', '결제 일시:'), '결제일시 형식'));
test('오타 결제금액 -> 결재금액 -> needs_review', () => review(GOOD.replace('결제금액', '결재금액')));
test('상품 오타 블로그 일반(형 빠짐) -> needs_review', () => {
  review(msg('우리고시텔', '20990', '26.11.23 11:01', ['블로그 일반'], 286000), '비슷한데 달라요');
});
test('상품 오타 블러그 일반형 -> needs_review', () => {
  review(msg('우리고시텔', '20990', '26.11.23 11:01', ['블러그 일반형'], 286000));
});
test('쉼표 조각 중 하나만 오타(블로그 일반형, 빌리투 (투어영상)) -> 정상 조각은 두고 오타만 확인 필요', () => {
  const r = J.classifyMessages(
    [msg('우리고시텔', '20990', '26.11.23 11:01', ['블로그 일반형, 빌리투 (투어영상)'], 286000)], []);
  assert.deepStrictEqual(r.results[0].pieces.map((p) => p.status), ['새로등록', '확인필요']);
  assert.strictEqual(r.counts.review, 1);
});
test('달력에 없는 날짜(26.02.30) -> needs_review', () => {
  review(GOOD.replace('26.11.23 11:01[M1]', '26.02.30 11:01'), '달력에 없는');
});
test('시각 범위 밖(25:61) -> needs_review', () => {
  review(GOOD.replace('26.11.23 11:01[M1]', '26.11.23 25:61'));
});
test('지점 번호 없음 -> needs_review, 못 읽은 항목에 지점 번호', () => {
  review(GOOD.replace('(20990)', ''), '지점 번호');
});
test('앞에 다른 글이 붙은 진짜 알림(NF운영 09:47 + 원문) -> 안내 글이 아니라 needs_review', () => {
  const x = review('NF운영 09:47\n' + GOOD, '[Web발신]으로 시작하지 않아요');
  assert.strictEqual(x.pieces[0].branchNo, '20990');
});
test('전각 숫자·콜론으로 고쳐 올린 글 -> needs_review로 읽힘', () => {
  const x = review(GOOD.replace('20990', '２０９９０').replace('결제일시: 26.11.23 11:01', '결제일시： 26.11.23 11:01'));
  assert.strictEqual(x.branchNo, '20990');
});

// ── 안내 글·잡담 ──
test('안내 글(양식 인용, 자리표시) -> ignore 안내글, 확인 필요에 넣지 않음', () => {
  const guide = '[Web발신]\n[상품 결제완료]\n지점명(지점번호)\n결제방법: 카드결제\n결제상품: \n- 블로그 일반형\n' +
    '결제금액: 0원\n결제일시: yy.mm.dd HH:mm';
  const r = J.classifyMessages([guide], []);
  assert.strictEqual(r.results[0].class, 'ignore');
  assert.strictEqual(r.counts.guide, 1);
  assert.strictEqual(r.counts.review, 0);
});
test('안내 글(Web발신 없이 OOO 자리표시) -> 안내글', () => {
  const guide = '아래처럼 올려 주세요\n[상품 결제완료]\nOOO(000)\n결제상품: \n- 블로그 일반형\n' +
    '결제금액: 0원\n결제일시: 00.00.00 00:00';
  assert.strictEqual(J.classifyMessages([guide], []).counts.guide, 1);
});
test('잡담은 후보가 되지 않는다(확인 필요 도배 방지)', () => {
  const r = J.classifyMessages(['내일 회의 몇 시에 하죠?', '블로그 확인했어요', '', '결제 많이 들어오네요 ㅎㅎ'], []);
  assert.deepStrictEqual(r.counts.chat, 4);
  assert.strictEqual(r.counts.review, 0);
});

// ── 시트 대조 규칙 ──
function prem(no, paid) { return msg('고시원' + no, no, paid, ['블로그 고급형'], 336000); }
test('고급형 직A/직B 1:1: 같은 지점이 두 번 결제해도 폼 행 하나로 둘이 덮이지 않는다', () => {
  const r = J.classifyMessages(
    [prem('30001', '26.11.01 10:00'), prem('30001', '26.11.10 10:00')],
    [{ type: '직B', no: '30001', paidAt: '2026-11-12 10:00' }]);
  assert.deepStrictEqual(r.results.map((x) => x.pieces[0].status), ['이미있음', '번호필요']);
});
test('고급형 직B 행이 결제 뒤 14일을 넘기면 번호필요 + 같은 지점 행 있음(차이 N일)', () => {
  const r = J.classifyMessages([prem('30002', '26.11.01 10:00')],
    [{ type: '직B', no: '30002', paidAt: '2026-11-21 10:00' }]);
  assert.strictEqual(r.results[0].pieces[0].status, '번호필요');
  assert.ok(/같은 지점 직B 행 있음\(차이 20일\)/.test(r.results[0].reason), r.results[0].reason);
});
test('고급형 결제보다 이른 직A 행은 짝이 아니다', () => {
  const r = J.classifyMessages([prem('30003', '26.11.10 10:00')],
    [{ type: '직A', no: '30003', paidAt: '2026-11-05 10:00' }]);
  assert.strictEqual(r.results[0].pieces[0].status, '번호필요');
});
test('고급형 알림톡 발송 기록(PF)이 있으면 이미 있음', () => {
  const r = J.classifyMessages([prem('30004', '26.11.10 10:00')],
    [{ type: 'PF', no: '30004', paidAt: '2026-11-10 10:00' }]);
  assert.strictEqual(r.results[0].pieces[0].status, '이미있음');
});
test('결제일시가 1분 다르면 같은 건이 아니다(일반형)', () => {
  const m = msg('고시원', '30005', '26.11.10 10:01', ['블로그 일반형'], 286000);
  const r = J.classifyMessages([m], [{ type: '직-일반', no: '30005', paidAt: '2026-11-10 10:00' }]);
  assert.strictEqual(r.results[0].pieces[0].status, '새로등록');
});
test('다른 지점번호는 같은 분이어도 같은 건이 아니다', () => {
  const m = msg('고시원', '30006', '26.11.10 10:00', ['블로그 일반형'], 286000);
  const r = J.classifyMessages([m], [{ type: '직-일반', no: '99999', paidAt: '2026-11-10 10:00' }]);
  assert.strictEqual(r.results[0].pieces[0].status, '새로등록');
});
test('같은 글이 두 번 들어오면 둘째는 중복으로 세고 합계는 맞는다', () => {
  const m = msg('고시원', '30007', '26.11.10 10:00', ['블로그 일반형'], 286000);
  const r = J.classifyMessages([m, m], []);
  assert.deepStrictEqual([r.counts.newBasic, r.counts.dupInBatch, r.counts.sumOk], [1, 1, true]);
});
test('빌리투어가 부가상품 결제 탭에 이미 있으면 exists 표시(분류는 billy 그대로)', () => {
  const m = msg('고시원', '30008', '26.11.10 10:00', ['빌리투어 (투어영상)'], 756000);
  const r = J.classifyMessages([m], [{ type: 'billy', no: '30008', paidAt: '2026-11-10 10:00' }]);
  assert.strictEqual(r.results[0].class, 'billy');
  assert.strictEqual(r.counts.billyExists, 1);
});
test('플랜 줄 없이 상품만 있는데 결제금액이 단가 합과 다르면 경고만 붙고 분류는 그대로', () => {
  const m = msg('고시원', '30009', '26.11.10 10:00', ['블로그 일반형'], 99000, { plan: false });
  const x = J.classifyMessages([m], []).results[0];
  assert.strictEqual(x.class, 'blog_new');
  assert.ok(x.pieces[0].warnings.length === 1 && /단가 합/.test(x.pieces[0].warnings[0]));
});
test('splitTopLevel: 괄호 밖 쉼표만 나눈다', () => {
  assert.deepStrictEqual(J.splitTopLevel('블로그 일반형, 빌리투어 (영상, 사진)'),
    ['블로그 일반형', '빌리투어 (영상, 사진)']);
  assert.deepStrictEqual(J.splitTopLevel('[베이직] 먼슬리플랜 - 3개월'), ['[베이직] 먼슬리플랜 - 3개월']);
});
test('빈 입력·글 아닌 값도 던지지 않는다', () => {
  const r = J.classifyMessages([null, undefined, 123, { text: GOOD }, ''], []);
  assert.strictEqual(r.counts.messages, 5);
  assert.strictEqual(r.counts.sumOk, true);
  assert.strictEqual(J.classifyMessages(undefined, undefined).counts.messages, 0);
});

// ── 실제 원문 22건 (슬라이스 1 읽기 시험, 잔디 방 실제 글 그대로, existing=[]) ──
const REAL22 = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/jandi-real-22.json'), 'utf8'));
const R22_TEXTS = REAL22.map((m) => m.text);
const byId = (r, id) => r.results[REAL22.findIndex((m) => m.id === id)];
const noList = (r, status) => [].concat(...r.results.map((x) => x.pieces))
  .filter((p) => p.status === status).map((p) => p.branchNo);

test('실제 22건: 건수(대상아님 1·새로등록 9·번호필요 5·빌리투어 7·확인필요 2·잡담 0)와 합계 점검', () => {
  assert.strictEqual(REAL22.length, 22);
  const c = J.classifyMessages(R22_TEXTS, []).counts;
  assert.deepStrictEqual(
    [c.messages, c.pieces, c.splitExtra, c.known, c.newBasic, c.needPhone, c.billy, c.review,
      c.notTarget, c.guide, c.chat, c.dupInBatch],
    [22, 24, 2, 0, 9, 5, 7, 2, 1, 0, 0, 0]);
  assert.strictEqual(c.sumOk, true);
  assert.strictEqual(c.known + c.newBasic + c.needPhone + c.billy + c.review + c.notTarget -
    c.splitExtra, c.messages);
});
test('실제 22건: 번호필요 5곳, 빌리투어 7곳, 확인필요 2곳이 맞다', () => {
  const r = J.classifyMessages(R22_TEXTS, []);
  assert.strictEqual(noList(r, '번호필요').sort().join(), ['16861', '17169', '20897', '20973', '6610'].join());
  assert.strictEqual(noList(r, '빌리투어쌓기').sort().join(),
    ['11453', '20904', '20906', '20933', '20962', '20975', '6610'].join());
  assert.strictEqual(noList(r, '확인필요').sort().join(), ['11221', '20803'].join());
  assert.strictEqual(noList(r, '새로등록').length, 9);
});
test('실제 22건: 쉼표로 붙은 6610·20975는 blog_billy로 둘로 갈린다', () => {
  const r = J.classifyMessages(R22_TEXTS, []);
  const a = byId(r, '5148302786'), b = byId(r, '5165202316');
  assert.deepStrictEqual([a.branchNo, a.class, b.branchNo, b.class], ['6610', 'blog_billy', '20975', 'blog_billy']);
  assert.deepStrictEqual(a.pieces.map((p) => p.status), ['번호필요', '빌리투어쌓기']);
  assert.deepStrictEqual(b.pieces.map((p) => p.status), ['새로등록', '빌리투어쌓기']);
});
test('실제 22건: NBSP가 낀 20933은 정상 파싱(빌리투어쌓기, 결제일시 11.13 11:52)', () => {
  const m = REAL22.find((x) => x.id === '5150511116');
  assert.ok(m.text.indexOf(' ') >= 0, 'NBSP가 있는 글이어야 한다');
  const x = byId(J.classifyMessages(R22_TEXTS, []), '5150511116');
  assert.deepStrictEqual(
    [x.branchNo, x.branch, x.paidAt, x.amount, x.class, x.pieces[0].status, x.pieces[0].option],
    ['20933', '서울스테이', '2026-11-13 11:52', 616000, 'billy', '빌리투어쌓기', '투어영상']);
});
test('실제 22건: 20885 직접입력은 대상아님(상품 문구를 남김), 20897 고급형 결제일시 10:01', () => {
  const r = J.classifyMessages(R22_TEXTS, []);
  const a = byId(r, '5125384030');
  assert.deepStrictEqual([a.pieces[0].status, a.pieces[0].product], ['대상아님', '[프라임] 직접입력']);
  const b = byId(r, '5138229607');
  assert.deepStrictEqual([b.branch, b.paidAt, b.amount, b.pieces[0].status],
    ['휴식 교대점', '2026-11-06 10:01', 560400, '번호필요']);
});
test('실제 22건: 11221(앞에 @스티브·NBSP)은 확인필요, 빌리투어로 읽히고 자동 등록 안 함', () => {
  const x = byId(J.classifyMessages(R22_TEXTS, []), '5134633720');
  assert.strictEqual(x.class, 'needs_review');
  assert.deepStrictEqual([x.branchNo, x.paidAt, x.pieces[0].kind], ['11221', '2026-11-04 15:35', 'billy']);
  assert.ok(/\[Web발신\]으로 시작하지 않아요/.test(x.reason), x.reason);
});
test('실제 22건: 사람이 쓴 빌리투어 결제 안내(20803)는 잡담이 아니라 확인필요', () => {
  const x = byId(J.classifyMessages(R22_TEXTS, []), '5155185551');
  assert.strictEqual(x.class, 'needs_review');
  assert.strictEqual(x.pieces[0].status, '확인필요');
  assert.deepStrictEqual([x.branchNo, x.branch, x.product], ['20803', '메가스테이 홍대상수점', '빌리투어']);
  assert.ok(/못 읽은 항목/.test(x.reason), x.reason);
});
test('실제 잡담 2문장은 계속 잡담(지점명(숫자)·결제 표현 없음), 지점명(숫자)만 있어도 결제 표현이 없으면 잡담', () => {
  const chat = [
    '오늘 지점 정보 처리 및 빌리투어 요청은 내용은 공유하지만 처리는 제가 자체적으로 할게요. ' +
      '확인 후 다시 말씀드리겠습니다.',
    '지점정보 승인 및 빌리투어 등 영업일에 담당자가 처리해야 하는 업무는 사전에 인계바랍니다.',
    '메가스테이 홍대상수점(20803) 빌리투어 스케쥴 연락바랍니다. @스티브',
    '빌리투어 결제내역입니다. 오늘 중 스케쥴 연락바랍니다. @스티브'
  ];
  const r = J.classifyMessages(chat, []);
  assert.deepStrictEqual(r.results.map((x) => x.class), ['ignore', 'ignore', 'ignore', 'ignore']);
  assert.strictEqual(r.counts.chat, 4);
  assert.strictEqual(r.counts.review, 0);
});
test('실제 22건 + 잡담 2문장을 섞어도 잡담만 chat 2, 나머지 분류는 그대로', () => {
  const extra = ['오늘 지점 정보 처리 및 빌리투어 요청은 내용은 공유하지만 처리는 제가 자체적으로 할게요',
    '지점정보 승인 및 빌리투어 등 영업일에 담당자가 처리해야 하는 업무는 사전에 인계바랍니다'];
  const c = J.classifyMessages(R22_TEXTS.concat(extra), []).counts;
  assert.deepStrictEqual([c.chat, c.review, c.newBasic, c.needPhone, c.billy, c.notTarget],
    [2, 2, 9, 5, 7, 1]);
  assert.strictEqual(c.sumOk, true);
});

test('지점번호·결제일시를 못 읽은 확인필요 글(20803)에도 같은 글이면 같은 열쇠(X_해시)가 붙는다', () => {
  const t = R22_TEXTS[15];
  const a = byId(J.classifyMessages(R22_TEXTS, []), '5155185551').pieces[0].key;
  const b = J.classifyMessages([t], []).results[0].pieces[0].key;
  assert.ok(a.indexOf('X_') === 0 && a.length === 10, a);
  assert.strictEqual(a, b);
  assert.notStrictEqual(a, J.classifyMessages([t + '!'], []).results[0].pieces[0].key);
});

// ── GAS 쪽: 같은 파일 + 읽기 전용 + 시트 목 대조 ──
const GS = path.join(ROOT, 'gas-code/JandiClassify.gs');
const CODE = path.join(ROOT, 'gas-code/Code.gs');
test('GAS 사본(JandiClassify.gs)이 js/jandi-classify.js 와 글자까지 같다', () => {
  assert.ok(fs.readFileSync(GS).equals(fs.readFileSync(path.join(ROOT, 'js/jandi-classify.js'))));
});
test('GAS 사본이 module·self 없는 환경에서 전역 JandiClassify로 올라와 같은 결과를 낸다', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(GS, 'utf8'), ctx);
  assert.strictEqual(typeof ctx.JandiClassify.classifyMessages, 'function');
  const a = JSON.stringify(ctx.JandiClassify.classifyMessages(SYNTH_MESSAGES, SYNTH_EXISTING));
  assert.strictEqual(a, JSON.stringify(J.classifyMessages(SYNTH_MESSAGES, SYNTH_EXISTING)));
});
test('Code.gs의 previewJandi 구간에 쓰기 호출이 없다', () => {
  const src = fs.readFileSync(CODE, 'utf8');
  const from = src.indexOf('잔디 결제 알림 분류 미리보기');
  const to = src.indexOf('잔디 결제 알림 등록 (importJandi');
  assert.ok(from > 0 && to > from);
  const part = src.slice(from, to);
  const writes = ['appendRow', 'setValues?', 'setValue', 'setProperty', 'setProperties',
    'deleteProperty', 'deleteRow', 'insertRow', 'clear', 'setBackground', 'setNumberFormat',
    'sendEmail'];
  const bad = part.match(new RegExp('\\.(' + writes.join('|') + ')\\(|sendAlimtalk|MailApp|LockService|UrlFetchApp'));
  assert.strictEqual(bad, null, bad && bad[0]);
  assert.ok(/action === 'previewJandi'/.test(src));
});

function loadGas(rows, props) {
  const kst = (d) => new Date(d.getTime() + 9 * 3600000);
  const pad = (n) => String(n).padStart(2, '0');
  const calls = [];
  const guard = (name, target) => new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      return () => {
        calls.push(name + '.' + String(k));
        throw new Error('쓰기·미허용 호출 ' + name + '.' + String(k));
      };
    }
  });
  const sheet = guard('sheet', {
    getLastRow: () => rows.length + 1,
    getRange: (r, c, n, w) => ({ getValues: () => rows.slice(r - 2, r - 2 + n) })
  });
  const ss = guard('ss', { getSheetByName: (n) => (n === '신청 내역' ? sheet : null) });
  const propsObj = guard('props', {
    getProperty: (k) => (k === 'INBOX_TOKEN' ? 'tok' : null),
    getProperties: () => props
  });
  const ctx = vm.createContext({
    Utilities: { formatDate: (d, tz, f) => {
      assert.strictEqual(f, 'yyyy-MM-dd HH:mm');
      const k = kst(d);
      return k.getUTCFullYear() + '-' + pad(k.getUTCMonth() + 1) + '-' + pad(k.getUTCDate()) + ' ' +
        pad(k.getUTCHours()) + ':' + pad(k.getUTCMinutes());
    } },
    SpreadsheetApp: { openById: () => ss },
    PropertiesService: { getScriptProperties: () => propsObj }
  });
  vm.runInContext(fs.readFileSync(GS, 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(CODE, 'utf8'), ctx);
  return { ctx, calls };
}
const cell = (y, mo, d, h, mi) => new Date(Date.UTC(y, mo - 1, d, h - 9, mi)); // KST 벽시계 -> Date
function row14(type, b, c, e) {
  const r = new Array(14).fill('');
  r[1] = b; r[2] = c || ''; r[4] = e || ''; r[12] = type;
  return r;
}
test('previewJandi(시트 목): 쓰기 없이 시트·발송 기록과 대조해 분류한다', () => {
  const rows = [
    row14('직-일반', cell(2026, 11, 23, 11, 1), '우리고시텔 신림역점(20990)'),
    row14('직-대기', cell(2026, 11, 23, 11, 12), '이레고시원(이레하우스)(16861)', 'https://gobang.kr/place/16861'),
    row14('A', cell(2026, 11, 1, 9, 0), '옛 폼', ''),
    row14('직B', cell(2026, 11, 12, 9, 0), '홍길동', 'https://gobang.kr/place/20010')
  ];
  const { ctx } = loadGas(rows, { PF_20897_202611061001: '2026-11-06 10:30|휴식 교대점' });
  const msgs = REAL.messages.concat([prem('20010', '26.11.09 12:00'), prem('20897', '26.11.06 10:01'),
    prem('77777', '26.11.07 10:00')]);
  const r = ctx.previewJandi(msgs, 'tok');
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.readOnly, true);
  assert.strictEqual(JSON.stringify(r.results.map((x) => x.pieces[0].status)),
    JSON.stringify(['이미있음', '이미있음', '이미있음', '이미있음', '번호필요']));
  assert.strictEqual(r.counts.sumOk, true);
});
test('previewJandi(시트 목): 지점명 없는 옛 PF 기록만 있는 20897도 이미 있음', () => {
  [{ PF_20897_202611061001: '2026-11-06 10:30' },
    { PF_20897_202611061001: '2026-11-06 10:30|' }].forEach((props) => {
    const { ctx } = loadGas([], props);
    const r = ctx.previewJandi([prem('20897', '26.11.06 10:01')], 'tok');
    assert.strictEqual(r.results[0].pieces[0].status, '이미있음');
    assert.strictEqual(r.counts.needPhone, 0);
  });
});
test('previewJandi: 접근 코드가 틀리거나 입력이 없으면 거절', () => {
  const { ctx } = loadGas([], {});
  assert.strictEqual(ctx.previewJandi(['x'], 'wrong').reason, 'unauthorized');
  assert.strictEqual(ctx.previewJandi([], 'tok').reason, 'bad_request');
  assert.strictEqual(ctx.previewJandi('x', 'tok').reason, 'bad_request');
  assert.strictEqual(ctx.previewJandi(new Array(501).fill('x'), 'tok').reason, 'too_many');
});

console.log('\n통과 ' + pass + ' / 실패 ' + failures.length + ' / 전체 ' + (pass + failures.length));
if (failures.length) {
  console.log('실패: ' + failures.join(' | '));
  process.exit(1);
}
