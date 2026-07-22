import { describe, expect, it } from 'vitest';
import { probeOrganism } from '../src/sim/probe';
import { BRAIN_HIDDEN, BRAIN_INPUTS, GENOME_LENGTH, W_IH_OFFSET } from '../src/sim/types';

/**
 * Doğrusal sonda testi.
 *
 * Sondanın tüm değeri ayırt edebilmesinde: beynin temsil ettiği bir duyuyu
 * "okunabilir", yok saydığı bir duyuyu "okunamaz" göstermeli. Bunu yapamıyorsa
 * (her şeye yüksek R² veriyorsa) yanıltıcı bir hüner olur. Bu test o ayrımı
 * kanıtlar: kodlanan duyu ↔ kodlanmayan duyu.
 */

describe('probeOrganism', () => {
  it('kodlanan duyuyu okunabilir, kodlanmayanı okunamaz gösterir', () => {
    // Beyni elle kuruyoruz: 0..9. gizli nöronlar sırasıyla 0..9. duyuları
    // dinliyor (güçlü ağırlık). 10 (ısı baskısı) ve 11 (ışık) duyularını
    // HİÇBİR nöron okumuyor — negatif kontrol.
    const genome = new Float32Array(GENOME_LENGTH);
    for (let h = 0; h < BRAIN_HIDDEN; h++) {
      genome[W_IH_OFFSET + h * BRAIN_INPUTS + h] = 1.6; // nöron h ← duyu h
    }

    const results = probeOrganism(genome, 0, 999, 400);
    const r2 = (sense: number) => results.find((r) => r.senseIndex === sense)?.r2 ?? 0;

    // Kodlanan duyular (0..9) belirgin okunabilir olmalı.
    for (let s = 0; s < BRAIN_HIDDEN; s++) {
      expect(r2(s)).toBeGreaterThan(0.5);
    }
    // Kodlanmayan duyular (10, 11) neredeyse okunamaz olmalı.
    expect(r2(10)).toBeLessThan(0.1);
    expect(r2(11)).toBeLessThan(0.1);

    // Ayrım net olmalı: en zayıf kodlanan, en güçlü kodlanmayandan üstün.
    let minEncoded = 1;
    for (let s = 0; s < BRAIN_HIDDEN; s++) minEncoded = Math.min(minEncoded, r2(s));
    expect(minEncoded).toBeGreaterThan(Math.max(r2(10), r2(11)));
  });

  it('bias duyusunu sonuçlara katmaz', () => {
    const genome = new Float32Array(GENOME_LENGTH);
    const results = probeOrganism(genome, 0, 1, 100);
    // Bias (son duyu) sabit olduğu için R² tanımsız — listede olmamalı.
    expect(results.some((r) => r.senseIndex === BRAIN_INPUTS - 1)).toBe(false);
  });

  it('deterministik: aynı tohum aynı sonucu verir', () => {
    const genome = new Float32Array(GENOME_LENGTH);
    for (let i = 0; i < GENOME_LENGTH; i++) genome[i] = Math.sin(i) * 0.5;
    const a = probeOrganism(genome, 0, 7, 200);
    const b = probeOrganism(genome, 0, 7, 200);
    expect(a.map((r) => r.r2)).toEqual(b.map((r) => r.r2));
  });
});
