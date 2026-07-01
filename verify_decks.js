const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Mock Supabase/data if necessary, but let's try to just load the page
  // and wait for the swiper to be populated.
  await page.goto('file://' + process.cwd() + '/docs/public.html');

  // Wait for the app to initialize and show decks
  // In app.js, it might need some time to fetch data or handle the hash/param
  try {
    await page.waitForSelector('.deck-public-item', { timeout: 10000 });
  } catch (e) {
    console.log('Decks didn\'t load automatically, maybe need to click something?');
    // Try to trigger the decks view if it's not default
    // Based on index.html/landing2.js, it might be a link
  }

  // Take a screenshot of the swiper area
  await page.screenshot({ path: '/home/jules/verification/screenshots/public_decks_initial.png' });

  // Try to simulate a hover/move over a card
  const card = await page.querySelector('.card-slot[data-show-foil="true"]');
  if (card) {
    const box = await card.boundingBox();
    await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/home/jules/verification/screenshots/public_decks_tilt.png' });
  } else {
    console.log('No card with data-show-foil="true" found.');
  }

  await browser.close();
})();
