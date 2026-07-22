import { forward, senseInfluence } from './brain';
import { FoodField } from './food';
import { boundingBox, clampToEllipsoid, normalizedRadius, randomPointInEllipsoid } from './geometry';
import { genomeDistance, mutateInto, randomGenome } from './genome';
import { SpatialGrid } from './grid';
import { LineageLog } from './lineage';
import { OrganismPool } from './pool';
import { Rng } from './rng';
import {
  Action,
  BRAIN_HIDDEN,
  BRAIN_INPUTS,
  BRAIN_OUTPUTS,
  DEFAULT_CONFIG,
  Sense,
  TRAIT_COUNT,
  TRAIT_OFFSET,
  type SimConfig,
} from './types';

/** Adım başına maksimum yol (dünya birimi). Fenotip hızıyla çarpılır. */
const MAX_SPEED = 3.2;
/** Adım başına maksimum yatay dönüş (radyan). */
const YAW_RATE = 0.35;
/**
 * Dikey dönüş yataydan yavaş: sığ bir hacimde serbest pitch, organizmaların
 * tavan ve tabana yapışıp yatay aramayı bırakmasına yol açıyordu.
 */
const PITCH_RATE = 0.20;
/** Pitch bu açının ötesine çıkamaz — dikine dalış/tırmanış sınırı. */
const MAX_PITCH = 1.15;
/** Yaş duyusunun doyduğu adım sayısı. */
const AGE_SCALE = 2000;
/** İstatistik kayan penceresinin uzunluğu (ölüm sayısı). */
const STATS_WINDOW = 512;
/** Uzamsal grid hücre boyutu — bkz. grid.ts'teki 3B tarama hesabı. */
const CELL_SIZE = 96;

export interface WorldStats {
  tick: number;
  population: number;
  foodCount: number;
  /** Mevsim katsayısı: 1 = normal, >1 bolluk, <1 kıtlık. */
  season: number;
  births: number;
  deaths: number;
  /** Son ölümlerin ortalama ömrü. Evrim çalışıyorsa zamanla artmalı. */
  avgLifespan: number;
  /**
   * Son ölümlerin yaşam boyu beslenme sayısı (bitki + av) — asıl uygunluk
   * göstergesi. Trofik seviyeden bağımsız olsun diye ikisi birlikte sayılır.
   */
  avgFoodPerLife: number;
  maxGeneration: number;
  avgGeneration: number;
  /** Canlı popülasyonun ortalama fenotip genleri (ham 0..1). */
  avgTraits: Float32Array;
  /** Kararı sabit bias yerine gerçek bir duyudan gelen organizmaların oranı. */
  senseDrivenRatio: number;
  /** Popülasyonun ortalama dikey konumu (0 = taban, 1 = tavan). */
  avgDepth: number;
  /** Saldırganlık eşiğini aşan (avcı fenotipli) organizmaların oranı. */
  predatorRatio: number;
  /** Kümülatif avlanma olayı sayısı. */
  predationEvents: number;
  /**
   * Isı tercihi geni ile organizmanın bulunduğu enlem arasındaki korelasyon.
   *
   * Coğrafi ekotip ayrışmasının ölçütü: 0 ise popülasyon termal olarak tek
   * tip ve rastgele dağılmış, 1'e yaklaştıkça sıcak seven bireyler sıcak
   * bölgede, soğuk sevenler soğuk bölgede toplanmış demektir. Bu, kimsenin
   * programlamadığı bir yerleşim örüntüsü.
   */
  thermalAdaptation: number;
  /** O anki ortam ışığı (0 gece – 1 gündüz). */
  light: number;
  /** Popülasyonun ortalama mutasyon oranı — evrimin kendi hızı. */
  avgMutationRate: number;
}

/**
 * Simülasyon dünyası — üç boyutlu.
 *
 * `step()` içinde hiç bellek ayrılmaz: tüm tamponlar kurucuda bir kez alınır.
 * Bu, binlerce ajanda akıcı kare hızının ön şartı — adım başına birkaç küçük
 * dizi ayırmak bile GC duraklamalarına ve kare atlamalarına yol açıyor.
 */
export class World {
  readonly config: SimConfig;
  readonly rng: Rng;
  readonly pool: OrganismPool;
  readonly food: FoodField;
  readonly lineage = new LineageLog();

  private readonly organismGrid: SpatialGrid;
  private readonly foodGrid: SpatialGrid;

  tick = 0;
  births = 0;
  deaths = 0;
  /** Kümülatif avlanma olayı sayısı. */
  predationEvents = 0;

  // Sıcak döngü tamponları
  private readonly inputs = new Float32Array(BRAIN_INPUTS);
  private readonly hidden = new Float32Array(BRAIN_HIDDEN);
  private readonly outputs = new Float32Array(BRAIN_OUTPUTS);
  private readonly distSq = new Float32Array(1);
  private readonly avgTraits = new Float32Array(TRAIT_COUNT);
  /** Geometri yardımcılarının sonucunu alan tampon — sıcak yolda ayırma yok. */
  private readonly point = new Float32Array(3);

  // Ölüm istatistiği kayan penceresi
  private readonly lifespanWindow = new Float32Array(STATS_WINDOW);
  private readonly foodWindow = new Float32Array(STATS_WINDOW);
  private windowCursor = 0;
  private windowFilled = 0;

  /** Kesirli yiyecek üretimini biriktirir. */
  private foodAccumulator = 0;

  /**
   * Seçili organizmanın son beyin aktivasyonları. Görüntüleyici bunu okur;
   * -1 ise kayıt kapalı.
   */
  watchedId = -1;
  readonly watchedInputs = new Float32Array(BRAIN_INPUTS);
  readonly watchedHidden = new Float32Array(BRAIN_HIDDEN);
  readonly watchedOutputs = new Float32Array(BRAIN_OUTPUTS);

  /**
   * Ablasyon maskesi: seçili organizmanın hangi gizli nöronlarının açık (1) /
   * kapalı (0) olduğu. Yalnızca `ablatedId` kimliğine sahip organizmaya
   * uygulanır. "Nöronu kapat, davranışın nasıl bozulduğunu izle" — nöron
   * işlevini nedensel olarak test eden araç.
   */
  ablatedId = -1;
  readonly ablationMask = new Uint8Array(BRAIN_HIDDEN).fill(1);

  /** Ablasyon maskesini tamamen açar (hiç kapalı nöron yok). */
  clearAblation(): void {
    this.ablationMask.fill(1);
    this.ablatedId = -1;
  }

  /** Bir nöronu açar/kapatır ve maskeyi seçili organizmaya bağlar. */
  toggleNeuron(id: number, neuron: number): void {
    if (this.ablatedId !== id) {
      this.ablationMask.fill(1);
      this.ablatedId = id;
    }
    this.ablationMask[neuron] = this.ablationMask[neuron] === 0 ? 1 : 0;
  }

  /**
   * Kararı gerçek bir duyudan (bias değil) gelen organizmaların oranı.
   *
   * Projenin imza metriği: evrim yalnızca "daha çok yemeyi" değil, çevreye
   * *tepki vermeyi* öğretiyor mu? Kör bias davranışı sabittir, duyu-sürücülü
   * davranış tepkiseldir. Ölçüm step() içinde seyrek örneklemeyle yapılır —
   * her adımda tüm popülasyon için atıf hesaplamak pahalı olurdu.
   */
  senseDrivenRatio = 0;
  private senseHits = 0;
  private senseSamples = 0;
  private readonly influenceBuffer = new Float32Array(BRAIN_INPUTS);

  constructor(config: Partial<SimConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = new Rng(this.config.seed);
    this.pool = new OrganismPool(this.config.maxOrganisms);
    this.food = new FoodField(
      this.config.maxFood,
      this.config.worldRadius,
      this.config.verticalSquash,
      this.rng,
    );

    // Grid, elipsoidin sınırlayıcı kutusunu kaplar.
    const [bw, bh, bd] = boundingBox(this.config.worldRadius, this.config.verticalSquash);
    this.organismGrid = new SpatialGrid(bw, bh, bd, CELL_SIZE, this.config.maxOrganisms);
    this.foodGrid = new SpatialGrid(bw, bh, bd, CELL_SIZE, this.config.maxFood);

    this.seed();
  }

  /** Başlangıç popülasyonunu ve yiyeceği oluşturur. */
  seed(): void {
    const cfg = this.config;
    this.pool.reset();
    this.food.reset();
    this.lineage.clear();
    this.tick = 0;
    this.births = 0;
    this.deaths = 0;
    this.predationEvents = 0;
    this.windowCursor = 0;
    this.windowFilled = 0;
    this.foodAccumulator = 0;
    this.senseDrivenRatio = 0;
    this.senseHits = 0;
    this.senseSamples = 0;

    for (let n = 0; n < cfg.initialPopulation; n++) {
      const i = this.pool.allocate(0, 0, 0);
      if (i < 0) break;
      randomGenome(this.rng, this.pool.genome, this.pool.genomeOffset(i));
      this.pool.derivePhenotype(i);
      randomPointInEllipsoid(this.rng, cfg.worldRadius, cfg.verticalSquash, this.point);
      this.pool.x[i] = this.point[0]!;
      this.pool.y[i] = this.point[1]!;
      this.pool.z[i] = this.point[2]!;
      this.pool.yaw[i] = this.rng.range(0, Math.PI * 2);
      this.pool.pitch[i] = this.rng.range(-0.4, 0.4);
      this.pool.energy[i] = cfg.startEnergy;
      this.lineage.recordBirth(this.pool.id[i]!, 0, 0, 0, 0);
    }

    // Dünya boş başlamasın; organizmalar ilk adımdan itibaren yiyecek bulsun.
    const initialFood = Math.floor(cfg.maxFood * 0.35);
    for (let n = 0; n < initialFood; n++) {
      this.food.spawn(this.rng, cfg.worldRadius, cfg.verticalSquash);
    }
  }

  /**
   * Yeni tohumla baştan başlatır. Parametreler (yiyecek, mutasyon…) korunur;
   * yalnızca rastgelelik ve popülasyon sıfırlanır — böylece aynı ayarların
   * farklı bir başlangıçta ne ürettiği karşılaştırılabilir.
   */
  reseed(seed: number): void {
    this.config.seed = seed;
    this.rng.setState(seed);
    // Küme yenilemesi bilerek burada, seed() içinde değil: seed() ilk kurulumda
    // da çağrılıyor ve oraya konulduğunda RNG'yi fazladan tüketip aynı tohumun
    // ürettiği evrimi kaydırıyordu (testlerde yakalandı).
    this.food.respawnClusters(this.rng, this.config.worldRadius, this.config.verticalSquash);
    this.seed();
  }

  /** Mevsim katsayısı: yiyecek üretimini çarpar. */
  seasonFactor(): number {
    const cfg = this.config;
    if (cfg.seasonPeriod <= 0) return 1;
    const phase = (this.tick % cfg.seasonPeriod) / cfg.seasonPeriod;
    return 1 + cfg.seasonAmplitude * Math.sin(phase * Math.PI * 2);
  }

  /**
   * Bir noktanın sıcaklığı, 0 (soğuk) – 1 (sıcak).
   *
   * Üç bileşen: enlem gradyanı (y ekseni boyunca kalıcı fark), derinlik
   * gradyanı (taban soğuk, tavan sıcak) ve mevsimsel kayma. İlk ikisi
   * uzamsal, yani dünyanın farklı bölgeleri farklı yaşam alanları; üçüncüsü
   * zamansal, yani o alanlar mevsimle kayıyor. Coğrafi ekotip ayrışması ancak
   * bu birleşimle mümkün: sabit bir gradyan tek başına türleri yerinde
   * dondururdu, sabit olmayan bir dünya ise uzmanlaşmayı ödüllendirmezdi.
   */
  temperatureAt(y: number, z: number): number {
    const cfg = this.config;
    // Koordinatlar merkezli olduğu için enlem ve yükseklik doğrudan -1..1
    // aralığında normalize ediliyor; 0 dünyanın ortası.
    const latitude = y / cfg.worldRadius;
    const altitude = z / (cfg.worldRadius * cfg.verticalSquash);

    let t = 0.5 + latitude * 0.5 * cfg.latitudeGradient;
    t += altitude * 0.5 * cfg.depthGradient;

    if (cfg.seasonPeriod > 0) {
      const phase = (this.tick % cfg.seasonPeriod) / cfg.seasonPeriod;
      t += Math.sin(phase * Math.PI * 2) * cfg.seasonalTempShift;
    }
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  /** Ortam ışığı, 0 (gece) – 1 (tam gün). */
  lightLevel(): number {
    const cfg = this.config;
    if (cfg.dayNightPeriod <= 0) return 1;
    const phase = (this.tick % cfg.dayNightPeriod) / cfg.dayNightPeriod;
    return 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  }

  step(): void {
    const cfg = this.config;
    const pool = this.pool;
    const food = this.food;
    const radius = cfg.worldRadius;
    const squash = cfg.verticalSquash;

    this.organismGrid.build(pool.capacity, pool.x, pool.y, pool.z, pool.alive);
    this.foodGrid.build(food.capacity, food.x, food.y, food.z, food.alive);

    const inputs = this.inputs;
    const outputs = this.outputs;

    // Işık ve mevsim adım başına bir kez hesaplanır; organizmaya göre değişmez.
    const light = this.lightLevel();
    // Karanlıkta duyu menzili daralır — gece avlanma/beslenme zorlaşır ve
    // "ne zaman aktif olmalı" sorusu evrimsel bir soruya dönüşür.
    const senseScale = 1 - (1 - light) * cfg.nightSensePenalty;

    for (let i = 0; i < pool.capacity; i++) {
      if (pool.alive[i] === 0) continue;

      const x = pool.x[i]!;
      const y = pool.y[i]!;
      const z = pool.z[i]!;
      const yaw = pool.yaw[i]!;
      const pitch = pool.pitch[i]!;
      const senseRange = pool.phenoSense[i]! * senseScale;

      // ---- Duyular ----
      const foodIndex = this.foodGrid.findNearest(
        x, y, z, senseRange, -1, food.x, food.y, food.z, food.alive, this.distSq,
      );
      if (foodIndex >= 0) {
        const dist = Math.sqrt(this.distSq[0]!);
        inputs[Sense.FoodDist] = 1 - dist / senseRange;
        inputs[Sense.FoodYaw] = relativeYaw(yaw, food.x[foodIndex]! - x, food.y[foodIndex]! - y);
        inputs[Sense.FoodPitch] = relativePitch(
          pitch, food.x[foodIndex]! - x, food.y[foodIndex]! - y, food.z[foodIndex]! - z,
        );
      } else {
        inputs[Sense.FoodDist] = 0;
        inputs[Sense.FoodYaw] = 0;
        inputs[Sense.FoodPitch] = 0;
      }

      const neighborIndex = this.organismGrid.findNearest(
        x, y, z, senseRange, i, pool.x, pool.y, pool.z, pool.alive, this.distSq,
      );
      if (neighborIndex >= 0) {
        const dist = Math.sqrt(this.distSq[0]!);
        const ndx = pool.x[neighborIndex]! - x;
        const ndy = pool.y[neighborIndex]! - y;
        const ndz = pool.z[neighborIndex]! - z;
        inputs[Sense.NeighborDist] = 1 - dist / senseRange;
        inputs[Sense.NeighborYaw] = relativeYaw(yaw, ndx, ndy);
        inputs[Sense.NeighborPitch] = relativePitch(pitch, ndx, ndy, ndz);
        // Göreli boyut: komşu benden büyükse pozitif.
        inputs[Sense.NeighborSize] = clampRange(
          (pool.phenoSize[neighborIndex]! - pool.phenoSize[i]!) / 3, -1, 1,
        );
      } else {
        inputs[Sense.NeighborDist] = 0;
        inputs[Sense.NeighborYaw] = 0;
        inputs[Sense.NeighborPitch] = 0;
        inputs[Sense.NeighborSize] = 0;
      }

      inputs[Sense.Energy] = clampRange(pool.energy[i]! / cfg.reproduceThreshold, 0, 2);
      inputs[Sense.Age] = clampRange(pool.age[i]! / AGE_SCALE, 0, 1);

      // Sınır: altı yüzeyin en yakını. Dikey eksen çok daha sığ olduğu için
      // pratikte çoğu zaman tavan ya da taban baskın çıkar.
      // Sınır duyusu artık tek ve tutarlı bir büyüklük: merkezden normalize
      // uzaklık. Kutu dünyada bu "altı yüzeyin en yakını" idi ve organizmanın
      // nerede durduğuna göre farklı anlamlar taşıyordu.
      // 0 = merkez, 1 = yüzeyde.
      inputs[Sense.BoundaryDist] = normalizedRadius(x, y, z, radius, squash);

      // Isı baskısı işaretli veriliyor: organizma yalnızca "rahatsızım" değil,
      // "fazla sıcak" mı "fazla soğuk" mu olduğunu da bilmeli ki hangi yöne
      // gideceğine karar verebilsin.
      const temperature = this.temperatureAt(y, z);
      const mismatch = temperature - pool.phenoTempOptimum[i]!;
      inputs[Sense.ThermalStress] = clampRange(mismatch * 2, -1, 1);
      inputs[Sense.Light] = light;
      inputs[Sense.Bias] = 1;

      // ---- Beyin ----
      // Seçili ve ablasyon uygulanan organizma için maske geçilir; diğer
      // herkes için null (dal atlanır).
      const mask = pool.id[i] === this.ablatedId ? this.ablationMask : null;
      forward(pool.genome, pool.genomeOffset(i), inputs, this.hidden, outputs, mask);

      if (this.watchedId >= 0 && pool.id[i] === this.watchedId) {
        this.watchedInputs.set(inputs);
        this.watchedHidden.set(this.hidden);
        this.watchedOutputs.set(outputs);
      }

      // Seyrek örnekleme: her adımda havuzun 1/64'ü. Kayan pencere sayesinde
      // ölçüm popülasyon değiştikçe kendini günceller.
      if ((i & 63) === (this.tick & 63)) {
        this.sampleSenseDriven(pool.genomeOffset(i), inputs, outputs);
      }

      // ---- Hareket ----
      const drive = outputs[Action.Forward]!;
      const speed = (drive > 0 ? drive : 0) * pool.phenoSpeed[i]! * MAX_SPEED;
      const newYaw = yaw + outputs[Action.Yaw]! * YAW_RATE;
      const newPitch = clampRange(
        pitch + outputs[Action.Pitch]! * PITCH_RATE, -MAX_PITCH, MAX_PITCH,
      );
      pool.yaw[i] = newYaw;
      pool.pitch[i] = newPitch;
      pool.speed[i] = speed;

      const cosPitch = Math.cos(newPitch);
      clampToEllipsoid(
        x + Math.cos(newYaw) * cosPitch * speed,
        y + Math.sin(newYaw) * cosPitch * speed,
        z + Math.sin(newPitch) * speed,
        radius, squash, this.point,
      );
      pool.x[i] = this.point[0]!;
      pool.y[i] = this.point[1]!;
      pool.z[i] = this.point[2]!;

      const size = pool.phenoSize[i]!;
      const eatRange = size + cfg.eatMargin;
      const aggression = pool.phenoAggression[i]!;

      // ---- Beslenme: bitki ----
      // Ayrı bir grid sorgusu yapmıyoruz: duyu aşamasında bulunan en yakın
      // yiyecek zaten elimizde, hareketten sonra ona olan mesafeyi ölçmek
      // birkaç çıkarma işlemi.
      // `alive` kontrolü şart: aynı adımda başka bir organizma yemiş olabilir.
      if (outputs[Action.Eat]! > 0 && foodIndex >= 0 && food.alive[foodIndex] === 1) {
        const bdx = food.x[foodIndex]! - pool.x[i]!;
        const bdy = food.y[foodIndex]! - pool.y[i]!;
        const bdz = food.z[foodIndex]! - pool.z[i]!;
        if (bdx * bdx + bdy * bdy + bdz * bdz <= eatRange * eatRange) {
          food.consume(foodIndex);
          // Etçil fenotip bitkiden az verim alır — uzmanlaşmanın bedeli.
          const herbivory = 1 - aggression * cfg.dietSpecialization;
          pool.energy[i] = pool.energy[i]! + cfg.foodEnergy * herbivory;
          pool.foodEaten[i] = pool.foodEaten[i]! + 1;
        }
      }

      // ---- Beslenme: avlanma ----
      // Aynı "ye" çıktısı hem bitkiyi hem avı tetikler; hangisinin
      // gerçekleşeceğini organizmanın *bedeni* belirler, ayrı bir karar değil.
      // Böylece otobur/etobur ayrımı davranıştan değil fenotipten doğar ve
      // beyin mimarisi büyümeden trofik seviye ortaya çıkar.
      if (
        outputs[Action.Eat]! > 0 &&
        aggression >= cfg.predationThreshold &&
        neighborIndex >= 0 &&
        pool.alive[neighborIndex] === 1 &&
        size >= pool.phenoSize[neighborIndex]! * cfg.predationSizeRatio
      ) {
        const pdx = pool.x[neighborIndex]! - pool.x[i]!;
        const pdy = pool.y[neighborIndex]! - pool.y[i]!;
        const pdz = pool.z[neighborIndex]! - pool.z[i]!;
        if (pdx * pdx + pdy * pdy + pdz * pdz <= eatRange * eatRange) {
          const preyEnergy = pool.energy[neighborIndex]!;
          if (preyEnergy > 0) {
            pool.energy[i] = pool.energy[i]! + preyEnergy * cfg.predationEfficiency;
            pool.preyEaten[i] = pool.preyEaten[i]! + 1;
            this.predationEvents++;
            this.recordDeath(neighborIndex);
            // Avcının alamadığı kısmın bir bölümü leşe döner.
            this.dropCarrion(neighborIndex, preyEnergy);
            pool.free(neighborIndex);
          }
        }
      }

      // ---- Enerji ----
      let energy = pool.energy[i]!;
      // Büyük gövde daha pahalı; karşılığında yeme menzili geniş.
      // Yaşlanma katsayısı hayatta kalmayı zamanla pahalılaştırır: bu olmadan
      // ömür uzuyor, nesil devri duruyor ve evrim tavanda donuyor.
      const aging = 1 + pool.age[i]! * cfg.agingRate;
      // Bölen boyut aralığının ortasına göre seçildi (3–11 → ~6): normalize
      // maliyet ortalama bir gövdede 1 katsayısına denk gelsin.
      // Saldırganlık bedava değil: av arama ve saldırı hazırlığı sürekli bir
      // enerji yükü. Bu maliyet olmadan avcı olmak salt kazanç olurdu ve
      // popülasyonun tamamı avcılığa kayardı.
      const aggressionCost = 1 + aggression * 0.35;
      // Gövde maliyeti doğrusal değil karesel.
      //
      // Doğrusalken evrim tek bir dejenere çözüme kaçıyordu: azami boyut. Büyük
      // olmak hem avlanmayı mümkün kılıyor hem de avlanılmayı imkânsız (avcının
      // avından %18 büyük olması gerekiyor), yani üstünlük çift taraflıydı ve
      // bedeli buna göre hafifti. Karesel maliyet devliği gerçekten pahalı
      // kılıyor ve küçük-çevik ile büyük-güçlü arasında bir denge bırakıyor.
      const bodyCost = (size / 6) * (size / 6);
      // Isı uyumsuzluğu karesel cezalandırılır: optimuma yakın olmak neredeyse
      // bedava, uzaklaştıkça hızla pahalı. Doğrusal bir ceza gradyanı hissedilir
      // kılmaya yetmiyordu — gen sürükleniyordu.
      const thermalPenalty = 1 + mismatch * mismatch * cfg.thermalStress;
      energy -=
        cfg.baseMetabolism * pool.phenoMetabolism[i]! * bodyCost * aging *
        aggressionCost * thermalPenalty;
      // Sürüklenme de gövdeyle büyür: iri bir cismi hızlandırmak pahalıdır.
      energy -= cfg.moveCost * speed * speed * (size / 6);
      pool.energy[i] = energy;
      pool.age[i] = pool.age[i]! + 1;

      // ---- Üreme ----
      if (energy > cfg.reproduceThreshold && outputs[Action.Reproduce]! > 0) {
        const child = pool.allocate(pool.id[i]!, pool.generation[i]! + 1, this.tick);
        if (child >= 0) {
          // Mutasyon oranı ebeveynin kendi geninden gelir; config'deki değer
          // artık küresel bir çarpan (kullanıcı deneyde tümünü kısıp açabilsin
          // diye). Böylece evrimin hızı da evrimleşen bir özellik oluyor.
          mutateInto(
            this.rng,
            pool.genome, pool.genomeOffset(i),
            pool.genome, pool.genomeOffset(child),
            pool.phenoMutationRate[i]! * cfg.mutationRateScale,
            cfg.mutationScale,
          );
          pool.derivePhenotype(child);
          const transfer = energy * cfg.reproduceCost;
          pool.energy[child] = transfer;
          pool.energy[i] = energy - transfer;
          clampToEllipsoid(
            pool.x[i]! + this.rng.range(-10, 10),
            pool.y[i]! + this.rng.range(-10, 10),
            pool.z[i]! + this.rng.range(-6, 6),
            radius, squash, this.point,
          );
          pool.x[child] = this.point[0]!;
          pool.y[child] = this.point[1]!;
          pool.z[child] = this.point[2]!;
          pool.yaw[child] = this.rng.range(0, Math.PI * 2);
          pool.pitch[child] = this.rng.range(-0.4, 0.4);
          this.lineage.recordBirth(
            pool.id[child]!,
            pool.id[i]!,
            pool.generation[child]!,
            this.tick,
            genomeDistance(
              pool.genome, pool.genomeOffset(i),
              pool.genome, pool.genomeOffset(child),
            ),
          );
          this.births++;
        }
      }

      // ---- Ölüm ----
      // Açlıktan ölümde enerji sıfırın altındadır, dolayısıyla leş de yoktur:
      // gövdesini zaten metabolizmasına yakmış demektir.
      if (pool.energy[i]! <= 0) {
        this.recordDeath(i);
        pool.free(i);
      }
    }

    // ---- Çevre ----
    this.foodAccumulator += cfg.foodSpawnRate * this.seasonFactor();
    while (this.foodAccumulator >= 1) {
      this.food.spawn(this.rng, radius, squash);
      this.foodAccumulator -= 1;
    }
    this.food.driftClusters(this.rng, radius, squash);

    this.tick++;
  }

  /**
   * Bir organizmanın en belirgin eyleminin gerçek bir duyudan mı yoksa sabit
   * bias'tan mı sürüldüğünü tespit eder ve kayan pencereye işler.
   */
  private sampleSenseDriven(
    offset: number,
    inputs: Float32Array,
    outputs: Float32Array,
  ): void {
    let action = 0;
    for (let o = 1; o < BRAIN_OUTPUTS; o++) {
      if (Math.abs(outputs[o]!) > Math.abs(outputs[action]!)) action = o;
    }
    senseInfluence(this.pool.genome, offset, inputs, this.hidden, action, this.influenceBuffer);

    let top = 0;
    for (let s = 1; s < BRAIN_INPUTS; s++) {
      if (Math.abs(this.influenceBuffer[s]!) > Math.abs(this.influenceBuffer[top]!)) top = s;
    }

    this.senseSamples++;
    if (top !== Sense.Bias) this.senseHits++;

    if (this.senseSamples >= 512) {
      this.senseDrivenRatio = this.senseHits / this.senseSamples;
      this.senseHits = 0;
      this.senseSamples = 0;
    }
  }

  /**
   * Ölen organizmanın gövdesini yiyeceğe çevirir.
   *
   * Miktar boyutla orantılı: büyük bir gövde daha çok madde bırakır. Bu,
   * enerjinin tek yönlü akmasını engelleyip döngüyü kapatıyor — ayrıca
   * leşçilik gibi bir davranışın ortaya çıkabileceği zemini hazırlıyor.
   */
  private dropCarrion(index: number, energyAtDeath: number): void {
    if (energyAtDeath <= 0) return; // açlıktan ölen geriye madde bırakmaz
    const amount = Math.floor(
      (energyAtDeath * this.config.carrionYield) / this.config.foodEnergy,
    );
    for (let k = 0; k < amount; k++) {
      this.food.spawnAt(
        this.pool.x[index]!,
        this.pool.y[index]!,
        this.pool.z[index]!,
        this.config.worldRadius,
        this.config.verticalSquash,
        this.rng,
      );
    }
  }

  private recordDeath(index: number): void {
    this.deaths++;
    this.lineage.recordDeath(this.pool.id[index]!, this.tick, this.pool.foodEaten[index]!);
    this.lifespanWindow[this.windowCursor] = this.pool.age[index]!;
    // Bitki ve av birlikte sayılıyor: avcılık eklendiğinde yalnızca bitkiyi
    // saymak metriği bozdu — başarılı bir avcı, bitki yerine avla beslendiği
    // için "verimsiz" görünüyordu. Ölçülmek istenen şey beslenme tarzı değil,
    // yaşam boyu beslenme başarısı.
    this.foodWindow[this.windowCursor] =
      this.pool.foodEaten[index]! + this.pool.preyEaten[index]!;
    this.windowCursor = (this.windowCursor + 1) % STATS_WINDOW;
    if (this.windowFilled < STATS_WINDOW) this.windowFilled++;
  }

  getStats(): WorldStats {
    const pool = this.pool;
    let lifespanSum = 0;
    let foodSum = 0;
    for (let i = 0; i < this.windowFilled; i++) {
      lifespanSum += this.lifespanWindow[i]!;
      foodSum += this.foodWindow[i]!;
    }

    this.avgTraits.fill(0);
    let maxGen = 0;
    let genSum = 0;
    let depthSum = 0;
    let predators = 0;
    // Isı tercihi ↔ enlem korelasyonu için toplamlar
    let sLat = 0, sGene = 0, sLatLat = 0, sGeneGene = 0, sLatGene = 0;
    let mutationSum = 0;

    for (let i = 0; i < pool.capacity; i++) {
      if (pool.alive[i] === 0) continue;
      const gen = pool.generation[i]!;
      if (gen > maxGen) maxGen = gen;
      genSum += gen;
      depthSum += pool.z[i]!;
      if (pool.phenoAggression[i]! >= this.config.predationThreshold) predators++;

      mutationSum += pool.phenoMutationRate[i]!;
      // -1..1 → 0..1: korelasyon ölçeğe duyarsız ama okunabilirlik için
      // enlemi kutuplu gösterimde tutuyoruz.
      const lat = pool.y[i]! / this.config.worldRadius * 0.5 + 0.5;
      const pref = pool.phenoTempOptimum[i]!;
      sLat += lat;
      sGene += pref;
      sLatLat += lat * lat;
      sGeneGene += pref * pref;
      sLatGene += lat * pref;
      const base = pool.genomeOffset(i) + TRAIT_OFFSET;
      for (let t = 0; t < TRAIT_COUNT; t++) {
        this.avgTraits[t] = this.avgTraits[t]! + pool.genome[base + t]!;
      }
    }
    if (pool.count > 0) {
      for (let t = 0; t < TRAIT_COUNT; t++) {
        this.avgTraits[t] = this.avgTraits[t]! / pool.count;
      }
    }

    // Pearson korelasyonu; varyans sıfırsa (tek tip popülasyon) tanımsız,
    // o durumda "ayrışma yok" demek doğru cevap.
    let thermalAdaptation = 0;
    if (pool.count > 1) {
      const n = pool.count;
      const covariance = sLatGene / n - (sLat / n) * (sGene / n);
      const varLat = sLatLat / n - (sLat / n) ** 2;
      const varGene = sGeneGene / n - (sGene / n) ** 2;
      const denom = Math.sqrt(varLat * varGene);
      if (denom > 1e-9) thermalAdaptation = covariance / denom;
    }

    return {
      tick: this.tick,
      population: pool.count,
      foodCount: this.food.count,
      season: this.seasonFactor(),
      births: this.births,
      deaths: this.deaths,
      avgLifespan: this.windowFilled > 0 ? lifespanSum / this.windowFilled : 0,
      avgFoodPerLife: this.windowFilled > 0 ? foodSum / this.windowFilled : 0,
      maxGeneration: maxGen,
      avgGeneration: pool.count > 0 ? genSum / pool.count : 0,
      avgTraits: this.avgTraits,
      senseDrivenRatio: this.senseDrivenRatio,
      // 0 = taban, 0.5 = orta düzlem, 1 = tavan
      avgDepth: pool.count > 0
        ? depthSum / pool.count / (this.config.worldRadius * this.config.verticalSquash) * 0.5 + 0.5
        : 0,
      predatorRatio: pool.count > 0 ? predators / pool.count : 0,
      predationEvents: this.predationEvents,
      thermalAdaptation,
      light: this.lightLevel(),
      avgMutationRate: mutationSum / Math.max(1, pool.count),
    };
  }

  /**
   * Bir dünya noktasına en yakın canlı organizmanın indeksi (yarıçap içinde).
   * Tıklamayla seçim için; lineer tarama yeterli çünkü kare başına değil,
   * yalnızca kullanıcı tıkladığında çağrılıyor.
   */
  findNearestOrganism(x: number, y: number, z: number, radius: number): number {
    const pool = this.pool;
    let best = -1;
    let bestD2 = radius * radius;
    for (let i = 0; i < pool.capacity; i++) {
      if (pool.alive[i] === 0) continue;
      const dx = pool.x[i]! - x;
      const dy = pool.y[i]! - y;
      const dz = pool.z[i]! - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    return best;
  }

  /**
   * Yapay seçilim — kullanıcı bir organizmayı ödüllendirir: genomu (mutasyonla)
   * birkaç yavruya kopyalanır. Beynin üreme kararını beklemiyoruz; bu "seni
   * seçtim, üre" demek — köpek ırkları gibi. Kullanıcı bir özelliği tutarlı
   * ödüllendirdiğinde o özellik popülasyonda yayılır.
   */
  reward(id: number, offspring = 3): void {
    const parent = this.indexOfId(id);
    if (parent < 0) return;
    const cfg = this.config;
    for (let k = 0; k < offspring; k++) {
      const child = this.pool.allocate(this.pool.id[parent]!, this.pool.generation[parent]! + 1, this.tick);
      if (child < 0) break;
      mutateInto(
        this.rng,
        this.pool.genome, this.pool.genomeOffset(parent),
        this.pool.genome, this.pool.genomeOffset(child),
        this.pool.phenoMutationRate[parent]! * cfg.mutationRateScale,
        cfg.mutationScale,
      );
      this.pool.derivePhenotype(child);
      this.pool.energy[child] = cfg.startEnergy;
      clampToEllipsoid(
        this.pool.x[parent]! + this.rng.range(-12, 12),
        this.pool.y[parent]! + this.rng.range(-12, 12),
        this.pool.z[parent]! + this.rng.range(-8, 8),
        cfg.worldRadius, cfg.verticalSquash, this.point,
      );
      this.pool.x[child] = this.point[0]!;
      this.pool.y[child] = this.point[1]!;
      this.pool.z[child] = this.point[2]!;
      this.pool.yaw[child] = this.rng.range(0, Math.PI * 2);
      this.pool.pitch[child] = this.rng.range(-0.4, 0.4);
      this.lineage.recordBirth(
        this.pool.id[child]!, this.pool.id[parent]!, this.pool.generation[child]!, this.tick,
        genomeDistance(
          this.pool.genome, this.pool.genomeOffset(parent),
          this.pool.genome, this.pool.genomeOffset(child),
        ),
      );
      this.births++;
    }
  }

  /** Yapay seçilim — kullanıcı bir organizmayı ayıklar: soyunu sürdürmesin. */
  cull(id: number): void {
    const index = this.indexOfId(id);
    if (index < 0) return;
    this.recordDeath(index);
    this.pool.free(index);
  }

  /** Verilen kimliğe sahip canlı organizmanın havuz indeksi, yoksa -1. */
  indexOfId(id: number): number {
    const pool = this.pool;
    for (let i = 0; i < pool.capacity; i++) {
      if (pool.alive[i] === 1 && pool.id[i] === id) return i;
    }
    return -1;
  }
}

/**
 * Hedefin yatay düzlemdeki açısının, organizmanın baktığı yöne göre farkı.
 * [-1, 1]'e normalize: 0 = tam önümde, ±1 = tam arkamda.
 */
function relativeYaw(yaw: number, dx: number, dy: number): number {
  let diff = Math.atan2(dy, dx) - yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff / Math.PI;
}

/**
 * Hedefin dikey açısının, organizmanın eğimine göre farkı.
 * Pitch doğası gereği [-π/2, π/2] arasında olduğu için sarma gerekmiyor.
 */
function relativePitch(pitch: number, dx: number, dy: number, dz: number): number {
  const horizontal = Math.sqrt(dx * dx + dy * dy);
  const targetPitch = Math.atan2(dz, horizontal);
  return clampRange((targetPitch - pitch) / (Math.PI / 2), -1, 1);
}

function clampRange(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
