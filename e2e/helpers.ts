import type { Page } from '@playwright/test';

/**
 * Uygulama main.ts sonunda simülasyon nesnelerini globalThis'e bağlıyor
 * (world, camera, renderer, inspector, controls). E2e testleri bu nesneler
 * üzerinden hem simülasyonu ilerletebiliyor hem durumunu okuyabiliyor —
 * gerçek kullanıcının yapamayacağı ama testin doğrulama için ihtiyaç duyduğu
 * bir pencere.
 */

/**
 * Sayfa yüklenip WebGL bağlamı ve global nesneler hazır olana kadar bekler.
 *
 * Açılış rehberini "görülmüş" işaretliyoruz: ilk ziyarette modal ekranı kaplayıp
 * tıklamaları engelliyor. Etkileşim testleri canlıya/düğmeye tıkladığı için
 * rehber ortadan kalkmalı. (Rehberin kendi testleri bu yardımcıyı kullanmaz,
 * bayrağı kendileri yönetir.) addInitScript goto'dan ÖNCE çağrılmalı.
 */
export async function waitForApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('petri.onboarded.v1', '1');
    } catch {
      /* erişilemezse zaten gösterilmez */
    }
  });
  await page.goto('/');
  await page.waitForFunction(() => {
    const g = globalThis as unknown as { world?: unknown; renderer?: unknown };
    return g.world != null && g.renderer != null;
  }, { timeout: 30_000 });
}

/** Simülasyonu verilen adım kadar ilerletir (kare hızından bağımsız). */
export async function step(page: Page, n: number): Promise<void> {
  await page.evaluate((count) => {
    const g = globalThis as unknown as { world: { step(): void } };
    for (let i = 0; i < count; i++) g.world.step();
  }, n);
}

/** Arka plan dışı piksel sayısı — canvas'ın gerçekten çizip çizmediğinin ölçütü. */
export async function countDrawnPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const g = globalThis as unknown as {
      world: unknown;
      camera: unknown;
      renderer: { draw(w: unknown, c: unknown): void };
    };
    const canvas = document.getElementById('view') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2')!;
    g.renderer.draw(g.world, g.camera);
    const px = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let n = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i]! > 25 || px[i + 1]! > 30 || px[i + 2]! > 35) n++;
    }
    return n;
  });
}
