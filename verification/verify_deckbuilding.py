import os
from playwright.sync_api import sync_playwright

def run_verification(page):
    # Set viewport to mobile landscape (e.g. 844 x 390)
    page.set_viewport_size({"width": 844, "height": 390})

    # Listen to console messages and page errors
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: [{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

    # Navigate to the page
    print("Navigating to deckbuilding.html...")
    page.goto("http://localhost:8000/deckbuilding.html?deckId=mock_deck")
    page.wait_for_timeout(1000)

    # Inject mock session and data to bypass network / db and show full workspace
    print("Injecting mock session and data...")
    page.evaluate("""() => {
        // Set mock session in localStorage
        localStorage.setItem('tcg_session', JSON.stringify({
            id: 'mock_user_id',
            username: 'UsuarioMovil',
            max_albums: 5,
            max_pages: 5,
            max_decks: 5,
            max_cards_per_deck: 60
        }));

        // Mock current user
        currentUser = {
            id: 'mock_user_id',
            username: 'UsuarioMovil'
        };

        // Pre-populate deck data
        currentDeck = {
            id: 'mock_deck',
            name: 'Mi Deck Móvil Avanzado',
            sleeves: 'https://vikingtcg.xyz/favi.png',
            deckbox: null,
            coin: null,
            mats: null
        };

        $('#deck-title').text(currentDeck.name);
        $('#deck-name-input').val(currentDeck.name);

        // Pre-populate mock cards
        localDeckCards = [
            { id: 1, name: 'Blue-Eyes White Dragon', image_url: 'https://images.ygoprodeck.com/images/cards/89631139.jpg', section: 'Main', position: 0, quantity: 3 },
            { id: 2, name: 'Dark Magician', image_url: 'https://images.ygoprodeck.com/images/cards/46986414.jpg', section: 'Main', position: 1, quantity: 1 },
            { id: 3, name: 'Exodia the Forbidden One', image_url: 'https://images.ygoprodeck.com/images/cards/33396948.jpg', section: 'Main', position: 2, quantity: 1 },
            { id: 4, name: 'Elemental HERO Neos', image_url: 'https://images.ygoprodeck.com/images/cards/28754358.jpg', section: 'Main', position: 3, quantity: 2 },
            { id: 5, name: 'Stardust Dragon', image_url: 'https://images.ygoprodeck.com/images/cards/44508094.jpg', section: 'Extra', position: 0, quantity: 1 }
        ];

        // Show workspace and hide login modal
        $('#login-modal').removeClass('active');
        $('#deck-workspace').show();

        // Render grids
        renderDeckGrids();
    }""")
    page.wait_for_timeout(1000)

    # Capture first screenshot of the landscape workspace
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    screenshot_path = "/home/jules/verification/screenshots/deckbuilding_landscape.png"
    page.screenshot(path=screenshot_path)
    print(f"Captured workspace landscape screenshot at {screenshot_path}")

    # Select the Extra Deck section header to change active section
    print("Clicking Extra Deck header section...")
    page.locator(".section-header[data-section='Extra']").click(force=True)
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/screenshots/deckbuilding_extra_selected.png")

    # Let's open the accessories modal
    print("Opening accessories modal...")
    page.locator("#btn-deck-accessories").click(force=True)
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/screenshots/deckbuilding_accessories_modal.png")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 844, "height": 390}
        )
        page = context.new_page()
        try:
            run_verification(page)
        finally:
            context.close()
            browser.close()
