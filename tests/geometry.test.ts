import { describe, expect, it } from 'vitest';
import {
  boundingBox,
  clampToEllipsoid,
  normalizedRadius,
  normalizedRadiusSq,
  randomPointInEllipsoid,
} from '../src/sim/geometry';
import { Rng } from '../src/sim/rng';

/**
 * Dünyanın şeklini tanımlayan matematiğin testi.
 *
 * Buradaki bir hata sessizce yayılır: organizmalar dünyanın dışına sızar,
 * sınır duyusu yanlış değer üretir, konum üretimi merkeze yığılır. Hiçbiri
 * çökme olarak görünmez — yalnızca evrim yanlış bir dünyada olur.
 */

const R = 400;
const S = 0.4;

describe('Elipsoid geometrisi', () => {
  it('normalize uzaklık merkezde 0, yüzeyde 1', () => {
    expect(normalizedRadius(0, 0, 0, R, S)).toBe(0);
    // Yatay eksenlerde yüzey R'de
    expect(normalizedRadius(R, 0, 0, R, S)).toBeCloseTo(1, 10);
    expect(normalizedRadius(0, R, 0, R, S)).toBeCloseTo(1, 10);
    // Dikey eksende yüzey R·s'de — yassılığın tanımı bu
    expect(normalizedRadius(0, 0, R * S, R, S)).toBeCloseTo(1, 10);
    // Yarı yolda 0.5
    expect(normalizedRadius(R / 2, 0, 0, R, S)).toBeCloseTo(0.5, 10);
  });

  it('kare hali karekökle tutarlı', () => {
    const d = normalizedRadius(120, -80, 40, R, S);
    const d2 = normalizedRadiusSq(120, -80, 40, R, S);
    expect(d2).toBeCloseTo(d * d, 10);
  });

  it('içerideki noktayı olduğu gibi bırakır', () => {
    const out = new Float32Array(3);
    clampToEllipsoid(10, -20, 5, R, S, out);
    expect(out[0]).toBe(10);
    expect(out[1]).toBe(-20);
    expect(out[2]).toBe(5);
  });

  it('dışarıdaki noktayı yüzeye çeker, yönünü korur', () => {
    const out = new Float32Array(3);
    // Yüzeyin iki katı uzaklıkta bir nokta
    clampToEllipsoid(R * 2, 0, 0, R, S, out);
    expect(normalizedRadius(out[0]!, out[1]!, out[2]!, R, S)).toBeCloseTo(1, 6);
    expect(out[0]).toBeCloseTo(R, 4);

    // Eğik bir yönde: yön korunmalı, yalnızca uzaklık kırpılmalı
    const x = 500, y = -700, z = 300;
    clampToEllipsoid(x, y, z, R, S, out);
    expect(normalizedRadius(out[0]!, out[1]!, out[2]!, R, S)).toBeCloseTo(1, 6);
    // Yön: bileşen oranları değişmemeli
    expect(out[1]! / out[0]!).toBeCloseTo(y / x, 6);
    expect(out[2]! / out[0]!).toBeCloseTo(z / x, 6);
  });

  it('üretilen noktalar daima elipsoid içinde', () => {
    const rng = new Rng(3);
    const out = new Float32Array(3);
    for (let i = 0; i < 20000; i++) {
      randomPointInEllipsoid(rng, R, S, out);
      expect(normalizedRadius(out[0]!, out[1]!, out[2]!, R, S)).toBeLessThanOrEqual(1 + 1e-6);
    }
  });

  it('üretilen noktalar hacimde düzgün dağılır (merkeze yığılmaz)', () => {
    // Bu testin varlık sebebi somut bir hata: yarıçapı doğrudan rastgele
    // seçmek (∛ almadan) noktaları merkeze yığar, çünkü hacim yarıçapın
    // küpüyle büyür. Görsel olarak "dünyanın ortası kalabalık" diye fark
    // edilir ama sayısal olarak sessizdir.
    //
    // Düzgün dağılımda, normalize yarıçapı 0.5'in altında kalan noktaların
    // oranı hacim oranına eşit olmalı: (0.5)³ = 1/8 = %12.5.
    const rng = new Rng(7);
    const out = new Float32Array(3);
    const n = 40000;
    let inner = 0;
    for (let i = 0; i < n; i++) {
      randomPointInEllipsoid(rng, R, S, out);
      if (normalizedRadius(out[0]!, out[1]!, out[2]!, R, S) < 0.5) inner++;
    }
    const ratio = inner / n;
    expect(ratio).toBeGreaterThan(0.11);
    expect(ratio).toBeLessThan(0.14);
  });

  it('üretilen noktalar yönde de düzgün dağılır (kutupta yığılmaz)', () => {
    // Yönü kutupsal açı örnekleyerek üretmek kutuplarda yığılma yaratır.
    // Gauss bileşenlerini normalleştirmek bunu önler. Ölçüt: üst ve alt
    // yarıküre yaklaşık eşit sayıda nokta almalı, ve dikey eksendeki dağılım
    // simetrik olmalı.
    const rng = new Rng(13);
    const out = new Float32Array(3);
    const n = 30000;
    let upper = 0;
    let xPositive = 0;
    for (let i = 0; i < n; i++) {
      randomPointInEllipsoid(rng, R, S, out);
      if (out[2]! > 0) upper++;
      if (out[0]! > 0) xPositive++;
    }
    expect(upper / n).toBeGreaterThan(0.48);
    expect(upper / n).toBeLessThan(0.52);
    expect(xPositive / n).toBeGreaterThan(0.48);
    expect(xPositive / n).toBeLessThan(0.52);
  });

  it('verticalSquash = 1 tam küre üretir', () => {
    expect(normalizedRadius(0, 0, R, R, 1)).toBeCloseTo(1, 10);
    const [bw, bh, bd] = boundingBox(R, 1);
    expect(bw).toBe(bh);
    expect(bh).toBe(bd);
  });

  it('sınırlayıcı kutu yassılığı yansıtır', () => {
    const [bw, bh, bd] = boundingBox(R, S);
    expect(bw).toBe(R * 2);
    expect(bh).toBe(R * 2);
    expect(bd).toBeCloseTo(R * S * 2, 10);
  });
});
