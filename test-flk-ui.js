const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require('playwright');

// Serve only synthetic patients; the test never connects to VetSync.
let source = fs.readFileSync('vetsync-panel.src.js', 'utf8').replace('/* DOSE_ENGINE */',
  fs.readFileSync('dose-engine.js', 'utf8') + '\nconst doseEngine = createDoseEngine(' + fs.readFileSync('drug-defaults.json', 'utf8') + ');');
source = source.replace("{ id: 'flk', label: 'FLK', run: flkPatients }", "{ id: 'flk', label: 'FLK', run: async () => [] }");
source = source.replace("{ id: 'inj', label: '주사', run: injections }", `{
  id: 'inj', label: '주사', run: async () => {
    window.__testInjectionReads = (window.__testInjectionReads || 0) + 1;
    const snapshot = makeSnapshot([['오늘',17,17],['내일',9,109]].map(([tag,hour,order]) => ({ pid:'demo', patient:'테스트 환자', code:'DEMO', breed:'푸들', weight:'5 kg', cage:'A장-1',
      drug:'SAM',dose:'22mpk',route:'IV',frequency:'TID',raw:'SAM 22mpk IV',note:'',instruction:'',
      tag,hour,order,cancelled:false })));
    const previousSnapshot = loadBaseline(ymd(new Date())) || JSON.parse(JSON.stringify(snapshot));
    saveBaseline(ymd(new Date()), previousSnapshot);
    const compared = compareSnapshot(snapshot, previousSnapshot, {});
    const result = [{heading:'가상 주사 목록', groups:compared.normal,reviewNote:'현재 확인 · 테스트'}];
    Object.assign(result, {snapshot,previousSnapshot,states:{},changeCount:compared.changes});
    return result;
  }
}`);
source = source.replace("    show('blood');", "    show('inj');");
source = source.slice(0, source.lastIndexOf("  if (!location.hostname.endsWith")) + 'open();})();';

(async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/panel.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/panel.js' ? source : '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/panel.js" defer></script><body></body>');
  });
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless:true });
    const page = await browser.newPage({ viewport:{width:390,height:844} });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://**/*', (route) => route.abort());
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.getByRole('button', {name:'역가 설정',exact:true}).click();
    await page.locator('#vsp-stock-value').fill('100');
    await page.getByRole('button', {name:'저장',exact:true}).click();
    assert.match(await page.locator('.vsp-treatment').innerText(), /1.10 mL/);
    assert.equal(await page.locator('#vsp-accept').count(), 1);
    await page.locator('#vsp-accept').click();
    assert.equal(await page.locator('#vsp-accept').count(), 0);
    assert.equal(await page.getByRole('checkbox', {name:'테스트 환자 주사 준비 완료'}).isChecked(), false);
    await page.getByRole('checkbox', {name:'테스트 환자 주사 준비 완료'}).check();
    await page.locator('#vsp-stock-value').fill('150');
    await page.getByRole('button', {name:'저장',exact:true}).click();
    assert.equal(await page.locator('[data-ready-confirm]').count(), 1);
    await page.locator('#vsp-time').selectOption('오늘|17');
    const readsBefore = await page.evaluate(() => window.__testInjectionReads);
    await page.locator('#vsp-accept').click();
    assert.equal(await page.evaluate(() => window.__testInjectionReads), readsBefore);
    assert.equal(await page.locator('[data-ready-confirm]').count(), 0);
    await page.locator('#vsp-time').selectOption('');
    assert.equal(await page.locator('[data-ready-confirm]').count(), 0);
    await page.reload();
    assert.equal(await page.locator('[data-ready-confirm]').count(), 0);
    assert.equal(await page.locator('#vsp-accept').count(), 0);
    await page.getByRole('button', {name:'역가 설정',exact:true}).click();
    await page.locator('#vsp-stock-value').fill('100');
    await page.getByRole('button', {name:'저장',exact:true}).click();
    assert.equal(await page.locator('[data-ready-confirm]').count(), 1);
    await page.locator('#vsp-accept').click();
    assert.equal(await page.getByRole('checkbox', {name:'테스트 환자 주사 준비 완료'}).isChecked(), true);
    await page.locator('#vsp-stock-unit').selectOption('ug');
    assert.equal(await page.locator('#vsp-stock-value').inputValue(), '100000');
    await page.getByRole('button', {name:'저장',exact:true}).click();
    await page.reload();
    assert.match(await page.locator('.vsp-treatment').innerText(), /1.10 mL/);
    await page.getByRole('button', {name:'역가 설정',exact:true}).click();
    await page.getByRole('button', {name:'기본값 복원',exact:true}).click();
    assert.match(await page.locator('.vsp-treatment').innerText(), /0.73 mL/);
    await page.locator('#vsp-stock-value').fill('0');
    await page.getByRole('button', {name:'저장',exact:true}).click();
    assert.match(await page.locator('#vsp-stock-error').innerText(), /0보다/);
    await page.locator('#vsp-stock-drug').selectOption('Cefotaxime');
    assert.equal(await page.locator('#vsp-stock-value').inputValue(), '200');
    for (const width of [320,390,1024]) {
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Stock controls fit at ' + width);
    }
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'/tmp/vetsync-stock-2.4-mobile.png',fullPage:true});
    await page.getByRole('button', {name:'FLK',exact:true}).click();
    await page.locator('#vsp-flk-name').fill('가상 환자');
    await page.locator('#vsp-flk-weight').fill('9.8');
    await page.getByRole('button', {name:'추가',exact:true}).click();
    assert.equal(await page.locator('[data-flk-rate="0"]').inputValue(), '1.5');
    await page.getByRole('button', {name:'가상 환자 FLK 속도 늘리기',exact:true}).click();
    assert.equal(await page.locator('[data-flk-rate="0"]').inputValue(), '2');
    assert.match(await page.locator('.vsp-flk-bag').innerText(), /49 mL/);
    await page.locator('#vsp-flk-name').fill('입력 중 "이름"');
    await page.locator('[data-flk-ampules="0"]').fill('2');
    await page.locator('[data-flk-ampules="0"]').dispatchEvent('change');
    assert.equal(await page.locator('#vsp-flk-name').inputValue(), '입력 중 "이름"');
    await page.locator('[data-flk-rate="0"]').fill('3');
    await page.locator('[data-flk-rate="0"]').dispatchEvent('change');
    assert.match(await page.locator('.vsp-flk-bag').innerText(), /150 mL/);
    await page.locator('#vsp-flk-name').fill('대형 테스트');
    await page.locator('#vsp-flk-weight').fill('80');
    await page.getByRole('button', {name:'추가',exact:true}).click();
    await page.locator('[data-flk-loading="1"]').check();
    assert.equal(await page.locator('[data-flk-loading="0"]').isChecked(), false);
    await page.reload();
    await page.getByRole('button', {name:'FLK',exact:true}).click();
    assert.equal(await page.locator('.vsp-flk-result').count(), 2);
    assert.equal(await page.locator('[data-flk-rate="0"]').inputValue(), '3');
    assert.equal(await page.locator('[data-flk-ampules="0"]').inputValue(), '2');
    assert.equal(await page.locator('[data-flk-loading="1"]').isChecked(), true);
    await page.locator('[data-flk-rate="0"]').fill('1.7');
    await page.locator('[data-flk-rate="0"]').dispatchEvent('change');
    assert.equal(await page.locator('[data-flk-rate="0"]').inputValue(), '3');
    assert.match(await page.locator('[data-flk-error="0"]').innerText(), /0.5/);
    for (const width of [320,390,1024]) {
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No overflow at ' + width);
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-flk-rate="0"]').dispatchEvent('change');
    await page.screenshot({path:'/tmp/vetsync-flk-2.4-mobile.png',fullPage:true});
    await page.setViewportSize({width:1024,height:768});
    await page.screenshot({path:'/tmp/vetsync-flk-2.4-desktop.png',fullPage:true});
    assert.deepEqual(errors, []);
    console.log('FLK controls, per-patient persistence, stored strengths and mobile layout passed');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
