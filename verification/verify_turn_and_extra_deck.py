import time
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err.message}"))

    # Set viewport to landscape mobile dimensions
    page.set_viewport_size({"width": 800, "height": 480})

    # Go to duelmobile.html in Practice Mode
    print("Navigating to duelmobile.html...")
    page.goto("http://localhost:8000/docs/duelmobile.html?room=testroom&mode=practice")
    page.wait_for_timeout(3000)

    # Verify turn bar visibility and coordinates
    turn_bar = page.locator("#central-turn-bar")
    is_visible = turn_bar.is_visible()
    print(f"Turn bar visible: {is_visible}")

    # Let's get turn bar bounding box
    box = turn_bar.bounding_box()
    if box:
        print(f"Turn bar location: x={box['x']}, y={box['y']}, width={box['width']}, height={box['height']}")

    # Take screenshot of the main board showing turn bar between LP counters
    page.screenshot(path="/home/jules/verification/screenshots/turn_bar_position.png")
    page.wait_for_timeout(1000)

    # Let's programmatically add some cards to player 2's Extra Deck to test the modal
    print("Populating P2's Extra Deck...")
    page.evaluate("""
        state.cards.push({
            instanceId: 'test_card_1',
            name: 'Blue-Eyes White Dragon',
            imageUrl: 'https://images.ygoprodeck.com/images/cards/89631139.jpg',
            zone: 'extra_2',
            faceDown: true,
            owner: 'player2',
            counters: 0
        });
        state.cards.push({
            instanceId: 'test_card_2',
            name: 'Dark Magician',
            imageUrl: 'https://images.ygoprodeck.com/images/cards/46986414.jpg',
            zone: 'extra_2',
            faceDown: true,
            owner: 'player2',
            counters: 0
        });
    """)

    # Open P2 Extra Deck Modal
    print("Opening P2's Extra Deck modal...")
    page.evaluate("openExtraDeckModal('player2')")
    page.wait_for_timeout(2000)

    # Verify if P2's Extra Deck modal is visible and shows the cards
    is_extra_modal_visible = page.locator("#extra-overlay").is_visible()
    print(f"Extra Deck Modal visible: {is_extra_modal_visible}")

    # Inspect the image src of the first card in the Extra Deck modal
    img_src = page.evaluate("document.querySelector('#extra-cards-grid img').src")
    print(f"First Extra Deck card image src: {img_src}")

    # It should NOT be the card back image ('img/bocabajo.jpg' or 'img/pokeBocaAbajo.jpg')
    is_masked = "bocabajo" in img_src or "pokeBocaAbajo" in img_src
    print(f"Is the card image masked (shown as card back)? {is_masked}")

    # Take screenshot of the open Extra Deck modal showing the cards face-up
    page.screenshot(path="/home/jules/verification/screenshots/extra_deck_faceup.png")
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
