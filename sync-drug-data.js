const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('../vet_calculator/index.html', 'utf8');
const start = html.indexOf('const DEFAULT_DRUGS = [');
const end = html.indexOf('\n];', start);
if (start < 0 || end < 0) throw new Error('Calculator defaults not found');
const records = vm.runInNewContext(html.slice(start, end + 3) + '\nDEFAULT_DRUGS');
fs.writeFileSync('drug-defaults.json', JSON.stringify(records.filter((d) => !d.combo && !d.tab), null, 2) + '\n');
