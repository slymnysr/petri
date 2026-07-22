import { describe, expect, it } from 'vitest';
import { SpatialGrid } from '../src/sim/grid';
import { Rng } from '../src/sim/rng';

/**
 * Grid'in tek görevi kaba kuvvetle aynı cevabı vermek — sadece daha hızlı.
 * Bu testler o denkliği doğruluyor. Grid yanlış komşu döndürürse organizmalar
 * var olmayan yiyeceğe yönelir ve evrimin tamamı çöpe gider; bu yüzden burası
 * projenin en kritik testi.
 */

function bruteForceNearest(
  x: number,
  y: number,
  z: number,
  radius: number,
  exclude: number,
  xs: Float32Array,
  ys: Float32Array,
  zs: Float32Array,
  alive: Uint8Array | null,
  count: number,
): number {
  let best = -1;
  let bestD2 = radius * radius;
  for (let i = 0; i < count; i++) {
    if (i === exclude) continue;
    if (alive !== null && alive[i] === 0) continue;
    const dx = xs[i]! - x;
    const dy = ys[i]! - y;
    const dz = zs[i]! - z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}

/**
 * Not: dünya merkezi orijinde olduğu için koordinatlar artık [-W/2, W/2]
 * aralığında. Grid bu kaydırmayı içeride yapıyor; testler de merkezli
 * koordinat üretiyor ki gerçek kullanımı yansıtsın.
 */
describe('SpatialGrid (3B, merkezi koordinat)', () => {
  it('en yakın komşuda kaba kuvvetle birebir aynı sonucu verir', () => {
    const rng = new Rng(11);
    const W = 900;
    const H = 800;
    const D = 400;
    const N = 600;

    const xs = new Float32Array(N);
    const ys = new Float32Array(N);
    const zs = new Float32Array(N);
    const alive = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      xs[i] = rng.range(-W / 2, W / 2);
      ys[i] = rng.range(-H / 2, H / 2);
      zs[i] = rng.range(-D / 2, D / 2);
      alive[i] = rng.next() < 0.85 ? 1 : 0;
    }

    const grid = new SpatialGrid(W, H, D, 96, N);
    grid.build(N, xs, ys, zs, alive);

    const out = new Float32Array(1);
    // Çeşitli yarıçaplarla dene: hücre boyutundan küçük, eşit ve büyük.
    for (const radius of [30, 96, 200, 500]) {
      for (let trial = 0; trial < 150; trial++) {
        const qx = rng.range(-W / 2, W / 2);
        const qy = rng.range(-H / 2, H / 2);
        const qz = rng.range(-D / 2, D / 2);
        const expected = bruteForceNearest(qx, qy, qz, radius, -1, xs, ys, zs, alive, N);
        const actual = grid.findNearest(qx, qy, qz, radius, -1, xs, ys, zs, alive, out);
        expect(actual).toBe(expected);
      }
    }
  });

  it('negatif koordinatlarda da doğru çalışır', () => {
    // Merkezi sisteme geçişte en olası hata: negatif tarafın yanlış hücreye
    // düşmesi. Simetrik bir kurulumla bunu doğruluyoruz.
    const xs = new Float32Array([-300, 300]);
    const ys = new Float32Array([-300, 300]);
    const zs = new Float32Array([-100, 100]);
    const alive = new Uint8Array([1, 1]);
    const grid = new SpatialGrid(800, 800, 300, 96, 2);
    grid.build(2, xs, ys, zs, alive);

    const out = new Float32Array(1);
    expect(grid.findNearest(-300, -300, -100, 50, -1, xs, ys, zs, alive, out)).toBe(0);
    expect(grid.findNearest(300, 300, 100, 50, -1, xs, ys, zs, alive, out)).toBe(1);
    // Tam merkezden ikisi de menzil dışında
    expect(grid.findNearest(0, 0, 0, 100, -1, xs, ys, zs, alive, out)).toBe(-1);
  });

  it('dikey eksende ayrışan noktaları karıştırmaz', () => {
    // Aynı x,y'de farklı derinlikteki iki nokta: 2B grid bunları ayırt
    // edemezdi, 3B ayırmalı.
    const xs = new Float32Array([0, 0]);
    const ys = new Float32Array([0, 0]);
    const zs = new Float32Array([-180, 180]);
    const alive = new Uint8Array([1, 1]);
    const grid = new SpatialGrid(500, 500, 400, 96, 2);
    grid.build(2, xs, ys, zs, alive);

    const out = new Float32Array(1);
    expect(grid.findNearest(0, 0, -190, 60, -1, xs, ys, zs, alive, out)).toBe(0);
    expect(grid.findNearest(0, 0, 190, 60, -1, xs, ys, zs, alive, out)).toBe(1);
    // İkisinin de menzil dışında kaldığı orta nokta
    expect(grid.findNearest(0, 0, 0, 60, -1, xs, ys, zs, alive, out)).toBe(-1);
  });

  it('exclude edilen indeksi döndürmez', () => {
    const xs = new Float32Array([0, 5, 200]);
    const ys = new Float32Array([0, 0, 200]);
    const zs = new Float32Array([0, 0, 0]);
    const alive = new Uint8Array([1, 1, 1]);
    const grid = new SpatialGrid(500, 500, 200, 96, 3);
    grid.build(3, xs, ys, zs, alive);

    const out = new Float32Array(1);
    expect(grid.findNearest(0, 0, 0, 200, 0, xs, ys, zs, alive, out)).toBe(1);
  });

  it('ölü elemanları atlar', () => {
    const xs = new Float32Array([0, 5, 30]);
    const ys = new Float32Array([0, 0, 0]);
    const zs = new Float32Array([0, 0, 0]);
    const alive = new Uint8Array([1, 0, 1]); // 1 numaralı ölü
    const grid = new SpatialGrid(500, 500, 200, 96, 3);
    grid.build(3, xs, ys, zs, alive);

    const out = new Float32Array(1);
    expect(grid.findNearest(0, 0, 0, 200, 0, xs, ys, zs, alive, out)).toBe(2);
  });

  it('yarıçap dışında eleman varsa -1 döner', () => {
    const xs = new Float32Array([400]);
    const ys = new Float32Array([400]);
    const zs = new Float32Array([100]);
    const alive = new Uint8Array([1]);
    const grid = new SpatialGrid(1000, 1000, 300, 96, 1);
    grid.build(1, xs, ys, zs, alive);

    const out = new Float32Array(1);
    expect(grid.findNearest(-400, -400, -100, 50, -1, xs, ys, zs, alive, out)).toBe(-1);
  });

  it('yeniden kurulduğunda eski konumları unutur', () => {
    const xs = new Float32Array([-400]);
    const ys = new Float32Array([-400]);
    const zs = new Float32Array([-100]);
    const alive = new Uint8Array([1]);
    const grid = new SpatialGrid(1000, 1000, 300, 96, 1);
    grid.build(1, xs, ys, zs, alive);

    xs[0] = 400;
    ys[0] = 400;
    zs[0] = 100;
    grid.build(1, xs, ys, zs, alive);

    const out = new Float32Array(1);
    // Eski konumda artık kimse yok
    expect(grid.findNearest(-400, -400, -100, 100, -1, xs, ys, zs, alive, out)).toBe(-1);
    // Yeni konumda bulunuyor
    expect(grid.findNearest(400, 400, 100, 100, -1, xs, ys, zs, alive, out)).toBe(0);
  });
});
