/**
 * Simülasyonun tüm sabitleri ve tipleri.
 *
 * Buradaki isimlendirmeler yalnızca okunabilirlik için değil: yorumlanabilirlik
 * katmanı beyin görüntüleyicide bu isimleri doğrudan kullanır. Yani "3. girdi
 * nöronu" değil "yiyecek yatay açısı" yazar. Duyu/eylem eklenirse burada hem
 * sabit hem isim güncellenmeli, ikisi tek kaynaktan gelir.
 */

/** Beyin mimarisi: girdi → gizli (tanh) → çıktı. */
export const BRAIN_INPUTS = 13;
export const BRAIN_HIDDEN = 10;
export const BRAIN_OUTPUTS = 5;

/** Ağırlık düzeni: [girdi→gizli] [gizli bias] [gizli→çıktı] [çıktı bias] */
export const W_IH_COUNT = BRAIN_INPUTS * BRAIN_HIDDEN;
export const B_H_COUNT = BRAIN_HIDDEN;
export const W_HO_COUNT = BRAIN_HIDDEN * BRAIN_OUTPUTS;
export const B_O_COUNT = BRAIN_OUTPUTS;
export const WEIGHT_COUNT = W_IH_COUNT + B_H_COUNT + W_HO_COUNT + B_O_COUNT;

/** Ağırlık bloklarının genom içindeki başlangıç ofsetleri. */
export const W_IH_OFFSET = 0;
export const B_H_OFFSET = W_IH_OFFSET + W_IH_COUNT;
export const W_HO_OFFSET = B_H_OFFSET + B_H_COUNT;
export const B_O_OFFSET = W_HO_OFFSET + W_HO_COUNT;

/** Fenotip genleri — ağırlıklardan sonra gelir. */
export const Trait = {
  Size: 0,
  Speed: 1,
  SenseRange: 2,
  Metabolism: 3,
  Hue: 4,
  /**
   * Saldırganlık: organizmanın diğer canlıları avlamaya yatkınlığı.
   * Düşük değerler otobur (yalnızca yiyecek), yüksek değerler avcı davranışına
   * karşılık gelir. Trofik ayrışma bu gen üzerinden ortaya çıkar.
   */
  Aggression: 5,
  /**
   * Tercih edilen sıcaklık (0 = soğuk uç, 1 = sıcak uç). Dünyada enlem ve
   * derinliğe bağlı bir sıcaklık alanı var; bu gen organizmanın nerede rahat
   * yaşayabileceğini belirler ve coğrafi ekotip ayrışmasının taşıyıcısıdır.
   */
  TempOptimum: 6,
  /**
   * Organizmanın kendi mutasyon oranı — genomun kendini ne hızla değiştirdiği.
   *
   * Bu gen de mutasyona uğrar, yani evrimin hızı da evrimleşir. Beklenti:
   * kararlı bir ortamda düşük mutasyon seçilir (iyi çalışan genomu bozma),
   * değişken bir ortamda yüksek mutasyon (uyum sağlayabilmek). Gerçek
   * biyolojide "mutatör fenotip" diye bilinen olgunun karşılığı.
   */
  MutationRate: 7,
} as const;
export type TraitIndex = (typeof Trait)[keyof typeof Trait];

export const TRAIT_COUNT = 8;
export const TRAIT_OFFSET = WEIGHT_COUNT;
export const GENOME_LENGTH = WEIGHT_COUNT + TRAIT_COUNT;

/**
 * Duyu nöronlarının sırası ve insan-okunur adları.
 *
 * Üç boyutta yön tek açıyla ifade edilemiyor: hedefin hem yatay sapması (yaw)
 * hem dikey sapması (pitch) ayrı birer duyu. Organizma "yiyecek sağımda ama
 * yukarıda" bilgisini ancak böyle alabilir.
 */
export const Sense = {
  FoodDist: 0,
  FoodYaw: 1,
  FoodPitch: 2,
  NeighborDist: 3,
  NeighborYaw: 4,
  NeighborPitch: 5,
  NeighborSize: 6,
  Energy: 7,
  Age: 8,
  BoundaryDist: 9,
  /** Bulunduğu noktanın sıcaklığı ile kendi optimumu arasındaki fark. */
  ThermalStress: 10,
  /** Ortam ışığı: gündüz/gece döngüsü. */
  Light: 11,
  Bias: 12,
} as const;

export const SENSE_NAMES: readonly string[] = [
  'yiyecek uzaklığı',
  'yiyecek yatay açısı',
  'yiyecek dikey açısı',
  'komşu uzaklığı',
  'komşu yatay açısı',
  'komşu dikey açısı',
  'komşu boyutu',
  'kendi enerjisi',
  'kendi yaşı',
  'sınır uzaklığı',
  'ısı baskısı',
  'ışık',
  'sabit (bias)',
];

/** Eylem nöronlarının sırası ve adları. */
export const Action = {
  Forward: 0,
  Yaw: 1,
  Pitch: 2,
  Eat: 3,
  Reproduce: 4,
} as const;

export const ACTION_NAMES: readonly string[] = [
  'ileri git',
  'yatay dön',
  'dikey dön',
  'ye',
  'üre',
];

/** Fenotip genlerinin adları — genom farkı panelinde kullanılır. */
export const TRAIT_NAMES: readonly string[] = [
  'boyut',
  'hız',
  'duyu menzili',
  'metabolizma',
  'renk tonu',
  'saldırganlık',
  'ısı tercihi',
  'mutasyon oranı',
];

/**
 * Fenotip genleri genomda 0..1 aralığında tutulur, kullanım anında bu
 * aralıklara açılır. Böylece mutasyon her gen için aynı ölçekte davranır.
 *
 * Duyu menzili 3D'ye geçerken kısaldı (160 → 120): küresel sorgu hacmi
 * yarıçapın küpüyle büyüdüğü için eski menzil hücre taramasını beş katına
 * çıkarıyordu.
 */
export const TRAIT_RANGES: readonly (readonly [number, number])[] = [
  // Boyut 3B'de büyütüldü: perspektif küçültmesi ve binlerce yiyecek noktası
  // arasında eski ölçek (1.5–6) organizmaları görünmez kılıyordu. Metabolizma
  // hesabındaki bölen de buna göre ayarlandı, aksi halde herkes iki kat pahalı
  // olurdu.
  [3.0, 11.0], // boyut (dünya birimi yarıçap)
  [0.3, 2.0], // hız katsayısı
  [25, 120], // duyu menzili
  [0.4, 2.2], // metabolizma katsayısı
  [0, 1], // renk tonu (HSL hue, 0..1)
  [0, 1], // saldırganlık
  [0, 1], // ısı tercihi
  // Mutasyon oranı: alt sınır sıfır değil, aksi halde bir soy tamamen
  // donabilir ve bir daha asla uyum sağlayamaz. Üst sınır da şart — çok
  // yüksek mutasyon işleyen genomu her nesilde dağıtır ("hata felaketi").
  // Aralık, sabit oranlı sürümde çalıştığı ölçülen 0.06 değerinin etrafına
  // kuruldu: rastgele başlayan popülasyonun ortalaması (~0.065) oraya denk
  // gelsin. İlk denemede üst sınır 0.22'ydi ve başlangıç ortalaması 0.112'ye
  // çıkıyordu — her senaryoda popülasyon ~3000 adımda söndü, çünkü mutasyon
  // işleyen genomları üretebildiklerinden hızlı bozuyordu.
  [0.003, 0.13], // mutasyon oranı
];

export interface SimConfig {
  /**
   * Dünyanın yatay yarıçapı. Dünya, merkezi orijinde olan yassı bir
   * elipsoiddir (bkz. geometry.ts): kutu geometrisinde köşeler ayrıcalıklıydı
   * ve sınır duyusu konuma göre farklı anlamlar taşıyordu.
   */
  worldRadius: number;
  /**
   * Dikey/yatay yarıçap oranı. Bilerek 1'den küçük: sığ bir hacimde yükseklik
   * stratejik bir kaynak olur (yüzeyde mi derinde mi beslenmeli). Tam kürede
   * dikey eksen yalnızca seyrelme yaratırdı. 1 verilirse tam küre olur.
   */
  verticalSquash: number;

  /** Havuz kapasitesi — bellek buna göre bir kez ayrılır, sonra büyümez. */
  maxOrganisms: number;
  initialPopulation: number;

  /** Aynı anda dünyada bulunabilecek yiyecek sayısı. */
  maxFood: number;
  /** Adım başına eklenen yiyecek (mevsim katsayısıyla çarpılır). */
  foodSpawnRate: number;
  /** Bir yiyeceğin verdiği enerji. */
  foodEnergy: number;
  /**
   * Yeme menzili = organizma boyutu + bu pay.
   *
   * 3B'ye geçişte kritik hale geldi: yeme hacmi yarıçapın küpüyle büyüdüğü
   * için 2B'de yeterli olan dar bir pay, üç boyutta isabet olasılığını kırktan
   * bire düşürüyor ve popülasyon rastgele beyinlerle hiç tutunamadan sönüyor.
   */
  eatMargin: number;

  /** Doğuştan gelen enerji. */
  startEnergy: number;
  /** Üreme için gereken minimum enerji. */
  reproduceThreshold: number;
  /** Üremede yavruya aktarılan enerji oranı. */
  reproduceCost: number;
  /** Hareketsiz duran bir organizmanın adım başına harcadığı enerji. */
  baseMetabolism: number;
  /** Hareketin enerji maliyeti katsayısı (hızın karesiyle çarpılır). */
  moveCost: number;
  /**
   * Yaşlanma: metabolizma yaşla birlikte `1 + age × agingRate` katına çıkar.
   * Bu olmadan organizmalar yalnızca açlıktan ölüyor, ömür uzuyor, popülasyon
   * kapasite tavanına yapışıyor ve nesil devri durduğu için evrim donuyor.
   * Ölümsüzlük evrimin düşmanı.
   */
  agingRate: number;

  /**
   * Mutasyon oranı küresel çarpanı.
   *
   * Asıl oran artık her organizmanın kendi geninde (Trait.MutationRate); bu
   * değer onun üstüne binen bir kontrol. 0 yapmak evrimi tamamen dondurur ve
   * kontrol grubu deneyleri için kullanılır.
   */
  mutationRateScale: number;
  /** Mutasyon büyüklüğü (gauss standart sapması). */
  mutationScale: number;

  /**
   * Avlanmak için gereken en az boyut üstünlüğü. 1.15 = avcı, avından en az
   * %15 büyük olmalı. Bu eşik olmadan eşit boyutlular birbirini yiyip
   * popülasyon anlamsızca çöküyor.
   */
  predationSizeRatio: number;
  /**
   * Avın enerjisinin ne kadarı avcıya geçer. 1'den küçük olması şart:
   * her trofik seviyede enerji kaybı olmalı, yoksa avcılık bedava enerji
   * üreten bir döngüye dönüşür.
   */
  predationEfficiency: number;
  /** Saldırganlık geninin bu değerin altında kalması avlanmayı engeller. */
  predationThreshold: number;
  /**
   * Beslenme uzmanlaşması: saldırganlık arttıkça bitkiden alınan verim düşer.
   * 0.7 = tam etçil fenotip bitkiden yalnızca %30 enerji çıkarır.
   *
   * Bu ödünleşim olmadan trofik ayrışma ortaya çıkmıyor. Ölçümde avcı fenotip
   * hem bitki hem et yiyebildiği için salt kazançtı ve popülasyonun %95'i
   * avcıya kayıp tek tip bir dünya oluşuyordu. Uzmanlaşma, iki uçlu (ayırıcı)
   * seçilimin ön şartı: her strateji bir şeyden vazgeçmeli.
   */
  dietSpecialization: number;
  /**
   * Ölen organizmanın enerjisinin leşe dönüşen oranı.
   *
   * Enerji korunumu için kritik: ilk sürümde leş *gövde boyutuyla* orantılıydı
   * ve bu maddeyi yoktan var ediyordu — boyut 11'lik bir birey ölünce 6 yiyecek
   * (168 enerji) bırakıyor, ama hayatı boyunca o kadar toplamamış olabiliyordu.
   * Sonuç: nüfus patlaması, herkesin azami boyuta kaçması ve trofik ayrışmanın
   * tamamen kaybolması. Artık leş yalnızca ölüm anındaki enerjinin bir
   * kesridir; açlıktan ölen (enerjisi sıfır) hiç leş bırakmaz.
   *
   * predationEfficiency + carrionYield < 1 olmalı, aksi halde avlanma bedava
   * enerji üreten bir döngüye döner.
   */
  carrionYield: number;

  /** Mevsim döngüsünün adım cinsinden periyodu. 0 = mevsim yok. */
  seasonPeriod: number;
  /** Mevsimsel yiyecek dalgalanmasının şiddeti (0..1). */
  seasonAmplitude: number;

  /**
   * Enlem sıcaklık farkı: dünyanın bir ucu ile diğeri arasındaki fark (0..1).
   * Sıfır olduğunda dünya termal olarak tek tip olur ve ısı tercihi geni
   * anlamsızlaşır — coğrafi ayrışma bu gradyandan doğar.
   */
  latitudeGradient: number;
  /**
   * Derinlik sıcaklık farkı: taban ile tavan arasındaki fark. Yükseklik
   * eksenine ikinci bir anlam yükler (yalnızca konum değil, yaşanabilirlik).
   */
  depthGradient: number;
  /** Mevsimin sıcaklığı ne kadar kaydırdığı. */
  seasonalTempShift: number;
  /**
   * Isı uyumsuzluğunun metabolizmaya bindirdiği yük. Uyumsuzluk karesel
   * cezalandırılır: yakın olmak neredeyse bedava, uzak olmak hızla pahalı.
   */
  thermalStress: number;
  /** Gündüz/gece döngüsünün adım cinsinden periyodu. 0 = sürekli gündüz. */
  dayNightPeriod: number;
  /** Gecenin duyu menzilini ne kadar kıstığı (0..1). */
  nightSensePenalty: number;

  /** Deterministik tekrar için tohum. */
  seed: number;
}

/**
 * Varsayılanlar uzun koşuda ölçülerek seçildi (20.000 adım, dip/tepe nüfus).
 *
 * 2D sürümde ilk değerler (2000×2000, mevsim genliği 0.6) görsel olarak
 * kırılgandı: mevsim döngüsü doğal kaynak–tüketici salınımıyla rezonansa girip
 * nüfusu 66'ya kadar düşürüyordu ve o dip noktalarda dünya boşalmış gibi
 * görünüyordu. Mevsimi tamamen kapatmak salınımı öldürüp simülasyonu
 * durgunlaştırıyor; kıtlık baskısı evrimi sürükleyen şeyin kendisi. Genliği
 * kısıp dünyayı sıkılaştırmak hem salınımı korudu hem dip yoğunluğu 9.4 katına
 * çıkardı.
 *
 * 3B'ye geçişte dünya yeniden küçültüldü. Sebep hacimsel: aynı lineer boyut üç
 * boyutta çok daha seyrek bir dünya demek, organizmalar birbirini ve yiyeceği
 * bulamıyor. Ölçümde 1300³ ölçekli her varyant sönerken 900×900×360 tutundu.
 */
export const DEFAULT_CONFIG: SimConfig = {
  // Yarıçap, önceki 900×900×360 kutuyla *aynı hacmi* verecek şekilde seçildi:
  // (4/3)π·R²·(R·s) = 900·900·360 → R ≈ 560, s = 0.4.
  // Hacmi sabit tutmak şart, çünkü besin yoğunluğu ve yeme menzili uzun
  // ölçümlerle o hacme göre ayarlanmıştı; hacim değişseydi popülasyon dengesi
  // baştan kalibre edilmek zorunda kalırdı.
  worldRadius: 560,
  verticalSquash: 0.4,

  maxOrganisms: 4000,
  initialPopulation: 400,

  // Avcılık, ısı stresi ve gece körlüğü üst üste bindiğinde eski bolluk
  // (2400 / 6) popülasyonu ~2500 adımda söndürüyordu. Ölçülen çalışan ayar:
  //   yem  8 / gece .25 → kararlı ortam söndü
  //   yem 11 / gece .25 → her iki ortamda da sağlıklı  ← seçilen
  maxFood: 3600,
  foodSpawnRate: 11,
  // Avcılık + ısı stresi + gece körlüğü + karesel gövde maliyeti üst üste
  // binince sistem tohuma aşırı duyarlı hale geldi: aynı ayar bir tohumda
  // yaşarken diğerinde ~3000 adımda sönüyordu. Besin değerini 28'den 38'e
  // çıkarmak üç tohumun üçünde de popülasyonu ayakta tuttu (nüfus 860–1370,
  // nesil 73–93). Tek tek ayarlanan baskıların toplamı, her biri makulken bile
  // yaşanabilirliği aşabiliyor.
  foodEnergy: 38,
  // Büyütülmüş gövde aralığıyla birlikte ölçüldü (dip nüfus / yem-ömür / nesil
  // / duyu-sürücülü oran):
  //   14 → dip  37, 6.7, 31, 0.79   (tohuma göre tamamen sönebiliyor)
  //   18 → dip 431, 7.8, 40, 0.80   ← seçilen: her göstergede en iyisi
  //   22 → dip 448, 6.8, 35, 0.52
  //   26 → dip 579, 6.3, 32, 0.69
  // Menzil büyüdükçe nüfus artıyor ama evrim köreliyor: yiyeceği "yakalamak"
  // kolaylaşınca çevreye tepki vermenin getirisi azalıyor.
  eatMargin: 18,

  startEnergy: 60,
  reproduceThreshold: 110,
  reproduceCost: 0.45,
  baseMetabolism: 0.06,
  moveCost: 0.020,
  agingRate: 0.0012,

  mutationRateScale: 1,
  mutationScale: 0.12,

  predationSizeRatio: 1.18,
  predationEfficiency: 0.62,
  // Ölçülen parametre taraması (7000 adım, nüfus / otobur-ara-avcı dağılımı /
  // avlanma sayısı / duyu-sürücülü oran):
  //   diet .25 eşik .50 → 867,  85-15-0,   248, 0.92  ← seçilen
  //   diet .40 eşik .50 → 643,  97-3-0,   1300, 0.88
  //   diet .40 eşik .65 → 1245, 54-45-1,   217, 0.77
  //   diet .55 eşik .65 → 306,   1-0-99,  2332, 0.78
  //
  // Sistem iki kararlı duruma sahip: neredeyse tamamen otobur ya da neredeyse
  // tamamen avcı. Beklediğim temiz iki-tepeli ayrışma çıkmadı; ara değerler
  // geçiş bölgesi. Seçilen ayar gerçekçi olanı: çoğunluk otobur, azınlık
  // fırsatçı avcı — ve imza metriği (duyu-sürücülü karar) burada en yüksek.
  predationThreshold: 0.5,
  dietSpecialization: 0.25,
  // 0.62 + 0.20 = 0.82 < 1: her trofik aktarımda enerji kaybı var.
  carrionYield: 0.20,

  seasonPeriod: 5000,
  seasonAmplitude: 0.25,

  // Gradyanlar toplamı bilerek 1'in altında: sıcaklık 0–1 aralığında kırpılıyor
  // ve uçlarda kırpma devreye girdiğinde o bölge yapay olarak termal açıdan
  // "kararlı" hale geliyor. İlk ayarda (0.75 + 0.35 + 0.18) soğuk uç sürekli
  // kırpılıyordu ve popülasyonun tamamı oraya kaçmıştı — ayrışma vardı ama
  // ölçüm bir artefakta yaslanıyordu.
  // Ölçülen tarama (9000 adım — nüfus / enlem-gen korelasyonu / kuşak farkı):
  //   grad .58 stres .30 → 225, 0.22, 0.06
  //   grad .58 stres .45 → 627, 0.25, 0.06
  //   grad .70 stres .45 → 634, 0.36, 0.12  ← seçilen
  //   grad .70 stres .60 → 472, 0.12, 0.03  (aşırı ceza ayrışmayı bastırıyor)
  // Not: ilk denemede gradyan toplamı 1'i aşıyordu ve sıcaklık soğuk uçta
  // sürekli kırpılıyordu. Bu kırpma yapay bir "termal sığınak" yaratmış,
  // popülasyonun tamamı oraya toplanmıştı; kırpmayı kaldırınca ise sığınak
  // kalmayıp nüfus söndü. Bu ayar ikisinin arasında: gerçek bir gradyan var,
  // kırpma nadiren devreye giriyor.
  latitudeGradient: 0.70,
  depthGradient: 0.30,
  seasonalTempShift: 0.12,
  thermalStress: 0.45,
  dayNightPeriod: 900,
  // 0.15'te gece körlüğü çok sert olup değişken ortamda duyu-sürücülü oranı
  // 0.50'ye düşürüyordu; 0.25 hem baskıyı koruyor hem oranı 0.91'de tutuyor.
  nightSensePenalty: 0.25,

  seed: 1,
};
