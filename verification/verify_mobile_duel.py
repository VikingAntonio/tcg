import os
import sys
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Set viewport to mobile landscape
    page.set_viewport_size({"width": 844, "height": 390})

    print("Navigating to configDuel.html...")
    page.goto("http://localhost:8000/configDuel.html")
    page.wait_for_timeout(1000)

    # Screenshot of mobile config
    page.screenshot(path="/home/jules/verification/screenshots/mobile_config.png")
    print("Screenshot of configDuel.html captured.")

    # Click start practice
    print("Starting practice mode...")
    page.get_by_role("button", name="INICIAR PRÁCTICA").click(force=True)
    page.wait_for_timeout(2000)

    # Screenshot of scaled mobile duel simulator
    page.screenshot(path="/home/jules/verification/screenshots/mobile_duel_scaled.png")
    print("Screenshot of scaled duel.html captured.")

    # Tap the P1 Deck (Player 1 Deck zone) to open the Deck context menu
    print("Tapping P1 Deck...")
    p1_deck_zone = page.locator(".zone-player-1.zone-type-deck").first
    p1_deck_zone.click(force=True)
    page.wait_for_timeout(1000)

    # Click 'Robar Carta' from Deck Menu
    print("Clicking 'Robar Carta' from Deck Menu...")
    draw_btn = page.locator("#deck-menu-draw")
    if draw_btn.is_visible():
        draw_btn.click(force=True)
    else:
        page.get_by_text("Robar Carta").click(force=True)
    page.wait_for_timeout(1500)

    # Now click the drawn card in P1 hand to open its context menu
    print("Clicking the drawn card in P1 hand...")
    hand_card = page.locator("#hand-p1 .duel-card").first
    hand_card.click(force=True)
    page.wait_for_timeout(1000)

    # Take screenshot with card context menu open
    page.screenshot(path="/home/jules/verification/screenshots/mobile_duel_menu.png")
    print("Screenshot with mobile context menu captured.")

    # Click on 'Efecto' to show activation
    effect_btn = page.locator("#menu-effect")
    if effect_btn.is_visible():
        print("Clicking 'Efecto' in context menu...")
        effect_btn.click(force=True)
        page.wait_for_timeout(1500)
        page.screenshot(path="/home/jules/verification/screenshots/mobile_duel_effect_flash.png")
        print("Screenshot of effect activation captured.")
    else:
        print("Menu Effect button is not visible!")

if __name__ == "__main__":
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
