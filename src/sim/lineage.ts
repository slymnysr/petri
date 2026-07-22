/**
 * Soy kaydı — "bu organizma nereden geldi" sorusunun cevabı.
 *
 * Organizma havuzu yuvaları geri dönüştürdüğü için ölen bir bireyin verisi
 * anında kaybolur; ata zincirini sonradan takip edebilmek ayrı bir kayıt
 * gerektiriyor. Kayıt sınırlı: en eski girdiler kapasite dolunca düşer, çünkü
 * milyonlarca doğumu saklamak belleği tüketirdi. Zincir kopmuşsa arayüz bunu
 * "kayıt dışı" olarak gösterir — sessizce yanlış ata göstermez.
 */
export interface LineageEntry {
  id: number;
  parentId: number;
  generation: number;
  birthTick: number;
  /** -1 = hâlâ yaşıyor. */
  deathTick: number;
  /** Ömrü boyunca yediği yiyecek (ölünce kesinleşir). */
  foodEaten: number;
  /** Ebeveyninden genom olarak ne kadar uzaklaştı (ortalama mutlak fark). */
  mutationDistance: number;
}

export class LineageLog {
  private readonly entries = new Map<number, LineageEntry>();
  /** Ekleme sırası — kapasite dolunca en eskisi düşer. */
  private readonly order: Int32Array;
  private cursor = 0;
  private filled = 0;

  constructor(readonly capacity: number = 20000) {
    this.order = new Int32Array(capacity);
  }

  recordBirth(
    id: number,
    parentId: number,
    generation: number,
    birthTick: number,
    mutationDistance: number,
  ): void {
    if (this.filled === this.capacity) {
      const evicted = this.order[this.cursor]!;
      this.entries.delete(evicted);
    } else {
      this.filled++;
    }
    this.order[this.cursor] = id;
    this.cursor = (this.cursor + 1) % this.capacity;

    this.entries.set(id, {
      id,
      parentId,
      generation,
      birthTick,
      deathTick: -1,
      foodEaten: 0,
      mutationDistance,
    });
  }

  recordDeath(id: number, deathTick: number, foodEaten: number): void {
    const entry = this.entries.get(id);
    if (!entry) return; // kayıttan düşmüş, sorun değil
    entry.deathTick = deathTick;
    entry.foodEaten = foodEaten;
  }

  get(id: number): LineageEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Ata zinciri — en yakın atadan geriye. Kayıt dışına çıkınca durur, yani
   * dönen dizinin kısa olması zincirin gerçekten bittiği anlamına gelmez.
   */
  ancestors(id: number, maxDepth = 24): LineageEntry[] {
    const chain: LineageEntry[] = [];
    let current = this.entries.get(id);
    while (current && chain.length < maxDepth) {
      const parent = this.entries.get(current.parentId);
      if (!parent) break;
      chain.push(parent);
      current = parent;
    }
    return chain;
  }

  clear(): void {
    this.entries.clear();
    this.cursor = 0;
    this.filled = 0;
  }

  get size(): number {
    return this.entries.size;
  }
}
