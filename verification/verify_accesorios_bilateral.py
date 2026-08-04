from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    # Set screen size to full HD landscape
    page.set_viewport_size({"width": 1440, "height": 900})

    # Goto duel simulator
    page.goto("http://localhost:8000/duel.html?layout=yugioh")
    page.wait_for_timeout(2000) # wait for page/state to instantiate

    # Take screenshot
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)

    screenshot_path = "/home/jules/verification/screenshots/verification.png"
    page.screenshot(path=screenshot_path)
    print("Screenshot saved to", screenshot_path)

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
