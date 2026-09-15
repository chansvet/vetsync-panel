const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('./dose-engine')(require('./drug-defaults.json'));
assert.equal(engine.find('vit. K').name, engine.find('vitamin K').name);
assert.equal(engine.find('maro').name, 'Maropitant');
assert.equal(engine.find('marbo').name, 'Marbofloxacin');
assert.equal(engine.calculate('SAM', '', '5 kg').text, '0.73 mL');
assert.equal(engine.calculate('SAM', '30mpk', '5 kg').text, '1.00 mL');
assert.equal(engine.calculate('SAM', '150mg', '5 kg').text, '1.00 mL');
assert.equal(engine.calculate('SAM', '0.8mL', '- kg').text, '0.80 mL');
assert.equal(engine.calculate('SAM', '2', '5 kg').volume, null);
assert.equal(engine.calculate('SAM', '', '- kg').volume, null);
assert.equal(engine.calculate('SAM', '', '5 kg', '30mpk').volume, null);
assert.equal(engine.calculate('Dalteparin', '150IU/kg', '5 kg').text, '0.30 mL');
assert.equal(engine.calculate('Dalteparin', '150mpk', '5 kg').volume, null);
assert.equal(engine.calculate('SAM', '0mpk', '5 kg').volume, null);
let source = fs.readFileSync('vetsync-panel.src.js', 'utf8');
source = source.slice(0, source.lastIndexOf("  if (!location.hostname.endsWith")) +
  'globalThis.api = {makeSnapshot,compareSnapshot,render};})();';
const ctx = { doseEngine: engine };
vm.runInNewContext(source, ctx);
const row = (drug, dose, hour = 17, cancelled = false, weight = '5 kg') => ({
  pid: 'test', patient: '테스트', code: '000', breed: '믹스', weight, cage: 'A1',
  drug, dose, hour, cancelled, order: hour, tag: '오늘', route: 'IV', frequency: 'SID',
  note: '', instruction: '', raw: drug,
});
const snapshot = (...rows) => ctx.api.makeSnapshot(rows);
const old = snapshot(row('vit K', '2mpk'));
const alias = snapshot(row('vitamin K', '2mpk'));
assert.equal(ctx.api.compareSnapshot(alias, old, {}).changes, 0);
const sam = snapshot(row('SAM', ''));
const revised = snapshot(row('SAM', '', 17, false, '6 kg'), row('maro', '1mpk', 21, false, '6 kg'));
const diff = ctx.api.compareSnapshot(revised, sam, {});
assert.equal(diff.changes, 1);
const html = ctx.api.render([{heading: '주사', groups: diff.normal}]);
assert.match(html, /0\.73 mL.*0\.88 mL/);
assert.match(html, /추가 준비/);
assert.match(html, /용량·경로 재확인/);
const skip = ctx.api.compareSnapshot(snapshot(row('SAM', '', 17, true)), sam, {});
assert.match(skip.normal[0].body[0], /빼기: 17시/);
const removed = ctx.api.compareSnapshot(snapshot(), sam, {});
assert.match(removed.normal[0].body[0], /빼기/);
assert.match(removed.normal[0].body[0], /0.73 mL/);
assert.equal(snapshot(row('vit K', '2mpk'), row('vitamin K', '2mpk', 21)).patients.test.items.length, 1);
console.log('2.0 계산·별칭·추가·제외·체중 변경 테스트 통과');
if (process.argv.includes('--preview')) {
  const body = ctx.api.render([{ heading: 'VetSync 2.0 · 예시 환자', groups: diff.normal },
    { heading: '제외 변경 예시', groups: skip.normal }, { heading: '삭제 예시', groups: removed.normal }]);
  fs.writeFileSync('preview-v2.html', '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>VetSync 2.0 예시</title><style>body{margin:0;padding:16px;font:15px/1.5 system-ui;background:#fff;color:#111827;overflow-wrap:anywhere}main{max-width:900px;margin:auto}</style><main>' + body + '</main></html>');
}
