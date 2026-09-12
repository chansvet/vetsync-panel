const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

let source = fs.readFileSync('vetsync-panel.src.js', 'utf8');
source = source.replace(
  "  if (!location.hostname.endsWith('vetsync4.vetu1.com')) {\n    alert('VetSync 화면에서 눌러주세요.');\n  } else if (window.__VETSYNC_BUTTON) {\n    mountButton();\n    // 화면이 다시 그려지면서 버튼이 사라질 수 있으므로 주기적으로 확인한다\n    setInterval(mountButton, 3000);\n  } else {\n    open();\n  }",
  '  globalThis.__test = { compareSnapshot, render, asText };'
);
const context = {};
vm.createContext(context);
vm.runInContext(source, context);

const item = (drug, dose, route, times, extra = {}) => ({
  match: drug.toLowerCase(), drug, dose, route, note: '', instruction: '', conditional: false,
  times: times.map(([tag, hour, order]) => ({ tag, hour, order })), ...extra,
});
const patient = (name, predicted, items) => ({
  pid: name, name, code: name, cage: 'A1', predicted, items,
});

const old = {
  patients: {
    p1: patient('쪼코', true, [
      item('SAM', '22mpk', 'IV', [['오늘', 17, 17], ['내일', 1, 101]]),
      item('maro', '1mpk', 'SC', [['오늘', 21, 21]]),
    ]),
    p2: patient('퇴원환자', false, [item('cefa', '20mpk', 'IV', [['오늘', 17, 17]])]),
  },
};
const current = {
  patients: {
    p1: patient('쪼코', false, [
      item('SAM', '20mpk', 'IV', [['오늘', 17, 17], ['내일', 9, 109]]),
      item('maro', '1mpk', 'SC', [['오늘', 21, 21]]),
      item('B12', '', 'IM', [['오늘', 18, 18]]),
    ]),
  },
};
const states = { p1: { extended: true, discharged: false }, p2: { extended: false, discharged: true } };
const compared = context.__test.compareSnapshot(current, old, states);
const sections = [{ heading: '주사', groups: compared.normal }];
const html = context.__test.render(sections);
const text = context.__test.asText(sections);

assert.strictEqual(compared.changes, 5);
assert.match(html, /쪼코\(<span[^>]+>연장<\/span>\)/);
assert.match(html, /SAM <span[^>]+>22mpk→20mpk<\/span> IV/);
assert.match(html, /<span[^>]+>내일 9시<\/span>/);
assert.match(html, /line-through[^>]+>내일 1시<\/span>/);
assert.match(html, /<strong[^>]+>maro 1mpk SC \(21시\)<\/strong>/);
assert.match(html, /<strong[^>]+><span[^>]+>B12 IM \(<u>18시<\/u>\)<\/span><\/strong>/);
assert.match(html, /퇴원환자\(<span[^>]+>퇴원<\/span>\)/);
assert.match(html, /line-through[^>]+>cefa 20mpk IV \(17시\)<\/span>/);
assert.ok(!html.includes('>SAM</span>'));
assert.ok(text.includes('쪼코(**연장**)'));
assert.ok(text.includes('~~cefa 20mpk IV (17시)~~'));

const unchanged = context.__test.compareSnapshot(current, JSON.parse(JSON.stringify(current)), states);
assert.strictEqual(unchanged.changes, 0);
assert.ok(!context.__test.render([{ heading: '주사', groups: unchanged.normal }]).includes('color:#c2410c'));

console.log('VetSync 변경 비교 테스트 통과');
