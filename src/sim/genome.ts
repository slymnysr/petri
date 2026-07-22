import type { Rng } from './rng';
import { GENOME_LENGTH, TRAIT_OFFSET, WEIGHT_COUNT } from './types';

/**
 * Genom düzeni: [ağırlıklar (WEIGHT_COUNT)] [fenotip genleri (TRAIT_COUNT)]
 *
 * İki blok farklı kurallara tabi:
 * - Ağırlıklar serbest gerçel sayı; sınırlamak beynin ifade gücünü kırpardı.
 * - Fenotip genleri 0..1 arasında tutulur ve kullanım anında gerçek aralığa
 *   açılır (bkz. TRAIT_RANGES). Böylece mutasyon "boyut" ile "metabolizma"
 *   üzerinde aynı göreli etkiye sahip olur; farklı ölçekler için ayrı mutasyon
 *   parametresi ayarlamak gerekmez.
 */

/** Yeni bir rastgele genom yazar. */
export function randomGenome(rng: Rng, out: Float32Array, offset: number): void {
  // Ağırlıklar: küçük başlangıç. Büyük ağırlıklar tanh'ı doyurur ve organizma
  // duyularına tepkisiz doğar — evrim böyle bir başlangıçtan zor toparlanır.
  for (let i = 0; i < WEIGHT_COUNT; i++) {
    out[offset + i] = rng.gauss() * 0.5;
  }
  for (let i = 0; i < GENOME_LENGTH - WEIGHT_COUNT; i++) {
    out[offset + TRAIT_OFFSET + i] = rng.next();
  }
}

/**
 * Ebeveyn genomunu yavruya kopyalar ve mutasyona uğratır.
 * Mutasyon gen başına bağımsız: her gen `rate` olasılıkla `scale` şiddetinde
 * gauss gürültüsü alır.
 */
export function mutateInto(
  rng: Rng,
  src: Float32Array,
  srcOffset: number,
  dst: Float32Array,
  dstOffset: number,
  rate: number,
  scale: number,
): void {
  for (let i = 0; i < WEIGHT_COUNT; i++) {
    let v = src[srcOffset + i]!;
    if (rng.next() < rate) v += rng.gauss() * scale;
    dst[dstOffset + i] = v;
  }
  for (let i = TRAIT_OFFSET; i < GENOME_LENGTH; i++) {
    let v = src[srcOffset + i]!;
    if (rng.next() < rate) v += rng.gauss() * scale;
    // Fenotip genleri aralık dışına taşarsa kenarda yansıtılır. Kırpmak
    // (clamp) genleri 0 ve 1'de biriktirir; yansıtma dağılımı bozmaz.
    if (v < 0) v = -v;
    if (v > 1) v = 2 - v;
    dst[dstOffset + i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
}

/**
 * İki genom arasındaki uzaklık (ortalama mutlak fark).
 * Soy ağacında "bu yavru atasından ne kadar uzaklaştı" ölçüsü olarak
 * kullanılacak.
 */
export function genomeDistance(
  a: Float32Array,
  aOffset: number,
  b: Float32Array,
  bOffset: number,
): number {
  let sum = 0;
  for (let i = 0; i < GENOME_LENGTH; i++) {
    sum += Math.abs(a[aOffset + i]! - b[bOffset + i]!);
  }
  return sum / GENOME_LENGTH;
}
