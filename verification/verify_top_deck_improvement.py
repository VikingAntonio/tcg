import os
import time
from playwright.sync_api import sync_playwright

def run_cuj(page):
    abs_path = os.path.abspath("docs/duel.html")
    url = f"file://{abs_path}?mode=practice&layout=yugioh"

    print(f"Navigating to {url}...")
    page.goto(url)
    page.wait_for_timeout(2000)

    # Click on Player 1 Deck floating count to open deck context menu, bypassing interceptions using force=True
    print("Opening Deck context menu...")
    page.click("#floating-count-deck_1", button="right", force=True)
    page.wait_for_timeout(1000)

    # Click 'Mostrar 5 cartas del tope'
    print("Clicking 'Mostrar n cartas del tope'...")
    page.click("#deck-menu-show-top")
    page.wait_for_timeout(1000)

    # Swal prompt will appear asking for a number.
    # Fill '5' and click 'Mostrar' (confirm)
    print("Entering 5 cards to show...")
    page.fill(".swal2-input", "5")
    page.wait_for_timeout(500)
    page.click(".swal2-confirm")
    page.wait_for_timeout(1000)

    # Take screenshot of the newly styled Swal popup with top cards list and A Deck actions
    screenshot_path = "/home/jules/verification/screenshots/top_deck_modal.png"
    print(f"Taking screenshot at {screenshot_path}...")
    page.screenshot(path=screenshot_path)
    page.wait_for_timeout(1000)

    # Now verify returning a card to the deck individually by clicking the first 'A DECK' individual button
    print("Clicking individual 'A DECK' button...")
    page.locator(".btn-to-deck").first.click()
    page.wait_for_timeout(1000)

    # Click bulk 'A DECK' to return the rest
    print("Clicking bulk 'A Deck' button...")
    page.click("#top-bulk-deck")
    page.wait_for_timeout(1500)

    print("Verification successfully finished!")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

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
