import { describe, expect, it } from 'vitest';
import { describeNeurons, forward, type NeuronRole } from '../src/sim/brain';
import {
  BRAIN_HIDDEN,
  BRAIN_INPUTS,
  BRAIN_OUTPUTS,
  B_H_OFFSET,
  GENOME_LENGTH,
  W_IH_OFFSET,
} from '../src/sim/types';

/**
 * Beyin çekirdeği ve nöron işlev keşfi testleri.
 *
 * `describeNeurons` projenin en derin yorumlanabilirlik aracı: her nöronun
 * hangi duyuya "kulak verdiğini" öğrenilmiş ağırlıklardan okur. Yanlış okursa
 * arayüz kullanıcıya yanlış bir "beyin haritası" gösterir — sessizce.
 */

function makeRoles(): NeuronRole[] {
  return Array.from({ length: BRAIN_HIDDEN }, () => ({
    neuron: 0,
    senseIndex: 0,
    weight: 0,
    saturated: false,
  }));
}

describe('forward', () => {
  it('çıktılar tanh aralığında (-1, 1) kalır', () => {
    const genome = new Float32Array(GENOME_LENGTH);
    for (let i = 0; i < GENOME_LENGTH; i++) genome[i] = (i % 7) - 3; // büyük ağırlıklar
    const inputs = new Float32Array(BRAIN_INPUTS).fill(1);
    const hidden = new Float32Array(BRAIN_HIDDEN);
    const out = new Float32Array(BRAIN_OUTPUTS);

    forward(genome, 0, inputs, hidden, out);

    for (let o = 0; o < BRAIN_OUTPUTS; o++) {
      expect(out[o]).toBeGreaterThan(-1);
      expect(out[o]).toBeLessThan(1);
    }
  });

  it('ablasyon maskesi kapatılan nöronun aktivasyonunu sıfırlar', () => {
    const genome = new Float32Array(GENOME_LENGTH);
    // Her nörona güçlü bir bias ver ki maskesiz hepsi ateşlesin
    for (let h = 0; h < BRAIN_HIDDEN; h++) genome[B_H_OFFSET + h] = 2;
    const inputs = new Float32Array(BRAIN_INPUTS);
    const hidden = new Float32Array(BRAIN_HIDDEN);
    const out = new Float32Array(BRAIN_OUTPUTS);

    // Maskesiz: tüm gizli nöronlar tanh(2) ≈ 0.96
    forward(genome, 0, inputs, hidden, out);
    for (let h = 0; h < BRAIN_HIDDEN; h++) expect(hidden[h]).toBeGreaterThan(0.9);

    // 3. nöron kapalı: yalnızca o sıfırlanmalı, diğerleri etkilenmez
    const mask = new Uint8Array(BRAIN_HIDDEN).fill(1);
    mask[3] = 0;
    forward(genome, 0, inputs, hidden, out, mask);
    expect(hidden[3]).toBe(0);
    for (let h = 0; h < BRAIN_HIDDEN; h++) {
      if (h !== 3) expect(hidden[h]).toBeGreaterThan(0.9);
    }
  });

  it('sıfır ağırlıklı beyin, bias çıktısı verir', () => {
    const genome = new Float32Array(GENOME_LENGTH); // hepsi 0
    const inputs = new Float32Array(BRAIN_INPUTS).fill(0.5);
    const hidden = new Float32Array(BRAIN_HIDDEN);
    const out = new Float32Array(BRAIN_OUTPUTS);

    forward(genome, 0, inputs, hidden, out);

    // Tüm ağırlık ve bias sıfır → gizli tanh(0)=0 → çıktı tanh(0)=0
    for (let h = 0; h < BRAIN_HIDDEN; h++) expect(hidden[h]).toBe(0);
    for (let o = 0; o < BRAIN_OUTPUTS; o++) expect(out[o]).toBe(0);
  });
});

describe('describeNeurons', () => {
  it('her nöronu en güçlü girdisiyle etiketler, işareti korur', () => {
    const genome = new Float32Array(GENOME_LENGTH);
    // 0. nöron: 5. duyuya güçlü pozitif bağlansın, gerisi zayıf
    genome[W_IH_OFFSET + 0 * BRAIN_INPUTS + 5] = 2.4;
    genome[W_IH_OFFSET + 0 * BRAIN_INPUTS + 2] = 0.3;
    // 1. nöron: 8. duyuya güçlü negatif
    genome[W_IH_OFFSET + 1 * BRAIN_INPUTS + 8] = -3.1;

    const roles = makeRoles();
    describeNeurons(genome, 0, roles);

    expect(roles[0]!.senseIndex).toBe(5);
    expect(roles[0]!.weight).toBeCloseTo(2.4, 5);
    expect(roles[0]!.saturated).toBe(false);

    expect(roles[1]!.senseIndex).toBe(8);
    expect(roles[1]!.weight).toBeCloseTo(-3.1, 5);
  });

  it('bias girdileri ezen nöronu doymuş işaretler', () => {
    const genome = new Float32Array(GENOME_LENGTH);
    // 0. nöron: küçük girdi ağırlığı, kocaman bias → doymuş
    genome[W_IH_OFFSET + 0 * BRAIN_INPUTS + 3] = 0.2;
    genome[B_H_OFFSET + 0] = 6.0;
    // 1. nöron: güçlü girdi, küçük bias → doymuş değil
    genome[W_IH_OFFSET + 1 * BRAIN_INPUTS + 4] = 2.0;
    genome[B_H_OFFSET + 1] = 0.5;

    const roles = makeRoles();
    describeNeurons(genome, 0, roles);

    expect(roles[0]!.saturated).toBe(true);
    expect(roles[1]!.saturated).toBe(false);
  });

  it('genom ofseti uygulanır — ikinci organizmanın beynini okur', () => {
    const genome = new Float32Array(GENOME_LENGTH * 2);
    // İkinci organizmanın (offset = GENOME_LENGTH) 0. nöronu 7. duyuya
    genome[GENOME_LENGTH + W_IH_OFFSET + 0 * BRAIN_INPUTS + 7] = 1.9;

    const roles = makeRoles();
    describeNeurons(genome, GENOME_LENGTH, roles);
    expect(roles[0]!.senseIndex).toBe(7);
    expect(roles[0]!.weight).toBeCloseTo(1.9, 5);
  });

  it('bir beyindeki nöronlar farklı duyulara uzmanlaşabilir', () => {
    // describeNeurons tek bir beyin içinde iş bölümünü gösterebilmeli:
    // her nöronu ayrı bir duyunun baskın olduğu şekilde kuruyoruz.
    const genome = new Float32Array(GENOME_LENGTH);
    for (let h = 0; h < BRAIN_HIDDEN; h++) {
      const sense = h % BRAIN_INPUTS;
      genome[W_IH_OFFSET + h * BRAIN_INPUTS + sense] = 2.0;
    }
    const roles = makeRoles();
    describeNeurons(genome, 0, roles);
    for (let h = 0; h < BRAIN_HIDDEN; h++) {
      expect(roles[h]!.senseIndex).toBe(h % BRAIN_INPUTS);
    }
  });
});
