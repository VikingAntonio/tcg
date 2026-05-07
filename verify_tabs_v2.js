const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Helper to wait and click
  async function waitAndClick(selector) {
    await page.waitForSelector(selector, { state: 'visible' });
    await page.click(selector);
  }

  console.log('Testing Admin Companion Modal...');
  await page.goto('http://localhost:8080/admin.html');
  // Inject mock user to bypass login if possible or just open modal
  await page.evaluate(() => {
    localStorage.setItem('viking_user', JSON.stringify({ id: 'test', role: 'admin' }));
  });
  await page.reload();

  try {
    await waitAndClick('#btn-add-companion');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'verification/screenshots/admin_tab_1.png' });

    await waitAndClick('.tab-btn[data-tab="configuracion"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'verification/screenshots/admin_tab_2.png' });
  } catch (e) {
    console.log('Admin modal error: ' + e.message);
  }

  console.log('Testing Users Page...');
  await page.goto('http://localhost:8080/users.html');
  // Users page might redirect to login if not authenticated
  await page.evaluate(() => {
    localStorage.setItem('viking_user', JSON.stringify({ id: 'test', role: 'admin' }));
  });
  await page.reload();

  try {
    // Wait for user list and click a gear icon
    await page.waitForSelector('.fa-cog', { timeout: 5000 });
    const gears = await page.$$('.fa-cog');
    if (gears.length > 0) {
      await gears[0].click();
      await page.waitForSelector('#user-modal', { state: 'visible' });

      await page.screenshot({ path: 'verification/screenshots/user_tab_1.png' });

      await waitAndClick('.tab-btn[data-tab="permisos"]');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'verification/screenshots/user_tab_2.png' });

      await waitAndClick('.tab-btn[data-tab="perfil"]');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'verification/screenshots/user_tab_3.png' });
    } else {
       console.log('No gear icons found on users.html');
    }
  } catch (e) {
    console.log('Users page error: ' + e.message);
  }

  await browser.close();
})();
