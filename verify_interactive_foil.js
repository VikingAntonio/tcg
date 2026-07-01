const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  await page.goto('http://localhost:8080/public.html');

  // Check if deviceorientation listener is gone (at least checking code presence in window)
  const orientationListenerCount = await page.evaluate(() => {
    // We can't easily check added listeners without instrumentation,
    // but we can check if handleGlobalOrientation is defined if it was global (it wasn't).
    // Let's check if there's any obvious sign of it.
    return !!window.DeviceOrientationEvent;
  });
  console.log('DeviceOrientationEvent still exists in browser:', orientationListenerCount);

  // We need to navigate to a deck and render cards
  // Since we are in the sandbox, we might not have real data.
  // Let's check the code in app.js via evaluate
  const codeCheck = await page.evaluate(() => {
      const script = document.querySelector('script[src="js/app.js"]');
      return fetch('js/app.js').then(r => r.text()).then(t => {
          return {
              hasGyro: t.includes('handleGlobalOrientation') || t.includes('deviceorientation'),
              hasMouseInteraction: t.includes('mousemove touchmove') && t.includes('rotateX')
          };
      });
  });
  console.log('Code Analysis:', codeCheck);

  await browser.close();
})();
