const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Test Public Albums
  console.log('Verifying Public Albums...');
  await page.goto('http://localhost:8080/public.html?id=toonShop&view=albums');
  await page.waitForTimeout(3000);

  // Check if getCoverHtml is producing the expected style-inversiones
  const hasStyleInversiones = await page.evaluate(() => {
    return document.querySelector('.textured-cover.style-inversiones') !== null;
  });
  console.log('Has style-inversiones in public view:', hasStyleInversiones);

  // Test Admin Binders
  console.log('Verifying Admin Binders Dropdown...');
  await page.goto('http://localhost:8080/binders.html');
  await page.waitForSelector('#cover-style-select');

  const options = await page.evaluate(() => {
    const select = document.querySelector('#cover-style-select');
    return Array.from(select.options).map(o => o.value);
  });
  console.log('Available styles in dropdown:', options);

  const firstOption = await page.evaluate(() => {
    return document.querySelector('#cover-style-select').options[0].value;
  });
  console.log('First style (default):', firstOption);

  await page.screenshot({ path: 'final_verification.png', fullPage: true });
  await browser.close();
})();
