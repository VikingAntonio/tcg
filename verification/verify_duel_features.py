import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def run_verification():
    print("Starting Playwright verification...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = await context.new_page()

        print("Navigating to duel simulator in practice mode...")
        await page.goto("http://localhost:8000/duel.html?layout=yugioh&mode=practice")
        await page.wait_for_timeout(1000)

        # Draw a card so we have one on playmat
        print("Drawing a card...")
        # We can trigger robar via the deck zone click/menu programmatically to be super fast
        await page.evaluate("""() => {
            const deckZone = document.querySelector(".board-zone.zone-type-deck");
            if (deckZone) {
                // Open menu
                deckZone.click();
            }
        }""")
        await page.wait_for_timeout(500)

        # Click draw option programmatically
        await page.evaluate("""() => {
            const drawBtn = document.querySelector("#deck-menu-draw");
            if (drawBtn) drawBtn.click();
        }""")
        await page.wait_for_timeout(1000)

        # The card should be in the hand. Let's find it.
        card = page.locator(".duel-card").first

        # Left-click on the card to open the context menu programmatically or via click
        print("Left-clicking on the card to open context menu...")
        await card.click(force=True)
        await page.wait_for_timeout(500)

        # Check if #card-menu is active
        is_menu_visible = await page.locator("#card-menu").is_visible()
        print(f"Card context menu visible on left-click: {is_menu_visible}")

        # Click outside the menu to dismiss it
        await page.locator("#playmat").click(position={"x": 50, "y": 50}, force=True)
        await page.wait_for_timeout(500)

        # Let's hover over the card to update preview
        await card.hover()
        await page.wait_for_timeout(500)

        # Click the zoom button on preview programmatically
        print("Clicking the zoom magnifying glass button...")
        await page.evaluate("""() => {
            const btn = document.querySelector("#btn-magnify-preview");
            if (btn) btn.click();
        }""")
        await page.wait_for_timeout(1000)

        # Take screenshot of the sweetalert zoom modal
        os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
        screenshot_path = "/home/jules/verification/screenshots/zoom_modal.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot of zoom modal saved to {screenshot_path}")

        # Close the modal programmatically
        await page.evaluate("""() => {
            const btn = document.querySelector(".swal2-close");
            if (btn) btn.click();
        }""")
        await page.wait_for_timeout(500)

        # Let's set custom stats programmatically
        print("Setting custom ATK and DEF in accessories panel...")
        await page.evaluate("""() => {
            const atkInput = document.querySelector("#accessories-panel-p1 .custom-atk-input");
            const defInput = document.querySelector("#accessories-panel-p1 .custom-def-input");
            if (atkInput && defInput) {
                atkInput.value = "3000";
                defInput.value = "2500";
            }
            const applyBtn = document.querySelector("#accessories-panel-p1 .btn-apply-custom-stats");
            if (applyBtn) applyBtn.click();
        }""")
        await page.wait_for_timeout(1000)

        # Take another screenshot showing the custom ATK/DEF badge on the card and updated preview
        screenshot_badge_path = "/home/jules/verification/screenshots/custom_stats.png"
        await page.screenshot(path=screenshot_badge_path)
        print(f"Screenshot of custom ATK/DEF badge saved to {screenshot_badge_path}")

        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
