import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def run_verification():
    print("Starting Playwright verification for Pokemon swap and banish features...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("Navigating to duel simulator in pokemon layout & practice mode...")
        # Since the server serves the repository root, the path to duel.html is /docs/duel.html
        await page.goto("http://localhost:8000/docs/duel.html?layout=pokemon&mode=practice")
        await page.wait_for_timeout(1500)

        # 1. Verify that the new invisible banished zones exist in the DOM
        p1_banished_exists = await page.locator("#zone-banished_1").is_visible()
        p2_banished_exists = await page.locator("#zone-banished_2").is_visible()
        print(f"P1 Banished zone present in DOM: {p1_banished_exists}")
        print(f"P2 Banished zone present in DOM: {p2_banished_exists}")

        if not (p1_banished_exists and p2_banished_exists):
            print("ERROR: Banished zones not found in DOM!")
            sys.exit(1)

        # 2. Add some cards to hand/field and test swap and banish logic
        # We can evaluate js to simulate placing a card in active_1 and bench_1_1 directly
        print("Placing cards on active and bench zones programmatically...")
        await page.evaluate("""() => {
            // Setup two cards on field for Player 1
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

        # Confirm cards are rendered
        active_card_visible = await page.locator("#test_active_card").is_visible()
        bench_card_visible = await page.locator("#test_bench_card").is_visible()
        print(f"Active card visible: {active_card_visible}")
        print(f"Bench card visible: {bench_card_visible}")

        # 3. Open context menu on the active card and verify options
        print("Opening context menu on Pikachu...")
        await page.locator("#test_active_card").click(button="right")
        await page.wait_for_timeout(500)

        # Reposition the menu absolutely to make sure headless browser sees it in the middle of viewport
        await page.evaluate("""() => {
            const menu = document.getElementById("card-menu");
            if (menu) {
                menu.style.left = "300px";
                menu.style.top = "200px";
            }
        }""")
        await page.wait_for_timeout(500)

        is_swap_option_visible = await page.locator("#menu-swap-active-bench").is_visible()
        is_banish_option_visible = await page.locator("#menu-to-banish").is_visible()
        print(f"Option 'Activo / Banca' visible: {is_swap_option_visible}")
        print(f"Option 'Enviar a Removido' visible: {is_banish_option_visible}")

        if not (is_swap_option_visible and is_banish_option_visible):
            print("ERROR: Options are not visible in context menu!")
            sys.exit(1)

        # 4. Test "Activo / Banca" swapping
        print("Clicking 'Activo / Banca' to open the swap modal...")
        await page.locator("#menu-swap-active-bench").click(force=True)
        await page.wait_for_timeout(500)

        # Swap modal should be shown
        is_swal_visible = await page.locator(".swal-swap-popup").is_visible()
        print(f"SweetAlert2 swap popup visible: {is_swal_visible}")

        # Click the button to swap with Charizard (test_bench_card)
        print("Selecting to swap positions with Charizard...")
        swap_btn = page.locator(".swal-swap-btn[data-target-card-id='test_bench_card']")
        await swap_btn.click(force=True)
        await page.wait_for_timeout(1000)

        # Verify zones are swapped
        zones = await page.evaluate("""() => {
            const pikachu = state.cards.find(c => c.instanceId === 'test_active_card');
            const charizard = state.cards.find(c => c.instanceId === 'test_bench_card');
            return { pikachu: pikachu.zone, charizard: charizard.zone };
        }""")
        print(f"New zones after swap: Pikachu -> {zones['pikachu']}, Charizard -> {zones['charizard']}")

        if zones['pikachu'] != 'bench_1_1' or zones['charizard'] != 'active_1':
            print("ERROR: Swapping failed!")
            sys.exit(1)

        # 5. Test "Enviar a Removido" (Banish)
        print("Opening context menu on Charizard (now at active_1)...")
        await page.locator("#test_bench_card").click(button="right")
        await page.wait_for_timeout(500)

        # Reposition the menu absolutely to make sure headless browser sees it in the middle of viewport
        await page.evaluate("""() => {
            const menu = document.getElementById("card-menu");
            if (menu) {
                menu.style.left = "300px";
                menu.style.top = "200px";
            }
        }""")
        await page.wait_for_timeout(500)

        print("Clicking 'Enviar a Removido'...")
        await page.locator("#menu-to-banish").click(force=True)
        await page.wait_for_timeout(1000)

        # Verify Charizard is now in banished_1 zone
        charizard_zone = await page.evaluate("""() => {
            const charizard = state.cards.find(c => c.instanceId === 'test_bench_card');
            return charizard.zone;
        }""")
        print(f"Charizard zone after sending to banished: {charizard_zone}")

        if charizard_zone != 'banished_1':
            print("ERROR: Banish failed!")
            sys.exit(1)

        # 6. Verify coordinates of banished card are outside the playmat (1135px, 450px)
        coords = await page.evaluate("""() => {
            const elem = document.getElementById('test_bench_card');
            return { left: elem.style.left, top: elem.style.top };
        }""")
        print(f"Banished card coordinates style: left = {coords['left']}, top = {coords['top']}")

        if coords['left'] != '1135px' or coords['top'] != '450px':
            print("ERROR: Card is not positioned outside the board at standard layout coordinates!")
            sys.exit(1)

        # 7. Test in Yu-Gi-Oh! mode to verify no regressions (and option hidden)
        print("Switching layout to Yu-Gi-Oh!...")
        await page.goto("http://localhost:8000/docs/duel.html?layout=yugioh&mode=practice")
        await page.wait_for_timeout(1500)

        print("Placing test card in monster_1_1 zone programmatically...")
        await page.evaluate("""() => {
            const cardYgo = {
                instanceId: "test_ygo_card",
                name: "Mago Oscuro",
                imageUrl: "https://images.ygoprodeck.com/images/cards/46986414.jpg",
                description: "Test Dark Magician",
                owner: "player1",
                controller: "player1",
                zone: "monster_1_1",
                faceDown: false,
                tapped: false,
                counters: 0,
                z: 100
            };
            state.cards.push(cardYgo);
            renderAllCards();
        }""")
        await page.wait_for_timeout(1000)

        print("Opening context menu on Dark Magician...")
        await page.locator("#test_ygo_card").click(button="right", force=True)
        await page.wait_for_timeout(500)

        # Reposition the menu absolutely to make sure headless browser sees it in the middle of viewport
        await page.evaluate("""() => {
            const menu = document.getElementById("card-menu");
            if (menu) {
                menu.style.left = "300px";
                menu.style.top = "200px";
            }
        }""")
        await page.wait_for_timeout(500)

        is_swap_option_visible_ygo = await page.locator("#menu-swap-active-bench").is_visible()
        menu_banish_text = await page.locator("#menu-to-banish").inner_text()
        print(f"Option 'Activo / Banca' visible in YGO layout: {is_swap_option_visible_ygo}")
        print(f"Option 'Enviar a Desterrado' label in YGO: '{menu_banish_text}'")

        if is_swap_option_visible_ygo:
            print("ERROR: 'Activo / Banca' is visible in Yu-Gi-Oh! layout!")
            sys.exit(1)

        if "Enviar a Desterrado" not in menu_banish_text:
            print("ERROR: Banish option label is not dynamically updated in Yu-Gi-Oh! layout!")
            sys.exit(1)

        print("ALL TESTS PASSED SUCCESSFULLY!")
        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
