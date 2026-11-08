import { test, expect } from '@playwright/test';

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('chakra-onboarding-complete'));
    await page.reload();
    await expect(page.getByText('Welcome to Chakra')).toBeVisible({ timeout: 10_000 });
  });

  test('"I\'m new here" starts onboarding', async ({ page }) => {
    await page.getByText("I'm new here").click();

    // Welcome gate should dismiss
    await expect(page.getByText('Welcome to Chakra')).not.toBeVisible({ timeout: 3_000 });

    // Guru avatar should be visible (the bubble container)
    const avatar = page.locator('.rounded-full').first();
    await expect(avatar).toBeVisible({ timeout: 10_000 });

    // Skip tutorial link should appear
    await expect(page.getByText('Skip tutorial')).toBeVisible({ timeout: 10_000 });
  });

  test('"I know what I\'m doing" skips onboarding', async ({ page }) => {
    await page.getByText('I know what I\'m doing').click();

    // Welcome gate should dismiss
    await expect(page.getByText('Welcome to Chakra')).not.toBeVisible({ timeout: 3_000 });

    // localStorage should be set
    const completed = await page.evaluate(() =>
      localStorage.getItem('chakra-onboarding-complete')
    );
    expect(completed).toBe('true');

    // SIM indicator should be visible
    await expect(page.getByText('SIM', { exact: true }).first()).toBeVisible();
  });

  test('Skip tutorial link ends onboarding', async ({ page }) => {
    await page.getByText("I'm new here").click();

    // Wait for skip tutorial to appear
    const skipBtn = page.getByText('Skip tutorial');
    await expect(skipBtn).toBeVisible({ timeout: 10_000 });

    await skipBtn.click();

    // Onboarding should end — skip tutorial disappears
    await expect(skipBtn).not.toBeVisible({ timeout: 5_000 });

    // localStorage should be set
    const completed = await page.evaluate(() =>
      localStorage.getItem('chakra-onboarding-complete')
    );
    expect(completed).toBe('true');
  });
});
