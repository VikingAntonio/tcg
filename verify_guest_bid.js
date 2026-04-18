const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to auctions page as a guest (no localStorage session)
  await page.goto('http://localhost:3000/toonShop?view=auctions');

  // Wait for auctions to load
  await page.waitForSelector('.auction-public-card');

  // Click on the first auction card to open modal
  await page.click('.auction-public-card');
  await page.waitForSelector('#auction-detail-modal.active');

  // Try to click a quick bid button as guest
  await page.click('.btn-bid-pill:first-child');

  // Check if Swal modal appears
  const swalTitle = await page.textContent('.swal2-title');
  console.log('Swal Title:', swalTitle);

  await page.screenshot({ path: '/home/jules/verification/screenshots/guest_bid_attempt.png' });

  await browser.close();
})();
