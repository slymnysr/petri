import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';

describe('Rng', () => {
  it('aynı tohum aynı diziyi üretir', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('farklı tohum farklı dizi üretir', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() [0,1) aralığında kalır', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('gauss() ortalama ~0, standart sapma ~1 verir', () => {
    const rng = new Rng(3);
    const n = 50000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const v = rng.gauss();
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / n;
    const std = Math.sqrt(sumSq / n - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(std - 1)).toBeLessThan(0.03);
  });

  it('durum kaydedip geri yüklemek diziyi tekrarlatır', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 10; i++) rng.next();
    const saved = rng.getState();
    const after = Array.from({ length: 20 }, () => rng.next());

    rng.setState(saved);
    const replay = Array.from({ length: 20 }, () => rng.next());
    expect(replay).toEqual(after);
  });
});
