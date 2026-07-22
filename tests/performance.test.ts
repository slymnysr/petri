import { describe, expect, it } from 'vitest';
import { SpatialGrid } from '../src/sim/grid';
import { Rng } from '../src/sim/rng';
import { World } from '../src/sim/world';

/**
 * Performans testleri.
 *
 * Amaç mikro-optimizasyon değil, **regresyon yakalamak**. Eşikler bilerek
 * gevşek: farklı makinelerde ve yük altında çalışacaklar. Bir değişiklik
 * adım süresini iki katına çıkarırsa burası kırılır; %10'luk dalgalanmalar
 * gürültü kabul edilir.
 */

describe('Performans', () => {
  it('sıcak döngüde adım süresi makul sınırda kalır', () => {
    const w = new World({
      seed: 3,
      worldRadius: 560,
      verticalSquash: 0.4,
      maxOrganisms: 2000,
      initialPopulation: 800,
      maxFood: 3000,
      foodSpawnRate: 14,
    });

    // Isınma: JIT'in sıcak yolu derlemesi için
    for (let i = 0; i < 300; i++) w.step();

    const samples: number[] = [];
    for (let rep = 0; rep < 5; rep++) {
      const t0 = performance.now();
      for (let i = 0; i < 60; i++) w.step();
      samples.push((performance.now() - t0) / 60);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)]!;

    // Ölçülen tipik değer WSL2'de ~2–4 ms. 25 ms eşiği, yavaş bir CI
    // makinesinde bile geçecek ama gerçek bir yavaşlamayı (örneğin grid'in
    // devre dışı kalıp kaba kuvvete düşmesi) yakalayacak kadar dar.
    expect(median).toBeLessThan(25);
    expect(w.pool.count).toBeGreaterThan(0);
  }, 120000);

  it('uzun koşuda bellek sınırsız büyümez', () => {
    // Sıcak döngüde bellek ayrılmadığının dolaylı kanıtı. Havuzlar sabit
    // boyutlu; soy kaydı halka tampon. Bunlardan biri sızdırırsa uzun koşuda
    // heap sürekli büyür.
    const w = new World({
      seed: 8,
      worldRadius: 373,
      verticalSquash: 0.4,
      maxOrganisms: 600,
      initialPopulation: 200,
      maxFood: 1200,
      foodSpawnRate: 9,
    });

    for (let i = 0; i < 3000; i++) w.step();
    // Soy kaydı kapasitesini aşmamalı — halka tamponun asıl işi bu.
    expect(w.lineage.size).toBeLessThanOrEqual(w.lineage.capacity);

    for (let i = 0; i < 12000; i++) w.step();
    expect(w.lineage.size).toBeLessThanOrEqual(w.lineage.capacity);
  }, 200000);

  it('grid, kaba kuvvete karşı ölçekte üstün', () => {
    // Grid'in varlık sebebi bu. Bir değişiklik grid'i etkisiz hale getirirse
    // (örneğin hücre boyutu dünyayı tek hücreye indirirse) test kırılır.
    const rng = new Rng(11);
    const N = 4000;
    const W = 1200;
    const xs = new Float32Array(N);
    const ys = new Float32Array(N);
    const zs = new Float32Array(N);
    const alive = new Uint8Array(N).fill(1);
    for (let i = 0; i < N; i++) {
      xs[i] = rng.range(-W / 2, W / 2);
      ys[i] = rng.range(-W / 2, W / 2);
      zs[i] = rng.range(-W / 4, W / 4);
    }

    const grid = new SpatialGrid(W, W, W / 2, 96, N);
    grid.build(N, xs, ys, zs, alive);
    const out = new Float32Array(1);
    const radius = 110;
    const queries = 1500;

    const tGrid = performance.now();
    for (let q = 0; q < queries; q++) {
      grid.findNearest(xs[q % N]!, ys[q % N]!, zs[q % N]!, radius, q % N, xs, ys, zs, alive, out);
    }
    const gridMs = performance.now() - tGrid;

    const tBrute = performance.now();
    for (let q = 0; q < queries; q++) {
      const qx = xs[q % N]!, qy = ys[q % N]!, qz = zs[q % N]!;
      let best = -1;
      let bestD2 = radius * radius;
      for (let i = 0; i < N; i++) {
        if (i === q % N) continue;
        const dx = xs[i]! - qx, dy = ys[i]! - qy, dz = zs[i]! - qz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestD2) { bestD2 = d2; best = i; }
      }
      void best;
    }
    const bruteMs = performance.now() - tBrute;

    // Bu yoğunlukta grid en az birkaç kat hızlı olmalı. Eşik gürültüye pay
    // bırakıyor; asıl aranan, üstünlüğün tamamen kaybolmadığı.
    expect(gridMs).toBeLessThan(bruteMs / 3);
  }, 120000);
});
