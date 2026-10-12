const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('../vet_calculator/index.html', 'utf8');
const start = html.indexOf('const DEFAULT_DRUGS = [');
const end = html.indexOf('\n];', start);
if (start < 0 || end < 0) throw new Error('Calculator defaults not found');
const records = vm.runInNewContext(html.slice(start, end + 3) + '\nDEFAULT_DRUGS');
const exported = records.filter((drug) => !drug.combo && !drug.tab);
for (const drug of [
  { name: 'Cefotaxime', dose: null, conc: 200, sc: false, note: '' },
  { name: 'Amikacin', dose: null, conc: 125, sc: false, note: '' },
]) {
  const index = exported.findIndex((record) => record.name === drug.name);
  if (index >= 0) exported[index] = { ...exported[index], conc: drug.conc };
  else exported.push(drug);
}
const sharedComboNames = new Set(['Chlorpheniramine']);
records.filter((drug) => drug.combo).flatMap((drug) => drug.items || []).forEach((item) => {
  if (sharedComboNames.has(item.name) && !exported.some((drug) => drug.name === item.name)) exported.push(item);
});
fs.writeFileSync('drug-defaults.json', JSON.stringify(exported, null, 2) + '\n');
