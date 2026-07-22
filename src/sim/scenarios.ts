import type { SimConfig } from './types';

/**
 * Küratörlü senaryolar — her biri bir gerçeği öğretir.
 *
 * Petri'yi araca çeviren şey bu: bir yabancı rastgele kaydırıcılarla oynamak
 * yerine, "mutasyonu kapatınca evrim durur" gibi tek bir olguyu tekrarlanabilir
 * şekilde izleyebiliyor. Determinizm sayesinde her senaryo aynı tohumda aynı
 * dersi verir.
 *
 * ÖNEMLİ — buradaki her config'in vaat ettiği olguyu gerçekten ürettiği uzun
 * koşuyla ölçüldü. İlk taslakta beş senaryo vardı; ölçümde ikisi elendi çünkü
 * vaatleri v3'ün zengin dünyasında tutmadı:
 *   - "Ölümsüzlük evrimi durdurur" (v1 bulgusu): yaşlanmasız dünya artık tavana
 *     yapışmıyor — avcılık ve iklim ölümleri bunu engelliyor.
 *   - "Avcılar yoktan doğuyor": rastgele genler yüzünden nüfus zaten yarı-avcı
 *     başlıyor, "sıfırdan doğuş" gösterilemiyor.
 * Tutmayan bir ders, aracın güvenilirliğini ilk denemede yıkardı; o yüzden
 * çıkarıldılar. Kalan dördü ölçümle doğrulanmış.
 */
export interface Scenario {
  id: string;
  name: string;
  /** Kullanıcının ne izleyeceği — dikkatini yönlendiren tek cümle. */
  watch: string;
  /** Bu senaryonun ne öğrettiği — olgunun açıklaması. */
  lesson: string;
  config: Partial<SimConfig>;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'dengeli',
    name: 'Dengeli dünya',
    watch: 'Nüfus bir denge bulur; avcılar ve otoburlar bir arada yaşar.',
    lesson:
      'Varsayılan dünya. Hiçbir baskı abartılmamış. Bir canlıya tıklayıp beynini ' +
      'açmaya buradan başla; diğer senaryoları da bu dengeden ayrılış olarak düşün.',
    config: { seed: 1 },
  },
  {
    id: 'mutasyon-kapali',
    name: 'Mutasyonu kapat → evrim donar',
    watch: 'Duyu-sürücülü karar ve ısı-enlem uyumu eğrileri düz kalır — hiçbir şey gelişmez.',
    lesson:
      'Mutasyon, evrimin ham maddesi. Kapatınca seçilim yalnızca baştaki çeşitliliği ' +
      'ayıklayabilir, yeni bir şey üretemez. Yandaki grafikler kıpırdamıyorsa sebebi bu: ' +
      'evrim yaratıcılığını mutasyondan alır. Bu bir kontrol deneyi.',
    // Ölçüldü: duyu-sürücülü oran 0.88→0.89 (düz), ısı uyumu -0.02→-0.02 (düz).
    config: { seed: 7, mutationRateScale: 0 },
  },
  {
    id: 'iklim',
    name: 'Soğuk sevenler soğuğa göçer',
    watch: '"ısı-enlem uyumu" grafiği sıfırdan yukarı, 0.5 civarına tırmanır.',
    lesson:
      'Dünyanın bir ucu soğuk, öbürü sıcak. Her canlının bir "ısı tercihi" geni var ve ' +
      'kimse kimseye nereye gideceğini söylemiyor. Yine de zamanla sıcak sevenler sıcağa, ' +
      'soğuk sevenler soğuğa yerleşir. Coğrafi uyum, kimse tasarlamadan ortaya çıkar.',
    // Ölçüldü: ısı-enlem korelasyonu -0.09 → 0.51.
    config: { seed: 7 },
  },
  {
    id: 'bolluk',
    name: 'Bollukta nüfus patlar',
    watch: 'Nüfus grafiği hızla kapasite tavanına fırlar.',
    lesson:
      'Yiyeceği bollaştırdık. Kıtlık baskısı kalkınca popülasyon patlayıp kapasiteye ' +
      'dayanıyor — ama kıtlık, canlıları daha iyi olmaya iten şeyin ta kendisiydi. ' +
      'Bolluk hayatta kalmayı kolaylaştırır; zorluk ise evrimi keskinleştirir.',
    // Ölçüldü: nüfus kapasitenin %100'üne ulaşıyor.
    config: { seed: 7, foodSpawnRate: 40, maxFood: 6000, foodEnergy: 55 },
  },
];

export const DEFAULT_SCENARIO_ID = 'dengeli';
