import os
import time
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Navigate to local server
    page.goto("http://localhost:8000/duel.html")
    page.wait_for_timeout(2000)

    # Let's ensure the board layout is yugioh
    page.select_option("#select-board-layout", "yugioh")
    page.wait_for_timeout(1000)

    # Let's first draw 3 cards for P1 (using Deck Menu or click of zone-deck_1)
    # Click P1 Deck to open deck menu
    page.click("#zone-deck_1", force=True)
    page.wait_for_timeout(500)
    # Click 'Robar Carta'
    page.click("#deck-menu-draw")
    page.wait_for_timeout(1000)

    page.click("#zone-deck_1", force=True)
    page.wait_for_timeout(500)
    page.click("#deck-menu-draw")
    page.wait_for_timeout(1000)

    page.click("#zone-deck_1", force=True)
    page.wait_for_timeout(500)
    page.click("#deck-menu-draw")
    page.wait_for_timeout(1000)

    # Now we have 3 cards in P1 hand: card_player1_...
    # Let's get the cards inside hand
    hand_cards = page.query_selector_all("#hand-p1 .duel-card")
    print(f"Cards in hand: {len(hand_cards)}")

    # Let's summon the first card in hand to Monster zone 1 using the quick-actions hover menu!
    # Let's hover over the first card in the hand to show the action overlay
    first_card_id = hand_cards[0].get_attribute("id")
    page.hover(f"#{first_card_id}")
    page.wait_for_timeout(500)

    # Click the "Invocar" button in hand action menu
    page.click(f"#{first_card_id} .btn-summon", force=True)
    page.wait_for_timeout(500)

    # Click zone-monster_1_3 to place the card
    page.click("#zone-monster_1_3", force=True)
    page.wait_for_timeout(1000)

    # Hover the second card and attach it to the first summoned card
    second_card_id = hand_cards[1].get_attribute("id")
    page.hover(f"#{second_card_id}")
    page.wait_for_timeout(500)
    page.click(f"#{second_card_id} .btn-attach", force=True)
    page.wait_for_timeout(500)
    # Click the first card on the field to couple them!
    page.click(f"#{first_card_id}", force=True)
    page.wait_for_timeout(1000)

    # Verify that the second card is now attached to the first card
    # Let's open Extra Deck modal, draw/summon an Extra Deck card, and place it on top of the first card to check Extra Deck priority.
    # Click P1 Extra zone (zone-extra_1) to open Extra Deck Modal
    page.click("#zone-extra_1", force=True)
    page.wait_for_timeout(1000)

    # Hover the first card container in the extra deck modal to make the button visible
    page.hover(".extra-deck-card-container")
    page.wait_for_timeout(500)

    # Find the 'Invocar' button inside the Extra Deck overlay and click it
    page.click("#extra-overlay .extra-card-action-btn", force=True)
    page.wait_for_timeout(1000)

    # Summon it on top of monster_1_3 (which is zone-monster_1_3)
    page.click("#zone-monster_1_3", force=True)
    page.wait_for_timeout(1500)

    # Take a screenshot demonstrating the attached cards and Extra Deck card on top
    page.screenshot(path="/home/jules/verification/screenshots/attached_and_extra_deck_top.png")
    page.wait_for_timeout(500)

    # Send the parent card (which has children attached) to Graveyard (Cemetery) using context menu or field quick actions
    # Find the parent card overlay and click the 'Cementerio' button using force=True
    # Let's target the exact button for the first card on field which has other cards attached, or simply click any of the btn-field-grave since the extra deck card is on top
    page.click(".btn-field-grave", force=True)
    page.wait_for_timeout(1500)

    # Take a screenshot to verify cards successfully sent to Graveyard and counts are correct
    page.screenshot(path="/home/jules/verification/screenshots/sent_to_graveyard_counts.png")
    page.wait_for_timeout(500)

    # Move a card to the opponent's side to verify correct visual rotation (controller-player2 orientation)
    # Let's summon the 3rd card in P1 hand to monster_2_3 (opponent's side)
    third_card_id = hand_cards[2].get_attribute("id")
    page.hover(f"#{third_card_id}")
    page.wait_for_timeout(500)
    page.click(f"#{third_card_id} .btn-summon", force=True)
    page.wait_for_timeout(500)
    page.click("#zone-monster_2_3", force=True)
    page.wait_for_timeout(1500)

    # Let's verify that the card has class "controller-player2"
    element_classes = page.locator(f"#{third_card_id}").get_attribute("class")
    print(f"Classes of card on P2 zone: {element_classes}")

    # Capture the final screenshot of the full duel board
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
