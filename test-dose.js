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
assert.equal(engine.calculate('SAM', '22', '5 kg').text, '0.73 mL');
assert.equal(engine.calculate('famo', '.8', '5 kg').text, '0.40 mL');
assert.equal(engine.calculate('famo', '.8', '5 kg').nonDefault, true);
assert.equal(engine.calculate('SAM', '22', '5 kg').nonDefault, false);
assert.equal(engine.calculate('SAM', '', '- kg').volume, null);
assert.equal(engine.calculate('SAM', '', '5 kg', '30mpk').volume, null);
assert.equal(engine.calculate('Dalteparin', '150IU/kg', '5 kg').text, '0.30 mL');
assert.equal(engine.calculate('Dalteparin', '150mpk', '5 kg').volume, null);
assert.equal(engine.calculate('SAM', '0mpk', '5 kg').volume, null);
let source = fs.readFileSync('vetsync-panel.src.js', 'utf8');
source = source.slice(0, source.lastIndexOf("  if (!location.hostname.endsWith")) +
  'globalThis.api = {makeSnapshot,compareSnapshot,render,weightValue,latestWeight,parseDrug,doseFromInstruction,isInjection,pickInj};})();';
const ctx = { doseEngine: engine };
vm.runInNewContext(source, ctx);
assert.equal(ctx.api.weightValue('오후 9시 퇴원'), '');
assert.equal(ctx.api.weightValue('9/15 퇴원예정'), '');
assert.equal(ctx.api.weightValue('.9'), '0.9 kg');
assert.equal(ctx.api.weightValue('900g'), '0.9 kg');
assert.equal(ctx.api.weightValue('4.8 kg'), '4.8 kg');
assert.equal(ctx.api.weightValue('-9'), '');
assert.equal(ctx.api.latestWeight({sections:[{rows:[{displayName:'체중',cells:[
  {hourSlot:9,resultSlots:[{value:'4.8'}]}, {hourSlot:21,resultSlots:[{value:'오후 9시 퇴원'}]}
]}]}]}, {patient:{}}), '4.8 kg');
for (const name of ['SAM 22 IV','Famo 1 IV','cerenia 1 SID']) {
  const parsed=ctx.api.parseDrug(name);
  assert.equal(ctx.api.isInjection(name),true);
  assert.ok(engine.calculate(parsed.drug,parsed.dose,'5 kg').volume>0);
}
assert.equal(ctx.api.parseDrug('famo .8 mpk IV').dose, '.8mpk');
assert.equal(ctx.api.doseFromInstruction('22mpk'), '22mpk');
assert.equal(ctx.api.doseFromInstruction('용량: 22'), '22');
assert.equal(ctx.api.doseFromInstruction('2번'), '');
assert.equal(ctx.api.doseFromInstruction('1시간 후'), '');
const instructionOnlyDetail = { sections: [{ section: 'TREATMENT', rows: [{
  displayName: 'SAM IV TID', instructionText: '22mpk', cells: [{ hourSlot: 17, status: 'PLANNED' }],
}]}] };
const instructionOnlyChart = { discharged: false, cageLabel: 'A1', patient: { patientId: 'instruction-only', name: '지시사항', hospitalPatientCode: '1', breed: '믹스' } };
assert.equal(ctx.api.pickInj(instructionOnlyChart, instructionOnlyDetail, '2026-09-16', [17], '오늘', true, '5 kg')[0].dose, '22mpk');
const conflictingDetail = { sections: [{ section: 'TREATMENT', rows: [{
  displayName: 'SAM 22mpk IV', instructionText: '30mpk', cells: [{ hourSlot: 17, status: 'PLANNED' }],
}]}] };
assert.equal(ctx.api.pickInj(instructionOnlyChart, conflictingDetail, '2026-09-16', [17], '오늘', true, '5 kg')[0].doseConflict, true);
const conflictSnapshot = ctx.api.makeSnapshot(ctx.api.pickInj(instructionOnlyChart, conflictingDetail, '2026-09-16', [17], '오늘', true, '5 kg'));
assert.equal(conflictSnapshot.patients['instruction-only'].items[0].calculation.text, '용량 불일치');
const row = (drug, dose, hour = 17, cancelled = false, weight = '5 kg') => ({
  pid: 'test', patient: '테스트', code: '000', breed: '믹스', weight, cage: 'A1',
  drug, dose, hour, cancelled, order: hour, tag: '오늘', route: 'IV', frequency: 'SID',
  note: '', instruction: '', raw: drug,
});
const snapshot = (...rows) => ctx.api.makeSnapshot(rows);
const nonDefaultFamo = snapshot(row('Famo', '0.8mpk'));
const nonDefaultHtml = ctx.api.render([{ heading: '주사', groups: ctx.api.compareSnapshot(nonDefaultFamo, null, {}).normal }]);
assert.match(nonDefaultHtml, /Famo.*17시.*IV/);
assert.match(nonDefaultHtml, /0\.40 mL/);
assert.match(nonDefaultHtml, /background:#fef3c7[^>]+>0\.8 mpk<\/span>/);
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
