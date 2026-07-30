import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    print("Navigating to configMagic.html...")
    page.goto("http://localhost:8000/configMagic.html")
    page.wait_for_timeout(1000)

    # Take screenshot of config page
    page.screenshot(path="/home/jules/verification/screenshots/config_magic.png")
    page.wait_for_timeout(500)

    # Select Pokémon guide layout and player 2 mock deck
    page.select_option("#magic-layout", "pokemon")
    page.wait_for_timeout(500)
    page.select_option("#magic-deck2", "mock")
    page.wait_for_timeout(500)

    # Start Magic mode
    page.click("#btn-start-magic")
    page.wait_for_timeout(2000)

    print(f"Loaded page: {page.url}")

    # Toggle sidebar panel
    page.click("#sidebar-toggle-btn")
    page.wait_for_timeout(1000)

    # Open deck action menu and draw a card
    page.click("#zone-deck_1 .pile-menu-trigger")
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/deck_menu.png")

    page.click("text=Robar 1 Carta")
    page.wait_for_timeout(1000)

    # Take screenshot of key moment (card drawn)
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            # Start local server inside Python context if needed, but it's already running on 8000 from bash
            run_cuj(page)
        finally:
            context.close()
            browser.close()
            print("Finished frontend verification!")
