import type { Rng } from './rng';

/**
 * Dünyanın geometrisi: merkezi orijinde olan yassı elipsoid.
 *
 * Kutu dünyadan buraya geçmenin üç gerekçesi vardı:
 *  - Küpün sekiz köşesi ayrıcalıklıydı; oralarda organizma üç duvarla çevrili
 *    kalıyor ve "köşeye sıkış" dejenere bir stratejiye dönüşebiliyordu.
 *  - Sınır duyusu altı yüzeyin en yakını olarak hesaplanıyordu, yani konuma
 *    göre farklı anlamlar taşıyordu. Burada tek ve tutarlı: merkezden
 *    normalize uzaklık.
 *  - Kapalı bir dünya izlenimi, kutu kafesle kurulmuyordu.
 *
 * Yassılık (verticalSquash) bilinçli: sığ bir hacimde dikey konum stratejik
 * bir kaynak oluyor. Tam kürede yükseklik yalnızca seyrelme yaratırdı.
 * `verticalSquash = 1` verildiğinde tam küre elde edilir.
 *
 * Koordinat sistemi merkezlidir: x, y ∈ [-R, R], z ∈ [-R·s, R·s].
 */

/**
 * Normalize edilmiş merkez uzaklığı: 1 = tam yüzeyde, <1 içeride, >1 dışarıda.
 * Karekök almadan karşılaştırma gereken yerler için `normalizedRadiusSq` var.
 */
export function normalizedRadius(
  x: number, y: number, z: number,
  radius: number, squash: number,
): number {
  return Math.sqrt(normalizedRadiusSq(x, y, z, radius, squash));
}

export function normalizedRadiusSq(
  x: number, y: number, z: number,
  radius: number, squash: number,
): number {
  const vertical = radius * squash;
  const nx = x / radius;
  const ny = y / radius;
  const nz = z / vertical;
  return nx * nx + ny * ny + nz * nz;
}

/**
 * Konumu elipsoidin içinde tutar; dışarıdaysa yüzeye radyal olarak çeker.
 *
 * Sonuç `out` dizisine yazılır (out[0..2]) — sıcak döngüde çağrıldığı için
 * nesne döndürmüyoruz. Konum zaten içerideyse aynen kopyalanır.
 */
export function clampToEllipsoid(
  x: number, y: number, z: number,
  radius: number, squash: number,
  out: Float32Array,
): void {
  const d2 = normalizedRadiusSq(x, y, z, radius, squash);
  if (d2 <= 1) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return;
  }
  // 1/d ile ölçeklemek noktayı elipsoid yüzeyine taşır: normalize uzaklık
  // tanım gereği ölçekle doğrusal.
  const k = 1 / Math.sqrt(d2);
  out[0] = x * k;
  out[1] = y * k;
  out[2] = z * k;
}

/**
 * Elipsoid hacminde düzgün dağılımlı rastgele nokta.
 *
 * Yöntem: küre içinde düzgün nokta üret, sonra dikey ekseni sıkıştır. Afin
 * dönüşüm düzgünlüğü bozmadığı için sonuç elipsoidde de düzgün olur.
 *
 * Yarıçapta `∛u` kullanmak şart: doğrudan `u` kullanmak noktaları merkeze
 * yığar, çünkü hacim yarıçapın küpüyle büyür. Bu, kolayca gözden kaçan ve
 * dünyanın ortasında yapay bir yoğunlaşma yaratan bir hatadır.
 */
export function randomPointInEllipsoid(
  rng: Rng,
  radius: number,
  squash: number,
  out: Float32Array,
): void {
  // Yön: bağımsız gauss bileşenlerini normalleştirmek küre yüzeyinde düzgün
  // dağılım verir (kutupsal açı örneklemenin aksine, kutuplarda yığılmaz).
  let gx = rng.gauss();
  let gy = rng.gauss();
  let gz = rng.gauss();
  let len = Math.sqrt(gx * gx + gy * gy + gz * gz);
  if (len < 1e-9) {
    gx = 1; gy = 0; gz = 0;
    len = 1;
  }
  const r = radius * Math.cbrt(rng.next());
  const scale = r / len;
  out[0] = gx * scale;
  out[1] = gy * scale;
  out[2] = gz * scale * squash;
}

/** Elipsoidin sınırlayıcı kutusunun kenar uzunlukları — grid kurulumu için. */
export function boundingBox(radius: number, squash: number): [number, number, number] {
  return [radius * 2, radius * 2, radius * squash * 2];
}
