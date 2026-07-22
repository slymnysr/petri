import type { SimConfig } from './types';
import { World, type WorldStats } from './world';

/**
 * Hipotez test motoru — oturum boyu elle yürüttüğüm ölçüm döngüsünün kullanıcıya
 * açılmış hali.
 *
 * Kullanıcı bir iddia seçer ("bol yiyecek nüfusu artırır"). Motor iki koşulu
 * (temel vs müdahale) birkaç tohumda koşturur, bir ölçütü karşılaştırır ve
 * "tuttu / tutmadı" der — sayılarıyla. ANALIZ.md'deki disiplinin ta kendisi.
 *
 * Kritik nokta: hipotezlerden biri (ölümsüzlük) bilerek tutmaz. Bir araç ancak
 * "tutmadı" da diyebiliyorsa gerçek bir testtir; her şeye "tuttu" diyen bir
 * gösteri, bu projenin dürüstlük iddiasını çökertirdi.
 *
 * Deneyler küçük dünyalarda koşar (hız için) ve parça parça, olay döngüsüne yer
 * bırakarak yürür — arayüz donmasın.
 */

export interface Hypothesis {
  id: string;
  /** Kullanıcının test ettiği iddia. */
  claim: string;
  /** Ölçütün insan-okunur adı. */
  metricLabel: string;
  baseline: Partial<SimConfig>;
  treatment: Partial<SimConfig>;
  /** Beklenen yön: müdahale ölçütü artırır mı, azaltır mı? */
  direction: 'artırır' | 'azaltır';
  measure: (stats: WorldStats, peakPopulation: number) => number;
}

// Deney dünyası: kapasite tavanı (maxOrganisms) bilerek yüksek tutuldu.
// İlk tasarımda tavan 900'dü ve nüfus hipotezleri tavana yapışıp ayırt
// edilemiyordu — hem bolluk hem ölümsüzlük 900'de takılıyordu. Tavan 3000'e
// çıkınca koşullar gerçekten ayrışabiliyor.
//
// Not: iklim uyumu, duyu-sürücülü oran gibi *evrimsel* etkiler bu hızlı
// deneylere sığmıyor — uzun koşu ister. Buradaki hipotezler nüfus dinamiğine
// dayanıyor: hızlı yanıt veriyor ve birkaç bin adımda net karar çıkıyor.
// maxOrganisms bilerek 2000: tavan hem koşulları ayırt edebilecek kadar yüksek
// hem de "bol yiyecek" koşulu tavana patladığında bile deneyin makul sürede
// (arayüzü kilitlemeden) bitebileceği kadar düşük. 3000 tavanda bol-yiyecek
// dünyası headless tarayıcıda çok yavaşlıyordu.
const BASE = {
  worldRadius: 440,
  verticalSquash: 0.4,
  maxOrganisms: 2000,
  initialPopulation: 300,
  maxFood: 1800,
  foodSpawnRate: 7,
  foodEnergy: 38,
};

export const HYPOTHESES: readonly Hypothesis[] = [
  {
    id: 'bolluk-nufus',
    claim: 'Bol yiyecek nüfusu artırır',
    metricLabel: 'zirve nüfus',
    baseline: { ...BASE },
    treatment: { ...BASE, foodSpawnRate: 45, maxFood: 6000 },
    direction: 'artırır',
    measure: (_s, peak) => peak,
  },
  {
    id: 'kitlik-sonme',
    claim: 'Yiyecek kesilince popülasyon söner',
    metricLabel: 'son nüfus',
    baseline: { ...BASE },
    treatment: { ...BASE, foodSpawnRate: 0, maxFood: 20 },
    direction: 'azaltır',
    measure: (s) => s.population,
  },
  {
    id: 'metabolizma-nufus',
    claim: 'Yüksek metabolizma nüfusu düşürür',
    metricLabel: 'zirve nüfus',
    baseline: { ...BASE },
    treatment: { ...BASE, baseMetabolism: 0.14 },
    direction: 'azaltır',
    measure: (_s, peak) => peak,
  },
  {
    id: 'yuksek-mutasyon',
    claim: 'Yüksek mutasyon nüfusu artırır',
    metricLabel: 'zirve nüfus',
    baseline: { ...BASE },
    treatment: { ...BASE, mutationRateScale: 3 },
    direction: 'artırır',
    // NOT: "çeşitlilik iyidir, o hâlde daha çok mutasyon daha iyi" makul gelir
    // ama ölçüm tersini gösteriyor: aşırı mutasyon işleyen genomları her nesilde
    // bozuyor ("hata felaketi") ve nüfusu ~%23 DÜŞÜRÜYOR. Araç bu iddiaya
    // "tutmadı" demeli. Bir aracın "tutmadı" da diyebilmesi, gerçek bir test
    // olduğunun — kurgu olmadığının — kanıtıdır.
    measure: (_s, peak) => peak,
  },
];

export interface ExperimentResult {
  baselineAvg: number;
  treatmentAvg: number;
  /** İddia edilen yön gerçekleşti mi? */
  held: boolean;
  /** Etkinin göreli büyüklüğü (%). */
  relativeChange: number;
}

/** Tek bir dünyayı `steps` adım koşturup ölçütü döndürür (zirve nüfusu izler). */
function runOne(hypothesis: Hypothesis, config: Partial<SimConfig>, seed: number, steps: number): number {
  const w = new World({ ...config, seed });
  let peak = 0;
  for (let i = 0; i < steps; i++) {
    w.step();
    if (w.pool.count > peak) peak = w.pool.count;
    if (w.pool.count === 0) break;
  }
  return hypothesis.measure(w.getStats(), peak);
}

/**
 * Deneyi parça parça koşturur; her tohum-koşusu arasında olay döngüsüne yer
 * bırakır ve ilerlemeyi bildirir. `seeds` kadar tohumda iki koşul ölçülür.
 */
export async function runExperiment(
  hypothesis: Hypothesis,
  seeds: number[],
  steps: number,
  onProgress: (done: number, total: number) => void,
): Promise<ExperimentResult> {
  const total = seeds.length * 2;
  let done = 0;
  let baselineSum = 0;
  let treatmentSum = 0;

  for (const seed of seeds) {
    baselineSum += runOne(hypothesis, hypothesis.baseline, seed, steps);
    onProgress(++done, total);
    await yieldToEventLoop();

    treatmentSum += runOne(hypothesis, hypothesis.treatment, seed, steps);
    onProgress(++done, total);
    await yieldToEventLoop();
  }

  const baselineAvg = baselineSum / seeds.length;
  const treatmentAvg = treatmentSum / seeds.length;

  // İddia edilen yön gerçekten oluştu mu? Küçük bir eşik gürültüyü eler.
  const diff = treatmentAvg - baselineAvg;
  const rel = baselineAvg !== 0 ? diff / Math.abs(baselineAvg) : 0;
  const meaningful = Math.abs(rel) > 0.08;
  const held =
    hypothesis.direction === 'artırır' ? meaningful && diff > 0 : meaningful && diff < 0;

  return {
    baselineAvg,
    treatmentAvg,
    held,
    relativeChange: rel * 100,
  };
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
