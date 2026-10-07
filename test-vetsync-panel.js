const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

let source = fs.readFileSync('vetsync-panel.src.js', 'utf8');
source = source.replace(
  "  if (!location.hostname.endsWith('vetsync4.vetu1.com')) {\n    alert('VetSync 화면에서 눌러주세요.');\n  } else if (window.__VETSYNC_BUTTON) {\n    mountButton();\n    // 화면이 다시 그려지면서 버튼이 사라질 수 있으므로 주기적으로 확인한다\n    setInterval(mountButton, 3000);\n  } else {\n    open();\n  }",
  '  globalThis.__test = { compareSnapshot, render, asText, rawItem, toHtml, patientTitleHtml, sortSections, latestWeight, yesterdayWeights, unextendedBloodRows, cache, pickInj, checkedTime, breedOf, flkValues, calculateFlk, ampuleNeeds, preparationSignature, preparationEntries, filterInjectionSnapshot, injectionDisplay };'
);
const context = {};
vm.createContext(context);
vm.runInContext(source, context);

const item = (drug, dose, route, times, extra = {}) => ({
  match: drug.toLowerCase(), drug, dose, route, frequency: '', note: '', instruction: '', conditional: false,
  times: times.map(([tag, hour, order, cancelled]) => ({ tag, hour, order, cancelled: !!cancelled })), ...extra,
});
const patient = (name, predicted, items) => ({
  pid: name, name, code: '12345', breed: '푸들', weight: '5.2 kg', cage: 'A1', predicted, items,
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

assert.strictEqual(compared.changes, 2);
assert.deepStrictEqual({ ...compared.changeKinds }, { changed: 2 });
assert.strictEqual((html.match(/\[변경\]/g) || []).length, 2);
assert.match(html, /쪼코 .*5\.2 kg.*#12345 · 푸들/);
assert.match(html, /background:#fef08a[^>]+>연장<\/span>/);
assert.match(html, /SAM <span[^>]+>22mpk<\/span>→<span[^>]+>20mpk<\/span> IV/);
assert.match(html, /<span[^>]+>내일 9시<\/span>/);
assert.match(html, /line-through[^>]+><u style="font-weight:800">내일 1시<\/u><\/span>/);
assert.match(html, /maro 1mpk <u style="font-weight:800">SC<\/u> \(21시\)/);
assert.match(html, /color:#b45309[^>]+>B12 <u style="font-weight:800">IM<\/u> \(18시\)<\/span>/);
assert.match(html, /퇴원환자 .*5\.2 kg.*#12345 · 푸들/);
assert.match(html, /text-decoration:line-through[^>]+>퇴원<\/span>/);
assert.match(html, /line-through[^>]+>cefa 20mpk IV \(17시\)<\/span>/);
assert.doesNotMatch(html, />삭제<\/span>|>추가<\/span>/);
assert.match(html, /border-left:3px solid #64748b/);
assert.ok(!html.includes('>SAM</span>'));
assert.ok(text.includes('쪼코 (5.2 kg · #12345 · 푸들) A1 [연장]'));
assert.ok(text.includes('maro 1mpk **__SC__** (21시)'));
assert.ok(!text.includes('[추가]'));
assert.ok(!text.includes('[삭제]'));
assert.ok(text.includes('~~cefa 20mpk IV (17시)~~'));

const oldWeight = patient('체중변경', false, [item('SAM', '22mpk', 'IV', [['오늘', 17, 17]])]);
oldWeight.weight = '4.8 kg';
const newWeight = patient('체중변경', false, [item('SAM', '22mpk', 'IV', [['오늘', 17, 17]])]);
newWeight.weight = '5.15 kg';
const weightChange = context.__test.compareSnapshot(
  { patients: { weight: newWeight } }, { patients: { weight: oldWeight } }, {}
);
assert.strictEqual(weightChange.changes, 1);
assert.strictEqual(weightChange.changeKinds.changed, 1);
assert.strictEqual(weightChange.normal[0].previousWeight, '4.8 kg');
const weightChangeSections = [{ heading: '주사', groups: weightChange.normal }];
assert.match(context.__test.render(weightChangeSections), /4\.8 kg<\/span>→<span[^>]+>5\.15 kg<\/span>/);
assert.ok(context.__test.asText(weightChangeSections).includes('[체중 4.8 kg→5.15 kg]'));

const unchanged = context.__test.compareSnapshot(current, JSON.parse(JSON.stringify(current)), states);
assert.strictEqual(unchanged.changes, 0);
assert.ok(!context.__test.render([{ heading: '주사', groups: unchanged.normal }]).includes('[변경]'));
assert.ok(!context.__test.render([{ heading: '주사', groups: unchanged.normal }]).includes('color:#c2410c'));

const bloodTitleHtml = context.__test.patientTitleHtml('솜이(오*호) (#12345 · 말티즈)');
assert.match(bloodTitleHtml, /솜이\(오\*호\).*#12345 · 말티즈/);
assert.doesNotMatch(bloodTitleHtml, /font-size:15px[^>]+>#12345/);
const manualWeightHtml = context.__test.patientTitleHtml('체중없음 (- kg · #999 · 믹스)', '', true, '5.2', 'p-weight');
assert.match(manualWeightHtml, /placeholder="체중"/);
assert.match(manualWeightHtml, /text-align:center/);
assert.match(manualWeightHtml, /<span[^>]*>kg<\/span>/);
assert.strictEqual(context.__test.breedOf({ breed: null }), '품종 미상');
assert.strictEqual(context.__test.breedOf({ breed: { name: '푸들' } }), '푸들');

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

const cancelledLast = context.__test.toHtml(context.__test.rawItem(item('SAM', '22mpk', 'IV', [
  ['오늘', 17, 17], ['내일', 1, 101], ['내일', 9, 109, true],
], { frequency: 'TID' })));
assert.match(cancelledLast, /border:1px solid #9ca3af[^>]+>제외: 내일 9시<\/span>/);
assert.doesNotMatch(cancelledLast, /line-through|마지막 시간 취소/);

const cancelledMiddle = context.__test.toHtml(context.__test.rawItem(item('SAM', '22mpk', 'IV', [
  ['오늘', 17, 17], ['오늘', 21, 21, true], ['내일', 1, 101], ['내일', 9, 109],
], { frequency: 'QID' })));
assert.match(cancelledMiddle, /17시.*제외: 21시.*내일 1시.*내일 9시/);

const cancelledOnly = context.__test.toHtml(context.__test.rawItem(item('SAM', '22mpk', 'IV', [
  ['오늘', 21, 21, true],
], { frequency: 'SID' })));
assert.match(cancelledOnly, /line-through[^>]+>SAM 22mpk IV/);
assert.ok((cancelledOnly.match(/line-through/g) || []).length >= 2);
assert.match(html, /border-bottom:2px solid #94a3b8/);
const bloodHtml = context.__test.render([{ heading: '채혈', groups: compared.normal }], 'blood');
assert.doesNotMatch(bloodHtml, /border-bottom:2px solid #94a3b8/);
assert.match(bloodHtml, /border-bottom:1px solid #e5e7eb/);

const multipleAdds = context.__test.compareSnapshot(
  { patients: { one: patient('추가환자', false, [
    item('B12', '', 'IM', today(18)), item('DPO', '', 'SC', today(19)),
  ]) } },
  { patients: { one: patient('추가환자', false, []) } },
  {}
);
assert.strictEqual(multipleAdds.changes, 1);
assert.strictEqual(multipleAdds.changeKinds.changed, 1);

const activeSam = patient('취소변경', false, [item('SAM', '22mpk', 'IV', [
  ['오늘', 17, 17], ['내일', 1, 101], ['내일', 9, 109],
], { frequency: 'TID' })]);
const cancelledSam = patient('취소변경', false, [item('SAM', '22mpk', 'IV', [
  ['오늘', 17, 17], ['내일', 1, 101], ['내일', 9, 109, true],
], { frequency: 'TID' })]);
const cancelledChange = context.__test.compareSnapshot(
  { patients: { cancelled: cancelledSam } }, { patients: { cancelled: activeSam } }, {}
);
assert.strictEqual(cancelledChange.changes, 1);
assert.strictEqual(cancelledChange.normal[0].updated, true);
const cancelledChangeHtml = context.__test.render([{ heading: '주사', groups: cancelledChange.normal }]);
assert.match(cancelledChangeHtml, /제외: 내일 9시/);
assert.doesNotMatch(cancelledChangeHtml, /내일 9시<\/u> 취소|마지막 시간 취소/);
assert.strictEqual((cancelledChangeHtml.match(/내일 9시/g) || []).length, 1);

const reviewText = context.__test.asText([{ heading: '주사', reviewNote: '이전 확인 15:03 → 현재 확인 16:12', groups: [] }]);
assert.ok(reviewText.includes('이전 확인 15:03 → 현재 확인 16:12'));
assert.strictEqual(context.__test.checkedTime('2026-09-12T06:03:00.000Z'), '15:03');

const bloodChart = {
  discharged: false, cageLabel: 'A장-3',
  patient: { patientId: 'not-extended', name: '미연장환자', hospitalPatientCode: '444', breed: '믹스', species: 'DOG' },
};
const unextended = context.__test.unextendedBloodRows([bloodChart], [{}], [], '2026-09-12');
assert.strictEqual(unextended.length, 1);
assert.deepStrictEqual(Array.from(unextended[0].body), ['연장되지 않음']);
assert.strictEqual(context.__test.unextendedBloodRows([bloodChart], [{}], [{ ...bloodChart, discharged: false }], '2026-09-12').length, 0);

const weightDetail = { sections: [{ rows: [{
  measurementRole: 'WEIGHT', displayName: '체중', cells: [
    { hourSlot: 8, resultSlots: [{ value: '4.8' }] },
    { hourSlot: 10, resultSlots: [{ value: '5.15 kg' }] },
  ],
}] }] };
const weightChart = { patient: {} };
assert.strictEqual(context.__test.latestWeight(weightDetail, weightChart), '5.15 kg');
assert.strictEqual(context.__test.latestWeight({ sections: [] }, weightChart), '- kg');
context.__test.cache['2026-09-11'] = {
  charts: [{ patient: { patientId: 'previous-weight', weight: 4.8 } }],
  details: [weightDetail],
};

const skippedChart = {
  discharged: false, cageLabel: 'A장-1',
  patient: { patientId: 'p3', name: '취소환자', hospitalPatientCode: '333', breed: '믹스', weight: 6.2 },
};
const skippedDetail = { sections: [{ section: 'TREATMENT', rows: [{
  displayName: 'SAM 22mpk IV TID', instructionText: '', cells: [
    { hourSlot: 17, status: 'PLANNED' }, { hourSlot: 21, status: 'SKIPPED' },
  ],
}] }] };
const actualRows = context.__test.pickInj(skippedChart, skippedDetail, '2026-09-12', [17, 21], '오늘');
assert.strictEqual(actualRows.length, 2);
assert.strictEqual(actualRows[1].cancelled, true);
assert.strictEqual(actualRows[0].weight, '6.2 kg');
const predictedRows = context.__test.pickInj(skippedChart, skippedDetail, '2026-09-12', [17, 21], '내일', false);
assert.strictEqual(predictedRows.length, 1);

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

const readySnapshot = { checkedAt: '2026-10-07T06:00:00Z', patients: {
  ready: patient('준비환자', false, [item('SAM', '22mpk', 'IV', [['오늘', 17, 17], ['내일', 1, 101]], {
    calculation: { volume: .5, text: '0.50 mL', basis: '22 mpk · 150 mg/mL' },
  })]),
} };
readySnapshot.patients.ready.pid = 'ready';
const readyEntries = context.__test.preparationEntries(readySnapshot);
const readyEntry = readyEntries[0];
const readyRecords = Object.fromEntries(readyEntries.map((entry) => [entry.id, JSON.parse(JSON.stringify({ ...entry,
  patient: { ...entry.patient, items: [] }, preparedAt: '2026-10-07T06:01:00Z',
}))]));
readyRecords['@patient:ready'] = { pid: 'ready', completed: true, patient: { ...readyEntry.patient, items: [] } };
const readySections = [{ heading: '주사', groups: [] }];
readySections.snapshot = readySnapshot;
readySections.previousSnapshot = JSON.parse(JSON.stringify(readySnapshot));
readySections.states = {};
let readyView = context.__test.injectionDisplay(readySections, '', readyRecords);
let readyHtml = context.__test.render(readyView.display, 'inj');
assert.match(readyHtml, /data-patient-ready="ready" checked/);
assert.doesNotMatch(readyHtml, /data-ready-confirm/);
assert.strictEqual((readyHtml.match(/data-patient-ready=/g) || []).length, 1);
assert.doesNotMatch(readyHtml, /data-ready=/);
assert.match(readyHtml, /vsp-treatment-prepared/);
readySections.snapshot = JSON.parse(JSON.stringify(readySnapshot));
readySections.snapshot.patients.ready.items[0].calculation = { volume: .7, text: '0.70 mL', basis: '22 mpk · 150 mg/mL' };
readyView = context.__test.injectionDisplay(readySections, '오늘|17', readyRecords);
readyHtml = context.__test.render(readyView.display, 'inj');
assert.match(readyHtml, /data-patient-ready="ready" checked/);
assert.doesNotMatch(readyHtml, /vsp-treatment-prepared/);
assert.match(readyHtml, /data-ready-confirm/);
assert.match(readyHtml, /vsp-ready-before">0.50 mL · IV/);
assert.match(readyHtml, /vsp-ready-now">→ 0.70 mL · IV/);
assert.strictEqual(readyView.snapshot.patients.ready.items[0].times.length, 1);
assert.strictEqual(readySections.snapshot.patients.ready.items[0].times.length, 2);
assert.strictEqual(readyRecords[readyEntry.id].item.calculation.volume, .5);
// 목록의 변경 확인 후에도 준비 시점과의 비교는 남는다.
readySections.previousSnapshot = JSON.parse(JSON.stringify(readySections.snapshot));
assert.match(context.__test.render(context.__test.injectionDisplay(readySections, '', readyRecords).display, 'inj'), /data-ready-confirm/);
// 삭제·퇴원 후 기준을 갱신해도 준비했던 주사는 남는다.
readySections.snapshot = { checkedAt: readySnapshot.checkedAt, patients: {} };
readySections.previousSnapshot = JSON.parse(JSON.stringify(readySections.snapshot));
readySections.states = { ready: { discharged: true } };
readyView = context.__test.injectionDisplay(readySections, '', readyRecords);
readyHtml = context.__test.render(readyView.display, 'inj');
assert.match(readyHtml, /data-patient-ready="ready" checked/);
assert.match(readyHtml, /data-ready-confirm/);
assert.match(readyHtml, /vsp-ready-now">→ <s>0.50 mL · IV<\/s>/);
assert.match(readyHtml, />퇴원<\/span>/);
const removedObservation = readyView.observations.get(readyEntry.id);
const acknowledged = JSON.parse(JSON.stringify(readyRecords));
readyView.observations.forEach((observation, id) => { acknowledged[id].signature = observation.signature; });
assert.doesNotMatch(context.__test.render(context.__test.injectionDisplay(readySections, '', acknowledged).display, 'inj'), /data-ready-confirm/);
assert.strictEqual(context.__test.filterInjectionSnapshot(readySnapshot, '내일|1').patients.ready.items[0].times[0].hour, 1);
const movedSections = [{ heading: '주사', groups: [] }];
Object.assign(movedSections, { snapshot: JSON.parse(JSON.stringify(readySnapshot)),
  previousSnapshot: JSON.parse(JSON.stringify(readySnapshot)), states: {} });
movedSections.snapshot.patients.ready.items[0].times[0] = { tag: '오늘', hour: 21, order: 21, cancelled: false };
const movedView = context.__test.injectionDisplay(movedSections, '', readyRecords);
const movedHtml = context.__test.render(movedView.display, 'inj');
assert.match(movedHtml, /data-patient-ready="ready" checked/);
assert.match(movedHtml, /data-ready-confirm/);
assert.ok(movedView.observations.get(readyEntry.id).inactive);
const newTimeEntry = [...movedView.entries.values()].find((entry) => entry.time.hour === 21);
assert.ok(!readyRecords[newTimeEntry.id]);
const routeChanged = { ...readyEntry.item, route: 'SC' };
assert.notStrictEqual(context.__test.preparationSignature(routeChanged, readyEntry.time), readyEntry.signature);
const diluted = { ...readyEntry.item, dilution: { valid: true, nsRatio: 1, label: '1:1 희석' } };
assert.notStrictEqual(context.__test.preparationSignature(diluted, readyEntry.time), readyEntry.signature);
const duplicateSnapshot = JSON.parse(JSON.stringify(readySnapshot));
duplicateSnapshot.patients.ready.items.push(JSON.parse(JSON.stringify(duplicateSnapshot.patients.ready.items[0])));
const duplicateEntries = context.__test.preparationEntries(duplicateSnapshot);
assert.strictEqual(new Set(duplicateEntries.map((entry) => entry.id)).size, 4);
const addedSections = [{ heading: '주사', groups: [] }];
const addedSnapshot = JSON.parse(JSON.stringify(readySnapshot));
addedSnapshot.patients.ready.items.push(item('Maropitant', '1mpk', 'SC', [['오늘', 21, 21]], {
  calculation: { volume: .34, text: '0.34 mL', basis: '1 mpk · 10 mg/mL' },
}));
Object.assign(addedSections, { snapshot: addedSnapshot, previousSnapshot: addedSnapshot, states: {} });
const addedView = context.__test.injectionDisplay(addedSections, '', readyRecords);
assert.ok(addedView.display[0].groups[0].prepared);
assert.deepStrictEqual(Array.from(addedView.display[0].groups[0].preparationChanged, Boolean), [false, true]);
assert.strictEqual((context.__test.render(addedView.display, 'inj').match(/data-patient-ready=/g) || []).length, 1);
assert.ok(addedView.display[0].groups[0].readyChanged);
const noReady = context.__test.injectionDisplay(addedSections, '', {});
assert.doesNotMatch(context.__test.render(noReady.display, 'inj'), /vsp-treatment-prepared/);

context.__test.yesterdayWeights('2026-09-12', ['previous-weight']).then((weights) => {
  assert.strictEqual(weights.get('previous-weight'), '5.15 kg');
  console.log('VetSync 변경 비교 테스트 통과');
});
