import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def run_verification():
    print("Starting Playwright verification for Pokemon swap and banish features...")
    # Ensure verification directories exist
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Record video
        context = await browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 1280, "height": 720}
        )
        page = await context.new_page()

        print("Navigating to duel simulator in pokemon layout & practice mode...")
        await page.goto("http://localhost:8000/docs/duel.html?layout=pokemon&mode=practice")
        await page.wait_for_timeout(1000)

        # 1. Place cards on active and bench zones programmatically
        print("Placing cards on active and bench zones programmatically...")
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

        # 2. Open context menu on Pikachu
        print("Opening context menu on Pikachu...")
        await page.locator("#test_active_card").click(button="right")
        await page.wait_for_timeout(500)

        # Position menu center for reliable click in headless viewport
        await page.evaluate("""() => {
            const menu = document.getElementById("card-menu");
            if (menu) {
                menu.style.left = "300px";
                menu.style.top = "200px";
            }
        }""")
        await page.wait_for_timeout(500)

        # 3. Click "Activo / Banca" to show swap options
        print("Opening swap options popup...")
        await page.locator("#menu-swap-active-bench").click(force=True)
        await page.wait_for_timeout(1000)

        # Take screenshot of the sweetalert swap modal
        await page.screenshot(path="/home/jules/verification/screenshots/swap_modal.png")
        print("Took screenshot of the swap options modal.")

        # 4. Swap positions with Charizard
        print("Swapping positions...")
        await page.locator(".swal-swap-btn[data-target-card-id='test_bench_card']").click(force=True)
        await page.wait_for_timeout(1000)

        # 5. Send Charizard (now at active_1) to banished slot
        print("Opening context menu on Charizard to send to banished...")
        await page.locator("#test_bench_card").click(button="right")
        await page.wait_for_timeout(500)

        await page.evaluate("""() => {
            const menu = document.getElementById("card-menu");
            if (menu) {
                menu.style.left = "300px";
                menu.style.top = "200px";
            }
        }""")
        await page.wait_for_timeout(500)

        print("Clicking Enviar a Removido...")
        await page.locator("#menu-to-banish").click(force=True)
        await page.wait_for_timeout(1000)

        # Final screenshot at terminal state
        print("Taking final screenshot of playmat in terminal state...")
        await page.screenshot(path="/home/jules/verification/screenshots/verification_swap_banish.png")

        print("Verification complete!")
        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
