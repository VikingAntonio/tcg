import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def run_verification():
    print("Starting Playwright verification for Pokemon Activate option and No-coupling on drag-and-drop...")

    # Ensure directories exist
    os.makedirs("/app/verification/screenshots", exist_ok=True)
    os.makedirs("/app/verification/videos", exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1120, "height": 600},
            record_video_dir="/app/verification/videos"
        )
        page = await context.new_page()

        # Listen to console messages and page errors
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: [{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

        print("Navigating to duelmobile.html with Pokemon layout in practice mode...")
        # Note: http.server is running in the 'docs' directory on port 8000, so 'duelmobile.html' is at '/'
        await page.goto("http://localhost:8000/duelmobile.html?layout=pokemon&mode=practice&deck1=mock&deck2=mock")
        await page.wait_for_timeout(2000)

        # 1. Setup a custom card in hand
        print("Setup: Placing a card in Player 1 hand...")
        await page.evaluate("""() => {
            const testHandCard = {
                instanceId: "test_hand_card_p1",
                name: "Test Pokémon Card",
                imageUrl: "https://images.ygoprodeck.com/images/cards/89631139.jpg",
                description: "Test Card in Hand",
                owner: "player1",
                controller: "player1",
                zone: "hand_1",
                faceDown: false,
                tapped: false,
                counters: 0,
                z: 100
            };
            // Clear existing and add our test card
            state.cards = [testHandCard];
            renderAllCards();
        }""")
        await page.wait_for_timeout(1000)

        # 2. Tap/click on the hand card to open context menu
        print("Clicking the hand card to open its context menu...")
        await page.locator("#test_hand_card_p1").click()
        await page.wait_for_timeout(1000)

        # Screenshot of context menu
        await page.screenshot(path="/app/verification/screenshots/hand_card_menu_open.png")

        # 3. Click '#menu-activate' option in context menu
        print("Clicking '#menu-activate' option in menu...")
        activate_option = page.locator("#menu-activate")
        is_visible = await activate_option.is_visible()
        print(f"Is '#menu-activate' visible? {is_visible}")
        if is_visible:
            await activate_option.click()
            await page.wait_for_timeout(1000)
        else:
            # Fallback to trigger click directly on the menu item via JS
            await page.evaluate("""() => {
                jQuery("#menu-activate").click();
            }""")
            await page.wait_for_timeout(1000)

        # Verify that the card was placed in field_free at (870, 320)
        card_state = await page.evaluate("""() => {
            const card = state.cards.find(c => c.instanceId === "test_hand_card_p1");
            return { zone: card.zone, x: card.x, y: card.y };
        }""")
        print(f"Activated card state: {card_state}")
        assert card_state["zone"] == "field_free", f"Expected zone to be field_free, got {card_state['zone']}"
        assert card_state["x"] == 870, f"Expected x to be 870, got {card_state['x']}"
        assert card_state["y"] == 320, f"Expected y to be 320, got {card_state['y']}"
        print("Success! Card correctly activated and placed beside P1 graveyard.")

        # 4. Verify no automatic coupling/attachment on drag-and-drop
        print("Testing drag-and-drop: dropping a card near another card on the field...")
        await page.evaluate("""() => {
            const cardA = {
                instanceId: "card_A",
                name: "Card A",
                imageUrl: "https://images.ygoprodeck.com/images/cards/89631139.jpg",
                owner: "player1",
                controller: "player1",
                zone: "field_free",
                faceDown: false,
                tapped: false,
                counters: 0,
                x: 300,
                y: 200,
                z: 10
            };
            const cardB = {
                instanceId: "card_B",
                name: "Card B",
                imageUrl: "https://images.ygoprodeck.com/images/cards/46986414.jpg",
                owner: "player1",
                controller: "player1",
                zone: "field_free",
                faceDown: false,
                tapped: false,
                counters: 0,
                x: 400,
                y: 200,
                z: 11
            };
            state.cards = [cardA, cardB];
            renderAllCards();
        }""")
        await page.wait_for_timeout(1000)

        # Perform drag and drop: drag card A on top of card B
        # Card A center is 300+40=340, 200+58=258. Card B center is 400+40=440, 200+58=258.
        # Let's drag card A to (410, 210) which overlaps Card B (400 to 480, 200 to 316).
        print("Dragging card_A to overlap with card_B...")
        await page.mouse.move(340, 258)
        await page.mouse.down()
        await page.mouse.move(440, 258, steps=10)
        await page.mouse.up()
        await page.wait_for_timeout(1000)

        # Check state: verify that card_A is NOT attached to card_B
        card_A_attached_to = await page.evaluate("""() => {
            const card = state.cards.find(c => c.instanceId === "card_A");
            return card.attachedTo;
        }""")
        print(f"card_A attachedTo: {card_A_attached_to}")
        assert card_A_attached_to is None or card_A_attached_to == "null", f"Expected card_A to not be attached, but got: {card_A_attached_to}"
        print("Success! Dragging card_A over card_B did not couple them automatically!")

        await page.screenshot(path="/app/verification/screenshots/final_nocouple.png")

        # Close and save video
        await context.close()
        await browser.close()
        print("Verification finished successfully! All checks passed.")

if __name__ == "__main__":
    asyncio.run(run_verification())
