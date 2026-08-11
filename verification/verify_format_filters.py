import os
from playwright.sync_api import sync_playwright

def run_verification(page):
    print("Navigating to admin page...")
    page.goto("http://localhost:8000/admin.html")
    page.wait_for_timeout(2000)

    # Check that `#nexus-filter-format` is present in the DOM (even if currently hidden behind login or layout)
    print("Verifying `#nexus-filter-format` presence and options...")
    select_locator = page.locator("#nexus-filter-format")

    # Wait for element to be attached to DOM
    select_locator.wait_for(state="attached", timeout=5000)
    print("Element `#nexus-filter-format` is successfully attached to the DOM!")

    # Verify options
    options = select_locator.locator("option")
    count = options.count()
    print(f"Number of options inside `#nexus-filter-format`: {count}")

    texts = [options.nth(i).inner_text() for i in range(count)]
    values = [options.nth(i).get_attribute("value") for i in range(count)]

    print(f"Option texts: {texts}")
    print(f"Option values: {values}")

    assert "" in values, "Default empty option should be present"
    assert "speed duel" in values, "Speed Duel option should be present"
    assert "rush duel" in values, "Rush Duel option should be present"

    print("Format options successfully verified!")

    # Take screenshot
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    screenshot_path = "/home/jules/verification/screenshots/format_filters_verified.png"
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"Verification screenshot saved to: {screenshot_path}")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_verification(page)
        finally:
            context.close()
            browser.close()
