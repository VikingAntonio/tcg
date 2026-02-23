const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport to see the layout clearly
  await page.setViewportSize({ width: 1280, height: 1200 });

  // Navigate to admin.html
  await page.goto('file://' + process.cwd() + '/docs/admin.html');

  // Mock Supabase session and user
  await page.evaluate(() => {
    const mockUser = {
      id: '12345',
      username: 'testuser',
      role: 'admin',
      horario: '10am - 6pm',
      ubicacion: 'Calle Falsa 123',
      selected_spirit_id: 1
    };
    localStorage.setItem('tcg_session', JSON.stringify(mockUser));

    // Global mocks
    window._supabase = {
      auth: { getSession: async () => ({ data: { session: { user: { id: '12345' } } } }) },
      from: (table) => ({
        select: () => ({
          eq: () => ({
            single: async () => {
              if (table === 'usuarios') return { data: mockUser };
              return { data: null };
            },
            order: async () => ({ data: [] })
          }),
          in: async () => ({ data: [] }),
          order: async () => ({ data: [] })
        }),
        upsert: async () => ({ error: null }),
        update: async () => ({ error: null })
      }),
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) }
    };

    window.currentSpirit = {
      id: 1,
      name: 'Kuriboh',
      gltf_url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'
    };
  });

  // Trigger chatbot config view
  await page.evaluate(() => {
    showView('chatbot-config');
    loadBotMessages();
  });

  // Wait for rendering
  await page.waitForTimeout(2000);

  // Take screenshot
  await page.screenshot({ path: 'verification/chatbot_dashboard_v2.png', fullPage: true });

  await browser.close();
})();
