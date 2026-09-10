from playwright.sync_api import sync_playwright
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()

        file_url = f"file://{os.path.abspath('docs/magic.html')}?layout=yugioh&mode=practice&deck1=mock"
        print(f"Navigating to {file_url}")
        page.goto(file_url)
        page.wait_for_timeout(1000)

        # 1. Click on Deck acciones or right click deck to draw 1 card and draw 5 cards
        print("Opening deck menu and drawing 1 card")
        page.click("#zone-deck_1 .pile-menu-trigger")
        page.wait_for_timeout(500)
        page.click("#menu-deck-draw1")
        page.wait_for_timeout(1000)

        print("Drawing 5 cards")
        page.click("#zone-deck_1 .pile-menu-trigger")
        page.wait_for_timeout(500)
        page.click("#menu-deck-draw5")
        page.wait_for_timeout(1000)

        # 2. Click LP value display to toggle calculator box
        print("Clicking LP display to toggle calculator")
        page.click("#lp-display-p1")
        page.wait_for_timeout(500)

        # 3. Enter amount and subtract LP
        print("Subtraing 1000 LP")
        page.fill("#lp-calc-p1", "1000")
        page.wait_for_timeout(500)
        page.click("#lp-widget-p1 .lp-btn-sub")
        page.wait_for_timeout(1500)

        # 4. Click +1000 preset and add LP
        print("Adding 1000 LP via preset")
        page.click("#lp-widget-p1 .lp-preset-btn[data-val='1000']")
        page.wait_for_timeout(500)
        page.click("#lp-widget-p1 .lp-btn-add")
        page.wait_for_timeout(1500)

        # Take screenshot of LP widget and hand cards
        screenshot_path = "/home/jules/verification/screenshots/verification.png"
        page.screenshot(path=screenshot_path)
        print(f"Saved screenshot to {screenshot_path}")

        page.wait_for_timeout(1000)
        context.close()
        browser.close()

if __name__ == "__main__":
    run_verification()
