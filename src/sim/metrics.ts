import type { WorldStats } from './world';

/**
 * Zaman serisi kaydı — evrimi anlık değil, eğri olarak görebilmek için.
 *
 * Tek bir anlık sayı ("nüfus 457") hiçbir şey anlatmaz; asıl bilgi eğrinin
 * yönünde. Halka tampon kullanılıyor: sabit bellek, en eski örnek düşer.
 */

export const METRIC_KEYS = [
  'population',
  'avgFoodPerLife',
  'senseDrivenRatio',
  'predatorRatio',
  'thermalAdaptation',
  'avgMutationRate',
  'maxGeneration',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const METRIC_LABELS: Record<MetricKey, string> = {
  population: 'nüfus',
  avgFoodPerLife: 'yiyecek / ömür',
  senseDrivenRatio: 'duyu-sürücülü karar',
  predatorRatio: 'avcı oranı',
  thermalAdaptation: 'ısı-enlem uyumu',
  avgMutationRate: 'mutasyon oranı',
  maxGeneration: 'nesil',
};

/**
 * Sabit ölçekli seriler. Doğal aralığı bilinen ölçütleri veriden türetilen
 * ölçekle çizmek yanıltıcı olur: %1'lik bir dalgalanma tüm grafiği doldurup
 * dramatik görünür. Isı uyumu korelasyon olduğu için negatif de olabilir.
 */
export const METRIC_RANGES: Partial<Record<MetricKey, [number, number]>> = {
  senseDrivenRatio: [0, 1],
  predatorRatio: [0, 1],
  thermalAdaptation: [-1, 1],
};

export class MetricHistory {
  private readonly series = new Map<MetricKey, Float32Array>();
  private readonly ticks: Float32Array;
  private cursor = 0;
  private filled = 0;

  constructor(readonly capacity = 400) {
    for (const key of METRIC_KEYS) {
      this.series.set(key, new Float32Array(capacity));
    }
    this.ticks = new Float32Array(capacity);
  }

  push(stats: WorldStats): void {
    const i = this.cursor;
    this.series.get('population')![i] = stats.population;
    this.series.get('avgFoodPerLife')![i] = stats.avgFoodPerLife;
    this.series.get('senseDrivenRatio')![i] = stats.senseDrivenRatio;
    this.series.get('predatorRatio')![i] = stats.predatorRatio;
    this.series.get('thermalAdaptation')![i] = stats.thermalAdaptation;
    this.series.get('avgMutationRate')![i] = stats.avgMutationRate;
    this.series.get('maxGeneration')![i] = stats.maxGeneration;
    this.ticks[i] = stats.tick;

    this.cursor = (this.cursor + 1) % this.capacity;
    if (this.filled < this.capacity) this.filled++;
  }

  /**
   * Seriyi kronolojik sırayla döndürür. Halka tamponun sarma noktası
   * çağıranı ilgilendirmesin diye burada düzleştiriliyor.
   */
  read(key: MetricKey, out: Float32Array): number {
    const src = this.series.get(key);
    if (!src) return 0;
    const n = this.filled;
    const start = this.filled === this.capacity ? this.cursor : 0;
    for (let k = 0; k < n; k++) {
      out[k] = src[(start + k) % this.capacity]!;
    }
    return n;
  }

  get length(): number {
    return this.filled;
  }

  clear(): void {
    this.cursor = 0;
    this.filled = 0;
  }
}
