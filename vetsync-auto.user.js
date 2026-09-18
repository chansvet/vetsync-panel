// ==UserScript==
// @name         VetSync 처치표 자동 열기
// @namespace    https://github.com/chansvet
// @version      2.1.15
// @description  VetSync 화면에 채혈·주사 목록 버튼을 추가합니다. 조회만 하고 차트는 수정하지 않습니다.
// @match        https://vetsync4.vetu1.com/*
// @run-at       document-start
// @inject-into  auto
// @noframes
// @grant        none
// @updateURL    https://chansvet.github.io/vetsync-panel/vetsync-auto.meta.js
// @downloadURL  https://chansvet.github.io/vetsync-panel/vetsync-auto.user.js
// ==/UserScript==

(() => {
  const TRIGGER = 'vetsync-panel-auto-open';
  const STARTED_AT = 'vetsync-panel-auto-open-at';
  const AUTH_RETRY = 'vetsync-panel-auth-retry';
  const WAIT_LIMIT_MS = 15 * 60 * 1000;
  if (new URL(location.href).searchParams.get('vetsync-panel') === '1') {
    sessionStorage.setItem(TRIGGER, '1');
    sessionStorage.setItem(STARTED_AT, String(Date.now()));
  };
  const launchPanel = (buttonOnly) => {
    if (buttonOnly) window.__VETSYNC_BUTTON = true;
    else delete window.__VETSYNC_BUTTON;
    (() => {
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
    if (/용량 불일치/.test(instruction) && !overrides.written) return fail('용량 불일치');
    if (/희석 확인 필요/.test(instruction)) return fail('희석 확인 필요');
    const instructionWithoutDilution = String(instruction || '')
    .replace(/\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?\s*희석|\d+(?:\.\d+)?\s*배\s*희석/ig, ' ')
    .trim();
    if (/\d\s*(?:mpk|mg|ml|mcg|ug|iu|cc)|농도/i.test(instructionWithoutDilution) && !overrides.written) {
    return fail('용량 확인 필요');
    }
    if (/^\d+(?:\.\d+)?(?:ml|cc)$/.test(dose)) {
    const volume = parseFloat(dose);
    return volume > 0 ? { volume, text: volumeText(volume) + ' mL', basis: '차트 mL' } : fail('용량 확인 필요');
    }
    if (!drug && !dose) return fail('용량·역가 확인 필요');
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
    if (manualConc > 0 && !manualUnit) return fail('역가 단위 확인 필요');
    if (!drug && !(manualConc > 0)) return fail('역가 미등록');
    const drugUnit = drug && (drug.unit || 'mg');
    const massUnitPair = ['mg', 'ug'].includes(unit) && ['mg', 'ug'].includes(manualUnit);
    if (unit !== 'mL' && manualUnit && unit !== manualUnit && !massUnitPair) return fail('단위 확인 필요');
    if (unit !== 'mL' && !manualUnit && drug && ((unit === 'IU') !== (drugUnit === 'IU'))) return fail('단위 확인 필요');
    const conc = manualConc > 0 ? manualConc : drug && drug.conc;
    if (unit !== 'mL' && !(conc > 0)) return fail('역가 확인 필요');
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
    const doseEngine = createDoseEngine([
    {
    "name": "SAM (유니설암)",
    "dose": 22,
    "conc": 150,
    "sc": false,
    "note": ""
    },
    {
    "name": "Famotidine (모틴)",
    "dose": 1,
    "conc": 10,
    "sc": false,
    "note": "1 or 0.5 mg/kg"
    },
    {
    "name": "Maropitant",
    "dose": 1,
    "conc": 10,
    "sc": false,
    "note": ""
    },
    {
    "name": "Enrofloxacin (바이트릴)",
    "dose": 5,
    "conc": 25,
    "sc": true,
    "note": ""
    },
    {
    "name": "Vitamin K",
    "dose": 1,
    "conc": 10,
    "sc": true,
    "note": ""
    },
    {
    "name": "Metoclopramide",
    "dose": 0.5,
    "conc": 5,
    "sc": true,
    "note": ""
    },
    {
    "name": "Cefazolin",
    "dose": 22,
    "conc": 200,
    "sc": false,
    "note": ""
    },
    {
    "name": "Ondansetron",
    "dose": 0.5,
    "conc": 2,
    "sc": false,
    "note": ""
    },
    {
    "name": "Omeprazole",
    "dose": 1,
    "conc": 10,
    "sc": false,
    "note": "차광필요"
    },
    {
    "name": "Carprofen",
    "dose": 2.2,
    "conc": 50,
    "sc": true,
    "note": "2.2 or 4.4 mg/kg"
    },
    {
    "name": "Marbofloxacin (Marbocyl)",
    "dose": 2,
    "conc": 10,
    "sc": false,
    "note": ""
    },
    {
    "name": "Tramadol",
    "dose": 4,
    "conc": 50,
    "sc": false,
    "note": ""
    },
    {
    "name": "Tranexamic acid (트라넥삼산)",
    "dose": 10,
    "conc": 100,
    "sc": false,
    "note": ""
    },
    {
    "name": "Dalteparin",
    "dose": 150,
    "conc": 2500,
    "unit": "IU",
    "sc": true,
    "note": ""
    },
    {
    "name": "G-CSF (류코스팀)",
    "dose": 5,
    "conc": 0.25,
    "unit": "ug",
    "sc": true,
    "concentrationLabel": "150 µg/0.6 mL",
    "note": "0.02 mL/kg"
    },
    {
    "name": "Meloxicam",
    "dose": 0.1,
    "conc": 5,
    "sc": false,
    "note": ""
    },
    {
    "name": "Meropenem",
    "dose": 8.5,
    "conc": 50,
    "sc": false,
    "note": ""
    },
    {
    "name": "Chlorpheniramine",
    "dose": 0.2,
    "conc": 2,
    "sc": false
    }
    ]
    );
    const API_ORIGIN = 'https://api-vetsync4.vetu1.com';
    const releasePrefix = () => {
    if (typeof document === 'undefined') return '';
    for (const script of Array.from(document.scripts || [])) {
    try {
    const match = new URL(script.src, location.href).pathname.match(/^(\/_releases\/[^/]+)/);
    if (match) return match[1];
    } catch (_) { /* 다음 스크립트를 확인한다. */ }
    }
    return '';
    };
    const API = API_ORIGIN + releasePrefix() + '/api/v1';
    const FALLBACK_HOSPITAL_ID = '24';
    const DRAW_HOUR = 9;
    const EVENING = [17, 18, 19, 20, 21, 22, 23];
    const NEXT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const ACTIVE = ['PLANNED', 'COMPLETED', 'IN_PROGRESS'];
    const CANCELLED_CELL = ['SKIPPED', 'CANCELLED'];
    const LAB = /혈검|혈액검사|도말|가스|전해질|신4|신장\s*4종|간4|간\s*4종|간이혈당|\bCBC\b|\bCRP\b|\bSAA\b|\bfSAA\b|\bSDMA\b|\bTnI\b|\bCPL\b|\bfPL\b|\bFPL\b|\bPCV\b|\bCK\b|\bChem\d*\b|\bgas\b|\blyte\b|\bTBIL\b|\bT\.?bil\b|\bBUN\b|\bCrea\b|\bALT\b|\bALP\b|\bALB\b|\bphos\b|\bTP\s*\/\s*A\w*\b|\bLactate\b/i;
    const NOT_LAB = /혈압|항혈전|고혈압|이뇨|수혈|요배양|요검사|뇨검사|요카|초음파|방사선|조직검사|항감테|내복|아이스팩|음수|배뇨|배변|CRI|스푼|산소|O2\s*supply/i;
    const ELECTROLYTE = /전해질|가스|\bgas\b|\blyte\b/i;
    const HANDLING = /팔|앞다리|뒷다리|후지|전지|경정맥|채혈|지혈|각각|나비침|희석|냉장/;
    const KNOWN = /SAM\s*\d|\bSAM\b|설밤|\bfamo\w*|파모|\bmaro\w*|세레니아|cerenia|\bmero\w*|\bmarbo\w*|마보|\benro\w*|\bcefa\w*|\bcepha\w*|cefotaxime|convenia|\bdalte\w*|\bdatle\w*|tramadol|트라마돌|\btra\s*\d|vit\.?\s?k|비타민k|\bmelo\w*|dexa\w*|덱사|ondansetron|\bondan\w*|온단세트론|파노퀠|calcium\s*gluconate|칼슘글루코네이트|칼슘글루콘산|\bfuro\w*|라식스|butor\w*|carprofen|tranexamic|\bTXA\b|amoxi\w*|clinda\w*|\bgent\w*|prednisolone|프레드|solu|atropine|glyco\w*|호의주|타우린|iron\s*dextran|hydroxocobalamin|cobalamin|G-?csf|\bDPO\b|romiplostim|로미플로스팀|프로롱갈|중탄산나트륨|esomeprazol\w*|eosmeprazol\w*|omeprazol\w*|오메프라졸|chlor\w*phenir\w*|클로르페니라민|\bleve\s*\d|levetiracetam|pheno\s*\d|phenobarbital|\bmeto\b/i;
    const ROUTE = /(?:^|[^a-z])(iv|sc|im)(?![a-z])/i;
    const SKIP = /metro\s*\d|metronidazol\w*|\bmetro\b|메트로|후라시닐|인슐린|insulin|슐린|glargine|글라진|란투스|lantus|프로진크|\bPZI\b|vetsulin|humulin|휴물린|novolin|노보믹스|노보래피드|mannitol|만니톨|\bNAC\b|acetylcystein\w*|20%\s*dex|피하수액|\bPPN\b|\bTPN\b/i;
    const PROC = /medetomidine|dexmed|midazolam|미다졸람|local\s*injection|펫소좀|propofol|alfaxa|ketamine|zoletil|xylazine|럼푼|마취|vincristine|vinblastine|doxorubicin|cyclophosphamide|carboplatin|cisplatin|lomustine|chlorambucil|cytarabine|asparaginase|mitoxantrone|toceranib|빈크리스틴|독소루비신|항암/i;
    const NONAME = /^(추가\s*)?(스테로이드약?|이뇨제|식욕촉진제|식촉제?|심장약|추가약|입원약\s*\d*|항혈전제|안정제|진정제|내복약|po제|간보호제|인흡착제|처방약|기타약|안약|영양제|항생제|진통제|소염제|항히스타민제|위장약|변비약|식후약|아침약|저녁약|\d+번약(\s*\+\s*\d+번약)*|퇴원약)(\s*PO)?$/i;
    const ORAL = /\bpo\b|po제|내복|경구|\d\s*[Tt]\b|\btab\b|캡슐|\bcap\b|시럽|스멕타|레나메진|인흡착제|간보호제|안정제|가바|갑상선약|알약|비오플|봉지|\d\s*알\b|\d\s*정\b|아조딜/i;
    const EYE = /양안|우안|좌안|점안|안약|리포직|포비돈|^V\d|^T\d|\bG\d\b/i;
    const NOTINJ = /드레싱|소독|사진|방사선|초음파|혈검|혈액검사|혈당|체중|체온|심박|호흡|혈압|구토|배변|배뇨|식이|산소|음수|물그릇|핫팩|자세|산책|라인|배액|세정|점이액|교체|측정|확인|보정|면회|목욕|미용|밴드|붕대|카테터|수혈|튜브|네뷸|가습|강급|급여|스푼|연고|스프레이|허니|술부|귀\s?세정|cryo|속도|변경|기입|흉방|요배양|검사|\bCRP\b/i;
    const CRI = /\bcri\b|\/\s*hr\b|시간당/i;
    const COND = /필요시|prn|경우\s*x|없을\s*경우|이면|이하시|이상시|시\s*연결|시\s*중단|보류/i;
    const FLUID_ORDER = /^\s*(?:H\s*\/\s*S|HS|FLK|(?:0\.\d+%?\s*)?N\s*\/\s*S|0\.45\s*NaCl)\b/i;
    const ROUTINE = [17, 21, 1, 9];
    const ROUTINE_BY_FREQUENCY = { BID: [21, 9], TID: [17, 1, 9] };
    const U0 = '\u0001', U1 = '\u0002';
    const E0 = '\u0003', E1 = '\u0004';
    const O0 = '\u0005', O1 = '\u0006';
    const X0 = '\u0007', X1 = '\u0008';
    const G0 = '\u0009', G1 = '\u000B';
    const A0 = '\uE000', A1 = '\uE001';
    const D0 = '\uE002', D1 = '\uE003';
    const B0 = '\uE004', B1 = '\uE005';
    const M0 = '\uE006', M1 = '\uE007', S0 = '\uE008', S1 = '\uE009';
    const Q0 = '\uE00C', Q1 = '\uE00D';
    const INJ_BASELINE = 'vetsync-injection-baseline-v3:';
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const shift = (date, n) => {
    const d = new Date(date + 'T00:00:00+09:00');
    d.setDate(d.getDate() + n);
    return ymd(d);
    };
    const currentHospitalId = () => {
    try {
    const context = JSON.parse(localStorage.getItem('hospital-context') || 'null');
    if (context?.state?.hospitalId) return String(context.state.hospitalId);
    const auth = JSON.parse(localStorage.getItem('auth-storage') || 'null');
    const active = (auth?.state?.memberships || []).filter((membership) => membership.status === 'ACTIVE');
    if (active.length === 1 && active[0].hospitalId) return String(active[0].hospitalId);
    } catch (_) { /* 이전 저장 형식이면 기존 병원 번호를 사용한다. */ }
    return FALLBACK_HOSPITAL_ID;
    };
    const headers = () => {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) throw new Error('로그인이 안 되어 있습니다.');
    const accessToken = JSON.parse(raw)?.state?.accessToken;
    if (!accessToken) throw new Error('로그인 정보가 없습니다. VetSync를 새로고침해 주세요.');
    return { Authorization: 'Bearer ' + accessToken, 'X-Hospital-Id': currentHospitalId() };
    };
    const get = async (path) => {
    const r = await fetch(API + path, { headers: headers() });
    if (r.status === 401) throw new Error('접속이 만료됐습니다. 새로고침하고 다시 눌러주세요.');
    if (r.status === 403) throw new Error('병원 접근 오류(403). VetSync를 새로고침한 뒤 다시 눌러주세요.');
    if (!r.ok) throw new Error('서버 응답 ' + r.status);
    return r.json();
    };
    const cache = {};
    const collect = async (date, force = false) => {
    if (!force && cache[date]) return cache[date];
    const list = await get('/charts?date=' + date);
    const details = await Promise.all(list.items.map((c) => get('/charts/' + c.chartId)));
    return (cache[date] = { charts: list.items, details });
    };
    const rowsOf = (d) => (d.sections || []).flatMap((s) => s.rows || []);
    const treatRows = (d) => (d.sections || []).filter((s) => s.section === 'TREATMENT').flatMap((s) => s.rows || []);
    const isLabAtDraw = (row) => {
    const name = (row.displayName || '').trim();
    return LAB.test(name) && !NOT_LAB.test(name) &&
    (row.cells || []).some((cell) => cell.hourSlot === DRAW_HOUR && ACTIVE.includes(cell.status));
    };
    const admitted = (chart, detail, date, hour) => {
    if (!chart.discharged) return true;
    if (!detail.dischargedAt) return false;
    return new Date(detail.dischargedAt) > new Date(date + 'T' + pad(hour) + ':00:00+09:00');
    };
    const latestTemp = (detail) => {
    const c = rowsOf(detail)
    .filter((r) => r.measurementRole === 'TEMPERATURE' || r.displayName === '체온')
    .flatMap((r) => r.cells || [])
    .map((x) => ({ h: x.hourSlot, v: (x.resultSlots || []).map((s) => s.value).filter(Boolean).join('/') }))
    .filter((x) => x.v)
    .sort((a, b) => a.h - b.h);
    return c.length ? c[c.length - 1] : null;
    };
    const weightValue = (value) => {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'object') {
    return weightValue(value.value ?? value.kg ?? value.weight ?? value.amount);
    }
    const match = String(value).trim().replace(',', '.').match(/^(\d+(?:\.\d+)?|\.\d+)\s*(kg|kgs|킬로|킬로그램|g|그램)?$/i);
    if (!match) return '';
    const kg = Number(match[1]) / (/^(g|그램)$/i.test(match[2] || '') ? 1000 : 1);
    return Number.isFinite(kg) && kg > 0 ? String(kg) + ' kg' : '';
    };
    const latestWeight = (detail, chart) => {
    const measured = rowsOf(detail)
    .filter((r) => /WEIGHT/i.test(r.measurementRole || '') || /^(체중|몸무게|weight)/i.test(r.displayName || ''))
    .flatMap((r) => (r.cells || []).map((cell) => ({
    hour: Number(cell.hourSlot) || 0,
    value: (cell.resultSlots || []).map((slot) => weightValue(slot.value)).find(Boolean) || '',
    })))
    .filter((entry) => entry.value)
    .sort((a, b) => a.hour - b.hour);
    if (measured.length) return measured[measured.length - 1].value;
    const candidates = [
    detail.latestWeight, detail.latestWeightKg, detail.weight, detail.weightKg,
    chart.patient.latestWeight, chart.patient.latestWeightKg, chart.patient.weight, chart.patient.weightKg,
    ];
    return candidates.map(weightValue).find(Boolean) || '- kg';
    };
    const yesterdayWeights = async (date, patientIds) => {
    const wanted = new Set(patientIds);
    if (!wanted.size) return new Map();
    const previousDate = shift(date, -1);
    let charts, details;
    if (cache[previousDate]) {
    const cached = cache[previousDate];
    const indices = cached.charts.map((chart, i) => wanted.has(String(chart.patient.patientId)) ? i : -1)
    .filter((i) => i >= 0);
    charts = indices.map((i) => cached.charts[i]);
    details = indices.map((i) => cached.details[i]);
    } else {
    const list = await get('/charts?date=' + previousDate);
    charts = list.items.filter((chart) => wanted.has(String(chart.patient.patientId)));
    details = await Promise.all(charts.map((chart) => get('/charts/' + chart.chartId)));
    }
    const weights = new Map();
    charts.forEach((chart, i) => {
    const weight = latestWeight(details[i], chart);
    if (weight !== '- kg') weights.set(String(chart.patient.patientId), weight);
    });
    return weights;
    };
    const noteOf = (row) => {
    if (row.instructionText) return row.instructionText.trim();
    const parts = row.displayName.split(/[,()[\]{}]/).map((s) => s.trim()).filter(Boolean);
    const hits = parts.filter((p) => HANDLING.test(p));
    return hits.length ? hits.join(', ') : '';
    };
    const breedOf = (patient = {}) => {
    const breed = patient.breedName || patient.breedLabel || patient.breedDisplayName ||
    patient.speciesBreed || patient.breed;
    if (breed && typeof breed === 'object') {
    return breed.name || breed.label || breed.displayName || '품종 미상';
    }
    return breed || '품종 미상';
    };
    const patientTitle = (name, code, breed, weight = '') => {
    const patientCode = code ? (String(code).startsWith('#') ? String(code) : '#' + code) : '';
    const info = [weight, patientCode, breed].filter(Boolean).join(' · ');
    return name + (info ? ' (' + info + ')' : '');
    };
    const unextendedBloodRows = (charts, details, nextCharts, date) => {
    const extended = new Set(nextCharts.filter((chart) => !chart.discharged)
    .map((chart) => String(chart.patient.patientId)));
    return charts.flatMap((chart, i) => {
    if (!admitted(chart, details[i], date, 18) || extended.has(String(chart.patient.patientId))) return [];
    const species = { DOG: '강아지', CAT: '고양이' }[chart.patient.species] || chart.patient.species;
    return [{
    title: patientTitle(chart.patient.name, chart.patient.hospitalPatientCode, breedOf(chart.patient)),
    cage: species + ' · ' + (chart.cageLabel || '미지정'),
    sortName: chart.patient.name,
    sortCage: chart.cageLabel || '미지정',
    body: ['연장되지 않음'],
    note: '',
    }];
    });
    };
    async function bloodwork(date) {
    const afterSix = new Date().getHours() >= 18;
    const targetDate = afterSix ? shift(date, 1) : date;
    const { charts, details } = await collect(targetDate);
    const rows = [];
    let needPrev = false;
    charts.forEach((chart, i) => {
    const detail = details[i];
    if (!admitted(chart, detail, targetDate, DRAW_HOUR)) return;
    const labs = rowsOf(detail).filter(isLabAtDraw);
    if (!labs.length) return;
    const hasE = labs.some((r) => ELECTROLYTE.test(r.displayName));
    const temp = hasE ? latestTemp(detail) : null;
    if (hasE && !temp) needPrev = true;
    const species = { DOG: '강아지', CAT: '고양이' }[chart.patient.species] || chart.patient.species;
    rows.push({
    title: patientTitle(chart.patient.name, chart.patient.hospitalPatientCode, breedOf(chart.patient)),
    cage: species + ' · ' + (chart.cageLabel || '미지정'),
    sortName: chart.patient.name,
    sortCage: chart.cageLabel || '미지정',
    body: [labs.map((r) => r.displayName.trim()).join(' / ')],
    note: [labs.map(noteOf).filter(Boolean).join(' / '), temp ? '체온 ' + temp.v : ''].filter(Boolean).join(' / '),
    pid: chart.patient.patientId,
    needTemp: hasE && !temp,
    });
    });
    if (needPrev) {
    const prev = await collect(shift(targetDate, -1));
    rows.forEach((row) => {
    if (!row.needTemp) return;
    const i = prev.charts.findIndex((c) => c.patient.patientId === row.pid);
    if (i < 0) return;
    const t = latestTemp(prev.details[i]);
    if (t) row.note = [row.note, '체온 ' + t.v + ' (전날)'].filter(Boolean).join(' / ');
    });
    }
    const sections = [{
    heading: targetDate + ' 오전 9시 채혈' + (afterSix ? ' · 다음날 차트 기준' : ''),
    groups: rows,
    }];
    if (afterSix) {
    const current = await collect(date);
    const pending = unextendedBloodRows(current.charts, current.details, charts, date);
    if (pending.length) sections.push({ heading: '연장되지 않음', warn: true, groups: pending });
    }
    return sections;
    }
    const isInjection = (name) => {
    const n = (name || '').trim();
    if (!n || NONAME.test(n)) return false;
    if (FLUID_ORDER.test(n)) return false;
    if (SKIP.test(n) || PROC.test(n) || CRI.test(n) || EYE.test(n) || NOTINJ.test(n) || ORAL.test(n)) return false;
    return ROUTE.test(n) || KNOWN.test(n) || /vitamin\s*k/i.test(n);
    };
    const frequencyFrom = (text) => {
    const value = String(text || '');
    const named = value.match(/\b(sid|bid|tid|qid)\b/i);
    if (named) return named[1].toUpperCase();
    const interval = value.match(/\bq\s*(6|8|12|24)\s*h\b/i);
    if (interval) return ({ 6: 'QID', 8: 'TID', 12: 'BID', 24: 'SID' })[interval[1]];
    const korean = value.match(/(?:하루|1일)\s*(1|2|3|4)\s*회/);
    return korean ? ({ 1: 'SID', 2: 'BID', 3: 'TID', 4: 'QID' })[korean[1]] : '';
    };
    function parseDrug(name) {
    let s = (name || '').trim();
    const notes = [];
    const frequency = frequencyFrom(s);
    s = s.replace(/^(sam|famo)(?=\d)/i, '$1 ');
    s = s.replace(/\bprn\b/ig, ' ');
    s = s.replace(/(^|[\s,;()[\]{}])\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?\s*(?:배\s*)?희석(?=$|[\s,;()[\]{}])/ig, '$1')
    .replace(/(^|[\s,;()[\]{}])\d+(?:\.\d+)?\s*배\s*희석(?=$|[\s,;()[\]{}])/ig, '$1');
    s = s.replace(/(\d+(?:\.\d+)?\s*\S*)\s*(?:->|→)\s*(\d)/g, '$2').replace(/\(\s*(\d+(?:\.\d+)?)\s*\)/g, ' $1 ');
    const pull = (re) => {
    const m = s.match(re);
    if (m) { notes.push(m[0].replace(/[()]/g, '').trim()); s = s.replace(re, ' '); }
    };
    pull(/\(([^)]*)\)/); pull(/\bfor\s+\d+\s*m(?:in)?\b/i); pull(/\d+\s*분(?:동안)?/);
    pull(/\bbolus\b/i); pull(/\bslow(?:ly)?\b/i); pull(/\bsid\b|\bbid\b|\btid\b|\bqid\b|\bq\d+h\b/i);
    let route = '';
    const r = s.match(ROUTE);
    if (r) { route = r[1].toUpperCase(); s = s.replace(ROUTE, ' '); }
    let dose = '';
    const d = s.match(/(\d+(?:\.\d+)?|\.\d+)\s*(mpk|gpk|mg\s*\/\s*kg|mg\s*\/\s*dog|mg\s*\/\s*cat|ml\s*\/\s*kg|ug\s*\/\s*kg|mcg\s*\/\s*kg|ug\s*\/\s*cat|IU\s*\/\s*kg|U\s*\/\s*kg|units?|칸|ml|mg|cc|amp)\b/i);
    if (d) { dose = d[0].replace(/\s+/g, ''); s = s.replace(d[0], ' '); }
    else {
    const b = s.match(/(?:^|\s)(\d+(?:\.\d+)?|\.\d+)(?=\s|$)/);
    if (b) { dose = b[1]; s = s.replace(b[0], ' '); }
    }
    const drug = s.replace(/\s+/g, ' ').trim().replace(/[,\-]+$/, '');
    return { drug, dose, route, frequency, note: notes.filter(Boolean).join(', ') };
    }
    const doseFromInstruction = (text) => {
    const value = String(text || '').trim();
    if (!value) return '';
    const parsed = parseDrug(value).dose;
    if (/(?:mpk|gpk|mg\/kg|mg\/dog|mg\/cat|ml\/kg|ug\/kg|mcg\/kg|iu\/kg|u\/kg|ml|mg|cc|amp)$/i.test(parsed)) return parsed;
    const bare = value.match(/^(?:복용약|dose|용량)?\s*[:：]?\s*\(?((?:\d+(?:\.\d+)?|\.\d+))\)?$/i);
    return bare ? bare[1] : '';
    };
    const dilutionFrom = (text) => {
    const value = String(text || '').toLowerCase();
    const ratio = value.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*(?:배\s*)?희석(?=$|[\s,;()[\]{}])/i);
    if (ratio) {
    const before = value[ratio.index - 1] || '';
    const drug = Number(ratio[1]);
    const ns = Number(ratio[2]);
    const factor = drug > 0 ? (drug + ns) / drug : Infinity;
    const valid = (!before || /[\s,;()[\]{}]/.test(before)) && drug > 0 && ns >= 0 && factor > 1 && factor <= 3;
    return {
    label: ratio[1] + ':' + ratio[2] + ' 희석', nsRatio: drug > 0 ? ns / drug : 0,
    valid, warning: valid ? '' : '희석 확인 필요',
    };
    }
    const times = value.match(/(\d+(?:\.\d+)?)\s*배\s*희석(?=$|[\s,;()[\]{}])/i);
    if (times) {
    const before = value[times.index - 1] || '';
    const factor = Number(times[1]);
    const valid = (!before || /[\s,;()[\]{}]/.test(before)) && factor > 1 && factor <= 3;
    return {
    label: times[1] + '배 희석', nsRatio: factor > 0 ? factor - 1 : 0,
    valid, warning: valid ? '' : '희석 확인 필요',
    };
    }
    return null;
    };
    const normalizedDose = (dose) => {
    let value = String(dose || '').toLowerCase().replace(/\s/g, '').replace('mg/kg', 'mpk').replace(/^\./, '0.');
    if (/^\d+(?:\.\d+)?$/.test(value)) value += 'mpk';
    return value;
    };
    const mergeDirective = (value) => String(value || '').toLowerCase()
    .replace(/\b(?:sid|bid|tid|qid)\b|\bq\s*(?:6|8|12|24)\s*h\b|(?:하루|1일)\s*[1-4]\s*회/ig, '')
    .replace(/[\s,]+/g, '');
    const splitDrugs = (name) => {
    if (!name.includes(',') && !/\s+\/\s+/.test(name)) return [name];
    const parts = name.split(/,\s*|\s+\/\s+/).map((s) => s.trim()).filter(Boolean);
    return parts.length > 1 && parts.every((p) => ROUTE.test(p) || KNOWN.test(p)) ? parts : [name];
    };
    function pickInj(chart, detail, date, hours, tag, includeCancelled = true, selectedWeight = '') {
    const out = [];
    const weight = selectedWeight || latestWeight(detail, chart);
    treatRows(detail).forEach((row) => {
    const name = (row.displayName || '').trim();
    if (!isInjection(name)) return;
    const parts = splitDrugs(name);
    const rowFrequency = frequencyFrom(name + ' ' + (row.instructionText || ''));
    (row.cells || []).forEach((cell) => {
    const isCancelled = CANCELLED_CELL.includes(cell.status);
    if (!hours.includes(cell.hourSlot) || (!ACTIVE.includes(cell.status) && !isCancelled)) return;
    if (isCancelled && !includeCancelled) return;
    if (!admitted(chart, detail, date, cell.hourSlot)) return;
    parts.forEach((p, i) => {
    const parsed = parseDrug(p);
    const instructionDose = doseFromInstruction(row.instructionText);
    const instruction = String(row.instructionText || '').replace(/\bprn\b/ig, ' ').replace(/\s+/g, ' ').trim();
    const dilution = dilutionFrom(name + ' ' + (row.instructionText || ''));
    const inferredRoute = parsed.route || (/^melo(?:xicam)?$/i.test(parsed.drug) ? 'SC' : '');
    const doseConflict = !!(parsed.dose && instructionDose && normalizedDose(parsed.dose) !== normalizedDose(instructionDose));
    out.push({
    pid: String(chart.patient.patientId), patient: chart.patient.name, code: chart.patient.hospitalPatientCode,
    breed: breedOf(chart.patient), weight,
    cage: chart.cageLabel || '미지정', tag, hour: cell.hourSlot,
    order: (tag === '내일' ? 100 : 0) + cell.hourSlot,
    cancelled: isCancelled,
    key: name + '#' + i, raw: name, instruction, conditional: COND.test(name + ' ' + (row.instructionText || '')), ...parsed, route: inferredRoute,
    dose: parsed.dose || instructionDose, doseConflict,
    frequency: parsed.frequency || rowFrequency, dilution,
    });
    });
    });
    });
    return out;
    }
    const normDrug = (s) => String(s || '').toLowerCase().replace(/[\s,._-]+/g, '');
    const timeKey = (t) => t.tag + '|' + t.hour;
    const timeStateKey = (t) => timeKey(t) + '|' + (t.cancelled ? 'cancelled' : 'active');
    const frequencyOf = (item, time) => {
    if (time && time.frequency) return time.frequency;
    if (item && item.frequency) return item.frequency;
    const written = frequencyFrom(String(item && item.note || '') + ' ' + String(item && item.instruction || ''));
    if (written) return written;
    const count = new Set((item && item.times || []).map(timeKey)).size;
    return ({ 1: 'SID', 2: 'BID', 3: 'TID', 4: 'QID' })[count] || '';
    };
    const timeLabel = (t, item) => {
    const label = (t.tag === '내일' ? '내일 ' : '') + t.hour + '시';
    const frequency = frequencyOf(item, t);
    if (frequency === 'SID') return label;
    const expected = ROUTINE_BY_FREQUENCY[frequency] || ROUTINE;
    return expected.includes(t.hour) ? label : U0 + label + U1;
    };
    const orange = (s) => O0 + s + O1;
    const cancelled = (s) => X0 + s + X1;
    const volumeText = (n) => n >= 0.01 ? n.toFixed(2) : n.toPrecision(2);
    const addedLabel = () => A0 + '추가' + A1;
    const deletedLabel = () => D0 + '삭제' + D1;
    const beforeValue = (s) => B0 + s + B1;
    const plainTimeLabel = (t) => (t.tag === '내일' ? '내일 ' : '') + t.hour + '시';
    const excluded = (times) => G0 + '제외: ' + times.map(plainTimeLabel).join(', ') + G1;
    const excludedCancelled = (times) => G0 + cancelled('제외: ' + times.map(plainTimeLabel).join(', ')) + G1;
    const orderedTimeText = (times, item) => [...times].sort((a, b) => a.order - b.order)
    .map((t) => t.cancelled ? excluded([t]) : timeLabel(t, item)).join(', ');
    const routeLabel = (route) => /^(SC|IM)$/.test(route) ? U0 + route + U1 : route;
    const MAN0 = '\uE020', MAN1 = '\uE021';
    const manualEntries = new Map();
    const manualPatientWeights = new Map();
    const manualKey = (pid, drug) => pid + ':' + normDrug(drug);
    const readManual = (pid, drug) => manualEntries.get(manualKey(pid, drug)) || {};
    const readPatientWeight = (pid) => manualPatientWeights.get(String(pid)) || '';
    const manualMarker = (item) => item.manualNeeded && Object.values(item.manualNeeded).some(Boolean) ? MAN0 + encodeURIComponent(JSON.stringify({
    pid: item.pid, drug: item.drug, written: item.dose, instruction: item.doseConflict ? '용량 불일치' : '',
    weightValue: item.patientWeight, dilutionRatio: item.dilution?.valid === false ? 0 : (item.dilution?.nsRatio || 0),
    ...item.manualNeeded, values: item.manualValues || {},
    })) + MAN1 : '';
    const recalculatePatient = (p) => {
    if (!p) return;
    const chartWeight = p.chartWeight ?? p.weight;
    const manualWeight = readPatientWeight(p.pid);
    const missingChartWeight = !/^\d+(?:\.\d+)? kg$/.test(chartWeight || '');
    p.weight = missingChartWeight && Number(manualWeight) > 0 ? Number(manualWeight) + ' kg' : chartWeight;
    p.chartWeight = chartWeight;
    p.manualWeight = manualWeight;
    p.manualWeightNeeded = missingChartWeight;
    const sourceItems = Array.isArray(p.items) ? p.items : Object.values(p.items || {});
    p.items = sourceItems.map((item) => {
    const registered = typeof doseEngine !== 'undefined' && doseEngine.find(item.drug);
    const values = readManual(p.pid, item.drug);
    const weight = p.weight;
    const instruction = item.dilution && item.dilution.valid === false ? '희석 확인 필요' :
    (item.doseConflict ? '용량 불일치' : '');
    const calculation = typeof doseEngine !== 'undefined' ? doseEngine.calculate(item.drug, item.dose, weight,
    instruction, {
    written: values.dose && values.doseUnit ? values.dose + values.doseUnit : '',
    concentration: values.concentration,
    concentrationUnit: values.concentrationUnit,
    }) : undefined;
    return {
    ...item, calculation, manualValues: values, patientWeight: weight, manualNeeded: {
    dose: (!registered && !item.dose) || item.doseConflict,
    concentration: !registered || !(registered.conc > 0),
    },
    };
    });
    };
    function makeSnapshot(rows) {
    const patients = {};
    rows.forEach((r) => {
    const p = patients[r.pid] = patients[r.pid] || {
    pid: r.pid, name: r.patient, code: r.code, breed: r.breed, weight: r.weight,
    cage: r.cage, predicted: false, items: {},
    };
    if (r.cage !== '미지정') p.cage = r.cage;
    if (r.weight && r.weight !== '- kg') p.weight = r.weight;
    if (r.predicted) p.predicted = true;
    const registered = typeof doseEngine !== 'undefined' && doseEngine.find(r.drug);
    const drug = registered ? registered.name : r.drug;
    const dose = normalizedDose(r.dose);
    const key = JSON.stringify([drug, dose, r.route, mergeDirective(r.note), mergeDirective(r.instruction), r.dilution?.label || '']);
    const item = p.items[key] = p.items[key] || {
    pid: r.pid, match: normDrug(drug) || normDrug(r.raw), drug, dose, route: r.route, frequency: r.frequency,
    note: r.note, instruction: r.instruction, dilution: r.dilution, doseConflict: !!r.doseConflict,
    conditional: !!r.conditional || COND.test(r.raw + ' ' + r.instruction), times: [],
    };
    if (!item.times.some((t) => timeStateKey(t) === timeStateKey(r))) {
    item.times.push({ tag: r.tag, hour: r.hour, order: r.order, cancelled: !!r.cancelled, frequency: r.frequency });
    }
    });
    Object.values(patients).forEach((p) => {
    p.items = Object.values(p.items).map((item) => ({
    ...item, times: item.times.sort((a, b) => a.order - b.order),
    }));
    recalculatePatient(p);
    });
    return { checkedAt: new Date().toISOString(), patients };
    }
    const preparationItem = (item, prev = null, kind = '') => {
    const calc = item.calculation;
    const active = (x) => x.times.filter((t) => !t.cancelled);
    const allCancelled = item.times.length > 0 && active(item).length === 0;
    const oldTimes = new Map((prev ? active(prev) : []).map((t) => [timeKey(t), t]));
    const currentTimes = new Set(item.times.map(timeKey));
    const manualCalculation = (item.manualNeeded && Object.values(item.manualNeeded).some(Boolean)) ||
    (prev && prev.manualNeeded && Object.values(prev.manualNeeded).some(Boolean));
    const changedDose = prev && ((!manualCalculation && JSON.stringify(calc) !== JSON.stringify(prev.calculation)) ||
    item.dose !== prev.dose || item.route !== prev.route);
    const displayTimes = [...item.times].map((t) => {
    let text = t.cancelled ? (allCancelled ? excludedCancelled([t]) : excluded([t])) : timeLabel(t, item);
    if (prev && !t.cancelled && !oldTimes.has(timeKey(t))) text = orange(text);
    return { order: t.order, text };
    });
    if (prev) active(prev).filter((t) => !currentTimes.has(timeKey(t)))
    .forEach((t) => displayTimes.push({ order: t.order, text: cancelled(timeLabel(t, prev)) }));
    const times = displayTimes.sort((a, b) => a.order - b.order).map((t) => t.text).join(', ');
    const dilutionText = calc.volume != null && item.dilution && item.dilution.valid !== false ?
    ' + NS ' + volumeText(calc.volume * item.dilution.nsRatio) + ' mL' : '';
    const amountText = calc.volume == null && item.dilution?.valid === false ?
    item.dilution.label + ' 확인 필요' : calc.text;
    const currentAmount = calc.volume != null ? calc.text + dilutionText : amountText;
    let amount = calc.volume == null ? Q0 + amountText + Q1 : currentAmount;
    if (changedDose && prev.calculation && prev.calculation.text !== calc.text) {
    const previousDilution = prev.calculation.volume != null && prev.dilution && prev.dilution.valid !== false ?
    ' + NS ' + volumeText(prev.calculation.volume * prev.dilution.nsRatio) + ' mL' : '';
    const previousAmount = prev.calculation.volume != null ? prev.calculation.text + previousDilution : prev.calculation.text;
    amount = beforeValue(previousAmount) + ' → ' + (calc.volume == null ? Q0 + amountText + Q1 : orange(currentAmount));
    }
    const route = prev && item.route !== prev.route ? beforeValue(routeLabel(prev.route) || '미기재') + '→' + orange(routeLabel(item.route) || '미기재') : routeLabel(item.route);
    let main = '\uE030' + item.drug + '\uE031 · ' + times + (route ? ' · ' + route : '');
    if (allCancelled) main = cancelled(main);
    else if (kind === 'added') main = orange(main);
    const dilutionBasis = item.dilution && item.dilution.valid !== false ? item.dilution.label : '';
    const doseBasis = calc.nonDefault ? '\uE00A' + calc.doseText + '\uE00B' + (calc.concText ? ' · ' + calc.concText : '') : calc.basis;
    const basis = M0 + amount + M1 + (doseBasis ? ' · ' + doseBasis : '') +
    (dilutionBasis ? ' · ' + dilutionBasis : '') +
    (item.note || item.instruction ? ' · ' + [item.note, item.instruction].filter(Boolean).join(', ') : '');
    return (kind === 'removed' ? cancelled(main) : main) +
    (basis ? '\n' + S0 + (kind === 'removed' || allCancelled ? cancelled(basis) : basis) + S1 : '') +
    (kind === 'removed' ? '' : manualMarker(item));
    };
    const rawItem = (item) => {
    if (item.calculation) return preparationItem(item);
    const label = [item.drug, item.dose, routeLabel(item.route)].filter(Boolean).join(' ');
    const extra = [item.note, item.instruction].filter(Boolean).join(', ');
    const allCancelled = item.times.length && item.times.every((time) => time.cancelled);
    const times = allCancelled ? item.times.map((time) => excludedCancelled([time])).join(', ') : orderedTimeText(item.times, item);
    const text = label + ' (' + times + ')' + (extra ? ' [' + extra + ']' : '');
    return allCancelled ? cancelled(text) : text;
    };
    function changedItem(item, prev, kind) {
    if (item.calculation) return preparationItem(item, prev, kind);
    let text;
    if (kind === 'added') text = orange(rawItem(item));
    else if (kind === 'removed') text = cancelled(rawItem(item));
    else {
    const field = (now, before) => {
    if (now === before) return now;
    if (before && now) return beforeValue(before) + '→' + orange(now);
    return now ? orange(now) : beforeValue(before);
    };
    const route = item.route === prev.route ? routeLabel(item.route) :
    field(routeLabel(item.route), routeLabel(prev.route));
    const label = [field(item.drug, prev.drug), field(item.dose, prev.dose), route]
    .filter(Boolean).join(' ');
    const oldByTime = new Map(prev.times.map((t) => [timeKey(t), t]));
    const nowTimes = new Set(item.times.map(timeKey));
    const times = [];
    item.times.forEach((t) => {
    const old = oldByTime.get(timeKey(t));
    if (t.cancelled) { times.push({ order: t.order, text: excluded([t]) }); return; }
    if (!old) { times.push({ order: t.order, text: orange(timeLabel(t, item)) }); return; }
    if (old.cancelled) { times.push({ order: t.order, text: orange(timeLabel(t, item) + ' 재개') }); return; }
    times.push({ order: t.order, text: timeLabel(t, item) });
    });
    prev.times.forEach((t) => {
    if (!t.cancelled && !nowTimes.has(timeKey(t))) {
    times.push({ order: t.order, text: cancelled(timeLabel(t, prev)) });
    }
    });
    const extraNow = [item.note, item.instruction].filter(Boolean).join(', ');
    const extraOld = [prev.note, prev.instruction].filter(Boolean).join(', ');
    const extra = extraNow === extraOld ? extraNow : orange([extraOld, extraNow].filter(Boolean).join('→'));
    text = label + ' (' + times.sort((a, b) => a.order - b.order).map((t) => t.text).join(', ') + ')' +
    (extra ? ' [' + extra + ']' : '');
    }
    return text;
    }
    const sameItem = (a, b) => a.drug === b.drug && a.dose === b.dose && a.route === b.route &&
    a.doseConflict === b.doseConflict &&
    (a.dilution?.label || '') === (b.dilution?.label || '') &&
    a.note === b.note && a.instruction === b.instruction &&
    a.times.map(timeStateKey).join(',') === b.times.map(timeStateKey).join(',');
    function compareSnapshot(current, previous, states) {
    const normal = [], cond = [];
    let events = 0;
    let changedPatients = 0;
    const changeKinds = { changed: 0 };
    const ids = new Set([...Object.keys(current.patients), ...Object.keys(previous ? previous.patients : {})]);
    ids.forEach((pid) => {
    const priorEvents = events;
    const patientKinds = { added: false, changed: false, removed: false, status: false };
    const now = current.patients[pid];
    const old = previous && previous.patients[pid];
    const p = now || old;
    const state = states[pid] || {};
    const extended = !!(old && old.predicted && !now?.predicted && state.extended);
    const discharged = !!(!now && old && state.discharged);
    const nowChartWeight = now?.chartWeight || now?.weight;
    const oldChartWeight = old?.chartWeight || old?.weight;
    const weightChanged = !!(now && old && nowChartWeight && oldChartWeight &&
    nowChartWeight !== '- kg' && oldChartWeight !== '- kg' && nowChartWeight !== oldChartWeight);
    const title = patientTitle(p.name, p.code, p.breed, p.weight || '- kg');
    let status = '';
    if (now?.predicted) status = '미연장';
    else if (extended) { status = '연장'; events += 1; patientKinds.status = true; }
    else if (discharged) { status = '퇴원'; events += 1; patientKinds.status = true; }
    if (weightChanged) { events += 1; patientKinds.changed = true; }
    const currentItems = now ? now.items : [];
    const oldItems = old ? old.items : [];
    const used = new Set();
    const lines = [], conds = [];
    currentItems.forEach((item) => {
    let pi = oldItems.findIndex((candidate, i) => !used.has(i) && candidate.match === item.match && sameItem(candidate, item));
    if (pi < 0) pi = oldItems.findIndex((candidate, i) => !used.has(i) && candidate.match === item.match);
    const prev = pi >= 0 ? oldItems[pi] : null;
    if (pi >= 0) used.add(pi);
    const changed = !prev || !sameItem(item, prev);
    if (changed) {
    events += 1;
    patientKinds[prev ? 'changed' : 'added'] = true;
    }
    const line = changedItem(item, prev, prev ? 'changed' : 'added');
    (item.conditional ? conds : lines).push(line);
    });
    oldItems.forEach((item, i) => {
    if (used.has(i)) return;
    if (!item.times.some((time) => !time.cancelled)) return;
    events += 1;
    patientKinds.removed = true;
    const line = changedItem(item, null, 'removed');
    (item.conditional ? conds : lines).push(line);
    });
    const updated = events > priorEvents;
    if (updated) {
    changedPatients += 1;
    changeKinds.changed += 1;
    }
    if (lines.length) normal.push({
    updated,
    title, pid: p.pid, weight: p.weight, previousWeight: weightChanged ? old.weight : '',
    manualWeightNeeded: !!now?.manualWeightNeeded, manualWeight: now?.manualWeight || '', cage: p.cage, status,
    sortName: p.name, sortCage: p.cage, body: lines, note: '',
    });
    if (conds.length) cond.push({
    updated: updated && !lines.length,
    title, pid: p.pid, weight: p.weight, previousWeight: weightChanged ? old.weight : '',
    manualWeightNeeded: !!now?.manualWeightNeeded, manualWeight: now?.manualWeight || '', cage: p.cage, status,
    sortName: p.name, sortCage: p.cage, body: conds, note: '',
    });
    });
    return { normal, cond, changes: changedPatients, changeKinds };
    }
    const baselineKey = (date) => INJ_BASELINE + currentHospitalId() + ':' + date;
    const checkedTime = (value) => {
    if (!value) return '시간 미기록';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '시간 미기록' : pad(date.getHours()) + ':' + pad(date.getMinutes());
    };
    const loadBaseline = (date) => {
    try { return JSON.parse(localStorage.getItem(baselineKey(date))) || null; }
    catch (_) { return null; }
    };
    const saveBaseline = (date, snapshot) => {
    try { localStorage.setItem(baselineKey(date), JSON.stringify(snapshot)); }
    catch (_) { /* 저장이 막혀도 목록 자체는 계속 보여준다. */ }
    }
    async function injections(date, force = false) {
    const next = shift(date, 1);
    const today = await collect(date, force);
    const tomorrow = await collect(next, force);
    const weightByPatient = new Map();
    const todayPatientIds = new Set(today.charts.map((chart) => String(chart.patient.patientId)));
    const rememberWeight = (chart, detail) => {
    const weight = latestWeight(detail, chart);
    if (weight !== '- kg') weightByPatient.set(String(chart.patient.patientId), weight);
    };
    today.charts.forEach((chart, i) => rememberWeight(chart, today.details[i]));
    const allPatientIds = new Set([...todayPatientIds, ...tomorrow.charts.map((chart) => String(chart.patient.patientId))]);
    const missingWeightIds = [...allPatientIds].filter((pid) => !weightByPatient.has(pid));
    const yesterday = await yesterdayWeights(date, missingWeightIds);
    yesterday.forEach((weight, pid) => weightByPatient.set(pid, weight));
    const weightFor = (chart) => weightByPatient.get(String(chart.patient.patientId)) || '- kg';
    const rows = [];
    const states = {};
    today.charts.forEach((c) => {
    states[String(c.patient.patientId)] = { discharged: !!c.discharged, extended: false };
    });
    const discharged = new Set(today.charts.filter((c) => c.discharged).map((c) => String(c.patient.patientId)));
    today.charts.forEach((c, i) => {
    if (!c.discharged) rows.push(...pickInj(c, today.details[i], date, EVENING, '오늘', true, weightFor(c)));
    });
    const extended = new Set(tomorrow.charts
    .filter((c) => !c.discharged && !discharged.has(String(c.patient.patientId)))
    .map((c) => String(c.patient.patientId)));
    extended.forEach((pid) => {
    states[pid] = states[pid] || { discharged: false, extended: false };
    states[pid].extended = true;
    });
    tomorrow.charts.forEach((c, i) => {
    if (!c.discharged && !discharged.has(String(c.patient.patientId))) {
    rows.push(...pickInj(c, tomorrow.details[i], next, NEXT, '내일', true, weightFor(c)));
    }
    });
    today.charts.forEach((c, i) => {
    if (extended.has(String(c.patient.patientId)) || c.discharged) return;
    pickInj(c, today.details[i], date, NEXT, '내일', false, weightFor(c))
    .forEach((r) => rows.push({ ...r, predicted: true }));
    });
    const snapshot = makeSnapshot(rows);
    let previous = loadBaseline(date);
    const firstCheck = !previous;
    if (!previous) { saveBaseline(date, snapshot); previous = snapshot; }
    const g = compareSnapshot(snapshot, previous, states);
    const out = [{ heading: date + ' 17시 ~ ' + next + ' 15시 주사', groups: g.normal }];
    out[0].reviewNote = firstCheck ? '현재 확인 ' + checkedTime(snapshot.checkedAt) :
    '이전 확인 ' + checkedTime(previous.checkedAt) + ' → 현재 확인 ' + checkedTime(snapshot.checkedAt);
    if (g.cond.length) out.push({ heading: '조건부', groups: g.cond });
    out.changeCount = g.changes;
    out.changeKinds = g.changeKinds;
    out.snapshot = snapshot;
    out.previousSnapshot = previous;
    out.states = states;
    out.baselineKey = baselineKey(date);
    out.firstCheck = firstCheck;
    return out;
    }
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const manualHtml = (encoded) => {
    let data;
    try { data = JSON.parse(decodeURIComponent(encoded)); } catch (_) { return ''; }
    const v = { ...(data.values || {}), ...readManual(data.pid, data.drug) };
    const input = (field, value, placeholder, ariaLabel) => '<input data-manual="' + field + '" aria-label="' + ariaLabel +
    '" autocomplete="off" inputmode="decimal" type="number" min="0" step="any" placeholder="' + placeholder +
    '" value="' + esc(value || '') + '" style="box-sizing:border-box;width:62px;height:28px;border:1px solid #cbd5e1;border-radius:4px;' +
    'background:#fff;color:#111827;padding:0 5px;font:600 13px/1 system-ui">';
    const select = (field, value, options, ariaLabel) => '<select data-manual="' + field + '" aria-label="' + ariaLabel +
    '" autocomplete="off" style="height:28px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#334155;' +
    'padding:0 3px;font:600 12px/1 system-ui">' + options.map((o) =>
    '<option value="' + o[0] + '"' + (value === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
    const doseUnit = v.doseUnit || (/\b(?:ug|mcg)\s*\/\s*kg\b/i.test(data.written || '') ? 'ug/kg' : 'mpk');
    const concentrationUnit = v.concentrationUnit || 'mg';
    const fields = [];
    if (data.dose) {
    fields.push(input('dose', v.dose, '용량', '약물 용량'));
    fields.push(select('doseUnit', doseUnit, [['mpk', 'mg/kg'], ['ug/kg', 'µg/kg'], ['ml/kg', 'mL/kg'], ['mg', 'mg/환자']], '용량 단위'));
    }
    if (data.concentration) {
    fields.push(input('concentration', v.concentration, '역가', '역가'));
    fields.push(select('concentrationUnit', concentrationUnit, [['mg', 'mg/mL'], ['ug', 'µg/mL']], '역가 단위'));
    }
    return '<div data-manual-box data-pid="' + esc(data.pid) + '" data-drug="' + esc(data.drug) + '" data-written="' + esc(data.written) +
    '" data-weight-value="' + esc(data.weightValue || '') + '" data-dilution-ratio="' + esc(data.dilutionRatio || '') +
    '" data-instruction="' + esc(data.instruction) + '" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;' +
    'margin-top:4px;padding:5px 6px;border-left:2px solid #94a3b8;background:#f8fafc">' +
    fields.join('') +
    '<output data-manual-result aria-live="polite" style="display:flex;align-items:baseline;gap:5px;flex-wrap:wrap;color:#0f766e">' +
    '<strong data-manual-volume style="font-size:14px">입력 필요</strong><span data-manual-basis style="font-size:11px;font-weight:500;color:#64748b"></span></output></div>';
    };
    const toHtml = (s) => esc(s)
    .split('\uE00A').join('<span style="background:#fef3c7;color:#92400e;padding:0 3px;border-radius:2px">').split('\uE00B').join('</span>')
    .replace(/\n/g, '<br>')
    .split(M0).join('<strong style="font-size:16px">').split(M1).join('</strong>')
    .split(S0).join('<span style="font-size:12px;color:#64748b">').split(S1).join('</span>')
    .split(U0).join('<u style="font-weight:800">').split(U1).join('</u>')
    .split(E0).join('<strong style="font-weight:800;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:2px">')
    .split(E1).join('</strong>')
    .split(O0).join('<span style="color:#b45309;font-weight:800">').split(O1).join('</span>')
    .split(X0).join('<span style="color:#b42318;font-weight:600;text-decoration:line-through;text-decoration-thickness:2px">').split(X1).join('</span>')
    .split(G0).join('<span style="display:inline-block;white-space:nowrap;padding:0 4px;border:1px solid #9ca3af;border-radius:3px;background:#f9fafb;color:#4b5563;font-weight:700">')
    .split(G1).join('</span>')
    .split(A0).join('<span style="display:inline-block;white-space:nowrap;padding:0 5px;border:1px solid #93c5fd;border-radius:3px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:800;vertical-align:1px">').split(A1).join('</span>')
    .split(D0).join('<span style="display:inline-block;white-space:nowrap;padding:0 5px;border:1px solid #fca5a5;border-radius:3px;background:#fef2f2;color:#b42318;font-size:12px;font-weight:800;vertical-align:1px">').split(D1).join('</span>')
    .split(B0).join('<span style="color:#9f1239;text-decoration:line-through;text-decoration-thickness:1.5px">').split(B1).join('</span>')
    .split(Q0).join('<span style="font-size:13px;color:#b45309;font-weight:700">').split(Q1).join('</span>')
    .split('\uE030').join('<strong style="font-weight:750">').split('\uE031').join('</strong>')
    .replace(new RegExp(MAN0 + '(.+?)' + MAN1, 'g'), (_, encoded) => manualHtml(encoded));
    const asText = (sections) => sections.map((s) =>
    s.heading + (s.reviewNote ? '\n' + s.reviewNote : '') + '\n' + s.groups.map((g) =>
    (g.title ? g.title + ' ' + g.cage + (g.previousWeight ? ' [체중 ' + g.previousWeight + '→' + g.weight + ']' : '') +
    (g.status ? ' [' + g.status + ']' : '') + (g.updated ? ' [처치 업데이트]' : '') + '\n  ' : '  ') +
    g.body.join('\n  ') + (g.note ? '\n  ' + g.note : '')
    ).join('\n')
    ).join('\n\n')
    .split('\uE00A').join('').split('\uE00B').join('')
    .split(M0).join('**').split(M1).join('**')
    .split(S0).join('').split(S1).join('')
    .split(U0).join('**__').split(U1).join('__**')
    .split(E0).join('**__').split(E1).join('__**')
    .split(O0).join('**').split(O1).join('**')
    .split(X0).join('~~').split(X1).join('~~')
    .split(G0).join('[').split(G1).join(']')
    .split(A0).join('**[').split(A1).join(']**')
    .split(D0).join('**[').split(D1).join(']**')
    .split(B0).join('~~').split(B1).join('~~')
    .split(Q0).join('').split(Q1).join('')
    .replace(new RegExp(MAN0 + '.+?' + MAN1, 'g'), '')
    .split('\uE030').join('**').split('\uE031').join('**');
    const patientTitleHtml = (title, previousWeight = '', manualWeightNeeded = false, manualWeight = '', pid = '') => {
    const value = String(title || '');
    const split = value.lastIndexOf(' (');
    if (split < 0 || !value.endsWith(')')) return esc(value);
    const name = value.slice(0, split);
    const info = value.slice(split + 2, -1).split(' · ');
    const weight = /^(?:- |\d+(?:\.\d+)? )kg$/i.test(info[0] || '') ? info.shift() : '';
    const meta = info.join(' · ');
    const weightChanged = previousWeight && previousWeight !== '- kg' && previousWeight !== weight;
    const weightHtml = manualWeightNeeded ?
    '<span style="display:inline-flex;align-items:center;gap:2px;vertical-align:middle">' +
    '<input data-patient-weight data-pid="' + esc(pid) + '" type="text" inputmode="decimal" autocomplete="off" placeholder="체중" aria-label="' +
    esc(name) + ' 체중(kg)' + '" value="' + esc(manualWeight || '') + '" style="box-sizing:border-box;width:40px;height:20px;border:1px solid #94a3b8;border-radius:3px;' +
    'background:#fff;color:#111827;padding:0 1px;text-align:center;font:700 12px/18px system-ui;vertical-align:middle">' +
    '<span style="font-size:12px;color:#64748b;font-weight:700;line-height:20px">kg</span></span>' : weightChanged ?
    '<span style="color:#9f1239;text-decoration:line-through;text-decoration-thickness:1.5px">' + esc(previousWeight) + '</span>→' +
    '<span style="color:#b45309;font-size:15px;font-weight:800">' + esc(weight) + '</span>' :
    '<span style="color:#111827;font-size:15px;font-weight:800">' + esc(weight) + '</span>';
    return esc(name) + ' <span style="color:#64748b;font-size:14px;font-weight:500">(' +
    (weight ? weightHtml : '') +
    (weight && meta ? ' · ' : '') + (meta ? esc(meta) : '') + ')</span>';
    };
    const render = (sections, view = '') => {
    const injectionView = view === 'inj' || sections.some((section) => /주사/.test(section.heading || ''));
    const patientRule = injectionView ? 'padding:10px 0 4px;border-bottom:2px solid #94a3b8;' :
    'padding:10px 0 8px;border-bottom:1px solid #e5e7eb;';
    const shownManualWeights = new Set();
    return sections.map((s) =>
    '<h2 style="font-size:14px;margin:18px 0 8px;color:' + (s.warn ? '#b45309' : '#6b7280') + '">' + esc(s.heading) + '</h2>' +
    (s.groups.length ? s.groups.map((g) => {
    const showManualWeight = !!(g.manualWeightNeeded && !shownManualWeights.has(g.pid));
    if (showManualWeight) shownManualWeights.add(g.pid);
    return '<div style="' + patientRule +
    (g.updated ? 'border-left:3px solid #64748b;padding-left:10px;' : '') + '">' +
    (g.title ? '<div style="font-weight:700;font-size:16px;line-height:1.45">' + patientTitleHtml(g.title, g.previousWeight, showManualWeight, g.manualWeight, g.pid) +
    ' <span style="font-weight:400;color:#6b7280">' + esc(g.cage) + '</span>' +
    (g.status ? ' <span style="display:inline-block;white-space:nowrap;padding:0 5px;border-radius:3px;font-size:13px;font-weight:800;' +
    (g.status === '연장' ? 'background:#fef08a;color:#713f12' :
    g.status === '미연장' ? 'background:#f3f4f6;color:#4b5563;border:1px solid #d1d5db' :
    'background:#fef2f2;color:#b42318;border:1px solid #fecaca;text-decoration:line-through') + '">' + esc(g.status) + '</span>' : '') +
    (g.updated ? ' <span style="display:inline-block;white-space:nowrap;padding:0 5px;border:1px solid #f59e0b;border-radius:3px;background:#fffbeb;color:#92400e;font-size:12px;font-weight:800">[변경]</span>' : '') + '</div>' : '') +
    g.body.map((b, index) => '<div style="padding:' + (index ? '6px' : '5px') + ' 0 ' + (injectionView ? '3px' : '5px') + ';font-size:15px;font-weight:500;line-height:1.5;' +
    (index ? 'border-top:1px solid #e5e7eb;' : '') + '">' + toHtml(b) + '</div>').join('') +
    (g.note ? '<div style="margin-top:4px;color:#475569;font-weight:600">' + esc(g.note) + '</div>' : '') +
    '</div>';
    }).join('') : '<p style="color:#6b7280">해당 항목이 없습니다.</p>')
    ).join('');
    };
    const compareText = (a, b) => String(a || '').localeCompare(String(b || ''), 'ko', {
    numeric: true, sensitivity: 'base',
    });
    const cageRank = (cage) => {
    const value = String(cage || '').toUpperCase().replace(/\s+/g, '');
    const code = value.startsWith('ICU') ? 'ICU' : (/^[BACD]/.test(value) ? value[0] : '');
    const order = { B: 0, A: 1, ICU: 2, C: 3, D: 4 };
    return Object.prototype.hasOwnProperty.call(order, code) ? order[code] : 99;
    };
    const sortSections = (sections, mode) => sections.map((section) => ({
    ...section,
    groups: [...section.groups].sort((a, b) => {
    const byName = compareText(a.sortName || a.title, b.sortName || b.title);
    if (mode === 'name') return byName || compareText(a.sortCage || a.cage, b.sortCage || b.cage);
    return cageRank(a.sortCage || a.cage) - cageRank(b.sortCage || b.cage) ||
    compareText(a.sortCage || a.cage, b.sortCage || b.cage) || byName;
    }),
    }));
    const TABS = [
    { id: 'blood', label: '채혈', run: bloodwork },
    { id: 'inj', label: '주사', run: injections },
    ];
    function open() {
    const old = document.getElementById('vsp');
    if (old) old.remove();
    const box = document.createElement('div');
    box.id = 'vsp';
    box.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;background:#fff;color:#111;' +
    'font:15px/1.5 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;overflow:auto;' +
    '-webkit-overflow-scrolling:touch;padding:0 0 40px;font-variant-numeric:tabular-nums');
    box.innerHTML =
    '<div style="position:sticky;top:0;background:#0f766e;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px">' +
    TABS.map((t, i) => '<button data-tab="' + t.id + '" style="font:inherit;font-weight:700;padding:8px 16px;border:0;' +
    'border-radius:8px;background:' + (i === 0 ? '#fff' : 'rgba(255,255,255,.2)') + ';color:' + (i === 0 ? '#0f766e' : '#fff') + '">' + t.label + '</button>').join('') +
    '<span style="flex:1"></span><span style="font-size:11px">2.1.12</span>' +
    '<button id="vsp-copy" style="font:inherit;padding:8px 14px;border:0;border-radius:8px;background:rgba(255,255,255,.2);color:#fff">복사</button>' +
    '<button id="vsp-x" style="font:inherit;padding:8px 14px;border:0;border-radius:8px;background:rgba(255,255,255,.2);color:#fff">닫기</button>' +
    '</div><div id="vsp-body" style="padding:0 16px"><p>불러오는 중…</p></div>';
    document.body.appendChild(box);
    let text = '';
    let requestId = 0;
    let sortMode = 'name';
    const refreshLocalInjectionPatient = (sections, pid) => {
    if (!sections || !sections.snapshot || !sections.snapshot.patients || !sections.snapshot.patients[pid]) return false;
    recalculatePatient(sections.snapshot.patients[pid]);
    const compared = compareSnapshot(sections.snapshot, sections.previousSnapshot, sections.states || {});
    sections[0].groups = compared.normal;
    const conditionalIndex = sections.findIndex((section) => section.heading === '조건부');
    if (compared.cond.length) {
    if (conditionalIndex >= 0) sections[conditionalIndex].groups = compared.cond;
    else sections.push({ heading: '조건부', groups: compared.cond });
    } else if (conditionalIndex >= 0) {
    sections.splice(conditionalIndex, 1);
    }
    sections.changeCount = compared.changes;
    sections.changeKinds = compared.changeKinds;
    return true;
    };
    const paint = (id, sections) => {
    const body = box.querySelector('#vsp-body');
    if (!body) return;
    const ordered = sortSections(sections, sortMode);
    text = asText(ordered);
    const sortControl =
    '<div style="margin:0 -16px;padding:9px 16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px">' +
    '<strong style="font-size:13px;color:#4b5563">정렬</strong>' +
    '<div style="display:flex;border:1px solid #9ca3af;border-radius:6px;overflow:hidden">' +
    ['name', 'cage'].map((mode) => '<button data-sort="' + mode + '" style="font:inherit;font-size:13px;font-weight:700;' +
    'padding:5px 11px;border:0;border-left:' + (mode === 'cage' ? '1px solid #9ca3af' : '0') + ';' +
    'background:' + (sortMode === mode ? '#374151' : '#fff') + ';color:' + (sortMode === mode ? '#fff' : '#374151') + '">' +
    (mode === 'name' ? '이름순' : '장순') + '</button>').join('') + '</div></div>';
    const refresh = id === 'inj' ?
    '<div style="margin:8px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
    '<button id="vsp-refresh" style="font:inherit;padding:6px 10px;border:1px solid #9ca3af;border-radius:6px;background:#fff">새로 확인</button>' +
    '<span style="font-size:13px;color:#64748b;font-weight:600">' + esc(sections[0].reviewNote || '현재 확인 시간 미기록') + '</span></div>' : '';
    const firstCheck = id === 'inj' && sections.firstCheck ?
    '<div style="margin:0 -16px;padding:8px 16px;background:#ecfdf5;border-bottom:1px solid #a7f3d0;color:#065f46;font-weight:700">' +
    '오늘 첫 확인 · 기준 목록 저장됨</div>' : '';
    const changes = id === 'inj' && sections.changeCount ?
    '<div style="margin:0 -16px;padding:10px 16px;background:#f8fafc;border-bottom:1px solid #cbd5e1;display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
    '<strong style="color:#92400e">[변경] ' + sections.changeCount + '명</strong><span style="flex:1"></span>' +
    '<button id="vsp-accept" style="font:inherit;font-weight:700;padding:7px 12px;border:1px solid #0f766e;border-radius:6px;background:#fff;color:#0f766e">변경 확인</button></div>' : '';
    body.innerHTML = sortControl + refresh + firstCheck + changes + render(ordered, id);
    body.querySelectorAll('[data-sort]').forEach((button) => {
    button.onclick = () => { sortMode = button.dataset.sort; paint(id, sections); };
    });
    const accept = body.querySelector('#vsp-accept');
    if (accept) accept.onclick = () => {
    localStorage.setItem(sections.baselineKey, JSON.stringify(sections.snapshot));
    show(id, true);
    };
    const refreshButton = body.querySelector('#vsp-refresh');
    if (refreshButton) refreshButton.onclick = () => show('inj', true);
    body.querySelectorAll('[data-patient-weight]').forEach((input) => {
    const applyWeight = () => {
    const value = Number(input.value);
    if (value > 0) manualPatientWeights.set(String(input.dataset.pid), String(value));
    else manualPatientWeights.delete(String(input.dataset.pid));
    if (refreshLocalInjectionPatient(sections, String(input.dataset.pid))) paint('inj', sections);
    };
    input.addEventListener('change', applyWeight);
    input.addEventListener('blur', applyWeight);
    input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
    });
    });
    body.querySelectorAll('[data-manual-box]').forEach((manualBox) => {
    const update = () => {
    const value = (name) => manualBox.querySelector('[data-manual="' + name + '"]')?.value || '';
    const values = {
    dose: value('dose'), doseUnit: value('doseUnit'),
    concentration: value('concentration'), concentrationUnit: value('concentrationUnit'),
    };
    manualEntries.set(manualKey(manualBox.dataset.pid, manualBox.dataset.drug), values);
    const result = doseEngine.calculate(manualBox.dataset.drug, manualBox.dataset.written,
    values.weight ? values.weight + ' kg' : manualBox.dataset.weightValue,
    manualBox.dataset.instruction, {
    written: values.dose && values.doseUnit ? values.dose + values.doseUnit : '',
    concentration: values.concentration, concentrationUnit: values.concentrationUnit,
    });
    const output = manualBox.querySelector('[data-manual-result]');
    const volume = output.querySelector('[data-manual-volume]');
    const basis = output.querySelector('[data-manual-basis]');
    const nsRatio = Number(manualBox.dataset.dilutionRatio || 0);
    const nsText = result.volume != null && nsRatio > 0 ? ' + NS ' + volumeText(result.volume * nsRatio) + ' mL' : '';
    volume.textContent = result.volume == null ? result.text : result.text + nsText;
    volume.style.color = result.volume == null ? '#b45309' : '#0f766e';
    basis.textContent = result.volume == null ? '' : result.basis + (nsText ? ' · 희석 NS 포함' : '');
    };
    manualBox.querySelectorAll('input,select').forEach((control) => {
    control.addEventListener('input', update);
    control.addEventListener('change', update);
    });
    update();
    });
    };
    const show = async (id, force = false) => {
    const currentRequest = ++requestId;
    const body = box.querySelector('#vsp-body');
    if (!body) return;
    body.innerHTML = '<p>불러오는 중…</p>';
    box.querySelectorAll('[data-tab]').forEach((b) => {
    const on = b.dataset.tab === id;
    b.style.background = on ? '#fff' : 'rgba(255,255,255,.2)';
    b.style.color = on ? '#0f766e' : '#fff';
    });
    try {
    const sections = await TABS.find((t) => t.id === id).run(ymd(new Date()), force);
    if (currentRequest !== requestId || !box.isConnected) return;
    paint(id, sections);
    } catch (e) {
    if (currentRequest !== requestId || !box.isConnected) return;
    text = '';
    body.innerHTML = '<p style="color:#b91c1c">' + esc(e.message) + '</p>';
    }
    };
    box.querySelector('#vsp-x').onclick = () => { requestId += 1; box.remove(); };
    box.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => show(b.dataset.tab, b.dataset.tab === 'inj')));
    box.querySelector('#vsp-copy').onclick = async (e) => {
    try { await navigator.clipboard.writeText(text); e.target.textContent = '복사됨'; }
    catch (_) { e.target.textContent = '복사 실패'; }
    };
    show('blood');
    }
    function mountButton() {
    if (document.getElementById('vsp-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'vsp-btn';
    btn.textContent = '목록';
    btn.setAttribute('style', 'position:fixed;right:18px;bottom:18px;z-index:2147483646;' +
    'width:64px;height:64px;border:0;border-radius:32px;background:#0f766e;color:#fff;' +
    'font:700 16px/1 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;' +
    'box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer');
    btn.onclick = open;
    document.body.appendChild(btn);
    }
    if (!location.hostname.endsWith('vetsync4.vetu1.com')) {
    alert('VetSync 화면에서 눌러주세요.');
    } else if (window.__VETSYNC_BUTTON) {
    mountButton();
    setInterval(mountButton, 3000);
    } else {
    open();
    }
    })();
  };
  const ready = () => document.body && !location.pathname.startsWith('/login') && localStorage.getItem('auth-storage');
  const timer = setInterval(() => {
    const autoOpen = sessionStorage.getItem(TRIGGER) === '1';
    if (!autoOpen) {
      if (!ready()) return;
      clearInterval(timer);
      launchPanel(true);
      return;
    }
    const startedAt = Number(sessionStorage.getItem(STARTED_AT)) || Date.now();
    if (Date.now() - startedAt > WAIT_LIMIT_MS) {
      clearInterval(timer);
      sessionStorage.removeItem(TRIGGER);
      sessionStorage.removeItem(STARTED_AT);
      return;
    }
    if (!ready()) return;

    sessionStorage.removeItem(TRIGGER);
    sessionStorage.removeItem(STARTED_AT);
    clearInterval(timer);
    launchPanel(false);

    const watchAuth = setInterval(() => {
      const panel = document.getElementById('vsp');
      if (!panel) {
        clearInterval(watchAuth);
        return;
      }
      const message = panel.textContent || '';
      const expired = /접속이 만료됐습니다|로그인이 안 되어 있습니다|서버 응답 401|병원 접근 오류(403)/.test(message);
      if (expired) {
        clearInterval(watchAuth);
        if (sessionStorage.getItem(AUTH_RETRY) !== '1') {
          sessionStorage.setItem(AUTH_RETRY, '1');
          sessionStorage.setItem(TRIGGER, '1');
          sessionStorage.setItem(STARTED_AT, String(Date.now()));
          location.reload();
        } else {
          sessionStorage.removeItem(AUTH_RETRY);
        }
        return;
      }
      if (message && !message.includes('불러오는 중')) {
        sessionStorage.removeItem(AUTH_RETRY);
        clearInterval(watchAuth);
      }
    }, 300);
  }, 300);
})();
