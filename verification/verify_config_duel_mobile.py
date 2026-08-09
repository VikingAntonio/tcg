import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Set viewport to standard dimensions
    page.set_viewport_size({"width": 1024, "height": 768})

    # Listen to console messages and page errors
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: [{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

    print("Navigating to configDuelMobile.html...")
    page.goto("http://localhost:8000/configDuelMobile.html")
    page.wait_for_timeout(1500)

    # Let's check that the description paragraph in Multiplayer column is gone
    has_description = page.evaluate("!!document.querySelector('.mode-card.multiplayer .card-desc')")
    print(f"Has multiplayer card description: {has_description}")
    assert not has_description, "Multiplayer card description should have been eliminated!"

    # Let's check the text in '#auth-locked-view p'
    locked_text = page.locator("#auth-locked-view p").text_content().strip()
    print(f"Locked message text: '{locked_text}'")
    assert "Para poder usar este modo inicia sesión o crea una cuenta y configura al menos 1 deck" in locked_text, "Locked message text is incorrect!"

    # Take screenshot of the page
    screenshot_path = "/home/jules/verification/screenshots/config_duel_mobile_updated.png"
    page.screenshot(path=screenshot_path)
    print(f"Screenshot captured at {screenshot_path}")
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
            print("Finished verify_config_duel_mobile!")
