import { describe, expect, it } from 'vitest';
import { OrganismPool, expand } from '../src/sim/pool';
import { TRAIT_OFFSET, TRAIT_RANGES, Trait } from '../src/sim/types';

describe('OrganismPool', () => {
  it('kapasiteye kadar yer verir, sonra -1 döner', () => {
    const pool = new OrganismPool(4);
    const indices = [0, 1, 2, 3].map(() => pool.allocate(0, 0, 0));
    expect(indices.every((i) => i >= 0)).toBe(true);
    expect(new Set(indices).size).toBe(4); // hepsi farklı yuva
    expect(pool.allocate(0, 0, 0)).toBe(-1);
    expect(pool.count).toBe(4);
  });

  it('serbest bırakılan yuva yeniden kullanılır', () => {
    const pool = new OrganismPool(2);
    const a = pool.allocate(0, 0, 0);
    pool.allocate(0, 0, 0);
    expect(pool.allocate(0, 0, 0)).toBe(-1);

    pool.free(a);
    expect(pool.count).toBe(1);
    const reused = pool.allocate(0, 0, 0);
    expect(reused).toBe(a);
    expect(pool.count).toBe(2);
  });

  it('aynı yuvayı iki kez serbest bırakmak sayacı bozmaz', () => {
    const pool = new OrganismPool(3);
    const a = pool.allocate(0, 0, 0);
    pool.free(a);
    pool.free(a);
    expect(pool.count).toBe(0);
    // Havuz hâlâ tam kapasite vermeli, çift iade ile şişmemeli.
    expect(pool.allocate(0, 0, 0)).toBeGreaterThanOrEqual(0);
    expect(pool.allocate(0, 0, 0)).toBeGreaterThanOrEqual(0);
    expect(pool.allocate(0, 0, 0)).toBeGreaterThanOrEqual(0);
    expect(pool.allocate(0, 0, 0)).toBe(-1);
  });

  it('her organizmaya benzersiz kimlik verir', () => {
    const pool = new OrganismPool(10);
    const ids = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const idx = pool.allocate(0, 0, 0);
      ids.add(pool.id[idx]!);
    }
    expect(ids.size).toBe(10);
    expect(ids.has(0)).toBe(false); // 0 "ata yok" için ayrılmış
  });

  it('fenotip genom aralıklarına doğru açılır', () => {
    const pool = new OrganismPool(1);
    const i = pool.allocate(0, 0, 0);
    const base = pool.genomeOffset(i) + TRAIT_OFFSET;
    pool.genome[base + Trait.Size] = 0;
    pool.genome[base + Trait.Speed] = 1;
    pool.genome[base + Trait.SenseRange] = 0.5;
    pool.derivePhenotype(i);

    expect(pool.phenoSize[i]).toBeCloseTo(TRAIT_RANGES[Trait.Size]![0], 5);
    expect(pool.phenoSpeed[i]).toBeCloseTo(TRAIT_RANGES[Trait.Speed]![1], 5);
    const [lo, hi] = TRAIT_RANGES[Trait.SenseRange]!;
    expect(pool.phenoSense[i]).toBeCloseTo(lo + 0.5 * (hi - lo), 5);
  });

  it('expand aralık dışı geni kırpar', () => {
    const [lo, hi] = TRAIT_RANGES[Trait.Size]!;
    expect(expand(-5, Trait.Size)).toBe(lo);
    expect(expand(5, Trait.Size)).toBe(hi);
  });

  it('reset havuzu tam kapasiteye döndürür', () => {
    const pool = new OrganismPool(3);
    pool.allocate(0, 0, 0);
    pool.allocate(0, 0, 0);
    pool.reset();
    expect(pool.count).toBe(0);
    expect(pool.allocate(0, 0, 0)).toBeGreaterThanOrEqual(0);
    expect(pool.allocate(0, 0, 0)).toBeGreaterThanOrEqual(0);
    expect(pool.allocate(0, 0, 0)).toBeGreaterThanOrEqual(0);
    expect(pool.allocate(0, 0, 0)).toBe(-1);
  });
});
