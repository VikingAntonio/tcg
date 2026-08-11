import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Navigate to duelmobile in Practice mode and Yu-Gi-Oh layout
    print("Navigating to mobile duel...")
    page.goto("http://localhost:8000/duelmobile.html?mode=practice&layout=yugioh&deck1=mock&deck2=mock")
    page.wait_for_timeout(2000)

    # Screenshot 1: General view with Yu-Gi-Oh layout (shows LP counters + Turn bar)
    print("Taking screenshot of Yu-Gi-Oh layout...")
    page.screenshot(path="verification/screenshots/ygo_layout.png")
    page.wait_for_timeout(1000)

    # Click on Player 1 deck to open the Deck Menu
    print("Opening P1 Deck menu...")
    page.evaluate("jQuery('#zone-deck_1').trigger('click')")
    page.wait_for_timeout(1000)

    # Click 'Buscar'
    print("Clicking 'Buscar'...")
    page.evaluate("jQuery('#deck-menu-search').trigger('click')")
    page.wait_for_timeout(1000)

    # In the search overlay, click the first card's container to toggle menu action overlay
    print("Clicking card inside search grid...")
    page.evaluate("jQuery('#search-cards-grid .pile-card-container').first().trigger('click')")
    page.wait_for_timeout(1000)

    # Click 'Ver carta' zoom button
    print("Clicking 'Ver carta' zoom button...")
    page.evaluate("jQuery('.btn-search-zoom').first().trigger('click')")
    page.wait_for_timeout(1500)

    # Screenshot 2: Zoom popup showing card front in Practice mode
    print("Taking screenshot of Card Zoom popup in Practice Mode...")
    page.screenshot(path="verification/screenshots/card_zoom.png")
    page.wait_for_timeout(1000)

    # Close custom zoom overlay by clicking background
    print("Closing zoom overlay...")
    page.evaluate("jQuery('#custom-card-zoom-overlay').trigger('click')")
    page.wait_for_timeout(1000)

    # Switch layout to Pokémon programmatically via jQuery change event
    print("Switching layout to Pokémon...")
    page.evaluate("jQuery('#select-board-layout').val('pokemon').trigger('change')")
    page.wait_for_timeout(2000)

    # Screenshot 3: Pokémon layout (only End Turn button in center, no phases or LP counters)
    print("Taking screenshot of Pokémon layout...")
    page.screenshot(path="verification/screenshots/pokemon_layout.png")
    page.wait_for_timeout(1000)

    print("FINISHED ALL VERIFICATIONS successfully!")

if __name__ == "__main__":
    os.makedirs("verification/screenshots", exist_ok=True)
    os.makedirs("verification/videos", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use mobile landscape viewport setup
        context = browser.new_context(
            viewport={"width": 844, "height": 390},
            is_mobile=True,
            record_video_dir="verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
