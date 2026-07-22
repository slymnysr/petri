import { expect, test } from '@playwright/test';

/**
 * Yapay seçilim — kullanıcı seçici olabiliyor mu? Bir organizmayı ödüllendirmek
 * soyunu üretmeli, ayıklamak onu kaldırmalı.
 */

test('ödüllendir bir organizmanın soyunu üretir', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('petri.onboarded.v1', '1');
    } catch {
      /* yok */
    }
  });
  await page.goto('/');
  await page.waitForFunction(() => (globalThis as unknown as { world?: unknown }).world != null);

  // Bir organizma seç (doğrudan) ve paneli aç.
  await page.evaluate(() => {
    const g = globalThis as unknown as {
      world: { pool: { capacity: number; alive: Uint8Array; id: Uint32Array }; watchedId: number; step(): void };
      renderer: { highlightId: number };
    };
    for (let i = 0; i < 400; i++) g.world.step();
    for (let i = 0; i < g.world.pool.capacity; i++) {
      if (g.world.pool.alive[i] === 1) {
        g.world.watchedId = g.world.pool.id[i]!;
        g.renderer.highlightId = g.world.pool.id[i]!;
        break;
      }
    }
  });
  // Simülasyonu duraklat ki doğum sayacı yalnızca ödülden değişsin.
  await page.getByRole('button', { name: 'duraklat' }).click();

  const before = await page.evaluate(
    () => (globalThis as unknown as { world: { births: number } }).world.births,
  );

  await expect(page.locator('.select-reward')).toBeVisible();
  await page.locator('.select-reward').click();

  const after = await page.evaluate(
    () => (globalThis as unknown as { world: { births: number } }).world.births,
  );
  // Ödül birkaç yavru üretmeli → doğum sayacı artmalı.
  expect(after).toBeGreaterThan(before);
});

test('ayıkla seçili organizmayı kaldırır', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('petri.onboarded.v1', '1');
    } catch {
      /* yok */
    }
  });
  await page.goto('/');
  await page.waitForFunction(() => (globalThis as unknown as { world?: unknown }).world != null);

  const id = await page.evaluate(() => {
    const g = globalThis as unknown as {
      world: { pool: { capacity: number; alive: Uint8Array; id: Uint32Array }; watchedId: number; step(): void };
      renderer: { highlightId: number };
    };
    for (let i = 0; i < 400; i++) g.world.step();
    for (let i = 0; i < g.world.pool.capacity; i++) {
      if (g.world.pool.alive[i] === 1) {
        const wid = g.world.pool.id[i]!;
        g.world.watchedId = wid;
        g.renderer.highlightId = wid;
        return wid;
      }
    }
    return -1;
  });
  await page.getByRole('button', { name: 'duraklat' }).click();

  await expect(page.locator('.select-cull')).toBeVisible();
  await page.locator('.select-cull').click();

  // Ayıklanan organizma artık canlı olmamalı.
  const stillAlive = await page.evaluate(
    (wid) => (globalThis as unknown as { world: { indexOfId(id: number): number } }).world.indexOfId(wid) >= 0,
    id,
  );
  expect(stillAlive).toBe(false);
});
