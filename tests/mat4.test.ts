import { describe, expect, it } from 'vitest';
import {
  createMat4,
  lookAt,
  multiply,
  perspective,
  projectToScreen,
} from '../src/render/mat4';

/**
 * Render katmanının matematiği.
 *
 * WebGL'in kendisi burada test edilemez (tarayıcı gerekir) ama izdüşüm
 * matematiği saf fonksiyonlardan ibaret ve tıklamayla organizma seçimi
 * doğrudan buna dayanıyor: `projectToScreen` yanlışsa kullanıcı bir canlıya
 * tıkladığında başka birini seçer.
 */

describe('Mat4', () => {
  it('birim matris köşegeni 1', () => {
    const m = createMat4();
    expect(Array.from(m)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it('birim matrisle çarpım değiştirmez', () => {
    const identity = createMat4();
    const p = perspective(createMat4(), 0.9, 1.5, 1, 1000);
    const out = multiply(createMat4(), p, identity);
    for (let i = 0; i < 16; i++) {
      expect(out[i]).toBeCloseTo(p[i]!, 10);
    }
  });

  it('perspektif matrisi en-boy oranını yansıtır', () => {
    const wide = perspective(createMat4(), 0.9, 2, 1, 1000);
    const square = perspective(createMat4(), 0.9, 1, 1, 1000);
    // Geniş ekranda yatay ölçek küçülür (aynı görüş açısı daha çok alan kaplar)
    expect(wide[0]!).toBeLessThan(square[0]!);
    // Dikey ölçek en-boy oranından etkilenmez
    expect(wide[5]).toBeCloseTo(square[5]!, 10);
  });

  it('lookAt kamerayı hedefe bakacak şekilde kurar', () => {
    // Kamera +x'te, orijine bakıyor, z yukarı.
    const view = lookAt(createMat4(), 100, 0, 0, 0, 0, 0, 0, 0, 1);
    // Hedef, görüş uzayında kameranın tam önünde (−z yönünde) olmalı.
    const tx = view[12]!;
    const ty = view[13]!;
    const tz = view[14]!;
    expect(tx).toBeCloseTo(0, 6);
    expect(ty).toBeCloseTo(0, 6);
    expect(tz).toBeCloseTo(-100, 4);
  });

  it('lookAt bakış yönü up ile aynı hizadayken tekilleşmez', () => {
    // Kamera tam tepede ve up da +z: cross çarpımı sıfır vektör verir.
    // Kod bu durumda yedek bir eksene düşmeli, NaN üretmemeli.
    const view = lookAt(createMat4(), 0, 0, 100, 0, 0, 0, 0, 0, 1);
    for (let i = 0; i < 16; i++) {
      expect(Number.isFinite(view[i]!)).toBe(true);
    }
  });
});

describe('Ekrana izdüşüm', () => {
  /** Kamera +x'te, orijine bakan tipik bir kurulum. */
  function setup(distance = 500, aspect = 2) {
    const view = lookAt(createMat4(), distance, 0, 0, 0, 0, 0, 0, 0, 1);
    const proj = perspective(createMat4(), 0.9, aspect, 5, 5000);
    return multiply(createMat4(), proj, view);
  }

  it('merkezdeki nokta ekranın ortasına düşer', () => {
    const vp = setup();
    const p = projectToScreen(vp, 0, 0, 0, 1000, 500);
    expect(p).not.toBeNull();
    expect(p!.sx).toBeCloseTo(500, 3);
    expect(p!.sy).toBeCloseTo(250, 3);
  });

  it('kameranın arkasındaki nokta null döner', () => {
    // Bu kontrol olmadan arkadaki nesneler ekranın ortasına düşmüş gibi
    // görünür ve tıklama yanlış organizmayı seçer.
    const vp = setup();
    const behind = projectToScreen(vp, 2000, 0, 0, 1000, 500);
    expect(behind).toBeNull();
  });

  it('yukarıdaki nokta ekranda yukarıda görünür', () => {
    // Ekran y ekseni aşağı doğru artar; dünyada +z yukarı.
    const vp = setup();
    const up = projectToScreen(vp, 0, 0, 100, 1000, 500);
    expect(up).not.toBeNull();
    expect(up!.sy).toBeLessThan(250);
  });

  it('uzaktaki nokta merkeze daha yakın düşer (perspektif)', () => {
    const vp = setup();
    const near = projectToScreen(vp, 0, 100, 0, 1000, 500);
    const far = projectToScreen(vp, -2000, 100, 0, 1000, 500);
    expect(near).not.toBeNull();
    expect(far).not.toBeNull();
    // Aynı yanal ofset, daha uzakta daha küçük ekran sapması üretir
    expect(Math.abs(far!.sx - 500)).toBeLessThan(Math.abs(near!.sx - 500));
  });

  it('derinlik değeri uzaklıkla artar', () => {
    // Seçimde üst üste binen organizmalarda "öndeki kazanır" kuralı buna
    // dayanıyor.
    const vp = setup();
    const near = projectToScreen(vp, 200, 0, 0, 1000, 500);
    const far = projectToScreen(vp, -200, 0, 0, 1000, 500);
    expect(near!.depth).toBeLessThan(far!.depth);
  });
});
