import {
  GENOME_LENGTH,
  TRAIT_OFFSET,
  TRAIT_RANGES,
  Trait,
  type SimConfig,
} from './types';

/**
 * Organizma havuzu — Structure of Arrays.
 *
 * Organizma nesnesi yok, her alan ayrı bir typed array. Sebep: 5000+ ajanda
 * nesne başına GC baskısı ve dağınık bellek erişimi kabul edilemez. Bellek bir
 * kez ayrılır (capacity kadar) ve asla büyümez; ölen organizmanın yuvası
 * serbest listeye döner ve yeniden kullanılır.
 *
 * `alive` bayrağı kullanıyoruz, yoğun paketleme (swap-remove) değil. Yoğun dizi
 * iterasyonu biraz daha hızlı olurdu ama indeksler her ölümde kayardı; seçili
 * organizmayı ve soy ağacını takip etmek zorlaşırdı. Kapasite taraması 6000
 * elemanda mikrosaniyeler sürüyor, bu takas değmez.
 */
export class OrganismPool {
  readonly capacity: number;

  // Konum ve hareket. Yön iki açıyla tutuluyor (yaw = yatay, pitch = dikey);
  // kuaternion ya da vektör yönelim bu ölçekte gereksiz, iki açı yeterli ve
  // beyin çıktılarına doğrudan karşılık geliyor.
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly yaw: Float32Array;
  readonly pitch: Float32Array;
  readonly speed: Float32Array;

  // Durum
  readonly energy: Float32Array;
  readonly age: Float32Array;
  readonly alive: Uint8Array;

  // Kimlik ve soy — yorumlanabilirlik katmanının dayanağı
  readonly id: Uint32Array;
  readonly parentId: Uint32Array;
  readonly generation: Uint32Array;
  readonly birthTick: Uint32Array;
  /** Yaşamı boyunca yediği yiyecek — evrimin işe yaradığının ölçüsü. */
  readonly foodEaten: Float32Array;
  /** Yaşamı boyunca avladığı organizma sayısı — trofik seviyenin göstergesi. */
  readonly preyEaten: Float32Array;

  // Genom: capacity × GENOME_LENGTH, satır bazlı
  readonly genome: Float32Array;

  /**
   * Fenotip önbelleği. Genomdaki 0..1 değerleri gerçek aralıklara açmak her
   * adımda tekrarlanacak bir iş; doğumda bir kez hesaplayıp saklıyoruz.
   */
  readonly phenoSize: Float32Array;
  readonly phenoSpeed: Float32Array;
  readonly phenoSense: Float32Array;
  readonly phenoMetabolism: Float32Array;
  readonly phenoHue: Float32Array;
  readonly phenoAggression: Float32Array;
  readonly phenoTempOptimum: Float32Array;
  readonly phenoMutationRate: Float32Array;

  /** Canlı organizma sayısı. */
  count = 0;

  private readonly freeList: Int32Array;
  private freeCount: number;
  private nextId = 1;

  constructor(capacity: number) {
    this.capacity = capacity;

    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.yaw = new Float32Array(capacity);
    this.pitch = new Float32Array(capacity);
    this.speed = new Float32Array(capacity);

    this.energy = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.alive = new Uint8Array(capacity);

    this.id = new Uint32Array(capacity);
    this.parentId = new Uint32Array(capacity);
    this.generation = new Uint32Array(capacity);
    this.birthTick = new Uint32Array(capacity);
    this.foodEaten = new Float32Array(capacity);
    this.preyEaten = new Float32Array(capacity);

    this.genome = new Float32Array(capacity * GENOME_LENGTH);

    this.phenoSize = new Float32Array(capacity);
    this.phenoSpeed = new Float32Array(capacity);
    this.phenoSense = new Float32Array(capacity);
    this.phenoMetabolism = new Float32Array(capacity);
    this.phenoHue = new Float32Array(capacity);
    this.phenoAggression = new Float32Array(capacity);
    this.phenoTempOptimum = new Float32Array(capacity);
    this.phenoMutationRate = new Float32Array(capacity);

    // Serbest liste ters sırada doldurulur ki ilk spawn'lar 0,1,2... alsın.
    this.freeList = new Int32Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.freeList[i] = capacity - 1 - i;
    }
    this.freeCount = capacity;
  }

  /** Genomun havuz içindeki başlangıç ofseti. */
  genomeOffset(index: number): number {
    return index * GENOME_LENGTH;
  }

  /**
   * Boş bir yuva ayırır ve kimliklendirir. Havuz doluysa -1 döner —
   * çağıran tarafın bunu kontrol etmesi gerekir, sessizce taşma yok.
   */
  allocate(parentId: number, generation: number, tick: number): number {
    if (this.freeCount === 0) return -1;
    const index = this.freeList[--this.freeCount]!;

    this.alive[index] = 1;
    this.id[index] = this.nextId++;
    this.parentId[index] = parentId;
    this.generation[index] = generation;
    this.birthTick[index] = tick;
    this.age[index] = 0;
    this.foodEaten[index] = 0;
    this.preyEaten[index] = 0;
    this.count++;

    return index;
  }

  /** Organizmayı öldürür ve yuvasını serbest listeye iade eder. */
  free(index: number): void {
    if (this.alive[index] === 0) return;
    this.alive[index] = 0;
    this.freeList[this.freeCount++] = index;
    this.count--;
  }

  /**
   * Genomdaki ham 0..1 genlerini fenotip önbelleğine açar.
   * Doğumdan hemen sonra bir kez çağrılır.
   */
  derivePhenotype(index: number): void {
    const base = this.genomeOffset(index) + TRAIT_OFFSET;
    this.phenoSize[index] = expand(this.genome[base + Trait.Size]!, Trait.Size);
    this.phenoSpeed[index] = expand(this.genome[base + Trait.Speed]!, Trait.Speed);
    this.phenoSense[index] = expand(this.genome[base + Trait.SenseRange]!, Trait.SenseRange);
    this.phenoMetabolism[index] = expand(
      this.genome[base + Trait.Metabolism]!,
      Trait.Metabolism,
    );
    this.phenoHue[index] = expand(this.genome[base + Trait.Hue]!, Trait.Hue);
    this.phenoAggression[index] = expand(
      this.genome[base + Trait.Aggression]!,
      Trait.Aggression,
    );
    this.phenoTempOptimum[index] = expand(
      this.genome[base + Trait.TempOptimum]!,
      Trait.TempOptimum,
    );
    this.phenoMutationRate[index] = expand(
      this.genome[base + Trait.MutationRate]!,
      Trait.MutationRate,
    );
  }

  /** Havuzu tamamen boşaltır (senaryo yüklerken kullanılır). */
  reset(): void {
    this.alive.fill(0);
    for (let i = 0; i < this.capacity; i++) {
      this.freeList[i] = this.capacity - 1 - i;
    }
    this.freeCount = this.capacity;
    this.count = 0;
    this.nextId = 1;
  }
}

/** 0..1 arasındaki geni ilgili özelliğin gerçek aralığına açar. */
export function expand(gene: number, trait: number): number {
  const [min, max] = TRAIT_RANGES[trait]!;
  const clamped = gene < 0 ? 0 : gene > 1 ? 1 : gene;
  return min + clamped * (max - min);
}

/** Havuzu config'e göre kurar. */
export function createPool(config: SimConfig): OrganismPool {
  return new OrganismPool(config.maxOrganisms);
}
