const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto('file://' + process.cwd() + '/preview-v2.html');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: '/tmp/vetsync-v2-' + width + '.png', fullPage: true });
      assert.match(await page.locator('body').innerText(), /0.88 mL/);
      await page.close();
    }
    console.log('390px / 1280px 화면 및 가로 넘침 확인 통과');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
