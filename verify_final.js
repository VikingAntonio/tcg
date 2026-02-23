const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Intercept Supabase calls to provide mock data
  await page.route('**/rest/v1/usuarios*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ horario: '10am - 8pm', ubicacion: 'Centro Comercial' }])
  }));

  await page.route('**/rest/v1/bot_messages*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ message_text: 'Actionable Message!', action_url: 'http://example.com', is_active: true }])
  }));

  const filePath = 'file://' + path.resolve('docs/public.html?store=teststore');
  await page.goto(filePath);

  // Mock _supabase and CompanionBot initialization
  await page.evaluate(() => {
    window._supabase = {
      from: (table) => ({
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: { horario: '10-8', ubicacion: 'Local' }, error: null }) }),
          or: () => Promise.resolve({ data: [{ message_text: 'DB Msg', action_url: 'test' }], error: null })
        })
      })
    };

    // Force immediate show
    if (window.botInstance) {
        window.botInstance.showBubble();
    }
  });

  await page.waitForTimeout(1000);

  const bubble = page.locator('#companion-bubble');
  const isVisible = await bubble.isVisible();
  const hasFadeIn = await bubble.evaluate(el => el.classList.contains('fade-in'));
  const hasClickable = await bubble.evaluate(el => el.classList.contains('clickable'));

  console.log(`Bubble visible: ${isVisible}`);
  console.log(`Bubble has fade-in: ${hasFadeIn}`);
  console.log(`Bubble has clickable: ${hasClickable}`);

  await page.screenshot({ path: 'final_verification.png' });

  await browser.close();

  if (isVisible && hasFadeIn) {
    console.log("VERIFICATION SUCCESSFUL");
  } else {
    console.log("VERIFICATION FAILED");
    process.exit(1);
  }
})();
