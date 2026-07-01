const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Load the admin page. We need to bypass login or mock it.
  // Since we are in the sandbox, maybe we can just open the file.
  await page.goto('file://' + process.cwd() + '/docs/admin.html');

  // Mock currentUser and session
  await page.evaluate(() => {
    window.currentUser = { id: 'test-user', role: 'admin' };
    localStorage.setItem('tcg_session', JSON.stringify(window.currentUser));
    // Trigger the authenticated view manually if needed, or wait for scripts to load
    if (typeof showAuthenticatedContent === 'function') {
        showAuthenticatedContent();
    }
  });

  // Open deck editor
  await page.evaluate(() => {
      editDeck({ id: 'test-deck', name: 'Test Deck' });
  });

  // Wait for the editor to be visible
  await page.waitForSelector('#view-deck-editor', { state: 'visible' });

  // Try to click the Foil 3D checkbox in Nexus layout
  const nexusToggle = page.locator('#nexus-show-foil-toggle');
  console.log('Nexus toggle visible:', await nexusToggle.isVisible());

  await nexusToggle.click();
  console.log('Nexus toggle checked after click:', await nexusToggle.isChecked());

  // Try to click the one in mobile layout (just in case)
  const mobileToggle = page.locator('#input-deck-show-foil');
  console.log('Mobile toggle checked after nexus click:', await mobileToggle.isChecked());

  await mobileToggle.click();
  console.log('Mobile toggle checked after direct click:', await mobileToggle.isChecked());

  await browser.close();
})();
