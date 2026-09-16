// Data is exported from vet_calculator's DEFAULT_DRUGS by sync-drug-data.js.
const createDoseEngine = (drugs) => {
  const normalize = (s) => String(s || '').toLowerCase().replace(/[\s._-]+/g, '');
  const aliases = [
    ['SAM', '유니설암', '설밤'], ['Famotidine', 'famo', '파모', '모틴'],
    ['Maropitant', 'maro', 'cerenia', '세레니아'], ['Enrofloxacin', 'enro', '바이트릴'],
    ['Vitamin K', 'vit k', '비타민k'], ['Metoclopramide', 'meto'],
    ['Cefazolin', 'cefa'], ['Ondansetron', 'ondan', '온단세트론'],
    ['Omeprazole', '오메프라졸'], ['Carprofen'],
    ['Marbofloxacin', 'marbo', '마보', 'marbocyl'], ['Tramadol', 'tra', '트라마돌'],
    ['Tranexamic acid', 'TXA', '트라넥삼산'], ['Dalteparin', 'dalte', 'datle'],
    ['G-CSF', 'g-csf', 'gcsf', '류코스팀'],
    ['Chlorpheniramine', 'chloropheniramine', 'chlorpeniramine', '클로르페니라민'],
    ['Meloxicam', 'melo'], ['Meropenem', 'mero'],
  ];
  const byAlias = new Map();
  aliases.forEach(([name, ...other]) => {
    const record = drugs.find((d) => d.name.split(' (')[0] === name);
    if (record) [name, ...other].forEach((a) => byAlias.set(normalize(a), { ...record, name }));
  });
  const find = (name) => byAlias.get(normalize(name));
  const volumeText = (n) => n >= 0.01 ? n.toFixed(2) : n.toPrecision(2);
  const calculate = (name, written, weight, instruction = '', overrides = {}) => {
    const drug = find(name);
    const fail = (reason) => ({ text: reason, basis: written || '', volume: null });
    let dose = String(overrides.written || written || '').replace(/\s/g, '').toLowerCase();
    if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(dose)) dose += 'mpk';
    if (dose.startsWith('.')) dose = '0' + dose;
    // Conflicting or additional dosing instructions must not silently use a default.
    if (/용량 불일치/.test(instruction) && !overrides.written) return fail('용량 불일치');
    if (/\d\s*(?:mpk|mg|ml|mcg|ug|iu|cc)|희석|농도/i.test(instruction) && !overrides.written) return fail('용량 확인 필요');
    if (/^\d+(?:\.\d+)?(?:ml|cc)$/.test(dose)) {
      const volume = parseFloat(dose);
      return volume > 0 ? { volume, text: volumeText(volume) + ' mL', basis: '차트 mL' } : fail('용량 확인 필요');
    }
    if (!drug && !dose) return fail('용량·농도 확인 필요');
    let value = drug && drug.dose, unit = drug && (drug.unit || 'mg'), perKg = true, origin = '기본';
    if (dose) {
      const match = dose.match(/^(\d+(?:\.\d+)?)(mpk|mg\/kg|gpk|ug\/kg|mcg\/kg|iu\/kg|u\/kg|ml\/kg|mg|mg\/dog|mg\/cat)$/);
      if (!match) return fail('용량 확인 필요');
      value = Number(match[1]); origin = '차트';
      const u = match[2];
      perKg = !['mg', 'mg/dog', 'mg/cat'].includes(u);
      unit = /^(iu|u)\//.test(u) ? 'IU' : /^(ug|mcg)\//.test(u) ? 'ug' : u === 'ml/kg' ? 'mL' : 'mg';
      if (u === 'gpk') value *= 1000;
    }
    const kg = /^\d+(?:\.\d+)? kg$/.test(weight || '') ? parseFloat(weight) : NaN;
    if (perKg && !(kg > 0)) return fail('체중 확인 필요');
    if (!(value > 0)) return fail('용량 확인 필요');
    const manualConc = Number(overrides.concentration);
    const manualUnit = overrides.concentrationUnit || '';
    if (manualConc > 0 && !manualUnit) return fail('농도 단위 확인 필요');
    if (!drug && !(manualConc > 0)) return fail('농도 미등록');
    const drugUnit = drug && (drug.unit || 'mg');
    if (unit !== 'mL' && manualUnit && unit !== manualUnit) return fail('단위 확인 필요');
    if (unit !== 'mL' && !manualUnit && drug && ((unit === 'IU') !== (drugUnit === 'IU'))) return fail('단위 확인 필요');
    const conc = manualConc > 0 ? manualConc : drug && drug.conc;
    if (unit !== 'mL' && !(conc > 0)) return fail('농도 확인 필요');
    const concentrationUnit = manualUnit || drugUnit;
    const conversion = !manualUnit && unit === 'ug' ? 0.001 :
      unit === 'ug' && concentrationUnit === 'mg' ? 0.001 :
        unit === 'mg' && concentrationUnit === 'ug' ? 1000 : 1;
    const volume = value * (perKg ? kg : 1) * conversion / (unit === 'mL' ? 1 : conc);
    const doseUnit = perKg ? (unit === 'mg' ? 'mpk' : unit === 'ug' ? 'µg/kg' : unit + '/kg') : unit;
    const doseText = value + ' ' + doseUnit + (origin === '기본' ? '(기본)' : '');
    const concText = unit === 'mL' ? '' : (manualConc > 0 ? conc + ' ' + concentrationUnit + '/mL' : (drug.concentrationLabel ||
      conc + (drugUnit === 'IU' ? ' IU/mL' : drugUnit === 'ug' ? ' µg/mL' : ' mg/mL')));
    const nonDefault = !!drug && origin === '차트' && perKg && unit === drugUnit && value !== drug.dose;
    return { volume, text: volumeText(volume) + ' mL', doseText, concText, nonDefault,
      basis: doseText + (concText ? ' · ' + concText : '') };
  };
  return { find, calculate };
};
if (typeof module !== 'undefined') module.exports = createDoseEngine;
