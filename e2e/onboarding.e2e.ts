import { expect, test } from '@playwright/test';

/**
 * Açılış rehberi ve senaryo paneli — demoyu araca çeviren katman.
 *
 * Bu testlerin varlık sebebi doğrudan projenin amacı: bir yabancı açtığında
 * ne yapacağını anlayabilmeli. Rehber görünmüyor ya da senaryo yüklenmiyorsa,
 * "bu ne işe yarar" sorusunun cevabı da yok demektir.
 */

test('ilk ziyarette açılış rehberi görünür ve tamamlanabilir', async ({ page }) => {
  // İlk ziyaret: localStorage temiz olmalı. Sayfa yüklenmeden önce temizliyoruz.
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('petri.onboarded.v1');
    } catch {
      /* erişilemezse zaten gösterilmez */
    }
  });
  await page.goto('/');

  const overlay = page.locator('.onboard-overlay');
  await expect(overlay).toBeVisible();
  await expect(page.locator('.onboard-title')).toContainText('Ne bakıyorsun?');

  // İlk adımda "geri" gizli olmalı.
  await expect(overlay.locator('.onboard-btn.ghost')).toBeHidden();

  // Sona kadar ilerle. (Seçici overlay'e sınırlı: `onboard-btn` class'ı başka
  // panellerde de kullanılıyor, ayrım için kapsam gerekli.)
  const next = overlay.locator('.onboard-btn:not(.ghost)');
  await next.click(); // → adım 2
  await next.click(); // → adım 3
  await next.click(); // → adım 4
  await expect(page.locator('.onboard-title')).toContainText('neden önemli');

  // "başla" kapatır.
  await next.click();
  await expect(overlay).toBeHidden();

  // Kararı hatırlamalı.
  const seen = await page.evaluate(() => localStorage.getItem('petri.onboarded.v1'));
  expect(seen).toBe('1');
});

test('rehberi görmüş kullanıcıya tekrar gösterilmez, ? düğmesi çağırır', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('petri.onboarded.v1', '1');
    } catch {
      /* yok */
    }
  });
  await page.goto('/');

  // Görülmüş kabul edildiği için açılışta gizli olmalı.
  await expect(page.locator('.onboard-overlay')).toBeHidden();

  // "?" düğmesi rehberi geri getirir.
  await page.locator('.help-button').click();
  await expect(page.locator('.onboard-overlay')).toBeVisible();

  // Atla da kapatır.
  await page.locator('.onboard-skip').click();
  await expect(page.locator('.onboard-overlay')).toBeHidden();
});

test('bulgular paneli açılıp tutan/tutmayan bulguları gösterir', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('petri.onboarded.v1', '1');
    } catch {
      /* yok */
    }
  });
  await page.goto('/');
  await page.waitForFunction(() => (globalThis as unknown as { world?: unknown }).world != null);

  // Analiz uygulamadan erişilebilir olmalı — "bu ne işe yarar"ın kanıtı burada.
  await page.locator('.findings-button').click();
  const overlay = page.locator('.findings-overlay');
  await expect(overlay).toBeVisible();

  // Dürüstlük duruşu görünür olmalı: hem tutan hem tutmayan bulgular.
  await expect(page.locator('.findings-group-heading', { hasText: 'Tutan bulgular' })).toBeVisible();
  await expect(page.locator('.findings-group-heading', { hasText: 'Tutmayan bulgular' })).toBeVisible();
  expect(await page.locator('.finding').count()).toBeGreaterThanOrEqual(6);

  // Kapat düğmesi kapsam içinde: `findings-close` deney panelinde de kullanılıyor.
  await overlay.locator('.findings-close').click();
  await expect(overlay).toBeHidden();
});

test('senaryo seçmek dünyayı sıfırlar ve anlatıyı gösterir', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('petri.onboarded.v1', '1');
    } catch {
      /* yok */
    }
  });
  await page.goto('/');
  await page.waitForFunction(() => (globalThis as unknown as { world?: unknown }).world != null);

  // Simülasyonu biraz ilerlet ki sıfırlama görünür olsun.
  await page.evaluate(() => {
    const g = globalThis as unknown as { world: { step(): void } };
    for (let i = 0; i < 1500; i++) g.world.step();
  });
  const before = await page.evaluate(
    () => (globalThis as unknown as { world: { tick: number } }).world.tick,
  );
  expect(before).toBeGreaterThan(1000);

  // "mutasyonu kapat" senaryosunu seç.
  await page.locator('.scenario-select').selectOption('mutasyon-kapali');

  // Anlatı belirmeli ve dersi göstermeli.
  await expect(page.locator('.scenario-narrative')).toBeVisible();
  await expect(page.locator('.scenario-lesson')).toContainText('mutasyon', { ignoreCase: true });

  // Dünya sıfırlanmış ve senaryonun config'i uygulanmış olmalı.
  const after = await page.evaluate(() => {
    const g = globalThis as unknown as { world: { tick: number; config: { mutationRateScale: number } } };
    return { tick: g.world.tick, mutationRateScale: g.world.config.mutationRateScale };
  });
  expect(after.tick).toBeLessThan(before);
  expect(after.mutationRateScale).toBe(0);
});
