import { test, expect } from '@playwright/test';

test.describe('Guru animation flow', () => {
  test('full lifecycle: appear → wave → idle with logs', async ({ page }) => {
    // Collect console logs
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[guru]')) logs.push(msg.text());
    });

    // Fresh start
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('chakra-onboarding-complete'));
    await page.reload();

    // Wait for welcome gate
    await expect(page.getByText('Welcome to Chakra')).toBeVisible({ timeout: 10_000 });

    // Click "I know what I'm doing" to skip onboarding but trigger guru
    await page.getByText("I know what I'm doing").click();
    await page.waitForTimeout(1000);

    // Check if animation library loaded
    const libLoaded = logs.some(l => l.includes('Libraries loaded'));
    console.log('Library loaded:', libLoaded);
    console.log('All guru logs:', JSON.stringify(logs, null, 2));

    // Wait for guru to go through states
    await page.waitForTimeout(8000);

    // Check video state
    const videoState = await page.evaluate(() => {
      const videos = document.querySelectorAll('video');
      return Array.from(videos).map(v => ({
        src: v.src,
        paused: v.paused,
        ended: v.ended,
        currentTime: v.currentTime,
        duration: v.duration,
        readyState: v.readyState,
        loop: v.loop,
        className: v.className,
      }));
    });
    console.log('Video elements:', JSON.stringify(videoState, null, 2));

    // Check guru state label
    const stateLabels = await page.locator('text=/Materializing|Namaste|Contemplating|Listening|Dissolving|Awaiting/').all();
    const visibleLabels = [];
    for (const label of stateLabels) {
      if (await label.isVisible().catch(() => false)) {
        visibleLabels.push(await label.textContent());
      }
    }
    console.log('Visible state labels:', visibleLabels);

    // Verify guru progressed past APPEARING
    const stuckAtMaterializing = visibleLabels.includes('Materializing...');
    console.log('Stuck at Materializing:', stuckAtMaterializing);

    // Print all logs for debugging
    console.log('\n=== FULL GURU LOGS ===');
    logs.forEach(l => console.log(l));

    // The guru should NOT still be showing "Materializing" after 8 seconds
    // (safety timer fires at 5s)
    expect(stuckAtMaterializing).toBe(false);
  });

  test('video files are playable', async ({ page }) => {
    await page.goto('/');

    // Try to play an appear video directly
    const canPlay = await page.evaluate(async () => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = '/guruswami/video/gs_appear_1.mp4';

      return new Promise<{ canPlay: boolean; duration: number; error: string | null }>((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(() => {
            resolve({ canPlay: true, duration: video.duration, error: null });
          }).catch(e => {
            resolve({ canPlay: false, duration: video.duration, error: e.message });
          });
        };
        video.onerror = () => resolve({ canPlay: false, duration: 0, error: 'load error' });
        setTimeout(() => resolve({ canPlay: false, duration: 0, error: 'timeout' }), 5000);
      });
    });

    console.log('Video playback test:', canPlay);
    expect(canPlay.canPlay).toBe(true);
    expect(canPlay.duration).toBeGreaterThan(0);
  });

  test('voice files are playable', async ({ page }) => {
    await page.goto('/');

    // Click to unlock audio
    await page.click('body');
    await page.waitForTimeout(500);

    // Try to play a greeting voice clip
    const canPlay = await page.evaluate(async () => {
      const audio = new Audio();
      audio.volume = 0;

      // First, get a real voice file from the library
      const lib = await fetch('/guruswami/voice-library.json').then(r => r.json());
      const greetingFiles = lib['greeting'] || [];
      if (greetingFiles.length === 0) return { canPlay: false, error: 'no greeting files' };

      const src = `/guruswami/voice/greeting/${greetingFiles[0]}`;
      audio.src = src;

      return new Promise<{ canPlay: boolean; duration: number; src: string; error: string | null }>((resolve) => {
        audio.onloadedmetadata = () => {
          audio.play().then(() => {
            resolve({ canPlay: true, duration: audio.duration, src, error: null });
            audio.pause();
          }).catch(e => {
            resolve({ canPlay: false, duration: audio.duration, src, error: e.message });
          });
        };
        audio.onerror = () => resolve({ canPlay: false, duration: 0, src, error: 'load error' });
        setTimeout(() => resolve({ canPlay: false, duration: 0, src, error: 'timeout' }), 5000);
      });
    });

    console.log('Voice playback test:', canPlay);
    expect(canPlay.canPlay).toBe(true);
  });
});
