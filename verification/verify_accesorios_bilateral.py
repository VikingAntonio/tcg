import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:8000/duel.html")
    page.wait_for_timeout(1000)

    # Expand Accessories Panel P1
    page.click("#accessories-tab-btn-p1")
    page.wait_for_timeout(500)

    # Roll Dice P1
    page.click(".p1-accessories .dice-action-btn")
    page.wait_for_timeout(1000)

    # Flip Coin P1
    page.click(".p1-accessories .coin-action-btn")
    page.wait_for_timeout(1000)

    # Capture the panel
    page.screenshot(path="/home/jules/verification/screenshots/verification_accesorios_bilateral.png")
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
