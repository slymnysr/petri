import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';

/**
 * Bütünleşme testleri: modüller ayrı ayrı doğru olsa bile birlikte yanlış
 * davranabilir. Buradaki testlerin çoğu, geliştirme sırasında gerçekten
 * yaşanmış hataların nöbetçisi.
 */

const setup = {
  worldRadius: 373,
  verticalSquash: 0.4,
  maxOrganisms: 400,
  initialPopulation: 80,
  maxFood: 1100,
  foodSpawnRate: 7,
};

describe('Enerji muhasebesi', () => {
  it('trofik aktarım katsayıları enerji üretemez', () => {
    // Bu, v2'de yaşanan somut bir hatanın kalıcı nöbetçisi: leş miktarı
    // gövde *boyutuyla* orantılanmıştı ve bu maddeyi yoktan var ediyordu.
    // Boyut 11'lik bir birey ölünce 6 yiyecek (168 enerji) bırakıyordu, ama
    // hayatı boyunca o kadar toplamamış olabiliyordu. Sonuç: nüfus patlaması,
    // herkesin azami boyuta kaçması, trofik ayrışmanın yok olması.
    //
    // Kural: avcının aldığı pay + leşe dönen pay < 1 olmalı. Aksi halde
    // avlanma, enerji üreten bir döngüye dönüşür.
    const w = new World(setup);
    expect(w.config.predationEfficiency + w.config.carrionYield).toBeLessThan(1);
  });

  it('açlıktan ölen leş bırakmaz, avlanan bırakır', () => {
    // Açlıktan ölümde enerji sıfırın altındadır: gövde zaten metabolizmaya
    // yakılmıştır. Yiyeceğin hiç üretilmediği bir dünyada popülasyon açlıktan
    // ölürken yiyecek sayısı artmamalı.
    const w = new World({
      ...setup,
      seed: 4,
      foodSpawnRate: 0,
      maxFood: 4,
      seasonPeriod: 0,
      // Avlanmayı da kapatıyoruz ki tek ölüm sebebi açlık olsun
      predationThreshold: 2,
    });
    const initialFood = w.food.count;
    for (let i = 0; i < 6000; i++) w.step();

    expect(w.pool.count).toBe(0); // hepsi açlıktan öldü
    expect(w.food.count).toBeLessThanOrEqual(initialFood);
  });

  it('ölüm ve doğum sayaçları havuz durumuyla tutarlı', () => {
    const w = new World({ ...setup, seed: 12, foodSpawnRate: 12 });
    for (let i = 0; i < 2500; i++) w.step();

    // Yaşayan = başlangıç + doğum − ölüm
    const expected = Math.min(setup.initialPopulation, setup.maxOrganisms) + w.births - w.deaths;
    expect(w.pool.count).toBe(expected);
  });

  it('yiyecek sayacı gerçek canlı yiyecek sayısıyla eşleşir', () => {
    // Serbest liste yönetiminde bir hata sayacı gerçeklikten ayırır ve
    // sessizce sızıntı yaratır.
    const w = new World({ ...setup, seed: 15, foodSpawnRate: 14 });
    for (let i = 0; i < 1500; i++) w.step();

    let actual = 0;
    for (let i = 0; i < w.food.capacity; i++) {
      if (w.food.alive[i] === 1) actual++;
    }
    expect(w.food.count).toBe(actual);
  });

  it('havuz sayacı gerçek canlı organizma sayısıyla eşleşir', () => {
    const w = new World({ ...setup, seed: 16, foodSpawnRate: 12 });
    for (let i = 0; i < 2000; i++) w.step();

    let actual = 0;
    for (let i = 0; i < w.pool.capacity; i++) {
      if (w.pool.alive[i] === 1) actual++;
    }
    expect(w.pool.count).toBe(actual);
  });

  it('kimlikler benzersiz kalır', () => {
    // Havuz yuvaları geri dönüştürülüyor; kimlik üretimi bozulursa iki canlı
    // aynı kimliği taşır ve seçim/soy takibi sessizce yanlış organizmayı
    // gösterir.
    const w = new World({ ...setup, seed: 17, foodSpawnRate: 12 });
    for (let i = 0; i < 2000; i++) w.step();

    const seen = new Set<number>();
    for (let i = 0; i < w.pool.capacity; i++) {
      if (w.pool.alive[i] === 0) continue;
      const id = w.pool.id[i]!;
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });
});

describe('Yapay seçilim', () => {
  it('ödüllendirmek organizmanın soyunu üretir', () => {
    const w = new World({ ...setup, seed: 40 });
    for (let i = 0; i < 400; i++) w.step();
    let id = -1;
    for (let i = 0; i < w.pool.capacity; i++) {
      if (w.pool.alive[i] === 1) {
        id = w.pool.id[i]!;
        break;
      }
    }
    expect(id).toBeGreaterThan(0);

    const birthsBefore = w.births;
    const countBefore = w.pool.count;
    w.reward(id, 3);

    // Üç yavru: doğum sayacı ve nüfus artmalı.
    expect(w.births).toBe(birthsBefore + 3);
    expect(w.pool.count).toBe(countBefore + 3);

    // Yavrular bu organizmayı ebeveyn göstermeli.
    let children = 0;
    for (let i = 0; i < w.pool.capacity; i++) {
      if (w.pool.alive[i] === 1 && w.pool.parentId[i] === id) children++;
    }
    expect(children).toBeGreaterThanOrEqual(3);
  });

  it('ödül kapasite dolduğunda taşmaz', () => {
    const w = new World({ ...setup, seed: 41, maxOrganisms: 100, initialPopulation: 99 });
    let id = -1;
    for (let i = 0; i < w.pool.capacity; i++) {
      if (w.pool.alive[i] === 1) {
        id = w.pool.id[i]!;
        break;
      }
    }
    w.reward(id, 10); // yalnızca 1 yer var
    expect(w.pool.count).toBeLessThanOrEqual(100);
  });

  it('ayıklamak organizmayı kaldırır', () => {
    const w = new World({ ...setup, seed: 42 });
    for (let i = 0; i < 300; i++) w.step();
    let id = -1;
    for (let i = 0; i < w.pool.capacity; i++) {
      if (w.pool.alive[i] === 1) {
        id = w.pool.id[i]!;
        break;
      }
    }
    const countBefore = w.pool.count;
    w.cull(id);
    expect(w.indexOfId(id)).toBe(-1);
    expect(w.pool.count).toBe(countBefore - 1);
  });
});

describe('Sınır durumları', () => {
  it('boş popülasyonda step ve getStats çökmez', () => {
    const w = new World({ ...setup, seed: 20, initialPopulation: 0 });
    expect(() => {
      for (let i = 0; i < 200; i++) w.step();
    }).not.toThrow();

    const s = w.getStats();
    expect(s.population).toBe(0);
    expect(Number.isFinite(s.avgLifespan)).toBe(true);
    expect(Number.isFinite(s.thermalAdaptation)).toBe(true);
    expect(Number.isFinite(s.avgMutationRate)).toBe(true);
    expect(s.predatorRatio).toBe(0);
  });

  it('kapasite dolduğunda üreme sessizce başarısız olur, taşma olmaz', () => {
    const w = new World({
      ...setup, seed: 21,
      maxOrganisms: 60, initialPopulation: 60,
      foodSpawnRate: 40, foodEnergy: 90, reproduceThreshold: 60,
    });
    for (let i = 0; i < 1500; i++) {
      w.step();
      expect(w.pool.count).toBeLessThanOrEqual(60);
    }
  });

  it('yiyeceksiz dünyada çökme olmaz', () => {
    const w = new World({ ...setup, seed: 22, maxFood: 1, foodSpawnRate: 0 });
    expect(() => {
      for (let i = 0; i < 3000; i++) w.step();
    }).not.toThrow();
  });

  it('mutasyon tamamen kapalıyken çalışır', () => {
    const w = new World({ ...setup, seed: 23, mutationRateScale: 0, mutationScale: 0 });
    expect(() => {
      for (let i = 0; i < 1200; i++) w.step();
    }).not.toThrow();
  });

  it('aşırı mutasyon şiddetinde genom sınırları korunur', () => {
    // Fenotip genleri 0..1 dışına taşarsa expand() yanlış fenotip üretir.
    const w = new World({ ...setup, seed: 24, mutationRateScale: 3, mutationScale: 5 });
    for (let i = 0; i < 1200; i++) w.step();

    const traitOffset = w.pool.genomeOffset(1) - w.pool.genomeOffset(0) - 8;
    for (let i = 0; i < w.pool.capacity; i++) {
      if (w.pool.alive[i] === 0) continue;
      const base = w.pool.genomeOffset(i) + traitOffset;
      for (let t = 0; t < 8; t++) {
        const gene = w.pool.genome[base + t]!;
        expect(gene).toBeGreaterThanOrEqual(0);
        expect(gene).toBeLessThanOrEqual(1);
      }
    }
  });

  it('var olmayan kimlik sorguları güvenli döner', () => {
    const w = new World({ ...setup, seed: 25 });
    for (let i = 0; i < 300; i++) w.step();

    expect(w.indexOfId(999999999)).toBe(-1);
    expect(w.lineage.get(999999999)).toBeUndefined();
    expect(w.lineage.ancestors(999999999)).toEqual([]);
    expect(w.findNearestOrganism(0, 0, 0, -1)).toBe(-1);
  });

  it('tam küre (squash = 1) geometrisinde de çalışır', () => {
    // verticalSquash yalnızca varsayılan bir yassılık; 1 verildiğinde dünya
    // tam küre olur ve simülasyon aynı şekilde çalışmalı.
    const w = new World({ ...setup, seed: 26, verticalSquash: 1, foodSpawnRate: 12 });
    expect(() => {
      for (let i = 0; i < 1500; i++) w.step();
    }).not.toThrow();
    expect(w.pool.count).toBeGreaterThan(0);
  });
});
