import { expect, test } from '@playwright/test';
import { countDrawnPixels, step, waitForApp } from './helpers';

/**
 * Render katmanı: WebGL'in gerçekten çizdiğini doğrular. Birim testler
 * `mat4.test.ts` ile izdüşüm matematiğini kontrol ediyor ama gerçek bir GL
 * bağlamının kurulup piksel ürettiğini yalnızca tarayıcıda görebiliriz.
 */

test.beforeEach(async ({ page }) => {
  await waitForApp(page);
});

test('sayfa konsol hatası olmadan açılır', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('favicon')) {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await step(page, 100);
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});

test('WebGL2 bağlamı kurulur ve kaybolmaz', async ({ page }) => {
  const state = await page.evaluate(() => {
    const canvas = document.getElementById('view') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2');
    const g = globalThis as unknown as { renderer: { contextLost: boolean } };
    return {
      hasContext: gl != null,
      contextLost: g.renderer.contextLost,
      glError: gl ? gl.getError() : -1,
    };
  });
  expect(state.hasContext).toBe(true);
  expect(state.contextLost).toBe(false);
  expect(state.glError).toBe(0);
});

test('canvas boş dünyada bile sınır kafesini çizer', async ({ page }) => {
  // Popülasyon henüz ısınmadan da elipsoid teli görünmeli: derinlik algısının
  // dayanağı bu, olmadan organizmalar boşlukta yüzüyormuş gibi görünür.
  const pixels = await countDrawnPixels(page);
  expect(pixels).toBeGreaterThan(500);
});

test('popülasyon ilerledikçe daha çok piksel çizilir', async ({ page }) => {
  const before = await countDrawnPixels(page);
  await step(page, 1500);
  const after = await countDrawnPixels(page);
  // Organizmalar çoğaldıkça ve yiyecek biriktikçe çizim yoğunlaşmalı.
  expect(after).toBeGreaterThan(before);
});

test('çizilen instance sayısı canlı nüfus + yiyecekle tutarlı', async ({ page }) => {
  await step(page, 1000);
  const data = await page.evaluate(() => {
    const g = globalThis as unknown as {
      world: { pool: { count: number }; food: { count: number }; getStats(): unknown };
      camera: unknown;
      renderer: { draw(w: unknown, c: unknown): void; drawn: number };
    };
    g.renderer.draw(g.world, g.camera);
    return {
      drawn: g.renderer.drawn,
      organisms: g.world.pool.count,
      food: g.world.food.count,
    };
  });
  // Çizilenler = organizmalar + yiyecek (+ olası seçim halkası). Tam eşitlik
  // değil ama toplam bu ikisini geçmemeli ve makul yakın olmalı.
  expect(data.drawn).toBeLessThanOrEqual(data.organisms + data.food + 1);
  expect(data.drawn).toBeGreaterThan(0);
});
