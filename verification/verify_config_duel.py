import os
import asyncio
from playwright.sync_api import sync_playwright

def run_cuj(page):
    print("Navigating to configDuel.html...")
    page.goto("http://localhost:8000/configDuel.html")
    page.wait_for_timeout(1000)

    # Take screenshot of the initial configDuel page
    print("Taking initial screenshot...")
    page.screenshot(path="/home/jules/verification/screenshots/config_duel.png")
    page.wait_for_timeout(1000)

    # Interact with the elements
    print("Selecting Pokémon Arena...")
    page.select_option("#practice-layout", "pokemon")
    page.wait_for_timeout(1000)

    print("Taking selected screenshot...")
    page.screenshot(path="/home/jules/verification/screenshots/config_duel_selected.png")
    page.wait_for_timeout(1000)

    # Click start practice
    print("Clicking start practice...")
    page.click("#btn-start-practice")
    page.wait_for_timeout(2000)

    # We should be redirected to duel.html
    print(f"Current URL: {page.url}")
    assert "duel.html" in page.url, "Should be redirected to duel.html!"
    page.screenshot(path="/home/jules/verification/screenshots/duel_loaded.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            # Re-ensure server on 8000 is reachable
            run_cuj(page)
        finally:
            context.close()
            browser.close()
            print("Finished frontend verification script!")
