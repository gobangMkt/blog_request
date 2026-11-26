// 실행: node tests/toss-import.test.js (addon-direct-pay 폴더에서)
// TossImport.gs 순수 로직(엑셀 파싱·주문 추출·결제 판정·기존 폼 대조)과 listStatus의 토스 대조를 시험한다.
const assert = require('assert');
const { makeEnv, appRow, kstDate, APPLY_HEADER } = require('./gas-mock.js');

let pass = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) {
    failures.push(name);
    console.log('FAIL ' + name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n     '));
  }
}

const TOSS_HEADER = ['거래일시', '주문번호', '구매상품', '옵션명', '구매자명', '연락처', '주문상태', '총결제금액', '가져온시각'];
const env0 = makeEnv({ sheets: { '신청 내역': [APPLY_HEADER] } });
const T = env0.ctx;

test('xlsx 파싱: 공유 문자열·인라인 문자열·빈 칸', () => {
  const rows = T.tossParseXlsxRows({
    'xl/sharedStrings.xml': '<sst><si><t>주문번호</t></si><si><t>연락처</t></si><si><r><t>블로그</t></r><r><t> 고급형</t></r></si></sst>',
    'xl/worksheets/sheet1.xml': '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2"><v>123</v></c><c r="B2" t="inlineStr"><is><t>a&amp;b</t></is></c><c r="C2" t="s"><v>2</v></c></row></sheetData>'
  });
  assert.deepStrictEqual(env0.plain(rows), [['주문번호', '', '연락처'], ['123', 'a&b', '블로그 고급형']]);
});

test('주문 추출: 2줄 헤더, 연락처 앞 0 복원, 같은 주문번호는 마지막 값', () => {
  const rows = [
    ['결제 정보', '', '', '', ''],
    ['거래일시', '주문번호', '구매상품', '연락처', '주문상태', '총결제금액'],
    ['2026-11-20 10:05:11', 'A1', '고방 블로그 일반형', '1012345678', '결제완료', '150,000'],
    ['46346.5', 'A2', '챌린지 보증금', '010-1111-2222', '결제완료', '10000'],
    ['2026-11-21 09:00:00', 'A1', '고방 블로그 일반형', '1012345678', '취소완료', '150,000']
  ];
  const out = env0.plain(T.tossExtractOrders(rows));
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].phone, '01012345678');
  assert.strictEqual(out[0].status, '취소완료');
  assert.strictEqual(out[1].orderedAt, '2026-11-20 12:00'); // 엑셀 날짜 숫자
});

test('주문 추출: 필수 열이 없으면 오류', () => {
  assert.throws(() => T.tossExtractOrders([['주문번호', '구매상품'], ['A1', 'x']]), /필수 열/);
  assert.throws(() => T.tossExtractOrders([['거래일시'], ['x']]), /형식이 아닙니다/);
});

test('결제 판정·블로그 상품 판정', () => {
  assert.ok(T.tossIsPaid('결제완료'));
  assert.ok(!T.tossIsPaid('결제취소'));
  assert.ok(!T.tossIsPaid('입금대기'));
  assert.ok(!T.tossIsPaid(''));
  assert.ok(T.tossIsBlog('[고방] 블로그 마케팅 15만원'));
  assert.ok(!T.tossIsBlog('[핫딜] 키친스토리 밀키트'));
});

test('대조: 같은 연락처·기간 안 결제만, 결제 하나는 한 행에만', () => {
  const base = T.tossMs('2026-11-10 10:00');
  const legacy = [
    { key: 'a', phone: '010-1234-5678', ts: base },
    { key: 'b', phone: '01012345678', ts: base + 1000 },              // 같은 사람 두 번 신청
    { key: 'c', phone: '010-9999-0000', ts: base },                   // 결제가 40일 뒤
    { key: 'd', phone: '', ts: base }
  ];
  const orders = [
    { orderNo: '1', orderedAt: '2026-11-11 09:00', phone: '01012345678', status: '결제완료' },
    { orderNo: '2', orderedAt: '2026-12-20 09:00', phone: '01099990000', status: '결제완료' },
    { orderNo: '3', orderedAt: '2026-11-12 09:00', phone: '01012345678', status: '결제취소' }
  ];
  const hit = env0.plain(T.tossMatchLegacy(legacy, orders));
  assert.deepStrictEqual(Object.keys(hit), ['a']);
  assert.strictEqual(hit.a.orderNo, '1');
});

test('listStatus: 결제 전 기존 폼 행이 토스 결제와 맞으면 결제 완료 + toss 표시, 시트는 안 씀', () => {
  const unpaid = appRow('A', '', '행복고시원', 'https://gobang.kr/place/1', '', '');
  unpaid[0] = kstDate(2026, 11, 20, 9, 0); unpaid[3] = '010-1234-5678';
  const other = appRow('B', '', '다른고시원', 'https://gobang.kr/place/2', '', '');
  other[0] = kstDate(2026, 11, 20, 9, 0); other[3] = '010-5555-6666';
  const env = makeEnv({
    readOnly: true,
    sheets: {
      '신청 내역': [APPLY_HEADER, unpaid, other],
      '토스 결제': [TOSS_HEADER, ['2026-11-20 11:30', 'T1', '고방 블로그', '', '홍길동', '01012345678', '결제완료', '150000', '']]
    }
  });
  const res = env.plain(env.ctx.listStatus('tok'));
  const a = res.items.filter((x) => x.applicant === '행복고시원')[0];
  const b = res.items.filter((x) => x.applicant === '다른고시원')[0];
  assert.strictEqual(a.stage, 'paid');
  assert.strictEqual(a.toss, '2026-11-20 11:30');
  assert.strictEqual(a.paidAt, '2026-11-20 11:30');
  assert.strictEqual(a.price, 150000);
  assert.strictEqual(b.stage, 'unpaid');
  assert.ok(!b.toss);
});

test('listStatus: 토스 탭이 없어도 그대로 동작', () => {
  const unpaid = appRow('A', '', '행복고시원', 'https://gobang.kr/place/1', '', '');
  unpaid[0] = kstDate(2026, 11, 20, 9, 0); unpaid[3] = '010-1234-5678';
  const env = makeEnv({ readOnly: true, sheets: { '신청 내역': [APPLY_HEADER, unpaid] } });
  const res = env.plain(env.ctx.listStatus('tok'));
  assert.strictEqual(res.items[0].stage, 'unpaid');
});

console.log('\n' + pass + ' passed, ' + failures.length + ' failed');
if (failures.length) process.exit(1);
