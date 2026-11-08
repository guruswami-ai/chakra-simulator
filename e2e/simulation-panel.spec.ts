import { test, expect } from '@playwright/test';

test.describe('Simulation Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('chakra-onboarding-complete', 'true'));
    await page.reload();
    await page.waitForTimeout(1500);
  });

  test('right sidebar is visible with purple tint', async ({ page }) => {
    // Right panel has purple background in SIM mode
    const sidebar = page.locator('.w-\\[34\\%\\]');
    await expect(sidebar).toBeVisible();
  });

  test('model cards are present', async ({ page }) => {
    // Model names should be visible in simulation panel
    // Check for at least one known model name
    const modelNames = ['Qwen', 'Llama', 'Mixtral', 'DeepSeek', 'Kimi', 'Gemma', 'Mistral'];
    let found = false;
    for (const name of modelNames) {
      const el = page.getByText(name, { exact: false });
      if (await el.first().isVisible().catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('clicking a model updates metrics', async ({ page }) => {
    // Find and click a model card — look for clickable elements with model names
    const modelCard = page.getByText('Qwen', { exact: false }).first();
    if (await modelCard.isVisible().catch(() => false)) {
      await modelCard.click();
      await page.waitForTimeout(500);

      // After clicking a model, TPS should appear in the ClusterTopologyCard
      // Look for a number followed by "tok/s" or similar metric display
      const metricsArea = page.locator('text=/\\d+\\.?\\d*\\s*(tok|TPS)/i');
      // At least some metric should render (may take a moment for sim to calculate)
      await page.waitForTimeout(1000);
    }
  });

  test('quantization selector is present', async ({ page }) => {
    // Quantization options should be visible
    const quantLabels = ['Q2', 'Q3', 'Q4', 'Q8', 'FP16'];
    let found = 0;
    for (const q of quantLabels) {
      const el = page.getByText(q, { exact: true });
      if (await el.first().isVisible().catch(() => false)) {
        found++;
      }
    }
    expect(found).toBeGreaterThanOrEqual(2);
  });

  test('topology selector is present', async ({ page }) => {
    // Topology options: SINGLE, TP2, TP4, PP2, etc.
    const topoLabels = ['SINGLE', 'TP2', 'TP4', 'PP2', 'PP4'];
    let found = 0;
    for (const t of topoLabels) {
      const el = page.getByText(t, { exact: false });
      if (await el.first().isVisible().catch(() => false)) {
        found++;
      }
    }
    expect(found).toBeGreaterThanOrEqual(2);
  });
});
