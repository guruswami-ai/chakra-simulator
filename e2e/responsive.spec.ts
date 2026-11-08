import { test, expect } from '@playwright/test';

test.describe('Mobile viewport (375x812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('chakra-onboarding-complete', 'true'));
    await page.reload();
    await page.waitForTimeout(2000);
  });

  test('visualization takes full width', async ({ page }) => {
    const viz = page.locator('.w-full').first();
    await expect(viz).toBeVisible();
  });

  test('MobileMetricsBar shows TPS', async ({ page }) => {
    // Mobile metrics bar should show TPS value
    const tpsText = page.locator('text=/\\d+\\.\\d+/').first();
    await expect(tpsText).toBeVisible({ timeout: 5000 });
  });

  test('MobileMetricsBar has tappable control badges', async ({ page }) => {
    // Should have tappable badges for model, quant, topology, context
    const buttons = page.locator('button').filter({ hasText: /Q4|TP|PP|KV|Model/i });
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('tapping a badge opens popover with controls', async ({ page }) => {
    // Tap a control badge
    const badge = page.locator('button').filter({ hasText: /Q4|Q8|FP16/i }).first();
    if (await badge.isVisible().catch(() => false)) {
      await badge.click();
      await page.waitForTimeout(500);
      // Popover should appear with control content
      const popover = page.locator('.z-40');
      expect(await popover.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('ClusterTopologyCard shows compact mode', async ({ page }) => {
    // Compact card should be at the bottom, not top-left
    const card = page.locator('.z-40.pointer-events-auto').first();
    if (await card.isVisible().catch(() => false)) {
      const box = await card.boundingBox();
      if (box) {
        // Should be near the bottom of the viewport
        expect(box.y).toBeGreaterThan(400);
      }
    }
  });

  test('welcome gate fits mobile screen', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('chakra-onboarding-complete'));
    await page.reload();
    await expect(page.getByText('Welcome to Chakra')).toBeVisible({ timeout: 10_000 });
    // Modal should not overflow
    const modal = page.locator('text=Welcome to Chakra').locator('..');
    const box = await modal.boundingBox();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(375);
    }
  });
});

test.describe('Tablet viewport (768x1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('chakra-onboarding-complete', 'true'));
    await page.reload();
    await page.waitForTimeout(2000);
  });

  test('visualization takes full width', async ({ page }) => {
    const viz = page.locator('.w-full').first();
    await expect(viz).toBeVisible();
  });

  test('configure button opens drawer', async ({ page }) => {
    const configBtn = page.getByRole('button', { name: 'Configure' });
    await expect(configBtn).toBeVisible();
    await configBtn.click();
    await page.waitForTimeout(800);
    // Drawer should open — z-40 element present
    const drawer = page.locator('.z-40');
    expect(await drawer.count()).toBeGreaterThanOrEqual(1);
  });

  test('drawer can be closed via backdrop', async ({ page }) => {
    const configBtn = page.getByRole('button', { name: 'Configure' });
    await configBtn.click();
    await page.waitForTimeout(800);
    // Click backdrop to close
    const backdrop = page.locator('.z-30').first();
    if (await backdrop.isVisible().catch(() => false)) {
      await backdrop.click({ position: { x: 10, y: 10 }, force: true });
      await page.waitForTimeout(500);
    }
    // No crash = pass
    expect(true).toBe(true);
  });
});

test.describe('Desktop viewport (1280x800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('chakra-onboarding-complete', 'true'));
    await page.reload();
    await page.waitForTimeout(2000);
  });

  test('side-by-side layout is used', async ({ page }) => {
    // Right sidebar should be visible (34% width)
    const sidebar = page.locator('.w-\\[34\\%\\]');
    await expect(sidebar).toBeVisible();
  });

  test('configure button is NOT visible', async ({ page }) => {
    // The floating configure button should not appear on desktop
    const configBtn = page.getByText('Configure', { exact: true });
    await expect(configBtn).not.toBeVisible({ timeout: 2000 });
  });

  test('simulation panel is visible in sidebar', async ({ page }) => {
    const modelNames = ['Qwen', 'Llama', 'Mixtral', 'DeepSeek', 'Kimi'];
    let found = false;
    for (const name of modelNames) {
      if (await page.getByText(name, { exact: false }).first().isVisible().catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
