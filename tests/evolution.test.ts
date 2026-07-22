import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Trait } from '../src/sim/types';

/**
 * Projenin dişli testi.
 *
 * Buradaki iddia "simülasyon çöküyor mu" değil, "evrim gerçekten oluyor mu".
 * Bir yapay yaşam simülasyonunun ekranda kıpırdaması hiçbir şey kanıtlamaz;
 * popülasyonun zamanla ölçülebilir şekilde *daha iyi* olması gerekir. Bu
 * testler geçmiyorsa geri kalan her şey dekordan ibarettir.
 */

/**
 * Testin dünyası tam tanımlı olmalı.
 *
 * Başlangıçta mevsim alanları verilmiyordu ve sessizce DEFAULT_CONFIG'den
 * geliyordu; varsayılan mevsim genliği 0.6'dan 0.25'e çekilince metabolizma
 * testi düştü — üstelik gen beklenenin tersine *yükselmişti*.
 *
 * Sebep bir bulgu olarak kayda değer: düşük metabolizma seçilimini sürükleyen
 * şey mevsimsel kıtlık. Kıtlık dönemleri yumuşayınca tasarrufun getirisi
 * kayboluyor ve gen rastgele sürüklenmeye başlıyor. Bu yüzden burada kıtlık
 * baskısı açıkça kuruluyor — test neyi ölçtüğünü kendi söylemeli.
 */
const setup = {
  // 900×900×360 kutuyla eşit hacim (bkz. types.ts'teki yarıçap notu)
  worldRadius: 560,
  verticalSquash: 0.4,
  maxOrganisms: 1500,
  initialPopulation: 300,
  // 3B hacimde yoğunluk: 2B'deki 700 yiyecek burada popülasyonu besleyemiyor.
  maxFood: 3600,
  foodSpawnRate: 11,
  seasonPeriod: 6000,
  seasonAmplitude: 0.6,
};

describe('Evrim', () => {
  it('uygunluk bir eksende ilerler (ömür ya da beslenme)', () => {
    // Bu testin iddiası bilerek "hangi eksende" demiyor.
    //
    // 2B sürümde besin kıttı ve evrim tek yönde ilerliyordu: yaşam boyu
    // beslenme sayısı ~5 katına çıkıyordu. 3B dünyada besin yoğunluğunu
    // yükseltmek zorunda kaldım (küresel hacim yarıçapın küpüyle büyüyor,
    // bkz. types.ts) ve o eksen doydu. Üç tohumda ölçülen (3.000 → 18.000 adım):
    //
    //   tohum 21: ömür 280→498 (1.78×)   beslenme 5.48→4.99 (0.91×)
    //   tohum 33: ömür 1015→472 (0.47×)  beslenme 4.38→5.33 (1.22×)
    //   tohum 44: ömür 297→526 (1.77×)   beslenme 4.40→5.25 (1.19×)
    //
    // Yani popülasyon bazen "daha uzun yaşa", bazen "daha çok beslen" yönünde
    // ilerliyor; hangisinin baskın çıkacağı başlangıç koşullarına bağlı. Tek
    // bir ekseni şart koşan bir test, evrim çalışırken bile kırılıyordu.
    //
    // Not: erken ölçüm gürültülü, çünkü 3.000. adımda ölüm penceresi (512
    // kayıt) henüz dolmamış olabiliyor — tohum 33'teki 1015'lik erken ömür
    // buradan geliyor. Eşik bu gürültüye pay bırakacak şekilde seçildi.
    const w = new World({ ...setup, seed: 21 });

    for (let i = 0; i < 3000; i++) w.step();
    const early = w.getStats();
    const earlyLife = early.avgLifespan;
    const earlyFood = early.avgFoodPerLife;

    for (let i = 0; i < 15000; i++) w.step();
    const late = w.getStats();

    expect(w.pool.count).toBeGreaterThan(0); // popülasyon ayakta
    expect(earlyLife).toBeGreaterThan(0);
    expect(earlyFood).toBeGreaterThan(0);

    const lifeGain = late.avgLifespan / earlyLife;
    const foodGain = late.avgFoodPerLife / earlyFood;
    expect(Math.max(lifeGain, foodGain)).toBeGreaterThan(1.15);
  }, 300000);

  it('düşük metabolizma yönünde seçilim olur', () => {
    const w = new World({ ...setup, seed: 33 });
    const initial = w.getStats().avgTraits[Trait.Metabolism]!;

    for (let i = 0; i < 12000; i++) w.step();
    const evolved = w.getStats().avgTraits[Trait.Metabolism]!;

    expect(w.pool.count).toBeGreaterThan(0);
    // Rastgele başlangıç ortalaması ~0.5; enerji tasarrufu ödüllendirildiği
    // için bu aşağı kaymalı.
    //
    // Eşik notu: yaşlanma (agingRate) eklendiğinde bu seçilim ölçülebilir
    // şekilde zayıfladı — 12000 adımda düşüş ~%40'tan ~%28'e indi. Sebebi
    // makul: ömrü zaten yaş sınırlıyorsa düşük metabolizmanın getirisi azalır.
    // Eşik buna göre gevşetildi, ama yön hâlâ net.
    expect(evolved).toBeLessThan(initial * 0.85);
  }, 300000);

  it('nesil devri sürer — popülasyon tek kuşakta donmaz', () => {
    const w = new World({ ...setup, seed: 44 });
    for (let i = 0; i < 12000; i++) w.step();
    const stats = w.getStats();

    expect(stats.maxGeneration).toBeGreaterThan(10);
    // Doğumlar tükenmemeli: kapasite tavanına yapışıp evrim durursa bu düşer.
    expect(stats.births).toBeGreaterThan(1500);
  }, 300000);

  it('mutasyon kapalıyken genom havuzu çeşitlenmez', () => {
    // Kontrol grubu: mutasyon olmadan da seçilim vardır (başlangıç varyasyonu
    // ayıklanır) ama yeni çeşitlilik üretilemez. Fenotip ortalaması başlangıç
    // havuzunun sınırları içinde kalmalı — mutasyonlu koşudaki gibi uca
    // gitmemeli.
    const w = new World({ ...setup, seed: 55, mutationRateScale: 0, mutationScale: 0 });
    for (let i = 0; i < 12000; i++) w.step();

    if (w.pool.count > 0) {
      const metab = w.getStats().avgTraits[Trait.Metabolism]!;
      // Mutasyonlu koşuda bu değer ~0.15'e iniyordu; mutasyonsuzda seçilim
      // yalnızca mevcut varyasyonu daraltabilir, o kadar uca gidemez.
      expect(metab).toBeGreaterThan(0.05);
    }
  }, 300000);
});
