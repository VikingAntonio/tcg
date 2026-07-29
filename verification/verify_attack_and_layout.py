import asyncio
from playwright.async_api import async_playwright

async def run_verification():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Create context to record video and set high resolution viewport
        context = await browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 1920, "height": 1080}
        )
        page = await context.new_page()

        print("Navigating to duel simulator...")
        await page.goto("http://localhost:8000/duel.html")
        await page.wait_for_timeout(1000)

        # Draw cards
        print("Drawing cards...")
        await page.evaluate("drawCards('player1', 3)")
        await page.wait_for_timeout(1000)

        # Get first two cards in hand
        hand_cards = await page.evaluate("state.cards.filter(c => c.zone === 'hand_1')")
        card_attacker = hand_cards[0]
        card_target = hand_cards[1]

        # Place attacker card on monster_1_2
        print("Placing attacker card on monster_1_2...")
        await page.evaluate(f"state.cards.find(c => c.instanceId === '{card_attacker['instanceId']}').zone = 'monster_1_2'")

        # Place target card on monster_2_2
        print("Placing target card on monster_2_2...")
        await page.evaluate(f"state.cards.find(c => c.instanceId === '{card_target['instanceId']}').zone = 'monster_2_2'")

        await page.evaluate("renderAllCards()")
        await page.wait_for_timeout(1000)

        # Declare attack from card_attacker to card_target
        print("Declaring standard attack...")
        await page.evaluate(f"""
            state.attacks.push({{
                attackerId: '{card_attacker['instanceId']}',
                targetId: '{card_target['instanceId']}',
                isDirect: false
            }});
            if (typeof window.drawAttackArrows === "function") {{
                window.drawAttackArrows();
            }}
        """)
        await page.wait_for_timeout(1500)

        # Take screenshot of the standard attack sequence showing attacker and defender badges plus arrow & label
        print("Taking screenshot of standard attack visual badges...")
        screenshot_path_std = "/home/jules/verification/screenshots/standard_attack.png"
        await page.screenshot(path=screenshot_path_std)
        await page.wait_for_timeout(500)

        # Clear standard attack, and do Direct Attack
        print("Declaring direct attack...")
        await page.evaluate("""
            state.attacks = [];
            if (typeof window.drawAttackArrows === "function") {
                window.drawAttackArrows();
            }
        """)
        await page.evaluate(f"""
            state.attacks.push({{
                attackerId: '{card_attacker['instanceId']}',
                targetId: null,
                isDirect: true
            }});
            if (typeof window.drawAttackArrows === "function") {{
                window.drawAttackArrows();
            }}
        """)
        await page.wait_for_timeout(1500)

        # Take screenshot of the direct attack sequence showing ATK DIRECTO badge + ¡ATAQUE DIRECTO! label
        print("Taking screenshot of direct attack visual badges...")
        screenshot_path_dir = "/home/jules/verification/screenshots/direct_attack.png"
        await page.screenshot(path=screenshot_path_dir)
        await page.wait_for_timeout(1000)

        await context.close()
        await browser.close()
        print("Verification complete!")

if __name__ == "__main__":
    asyncio.run(run_verification())
