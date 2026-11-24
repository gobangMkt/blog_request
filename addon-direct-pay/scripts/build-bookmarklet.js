// 실행: node scripts/build-bookmarklet.js (addon-direct-pay 폴더에서)
// jandi-reader.js 와 jandi-bookmarklet-src.js 를 이어 붙여 js/jandi-bookmarklet.txt 에 javascript: 한 줄을 쓴다.
// 코드는 압축·변형하지 않는다. 한 줄이 되도록 줄바꿈·# 같은 글자만 %XX로 바꾸고(브라우저가 실행 전에 되돌린다),
// 들여쓰기·빈 줄·줄 전체 주석만 뺀다(크롬 북마크 길이를 줄이려는 것, 코드는 그대로).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n?/g, '\n');
const reader = read('js/jandi-reader.js');
const src = read('js/jandi-bookmarklet-src.js');

const version = (s, re) => { const m = s.match(re); return m ? m[1] : null; };
const vReader = version(reader, /READER_VERSION = '([^']+)'/);
const vSrc = version(src, /READER_VERSION = '([^']+)'/);
const vBridge = version(read('js/jandi-bridge.js'), /EXPECTED_VERSION = '([^']+)'/);
if (!vReader || vReader !== vSrc || vReader !== vBridge) {
  console.error('READER_VERSION 불일치: reader=' + vReader + ' bookmarklet=' + vSrc + ' bridge=' + vBridge);
  process.exit(1);
}
[reader, src].forEach((s) => { if (s.indexOf('`') >= 0) { console.error('백틱(템플릿 문자열)은 쓰지 않는다: 줄 정리가 안전하지 않다'); process.exit(1); } });

function tidy(s) {
  return s.split('\n').map((l) => l.trim()).filter((l) => l && l.indexOf('//') !== 0).join('\n');
}
const code = '(function(){\n' + tidy(reader) + '\n' + tidy(src) + '\n})();void 0;';

// 문법 검사(문법 오류면 여기서 멈춘다. 실행은 하지 않는다)
new Function(code);

let out = 'javascript:';
for (const ch of code) {
  out += /[ -~]/.test(ch) && ch !== '%' && ch !== '#' ? ch : encodeURIComponent(ch);
}
fs.writeFileSync(path.join(ROOT, 'js/jandi-bookmarklet.txt'), out);
console.log('js/jandi-bookmarklet.txt 만듦: ' + out.length + '자, 코드 ' + code.length + '자, 버전 ' + vReader);
