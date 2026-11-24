// GAS 시험용 시트·속성 목(메모리). Code.gs를 vm에 올려 실제 함수를 돌린다. 네트워크·시트에 닿지 않는다.
// readOnly=true 이면 쓰기 호출(appendRow·setValue·insertSheet·setProperty 등)이 즉시 에러가 된다.
process.env.TZ = 'Asia/Seoul';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const APPLY_HEADER = ['신청일시', '결제완료일', '신청자', '전화번호', '지점URL', '키워드1', '키워드2',
  '키워드3', '강조내용', '보증금', '월세', '도보', '작성타입', '상태', '', '단가'];

const KST = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit'
});
function formatDate(d, tz, fmt) {
  const p = {};
  KST.formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  return fmt.replace(/yyyy|MM|dd|HH|mm/g, (t) => ({
    yyyy: p.year, MM: p.month, dd: p.day, HH: p.hour, mm: p.minute
  })[t]);
}

// 신청 내역 행(14칸 + 단가). b = 결제완료일(Date)
function appRow(type, b, c, e, status, price) {
  const r = new Array(16).fill('');
  r[1] = b; r[2] = c || ''; r[4] = e || ''; r[12] = type; r[13] = status || '신청완료';
  if (price) r[15] = price;
  return r;
}
const kstDate = (y, mo, d, h, mi) => new Date(Date.UTC(y, mo - 1, d, h - 9, mi));

// sheets: { 탭이름: 행 배열(머리글 포함) }, props: { 속성: 값 }
function makeEnv(opts) {
  const o = opts || {};
  const env = { readOnly: !!o.readOnly, writes: [], locks: 0, unlocks: 0 };
  function write(kind, name) {
    if (env.readOnly) throw new Error('읽기 전용인데 쓰기 호출: ' + kind + ' ' + (name || ''));
    env.writes.push(kind + ':' + (name || ''));
  }
  function makeSheet(name, rows) {
    const sh = {
      name, rows: rows.map((r) => r.slice()),
      getName: () => name,
      getLastRow: () => sh.rows.length,
      getLastColumn: () => Math.max(1, ...sh.rows.map((r) => r.length)),
      appendRow: (arr) => { write('appendRow', name); sh.rows.push(arr.slice()); },
      getRange: (r, c, n, w) => {
        const nn = n === undefined ? 1 : n, ww = w === undefined ? 1 : w;
        return {
          getValues: () => Array.from({ length: nn }, (_, i) => Array.from({ length: ww }, (_, j) => {
            const v = (sh.rows[r - 1 + i] || [])[c - 1 + j];
            return v === undefined ? '' : v;
          })),
          getValue: () => { const v = (sh.rows[r - 1] || [])[c - 1]; return v === undefined ? '' : v; },
          setValue: (v) => {
            write('setValue', name);
            while (sh.rows.length < r) sh.rows.push([]);
            while (sh.rows[r - 1].length < c) sh.rows[r - 1].push('');
            sh.rows[r - 1][c - 1] = v;
          },
          setNumberFormat: () => write('setNumberFormat', name),
          setBackground: () => write('setBackground', name)
        };
      }
    };
    return sh;
  }
  const book = { sheets: [] };
  Object.keys(o.sheets || {}).forEach((n) => book.sheets.push(makeSheet(n, o.sheets[n])));
  const ss = {
    getSheetByName: (n) => book.sheets.filter((s) => s.name === n)[0] || null,
    getSheets: () => book.sheets.slice(),
    insertSheet: (n, idx) => {
      write('insertSheet', n);
      const s = makeSheet(n, []);
      book.sheets.splice(idx === undefined ? 0 : idx, 0, s);
      return s;
    }
  };
  const props = Object.assign({ INBOX_TOKEN: 'tok' }, o.props || {});
  const scriptProps = {
    getProperty: (k) => (k in props ? props[k] : null),
    getProperties: () => Object.assign({}, props),
    setProperty: (k, v) => { write('setProperty', k); props[k] = String(v); }
  };
  const ctx = vm.createContext({
    Utilities: { formatDate },
    SpreadsheetApp: { openById: () => ss },
    PropertiesService: { getScriptProperties: () => scriptProps },
    LockService: { getScriptLock: () => ({
      waitLock: () => { env.locks++; }, releaseLock: () => { env.unlocks++; }
    }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ content: s, setMimeType() { return this; } })
    }
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas-code/JandiClassify.gs'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas-code/Code.gs'), 'utf8'), ctx);
  env.ctx = ctx; env.book = book; env.props = props; env.ss = ss;
  env.sheet = (n) => ss.getSheetByName(n);
  // 같은 vm 영역의 객체라 deepStrictEqual이 안 맞으므로 JSON으로 풀어 돌려준다
  env.plain = (x) => JSON.parse(JSON.stringify(x));
  return env;
}

module.exports = { makeEnv, appRow, kstDate, APPLY_HEADER, formatDate, ROOT };
