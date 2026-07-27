import time
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Log console messages
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

    print("Navigating to duel.html...")
    page.goto("http://localhost:8000/duel.html")
    page.wait_for_timeout(1000)

    # 1. Draw 3 cards
    print("Drawing 3 cards...")
    page.evaluate("drawCards('player1', 3)")
    page.wait_for_timeout(1000)

    # 2. Toggle hand multi-select for P1
    print("Toggling hand multi-select checkbox...")
    page.click("#hand-controls-p1 input[type='checkbox']")
    page.wait_for_timeout(1000)

    # 3. Select first two cards in hand
    print("Selecting first card in hand...")
    # Get selectors of the first two cards in P1 hand
    hand_card_ids = page.evaluate("""
        Array.from(document.querySelectorAll('#hand-p1 .duel-card')).map(el => el.id)
    """)
    print(f"Hand cards: {hand_card_ids}")
    if len(hand_card_ids) >= 2:
        page.click(f"#{hand_card_ids[0]}")
        page.wait_for_timeout(500)
        page.click(f"#{hand_card_ids[1]}")
        page.wait_for_timeout(1000)

    # 4. Click 'A Deck' batch button
    print("Clicking 'A Deck' batch button...")
    page.click("#hand-batch-p1 .btn-batch-deck")
    page.wait_for_timeout(2000)

    # Take screenshot of the SweetAlert2 popup showing both cards transferred
    print("Taking screenshot of the batch transfer SweetAlert2 popup...")
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
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
            print("Done verifying!")
