const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // Test Admin Mask Editor
  await page.goto('http://localhost:8080/admin.html');
  // We need to trigger the mask editor. Usually it's in a modal.
  // Let's check if the code for the move icon is there.
  const moveIcon = await page.evaluate(() => {
    return document.querySelector('.zoom-controls .fa-arrows-alt') !== null;
  });
  console.log('Move icon exists in Admin:', moveIcon);

  // Test Public Swiper Centering
  await page.goto('http://localhost:8080/public.html');
  const swiperStyles = await page.evaluate(() => {
    const el = document.querySelector('.decks-grid');
    if (!el) return 'not found';
    const style = window.getComputedStyle(el);
    return {
        display: style.display,
        justifyContent: style.justifyContent
    };
  });
  console.log('Public Decks Grid Styles:', swiperStyles);

  // Check ztext scripts
  const ztextLoaded = await page.evaluate(() => {
    return !!window.zText;
  });
  console.log('ztext.js loaded in Public:', ztextLoaded);

  await browser.close();
})();
