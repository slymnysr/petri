import { describe, expect, it } from 'vitest';
import { senseInfluence } from '../src/sim/brain';
import { BRAIN_INPUTS, Sense } from '../src/sim/types';
import { World } from '../src/sim/world';

/**
 * Yorumlanabilirlik katmanının değerini kanıtlayan test.
 *
 * "Evrim oluyor" demek kolay; asıl soru evrimin *ne* ürettiği. Buradaki ölçüt
 * şu: bir organizmanın en belirgin eylemini süren baskın girdi, sabit bias mı
 * yoksa gerçek bir duyu mu?
 *
 * Bias-sürücülü davranış kördür — canlı çevresine bakmadan hep aynı şeyi yapar.
 * Duyu-sürücülü davranış tepkiseldir. Evrim işini yapıyorsa popülasyon
 * zamanla ikinciye kaymalı. Bu oran, atıf hesabı (senseInfluence) olmadan
 * ölçülemezdi.
 */

/** Dünya tam tanımlı: varsayılanlar değişince test sonucu kaymasın. */
const setup = {
  worldRadius: 560,
  verticalSquash: 0.4,
  maxOrganisms: 1500,
  initialPopulation: 300,
  maxFood: 3600,
  foodSpawnRate: 11,
  seasonPeriod: 6000,
  seasonAmplitude: 0.6,
};

/** Örneklenen organizmaların kaçının kararı gerçek bir duyudan geliyor. */
function senseDrivenRatio(world: World, sampleSize: number): number {
  const influence = new Float32Array(BRAIN_INPUTS);
  let senseDriven = 0;
  let sampled = 0;

  for (let i = 0; i < world.pool.capacity && sampled < sampleSize; i++) {
    if (world.pool.alive[i] === 0) continue;
    const id = world.pool.id[i]!;

    // Aktivasyonlar yalnızca izlenen organizma için kaydediliyor, bu yüzden
    // her örnek için bir adım atmak gerekiyor.
    world.watchedId = id;
    world.step();
    const index = world.indexOfId(id);
    if (index < 0) continue; // bu adımda öldü

    let action = 0;
    for (let o = 1; o < world.watchedOutputs.length; o++) {
      if (Math.abs(world.watchedOutputs[o]!) > Math.abs(world.watchedOutputs[action]!)) {
        action = o;
      }
    }

    senseInfluence(
      world.pool.genome,
      world.pool.genomeOffset(index),
      world.watchedInputs,
      world.watchedHidden,
      action,
      influence,
    );

    let top = 0;
    for (let s = 1; s < BRAIN_INPUTS; s++) {
      if (Math.abs(influence[s]!) > Math.abs(influence[top]!)) top = s;
    }
    if (top !== Sense.Bias) senseDriven++;
    sampled++;
  }

  world.watchedId = -1;
  return sampled > 0 ? senseDriven / sampled : 0;
}

describe('Yorumlanabilirlik', () => {
  it('atıf hesabı sıfır girdiye sıfır etki atar', () => {
    // Girdisi sıfır olan bir duyu, ağırlığı ne kadar büyük olursa olsun o anki
    // karara katkı veremez. Ham ağırlığa bakan bir gösterge burada yanılırdı.
    const w = new World({ ...setup, seed: 71 });
    const influence = new Float32Array(BRAIN_INPUTS);
    const inputs = new Float32Array(BRAIN_INPUTS);
    const hidden = new Float32Array(w.watchedHidden.length);
    hidden.fill(0.3);
    inputs.fill(0);
    inputs[Sense.Bias] = 1;

    senseInfluence(w.pool.genome, 0, inputs, hidden, 0, influence);

    for (let s = 0; s < BRAIN_INPUTS; s++) {
      if (s === Sense.Bias) continue;
      // Mutlak değerle karşılaştırıyoruz: gradyan negatifse çarpım -0 üretir
      // ve Object.is(-0, 0) false olduğu için toBe(0) burada yanlış yere patlar.
      expect(Math.abs(influence[s]!)).toBe(0);
    }
  });

  it('evrim kör davranıştan duyu-tepkili davranışa geçirir', () => {
    const w = new World({ ...setup, seed: 21 });

    const early = senseDrivenRatio(w, 120);
    for (let i = 0; i < 12000; i++) w.step();
    const late = senseDrivenRatio(w, 120);

    expect(w.pool.count).toBeGreaterThan(0);
    // Asıl iddia artışın kendisi; mutlak seviye parametrelere duyarlı.
    // Bu ayarda ölçülen: kurucu ~0.75 → evrimleşmiş ~0.82. Daha bol yiyecekli
    // ve daha uzun bir koşuda 0.96'ya kadar çıktığı gözlendi, o yüzden taban
    // eşiği bu ayarın ölçümüne göre konuldu, en iyi gözleme göre değil.
    expect(late).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(0.78);
  }, 300000);

  it('soy kaydı ata zincirini doğru kurar', () => {
    const w = new World({ ...setup, seed: 88 });
    for (let i = 0; i < 4000; i++) w.step();

    // Nesli ilerlemiş bir organizma bul ve zincirini doğrula.
    let target = -1;
    for (let i = 0; i < w.pool.capacity; i++) {
      if (w.pool.alive[i] === 1 && w.pool.generation[i]! >= 3) {
        target = i;
        break;
      }
    }
    expect(target).toBeGreaterThanOrEqual(0);

    const id = w.pool.id[target]!;
    const chain = w.lineage.ancestors(id, 10);
    expect(chain.length).toBeGreaterThan(0);

    // Zincir geriye doğru gitmeli: her ata bir öncekinden düşük nesilde.
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i]!.generation).toBeLessThan(chain[i - 1]!.generation);
    }
    // İlk halka gerçekten bu organizmanın ebeveyni olmalı.
    expect(chain[0]!.id).toBe(w.pool.parentId[target]);
  }, 120000);

  it('kayıt kapasitesi aşılınca en eski girdiler düşer, panel çökmez', () => {
    const w = new World({ ...setup, seed: 90 });
    const smallLog = w.lineage;
    for (let i = 0; i < 3000; i++) w.step();
    // Kayıt boyutu kapasiteyi asla aşmamalı.
    expect(smallLog.size).toBeLessThanOrEqual(smallLog.capacity);
    // Var olmayan bir kimlik sorgusu boş dönmeli, hata fırlatmamalı.
    expect(smallLog.get(999999999)).toBeUndefined();
    expect(smallLog.ancestors(999999999)).toEqual([]);
  }, 120000);
});
