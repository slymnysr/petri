import {
  BRAIN_HIDDEN,
  BRAIN_INPUTS,
  BRAIN_OUTPUTS,
  B_H_OFFSET,
  B_O_OFFSET,
  W_HO_OFFSET,
  W_IH_OFFSET,
} from './types';

/**
 * İleri besleme: girdi → gizli (tanh) → çıktı (tanh).
 *
 * Ağırlıklar organizmanın genomunda, ayrı bir nesne yok. Fonksiyon `hidden` ve
 * `out` dizilerini doldurur; çağıran isterse bunları saklar. Bu ayrım
 * yorumlanabilirlik için bilinçli: seçili organizmanın ara aktivasyonlarını
 * görebilmek, "neden sola döndü" sorusunun cevabı.
 *
 * Dizi ayırma yok — sıcak döngüde adım başına 5000 kez çağrılıyor.
 */
export function forward(
  genome: Float32Array,
  offset: number,
  inputs: Float32Array,
  hidden: Float32Array,
  out: Float32Array,
  mask: Uint8Array | null = null,
): void {
  for (let h = 0; h < BRAIN_HIDDEN; h++) {
    let sum = genome[offset + B_H_OFFSET + h]!;
    const wBase = offset + W_IH_OFFSET + h * BRAIN_INPUTS;
    for (let i = 0; i < BRAIN_INPUTS; i++) {
      sum += genome[wBase + i]! * inputs[i]!;
    }
    // Ablasyon: maske o nöronu 0'larsa aktivasyonu tamamen bastırılır. Bu,
    // "nöronu kapat, davranışın nasıl değiştiğini gör" için nedensel araç —
    // ağırlık okumaktan (korelasyonel) farklı olarak nöronun işlevini
    // doğrudan test eder. Maske null ise dal atlanır, sıcak yolda maliyeti yok.
    hidden[h] = mask !== null && mask[h] === 0 ? 0 : Math.tanh(sum);
  }

  for (let o = 0; o < BRAIN_OUTPUTS; o++) {
    let sum = genome[offset + B_O_OFFSET + o]!;
    const wBase = offset + W_HO_OFFSET + o * BRAIN_HIDDEN;
    for (let h = 0; h < BRAIN_HIDDEN; h++) {
      sum += genome[wBase + h]! * hidden[h]!;
    }
    out[o] = Math.tanh(sum);
  }
}

/**
 * Bir eylemin her duyuya olan duyarlılığı: "girdi × gradyan" atfı.
 *
 * Ham ağırlığa bakmak yanıltıcı olurdu — büyük ağırlık, girdisi sıfır olan bir
 * duyudan geliyorsa o karara hiç katkı vermemiştir. Burada gizli katmanın tanh
 * türevi (1 - h²) hesaba katılıyor, yani doymuş nöronların katkısı doğru
 * şekilde sönümleniyor.
 *
 * Sonuç işaretlidir: pozitif değer "bu duyu bu eylemi artırıyor", negatif
 * "bastırıyor" demektir.
 */
export function senseInfluence(
  genome: Float32Array,
  offset: number,
  inputs: Float32Array,
  hidden: Float32Array,
  action: number,
  out: Float32Array,
): void {
  const hoBase = offset + W_HO_OFFSET + action * BRAIN_HIDDEN;
  for (let i = 0; i < BRAIN_INPUTS; i++) {
    let grad = 0;
    for (let h = 0; h < BRAIN_HIDDEN; h++) {
      const dTanh = 1 - hidden[h]! * hidden[h]!;
      grad += genome[hoBase + h]! * dTanh * genome[offset + W_IH_OFFSET + h * BRAIN_INPUTS + i]!;
    }
    out[i] = grad * inputs[i]!;
  }
}

export interface ActionExplanation {
  /** Karara en çok katkı veren gizli nöron. */
  hiddenIndex: number;
  hiddenContribution: number;
  /** O gizli nöronu en çok süren duyu. */
  senseIndex: number;
  senseContribution: number;
}

/**
 * Bir eylemin arkasındaki en güçlü nedensel zinciri çıkarır:
 * eylem ← en baskın gizli nöron ← o nöronu süren en baskın duyu.
 *
 * Arayüzdeki "sola dönüyor çünkü yiyecek açısı" cümlesi buradan geliyor.
 */
export function explainAction(
  genome: Float32Array,
  offset: number,
  inputs: Float32Array,
  hidden: Float32Array,
  action: number,
): ActionExplanation {
  const hoBase = offset + W_HO_OFFSET + action * BRAIN_HIDDEN;
  let bestH = 0;
  let bestHValue = 0;
  for (let h = 0; h < BRAIN_HIDDEN; h++) {
    const contribution = genome[hoBase + h]! * hidden[h]!;
    if (Math.abs(contribution) > Math.abs(bestHValue)) {
      bestHValue = contribution;
      bestH = h;
    }
  }

  const ihBase = offset + W_IH_OFFSET + bestH * BRAIN_INPUTS;
  let bestI = 0;
  let bestIValue = 0;
  for (let i = 0; i < BRAIN_INPUTS; i++) {
    const contribution = genome[ihBase + i]! * inputs[i]!;
    if (Math.abs(contribution) > Math.abs(bestIValue)) {
      bestIValue = contribution;
      bestI = i;
    }
  }

  return {
    hiddenIndex: bestH,
    hiddenContribution: bestHValue,
    senseIndex: bestI,
    senseContribution: bestIValue,
  };
}

export interface NeuronRole {
  /** Gizli nöronun indeksi. */
  neuron: number;
  /** Bu nöronu en güçlü besleyen duyu. */
  senseIndex: number;
  /** O bağlantının işaretli ağırlığı: pozitif = uyarır, negatif = bastırır. */
  weight: number;
  /**
   * Nöron doymuş mu: bias'ı en büyük girdi ağırlığını ezecek kadar büyükse,
   * nöron girdilerine tepki vermeden hep açık/kapalı kalır. "İşlevsiz" değil —
   * sabit bir eğilim sağlıyor olabilir — ama bir duyuya "kulak vermiyor".
   */
  saturated: boolean;
}

/**
 * Bir organizmanın her gizli nöronunun "ne dinlediğini" çıkarır.
 *
 * Bu, gerçek mekanistik yorumlanabilirliğin oyuncak ölçekli hali: nöron
 * aktivasyonunu tahmin etmiyoruz, öğrenilmiş ağırlıkları *okuyoruz*. Bir
 * nöronun işlevi, ona giren en güçlü bağlantının hangi duyudan geldiğidir.
 *
 * Gösterdiği şey: bir beynin içinde nöronlar iş bölümü yapmış — ölçümde tek bir
 * beyindeki 10 nöron ortalama ~7 farklı duyuya uzmanlaşıyor. Yani beyin, bütün
 * duyuları tek bir yere yığmak yerine farklı nöronlara dağıtmış.
 *
 * Bir uyarı: aynı numaralı nöron (örneğin N1) popülasyonun büyük kısmında aynı
 * duyuya bakma eğiliminde — çünkü hepsi ortak bir atadan türüyor ve o çözüm
 * yayılıyor. Yani numara evrensel değil ama koşu içinde yakınsak; asıl gösterdiği
 * uzmanlaşmanın *kendisi*, hangi numaranın neye denk geldiği değil.
 *
 * Ayırma yapmamak için `out` dizisi tekrar kullanılır (uzunluk BRAIN_HIDDEN).
 */
export function describeNeurons(
  genome: Float32Array,
  offset: number,
  out: NeuronRole[],
): void {
  for (let h = 0; h < BRAIN_HIDDEN; h++) {
    const wBase = offset + W_IH_OFFSET + h * BRAIN_INPUTS;
    let bestI = 0;
    let bestW = 0;
    let maxAbs = 0;
    for (let i = 0; i < BRAIN_INPUTS; i++) {
      const w = genome[wBase + i]!;
      const a = Math.abs(w);
      if (a > maxAbs) {
        maxAbs = a;
        bestW = w;
        bestI = i;
      }
    }
    const bias = genome[offset + B_H_OFFSET + h]!;
    // Bias en güçlü girdiyi belirgin şekilde aşıyorsa nöron doymuş kabul edilir.
    const saturated = Math.abs(bias) > maxAbs * 3 + 1.5;

    const role = out[h]!;
    role.neuron = h;
    role.senseIndex = bestI;
    role.weight = bestW;
    role.saturated = saturated;
  }
}
