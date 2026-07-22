/**
 * Üç boyutlu uzamsal hash grid — komşu sorguları için.
 *
 * Her organizma her adımda en yakın yiyeceği ve en yakın komşuyu arar. Kaba
 * kuvvetle bu O(n²) demek: 5000 organizmada 25 milyon mesafe hesabı, adım
 * başına. Grid ile sorgu yalnızca ilgili hücrelere bakar.
 *
 * 3B'ye geçerken hücre boyutu kritikleşti: sorgu hacmi yarıçapın küpüyle
 * büyüyor. 2B'de 72 birimlik hücre ve 160 birimlik menzil 5×5 = 25 hücre
 * tarıyordu; aynı oran 3B'de 5×5×5 = 125 hücre ederdi. Hücre 96'ya çıkarılıp
 * azami menzil 120'ye çekilerek tarama 3×3×3 = 27 hücrede tutuldu.
 *
 * Grid her adımda sıfırdan kurulur (organizmalar hareket ediyor, artımlı
 * güncelleme daha karmaşık ve bu ölçekte daha yavaş). Kurulum counting-sort
 * mantığıyla, hiç bellek ayırmadan yapılır: say → prefix toplam → yerleştir.
 */
export class SpatialGrid {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly layers: number;

  /**
   * Dünya merkezi orijinde olduğu için (koordinatlar -R..R), hücre indeksini
   * hesaplamadan önce yarım kutu kadar kaydırıyoruz. Grid'in kendisi
   * elipsoidin sınırlayıcı kutusunu kaplar; kutunun köşelerine denk gelen
   * hücreler hep boş kalır (~%48) ama boş hücre taraması sabit zamanlı
   * olduğu için bu israf ölçülebilir bir maliyet getirmiyor.
   */
  private readonly offsetX: number;
  private readonly offsetY: number;
  private readonly offsetZ: number;

  private readonly cellCount: number;
  /** Hücre i'nin items içindeki başlangıcı: [cellStart[i], cellStart[i+1]) */
  private readonly cellStart: Int32Array;
  /** Yerleştirme sırasında kullanılan imleç. */
  private readonly cursor: Int32Array;
  private readonly items: Int32Array;

  constructor(
    worldWidth: number,
    worldHeight: number,
    worldDepth: number,
    cellSize: number,
    capacity: number,
  ) {
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(worldWidth / cellSize));
    this.rows = Math.max(1, Math.ceil(worldHeight / cellSize));
    this.layers = Math.max(1, Math.ceil(worldDepth / cellSize));
    this.cellCount = this.cols * this.rows * this.layers;

    this.offsetX = worldWidth / 2;
    this.offsetY = worldHeight / 2;
    this.offsetZ = worldDepth / 2;

    this.cellStart = new Int32Array(this.cellCount + 1);
    this.cursor = new Int32Array(this.cellCount);
    this.items = new Int32Array(capacity);
  }

  private cellIndex(x: number, y: number, z: number): number {
    let cx = Math.floor((x + this.offsetX) / this.cellSize);
    let cy = Math.floor((y + this.offsetY) / this.cellSize);
    let cz = Math.floor((z + this.offsetZ) / this.cellSize);
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    if (cz < 0) cz = 0;
    else if (cz >= this.layers) cz = this.layers - 1;
    return (cz * this.rows + cy) * this.cols + cx;
  }

  /**
   * Grid'i verilen konum dizilerinden yeniden kurar.
   * `alive` verilirse yalnızca bayrağı 1 olanlar eklenir.
   */
  build(
    capacity: number,
    xs: Float32Array,
    ys: Float32Array,
    zs: Float32Array,
    alive: Uint8Array | null,
  ): void {
    this.cellStart.fill(0);

    // 1. geçiş: hücre başına sayım (cellStart[i+1] konumunda biriktirilir)
    for (let i = 0; i < capacity; i++) {
      if (alive !== null && alive[i] === 0) continue;
      const c = this.cellIndex(xs[i]!, ys[i]!, zs[i]!);
      this.cellStart[c + 1]!++;
    }

    // 2. geçiş: prefix toplam
    for (let c = 0; c < this.cellCount; c++) {
      this.cellStart[c + 1]! += this.cellStart[c]!;
      this.cursor[c] = this.cellStart[c]!;
    }

    // 3. geçiş: yerleştirme
    for (let i = 0; i < capacity; i++) {
      if (alive !== null && alive[i] === 0) continue;
      const c = this.cellIndex(xs[i]!, ys[i]!, zs[i]!);
      this.items[this.cursor[c]!++] = i;
    }
  }

  /**
   * (x, y, z) etrafında `radius` içindeki en yakın elemanı bulur.
   * `exclude` verilirse o indeks atlanır (organizma kendini bulmasın).
   * Bulunamazsa -1 döner. Mesafe karesi `outDistSq[0]`'a yazılır.
   *
   * `alive` kontrolü sorgu anında yapılır, kurulum anında değil: grid adım
   * başında bir kez kuruluyor ama adım içinde yiyecek tüketiliyor ve organizma
   * ölüyor. Bu kontrol olmadan iki organizma aynı yiyeceği yiyebilirdi.
   */
  findNearest(
    x: number,
    y: number,
    z: number,
    radius: number,
    exclude: number,
    xs: Float32Array,
    ys: Float32Array,
    zs: Float32Array,
    alive: Uint8Array | null,
    outDistSq: Float32Array,
  ): number {
    const r2 = radius * radius;
    let bestIndex = -1;
    let bestDistSq = r2;

    const ox = x + this.offsetX;
    const oy = y + this.offsetY;
    const oz = z + this.offsetZ;
    const minCx = Math.max(0, Math.floor((ox - radius) / this.cellSize));
    const maxCx = Math.min(this.cols - 1, Math.floor((ox + radius) / this.cellSize));
    const minCy = Math.max(0, Math.floor((oy - radius) / this.cellSize));
    const maxCy = Math.min(this.rows - 1, Math.floor((oy + radius) / this.cellSize));
    const minCz = Math.max(0, Math.floor((oz - radius) / this.cellSize));
    const maxCz = Math.min(this.layers - 1, Math.floor((oz + radius) / this.cellSize));

    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const rowBase = (cz * this.rows + cy) * this.cols;
        for (let cx = minCx; cx <= maxCx; cx++) {
          const c = rowBase + cx;
          const end = this.cellStart[c + 1]!;
          for (let k = this.cellStart[c]!; k < end; k++) {
            const item = this.items[k]!;
            if (item === exclude) continue;
            if (alive !== null && alive[item] === 0) continue;
            const dx = xs[item]! - x;
            const dy = ys[item]! - y;
            const dz = zs[item]! - z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < bestDistSq) {
              bestDistSq = d2;
              bestIndex = item;
            }
          }
        }
      }
    }

    outDistSq[0] = bestIndex === -1 ? r2 : bestDistSq;
    return bestIndex;
  }
}
