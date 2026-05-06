const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Test Public View
  console.log('Testing Public View...');
  await page.goto('http://localhost:8080/public.html?id=Viking%20TCG'); // Using a likely existing user identifier
  await page.waitForTimeout(2000);

  // Check if companion exists
  const companion = await page.$('#companion-wrapper');
  if (companion) {
    console.log('Companion wrapper found.');
  } else {
    console.error('Companion wrapper NOT found.');
  }

  // Check for model-viewer
  const modelViewer = await page.$('model-viewer');
  if (modelViewer) {
    console.log('model-viewer found.');
  } else {
    console.log('model-viewer NOT found (might be normal if no spirit selected).');
  }

  // Click companion to open menu
  await page.click('#floating-companion-container');
  await page.waitForTimeout(500);
  const menu = await page.$('#companion-menu.active');
  if (menu) {
    console.log('Companion menu opened successfully.');
  } else {
    console.error('Companion menu failed to open.');
  }

  // Click Chatear
  await page.click('#menu-item-chat');
  await page.waitForTimeout(500);
  const chatbot = await page.$('#chatbot-container.active');
  if (chatbot) {
    console.log('Chatbot opened successfully.');
  } else {
    console.error('Chatbot failed to open.');
  }

  // Switch view and check context
  console.log('Switching to Auctions view...');
  await page.click('[data-view="auctions"]');
  await page.waitForTimeout(1000);

  // Check bubble content (if any) - might be hard as it's timed
  const bubble = await page.$('#companion-bubble');
  if (bubble) {
    const text = await bubble.innerText();
    console.log('Companion bubble text:', text);
  }

  await page.screenshot({ path: 'verify_public_chatbot.png', fullPage: true });

  await browser.close();
})();
