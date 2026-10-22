from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    # Navigate directly to packages.html via local file path
    file_path = os.path.abspath("docs/packages.html")
    page.goto(f"file://{file_path}")
    page.wait_for_timeout(1000)

    # Take screenshot of packages administration page
    page.screenshot(path="/home/jules/verification/screenshots/packages_verification.png")
    page.wait_for_timeout(1000)

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
