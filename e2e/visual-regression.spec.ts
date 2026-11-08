import { test, expect } from '@playwright/test';

test.describe('Visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('chakra-onboarding-complete', 'true'));
    await page.reload();
    await page.waitForTimeout(3000); // Wait for animations to settle
  });

  test('main dashboard layout', async ({ page }) => {
    await expect(page).toHaveScreenshot('dashboard-main.png', {
      maxDiffPixelRatio: 0.05, // 5% tolerance for WebGL/animation variance
      animations: 'disabled',
    });
  });

  test('welcome gate layout', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('chakra-onboarding-complete'));
    await page.reload();
    await expect(page.getByText('Welcome to Chakra')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('welcome-gate.png', {
      maxDiffPixelRatio: 0.05,
      animations: 'disabled',
    });
  });
});
