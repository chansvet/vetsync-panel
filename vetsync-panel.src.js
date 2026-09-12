/*
 * VetSync 인턴 패널 - 채혈 목록과 주사 목록을 한 번에
 *
 * 이 파일은 사람이 읽기 위한 원본이다. 북마크에 넣는 한 줄짜리 주소는
 * build-bookmarklet.js 로 만든다.
 *
 * vetsync4.vetu1.com 에 로그인된 상태에서 실행하면 화면 위에 패널이 뜬다.
 * GET 요청만 보낸다. 차트를 수정하거나 업무를 완료 처리하지 않는다.
 */

(() => {
  const API = 'https://api-vetsync4.vetu1.com/api/v1';
  const HOSPITAL_ID = '24';
  const DRAW_HOUR = 9;
  const EVENING = [17, 18, 19, 20, 21, 22, 23];
  const NEXT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const LIVE = ['PLANNED', 'COMPLETED', 'IN_PROGRESS', 'SKIPPED'];

  // ---- 채혈 규칙 ----
  const LAB = /혈검|혈액검사|도말|가스|전해질|신4|신장\s*4종|간4|간\s*4종|간이혈당|\bCBC\b|\bCRP\b|\bSAA\b|\bfSAA\b|\bSDMA\b|\bTnI\b|\bCPL\b|\bfPL\b|\bFPL\b|\bPCV\b|\bCK\b|\bChem\d*\b|\bgas\b|\blyte\b|\bTBIL\b|\bT\.?bil\b|\bBUN\b|\bCrea\b|\bALT\b|\bALP\b|\bALB\b|\bphos\b|\bTP\s*\/\s*A\w*\b|\bLactate\b/i;
  const NOT_LAB = /혈압|항혈전|고혈압|이뇨|수혈|요배양|요검사|뇨검사|요카|초음파|방사선|조직검사|항감테|내복|아이스팩|음수|배뇨|배변|CRI|스푼|산소|O2\s*supply/i;
  const GLUCOSE_ONLY = /^(간이혈당|혈당|혈당\s*체크)$/;
  const ELECTROLYTE = /전해질|가스|\bgas\b|\blyte\b/i;
  const HANDLING = /팔|앞다리|뒷다리|후지|전지|경정맥|채혈|지혈|각각|나비침|희석|냉장/;

  // ---- 주사 규칙 ----
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

  // 빈도 표기가 없을 때 적용하는 기본 회진 시간.
  const ROUTINE = [17, 21, 1, 9];
  const ROUTINE_BY_FREQUENCY = { BID: [21, 9], TID: [17, 1, 9] };
  // 화면에서는 <u>, 복사한 글에서는 _ 로 바뀌는 자리표시자
  const U0 = '\u0001', U1 = '\u0002';
  const E0 = '\u0003', E1 = '\u0004';
  // 주황색 변경, 주황색 취소선 자리표시자
  const O0 = '\u0005', O1 = '\u0006';
  const X0 = '\u0007', X1 = '\u0008';
  const INJ_BASELINE = 'vetsync-injection-baseline-v1:';

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const shift = (date, n) => {
    const d = new Date(date + 'T00:00:00+09:00');
    d.setDate(d.getDate() + n);
    return ymd(d);
  };

  const headers = () => {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) throw new Error('로그인이 안 되어 있습니다.');
    return { Authorization: 'Bearer ' + JSON.parse(raw).state.accessToken, 'X-Hospital-Id': HOSPITAL_ID };
  };
  const get = async (path) => {
    const r = await fetch(API + path, { headers: headers() });
    if (r.status === 401) throw new Error('접속이 만료됐습니다. 새로고침하고 다시 눌러주세요.');
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

  const noteOf = (row) => {
    if (row.instructionText) return row.instructionText.trim();
    const parts = row.displayName.split(/[,()[\]{}]/).map((s) => s.trim()).filter(Boolean);
    const hits = parts.filter((p) => HANDLING.test(p));
    return hits.length ? hits.join(', ') : '';
  };

  const breedOf = (patient) => {
    const breed = patient.breedName || patient.breedLabel || patient.breedDisplayName ||
      patient.speciesBreed || patient.breed;
    return typeof breed === 'object' ? (breed.name || breed.label || breed.displayName || '품종 미상') :
      (breed || '품종 미상');
  };
  const patientTitle = (name, code, breed) => {
    const patientCode = code ? (String(code).startsWith('#') ? String(code) : '#' + code) : '';
    const info = [patientCode, breed].filter(Boolean).join(' · ');
    return name + (info ? ' (' + info + ')' : '');
  };

  // ---- 채혈 ----
  async function bloodwork(date) {
    const { charts, details } = await collect(date);
    const rows = [];
    let needPrev = false;
    charts.forEach((chart, i) => {
      const detail = details[i];
      if (!admitted(chart, detail, date, DRAW_HOUR)) return;
      const labs = rowsOf(detail).filter((r) => {
        const n = (r.displayName || '').trim();
        if (!LAB.test(n) || NOT_LAB.test(n) || GLUCOSE_ONLY.test(n)) return false;
        return (r.cells || []).some((c) => c.hourSlot === DRAW_HOUR && LIVE.includes(c.status));
      });
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
      const prev = await collect(shift(date, -1));
      rows.forEach((row) => {
        if (!row.needTemp) return;
        const i = prev.charts.findIndex((c) => c.patient.patientId === row.pid);
        if (i < 0) return;
        const t = latestTemp(prev.details[i]);
        if (t) row.note = [row.note, '체온 ' + t.v + ' (전날)'].filter(Boolean).join(' / ');
      });
    }
    return [{ heading: date + ' 오전 9시 채혈', groups: rows }];
  }

  // ---- 주사 ----
  const isInjection = (name) => {
    const n = (name || '').trim();
    if (!n || NONAME.test(n)) return false;
    if (SKIP.test(n) || PROC.test(n) || CRI.test(n) || EYE.test(n) || NOTINJ.test(n) || ORAL.test(n)) return false;
    return ROUTE.test(n) || KNOWN.test(n);
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
    const d = s.match(/(\d+(?:\.\d+)?)\s*(mpk|gpk|mg\s*\/\s*kg|mg\s*\/\s*dog|mg\s*\/\s*cat|ml\s*\/\s*kg|ug\s*\/\s*kg|mcg\s*\/\s*kg|ug\s*\/\s*cat|IU\s*\/\s*kg|U\s*\/\s*kg|units?|칸|ml|mg|cc|amp)\b/i);
    if (d) { dose = d[0].replace(/\s+/g, ''); s = s.replace(d[0], ' '); }
    else {
      const b = s.match(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/);
      if (b) { dose = b[1]; s = s.replace(b[0], ' '); }
    }
    return { drug: s.replace(/\s+/g, ' ').trim().replace(/[,\-]+$/, ''), dose, route, frequency, note: notes.filter(Boolean).join(', ') };
  }

  const splitDrugs = (name) => {
    if (!name.includes(',')) return [name];
    const parts = name.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
    return parts.length > 1 && parts.every((p) => ROUTE.test(p) || KNOWN.test(p)) ? parts : [name];
  };

  function pickInj(chart, detail, date, hours, tag) {
    const out = [];
    treatRows(detail).forEach((row) => {
      const name = (row.displayName || '').trim();
      if (!isInjection(name)) return;
      const parts = splitDrugs(name);
      const rowFrequency = frequencyFrom(name + ' ' + (row.instructionText || ''));
      (row.cells || []).forEach((cell) => {
        if (!hours.includes(cell.hourSlot) || !LIVE.includes(cell.status)) return;
        if (!admitted(chart, detail, date, cell.hourSlot)) return;
        parts.forEach((p, i) => {
          const parsed = parseDrug(p);
          out.push({
            pid: String(chart.patient.patientId), patient: chart.patient.name, code: chart.patient.hospitalPatientCode,
            breed: breedOf(chart.patient),
            cage: chart.cageLabel || '미지정', tag, hour: cell.hourSlot,
            order: (tag === '내일' ? 100 : 0) + cell.hourSlot,
            key: name + '#' + i, raw: name, instruction: row.instructionText || '', ...parsed,
            frequency: parsed.frequency || rowFrequency,
          });
        });
      });
    });
    return out;
  }

  const normDrug = (s) => String(s || '').toLowerCase().replace(/[\s,._-]+/g, '');
  const timeKey = (t) => t.tag + '|' + t.hour;
  const frequencyOf = (item) => {
    if (item && item.frequency) return item.frequency;
    const written = frequencyFrom(String(item && item.note || '') + ' ' + String(item && item.instruction || ''));
    if (written) return written;
    const count = new Set((item && item.times || []).map(timeKey)).size;
    return ({ 1: 'SID', 2: 'BID', 3: 'TID', 4: 'QID' })[count] || '';
  };
  const timeLabel = (t, item) => {
    const label = (t.tag === '내일' ? '내일 ' : '') + t.hour + '시';
    const frequency = frequencyOf(item);
    if (frequency === 'SID') return label;
    const expected = ROUTINE_BY_FREQUENCY[frequency] || ROUTINE;
    return expected.includes(t.hour) ? label : U0 + label + U1;
  };
  const orange = (s) => O0 + s + O1;
  const cancelled = (s) => X0 + s + X1;
  const routeLabel = (route) => /^(SC|IM)$/.test(route) ? U0 + route + U1 : route;

  function makeSnapshot(rows) {
    const patients = {};
    rows.forEach((r) => {
      const p = patients[r.pid] = patients[r.pid] || {
        pid: r.pid, name: r.patient, code: r.code, breed: r.breed, cage: r.cage, predicted: false, items: {},
      };
      if (r.cage !== '미지정') p.cage = r.cage;
      if (r.predicted) p.predicted = true;
      const item = p.items[r.key] = p.items[r.key] || {
        match: normDrug(r.drug) || normDrug(r.raw), drug: r.drug, dose: r.dose, route: r.route, frequency: r.frequency,
        note: r.note, instruction: r.instruction, conditional: COND.test(r.raw + ' ' + r.instruction), times: [],
      };
      if (!item.times.some((t) => timeKey(t) === timeKey(r))) {
        item.times.push({ tag: r.tag, hour: r.hour, order: r.order });
      }
    });
    Object.values(patients).forEach((p) => {
      p.items = Object.values(p.items).map((item) => ({
        ...item, times: item.times.sort((a, b) => a.order - b.order),
      }));
    });
    return { patients };
  }

  const rawItem = (item) => {
    const label = [item.drug, item.dose, routeLabel(item.route)].filter(Boolean).join(' ');
    const extra = [item.note, item.instruction].filter(Boolean).join(', ');
    return label + ' (' + item.times.map((t) => timeLabel(t, item)).join(', ') + ')' + (extra ? ' [' + extra + ']' : '');
  };

  function changedItem(item, prev, kind) {
    let text;
    if (kind === 'added') text = orange(rawItem(item));
    else if (kind === 'removed') text = cancelled(rawItem(item));
    else {
      const field = (now, before) => now === before ? now : orange([before, now].filter(Boolean).join('→'));
      const route = item.route === prev.route ? routeLabel(item.route) :
        orange([routeLabel(prev.route), routeLabel(item.route)].filter(Boolean).join('→'));
      const label = [field(item.drug, prev.drug), field(item.dose, prev.dose), route]
        .filter(Boolean).join(' ');
      const nowTimes = new Set(item.times.map(timeKey));
      const oldTimes = new Set(prev.times.map(timeKey));
      const times = item.times.map((t) => oldTimes.has(timeKey(t)) ? timeLabel(t, item) : orange(timeLabel(t, item)));
      prev.times.forEach((t) => { if (!nowTimes.has(timeKey(t))) times.push(cancelled(timeLabel(t, prev))); });
      const extraNow = [item.note, item.instruction].filter(Boolean).join(', ');
      const extraOld = [prev.note, prev.instruction].filter(Boolean).join(', ');
      const extra = extraNow === extraOld ? extraNow : orange([extraOld, extraNow].filter(Boolean).join('→'));
      text = label + ' (' + times.join(', ') + ')' + (extra ? ' [' + extra + ']' : '');
    }
    return text;
  }

  const sameItem = (a, b) => a.drug === b.drug && a.dose === b.dose && a.route === b.route &&
    frequencyOf(a) === frequencyOf(b) &&
    a.note === b.note && a.instruction === b.instruction &&
    a.times.map(timeKey).join(',') === b.times.map(timeKey).join(',');

  function compareSnapshot(current, previous, states) {
    const normal = [], cond = [];
    let changes = 0;
    const ids = new Set([...Object.keys(current.patients), ...Object.keys(previous ? previous.patients : {})]);
    ids.forEach((pid) => {
      const priorChanges = changes;
      const now = current.patients[pid];
      const old = previous && previous.patients[pid];
      const p = now || old;
      const state = states[pid] || {};
      const extended = !!(old && old.predicted && !now?.predicted && state.extended);
      const discharged = !!(!now && old && state.discharged);
      const title = patientTitle(p.name, p.code, p.breed);
      let status = '';
      if (now?.predicted) status = '미연장';
      else if (extended) { status = '연장'; changes += 1; }
      else if (discharged) { status = '퇴원'; changes += 1; }

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
        if (changed) changes += 1;
        const line = changedItem(item, prev, prev ? 'changed' : 'added');
        (item.conditional ? conds : lines).push(line);
      });
      oldItems.forEach((item, i) => {
        if (used.has(i)) return;
        changes += 1;
        const line = changedItem(item, null, 'removed');
        (item.conditional ? conds : lines).push(line);
      });
      const updated = changes > priorChanges;
      if (lines.length) normal.push({
        updated,
        title, cage: p.cage, status, sortName: p.name, sortCage: p.cage, body: lines, note: '',
      });
      if (conds.length) cond.push({
        updated: updated && !lines.length,
        title, cage: p.cage, status, sortName: p.name, sortCage: p.cage, body: conds, note: '',
      });
    });
    return { normal, cond, changes };
  }

  const baselineKey = (date) => INJ_BASELINE + HOSPITAL_ID + ':' + date;
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
    const rows = [];
    const states = {};
    today.charts.forEach((c) => {
      states[String(c.patient.patientId)] = { discharged: !!c.discharged, extended: false };
    });
    today.charts.forEach((c, i) => rows.push(...pickInj(c, today.details[i], date, EVENING, '오늘')));
    const extended = new Set(tomorrow.charts.map((c) => String(c.patient.patientId)));
    extended.forEach((pid) => {
      states[pid] = states[pid] || { discharged: false, extended: false };
      states[pid].extended = true;
    });
    tomorrow.charts.forEach((c, i) => rows.push(...pickInj(c, tomorrow.details[i], next, NEXT, '내일')));
    // 다음날 차트가 아직 없는 환자는 오늘 차트를 그대로 복사해 같은 줄에 이어 붙인다
    today.charts.forEach((c, i) => {
      if (extended.has(String(c.patient.patientId)) || c.discharged) return;
      pickInj(c, today.details[i], date, NEXT, '내일').forEach((r) => rows.push({ ...r, predicted: true }));
    });
    const snapshot = makeSnapshot(rows);
    let previous = loadBaseline(date);
    if (!previous) { saveBaseline(date, snapshot); previous = snapshot; }
    const g = compareSnapshot(snapshot, previous, states);
    const out = [{ heading: date + ' 17시 ~ ' + next + ' 15시 주사', groups: g.normal }];
    if (g.cond.length) out.push({ heading: '조건부', groups: g.cond });
    out.changeCount = g.changes;
    out.snapshot = snapshot;
    out.baselineKey = baselineKey(date);
    return out;
  }

  // ---- 화면 ----
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const toHtml = (s) => esc(s)
    .split(U0).join('<u style="font-weight:800">').split(U1).join('</u>')
    .split(E0).join('<strong style="font-weight:800;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:2px">')
    .split(E1).join('</strong>')
    .split(O0).join('<span style="color:#c2410c;font-weight:700">').split(O1).join('</span>')
    .split(X0).join('<span style="color:#c2410c;font-weight:700;text-decoration:line-through;text-decoration-thickness:2px">').split(X1).join('</span>');
  const asText = (sections) => sections.map((s) =>
    s.heading + '\n' + s.groups.map((g) =>
      (g.title ? g.title + ' ' + g.cage + (g.status ? ' [' + g.status + ']' : '') + (g.updated ? ' [처치 업데이트]' : '') + '\n  ' : '  ') +
      g.body.join('\n  ') + (g.note ? '\n  ' + g.note : '')
    ).join('\n')
  ).join('\n\n')
    .split(U0).join('**__').split(U1).join('__**')
    .split(E0).join('**__').split(E1).join('__**')
    .split(O0).join('**').split(O1).join('**')
    .split(X0).join('~~').split(X1).join('~~');

  const render = (sections) => sections.map((s) =>
    '<h2 style="font-size:14px;margin:18px 0 8px;color:' + (s.warn ? '#b45309' : '#6b7280') + '">' + esc(s.heading) + '</h2>' +
    (s.groups.length ? s.groups.map((g) =>
      '<div style="padding:11px 0;border-bottom:1px solid #e5e7eb">' +
      (g.title ? '<div style="font-weight:700;font-size:16px">' + toHtml(g.title) +
        ' <span style="font-weight:400;color:#6b7280">' + esc(g.cage) + '</span>' +
      (g.status ? ' <span style="display:inline-block;white-space:nowrap;padding:0 5px;border-radius:3px;font-size:13px;font-weight:800;' +
        (g.status === '연장' ? 'background:#fef08a;color:#713f12' :
          g.status === '미연장' ? 'background:#ffedd5;color:#9a3412;border-left:3px solid #f97316' :
            'background:#ffedd5;color:#c2410c;text-decoration:line-through') + '">' + esc(g.status) + '</span>' : '') +
      (g.updated ? ' <span style="color:#c2410c;font-size:13px;font-weight:700;white-space:nowrap">처치 업데이트</span>' : '') + '</div>' : '') +
      g.body.map((b) => '<div style="margin-top:3px">' + toHtml(b) + '</div>').join('') +
      (g.note ? '<div style="margin-top:3px;color:#b45309;font-weight:600">' + esc(g.note) + '</div>' : '') +
      '</div>').join('') : '<p style="color:#6b7280">해당 항목이 없습니다.</p>')
  ).join('');

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
      '-webkit-overflow-scrolling:touch;padding:0 0 40px');
    box.innerHTML =
      '<div style="position:sticky;top:0;background:#0f766e;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px">' +
      TABS.map((t, i) => '<button data-tab="' + t.id + '" style="font:inherit;font-weight:700;padding:8px 16px;border:0;' +
        'border-radius:8px;background:' + (i === 0 ? '#fff' : 'rgba(255,255,255,.2)') + ';color:' + (i === 0 ? '#0f766e' : '#fff') + '">' + t.label + '</button>').join('') +
      '<span style="flex:1"></span>' +
      '<button id="vsp-copy" style="font:inherit;padding:8px 14px;border:0;border-radius:8px;background:rgba(255,255,255,.2);color:#fff">복사</button>' +
      '<button id="vsp-x" style="font:inherit;padding:8px 14px;border:0;border-radius:8px;background:rgba(255,255,255,.2);color:#fff">닫기</button>' +
      '</div><div id="vsp-body" style="padding:0 16px"><p>불러오는 중…</p></div>';
    document.body.appendChild(box);
    let text = '';
    let requestId = 0;
    let sortMode = 'name';
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
        '<div style="margin:8px 0"><button id="vsp-refresh" style="font:inherit;padding:6px 10px;border:1px solid #9ca3af;border-radius:6px;background:#fff">새로 확인</button></div>' : '';
      const changes = id === 'inj' && sections.changeCount ?
        '<div style="margin:0 -16px;padding:9px 16px;background:#fff7ed;border-bottom:1px solid #fed7aa;display:flex;align-items:center;gap:10px">' +
        '<strong style="color:#c2410c">변경 ' + sections.changeCount + '건</strong><span style="flex:1"></span>' +
        '<button id="vsp-accept" style="font:inherit;font-weight:700;padding:7px 12px;border:1px solid #c2410c;border-radius:6px;background:#fff;color:#c2410c">변경 확인</button></div>' : '';
      body.innerHTML = sortControl + refresh + changes + render(ordered);
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

  // 확장 프로그램으로 쓸 때는 화면 구석에 버튼을 띄운다.
  // 북마클릿으로 쓸 때는 누르는 순간이 곧 실행이므로 바로 연다.
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
    // 화면이 다시 그려지면서 버튼이 사라질 수 있으므로 주기적으로 확인한다
    setInterval(mountButton, 3000);
  } else {
    open();
  }
})();
