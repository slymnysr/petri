import { expect, test } from '@playwright/test';
import { step, waitForApp } from './helpers';

/**
 * Etkileşim: tıklama, kamera ve deney panelinin gerçekten çalıştığını
 * doğrular. Bunların hiçbiri simülasyon mantığından geçmiyor — kod doğru olsa
 * bile DOM veya kamera tarafında sessizce bozulabilirler.
 */

test.beforeEach(async ({ page }) => {
  await waitForApp(page);
  // Tıklamayla seçilecek organizmaların oluşması için biraz ilerlet.
  await step(page, 400);
});

test('organizmaya tıklamak inceleme panelini açar', async ({ page }) => {
  // Bir organizmanın ekran konumunu kameradan hesaplayıp tam oraya tıklıyoruz;
  // rastgele tıklamak yerine bilinen bir hedef seçmek testi güvenilir kılıyor.
  const target = await page.evaluate(() => {
    const g = globalThis as unknown as {
      world: { pool: { capacity: number; alive: Uint8Array; x: Float32Array; y: Float32Array; z: Float32Array; id: Uint32Array } };
      camera: { project(x: number, y: number, z: number, w: number, h: number): { sx: number; sy: number } | null };
    };
    const canvas = document.getElementById('view') as HTMLCanvasElement;
    const pool = g.world.pool;
    // Kameraya en yakın, ekran merkezine yakın bir organizma seç (tıklama
    // toleransına rahat girsin).
    for (let i = 0; i < pool.capacity; i++) {
      if (pool.alive[i] === 0) continue;
      const p = g.camera.project(pool.x[i]!, pool.y[i]!, pool.z[i]!, canvas.width, canvas.height);
      if (!p) continue;
      const dpr = canvas.width / canvas.clientWidth;
      return { cssX: p.sx / dpr, cssY: p.sy / dpr, id: pool.id[i]! };
    }
    return null;
  });

  expect(target).not.toBeNull();

  const canvas = page.locator('#view');
  await canvas.click({ position: { x: target!.cssX, y: target!.cssY } });

  // Panel açılmalı ve bir organizma başlığı göstermeli.
  const inspector = page.locator('.inspector');
  await expect(inspector).toBeVisible();
  await expect(page.locator('.inspector-title')).toContainText('#');

  // Beyin diyagramı, karar satırı ve fenotip çubukları dolu gelmeli.
  expect(await page.locator('.brain-svg circle').count()).toBeGreaterThan(20);
  await expect(page.locator('.decision-line')).toBeVisible();
  expect(await page.locator('.inspector-traits .bar-row').count()).toBe(8);

  // Nöron rolleri: her gizli nöron bir satır — yorumlanabilirliğin derin katmanı.
  expect(await page.locator('.neuron-row').count()).toBe(10);
});

test('kapatma düğmesi seçimi bırakır', async ({ page }) => {
  // Doğrudan seçim kur, sonra kapat.
  await page.evaluate(() => {
    const g = globalThis as unknown as {
      world: { pool: { capacity: number; alive: Uint8Array; id: Uint32Array }; watchedId: number };
      renderer: { highlightId: number };
    };
    for (let i = 0; i < g.world.pool.capacity; i++) {
      if (g.world.pool.alive[i] === 1) {
        g.world.watchedId = g.world.pool.id[i]!;
        g.renderer.highlightId = g.world.pool.id[i]!;
        break;
      }
    }
  });
  await page.waitForTimeout(150);
  await expect(page.locator('.inspector')).toBeVisible();

  await page.locator('.inspector-close').click();
  await expect(page.locator('.inspector')).toBeHidden();
});

test('fare tekerleği kamerayı yakınlaştırır', async ({ page }) => {
  const before = await page.evaluate(
    () => (globalThis as unknown as { camera: { distance: number } }).camera.distance,
  );

  const canvas = page.locator('#view');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -600); // yukarı = yakınlaş

  const after = await page.evaluate(
    () => (globalThis as unknown as { camera: { distance: number } }).camera.distance,
  );
  expect(after).toBeLessThan(before);
});

test('sürüklemek kamerayı döndürür, tıklamayı tetiklemez', async ({ page }) => {
  const before = await page.evaluate(
    () => (globalThis as unknown as { camera: { azimuth: number } }).camera.azimuth,
  );

  const canvas = page.locator('#view');
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy, { steps: 8 });
  await page.mouse.up();

  const after = await page.evaluate(() => {
    const g = globalThis as unknown as { camera: { azimuth: number }; world: { watchedId: number } };
    return { azimuth: g.camera.azimuth, watchedId: g.world.watchedId };
  });

  // Yörünge açısı değişmeli
  expect(after.azimuth).not.toBeCloseTo(before, 4);
  // Ama sürükleme tıklama sayılmamalı: seçim açılmamış olmalı
  expect(after.watchedId).toBe(-1);
});

test('kaydırıcı config parametresini değiştirir', async ({ page }) => {
  const before = await page.evaluate(
    () => (globalThis as unknown as { world: { config: { foodSpawnRate: number } } }).world.config.foodSpawnRate,
  );

  // İlk kaydırıcı yiyecek üretimi. Değerini uçlardan birine çek.
  const slider = page.locator('.slider-row input[type="range"]').first();
  await slider.focus();
  // Klavye ile birkaç adım artır — sürükleme koordinatı hesaplamaktan güvenilir.
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');

  const after = await page.evaluate(
    () => (globalThis as unknown as { world: { config: { foodSpawnRate: number } } }).world.config.foodSpawnRate,
  );
  expect(after).not.toBe(before);
});

test('duraklat düğmesi simülasyonu durdurur ve devam ettirir', async ({ page }) => {
  // Not: rAF headless tarayıcıda kısılabildiği için sabit süre beklemek yerine
  // hem deterministik `paused` bayrağını hem de tick ilerlemesini bekliyoruz.
  const readPaused = () =>
    page.evaluate(() => (globalThis as unknown as { controls: { paused: boolean } }).controls.paused);
  const readTick = () =>
    page.evaluate(() => (globalThis as unknown as { world: { tick: number } }).world.tick);

  await page.getByRole('button', { name: 'duraklat' }).click();
  expect(await readPaused()).toBe(true);

  // Duraklatılmışken tick donmalı.
  const t1 = await readTick();
  await page.waitForTimeout(400);
  expect(await readTick()).toBe(t1);

  // Devam düğmesi bayrağı çevirmeli ve tick yeniden ilerlemeli.
  await page.getByRole('button', { name: 'devam' }).click();
  expect(await readPaused()).toBe(false);
  await page.waitForFunction(
    (frozen) => (globalThis as unknown as { world: { tick: number } }).world.tick > frozen,
    t1,
    { timeout: 10_000 },
  );
});

test('yeni dünya düğmesi simülasyonu sıfırlar', async ({ page }) => {
  await step(page, 2000);
  const before = await page.evaluate(
    () => (globalThis as unknown as { world: { tick: number } }).world.tick,
  );
  expect(before).toBeGreaterThan(1000);

  await page.getByRole('button', { name: 'yeni dünya' }).click();

  const after = await page.evaluate(
    () => (globalThis as unknown as { world: { tick: number } }).world.tick,
  );
  // Sıfırlanmış olmalı (birkaç kare geçmiş olabilir ama binlerin altında)
  expect(after).toBeLessThan(before);
});

test('dar ekranda sayfa yatay taşmaz', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 800 });
  await page.waitForTimeout(200);

  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });
  expect(overflow).toBe(false);
});
