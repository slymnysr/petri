import { expect, test } from '@playwright/test';

/**
 * Hipotez test paneli — kullanıcı bir iddiayı sınayabiliyor mu, ve araç gerçek
 * bir sonuç (tuttu/tutmadı) verebiliyor mu?
 *
 * Deney koşusu gerçek simülasyonlar içerdiği için yavaş; bu yüzden test süresi
 * uzatıldı. Amaç hız değil, "bu ne işe yarar"ın kanıtı: araç bir hipotezi
 * ölçüp karara varabiliyor.
 */

test('hipotez paneli bir iddiayı test edip sonuç veriyor', async ({ page }) => {
  test.setTimeout(220_000);

  await page.addInitScript(() => {
    try {
      localStorage.setItem('petri.onboarded.v1', '1');
    } catch {
      /* yok */
    }
  });
  await page.goto('/');
  await page.waitForFunction(() => (globalThis as unknown as { world?: unknown }).world != null);

  // Ana simülasyonu duraklat ki deney için CPU boşalsın (koşu hızlansın).
  await page.getByRole('button', { name: 'duraklat' }).click();

  await page.locator('.experiment-button').click();
  await expect(page.locator('.experiment-overlay')).toBeVisible();

  // Hipotezler listelenmiş olmalı.
  expect(await page.locator('.experiment-select option').count()).toBeGreaterThanOrEqual(3);

  // "Yiyecek kesilince popülasyon söner" — tutması beklenen sağlam iddia.
  // (Bilerek bu seçildi: müdahale dünyası hızla boşaldığı için deney çabuk
  // biter. "Bol yiyecek" hipotezi nüfusu tavana patlattığından çok daha yavaş.)
  await page.locator('.experiment-select').selectOption('kitlik-sonme');
  await page.getByRole('button', { name: 'test et' }).click();

  // Deney bitince bir karar görünmeli (uzun sürebilir).
  await expect(page.locator('.experiment-verdict')).toBeVisible({ timeout: 190_000 });
  await expect(page.locator('.experiment-verdict')).toContainText('tuttu');

  // Ölçüt satırları dolu gelmeli.
  expect(await page.locator('.experiment-row').count()).toBeGreaterThanOrEqual(4);
});

test('“yüksek mutasyon nüfusu artırır” hipotezi tutmuyor — araç bunu söyleyebilmeli', async ({ page }) => {
  test.setTimeout(220_000);

  await page.addInitScript(() => {
    try {
      localStorage.setItem('petri.onboarded.v1', '1');
    } catch {
      /* yok */
    }
  });
  await page.goto('/');
  await page.waitForFunction(() => (globalThis as unknown as { world?: unknown }).world != null);
  await page.getByRole('button', { name: 'duraklat' }).click();

  await page.locator('.experiment-button').click();
  await page.locator('.experiment-select').selectOption('yuksek-mutasyon');
  await page.getByRole('button', { name: 'test et' }).click();

  // "Çeşitlilik iyidir" sezgisine rağmen aşırı mutasyon genomları bozuyor ve
  // nüfusu düşürüyor. Aracın "tutmadı" diyebilmesi, gerçek bir test olduğunun
  // — kurgu olmadığının — kanıtı.
  await expect(page.locator('.experiment-verdict')).toBeVisible({ timeout: 190_000 });
  await expect(page.locator('.experiment-verdict')).toContainText('tutmadı');
});
