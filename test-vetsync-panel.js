const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

let source = fs.readFileSync('vetsync-panel.src.js', 'utf8');
source = source.replace(
  "  if (!location.hostname.endsWith('vetsync4.vetu1.com')) {\n    alert('VetSync 화면에서 눌러주세요.');\n  } else if (window.__VETSYNC_BUTTON) {\n    mountButton();\n    // 화면이 다시 그려지면서 버튼이 사라질 수 있으므로 주기적으로 확인한다\n    setInterval(mountButton, 3000);\n  } else {\n    open();\n  }",
  '  globalThis.__test = { compareSnapshot, render, asText, rawItem, toHtml, sortSections };'
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
assert.match(html, /line-through[^>]+><u style="font-weight:800">내일 1시<\/u><\/span>/);
assert.match(html, /maro 1mpk <u style="font-weight:800">SC<\/u> \(21시\)/);
assert.match(html, /<span[^>]+>B12 <u style="font-weight:800">IM<\/u> \(18시\)<\/span>/);
assert.match(html, /퇴원환자 \(#12345 · 푸들\)/);
assert.match(html, /text-decoration:line-through[^>]+>퇴원<\/span>/);
assert.match(html, /line-through[^>]+>cefa 20mpk IV \(17시\)<\/span>/);
assert.ok(!html.includes('>SAM</span>'));
assert.ok(text.includes('쪼코 (#12345 · 푸들) A1 [연장]'));
assert.ok(text.includes('maro 1mpk **__SC__** (21시)'));
assert.ok(text.includes('~~cefa 20mpk IV (17시)~~'));

const unchanged = context.__test.compareSnapshot(current, JSON.parse(JSON.stringify(current)), states);
assert.strictEqual(unchanged.changes, 0);
assert.ok(!context.__test.render([{ heading: '주사', groups: unchanged.normal }]).includes('color:#c2410c'));

const today = (hour) => [['오늘', hour, hour]];
const routeHtml = context.__test.toHtml(context.__test.rawItem(item('maro', '1mpk', 'SC', today(21))));
assert.match(routeHtml, /^maro 1mpk <u style="font-weight:800">SC<\/u> \(21시\)$/);
assert.ok(!routeHtml.startsWith('<u style="font-weight:800">'));

const bidNormal = context.__test.toHtml(context.__test.rawItem(item('cefa', '20mpk', 'IV', today(21), { frequency: 'BID' })));
const bidChanged = context.__test.toHtml(context.__test.rawItem(item('cefa', '20mpk', 'IV', today(17), { frequency: 'BID' })));
const tidChanged = context.__test.toHtml(context.__test.rawItem(item('SAM', '20mpk', 'IV', today(21), { frequency: 'TID' })));
const sidVariable = context.__test.toHtml(context.__test.rawItem(item('maro', '1mpk', 'SC', today(18), { frequency: 'SID' })));
const inferredBid = context.__test.toHtml(context.__test.rawItem(item('cefa', '20mpk', 'IV', [
  ['오늘', 17, 17], ['내일', 9, 109],
])));
const inferredTid = context.__test.toHtml(context.__test.rawItem(item('SAM', '20mpk', 'IV', [
  ['오늘', 21, 21], ['내일', 1, 101], ['내일', 9, 109],
])));
assert.ok(bidNormal.includes('(21시)'));
assert.ok(!bidNormal.includes('<u style="font-weight:800">'));
assert.ok(bidChanged.includes('(<u style="font-weight:800">17시</u>)'));
assert.ok(tidChanged.includes('(<u style="font-weight:800">21시</u>)'));
assert.ok(sidVariable.includes('(18시)'));
assert.ok(!sidVariable.includes('(<u style="font-weight:800">18시</u>)'));
assert.ok(inferredBid.includes('(<u style="font-weight:800">17시</u>, 내일 9시)'));
assert.ok(inferredTid.includes('(<u style="font-weight:800">21시</u>, 내일 1시, 내일 9시)'));

const currentBid = patient('기존기록', false, [item('cefa', '20mpk', 'IV', today(21), { frequency: 'BID', note: 'BID' })]);
const legacyBid = JSON.parse(JSON.stringify(currentBid));
delete legacyBid.items[0].frequency;
const compatible = context.__test.compareSnapshot(
  { patients: { legacy: currentBid } }, { patients: { legacy: legacyBid } }, {}
);
assert.strictEqual(compatible.changes, 0);

const sortable = [{ heading: '정렬', groups: [
  { title: '다', sortName: '다', sortCage: 'D장-1', body: [] },
  { title: '가', sortName: '가', sortCage: 'A장-10', body: [] },
  { title: '라', sortName: '라', sortCage: 'ICU-2', body: [] },
  { title: '나', sortName: '나', sortCage: 'B장-3', body: [] },
  { title: '마', sortName: '마', sortCage: 'C장-1', body: [] },
  { title: '바', sortName: '바', sortCage: 'A장-2', body: [] },
] }];
assert.deepStrictEqual(
  Array.from(context.__test.sortSections(sortable, 'name')[0].groups, (g) => g.title),
  ['가', '나', '다', '라', '마', '바']
);
assert.deepStrictEqual(
  Array.from(context.__test.sortSections(sortable, 'cage')[0].groups, (g) => g.title),
  ['나', '바', '가', '라', '마', '다']
);

console.log('VetSync 변경 비교 테스트 통과');
