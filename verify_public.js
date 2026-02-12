const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to public.html with a dummy store param
  await page.goto('http://localhost:8000/public.html?store=test');

  // Wait for some time to load
  await page.waitForTimeout(2000);

  // Take screenshot of header
  await page.screenshot({ path: 'verification/public_header.png' });

  // Open Compañeros modal
  await page.click('#spirit-btn');
  await page.waitForTimeout(1000);

  // Take screenshot of modal
  await page.screenshot({ path: 'verification/public_spirits_modal.png' });

  // Check if selection buttons are gone
  const buttons = await page.locator('.spirit-card .btn-select').count();
  console.log('Selection buttons found:', buttons);

  // Check for auto-rotate and orientation on model-viewer
  const modelViewer = page.locator('model-viewer').first();
  if (await modelViewer.count() > 0) {
      const autoRotate = await modelViewer.getAttribute('auto-rotate');
      const orientation = await modelViewer.getAttribute('orientation');
      console.log('Auto-rotate:', autoRotate);
      console.log('Orientation:', orientation);
  } else {
      console.log('No model-viewer found (might need actual DB data)');
  }

  await browser.close();
})();
