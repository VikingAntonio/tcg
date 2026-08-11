import os
from playwright.sync_api import sync_playwright

def run_verification(page):
    # Set viewport to mobile landscape
    page.set_viewport_size({"width": 844, "height": 390})

    # Listen to console messages and page errors
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: [{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

    # Navigate to the page with NO deckId parameter
    print("Navigating to deckbuilding.html without deckId...")
    page.goto("http://localhost:8000/deckbuilding.html")
    page.wait_for_timeout(1000)

    # Overwrite _supabase methods and invoke showAuthenticatedContent()
    print("Injecting overrides into the active page session...")
    page.evaluate("""() => {
        // Mock current user
        currentUser = {
            id: 'mock_user_id',
            username: 'UsuarioMovil',
            max_albums: 5,
            max_pages: 5,
            max_decks: 5,
            max_cards_per_deck: 60
        };

        // Set mock session in localStorage
        localStorage.setItem('tcg_session', JSON.stringify(currentUser));

        // Overwrite standard _supabase methods
        _supabase.auth.getSession = () => Promise.resolve({ data: { session: { user: { id: 'mock_user_id' } } }, error: null });

        _supabase.from = (table) => {
            return {
                select: (cols, opts) => {
                    return {
                        or: (cond) => Promise.resolve({ data: [], error: null }),
                        eq: (col, val) => {
                            return {
                                order: (col2, opts2) => {
                                    return {
                                        order: (col3, opts3) => {
                                            if (table === 'decks') {
                                                return Promise.resolve({
                                                    data: [
                                                        { id: 'deck_1', name: 'Mi Deck de Fuego', mats: 'https://images.ygoprodeck.com/images/cards/89631139.jpg', is_public: true },
                                                        { id: 'deck_2', name: 'Deck HÉROE Leyenda', mats: null, is_public: false }
                                                    ],
                                                    error: null
                                                });
                                            }
                                            if (table === 'deck_cards') {
                                                return Promise.resolve({
                                                    data: [
                                                        { id: 1, name: 'Blue-Eyes White Dragon', image_url: 'https://images.ygoprodeck.com/images/cards/89631139.jpg', section: 'Main', position: 0, quantity: 3 },
                                                        { id: 2, name: 'Dark Magician', image_url: 'https://images.ygoprodeck.com/images/cards/46986414.jpg', section: 'Main', position: 1, quantity: 1 }
                                                    ],
                                                    error: null
                                                });
                                            }
                                            return Promise.resolve({ data: [], error: null });
                                        }
                                    };
                                },
                                single: () => {
                                    if (table === 'decks') {
                                        return Promise.resolve({
                                            data: { id: 'deck_1', name: 'Mi Deck de Fuego', mats: 'https://images.ygoprodeck.com/images/cards/89631139.jpg', is_public: true },
                                            error: null
                                        });
                                    }
                                    return Promise.resolve({ data: {}, error: null });
                                }
                            };
                        }
                    };
                }
            };
        };

        // Re-run authenticated load to populate views
        showAuthenticatedContent();
    }""")
    page.wait_for_timeout(1000)

    # Capture landing selection panel screenshot
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    landing_screenshot = "/home/jules/verification/screenshots/deckbuilding_landing_dashboard.png"
    page.screenshot(path=landing_screenshot)
    print(f"Captured dashboard landing screenshot at {landing_screenshot}")

    # Click the "Construir" button on the first deck
    print("Clicking Construir on the first deck...")
    page.locator(".deck-selection-card:has-text('Mi Deck de Fuego') .btn-edit-deck").click(force=True)
    page.wait_for_timeout(1000)

    # Take screenshot of workspace transition
    workspace_screenshot = "/home/jules/verification/screenshots/deckbuilding_landing_workspace.png"
    page.screenshot(path=workspace_screenshot)
    print(f"Captured transition workspace screenshot at {workspace_screenshot}")

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
