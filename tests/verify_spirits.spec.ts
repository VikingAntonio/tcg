import { test, expect } from '@playwright/test';

test('verify spirits modal and navigation', async ({ page }) => {
  await page.goto('http://localhost:8000/public.html?store=test');

  // Open Spirit Modal
  await page.click('#spirit-btn');

  // Check if modal is active
  await expect(page.locator('#spirit-modal')).toHaveClass(/active/);

  // Check if visor container exists
  await expect(page.locator('#public-spirit-visor-container')).toBeVisible();

  // Check if navigation arrows exist (they might be hidden if 0 or 1 spirit,
  // but let's check if they are in DOM)
  await expect(page.locator('#btn-prev-spirit-public')).toBeAttached();
  await expect(page.locator('#btn-next-spirit-public')).toBeAttached();

  // Check if model-viewer has correct attributes
  const viewer = page.locator('#public-spirit-viewer');
  await expect(viewer).toHaveAttribute('camera-orbit', '0deg 75deg 105%');
  await expect(viewer).not.toHaveAttribute('auto-rotate');

  // Take a screenshot
  await page.screenshot({ path: 'spirits_modal_verification.png' });
});
