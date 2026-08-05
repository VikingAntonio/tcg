import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Set viewport to mobile landscape
    page.set_viewport_size({"width": 844, "height": 390})

    # Listen to console messages and page errors
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: [{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

    print("Navigating to duelmobile.html in mobile horizontal view...")
    page.goto("http://localhost:8000/duelmobile.html?mode=practice&layout=yugioh&deck1=mock&deck2=mock")
    page.wait_for_timeout(2000)

    # Screenshot of scaled mobile duel simulator
    page.screenshot(path="/home/jules/verification/screenshots/landscape_duel_workspace.png")
    print("Screenshot of centered landscape playmat captured.")

    # Tap the P1 Deck to open the Deck context menu
    print("Clicking on P1 Deck zone...")
    page.locator("#zone-deck_1").click(force=True)
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/landscape_deck_menu.png")

    # Click 'Robar Carta' from Deck Menu
    print("Clicking 'Robar Carta' from Deck Menu...")
    page.locator("#deck-menu-draw").click(force=True)
    page.wait_for_timeout(1500)
    page.screenshot(path="/home/jules/verification/screenshots/landscape_after_draw.png")

    # Click the drawn card in P1 hand to open Card Menu
    print("Clicking the drawn card in hand...")
    # First card in hand-p1
    first_hand_card = page.locator("#hand-p1 .duel-card").first
    if first_hand_card.count() > 0:
        first_hand_card.click(force=True)
        page.wait_for_timeout(1000)
        page.screenshot(path="/home/jules/verification/screenshots/landscape_card_menu.png")
        print("Clamped Card menu screenshot captured.")

        # Click on Enviar al Cementerio
        print("Moving card to Graveyard via context menu...")
        page.locator("#menu-to-grave").click(force=True)
        page.wait_for_timeout(1500)
        page.screenshot(path="/home/jules/verification/screenshots/landscape_after_move_to_grave.png")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 844, "height": 390}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
