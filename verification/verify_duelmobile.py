import time
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Capture console messages
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err.message}"))

    # Set viewport to landscape mobile dimensions
    page.set_viewport_size({"width": 800, "height": 480})

    # Go to duelmobile.html
    page.goto("http://localhost:8000/docs/duelmobile.html?room=testroom&mode=practice")
    # Wait for everything to load and settle
    page.wait_for_timeout(3000)

    # Check if Card Menu is active on load
    is_active_on_load = page.evaluate("document.querySelector('#card-menu').classList.contains('active')")
    print(f"Card Menu active on load: {is_active_on_load}")

    # Draw 2 cards directly using evaluate
    print("Drawing 2 cards...")
    page.evaluate("drawCards('player1', 2)")
    page.wait_for_timeout(2000)

    # Let's find the drawn cards in Player 1's hand
    hand_cards = page.query_selector_all("#hand-p1 .duel-card")
    print(f"Number of cards in hand: {len(hand_cards)}")

    if len(hand_cards) >= 2:
        card1_id = hand_cards[0].get_attribute("id")
        card2_id = hand_cards[1].get_attribute("id")
        print(f"Card 1 ID: {card1_id}, Card 2 ID: {card2_id}")

        # Drag Card 1 to monster zone 1_3
        print("Dragging Card 1 to field...")
        page.hover(f"#{card1_id}")
        page.mouse.down()
        page.wait_for_timeout(500)
        zone_box = page.locator("#zone-monster_1_3").bounding_box()
        if zone_box:
            target_x = zone_box["x"] + zone_box["width"] / 2
            target_y = zone_box["y"] + zone_box["height"] / 2
            page.mouse.move(target_x, target_y)
            page.wait_for_timeout(500)
            page.mouse.up()
            page.wait_for_timeout(2000)

        # Drag Card 2 to field_1 zone
        print("Dragging Card 2 to field...")
        page.hover(f"#{card2_id}")
        page.mouse.down()
        page.wait_for_timeout(500)
        zone_box_field = page.locator("#zone-field_1").bounding_box()
        if zone_box_field:
            target_x = zone_box_field["x"] + zone_box_field["width"] / 2
            target_y = zone_box_field["y"] + zone_box_field["height"] / 2
            page.mouse.move(target_x, target_y)
            page.wait_for_timeout(500)
            page.mouse.up()
            page.wait_for_timeout(2000)

        # Let's verify card positions
        card1_zone = page.evaluate(f"state.cards.find(c => c.instanceId === '{card1_id}').zone")
        card2_zone = page.evaluate(f"state.cards.find(c => c.instanceId === '{card2_id}').zone")
        print(f"Card 1 actual zone in state: {card1_zone}")
        print(f"Card 2 actual zone in state: {card2_zone}")

        # Now click/tap on Card 1 on the field to open its options menu #card-menu
        print("Clicking on Card 1 on the field to open card-menu...")
        page.dispatch_event(f"#{card1_id}", "touchstart")
        page.wait_for_timeout(100)
        page.dispatch_event(f"#{card1_id}", "touchend")
        page.wait_for_timeout(1000)

        # Check if '#card-menu' is active
        is_menu_active = page.evaluate("document.querySelector('#card-menu').classList.contains('active')")
        print(f"Card Menu active: {is_menu_active}")

        # Take screenshot of the open card-menu
        page.screenshot(path="verification/screenshots/card_menu_open.png")

        if is_menu_active:
            # Let's click "Acoplar Carta" option (#menu-attach-field) in '#card-menu'
            print("Clicking 'Acoplar Carta' option...")
            page.click("#menu-attach-field", force=True)
            page.wait_for_timeout(1500)

            # Now click on Card 2 on the field to complete attachment
            print("Clicking on Card 2 on the field to complete attachment...")
            page.dispatch_event(f"#{card2_id}", "touchstart")
            page.wait_for_timeout(100)
            page.dispatch_event(f"#{card2_id}", "touchend")
            page.wait_for_timeout(2000)

            # Now let's verify if Card 1 is attached underneath Card 2
            attached_exists = page.locator(".attached-card-cascade").count() > 0
            print(f"Attached card exists on field: {attached_exists}")

            # Take screenshot of the attached card
            page.screenshot(path="verification/screenshots/card_attached.png")

            # Click on the attached card underneath to open its attached list modal
            if attached_exists:
                print("Triggering click/mousedown programmatically on the attached card underneath...")
                page.evaluate("document.querySelector('.attached-card-cascade').dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}))")
                page.wait_for_timeout(1500)

                is_overlay_visible = page.locator("#attached-overlay").is_visible()
                print(f"Attached overlay modal visible: {is_overlay_visible}")

                page.screenshot(path="verification/screenshots/attached_modal.png")

    # Take final screenshot
    page.screenshot(path="verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
