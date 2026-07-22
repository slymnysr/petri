import { createMat4, lookAt, multiply, perspective, projectToScreen, type Mat4 } from './mat4';

/**
 * Yörünge (orbit) kamerası: bir hedef noktanın etrafında döner.
 *
 * Serbest uçuş kamerası yerine yörünge seçildi çünkü buradaki iş bir dünyayı
 * *incelemek*, içinde gezinmek değil. Yörünge kamerasında kullanıcı hiçbir
 * zaman kaybolmaz; hedef daima ekranın merkezindedir.
 *
 * Sürükleme ile tıklamayı ayırt eder: kullanıcı bir organizmayı incelemek için
 * tıkladığında kameranın dönmemesi, kamerayı çevirirken de yanlışlıkla seçim
 * yapılmaması gerekiyor.
 */

const DRAG_THRESHOLD = 4; // CSS piksel
const MIN_DISTANCE = 60;
const MAX_DISTANCE = 4000;
/** Kutupları geçmeyi engeller; tam tepede lookAt tekilleşir. */
const MAX_ELEVATION = Math.PI / 2 - 0.05;

export class Camera {
  /** Yörüngenin merkezi (dünya koordinatı). */
  targetX = 0;
  targetY = 0;
  targetZ = 0;

  distance = 1200;
  /** Yatay dönüş açısı (radyan). */
  azimuth = 0.7;
  /** Dikey açı; pozitif = yukarıdan bakış. */
  elevation = 0.55;

  readonly viewProj: Mat4 = createMat4();
  private readonly view: Mat4 = createMat4();
  private readonly proj: Mat4 = createMat4();

  /** Kameranın dünya konumu — sisleme ve ışık hesabı için. */
  eyeX = 0;
  eyeY = 0;
  eyeZ = 0;

  private dragging = false;
  private moved = false;
  private panning = false;
  private lastX = 0;
  private lastY = 0;

  /** Sürükleme değil de tıklama olduğunda çağrılır (CSS piksel koordinatı). */
  onClick: ((cssX: number, cssY: number) => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  /**
   * Dünyayı tamamen görecek şekilde konumlanır.
   * Dünya merkezi orijinde olduğu için hedef sabit; uzaklık yalnızca yarıçapa
   * bağlı (kutu köşegenine değil).
   */
  frame(worldRadius: number): void {
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 0;
    this.distance = clamp(worldRadius * 2.6, MIN_DISTANCE, MAX_DISTANCE);
    this.azimuth = 0.7;
    this.elevation = 0.55;
  }

  /** Görüş-izdüşüm matrisini günceller. Her karede çağrılır. */
  update(aspect: number): void {
    const cosE = Math.cos(this.elevation);
    this.eyeX = this.targetX + this.distance * cosE * Math.cos(this.azimuth);
    this.eyeY = this.targetY + this.distance * cosE * Math.sin(this.azimuth);
    this.eyeZ = this.targetZ + this.distance * Math.sin(this.elevation);

    // Z dünyada "yukarı": simülasyonun derinlik ekseni dikey eksen.
    lookAt(
      this.view,
      this.eyeX, this.eyeY, this.eyeZ,
      this.targetX, this.targetY, this.targetZ,
      0, 0, 1,
    );
    // Uzak düzlem yörünge yarıçapına göre: sabit bir değer, uzaklaşınca
    // dünyayı kırpıyordu.
    perspective(this.proj, 0.9, aspect, 5, this.distance * 4 + 2000);
    multiply(this.viewProj, this.proj, this.view);
  }

  /** Dünya noktasının ekran konumu; kamera arkasındaysa null. */
  project(x: number, y: number, z: number, width: number, height: number) {
    return projectToScreen(this.viewProj, x, y, z, width, height);
  }

  attach(): void {
    const canvas = this.canvas;

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.moved = false;
      // Sağ tık veya shift: hedefi kaydır. Sol tık: yörüngede dön.
      this.panning = e.button === 2 || e.shiftKey;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      if (!this.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) this.moved = true;
      if (!this.moved) return;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      if (this.panning) {
        // Ekran düzleminde kaydırma: kameranın sağ ve yukarı vektörleri
        // boyunca hareket. Mesafeyle ölçeklenir ki yakınken hassas olsun.
        const scale = this.distance * 0.0016;
        const rightX = -Math.sin(this.azimuth);
        const rightY = Math.cos(this.azimuth);
        const sinE = Math.sin(this.elevation);
        const cosE = Math.cos(this.elevation);
        const upX = -Math.cos(this.azimuth) * sinE;
        const upY = -Math.sin(this.azimuth) * sinE;
        const upZ = cosE;
        this.targetX -= (rightX * dx + upX * -dy) * scale;
        this.targetY -= (rightY * dx + upY * -dy) * scale;
        this.targetZ -= upZ * -dy * scale;
      } else {
        this.azimuth -= dx * 0.006;
        this.elevation = clamp(this.elevation + dy * 0.006, -MAX_ELEVATION, MAX_ELEVATION);
      }
    });

    const endDrag = (e: PointerEvent): void => {
      if (!this.dragging) return;
      this.dragging = false;
      if (!this.moved && !this.panning && this.onClick) {
        const rect = canvas.getBoundingClientRect();
        this.onClick(e.clientX - rect.left, e.clientY - rect.top);
      }
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.distance = clamp(
          this.distance * Math.exp(e.deltaY * 0.0012),
          MIN_DISTANCE,
          MAX_DISTANCE,
        );
      },
      { passive: false },
    );
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
