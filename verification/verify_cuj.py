import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    print("Navigating to duel.html...")
    page.goto("http://localhost:3000/duel.html?mode=practice&layout=yugioh")
    page.wait_for_timeout(1000)

    print("Clicking P1 Deck...")
    page.evaluate("jQuery('#zone-deck_1').click()")
    page.wait_for_timeout(1000)

    print("Drawing card 1...")
    page.evaluate("jQuery('#deck-menu-draw').click()")
    page.wait_for_timeout(1500)

    print("Clicking P1 Deck...")
    page.evaluate("jQuery('#zone-deck_1').click()")
    page.wait_for_timeout(500)
    print("Drawing card 2...")
    page.evaluate("jQuery('#deck-menu-draw').click()")
    page.wait_for_timeout(1500)

    print("Invoking card...")
    page.evaluate("jQuery('.hand-action-btn.btn-summon').first().click()")
    page.wait_for_timeout(1000)

    print("Placing card on monster_1_1...")
    page.evaluate("jQuery('#zone-monster_1_1').click()")
    page.wait_for_timeout(1500)

    print("Clicking invoked card to open context menu...")
    page.evaluate("jQuery('#field-cards-container .duel-card:not(.attached-card-cascade)').first().click()")
    page.wait_for_timeout(1500)

    print("Closing context menu...")
    page.evaluate("jQuery('#playmat').click()")
    page.wait_for_timeout(1000)

    print("Clicking grave to open modal...")
    page.evaluate("jQuery('#zone-grave_1').click()")
    page.wait_for_timeout(1500)

    print("Capturing screenshot...")
    screenshot_path = "/app/verification/screenshots/refined_verification.png"
    page.screenshot(path=screenshot_path)
    print(f"Screenshot saved to {screenshot_path}")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    os.makedirs("/app/verification/videos", exist_ok=True)
    os.makedirs("/app/verification/screenshots", exist_ok=True)
    print("Starting Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/app/verification/videos",
            viewport={"width": 1280, "height": 720}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
    print("Done!")
