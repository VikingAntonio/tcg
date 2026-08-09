import asyncio
import os
import glob
from playwright.async_api import async_playwright

async def run_verification():
    print("Starting Playwright verification for new changes...")
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 1280, "height": 720}
        )
        page = await context.new_page()

        print("Navigating to duel simulator...")
        await page.goto("http://localhost:8000/duel.html?layout=yugioh&mode=practice")
        await page.wait_for_timeout(1000)

        # 1. Draw a card to the hand
        print("Drawing a card...")
        await page.evaluate("""() => {
            const deckZone = document.querySelector(".board-zone.zone-type-deck");
            if (deckZone) deckZone.click();
        }""")
        await page.wait_for_timeout(500)
        await page.evaluate("""() => {
            const drawBtn = document.querySelector("#deck-menu-draw");
            if (drawBtn) drawBtn.click();
        }""")
        await page.wait_for_timeout(1000)

        # 2. Open card menu on hand card (we can just click the card to open detailed preview, then right click or programmatic field place)
        # Let's drag card to field programmatically to place it on field
        print("Placing card on the field...")
        await page.evaluate("""() => {
            const cardObj = state.cards.find(c => c.zone.startsWith("hand_"));
            if (cardObj) {
                cardObj.zone = "monster_1_1";
                cardObj.x = 450;
                cardObj.y = 350;
                renderAllCards();
            }
        }""")
        await page.wait_for_timeout(1000)

        # 3. Open context menu on the field card
        print("Opening context menu on the placed field card...")
        card_elem = page.locator(".duel-card").first
        await card_elem.click(button="right", force=True)
        await page.wait_for_timeout(1000)

        # Take screenshot of the context menu showing the new options: "Ver carta", "Enviar al Extra Deck", "Péndulo"
        screenshot_menu = "/home/jules/verification/screenshots/context_menu_new_options.png"
        await page.screenshot(path=screenshot_menu)
        print(f"Screenshot of context menu saved to {screenshot_menu}")

        # 4. Click "Ver carta" option programmatically
        print("Clicking 'Ver carta' option...")
        await page.evaluate("""() => {
            const viewBtn = document.querySelector("#menu-view-card");
            if (viewBtn) viewBtn.click();
        }""")
        await page.wait_for_timeout(1000)

        # Take screenshot of the zoom modal
        screenshot_zoom = "/home/jules/verification/screenshots/ver_carta_zoom.png"
        await page.screenshot(path=screenshot_zoom)
        print(f"Screenshot of zoom modal saved to {screenshot_zoom}")

        # Dismiss zoom modal
        await page.evaluate("""() => {
            const closeBtn = document.querySelector(".swal2-close");
            if (closeBtn) closeBtn.click();
        }""")
        await page.wait_for_timeout(500)

        # Re-open context menu on field card
        await card_elem.click(button="right", force=True)
        await page.wait_for_timeout(500)

        # 5. Click "Péndulo" option
        print("Clicking 'Péndulo' option...")
        await page.evaluate("""() => {
            const pendBtn = document.querySelector("#menu-pendulum");
            if (pendBtn) pendBtn.click();
        }""")
        await page.wait_for_timeout(1000)

        # 6. Open Extra Deck Modal
        print("Opening Extra Deck Modal to verify the card went there face-up...")
        await page.evaluate("""() => {
            openExtraDeckModal("player1");
        }""")
        await page.wait_for_timeout(1000)

        # Take screenshot of the Extra Deck showing the face-up Pendulum card and its options
        screenshot_extra = "/home/jules/verification/screenshots/extra_deck_face_up_pendulum.png"
        await page.screenshot(path=screenshot_extra)
        print(f"Screenshot of Extra Deck modal saved to {screenshot_extra}")

        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
