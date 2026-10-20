import os
from playwright.sync_api import sync_playwright

def run_verification(page):
    # 1. Admin Sealed Product page
    page.goto("http://localhost:8080/productoSellado.html")
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/admin_sealed.png")

    # 2. Public Sealed Product View
    page.goto("http://localhost:8080/public.html?view=sealed")
    page.wait_for_timeout(1500)
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()
        try:
            run_verification(page)
        finally:
            context.close()
            browser.close()
