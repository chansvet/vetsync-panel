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
assert.equal(engine.find('류코스팀').name, 'G-CSF');
assert.equal(engine.find('메로페넴').conc, 50);
assert.equal(engine.find('퓨로세마이드').conc, 10);
assert.equal(engine.find('라식스').conc, 10);
assert.equal(engine.calculate('퓨로세마이드', '2mpk', '5 kg').text, '1.00 mL');
assert.equal(engine.calculate('g-csf', '', '1 kg').text, '0.02 mL');
assert.equal(engine.calculate('G-CSF', '5ug/kg', '4 kg').text, '0.08 mL');
assert.equal(engine.calculate('G-CSF', '', '4 kg').basis, '5 µg/kg(기본) · 150 µg/0.6 mL');
assert.equal(engine.calculate('SAM', '0mpk', '5 kg').volume, null);
let source = fs.readFileSync('vetsync-panel.src.js', 'utf8');
source = source.slice(0, source.lastIndexOf("  if (!location.hostname.endsWith")) +
  'globalThis.api = {makeSnapshot,compareSnapshot,render,weightValue,latestWeight,parseDrug,doseFromInstruction,dilutionFrom,isInjection,pickInj,isLabAtDraw,noteOf,labNameOf,flkValues,calculateFlk,ampuleNeeds};})();';
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
assert.deepEqual(JSON.parse(JSON.stringify(ctx.api.parseDrug('SAM22'))),
  {drug:'SAM',dose:'22',route:'',frequency:'',note:''});
assert.deepEqual(JSON.parse(JSON.stringify(ctx.api.parseDrug('famo1'))),
  {drug:'famo',dose:'1',route:'',frequency:'',note:''});
assert.deepEqual(JSON.parse(JSON.stringify(ctx.api.parseDrug('Maropitant 1mpk IV PRN'))),
  {drug:'Maropitant',dose:'1mpk',route:'IV',frequency:'',note:''});
assert.deepEqual(JSON.parse(JSON.stringify(ctx.api.parseDrug('메로페넴 8.5mpk iv 2분 이상'))),
  {drug:'메로페넴',dose:'8.5mpk',route:'IV',frequency:'',note:'2분 이상'});
assert.equal(engine.calculate('메로페넴', '8.5mpk', '27 kg').text, '4.59 mL');
assert.equal(ctx.api.isInjection('H/S + Hepamerz 1amp + 호의주1A'), false);
assert.equal(ctx.api.isInjection('FLK / 0.45N/S + vit B,C 1A, tau 5ml, meto 1.6ml'), false);
assert.equal(ctx.api.isLabAtDraw({displayName:'간이혈당',cells:[{hourSlot:9,status:'PLANNED'}]}), true);
assert.equal(ctx.api.isLabAtDraw({displayName:'간이혈당',cells:[{hourSlot:8,status:'PLANNED'}]}), false);
assert.equal(ctx.api.noteOf({
  displayName: '혈검 (CBC, CRP)', instructionText: '',
  cells: [{hourSlot: 9, status: 'PLANNED', resultSlots: [{value: '지혈 오래'}]}],
}), '지혈 오래');
assert.equal(ctx.api.noteOf({
  displayName: '혈검 (앞다리 채혈)', instructionText: '지혈 오래',
  cells: [{hourSlot: 9, status: 'PLANNED', resultSlots: [{value: '지혈 오래'}, {value: '나비침 사용'}]}],
}), '지혈 오래, 앞다리 채혈, 나비침 사용');
assert.equal(ctx.api.noteOf({
  displayName: '혈검 CBC', instructionText: '',
  cells: [{hourSlot: 8, resultSlots: [{value: '8시 메모'}]}, {hourSlot: 9, resultSlots: [{value: '9시 메모'}]}],
}), '9시 메모');
assert.equal(ctx.api.labNameOf({displayName: '혈검 CBC/지혈 오래'}), '혈검 CBC');
assert.equal(ctx.api.noteOf({displayName: '혈검 CBC/지혈 오래', cells: []}), '지혈 오래');
assert.equal(ctx.api.labNameOf({displayName: '혈검 CBC/CRP'}), '혈검 CBC / CRP');
const flkExample = ctx.api.flkValues(9.8, 48, 2);
assert.equal(flkExample.duration, 24);
assert.ok(Math.abs(flkExample.fentanyl - 9.408) < 1e-12);
assert.ok(Math.abs(flkExample.loading - 0.392) < 1e-12);
assert.ok(Math.abs(flkExample.fentanylTotal - 9.8) < 1e-12);
assert.ok(Math.abs(flkExample.lidocaine - 17.64) < 1e-12);
assert.ok(Math.abs(flkExample.ketamine - 0.7056) < 1e-12);
assert.ok(Math.abs(flkExample.ns - 20.2464) < 1e-12);
assert.equal(flkExample.valid, true);
const flkAuto = ctx.api.calculateFlk(9.8);
assert.equal(flkAuto.rate, 1.5);
assert.equal(flkAuto.bag, 36);
assert.equal(flkAuto.duration, 24);
assert.ok(flkAuto.fentanylTotal < 10);
assert.equal(ctx.api.calculateFlk(0), null);
assert.ok(ctx.api.calculateFlk(50.1).valid);
const largeFlk = ctx.api.calculateFlk(80, true, 2);
assert.ok(largeFlk.valid);
assert.equal(largeFlk.rate, 9.5);
assert.ok(largeFlk.bag <= 150 && largeFlk.fentanylTotal < 20);
const fastFlk = ctx.api.calculateFlk(9.8, true, 1, 2);
assert.equal(fastFlk.bag, 49);
assert.ok(Math.abs(fastFlk.fentanylTotal - 9.996) < 1e-12);
assert.equal(ctx.api.calculateFlk(9.8, true, 1, 1), null);
assert.equal(ctx.api.calculateFlk(9.8, true, 1, 1.7), null);
assert.equal(ctx.api.calculateFlk(9.8, true, 0), null);
assert.equal(ctx.api.calculateFlk(9.8, true, 1.5), null);
assert.equal(ctx.api.calculateFlk(Infinity), null);
assert.equal(ctx.api.flkValues(10, 48, 2).valid, false);
assert.equal(ctx.api.flkValues(10, 49, 2, false).valid, true);
const example42 = ctx.api.calculateFlk(4.2);
const example42Fast = ctx.api.calculateFlk(4.2, true, 1, 1.5);
assert.equal(example42.bag, 58);
assert.equal(example42Fast.bag, 87);
assert.ok(Math.abs(example42.fentanyl - example42Fast.fentanyl) < 1e-12);
assert.equal(ctx.api.calculateFlk(4.2, true, 1, 2), null);
assert.equal(ctx.api.calculateFlk(4.2, false, 1, 2), null);
assert.equal(ctx.api.calculateFlk(4.2, true, 2, 1.5), null);
for (const [rate, bag] of [[4.5,28],[5,31],[5.5,34],[6,37],[6.5,41]]) {
  const result = ctx.api.calculateFlk(34.2, true, 1, rate);
  assert.equal(result.bag, bag);
  assert.ok(result.fentanylTotal < 10);
}
assert.equal(ctx.api.calculateFlk(34.2, true, 1, 6.6), null);
const small100 = ctx.api.calculateFlk(2, true, 1, null, 100);
const small150 = ctx.api.calculateFlk(2, true, 1, null, 150);
assert.equal(small100.bag, 100);
assert.equal(small150.bag, 123);
assert.equal(small150.rate, 1);
assert.equal(small150.duration, 123);
assert.ok(Math.abs(small150.fentanylTotal - 9.92) < 1e-12);
assert.ok(small150.valid && small150.ns >= 0);
assert.equal(ctx.api.calculateFlk(2, false, 1, null, 150).bag, 124);
assert.equal(ctx.api.flkValues(2, 124, 1, true, 1, 150).checks.fentanyl, false);
assert.equal(ctx.api.calculateFlk(2, true, 1, 1.5, 150), null);
assert.equal(ctx.api.calculateFlk(4.2, true, 1, 2, 100), null);
assert.ok(ctx.api.calculateFlk(4.2, true, 1, 2, 150).valid);
assert.equal(ctx.api.calculateFlk(2, true, 1, null, 200), null);
for (const weight of [0.1, 3.4, 9.8, 50, 80, 120]) {
  for (const includeLoading of [true, false]) for (const ampules of [1, 2, 3]) {
    const minimum = ctx.api.calculateFlk(weight, includeLoading, ampules);
    assert.ok(minimum && minimum.valid);
    if (minimum.rate > 1) assert.equal(ctx.api.calculateFlk(weight, includeLoading, ampules, minimum.rate - 0.5), null);
    for (let rate = minimum.rate; rate <= minimum.maximumRate + 1; rate += 0.5) {
      const result = ctx.api.calculateFlk(weight, includeLoading, ampules, rate);
      if (!result) {
        assert.ok(ctx.api.flkValues(weight, (ampules > 1 ? 150 : 100) + 1, rate, includeLoading, ampules).checks.fentanyl);
        continue;
      }
      assert.ok(result.valid && result.ns >= 0 && result.fentanylTotal < 10 * ampules);
      if (rate !== minimum.rate) assert.equal(ctx.api.flkValues(weight, result.bag + 1, rate, includeLoading, ampules).checks.fentanyl, false);
      assert.ok(Math.abs(result.fentanyl + result.lidocaine + result.ketamine + result.ns - result.bag) < 1e-10);
      assert.ok(result.bag === (ampules > 1 ? 150 : 100) || !ctx.api.flkValues(weight, result.bag + 1, rate, includeLoading, ampules).valid);
      assert.ok(Math.abs(result.fentanyl * .05 * rate / result.bag / weight - .002) < 1e-12);
    }
  }
}
assert.equal(engine.find('Cefotaxime').conc, 200);
assert.equal(engine.find('Amikacin').conc, 125);
assert.equal(engine.calculate('Cefotaxime', '20mpk', '5 kg').text, '0.50 mL');
assert.equal(engine.calculate('Amikacin', '10mpk', '5 kg').text, '0.40 mL');
assert.equal(ctx.api.isInjection('amikacin 10'), true);
assert.equal(engine.calculate('Amikacin', '', '5 kg').volume, null);
assert.equal(engine.setConcentration('SAM', 100, 'mg'), true);
assert.equal(engine.calculate('SAM', '22mpk', '5 kg').text, '1.10 mL');
assert.equal(engine.calculate('SAM', '22mpk', '5 kg', '', { concentration: 200, concentrationUnit: 'mg' }).text, '0.55 mL');
assert.equal(engine.setConcentration('SAM', 100000, 'ug'), true);
assert.equal(engine.calculate('SAM', '22mpk', '5 kg').text, '1.10 mL');
assert.equal(engine.setConcentration('SAM', 0, 'mg'), false);
assert.equal(engine.setConcentration('SAM', null), true);
assert.equal(engine.calculate('SAM', '22mpk', '5 kg').text, '0.73 mL');
assert.equal(engine.setConcentration('G-CSF', 250, 'ug'), true);
assert.equal(engine.calculate('G-CSF', '', '1 kg').text, '0.02 mL');
engine.setConcentration('G-CSF', null);
assert.equal(ctx.api.doseFromInstruction('22mpk'), '22mpk');
assert.equal(ctx.api.doseFromInstruction('용량: 22'), '22');
assert.equal(ctx.api.doseFromInstruction('2번'), '');
assert.equal(ctx.api.doseFromInstruction('1시간 후'), '');
assert.deepEqual(JSON.parse(JSON.stringify(ctx.api.dilutionFrom('enro 5 1:1 희석'))),
  { label: '1:1 희석', nsRatio: 1, valid: true, warning: '' });
assert.equal(ctx.api.dilutionFrom('enro 5 4배 희석').valid, false);
assert.equal(ctx.api.dilutionFrom('enro51:1 희석').valid, false);
assert.deepEqual(JSON.parse(JSON.stringify(ctx.api.parseDrug('enro 5 1:1 희석'))),
  { drug: 'enro', dose: '5', route: '', frequency: '', note: '' });
const instructionOnlyDetail = { sections: [{ section: 'TREATMENT', rows: [{
  displayName: 'SAM IV TID', instructionText: '22mpk', cells: [{ hourSlot: 17, status: 'PLANNED' }],
}]}] };
const instructionOnlyChart = { discharged: false, cageLabel: 'A1', patient: { patientId: 'instruction-only', name: '지시사항', hospitalPatientCode: '1', breed: '믹스' } };
assert.equal(ctx.api.pickInj(instructionOnlyChart, instructionOnlyDetail, '2026-09-16', [17], '오늘', true, '5 kg')[0].dose, '22mpk');
const meloxicamRows = ctx.api.pickInj(instructionOnlyChart, { sections: [{ section: 'TREATMENT', rows: [{
  displayName: 'Meloxicam', cells: [{ hourSlot: 17, status: 'PLANNED' }],
}]}] }, '2026-09-16', [17], '오늘', true, '5 kg');
assert.equal(meloxicamRows[0].route, 'SC');
const slashDetail = { sections: [{ section: 'TREATMENT', rows: [{
  displayName: 'Chlorpheniramine 0.2 / Maropitant 1', cells: [{ hourSlot: 17, status: 'PLANNED' }],
}]}] };
const slashRows = ctx.api.pickInj(instructionOnlyChart, slashDetail, '2026-09-16', [17], '오늘', true, '5 kg');
assert.deepEqual(JSON.parse(JSON.stringify(slashRows.map((item) => [item.drug, item.dose]))),
  [['Chlorpheniramine', '0.2'], ['Maropitant', '1']]);
assert.deepEqual(JSON.parse(JSON.stringify(slashRows.map((item) => engine.calculate(item.drug, item.dose, '5 kg').text))),
  ['0.50 mL', '0.50 mL']);
const prnDetail = { sections: [{ section: 'TREATMENT', rows: [{
  displayName: 'Maropitant 1mpk IV', instructionText: 'PRN', cells: [{ hourSlot: 17, status: 'PLANNED' }],
}]}] };
const prnRows = ctx.api.pickInj(instructionOnlyChart, prnDetail, '2026-09-16', [17], '오늘', true, '5 kg');
assert.equal(prnRows[0].instruction, '');
assert.equal(ctx.api.makeSnapshot(prnRows).patients['instruction-only'].items[0].conditional, true);
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
const ampules = ctx.api.ampuleNeeds(snapshot(
  row('SAM', '', 17), row('SAM', '', 21), row('SAM', '', 1, true),
  row('Famotidine', '1mpk', 17), row('Famotidine', '1mpk', 21),
  {...row('Tramadol', '', 17), conditional: true},
));
assert.deepEqual(JSON.parse(JSON.stringify(ampules.map((item) => [item.drug, item.count, item.unresolved]))),
  [['SAM', 1, 0], ['Famotidine', 1, 0]]);
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
assert.doesNotMatch(html, /추가 준비|용량·경로 재확인|\[추가\]|\[삭제\]/);
assert.match(html, /color:#b45309[^>]+><strong[^>]*>Maropitant<\/strong> · 21시 · IV/);
const skip = ctx.api.compareSnapshot(snapshot(row('SAM', '', 17, true)), sam, {});
assert.doesNotMatch(skip.normal[0].body[0], /빼기|삭제/);
const removed = ctx.api.compareSnapshot(snapshot(), sam, {});
assert.doesNotMatch(removed.normal[0].body[0], /빼기|삭제/);
assert.match(removed.normal[0].body[0], /0.73 mL/);
assert.equal(snapshot(row('vit K', '2mpk'), row('vitamin K', '2mpk', 21)).patients.test.items.length, 1);
const frequencyShift = snapshot(
  { ...row('vit K', '2', 21), frequency: 'BID', note: 'BID', instruction: 'BID' },
  { ...row('vitamin K', '2mpk', 9), tag: '내일', order: 109, frequency: 'SID', note: 'SID', instruction: 'SID' },
);
assert.equal(frequencyShift.patients.test.items.length, 1);
assert.equal(frequencyShift.patients.test.items[0].dose, '2mpk');
assert.deepEqual(JSON.parse(JSON.stringify(frequencyShift.patients.test.items[0].times.map((time) => time.frequency))), ['BID', 'SID']);
assert.equal(engine.calculate('Unknown', '2mpk', '5 kg', '', { concentration: 10, concentrationUnit: 'mg' }).text, '1.00 mL');
assert.equal(engine.calculate('Unknown', '2mpk', '5 kg', '', { concentration: 10000, concentrationUnit: 'ug' }).text, '1.00 mL');
assert.equal(engine.calculate('Unknown', '2000ug/kg', '5 kg', '', { concentration: 10, concentrationUnit: 'mg' }).text, '1.00 mL');
assert.equal(engine.calculate('enro', '', '7.69 kg', '1:1 희석').text, '1.54 mL');
assert.deepEqual(JSON.parse(JSON.stringify(ctx.api.parseDrug('enro 1:1 희석'))),
  { drug: 'enro', dose: '', route: '', frequency: '', note: '' });
const diluted = snapshot({ ...row('enro', '', 17, false, '7.69 kg'), dilution: { label: '1:1 희석', nsRatio: 1 } });
const dilutedHtml = ctx.api.render([{ heading: '주사', groups: ctx.api.compareSnapshot(diluted, null, {}).normal }]);
assert.match(dilutedHtml, /1\.54 mL \+ NS 1\.54 mL/);
assert.match(dilutedHtml, /1:1 희석/);
const parsedDilutionRows = ctx.api.pickInj(instructionOnlyChart, { sections: [{ section: 'TREATMENT', rows: [{
  displayName: 'enro 5 1:1 희석', cells: [{ hourSlot: 17, status: 'PLANNED' }],
}]}] }, '2026-09-16', [17], '오늘', true, '7.69 kg');
assert.equal(parsedDilutionRows[0].drug, 'enro');
assert.equal(parsedDilutionRows[0].dose, '5');
assert.equal(parsedDilutionRows[0].dilution.valid, true);
const overDilutionRows = ctx.api.pickInj(instructionOnlyChart, { sections: [{ section: 'TREATMENT', rows: [{
  displayName: 'enro 5 4배 희석', cells: [{ hourSlot: 17, status: 'PLANNED' }],
}]}] }, '2026-09-16', [17], '오늘', true, '7.69 kg');
const overDilution = ctx.api.makeSnapshot(overDilutionRows);
assert.equal(overDilution.patients['instruction-only'].items[0].calculation.text, '희석 확인 필요');
const overDilutionHtml = ctx.api.render([{ heading: '주사', groups: ctx.api.compareSnapshot(overDilution, null, {}).normal }]);
assert.match(overDilutionHtml, /4배 희석 확인 필요/);
assert.doesNotMatch(overDilutionHtml, /NS/);
const manualSnapshot = snapshot({ ...row('Unknown', ''), weight: '- kg' });
const manualHtml = ctx.api.render([{ heading: '수기 입력', groups: ctx.api.compareSnapshot(manualSnapshot, null, {}).normal }]);
assert.match(manualHtml, /data-manual-box/);
assert.match(manualHtml, /data-manual="concentration"/);
assert.match(manualHtml, /placeholder="역가"/);
assert.doesNotMatch(manualHtml, /<span[^>]*>수기<\/span>/);
assert.match(manualHtml, /data-patient-weight/);
assert.doesNotMatch(manualHtml, /data-manual="weight"/);
assert.doesNotMatch(manualHtml, /몸무게 입력 안됨|역가 입력 안됨|IU\/mL/);
assert.match(manualHtml, /option value="mpk" selected/);
assert.match(manualHtml, /option value="mg" selected/);
console.log('2.0 계산·별칭·추가·제외·체중 변경 테스트 통과');
if (process.argv.includes('--preview')) {
  const body = ctx.api.render([{ heading: 'VetSync 2.0 · 예시 환자', groups: diff.normal },
    { heading: '제외 변경 예시', groups: skip.normal }, { heading: '삭제 예시', groups: removed.normal },
    { heading: '정보 부족 예시', groups: ctx.api.compareSnapshot(manualSnapshot, null, {}).normal }]);
  fs.writeFileSync('preview-v2.html', '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>VetSync 2.0 예시</title><style>body{margin:0;padding:16px;font:15px/1.5 system-ui;background:#fff;color:#111827;overflow-wrap:anywhere}main{max-width:900px;margin:auto}</style><main>' + body + '</main></html>');
}
