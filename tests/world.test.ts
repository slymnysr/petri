import { describe, expect, it } from 'vitest';
import { normalizedRadius } from '../src/sim/geometry';
import { World } from '../src/sim/world';

const small = {
  // Yarıçap, önceki 600×600×240 kutuyla aynı hacmi verecek şekilde seçildi:
  // (4/3)π·R²·(R·s) = 600·600·240, s = 0.4 → R ≈ 373. Hacmi sabit tutmak
  // önemli, çünkü buradaki besin yoğunluğu ve nüfus eşikleri o hacme göre
  // ayarlanmıştı.
  worldRadius: 373,
  verticalSquash: 0.4,
  maxOrganisms: 400,
  initialPopulation: 80,
  // Yiyecek sayısı hacme göre ayarlandı: 3B'de aynı sayı çok daha seyrek bir
  // dünya demek. Buradaki yoğunluk varsayılanın biraz üstünde tutuldu ki
  // testler kısa koşularda kıtlıktan değil, ölçtükleri şeyden dolayı sonuç
  // versin.
  // Yoğunluk varsayılan dünyayla aynı mertebede tutuluyor: 3B'de sayı değil
  // hacim başına yoğunluk belirleyici.
  maxFood: 1100,
  foodSpawnRate: 7,
};

describe('World', () => {
  it('aynı tohum birebir aynı simülasyonu üretir', () => {
    const a = new World({ ...small, seed: 5 });
    const b = new World({ ...small, seed: 5 });
    for (let i = 0; i < 300; i++) {
      a.step();
      b.step();
    }
    const sa = a.getStats();
    const sb = b.getStats();
    expect(sa.population).toBe(sb.population);
    expect(sa.births).toBe(sb.births);
    expect(sa.deaths).toBe(sb.deaths);
    expect(Array.from(a.pool.x)).toEqual(Array.from(b.pool.x));
    expect(Array.from(a.pool.energy)).toEqual(Array.from(b.pool.energy));
  });

  it('farklı tohum farklı simülasyon üretir', () => {
    const a = new World({ ...small, seed: 1 });
    const b = new World({ ...small, seed: 2 });
    for (let i = 0; i < 300; i++) {
      a.step();
      b.step();
    }
    expect(Array.from(a.pool.x)).not.toEqual(Array.from(b.pool.x));
  });

  it('kapasiteyi asla aşmaz', () => {
    // Bol yiyecek + ucuz üreme: popülasyon tavana dayanmalı ama taşmamalı.
    const w = new World({
      ...small,
      seed: 3,
      foodSpawnRate: 40,
      foodEnergy: 60,
      reproduceThreshold: 70,
    });
    for (let i = 0; i < 1500; i++) {
      w.step();
      expect(w.pool.count).toBeLessThanOrEqual(w.pool.capacity);
      expect(w.pool.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('yiyecek üretilmezse popülasyon söner', () => {
    // maxFood: 1 → başlangıç yiyeceği floor(1 × 0.35) = 0, yani dünya tamamen kısır.
    // Adım sayısı en dayanıklı fenotipe göre seçildi: en düşük metabolizma (0.4) ve
    // en küçük gövde (1.5) ile tüketim 0.06 × 0.4 × 0.5 = 0.012/adım, yani hiç
    // hareket etmeyen bir organizma 60 enerjiyle ~5000 adım yaşayabilir.
    const w = new World({
      ...small,
      seed: 4,
      foodSpawnRate: 0,
      maxFood: 1,
      seasonPeriod: 0,
    });
    for (let i = 0; i < 8000; i++) w.step();
    expect(w.pool.count).toBe(0);
    expect(w.deaths).toBeGreaterThan(0);
  });

  it('bol yiyecekle popülasyon ayakta kalır', () => {
    const w = new World({ ...small, seed: 6, foodSpawnRate: 12, foodEnergy: 40 });
    for (let i = 0; i < 2000; i++) w.step();
    expect(w.pool.count).toBeGreaterThan(0);
  });

  it('yiyecek sayacı hiç negatife düşmez ve kapasiteyi aşmaz', () => {
    const w = new World({ ...small, seed: 7, foodSpawnRate: 30 });
    for (let i = 0; i < 1200; i++) {
      w.step();
      expect(w.food.count).toBeGreaterThanOrEqual(0);
      expect(w.food.count).toBeLessThanOrEqual(w.food.capacity);
    }
  });

  it('organizmalar dünya sınırları içinde kalır', () => {
    // Kutu geometrisinde bu, altı yüzeye ayrı ayrı bakmak demekti. Elipsoidde
    // tek bir ölçüt var: normalize merkez uzaklığı 1'i aşamaz.
    const w = new World({ ...small, seed: 8, foodSpawnRate: 10 });
    for (let i = 0; i < 800; i++) w.step();

    for (let i = 0; i < w.pool.capacity; i++) {
      if (w.pool.alive[i] === 0) continue;
      const d = normalizedRadius(
        w.pool.x[i]!, w.pool.y[i]!, w.pool.z[i]!,
        small.worldRadius, small.verticalSquash,
      );
      // Kayan nokta payı: kırpma tam yüzeye taşıyor, 1'i mikroskobik aşabilir.
      expect(d).toBeLessThanOrEqual(1 + 1e-4);
    }

    // Yiyecek ve leş de aynı kısıta tabi.
    for (let i = 0; i < w.food.capacity; i++) {
      if (w.food.alive[i] === 0) continue;
      const d = normalizedRadius(
        w.food.x[i]!, w.food.y[i]!, w.food.z[i]!,
        small.worldRadius, small.verticalSquash,
      );
      expect(d).toBeLessThanOrEqual(1 + 1e-4);
    }
  });

  it('üreme sayacı doğum sayısıyla tutarlı, nesil ilerler', () => {
    const w = new World({ ...small, seed: 9, foodSpawnRate: 15, foodEnergy: 45 });
    for (let i = 0; i < 2500; i++) w.step();
    const stats = w.getStats();
    expect(stats.births).toBeGreaterThan(0);
    // Nesil ölçümü canlı popülasyondan yapılıyor; popülasyon sönmüşse test
    // ölçmek istediği şeyi değil kıtlığı ölçer.
    expect(stats.population).toBeGreaterThan(0);
    // Üreme gerçekleştiyse en az bir organizma 1. nesli geçmiş olmalı.
    expect(stats.maxGeneration).toBeGreaterThan(0);
  });

  it('enerji harcanır: yiyeceksiz organizma zamanla zayıflar', () => {
    const w = new World({
      ...small,
      seed: 10,
      foodSpawnRate: 0,
      maxFood: 4,
      initialPopulation: 20,
      seasonPeriod: 0,
    });
    const startEnergy = w.config.startEnergy;
    for (let i = 0; i < 200; i++) w.step();
    let checked = 0;
    for (let i = 0; i < w.pool.capacity; i++) {
      if (w.pool.alive[i] === 0) continue;
      expect(w.pool.energy[i]).toBeLessThan(startEnergy);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('mevsim katsayısı beklenen aralıkta salınır', () => {
    const w = new World({ ...small, seed: 11, seasonPeriod: 100, seasonAmplitude: 0.5 });
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 100; i++) {
      const s = w.seasonFactor();
      min = Math.min(min, s);
      max = Math.max(max, s);
      w.step();
    }
    expect(min).toBeGreaterThanOrEqual(0.5 - 1e-6);
    expect(max).toBeLessThanOrEqual(1.5 + 1e-6);
    expect(max - min).toBeGreaterThan(0.5); // gerçekten salınıyor
  });

  it('varsayılan dünya uzun koşuda görsel olarak boşalmaz', () => {
    // Bu test bir boşluğu kapatıyor: diğer testlerin hepsi kendi küçük
    // config'ini veriyordu, DEFAULT_CONFIG uzun vadede hiç doğrulanmamıştı.
    // Kullanıcı "hareket bazen kayboluyor" dediğinde ortaya çıktı — mevsim
    // döngüsü kaynak salınımıyla rezonansa girip nüfusu 66'ya düşürüyordu.
    const w = new World();
    let min = Infinity;
    let max = 0;
    for (let i = 0; i < 12000; i++) {
      w.step();
      if (i > 2500) {
        // Isınma sonrası: erken dalgalanma normal, kalıcı dip değil.
        if (w.pool.count < min) min = w.pool.count;
        if (w.pool.count > max) max = w.pool.count;
      }
    }
    // Ölçülen dip bu ayarda ~269; eşik gürültüye ve tohum farkına pay bırakıyor.
    expect(min).toBeGreaterThan(140);
    // Salınım tamamen ölmemeli de — sabit nüfus, kıtlık baskısının
    // kalmadığı anlamına gelir ve evrimi durdurur.
    expect(max / min).toBeGreaterThan(1.3);
  }, 300000);

  it('indexOfId canlı organizmayı bulur, ölüyü bulmaz', () => {
    const w = new World({ ...small, seed: 12 });
    let firstAlive = -1;
    for (let i = 0; i < w.pool.capacity; i++) {
      if (w.pool.alive[i] === 1) {
        firstAlive = i;
        break;
      }
    }
    expect(firstAlive).toBeGreaterThanOrEqual(0);
    const id = w.pool.id[firstAlive]!;
    expect(w.indexOfId(id)).toBe(firstAlive);

    w.pool.free(firstAlive);
    expect(w.indexOfId(id)).toBe(-1);
  });
});
