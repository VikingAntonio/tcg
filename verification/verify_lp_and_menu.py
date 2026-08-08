import os
import subprocess
import time
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Set viewport to mobile landscape
    page.set_viewport_size({"width": 844, "height": 390})

    # Start dev server if not already running
    print("Navigating to duelmobile.html in mobile horizontal view...")
    page.goto("http://localhost:8000/duelmobile.html?mode=practice&layout=yugioh&deck1=mock&deck2=mock")
    page.wait_for_timeout(2000)

    # 1. Capture initial state with floating LP counters visible
    print("Capturing initial view...")
    page.screenshot(path="/home/jules/verification/screenshots/initial_floating_lp.png")

    # 2. Click P1 LP counter to open SweetAlert2 calculator
    print("Clicking P1 LP counter banner...")
    page.locator("#lp-counter-p1").click(force=True)
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/lp_calculator_open.png")

    # 3. Enter values in calculator: 2, 0, 0, 0, and click '+'
    print("Tapping calculator buttons: 2, 0, 0, 0, then '+'...")
    page.locator("button.btn-calc[data-val='2']").click(force=True)
    page.wait_for_timeout(200)
    page.locator("button.btn-calc[data-val='0']").click(force=True)
    page.wait_for_timeout(200)
    page.locator("button.btn-calc[data-val='0']").click(force=True)
    page.wait_for_timeout(200)
    page.locator("button.btn-calc[data-val='0']").click(force=True)
    page.wait_for_timeout(500)

    # Click sum operator '+' which should apply calculation and close instantly
    page.locator("button.btn-calc-op.btn-success").click(force=True)
    page.wait_for_timeout(1500)
    page.screenshot(path="/home/jules/verification/screenshots/lp_after_calculator.png")

    # 4. Toggle accessories mobile sidebar drawer
    print("Toggling bottom-left floating sidebar button...")
    page.locator("#btn-toggle-mobile-sidebar").click(force=True)
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/sidebar_drawer_opened.png")

    # Close sidebar by toggling again
    page.locator("#btn-toggle-mobile-sidebar").click(force=True)
    page.wait_for_timeout(1000)

    # 5. Open Deck search modal to test list option looping
    print("Opening P1 Deck context menu...")
    page.locator("#zone-deck_1").click(force=True)
    page.wait_for_timeout(1000)

    print("Clicking 'Buscar'...")
    page.locator("#deck-menu-search").click(force=True)
    page.wait_for_timeout(1500)
    page.screenshot(path="/home/jules/verification/screenshots/deck_search_modal.png")

    # Click first card in the search grid to open its options menu
    print("Clicking a card in search modal to open options menu...")
    first_search_card = page.locator("#search-cards-grid .pile-card-container").first
    first_search_card.click(force=True)
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/list_menu_options.png")

    # Scroll the options menu to trigger looping
    print("Scrolling list menu...")
    overlay = first_search_card.locator(".pile-card-hover-overlay")
    overlay.evaluate("el => el.scrollTop = 150")
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/list_menu_scrolled.png")

    # Click 'Mano' to add to hand using dispatch_event to bypass viewport/scroll constraints
    print("Clicking visible 'Mano' button in the middle set of looped list menu...")
    overlay.locator(".btn-search-hand").nth(1).dispatch_event("click")
    page.wait_for_timeout(1500)
    page.screenshot(path="/home/jules/verification/screenshots/cuj_final_state.png")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    # Ensure server is running
    subprocess.run("kill $(lsof -t -i :8000) 2>/dev/null || true", shell=True)
    proc = subprocess.Popen("python3 -m http.server 8000 --directory docs/", shell=True)
    time.sleep(2)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 844, "height": 390}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()  # MUST close context to save the video
            browser.close()
            proc.terminate()
            proc.wait()
