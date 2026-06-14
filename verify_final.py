import asyncio
from playwright.async_api import async_playwright
import os

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})

        await page.goto('http://localhost:8000/admin.html')

        # Inject mock data and force view
        await page.evaluate("""
            window.currentUser = { id: 'test-user', max_cards_per_deck: 60 };
            window.currentDeckId = 'test-deck';
            window.localDeckCards = [
                { localId: '1', name: 'Dark Magician', image_url: 'https://images.ygoprodeck.com/images/cards/46986414.jpg', section: 'Main', position: 0 }
            ];
            showView('deck-editor');
            renderNexusDeck();
            if (typeof initNexusSortables === 'function') initNexusSortables();
        """)

        # Wait a bit for rendering
        await asyncio.sleep(2)

        # Check if PC layout is visible
        is_visible = await page.is_visible('#deck-editor-pc-layout')
        print(f"PC Layout visible: {is_visible}")

        os.makedirs('/home/jules/verification/screenshots', exist_ok=True)

        if is_visible:
            # Take screenshots
            await page.locator('#deck-editor-pc-layout').screenshot(path='/home/jules/verification/screenshots/nexus_layout_final.png')
            await page.screenshot(path='/home/jules/verification/screenshots/full_page_final.png', full_page=True)
            print("Screenshots captured.")
        else:
            # If still not visible, check computed style
            display = await page.evaluate("window.getComputedStyle(document.getElementById('deck-editor-pc-layout')).display")
            print(f"PC Layout display style: {display}")
            await page.screenshot(path='/home/jules/verification/screenshots/failure.png', full_page=True)

        await browser.close()

if __name__ == '__main__':
    asyncio.run(verify())
