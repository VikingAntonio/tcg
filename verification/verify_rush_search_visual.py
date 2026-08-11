import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: [{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))
    page.on("request", lambda req: print(f"REQ: {req.url}"))
    page.on("response", lambda res: print(f"RES: {res.url} -> {res.status}"))

    print("Navigating to admin page...")
    page.goto("http://localhost:8000/admin.html")
    page.wait_for_timeout(2000)

    # Directly authenticate as mock user
    print("Mocking authentication session...")
    page.evaluate("""
        currentUser = {
            id: 'mock-id',
            username: 'MockAdmin',
            store_name: 'Mock Store',
            is_store: true,
            role: 'admin',
            has_tracking: true,
            has_clients: true,
            has_auctions: true,
            has_events: true,
            max_albums: 10,
            max_pages: 10,
            max_decks: 10
        };
        showAuthenticatedContent();
        showView('deck-editor');
    """)
    page.wait_for_timeout(1500)

    # Click/select format filter option
    print("Selecting format filter 'Rush Duel'...")
    page.select_option("#nexus-filter-format", "rush duel")
    page.wait_for_timeout(1000)

    # Input search query
    print("Typing search query 'Yorishiro'...")
    page.fill("#nexus-search-input", "Yorishiro")
    page.wait_for_timeout(1000)

    print("Waiting for search results to load...")
    try:
        page.wait_for_selector("#nexus-search-results .nexus-card", timeout=15000)
    except Exception as e:
        print("Timeout waiting for cards")

    page.wait_for_timeout(3000)

    # Take screenshot at the key moment
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    screenshot_path = "/home/jules/verification/screenshots/rush_duel_search_verified.png"
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"Verification screenshot saved to: {screenshot_path}")
    page.wait_for_timeout(1000)  # Hold final state for the video

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()  # MUST close context to save the video
            browser.close()
