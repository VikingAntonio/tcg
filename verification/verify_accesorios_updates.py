import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Navigate to the page
    page.goto("http://localhost:8000/admin.html")
    page.wait_for_timeout(1000)

    # Set mock session
    page.evaluate("""() => {
        localStorage.setItem('tcg_session', JSON.stringify({
            id: 'mock-user-id',
            username: 'testadmin',
            role: 'admin',
            is_store: true,
            has_auctions: true,
            has_tracking: true,
            has_clients: true,
            has_events: true
        }));
    }""")
    page.goto("http://localhost:8000/admin.html")
    page.wait_for_timeout(2000)

    # Populate accessories modal with mock data and activate the modal
    page.evaluate("""() => {
        window.selectedSleeves = 'https://vikingtcg.xyz/cerezo.png';
        window.selectedDeckbox = null;
        window.selectedCoin = null;
        window.selectedMats = 'https://vikingtcg.xyz/favi.png';

        window.renderAccessoriesGrid([
            {name: 'Premium Pikachu Sleeves', image_url: 'https://vikingtcg.xyz/cerezo.png', rarity: 'sleeves', expansion: 'sleeves', type: 'accessories'},
            {name: 'Zekrom Deckbox', image_url: 'https://vikingtcg.xyz/favi.png', rarity: 'deckbox', expansion: 'deckbox', type: 'accessories'},
            {name: 'Charizard Gold Coin', image_url: 'https://vikingtcg.xyz/cerezo.png', rarity: 'coin', expansion: 'coin', type: 'accessories'},
            {name: 'Kanto Map Playmat', image_url: 'https://vikingtcg.xyz/favi.png', rarity: 'mats', expansion: 'mats', type: 'accessories'}
        ]);

        $('#accessories-modal').addClass('active');
    }""")
    page.wait_for_timeout(1000)

    # Take screenshot of the accessories modal
    page.screenshot(path="/home/jules/verification/screenshots/accessories_modal.png")
    print("Accessories modal screenshot taken successfully!")

    # Click the zoom button on the first accessory item in sleeves tab
    page.locator(".accessory-zoom-btn").first.click()
    page.wait_for_timeout(1000)

    # Take screenshot of the SweetAlert2 zoom modal
    page.screenshot(path="/home/jules/verification/screenshots/swal_zoom_modal.png")
    print("SweetAlert2 zoom modal screenshot taken successfully!")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
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
