/**
 * Asgari 4×4 matris işlemleri — sütun-öncelikli (WebGL düzeni).
 *
 * Dış kütüphane yerine bunu yazmanın sebebi projenin sıfır bağımlılık
 * kuralı: gerekli olan yalnızca üç fonksiyon ve hepsi otuz satır. Tam bir
 * matris kütüphanesi bu iş için fazlasıyla büyük olurdu.
 */

export type Mat4 = Float32Array;

export function createMat4(): Mat4 {
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  return m;
}

/** Perspektif izdüşüm. fov dikey, radyan cinsinden. */
export function perspective(
  out: Mat4,
  fovY: number,
  aspect: number,
  near: number,
  far: number,
): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

/** Kamera görüş matrisi. */
export function lookAt(
  out: Mat4,
  eyeX: number, eyeY: number, eyeZ: number,
  centerX: number, centerY: number, centerZ: number,
  upX: number, upY: number, upZ: number,
): Mat4 {
  let zx = eyeX - centerX;
  let zy = eyeY - centerY;
  let zz = eyeZ - centerZ;
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;

  let xx = upY * zz - upZ * zy;
  let xy = upZ * zx - upX * zz;
  let xz = upX * zy - upY * zx;
  len = Math.hypot(xx, xy, xz);
  if (len === 0) {
    // Bakış yönü up ile aynı hizada; keyfi bir dik eksen seç.
    xx = 1; xy = 0; xz = 0;
  } else {
    xx /= len; xy /= len; xz /= len;
  }

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eyeX + xy * eyeY + xz * eyeZ);
  out[13] = -(yx * eyeX + yy * eyeY + yz * eyeZ);
  out[14] = -(zx * eyeX + zy * eyeY + zz * eyeZ);
  out[15] = 1;
  return out;
}

/** out = a × b */
export function multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4]!;
    const b1 = b[c * 4 + 1]!;
    const b2 = b[c * 4 + 2]!;
    const b3 = b[c * 4 + 3]!;
    out[c * 4] = a[0]! * b0 + a[4]! * b1 + a[8]! * b2 + a[12]! * b3;
    out[c * 4 + 1] = a[1]! * b0 + a[5]! * b1 + a[9]! * b2 + a[13]! * b3;
    out[c * 4 + 2] = a[2]! * b0 + a[6]! * b1 + a[10]! * b2 + a[14]! * b3;
    out[c * 4 + 3] = a[3]! * b0 + a[7]! * b1 + a[11]! * b2 + a[15]! * b3;
  }
  return out;
}

/**
 * Dünya noktasını kırpma uzayına taşır ve ekran koordinatına çevirir.
 * Nokta kameranın arkasındaysa null döner — 3B seçimde bu kontrol olmadan
 * arkadaki nesneler ekranın ortasına düşmüş gibi görünür.
 */
export function projectToScreen(
  m: Mat4,
  x: number, y: number, z: number,
  viewportWidth: number, viewportHeight: number,
): { sx: number; sy: number; depth: number } | null {
  const cx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
  const cy = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
  const cz = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
  const cw = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
  if (cw <= 0.0001) return null;
  const invW = 1 / cw;
  return {
    sx: (cx * invW * 0.5 + 0.5) * viewportWidth,
    sy: (0.5 - cy * invW * 0.5) * viewportHeight,
    depth: cz * invW,
  };
}
