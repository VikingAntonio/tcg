from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err.message}"))

    # Set viewport to landscape mobile dimensions
    page.set_viewport_size({"width": 800, "height": 480})

    # Go to duelmobile.html with practice mode
    page.goto("http://localhost:8000/docs/duelmobile.html?room=testroom&mode=practice")
    page.wait_for_timeout(3000)

    # Verify if rotate board button is visible in practice mode
    btn = page.locator("#btn-rotate-board")
    is_visible = btn.is_visible()
    print(f"Rotate Board button visible in practice mode: {is_visible}")

    # Take screenshot of the initial unrotated board
    page.screenshot(path="/home/jules/verification/screenshots/initial_unrotated.png")
    page.wait_for_timeout(1000)

    # Click the rotate board button to rotate the field
    print("Clicking rotate board button...")
    btn.click()
    page.wait_for_timeout(2000)

    # Verify that the class rotated-board was applied to body
    has_class = page.evaluate("document.body.classList.contains('rotated-board')")
    print(f"Body has 'rotated-board' class: {has_class}")

    # Take screenshot of the rotated board
    page.screenshot(path="/home/jules/verification/screenshots/rotated_board.png")
    page.wait_for_timeout(2000)

    # Click the rotate board button again to restore original orientation
    print("Clicking rotate board button again to restore...")
    btn.click()
    page.wait_for_timeout(2000)

    # Take screenshot of the restored board
    page.screenshot(path="/home/jules/verification/screenshots/restored_board.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
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
