import os
import sys
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Set viewport to mobile landscape
    page.set_viewport_size({"width": 844, "height": 390})

    # Listen to console messages and page errors
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: [{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

    print("Navigating to duelmobile.html in practice mode...")
    page.goto("http://localhost:8000/duelmobile.html?room=facedown_verification&mode=practice&layout=yugioh&deck1=mock&deck2=mock")
    page.wait_for_timeout(2000)

    # Click on P1 Deck zone to open deck menu
    print("Clicking P1 Deck zone...")
    page.evaluate("jQuery('#zone-deck_1').trigger('click')")
    page.wait_for_timeout(1000)

    # Click 'Robar Carta' (draw card) to put a card in hand
    print("Clicking 'Robar Carta' from deck-menu...")
    draw_btn = page.locator("#deck-menu-draw, #deck-menu li:has-text('Robar Carta')").first
    if draw_btn.is_visible():
        draw_btn.click(force=True)
    else:
        page.get_by_text("Robar Carta").first.click(force=True)
    page.wait_for_timeout(1500)

    # Drag the first card in hand to the monster zone 1_3
    print("Dragging first hand card to monster zone 1_3...")
    card_id = page.evaluate("jQuery('#hand-p1 .duel-card').first().attr('id')")
    print(f"Card ID: {card_id}")
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
        page.wait_for_timeout(2000)

    # Now make it face-down programmatically and call renderAllCards()
    print("Setting card face-down programmatically...")
    page.evaluate(f"const card = state.cards.find(c => c.instanceId === '{card_id}'); card.faceDown = true; renderAllCards();")
    page.wait_for_timeout(1500)

    # Verify that the card is placed on the field and has face-down and reveal-face-down classes
    print("Checking on-field card classes...")
    is_face_down = page.evaluate(f"jQuery('#{card_id}').hasClass('face-down')")
    has_reveal_class = page.evaluate(f"jQuery('#{card_id}').hasClass('reveal-face-down')")
    print("Card is face-down:", is_face_down)
    print("Card has 'reveal-face-down' class:", has_reveal_class)

    # Take screenshot of the card on the field exhibiting the new semi-transparent reveal pulse
    page.screenshot(path="/home/jules/verification/screenshots/face_down_reveal.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
