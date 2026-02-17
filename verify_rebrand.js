const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Check index2.html
  await page.goto('http://localhost:8000/index2.html');
  await page.screenshot({ path: 'verification/index2_updated.png' });

  const headerText = await page.innerText('.logo');
  console.log('Header Text (index2):', headerText);

  const heroTitle = await page.innerText('.hero-title');
  console.log('Hero Title (index2):', heroTitle);

  const footerText = await page.innerText('footer');
  console.log('Footer Text (index2):', footerText);

  // Check index.html
  await page.goto('http://localhost:8000/index.html');
  await page.screenshot({ path: 'verification/index_updated.png' });

  const heroTitleMain = await page.innerText('.hero-title');
  console.log('Hero Title (index):', heroTitleMain);

  const footerTextMain = await page.innerText('footer');
  console.log('Footer Text (index):', footerTextMain);

  await browser.close();
})();
