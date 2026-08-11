import os
import glob
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.set_viewport_size({"width": 1280, "height": 800})

    # Listen to console messages and page errors
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: [{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

    # TEST 1: duel.html (Desktop Layout)
    print("\n--- TESTING DESKTOP: duel.html ---")
    print("Navigating to duel.html in practice mode with layout=pokemon...")
    page.goto("http://localhost:8000/duel.html?room=prize_verification_duel&mode=practice&layout=pokemon&deck1=mock&deck2=mock")
    page.wait_for_timeout(1000)

    # Place a card in prize zone programmatically
    print("Placing face-down card in P1 Prize zone programmatically...")
    page.evaluate("""
        state.cards.push({
            instanceId: 'prize_card_desktop',
            name: 'Pikachu EX',
            imageUrl: 'https://images.pokemontcg.io/cel25/2_hires.png',
            owner: 'player1',
            controller: 'player1',
            zone: 'prize_1_1',
            faceDown: true,
            tapped: false,
            counters: 0,
            x: 0,
            y: 0,
            z: 100
        });
        renderAllCards();
    """)
    page.wait_for_timeout(1000)

    # 1. Verify that the prize card does NOT have the 'reveal-face-down' class
    print("Verifying prize card class...")
    has_reveal_class = page.evaluate("jQuery('#prize_card_desktop').hasClass('reveal-face-down')")
    is_face_down = page.evaluate("jQuery('#prize_card_desktop').hasClass('face-down')")
    print(f"Prize card is face-down: {is_face_down}")
    print(f"Prize card has 'reveal-face-down' class: {has_reveal_class}")
    assert not has_reveal_class, "ERROR: Face-down prize card should NOT have 'reveal-face-down' class!"

    # 2. Trigger preview update and verify details are masked
    print("Updating preview on the prize card...")
    page.evaluate("updatePreview(state.cards.find(c => c.instanceId === 'prize_card_desktop'))")
    page.wait_for_timeout(1000)

    preview_img = page.evaluate("jQuery('#detail-card-img').attr('src')")
    preview_name = page.evaluate("jQuery('#detail-card-name').text()")
    preview_desc = page.evaluate("jQuery('#detail-card-desc').text()")
    print(f"Preview Image URL: {preview_img}")
    print(f"Preview Name: {preview_name}")
    assert "pokeBocaAbajo.jpg" in preview_img or "bocabajo.jpg" in preview_img or "sleeve" in preview_img, "ERROR: Preview should show card back!"
    assert "Pikachu" not in preview_name, "ERROR: Preview should mask card name!"

    # 3. Trigger zoom and verify it shows the back
    print("Triggering zoom popup on the prize card...")
    page.evaluate("viewCardZoom(state.cards.find(c => c.instanceId === 'prize_card_desktop'))")
    page.wait_for_timeout(1000)

    is_swal_visible = page.evaluate("jQuery('.swal2-container').is(':visible')")
    swal_img = page.evaluate("jQuery('.swal2-html-container img').attr('src')")
    print(f"Zoom Popup Visible: {is_swal_visible}")
    print(f"Zoom Image URL: {swal_img}")
    assert is_swal_visible, "ERROR: Zoom popup should be visible!"
    assert "pokeBocaAbajo.jpg" in swal_img or "bocabajo.jpg" in swal_img or "sleeve" in swal_img, "ERROR: Zoom should show card back!"

    # Take screenshot of the desktop masked zoom
    page.screenshot(path="/home/jules/verification/screenshots/prize_secrecy_verification.png")
    page.wait_for_timeout(1000)

    # Close Swal Zoom
    page.evaluate("Swal.close()")
    page.wait_for_timeout(1000)


    # TEST 2: duelmobile.html (Mobile Layout)
    print("\n--- TESTING MOBILE: duelmobile.html ---")
    print("Navigating to duelmobile.html in practice mode with layout=pokemon...")
    page.goto("http://localhost:8000/duelmobile.html?room=prize_verification_duel_mob&mode=practice&layout=pokemon&deck1=mock&deck2=mock")
    page.wait_for_timeout(2000)

    # Place a card in prize zone programmatically
    print("Placing face-down card in P1 Prize zone programmatically on mobile...")
    page.evaluate("""
        state.cards.push({
            instanceId: 'prize_card_mobile',
            name: 'Pikachu EX',
            imageUrl: 'https://images.pokemontcg.io/cel25/2_hires.png',
            owner: 'player1',
            controller: 'player1',
            zone: 'prize_1_1',
            faceDown: true,
            tapped: false,
            counters: 0,
            x: 0,
            y: 0,
            z: 100
        });
        renderAllCards();
    """)
    page.wait_for_timeout(1000)

    # 1. Verify that the mobile prize card does NOT have the 'reveal-face-down' class
    print("Verifying mobile prize card class...")
    mob_has_reveal_class = page.evaluate("jQuery('#prize_card_mobile').hasClass('reveal-face-down')")
    mob_is_face_down = page.evaluate("jQuery('#prize_card_mobile').hasClass('face-down')")
    print(f"Mobile Prize card is face-down: {mob_is_face_down}")
    print(f"Mobile Prize card has 'reveal-face-down' class: {mob_has_reveal_class}")
    assert not mob_has_reveal_class, "ERROR: Mobile face-down prize card should NOT have 'reveal-face-down' class!"

    # 2. Trigger mobile preview update and verify details are masked
    print("Updating mobile preview on the prize card...")
    page.evaluate("updatePreview(state.cards.find(c => c.instanceId === 'prize_card_mobile'))")
    page.wait_for_timeout(1000)

    mob_preview_img = page.evaluate("jQuery('#detail-card-img').attr('src')")
    mob_preview_name = page.evaluate("jQuery('#detail-card-name').text()")
    print(f"Mobile Preview Image URL: {mob_preview_img}")
    print(f"Mobile Preview Name: {mob_preview_name}")
    assert "pokeBocaAbajo.jpg" in mob_preview_img or "bocabajo.jpg" in mob_preview_img or "sleeve" in mob_preview_img, "ERROR: Mobile Preview should show card back!"
    assert "Pikachu" not in mob_preview_name, "ERROR: Mobile Preview should mask card name!"

    # 3. Trigger mobile preview zoom using the magnifying glass and verify zoom shows the back
    print("Triggering mobile zoom popup using magnifying glass...")
    page.evaluate("jQuery('#btn-magnify-preview').trigger('click')")
    page.wait_for_timeout(1000)

    mob_is_swal_visible = page.evaluate("jQuery('#custom-card-zoom-overlay').is(':visible')")
    mob_swal_img = page.evaluate("jQuery('#custom-card-zoom-img').attr('src')")
    print(f"Mobile Zoom Popup Visible: {mob_is_swal_visible}")
    print(f"Mobile Zoom Image URL: {mob_swal_img}")
    assert mob_is_swal_visible, "ERROR: Mobile zoom popup should be visible!"
    assert "pokeBocaAbajo.jpg" in mob_swal_img or "bocabajo.jpg" in mob_swal_img or "sleeve" in mob_swal_img, "ERROR: Mobile Zoom should show card back!"

    print("\nALL PRIZE CARD SECRECY TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    # Create required directories
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
