import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:8000/duel.html")
    page.wait_for_timeout(1000)

    # Expand Accessories Panel
    page.click("#accessories-tab-btn")
    page.wait_for_timeout(500)

    # Roll Dice
    page.click("#accessories-dice")
    page.wait_for_timeout(1000)

    # Flip Coin
    page.click("#accessories-coin")
    page.wait_for_timeout(1000)

    # Capture the panel
    page.screenshot(path="/home/jules/verification/screenshots/verification_accesorios.png")
    page.wait_for_timeout(1000)

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
