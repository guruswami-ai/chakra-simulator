import { test, expect } from '@playwright/test';

test.describe('App loads', () => {
  test('renders without crashing', async ({ page }) => {
    await page.goto('/');
    // App root should mount
    await expect(page.locator('#root')).toBeAttached();
    // Should have content (not blank)
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });

  test('displays welcome gate on first visit', async ({ page }) => {
    // Clear onboarding state
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('chakra-onboarding-complete'));
    await page.reload();

    // Welcome gate should appear
    await expect(page.getByText('Welcome to Chakra')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("I'm new here")).toBeVisible();
    await expect(page.getByText('I know what I\'m doing')).toBeVisible();
  });

  test('skips welcome gate when onboarding is complete', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('chakra-onboarding-complete', 'true'));
    await page.reload();

    // Welcome gate should NOT appear
    await expect(page.getByText('Welcome to Chakra')).not.toBeVisible({ timeout: 3_000 });
    // SIM indicator should be visible in TopBar
    await expect(page.getByText('SIM', { exact: true }).first()).toBeVisible();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('chakra-onboarding-complete', 'true'));
    await page.reload();
    await page.waitForTimeout(2000);

    // Filter out known non-critical errors (e.g., audio autoplay, WebSocket)
    const criticalErrors = errors.filter(e =>
      !e.includes('autoplay') &&
      !e.includes('socket') &&
      !e.includes('net::ERR') &&
      !e.includes('favicon') &&
      !e.includes('WebGL') &&
      !e.includes('WEBGL') &&
      !e.includes('GPU') &&
      !e.includes('404') &&
      !e.includes('cannot be a descendant') && // Known: ConceptHelper <button> inside <button>
      !e.includes('cannot contain a nested') && // Known: same nesting issue
      !e.includes('empty string') // Known: video src="" before library loads
    );
    expect(criticalErrors).toEqual([]);
  });

  test('MandalaShader canvas renders', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('chakra-onboarding-complete', 'true'));
    await page.reload();
    await page.waitForTimeout(1000);

    // WebGL canvas should exist (MandalaShader renders one)
    const canvas = page.locator('canvas');
    const count = await canvas.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
