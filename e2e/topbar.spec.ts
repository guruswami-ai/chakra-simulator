import { test, expect } from '@playwright/test';

test.describe('TopBar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('chakra-onboarding-complete', 'true'));
    await page.reload();
    await page.waitForTimeout(1000);
  });

  test('SIM mode indicator is visible', async ({ page }) => {
    await expect(page.getByText('SIM', { exact: true }).first()).toBeVisible();
  });

  test('LIVE mode indicator is NOT visible', async ({ page }) => {
    await expect(page.getByText('LIVE')).not.toBeVisible();
  });

  test('Codex button opens help panel', async ({ page }) => {
    const codexBtn = page.locator('button[title="Guruswami Codex"]');
    await expect(codexBtn).toBeVisible();
    await codexBtn.click();

    // CodexPanel should appear
    await expect(page.getByText('Codex')).toBeVisible({ timeout: 5_000 });
  });

  test('Tutorial restart button is visible', async ({ page }) => {
    const tutorialBtn = page.locator('button[title="Restart tutorial"]');
    await expect(tutorialBtn).toBeVisible();
  });

  test('Tutorial restart button reloads into onboarding', async ({ page }) => {
    const tutorialBtn = page.locator('button[title="Restart tutorial"]');
    await tutorialBtn.click();

    // Page reloads — wait for welcome gate
    await expect(page.getByText('Welcome to Chakra')).toBeVisible({ timeout: 10_000 });
  });

  test('Speech toggle works', async ({ page }) => {
    // Find the speech/volume button
    const speechBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(3);
    // Click it — should toggle without error
    await speechBtn.click();
    // No crash = pass
  });

  test('Music controls are present', async ({ page }) => {
    // Music toggle, skip forward, skip back, shuffle should exist
    // They're small icon buttons in the TopBar
    const buttons = page.locator('header button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
