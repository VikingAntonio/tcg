import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:8000/duel.html")
    page.wait_for_timeout(1000)

    # Force click Accessories Panel P1 to expand it
    page.click("#accessories-tab-btn-p1", force=True)
    page.wait_for_timeout(500)

    # Click Invocar Token (which should trigger either a random token summon or SweetAlert dialog if there's tokens configured)
    # Since we loaded directly without a deck loaded, state.deckTokens is empty or undefined initially, triggering a random token.
    page.click(".p1-accessories .token-action-btn", force=True)
    page.wait_for_timeout(1000)

    # Since graphical targeting is activated, click coordinates on playmat to place token
    # Zone Picker toast should be visible. We'll click near the center of the playmat (x=500, y=300)
    page.mouse.click(500, 300)
    page.wait_for_timeout(1000)

    # Take screenshot of the newly spawned token on the playmat
    page.screenshot(path="/home/jules/verification/screenshots/verification_tokens_atkdef.png")
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
