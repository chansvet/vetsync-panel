const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

let source = fs.readFileSync('vetsync-panel.src.js', 'utf8');
source = source.replace(
  "  if (!location.hostname.endsWith('vetsync4.vetu1.com')) {\n    alert('VetSync 화면에서 눌러주세요.');\n  } else if (window.__VETSYNC_BUTTON) {\n    mountButton();\n    // 화면이 다시 그려지면서 버튼이 사라질 수 있으므로 주기적으로 확인한다\n    setInterval(mountButton, 3000);\n  } else {\n    open();\n  }",
  '  globalThis.__test = { compareSnapshot, render, asText, rawItem, toHtml };'
);
const context = {};
vm.createContext(context);
vm.runInContext(source, context);

const item = (drug, dose, route, times, extra = {}) => ({
  match: drug.toLowerCase(), drug, dose, route, frequency: '', note: '', instruction: '', conditional: false,
  times: times.map(([tag, hour, order]) => ({ tag, hour, order })), ...extra,
});
const patient = (name, predicted, items) => ({
  pid: name, name, code: '12345', breed: '푸들', cage: 'A1', predicted, items,
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
assert.match(html, /쪼코 \(#12345 · 푸들\)/);
assert.match(html, /background:#fef08a[^>]+>연장<\/span>/);
assert.match(html, /SAM <span[^>]+>22mpk→20mpk<\/span> IV/);
assert.match(html, /<span[^>]+>내일 9시<\/span>/);
assert.match(html, /line-through[^>]+>내일 1시<\/span>/);
assert.match(html, /maro 1mpk <u>SC<\/u> \(21시\)/);
assert.match(html, /<span[^>]+>B12 <u>IM<\/u> \(<u>18시<\/u>\)<\/span>/);
assert.match(html, /퇴원환자 \(#12345 · 푸들\)/);
assert.match(html, /text-decoration:line-through[^>]+>퇴원<\/span>/);
assert.match(html, /line-through[^>]+>cefa 20mpk IV \(17시\)<\/span>/);
assert.ok(!html.includes('>SAM</span>'));
assert.ok(text.includes('쪼코 (#12345 · 푸들) A1\n  [연장]'));
assert.ok(text.includes('maro 1mpk _SC_ (21시)'));
assert.ok(text.includes('~~cefa 20mpk IV (17시)~~'));

const unchanged = context.__test.compareSnapshot(current, JSON.parse(JSON.stringify(current)), states);
assert.strictEqual(unchanged.changes, 0);
assert.ok(!context.__test.render([{ heading: '주사', groups: unchanged.normal }]).includes('color:#c2410c'));

const today = (hour) => [['오늘', hour, hour]];
const routeHtml = context.__test.toHtml(context.__test.rawItem(item('maro', '1mpk', 'SC', today(21))));
assert.match(routeHtml, /^maro 1mpk <u>SC<\/u> \(21시\)$/);
assert.ok(!routeHtml.startsWith('<u>'));

const bidNormal = context.__test.toHtml(context.__test.rawItem(item('cefa', '20mpk', 'IV', today(21), { frequency: 'BID' })));
const bidChanged = context.__test.toHtml(context.__test.rawItem(item('cefa', '20mpk', 'IV', today(17), { frequency: 'BID' })));
const tidChanged = context.__test.toHtml(context.__test.rawItem(item('SAM', '20mpk', 'IV', today(21), { frequency: 'TID' })));
const sidVariable = context.__test.toHtml(context.__test.rawItem(item('maro', '1mpk', 'SC', today(18), { frequency: 'SID' })));
assert.ok(bidNormal.includes('(21시)'));
assert.ok(!bidNormal.includes('<u>'));
assert.ok(bidChanged.includes('(<u>17시</u>)'));
assert.ok(tidChanged.includes('(<u>21시</u>)'));
assert.ok(sidVariable.includes('(18시)'));
assert.ok(!sidVariable.includes('(<u>18시</u>)'));

const currentBid = patient('기존기록', false, [item('cefa', '20mpk', 'IV', today(21), { frequency: 'BID', note: 'BID' })]);
const legacyBid = JSON.parse(JSON.stringify(currentBid));
delete legacyBid.items[0].frequency;
const compatible = context.__test.compareSnapshot(
  { patients: { legacy: currentBid } }, { patients: { legacy: legacyBid } }, {}
);
assert.strictEqual(compatible.changes, 0);

console.log('VetSync 변경 비교 테스트 통과');
