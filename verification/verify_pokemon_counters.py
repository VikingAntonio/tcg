import time
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Navigate to pokemon layout
    page.goto("http://localhost:8000/magic.html?layout=pokemon&deck1=mock&deck2=mock&mode=practice")
    page.wait_for_timeout(1000)

    # Click on deck to draw a card
    deck_pile = page.locator("#zone-deck_1")
    deck_pile.click()
    page.wait_for_timeout(1000)

    # Let's locate the drawn card (the first card in #field-cards-container)
    card = page.locator("#field-cards-container .duel-card").first

    # Drag the card slightly to the right so it is not overlapping the deck
    card_box = card.bounding_box()
    if card_box:
        page.mouse.move(card_box["x"] + card_box["width"]/2, card_box["y"] + card_box["height"]/2)
        page.mouse.down()
        page.wait_for_timeout(200)
        page.mouse.move(card_box["x"] + 150, card_box["y"] + 50)
        page.wait_for_timeout(200)
        page.mouse.up()
        page.wait_for_timeout(1000)

    # Now right-click on the card
    card.click(button="right", force=True)
    page.wait_for_timeout(800)

    # Hover over the submenu trigger to show the submenu, or just click force=True
    submenu_trigger = page.locator(".counter-submenu-trigger").filter(has_text="Añadir Daño Pokémon")
    submenu_trigger.hover()
    page.wait_for_timeout(500)

    # Add +50 Damage
    page.locator(".menu-card-counter-dmg").filter(has_text="+50 Daño").click(force=True)
    page.wait_for_timeout(1000)

    # Right click card again to add +10 Damage
    card.click(button="right", force=True)
    page.wait_for_timeout(800)

    # Hover over trigger again
    submenu_trigger.hover()
    page.wait_for_timeout(500)

    page.locator(".menu-card-counter-dmg").filter(has_text="+10 Daño").click(force=True)
    page.wait_for_timeout(1000)

    # Take screenshot of the card with total damage and two beads
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

    # Let's drag one of the beads (the one representing 10 damage)
    bead_10 = page.locator(".draggable-poke-bead").filter(has_text="10").first

    bead_box = bead_10.bounding_box()
    if bead_box:
        # Move to bead center
        page.mouse.move(bead_box["x"] + bead_box["width"]/2, bead_box["y"] + bead_box["height"]/2)
        page.mouse.down()
        page.wait_for_timeout(300)
        # Move far to the right and top (outside card)
        page.mouse.move(bead_box["x"] + 200, bead_box["y"] - 100)
        page.wait_for_timeout(300)
        page.mouse.up()
        page.wait_for_timeout(1000)

    # Take final screenshot showing bead_10 was removed and total is 50
    page.screenshot(path="/home/jules/verification/screenshots/verification_after_drag.png")
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
