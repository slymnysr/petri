import { forward } from './brain';
import { Rng } from './rng';
import { BRAIN_HIDDEN, BRAIN_INPUTS, BRAIN_OUTPUTS, SENSE_NAMES } from './types';

/**
 * Doğrusal sonda (linear probe) — bir duyunun beyinde gerçekten kodlu olup
 * olmadığını test eder.
 *
 * Gerçek yorumlanabilirlik araştırmasında kullanılan bir yöntemin oyuncak
 * ölçekli hali. Soru şu: "yiyecek açısı" bilgisi bu beynin gizli katmanından
 * *doğrusal olarak* geri okunabiliyor mu? Okunabiliyorsa beyin o bilgiyi
 * temsil ediyor; okunamıyorsa ya yok sayıyor ya da başka bilgilerle iç içe
 * geçirmiş.
 *
 * Yöntem: seçili beyne çok sayıda rastgele duyu vektörü verilir, her biri için
 * gizli aktivasyon hesaplanır, sonra her duyu için gizli katmandan o duyuyu
 * tahmin eden bir doğrusal model (en küçük kareler) uydurulur. R² (açıklanan
 * varyans oranı) yüksekse duyu doğrusal okunabilir demektir.
 *
 * Negatif kontrol kendiliğinden gelir: beynin ağırlıklarıyla hiç kullanmadığı
 * bir duyu düşük R² verir — yani sonda "her şeyi okuyabiliyorum" diyen bir
 * hüner değil, gerçekten ayırt ediyor.
 */
export interface ProbeResult {
  senseIndex: number;
  senseName: string;
  /** Açıklanan varyans oranı, 0..1. Yüksek = doğrusal okunabilir. */
  r2: number;
}

/** Sonda için üretilen rastgele duyu vektörü, gerçekçi aralıklarda. */
function sampleInputs(rng: Rng, out: Float32Array): void {
  // Duyuların çoğu [-1,1] (açılar, göreli boyut, ısı) ya da [0,1] (uzaklıklar,
  // enerji, yaş, ışık). Bias sabittir. Aralıkları kabaca yansıtıyoruz.
  for (let i = 0; i < BRAIN_INPUTS; i++) {
    out[i] = rng.range(-1, 1);
  }
  out[BRAIN_INPUTS - 1] = 1; // Bias
}

/**
 * Seçili organizmanın beynini sondalar. `samples` kadar rastgele girdi üretip
 * her duyunun gizli katmandan doğrusal okunabilirliğini (R²) döndürür.
 */
export function probeOrganism(
  genome: Float32Array,
  offset: number,
  seed: number,
  samples = 256,
): ProbeResult[] {
  const rng = new Rng(seed);
  const inputs = new Float32Array(BRAIN_INPUTS);
  const hidden = new Float32Array(BRAIN_HIDDEN);
  const out = new Float32Array(BRAIN_OUTPUTS);

  // Veri matrisi: her satır [gizli(10) | 1], hedefler her duyu için ayrı.
  const feat = BRAIN_HIDDEN + 1; // +1 bias sütunu
  const X = new Float32Array(samples * feat);
  const Y = new Float32Array(samples * BRAIN_INPUTS);

  for (let s = 0; s < samples; s++) {
    sampleInputs(rng, inputs);
    forward(genome, offset, inputs, hidden, out);
    const xr = s * feat;
    for (let h = 0; h < BRAIN_HIDDEN; h++) X[xr + h] = hidden[h]!;
    X[xr + BRAIN_HIDDEN] = 1;
    const yr = s * BRAIN_INPUTS;
    for (let i = 0; i < BRAIN_INPUTS; i++) Y[yr + i] = inputs[i]!;
  }

  // Normal denklemler: (XᵀX) bir kez, tüm hedefler için ortak.
  const XtX = new Float64Array(feat * feat);
  for (let a = 0; a < feat; a++) {
    for (let b = a; b < feat; b++) {
      let sum = 0;
      for (let s = 0; s < samples; s++) sum += X[s * feat + a]! * X[s * feat + b]!;
      XtX[a * feat + b] = sum;
      XtX[b * feat + a] = sum;
    }
  }

  const results: ProbeResult[] = [];
  const XtY = new Float64Array(feat);
  const w = new Float64Array(feat);

  for (let i = 0; i < BRAIN_INPUTS; i++) {
    // Bias duyusu (sabit 1) anlamsız — R² tanımsız olur, atla.
    if (i === BRAIN_INPUTS - 1) continue;

    for (let a = 0; a < feat; a++) {
      let sum = 0;
      for (let s = 0; s < samples; s++) sum += X[s * feat + a]! * Y[s * BRAIN_INPUTS + i]!;
      XtY[a] = sum;
    }
    if (!solve(XtX, XtY, w, feat)) continue;

    // R² = 1 - SS_res / SS_tot
    let mean = 0;
    for (let s = 0; s < samples; s++) mean += Y[s * BRAIN_INPUTS + i]!;
    mean /= samples;
    let ssRes = 0;
    let ssTot = 0;
    for (let s = 0; s < samples; s++) {
      const xr = s * feat;
      let pred = 0;
      for (let a = 0; a < feat; a++) pred += w[a]! * X[xr + a]!;
      const y = Y[s * BRAIN_INPUTS + i]!;
      ssRes += (y - pred) * (y - pred);
      ssTot += (y - mean) * (y - mean);
    }
    const r2 = ssTot > 1e-9 ? Math.max(0, 1 - ssRes / ssTot) : 0;
    results.push({ senseIndex: i, senseName: SENSE_NAMES[i]!, r2 });
  }

  results.sort((a, b) => b.r2 - a.r2);
  return results;
}

/**
 * A·x = b'yi Gauss eliminasyonuyla çözer (kısmi pivotlama). Çözülemezse (tekil
 * matris) false döner. XtX küçük (11×11) olduğu için maliyet önemsiz.
 * XtX kopyalanmadan bozulur; çağıran her hedef için yeniden kurmaz çünkü
 * burada A'nın kopyası üzerinde çalışıyoruz.
 */
function solve(A: Float64Array, b: Float64Array, out: Float64Array, n: number): boolean {
  const M = A.slice(); // XtX'i her çağrıda bozmamak için kopya
  const y = b.slice();

  for (let col = 0; col < n; col++) {
    // Kısmi pivot
    let pivot = col;
    let maxAbs = Math.abs(M[col * n + col]!);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r * n + col]!);
      if (v > maxAbs) {
        maxAbs = v;
        pivot = r;
      }
    }
    if (maxAbs < 1e-9) return false; // tekil

    if (pivot !== col) {
      for (let c = 0; c < n; c++) {
        const t = M[col * n + c]!;
        M[col * n + c] = M[pivot * n + c]!;
        M[pivot * n + c] = t;
      }
      const t = y[col]!;
      y[col] = y[pivot]!;
      y[pivot] = t;
    }

    const diag = M[col * n + col]!;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r * n + col]! / diag;
      if (factor === 0) continue;
      for (let c = col; c < n; c++) M[r * n + c] -= factor * M[col * n + c]!;
      y[r] -= factor * y[col]!;
    }
  }

  for (let i = 0; i < n; i++) out[i] = y[i]! / M[i * n + i]!;
  return true;
}
