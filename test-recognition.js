// 실제 처치표에서 나온 표기로 주사·채혈 분류를 확인한다. (2026-11 점검)
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

let source = fs.readFileSync('vetsync-panel.src.js', 'utf8');
const tail = /\n  if \(!location\.hostname\.endsWith\('vetsync4\.vetu1\.com'\)\) \{[\s\S]*?\n  \}\n\}\)\(\);\s*$/;
assert.match(source, tail, '실행부를 찾지 못했다');
source = source.replace(tail, '\n  globalThis.__r = { isInjection, isLabAtDraw };\n})();\n');
const context = { location: { href: 'https://vetsync4.vetu1.com/', hostname: 'vetsync4.vetu1.com' } };
vm.createContext(context);
vm.runInContext(source, context);
const { isInjection, isLabAtDraw } = context.__r;
const lab = (name) => isLabAtDraw({ displayName: name, cells: [{ hourSlot: 9, status: 'PLANNED' }] });

// 주사로 잡아야 하는 것
['SAM 22', 'sam22', 'famo0.5', 'Meto', 'Leve 20', 'Cefotaxime 40', 'amikacin 10->15mpk',
  'Calcium gluconate 10% 1mg/kg iv for 30min', '브렌다 0.5ml iv', '브렌다 0.5ml', 'fuzapladib 0.4mpk iv', 'tranexamic acid 10mpk 2min', 'Pheno 2mpk 천천히']
  .forEach((n) => assert.ok(isInjection(n), '주사여야 함: ' + n));

// 주사에서 빼야 하는 것
['mida 0.2mpk iv PRN', 'mida 1ml iv PRN', 'Midazolam 1mpk',
  '포도당 20% 1ml/kg iv', '20%포도당 5ml iv', '20% 포도당 1ml slow iv', '20%Dex 1ml slow iv',
  'tranexamic acid 10ml/h 3시간', 'Tranexamic acid 10mg/kg/kr for 3hours',
  'Furosemide 1mg/kg/hr CRI', 'HSS 3ml/kg slow IV', 'HHS 7.5% 3ml/kg IV', 'NaHCO3 2cc/kg(주사용수 3배희석) for 1hr', 'NaHCO3 2cc/kg iv for 1hr', 'metro 15', 'R 인슐린 1U im', '캐닌슐린 15칸 SC', '항생제 PO', '심장약']
  .forEach((n) => assert.ok(!isInjection(n), '주사가 아님: ' + n));

// 채혈
['혈검 (CRP)', 'crp', '신4 가스 CRP', 'BUN CREA PHOS 가스', '채혈: cbc, crp, t.bil', '혈검 CBC CRP/지혈오래', '간이혈당', '케톤', '혈검(가스, 케톤)']
  .forEach((n) => assert.ok(lab(n), '채혈이어야 함: ' + n));
['바로박체크 (ml, 양상)', '흉부방사선']
  .forEach((n) => assert.ok(!lab(n), '채혈 목록이 아님: ' + n));

console.log('recognition ok');
