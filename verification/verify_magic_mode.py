import os
from playwright.sync_api import sync_playwright

def run_verification(page):
    # Print console messages for debugging
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

    print("Navigating to configMagic.html...")
    page.goto("http://localhost:8000/configMagic.html")
    page.wait_for_timeout(1500)

    # Take screenshot of the initial configMagic page
    print("Taking configMagic screenshot...")
    os.makedirs("verification/screenshots", exist_ok=True)
    page.screenshot(path="verification/screenshots/config_magic.png")

    # Select Yu-Gi-Oh! layout guide
    print("Selecting Yu-Gi-Oh! guide...")
    page.select_option("#magic-layout", "yugioh")
    page.wait_for_timeout(1000)

    # Select Player 2 Mock Deck
    print("Selecting Player 2 mock deck...")
    page.select_option("#magic-deck2", "mock")
    page.wait_for_timeout(1000)

    page.screenshot(path="verification/screenshots/config_magic_configured.png")

    # Click start Magic Mode
    print("Clicking start magic mode...")
    page.click("#btn-start-magic")
    page.wait_for_timeout(2500)

    # We should be redirected to magic.html
    print(f"Current URL: {page.url}")
    assert "magic.html" in page.url, "Should be redirected to magic.html!"
    assert "layout=yugioh" in page.url, "Should have layout=yugioh param!"
    assert "deck2=mock" in page.url, "Should have deck2=mock param!"

    # Wait for the magic playmat to be visible
    print("Verifying magic.html components...")
    page.wait_for_selector("#playmat")
    page.wait_for_selector("#piles-container", state="attached")
    page.wait_for_selector(".magic-pile-zone")
    page.wait_for_selector("#hand-tray-p1")
    page.wait_for_selector("#hand-tray-p2") # Since deck2 is loaded

    page.screenshot(path="verification/screenshots/magic_loaded.png")
    page.wait_for_timeout(1000)

    # Click sidebar toggle button
    print("Toggling sidebar...")
    page.click("#sidebar-toggle-btn")
    page.wait_for_timeout(1000)
    page.screenshot(path="verification/screenshots/magic_sidebar_toggled.png")

    # Draw a card from Player 1's Deck
    print("Interacting with P1 Deck Pile Menu...")
    # Click on the menu trigger of deck_1
    page.click("#zone-deck_1 .pile-menu-trigger")
    page.wait_for_timeout(1000)
    page.screenshot(path="verification/screenshots/magic_deck_menu.png")

    # Click Robar 1 Carta (first button inside the swal popup)
    print("Clicking draw card button in menu...")
    page.click("text=Robar 1 Carta")
    page.wait_for_timeout(1500)
    page.screenshot(path="verification/screenshots/magic_card_drawn.png")

    print("Checking that a card was added to P1 hand...")
    cards_in_hand = page.locator("#hand-p1 .duel-card").count()
    print(f"Cards in hand: {cards_in_hand}")
    assert cards_in_hand == 1, f"Expected 1 card in P1 hand, got {cards_in_hand}"

    print("Success! Frontend verification passed!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            run_verification(page)
        finally:
            context.close()
            browser.close()
            print("Finished Magic Mode verification!")
