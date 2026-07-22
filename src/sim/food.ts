import { clampToEllipsoid, randomPointInEllipsoid } from './geometry';
import type { Rng } from './rng';

/**
 * Yiyecek alanı — organizma havuzunun sadeleştirilmiş hali.
 *
 * Yiyecekler kümeler halinde belirir, düzgün dağılmaz. Sebep tasarım kararı:
 * düzgün dağılım yalnızca "yiyeceğe doğru git" stratejisini ödüllendirir ve
 * evrim orada durur. Kümelenme, "bir kümeyi bulunca etrafında kal" gibi daha
 * ilginç davranışların ortaya çıkmasına alan açar.
 *
 * Kümeler dikeyde bilerek daha dar yayılıyor (VERTICAL_SPREAD_RATIO): bu,
 * yiyeceğin belirli derinlik katmanlarında yoğunlaşmasını sağlıyor ve dikey
 * konumu stratejik bir seçim haline getiriyor.
 */
const VERTICAL_SPREAD_RATIO = 0.34;

export class FoodField {
  readonly capacity: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly alive: Uint8Array;

  count = 0;

  private readonly freeList: Int32Array;
  private freeCount: number;

  /** Yiyeceğin belirdiği kümelerin merkezleri. */
  private readonly clusterX: Float32Array;
  private readonly clusterY: Float32Array;
  private readonly clusterZ: Float32Array;
  private readonly clusterCount: number;

  /** Sıcak yolda ayırma yapmamak için tekrar kullanılan geçici tampon. */
  private readonly scratch = new Float32Array(3);

  constructor(
    capacity: number,
    radius: number,
    squash: number,
    rng: Rng,
    clusters = 14,
  ) {
    this.capacity = capacity;
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.alive = new Uint8Array(capacity);

    this.freeList = new Int32Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.freeList[i] = capacity - 1 - i;
    }
    this.freeCount = capacity;

    this.clusterCount = clusters;
    this.clusterX = new Float32Array(clusters);
    this.clusterY = new Float32Array(clusters);
    this.clusterZ = new Float32Array(clusters);
    this.respawnClusters(rng, radius, squash);
  }

  /** Rastgele bir kümenin etrafında yiyecek belirir. Doluysa false döner. */
  spawn(rng: Rng, radius: number, squash: number, spread = 140): boolean {
    if (this.freeCount === 0) return false;
    const c = rng.int(this.clusterCount);

    clampToEllipsoid(
      this.clusterX[c]! + rng.gauss() * spread,
      this.clusterY[c]! + rng.gauss() * spread,
      this.clusterZ[c]! + rng.gauss() * spread * VERTICAL_SPREAD_RATIO,
      radius, squash, this.scratch,
    );

    const index = this.freeList[--this.freeCount]!;
    this.x[index] = this.scratch[0]!;
    this.y[index] = this.scratch[1]!;
    this.z[index] = this.scratch[2]!;
    this.alive[index] = 1;
    this.count++;
    return true;
  }

  /**
   * Belirli bir konumda yiyecek oluşturur — leş için.
   *
   * Ölen gövdenin madde olarak sisteme dönmesi besin döngüsünü kapatıyor:
   * avcılık olmadan enerji tek yönlü akıyor ve büyük gövdeler öldüğünde
   * biriktirdikleri her şey yok oluyordu.
   */
  spawnAt(
    x: number, y: number, z: number,
    radius: number, squash: number,
    rng: Rng, scatter = 9,
  ): boolean {
    if (this.freeCount === 0) return false;

    // Sınıra yakın ölümlerde saçılma hacmin dışına taşabilir; kırpılmazsa
    // yiyecek görünmeyen bir yerde asılı kalır.
    clampToEllipsoid(
      x + rng.gauss() * scatter,
      y + rng.gauss() * scatter,
      z + rng.gauss() * scatter * VERTICAL_SPREAD_RATIO,
      radius, squash, this.scratch,
    );

    const index = this.freeList[--this.freeCount]!;
    this.x[index] = this.scratch[0]!;
    this.y[index] = this.scratch[1]!;
    this.z[index] = this.scratch[2]!;
    this.alive[index] = 1;
    this.count++;
    return true;
  }

  consume(index: number): void {
    if (this.alive[index] === 0) return;
    this.alive[index] = 0;
    this.freeList[this.freeCount++] = index;
    this.count--;
  }

  /**
   * Kümeleri yavaşça kaydırır. Sabit kümeler popülasyonu tek bir noktaya
   * demirlerdi; kayan kaynak, "kaynağı takip etme" baskısı yaratır.
   */
  driftClusters(rng: Rng, radius: number, squash: number, amount = 0.35): void {
    for (let i = 0; i < this.clusterCount; i++) {
      clampToEllipsoid(
        this.clusterX[i]! + rng.gauss() * amount,
        this.clusterY[i]! + rng.gauss() * amount,
        this.clusterZ[i]! + rng.gauss() * amount * VERTICAL_SPREAD_RATIO,
        radius, squash, this.scratch,
      );
      this.clusterX[i] = this.scratch[0]!;
      this.clusterY[i] = this.scratch[1]!;
      this.clusterZ[i] = this.scratch[2]!;
    }
  }

  /** Kümeleri yeni konumlara taşır — yeni bir dünya kurarken çağrılır. */
  respawnClusters(rng: Rng, radius: number, squash: number): void {
    for (let i = 0; i < this.clusterCount; i++) {
      randomPointInEllipsoid(rng, radius, squash, this.scratch);
      this.clusterX[i] = this.scratch[0]!;
      this.clusterY[i] = this.scratch[1]!;
      this.clusterZ[i] = this.scratch[2]!;
    }
  }

  reset(): void {
    this.alive.fill(0);
    for (let i = 0; i < this.capacity; i++) {
      this.freeList[i] = this.capacity - 1 - i;
    }
    this.freeCount = this.capacity;
    this.count = 0;
  }
}
