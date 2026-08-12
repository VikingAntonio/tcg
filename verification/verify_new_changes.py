import os
from playwright.sync_api import sync_playwright

def run_verification(page):
    # Enable console log forwarding
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

    # Navigate to admin page
    page.goto("http://localhost:8000/admin.html")
    page.wait_for_timeout(2000)

    # Force show view-editor, make sure it is displayed and hide login modal
    page.evaluate("""() => {
        $('#login-modal').hide();
        $('.admin-section').hide().removeClass('active');
        $('#view-editor').show().addClass('active');
        // Ensure parent containers if any are shown
        $('#view-editor').parents().show();
    }""")
    page.wait_for_timeout(500)

    # 1. Assert Configurator Trigger exists
    toggle_btn = page.query_selector("#btn-toggle-config")
    assert toggle_btn is not None, "Configurator toggle button not found!"
    print("Toggle button is present.")

    # 2. Check initial state of the container (should be hidden)
    config_container = page.query_selector("#album-config-container")
    assert config_container is not None, "Album config container not found!"
    is_hidden = page.evaluate("() => $('#album-config-container').is(':hidden')")
    assert is_hidden, "Album config container should be hidden initially!"
    print("Album config container is initially hidden.")

    # Take screenshot of collapsed state
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    page.screenshot(path="/home/jules/verification/screenshots/collapsed_state.png")

    # 3. Trigger Click via jQuery and check state (should be visible)
    page.evaluate("() => $('#btn-toggle-config').click()")
    page.wait_for_timeout(500)
    is_visible = page.evaluate("() => $('#album-config-container').is(':visible')")
    assert is_visible, "Album config container should be visible after toggle!"
    print("Album config container toggled to visible successfully!")

    # 4. Check labels and fields
    title_label = page.evaluate("() => $('#album-config-container > .form-group:first-child label').text().trim()")
    assert title_label == "Nombre", f"Expected label 'Nombre', got '{title_label}'"
    print("Title field is renamed to 'Nombre'.")

    grid_label = page.evaluate("() => $('#album-config-container > .form-group:nth-child(2) label').text().trim()")
    assert grid_label == "Tamaño de carpeta", f"Expected label 'Tamaño de carpeta', got '{grid_label}'"
    print("Grid selection label is renamed to 'Tamaño de carpeta'.")

    # Take screenshot of expanded state
    page.screenshot(path="/home/jules/verification/screenshots/expanded_state.png")

    # 5. Check mobile styles of grid container
    # Set viewport to mobile size
    page.set_viewport_size({"width": 375, "height": 667})
    page.wait_for_timeout(500)

    # Inject a test grid if it doesn't exist just to verify mobile styles
    page.evaluate("""() => {
        $('body').append('<div class="admin-grid-preview grid-container" id="test-grid"></div>');
    }""")

    grid_height = page.evaluate("() => window.getComputedStyle(document.getElementById('test-grid')).height")
    height_val = float(grid_height.replace('px', ''))
    print(f"Mobile Grid height: {grid_height}")
    assert height_val < 50.0, f"Expected small height for empty auto-height grid, but got {grid_height}"
    print("Mobile height auto-scaling verified successfully!")

    page.screenshot(path="/home/jules/verification/screenshots/new_admin_features_verified.png")
    print("Verification successfully complete!")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_verification(page)
        finally:
            context.close()
            browser.close()
