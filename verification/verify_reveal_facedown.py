import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.set_viewport_size({"width": 1280, "height": 800})

    # Listen to console messages and page errors
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: [{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

    print("Navigating to duel.html in practice mode...")
    page.goto("http://localhost:8000/duel.html?room=facedown_verification_duel&mode=practice&layout=yugioh&deck1=mock&deck2=mock")
    page.wait_for_timeout(2000)

    # Click on P1 Deck zone to open deck menu
    print("Clicking P1 Deck zone...")
    page.evaluate("jQuery('#zone-deck_1').trigger('click')")
    page.wait_for_timeout(1000)

    # Click 'Robar Carta' (draw card) to put a card in hand
    print("Clicking 'Robar Carta' from deck-menu...")
    draw_btn = page.locator("#deck-menu-draw, #deck-menu li:has-text('Robar Carta')").first
    if draw_btn.is_visible():
        draw_btn.click(force=True)
    else:
        page.get_by_text("Robar Carta").first.click(force=True)
    page.wait_for_timeout(1500)

    # Put the card in hand programmatically on the field to be 100% robust against coordinate drag-and-drop scaling offsets
    print("Placing first hand card on field programmatically...")
    card_id = page.evaluate("jQuery('#hand-p1 .duel-card').first().attr('id')")
    print(f"Card ID: {card_id}")
    page.evaluate(f"const card = state.cards.find(c => c.instanceId === '{card_id}'); card.zone = 'monster_1_3'; card.faceDown = true; renderAllCards();")
    page.wait_for_timeout(1500)

    # Verify that the card is placed on the field and has face-down and reveal-face-down classes
    print("Checking on-field card classes...")
    is_face_down = page.evaluate(f"jQuery('#{card_id}').hasClass('face-down')")
    has_reveal_class = page.evaluate(f"jQuery('#{card_id}').hasClass('reveal-face-down')")
    print("Card is face-down (Practice):", is_face_down)
    print("Card has 'reveal-face-down' class (Practice):", has_reveal_class)

    # Let's switch to multiplayer mode and test!
    print("Switching room to multiplayer...")
    page.goto("http://localhost:8000/duel.html?room=facedown_verification_duel_multi&mode=multiplayer&role=player1&layout=yugioh&deck1=mock&deck2=mock")
    page.wait_for_timeout(2000)

    # Place a card for player1 (currentRole) and player2 (opponent) programmatically and check classes!
    page.evaluate("""
        state.cards.push({
            instanceId: 'my_facedown_card',
            name: 'My FaceDown Card',
            imageUrl: 'https://images.ygoprodeck.com/images/cards/89631139.jpg',
            owner: 'player1',
            controller: 'player1',
            zone: 'monster_1_3',
            faceDown: true,
            tapped: false,
            counters: 0,
            x: 0,
            y: 0,
            z: 100
        });
        state.cards.push({
            instanceId: 'opp_facedown_card',
            name: 'Opponent FaceDown Card',
            imageUrl: 'https://images.ygoprodeck.com/images/cards/46986414.jpg',
            owner: 'player2',
            controller: 'player2',
            zone: 'monster_2_3',
            faceDown: true,
            tapped: false,
            counters: 0,
            x: 0,
            y: 0,
            z: 101
        });
        window.currentRole = 'player1';
        renderAllCards();
    """)
    page.wait_for_timeout(1000)

    my_has_reveal = page.evaluate("jQuery('#my_facedown_card').hasClass('reveal-face-down')")
    opp_has_reveal = page.evaluate("jQuery('#opp_facedown_card').hasClass('reveal-face-down')")
    print("My face-down card has 'reveal-face-down' class (Multiplayer):", my_has_reveal)
    print("Opponent face-down card has 'reveal-face-down' class (Multiplayer):", opp_has_reveal)

    # Open graveyard list modal to test swal zoom z-index on top
    print("Opening pile modal for P1 Graveyard...")
    page.evaluate("openPileModal('player1', 'grave')")
    page.wait_for_timeout(1000)

    # Click first card in grid to see if hover-overlay is shown and can view card (calling viewCardZoom)
    print("Zooming card from Graveyard Pile...")
    # Add a mock card to P1 Graveyard so we can click Ver Carta
    page.evaluate("""
        state.cards.push({
            instanceId: 'mock_grave_card',
            name: 'Mock Grave Card',
            imageUrl: 'https://images.ygoprodeck.com/images/cards/89631139.jpg',
            owner: 'player1',
            controller: 'player1',
            zone: 'grave_1',
            faceDown: false,
            tapped: false,
            counters: 0,
            x: 0,
            y: 0,
            z: 999
        });
        openPileModal('player1', 'grave');
    """)
    page.wait_for_timeout(1000)

    # Click Ver carta in pile menu
    page.locator(".pile-card-container").last.hover()
    page.wait_for_timeout(500)
    page.locator(".btn-pile-view").last.click(force=True)
    page.wait_for_timeout(1500)

    # Verify Swal zoom is open and visible on top
    is_swal_visible = page.evaluate("jQuery('.swal2-container').is(':visible')")
    swal_z_index = page.evaluate("jQuery('.swal2-container').css('z-index')")
    print("Swal container visible on top of Graveyard list modal:", is_swal_visible)
    print("Swal container z-index:", swal_z_index)

    # Take screenshot of the card on the field exhibiting the new semi-transparent reveal pulse and the swal popup above
    page.screenshot(path="/home/jules/verification/screenshots/duel_reveal_and_swal_zoom.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
