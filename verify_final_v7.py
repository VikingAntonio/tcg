
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        # Verify Public View (Purple Color, Hidden Titles, Side-by-side Info)
        print("Final Visual Verification...")
        context_pc = await browser.new_context(viewport={'width': 1280, 'height': 900})
        page_pc = await context_pc.new_page()
        await page_pc.goto(f'file://{os.getcwd()}/docs/public.html?view=auctions&id=TestStore')

        await page_pc.evaluate("""() => {
            $('#auctions-container').empty().append(`
                <div class="auction-public-card" id="auction-test">
                    <div class="auction-image-wrapper">
                        <img src="https://via.placeholder.com/300" alt="Test Item">
                        <div class="auction-bid-badge winning-bid-badge">$150.00</div>
                    </div>
                    <div class="auction-info-overlay">
                        <h3 class="auction-title">TITULO QUE DEBE ESTAR OCULTO</h3>
                        <div class="auction-footer-info">
                            <div class="auction-timer-mini date-pulse"><span class="timer-countdown">Termina el 25 Dic</span></div>
                            <div class="auction-bidder-info">
                                <span class="bidder-name">Ganador Actual</span>
                                <span class="bidder-amount">$150.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        }""")

        await page_pc.wait_for_timeout(1000)
        await page_pc.screenshot(path='verification/final_visual_v7.png')
        await browser.close()

asyncio.run(run())
