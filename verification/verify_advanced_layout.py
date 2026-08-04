import time
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Log console messages
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

    print("Navigating to configDuel.html...")
    page.goto("http://localhost:8000/configDuel.html")
    page.wait_for_timeout(1000)

    # Select Yu-Gi-Oh! Avanzado
    print("Selecting Yu-Gi-Oh! Avanzado...")
    page.select_option("#practice-layout", "yugioh_advanced")
    page.wait_for_timeout(1000)

    # Click start practice
    print("Clicking start practice...")
    page.click("#btn-start-practice")
    page.wait_for_timeout(2000)

    # Draw 5 cards
    print("Drawing 5 cards on playmat...")
    page.evaluate("drawCards('player1', 5)")
    page.wait_for_timeout(1000)

    # Place a card on Pendulum Left
    hand_cards = page.evaluate("state.cards.filter(c => c.zone === 'hand_1')")
    if hand_cards:
        print("Placing card in Left Pendulum zone...")
        page.evaluate(f"state.cards.find(c => c.instanceId === '{hand_cards[0]['instanceId']}').zone = 'spell_1_1'")
        page.evaluate("renderAllCards()")
        page.wait_for_timeout(1000)

    # Capture a screenshot showing the board with its Pendulum zones and Extra Monster zones
    print("Taking final layout screenshot...")
    page.screenshot(path="/home/jules/verification/screenshots/advanced_layout.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 1920, "height": 1080}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
            print("Done verifying advanced layout!")
