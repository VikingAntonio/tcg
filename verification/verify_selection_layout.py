import time
from playwright.sync_api import sync_playwright

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 800, "height": 480})
        page = context.new_page()

        # Capture console and page errors
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"ERROR: {err.message}"))

        # 1. Test Yu-Gi-Oh Layout Phase Bar and Counters Visibility
        print("Navigating to duelmobile.html with layout=yugioh...")
        page.goto("http://localhost:8000/docs/duelmobile.html?room=verifyroom&mode=practice&layout=yugioh")
        page.wait_for_timeout(3000)

        print("Testing Yu-Gi-Oh layout...")
        central_visible = page.locator("#central-turn-bar").is_visible()
        phases_visible = page.locator("#phases-container").is_visible()
        turn_visible = page.locator("#turn-display").is_visible()
        lp_p1_visible = page.locator("#lp-counter-p1").is_visible()
        lp_p2_visible = page.locator("#lp-counter-p2").is_visible()

        print(f"YGO -> Central Turn Bar: {central_visible}, Phases: {phases_visible}, Turn Display: {turn_visible}, LP P1: {lp_p1_visible}")
        page.screenshot(path="verification/screenshots/yugioh_layout.png")

        # 2. Navigate with layout=pokemon
        print("Navigating to duelmobile.html with layout=pokemon...")
        page.goto("http://localhost:8000/docs/duelmobile.html?room=verifyroom&mode=practice&layout=pokemon")
        page.wait_for_timeout(3000)

        # Check visibility in Pokemon mode
        central_visible_poke = page.locator("#central-turn-bar").is_visible()
        phases_visible_poke = page.locator("#phases-container").is_visible()
        turn_visible_poke = page.locator("#turn-display").is_visible()
        lp_p1_visible_poke = page.locator("#lp-counter-p1").is_visible()
        lp_p2_visible_poke = page.locator("#lp-counter-p2").is_visible()

        print(f"POKEMON -> Central Turn Bar: {central_visible_poke}, Phases (should be False): {phases_visible_poke}, Turn Display (should be True): {turn_visible_poke}, LP P1 (should be False): {lp_p1_visible_poke}")
        page.screenshot(path="verification/screenshots/pokemon_layout.png")

        # 3. Switch back to YGO and draw/drag card to test context menu "Seleccionar"
        print("Navigating back to YGO for card testing...")
        page.goto("http://localhost:8000/docs/duelmobile.html?room=verifyroom&mode=practice&layout=yugioh")
        page.wait_for_timeout(2000)

        print("Drawing card...")
        page.evaluate("drawCards('player1', 1)")
        page.wait_for_timeout(1500)

        hand_cards = page.query_selector_all("#hand-p1 .duel-card")
        if len(hand_cards) > 0:
            card_id = hand_cards[0].get_attribute("id")
            print(f"Drawn card ID: {card_id}")

            # Drag Card to zone-monster_1_3
            print("Dragging Card to field...")
            page.hover(f"#{card_id}")
            page.mouse.down()
            page.wait_for_timeout(500)
            zone_box = page.locator("#zone-monster_1_3").bounding_box()
            if zone_box:
                target_x = zone_box["x"] + zone_box["width"] / 2
                target_y = zone_box["y"] + zone_box["height"] / 2
                page.mouse.move(target_x, target_y)
                page.wait_for_timeout(500)
                page.mouse.up()
                page.wait_for_timeout(1500)

            # Trigger Card Context Menu
            print("Opening context menu...")
            page.dispatch_event(f"#{card_id}", "touchstart")
            page.wait_for_timeout(100)
            page.dispatch_event(f"#{card_id}", "touchend")
            page.wait_for_timeout(1000)

            menu_select_visible = page.locator("#menu-select-card").is_visible()
            print(f"Context Menu 'Seleccionar' Option visible: {menu_select_visible}")
            page.screenshot(path="verification/screenshots/card_menu_select_option.png")

            if menu_select_visible:
                # Click "Seleccionar"
                print("Clicking 'Seleccionar' option...")
                page.click("#menu-select-card", force=True)
                page.wait_for_timeout(500)

                # Check if card has activating-flash and contains pointer
                has_flash = page.evaluate(f"document.getElementById('{card_id}').classList.contains('activating-flash')")
                pointer_count = page.locator(".card-select-pointer").count()
                print(f"Card has activating-flash: {has_flash}, select pointers found on field: {pointer_count}")
                page.screenshot(path="verification/screenshots/card_selected_with_pointer.png")

                # Wait for pointer to fade out and be removed
                print("Waiting for pointer to fade out...")
                page.wait_for_timeout(4500)
                pointer_count_after = page.locator(".card-select-pointer").count()
                print(f"Select pointers found after 4.5s: {pointer_count_after}")

        context.close()
        browser.close()

if __name__ == "__main__":
    run_verification()
