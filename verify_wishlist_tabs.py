
import asyncio
from playwright.async_api import async_playwright
import os

async def verify_wishlist_tabs():
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        # Setup directories
        os.makedirs("/home/jules/verification/videos", exist_ok=True)
        os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

        context = await browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={'width': 375, 'height': 812}
        )
        page = await context.new_page()

        # Load the page
        path = os.path.abspath("docs/public.html")
        await page.goto(f"file://{path}")
        await page.wait_for_timeout(1000)

        # CUJ 1: Force wishlist view and mock owner session
        await page.evaluate("""
            $('body').addClass('public-body');
            $('#wishlist-view').addClass('active').show();
            $('.view-section').not('#wishlist-view').hide();

            // Mock owner
            window.currentUserId = 'user-123';
            window.currentStoreId = 'user-123';

            // Trigger UI update for owner
            $('#btn-owner-add-wishlist').show();
        """)
        await page.wait_for_timeout(500)

        # Screenshot of the grid with tabs as owner
        await page.screenshot(path="/home/jules/verification/screenshots/wishlist_tabs_owner.png")
        await page.wait_for_timeout(500)

        # CUJ 2: Switch tabs
        await page.click(".wishlist-tab[data-index='1']") # Click Lista 2
        await page.wait_for_timeout(500)
        await page.screenshot(path="/home/jules/verification/screenshots/wishlist_tab_switched.png")

        # CUJ 3: Open "Add Card" modal
        await page.click("#btn-owner-add-wishlist")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="/home/jules/verification/screenshots/wishlist_add_modal.png")

        await page.wait_for_timeout(1000)
        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_wishlist_tabs())
