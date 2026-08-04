import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def run_verification():
    print("Starting Playwright verification with video and screenshots for Pokemon swap and banish...")

    # Ensure directories exist
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Record video of the CUJ
        context = await browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = await context.new_page()

        print("Navigating to duel simulator...")
        await page.goto("http://localhost:8000/docs/duel.html?layout=pokemon&mode=practice")
        await page.wait_for_timeout(1000)

        # 1. Place cards on active and bench zones programmatically
        print("Setup: Placing Pikachu and Charizard on the field...")
        await page.evaluate("""() => {
            const cardActive = {
                instanceId: "test_active_card",
                name: "Pikachu Activo",
                imageUrl: "https://images.ygoprodeck.com/images/cards/89631139.jpg",
                description: "Test Pikachu",
                owner: "player1",
                controller: "player1",
                zone: "active_1",
                faceDown: false,
                tapped: false,
                counters: 0,
                z: 100
            };
            const cardBench = {
                instanceId: "test_bench_card",
                name: "Charizard Banca",
                imageUrl: "https://images.ygoprodeck.com/images/cards/46986414.jpg",
                description: "Test Charizard",
                owner: "player1",
                controller: "player1",
                zone: "bench_1_1",
                faceDown: false,
                tapped: false,
                counters: 0,
                z: 101
            };
            state.cards.push(cardActive);
            state.cards.push(cardBench);
            renderAllCards();
        }""")
        await page.wait_for_timeout(1000)

        # 2. Trigger active/banca graphical targeting
        print("Triggering graphical position-swapping targeting mode...")
        # Hover/Quick action or context menu. Let's right click to trigger the context menu.
        await page.locator("#test_active_card").click(button="right")
        await page.wait_for_timeout(500)

        # Relocate context menu
        await page.evaluate("""() => {
            const menu = document.getElementById("card-menu");
            if (menu) {
                menu.style.left = "400px";
                menu.style.top = "200px";
            }
        }""")
        await page.wait_for_timeout(500)

        # Screenshot of scrollable context menu
        await page.screenshot(path="/home/jules/verification/screenshots/swap_modal.png")
        await page.wait_for_timeout(500)

        print("Clicking 'Activo / Banca' option in menu...")
        await page.locator("#menu-swap-active-bench").click(force=True)
        await page.wait_for_timeout(1000)

        # Click Charizard to perform swap
        print("Targeting Charizard to perform swap...")
        await page.locator("#test_bench_card").click(force=True)
        await page.wait_for_timeout(1000)

        # 3. Banish Charizard to see banished zone placement next to deck
        print("Banish Charizard...")
        await page.locator("#test_bench_card").click(button="right")
        await page.wait_for_timeout(500)

        await page.evaluate("""() => {
            const menu = document.getElementById("card-menu");
            if (menu) {
                menu.style.left = "400px";
                menu.style.top = "200px";
            }
        }""")
        await page.wait_for_timeout(500)

        await page.locator("#menu-to-banish").click(force=True)
        await page.wait_for_timeout(1000)

        # 4. Save final screenshot
        print("Saving final state screenshot...")
        await page.screenshot(path="/home/jules/verification/screenshots/verification_swap_banish.png")
        await page.wait_for_timeout(1000)

        # Close and save video
        await context.close()
        await browser.close()
        print("Verification finished successfully! Video saved.")

if __name__ == "__main__":
    asyncio.run(run_verification())
