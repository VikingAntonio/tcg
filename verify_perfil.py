import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    import json
    mock_user = {
        "id": "11111111-1111-1111-1111-111111111111",
        "username": "TiendaDemo",
        "store_name": "Tienda Demo Viking",
        "is_store": True,
        "whatsapp_link": "https://wa.me/521234567890",
        "messenger_link": "https://m.me/tiendademo",
        "custom_domain": "tiendademo.com",
        "horario": "Lun-Vie 9:00 - 18:00",
        "ubicacion": "Ciudad de México",
        "additional_info": [
            {
                "title": "Políticas de Envío",
                "description": "Envíos gratis en compras mayores a $1,000 MXN por Estafeta."
            }
        ]
    }

    # Absolute file path to perfil.html
    html_path = os.path.abspath("docs/perfil.html")
    user_json = json.dumps(mock_user)

    page.add_init_script(f"localStorage.setItem('tcg_session', JSON.stringify({user_json}));")
    page.goto(f"file://{html_path}")
    page.wait_for_timeout(1500)

    # Click "+ Agregar Bloque" button
    add_btn = page.query_selector("#btn-add-info-block")
    if add_btn:
        add_btn.click()
        page.wait_for_timeout(500)

    # Fill new info block title & description
    inputs = page.query_selector_all(".info-block-title")
    textareas = page.query_selector_all(".info-block-desc")

    if len(inputs) > 1 and len(textareas) > 1:
        inputs[1].fill("Garantía y Devoluciones")
        textareas[1].fill("Todas las cartas cuentan con garantía de autenticidad de 30 días.")
        page.wait_for_timeout(500)

    # Scroll down to see the Additional Info section clearly
    page.evaluate("window.scrollTo(0, document.body.scrollHeight);")
    page.wait_for_timeout(1000)

    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
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
