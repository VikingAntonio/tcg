import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    print("Navigating to configMagic.html...")
    page.goto("http://localhost:8000/configMagic.html")
    page.wait_for_timeout(1000)

    # Configure
    page.select_option("#magic-layout", "pokemon")
    page.wait_for_timeout(500)
    page.select_option("#magic-deck2", "mock")
    page.wait_for_timeout(1000)

    # Click start Magic Mode
    page.click("#btn-start-magic")
    page.wait_for_timeout(1500)

    # Toggle sidebar
    page.click("#sidebar-toggle-btn")
    page.wait_for_timeout(1000)

    # Toggle accessories panel
    page.click("#toggle-acc-btn", force=True)
    page.wait_for_timeout(1000)

    # Draw 5 cards for player 1
    page.click("#zone-deck_1 .pile-menu-trigger", force=True)
    page.wait_for_timeout(1000)
    page.click("text=Robar 5 Cartas")
    page.wait_for_timeout(2000)

    # Take screenshot at the key moment
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    page.screenshot(path="/home/jules/verification/screenshots/verification_magic.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1600, "height": 900},
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
            print("Successfully completed the CUJ verification script!")
