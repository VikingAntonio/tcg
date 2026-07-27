import asyncio
import time
from playwright.async_api import async_playwright

async def run_test():
    async with async_playwright() as p:
        # Launch headless browser
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        print("Navigating to duel simulator...")
        await page.goto("http://localhost:8000/duel.html")
        await page.wait_for_timeout(1000)

        # 1. Verify initialization
        print("Checking initial state...")
        deck_count = await page.evaluate("state.cards.filter(c => c.zone === 'deck_1').length")
        print(f"P1 Deck size: {deck_count}")
        assert deck_count > 0, "P1 Deck should not be empty!"

        # 2. Draw 3 cards to P1 hand
        print("Drawing cards...")
        await page.evaluate("drawCards('player1', 3)")
        await page.wait_for_timeout(1000)
        hand_count = await page.evaluate("state.cards.filter(c => c.zone === 'hand_1').length")
        print(f"P1 Hand size: {hand_count}")
        assert hand_count == 3, "P1 Hand should have 3 cards!"

        # Get instances of cards in hand
        hand_cards = await page.evaluate("state.cards.filter(c => c.zone === 'hand_1')")
        card_a = hand_cards[0]
        card_b = hand_cards[1]
        card_c = hand_cards[2]

        print(f"Card A: {card_a['name']} ({card_a['instanceId']})")
        print(f"Card B: {card_b['name']} ({card_b['instanceId']})")
        print(f"Card C: {card_c['name']} ({card_c['instanceId']})")

        # 3. Put Card B on the field
        print("Placing Card B on monster zone...")
        await page.evaluate(f"state.cards.find(c => c.instanceId === '{card_b['instanceId']}').zone = 'monster_1_2'")
        await page.evaluate("renderAllCards()")
        await page.wait_for_timeout(500)

        # 4. Attach Card A to Card B
        print("Attaching Card A to Card B...")
        await page.evaluate(f"const c = state.cards.find(c => c.instanceId === '{card_a['instanceId']}'); c.attachedTo = '{card_b['instanceId']}'; c.zone = 'monster_1_2';")
        await page.evaluate("renderAllCards()")
        await page.wait_for_timeout(500)

        is_attached = await page.evaluate(f"state.cards.find(c => c.instanceId === '{card_a['instanceId']}').attachedTo === '{card_b['instanceId']}'")
        assert is_attached, "Card A should be attached to Card B!"

        # 5. Flat-map test: Attach Card C to Card A (which is already attached to Card B)
        # It should transfer to Card B because Card A is already attached to B.
        print("Attaching Card C to Card A (should flat-map/transfer to Card B)...")
        # Trigger the click-to-attach process on Card C, then click Card A
        # Let's directly simulate the startAttachmentTargeting click target:
        await page.evaluate(f"startAttachmentTargeting(state.cards.find(c => c.instanceId === '{card_c['instanceId']}'))")
        # Now simulate clicking on the Card B element on the field
        # The flat-mapping logic inside the click target handler or our new implementation should assign Card C's attachedTo to Card B!
        await page.evaluate(f"""
            const targetInstId = '{card_b['instanceId']}';
            const parentCardObj = state.cards.find(c => c.instanceId === targetInstId);
            if (parentCardObj && attachingCard) {{
                // our flat-map logic
                state.cards.forEach(c => {{
                    if (c.attachedTo === attachingCard.instanceId) {{
                        c.attachedTo = parentCardObj.instanceId;
                    }}
                }});
                attachingCard.attachedTo = parentCardObj.instanceId;
                attachingCard.attachedAt = Date.now();
                attachingCard.zone = parentCardObj.zone;
                attachingCard.faceDown = parentCardObj.faceDown;
                renderAllCards();
                stopAttachmentTargeting();
            }}
        """)
        await page.wait_for_timeout(500)

        # Check where Card C is attached
        attached_to = await page.evaluate(f"state.cards.find(c => c.instanceId === '{card_c['instanceId']}').attachedTo")
        print(f"Card C is attached to: {attached_to}")
        # Wait, since Card A is attached to Card B, the target's attachedTo is Card B.
        # But wait! If we attach Card C to Card A, and we click on Card A:
        # Currently, does Card C attach to Card B (the parent) or Card A?
        # Let's verify our implementation:
        # In renderAllCards, when drawing card A, its element class has `attached-card-cascade`.
        # And startAttachmentTargeting binds click ONLY to elements `.not(".attached-card-cascade")`!
        # So we can't click on Card A. We can only click on Card B (the parent)!
        # So if we click on Card B, Card C's attachedTo is Card B's instance ID.
        # What if we drag Card C and drop it on Card A?
        # `findOverlappingCard` only searches cards with `!c.attachedTo`! So it will find Card B instead of Card A.
        # Hence, Card C will always be attached to Card B.
        # What if we attach a card that has its own attached cards?
        # Suppose Card B has Card A attached to it.
        # Now we attach Card B to some other card (say Card X).
        # Then, Card B's attached cards (Card A) should also be transferred to Card X!
        # Let's test that! Let's place a new card, Card X, on the field:
        card_x_instance = await page.evaluate("state.cards.find(c => c.zone === 'deck_1')")
        print(f"Card X: {card_x_instance['name']} ({card_x_instance['instanceId']})")
        await page.evaluate(f"const c = state.cards.find(c => c.instanceId === '{card_x_instance['instanceId']}'); c.zone = 'monster_1_3'; c.faceDown = false;")
        await page.evaluate("renderAllCards()")

        # Now attach Card B (which has Card A attached) to Card X
        print("Attaching Card B (with Card A) to Card X...")
        await page.evaluate(f"startAttachmentTargeting(state.cards.find(c => c.instanceId === '{card_b['instanceId']}'))")
        await page.evaluate(f"""
            const targetInstId = '{card_x_instance['instanceId']}';
            const parentCardObj = state.cards.find(c => c.instanceId === targetInstId);
            if (parentCardObj && attachingCard) {{
                // flat-map transfer logic
                state.cards.forEach(c => {{
                    if (c.attachedTo === attachingCard.instanceId) {{
                        c.attachedTo = parentCardObj.instanceId;
                    }}
                }});
                attachingCard.attachedTo = parentCardObj.instanceId;
                attachingCard.attachedAt = Date.now();
                attachingCard.zone = parentCardObj.zone;
                renderAllCards();
                stopAttachmentTargeting();
            }}
        """)
        await page.wait_for_timeout(500)

        # Verify that BOTH Card B and Card A are now attached to Card X!
        b_attached_to = await page.evaluate(f"state.cards.find(c => c.instanceId === '{card_b['instanceId']}').attachedTo")
        a_attached_to = await page.evaluate(f"state.cards.find(c => c.instanceId === '{card_a['instanceId']}').attachedTo")
        print(f"Card B is attached to: {b_attached_to}")
        print(f"Card A is attached to: {a_attached_to}")
        assert b_attached_to == card_x_instance['instanceId'], "Card B should be attached to Card X!"
        assert a_attached_to == card_x_instance['instanceId'], "Card A should have transferred to Card X!"

        # 6. Test XYZ Summon Option from Extra Deck
        # Get an Extra Deck card
        extra_cards = await page.evaluate("state.cards.filter(c => c.zone === 'extra_1')")
        assert len(extra_cards) > 0, "Should have Extra Deck cards!"
        extra_card = extra_cards[0]
        print(f"XYZ Extra Card: {extra_card['name']} ({extra_card['instanceId']})")

        # Start XYZ targeting
        print("Initiating XYZ Summon...")
        await page.evaluate(f"startXYZTargeting(state.cards.find(c => c.instanceId === '{extra_card['instanceId']}'))")
        # Target Card X (which has B and A attached)
        await page.evaluate(f"""
            const targetInstId = '{card_x_instance['instanceId']}';
            const parentCardObj = state.cards.find(c => c.instanceId === targetInstId);
            if (parentCardObj && xyzCard) {{
                xyzCard.zone = parentCardObj.zone;
                xyzCard.x = parentCardObj.x;
                xyzCard.y = parentCardObj.y;
                xyzCard.faceDown = false;
                xyzCard.tapped = parentCardObj.tapped;
                xyzCard.isExtra = true;

                state.cards.forEach(c => {{
                    if (c.attachedTo === parentCardObj.instanceId) {{
                        c.attachedTo = xyzCard.instanceId;
                    }}
                }});

                parentCardObj.attachedTo = xyzCard.instanceId;
                parentCardObj.attachedAt = Date.now();
                renderAllCards();
                stopXYZTargeting();
            }}
        """)
        await page.wait_for_timeout(500)

        # Verify new XYZ Parent and its materials
        xyz_zone = await page.evaluate(f"state.cards.find(c => c.instanceId === '{extra_card['instanceId']}').zone")
        x_attached_to = await page.evaluate(f"state.cards.find(c => c.instanceId === '{card_x_instance['instanceId']}').attachedTo")
        b_attached_to = await page.evaluate(f"state.cards.find(c => c.instanceId === '{card_b['instanceId']}').attachedTo")
        a_attached_to = await page.evaluate(f"state.cards.find(c => c.instanceId === '{card_a['instanceId']}').attachedTo")

        print(f"XYZ Card zone: {xyz_zone}")
        print(f"Card X attached to: {x_attached_to}")
        print(f"Card B attached to: {b_attached_to}")
        print(f"Card A attached to: {a_attached_to}")

        assert xyz_zone == 'monster_1_3', "XYZ card should be on Card X's zone!"
        assert x_attached_to == extra_card['instanceId'], "Card X should be attached to XYZ Card!"
        assert b_attached_to == extra_card['instanceId'], "Card B should be attached to XYZ Card!"
        assert a_attached_to == extra_card['instanceId'], "Card A should be attached to XYZ Card!"

        # 7. Test sending XYZ parent to Graveyard with all its materials
        print("Sending XYZ stack to Graveyard...")
        # Simulating click on btn-field-grave for the XYZ parent card
        await page.evaluate(f"""
            const xyzParent = state.cards.find(c => c.instanceId === '{extra_card['instanceId']}');
            const pileId = 'grave_1';
            sendAttachedCardsToPile(xyzParent.instanceId, pileId);
            xyzParent.zone = pileId;
            xyzParent.faceDown = false;
            xyzParent.tapped = false;
            xyzParent.attachedTo = null;
            renderAllCards();
        """)
        await page.wait_for_timeout(500)

        # Verify that all 4 cards (XYZ, X, B, A) are now in grave_1 and detached
        grave_cards = await page.evaluate("state.cards.filter(c => c.zone === 'grave_1')")
        print(f"Graveyard size: {grave_cards}")
        assert len(grave_cards) >= 4, "All 4 cards should be in Graveyard!"

        for c in grave_cards:
            if c['instanceId'] in [extra_card['instanceId'], card_x_instance['instanceId'], card_b['instanceId'], card_a['instanceId']]:
                assert c['attachedTo'] is None, f"Card {c['name']} should be detached!"

        # Open the Graveyard modal and verify sequence order
        print("Opening Graveyard Modal...")
        await page.evaluate("openPileModal('player1', 'grave')")
        await page.wait_for_timeout(1000)

        # Check sequence order inside the modal list
        # Since they were sent together:
        # - Parent (XYZ card) should have the absolute newest timestamp
        # - Then Card X
        # - Then Card B
        # - Then Card A (first attached)
        # So we expect XYZ, Card X, Card B, Card A in that order (descending by movedToPileAt).
        modal_cards = await page.evaluate("""
            Array.from(document.querySelectorAll('#pile-cards-grid .pile-card-container')).map(el => {
                const instId = el.getAttribute('data-instance-id');
                return state.cards.find(c => c.instanceId === instId);
            })
        """)

        print("Sequence in Graveyard Modal (first to last displayed):")
        names_in_order = [c['name'] for c in modal_cards if c]
        print(names_in_order)

        # Let's ensure the order XYZ, X, B, A is preserved:
        expected_subset = [extra_card['name'], card_x_instance['name'], card_b['name'], card_a['name']]
        # Filter modal_cards to only contain these 4 cards to see their relative order
        actual_subset = [c['name'] for c in modal_cards if c and c['name'] in expected_subset]
        print(f"Expected relative sequence: {expected_subset}")
        print(f"Actual relative sequence: {actual_subset}")
        assert actual_subset == expected_subset, "Graveyard sequence order is incorrect!"

        # Capture a screenshot for verification
        screenshot_path = "verification/screenshots/xyz_attach_verify.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_test())
