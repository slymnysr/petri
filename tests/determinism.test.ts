import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type SimConfig } from '../src/sim/types';
import { World } from '../src/sim/world';

/**
 * Belirlenim testleri.
 *
 * Projenin en temel sözü: aynı tohum aynı evreni üretir. Bu söz olmadan
 * "bu strateji gerçekten ortaya çıktı mı, yoksa şans mıydı" sorusu
 * cevaplanamaz ve bir deneyi paylaşmanın anlamı kalmaz.
 *
 * Deneyi paylaşma özelliği tamamen buna dayanıyor: kullanıcı arayüzden
 * "deneyi kopyala" dediğinde yalnızca tohum + parametreler kopyalanıyor,
 * binlerce genom değil. Karşı taraf aynı JSON'u yükleyince birebir aynı
 * evrimi görmeli.
 */

const setup = {
  worldRadius: 373,
  verticalSquash: 0.4,
  maxOrganisms: 400,
  initialPopulation: 80,
  maxFood: 1100,
  foodSpawnRate: 7,
};

/** İki dünyanın durumunu tam olarak karşılaştırır. */
function expectIdenticalState(a: World, b: World): void {
  expect(a.tick).toBe(b.tick);
  expect(a.pool.count).toBe(b.pool.count);
  expect(a.births).toBe(b.births);
  expect(a.deaths).toBe(b.deaths);
  expect(a.predationEvents).toBe(b.predationEvents);
  expect(a.food.count).toBe(b.food.count);
  expect(Array.from(a.pool.x)).toEqual(Array.from(b.pool.x));
  expect(Array.from(a.pool.y)).toEqual(Array.from(b.pool.y));
  expect(Array.from(a.pool.z)).toEqual(Array.from(b.pool.z));
  expect(Array.from(a.pool.energy)).toEqual(Array.from(b.pool.energy));
  expect(Array.from(a.pool.genome)).toEqual(Array.from(b.pool.genome));
}

describe('Belirlenim', () => {
  it('aynı tohum birebir aynı evreni üretir', () => {
    const a = new World({ ...setup, seed: 5 });
    const b = new World({ ...setup, seed: 5 });
    for (let i = 0; i < 1200; i++) {
      a.step();
      b.step();
    }
    expectIdenticalState(a, b);
  });

  it('adım adım ilerleme ile toplu ilerleme aynı sonucu verir', () => {
    // step() içinde gizli bir durum (örneğin adım sayısına bağlı bir yan etki)
    // varsa bu test onu yakalar.
    const a = new World({ ...setup, seed: 6 });
    const b = new World({ ...setup, seed: 6 });
    for (let i = 0; i < 800; i++) a.step();
    for (let batch = 0; batch < 8; batch++) {
      for (let i = 0; i < 100; i++) b.step();
    }
    expectIdenticalState(a, b);
  });

  it('reseed aynı tohumla aynı evreni yeniden kurar', () => {
    const w = new World({ ...setup, seed: 9 });
    for (let i = 0; i < 500; i++) w.step();

    w.reseed(77);
    for (let i = 0; i < 500; i++) w.step();
    const firstX = Array.from(w.pool.x);
    const firstTick = w.tick;

    w.reseed(77);
    for (let i = 0; i < 500; i++) w.step();

    expect(w.tick).toBe(firstTick);
    expect(Array.from(w.pool.x)).toEqual(firstX);
  });

  it('farklı tohum farklı evren üretir', () => {
    const a = new World({ ...setup, seed: 1 });
    const b = new World({ ...setup, seed: 2 });
    for (let i = 0; i < 600; i++) {
      a.step();
      b.step();
    }
    expect(Array.from(a.pool.x)).not.toEqual(Array.from(b.pool.x));
  });
});

describe('Deney kaydet/yükle', () => {
  /**
   * Arayüzdeki "deneyi kopyala" düğmesinin ürettiği biçimin birebir aynısı.
   * Buradaki test o özelliğin sözleşmesini koruyor.
   */
  function exportScenario(w: World): string {
    return JSON.stringify({ petri: 1, config: w.config });
  }

  function importScenario(json: string): World {
    const parsed = JSON.parse(json) as { petri?: number; config?: Record<string, unknown> };
    if (parsed.petri !== 1 || !parsed.config) throw new Error('tanınmayan biçim');

    const config: Partial<SimConfig> = {};
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      const value = parsed.config[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        (config as unknown as Record<string, number>)[key] = value;
      }
    }
    return new World(config);
  }

  it('dışa aktarılan deney birebir aynı evrimi üretir', () => {
    const original = new World({ ...setup, seed: 31, foodSpawnRate: 9, mutationScale: 0.09 });
    const json = exportScenario(original);

    const restored = importScenario(json);
    for (let i = 0; i < 1000; i++) {
      original.step();
      restored.step();
    }
    expectIdenticalState(original, restored);
  });

  it('dışa aktarılan JSON tüm config alanlarını taşır', () => {
    // Bir alan unutulursa yükleyen taraf sessizce varsayılana düşer ve
    // "aynı deney" olmaz — en sinsi bozulma biçimi bu.
    const w = new World({ ...setup, seed: 32 });
    const parsed = JSON.parse(exportScenario(w)) as { config: Record<string, unknown> };
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      expect(parsed.config[key]).toBeDefined();
    }
  });

  it('bozuk veya yabancı JSON reddedilir', () => {
    expect(() => importScenario('{}')).toThrow();
    expect(() => importScenario('{"petri":2,"config":{}}')).toThrow();
    expect(() => importScenario('değil-json')).toThrow();
  });

  it('yabancı alanlar config’i kirletmez', () => {
    const json = JSON.stringify({
      petri: 1,
      config: { ...DEFAULT_CONFIG, seed: 44, zararliAlan: 999, digerAlan: 'metin' },
    });
    const w = importScenario(json);
    expect(w.config.seed).toBe(44);
    expect((w.config as unknown as Record<string, unknown>)['zararliAlan']).toBeUndefined();
    expect((w.config as unknown as Record<string, unknown>)['digerAlan']).toBeUndefined();
  });

  it('RNG durumu kaydedilip geri yüklenebilir', () => {
    const w = new World({ ...setup, seed: 50 });
    for (let i = 0; i < 300; i++) w.step();

    const saved = w.rng.getState();
    const after = Array.from({ length: 20 }, () => w.rng.next());

    w.rng.setState(saved);
    const replay = Array.from({ length: 20 }, () => w.rng.next());
    expect(replay).toEqual(after);
  });
});
