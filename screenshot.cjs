const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ 
    channel: 'chrome',
    headless: true 
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/dynamic-buttons.png' });

  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/tmp/dynamic-buttons2.png' });

  await browser.close();
  console.log('Screenshots saved');
})();
