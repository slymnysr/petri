# Petri v3 — Küresel Evren ve Kapsamlı Test Planı

İki ayrı iş: dünyanın geometrisini kutudan küreye taşımak, ve projenin
tamamını kapsayan bir test rejimi kurmak. Sıra önemli — geometri değişikliği
mevcut testlerin çoğunu etkiliyor, dolayısıyla önce geometri oturuyor, sonra
test rejimi onun üstüne kuruluyor.

---

## Bölüm A — Küresel evren

### Neden gerekli

Kutu dünyanın üç somut sorunu var:

1. **Köşeler ayrıcalıklı.** Küpün sekiz köşesinde organizma üç duvarla
   çevrili; oralarda yiyecek birikiyor ve "köşeye sıkış" dejenere bir strateji
   olabiliyor. Kürede ayrıcalıklı nokta yok.
2. **Sınır duyusu tutarsız.** Şu an `min(x, w-x, y, h-y, z, d-z)` — yani altı
   yüzeyin en yakını. Bu, konuma göre farklı anlamlar taşıyor. Kürede sınır
   uzaklığı tek ve tutarlı bir büyüklük: `R - |konum|`.
3. **Görsel.** Kutu kafes, bir simülasyonun sınırı gibi değil, bir kutu gibi
   duruyor. Küre "kapalı bir dünya" izlenimi veriyor.

### Karar noktası: küre mi, yassı elipsoid mi?

**Önerim: yassı elipsoid (oblate spheroid).** Gerekçe: mevcut dünya bilerek
yassı (900×900×360). Bu yassılık tasarım kararıydı — sığ bir hacimde dikey
konum stratejik bir kaynak oluyor, küpte ise yalnızca seyrelme yaratıyordu.
Tam küreye geçmek o kazanımı geri verir.

Elipsoid, iki parametreyle tanımlanır:
- `worldRadius` — yatay yarıçap
- `verticalSquash` — dikey/yatay oran (mevcut orana denk gelen ≈ 0.4)

`verticalSquash = 1` verildiğinde tam küre olur, yani ikisi de mümkün; ayar
kullanıcıya açık kalır.

### Faz 14 — Geometri çekirdeği

- `SimConfig`: `worldWidth/Height/Depth` → `worldRadius` + `verticalSquash`
- **Sınır kısıtı:** organizma elipsoid dışına çıkarsa yüzeye geri itilir.
  Normalize edilmiş uzaklık `d = √(x²/R² + y²/R² + z²/(R·s)²)`; `d > 1` ise
  konum `1/d` ile ölçeklenir.
- **Konum üretimi:** hacimde düzgün dağılım için `r = R·∛u` (küresel kabuk
  yanlılığını önler) + rastgele yön; sonra dikey eksen `s` ile sıkıştırılır.
- **Sınır duyusu:** `1 - d` — tek, tutarlı, normalize.
- **Sıcaklık alanı:** enlem gradyanı korunur (y ekseni), derinlik gradyanı
  korunur (z ekseni). Ek seçenek olarak **merkez–kenar gradyanı** eklenebilir;
  küresel simetriye en doğal uyan bu, ama önce mevcut iki gradyanla ölçüp
  ayrışmanın korunduğunu doğrulamak gerek.
- **Yiyecek kümeleri ve leş:** elipsoid içinde üretim ve kırpma
- **Uzamsal grid:** kutu hücre yapısı korunur (küre için özel bir veri yapısı
  gereksiz). Elipsoidin sınırlayıcı kutusunda hücrelerin ~%48'i boş kalır —
  bu israf kabul edilebilir, çünkü boş hücre taraması sabit zamanlı.

### Faz 15 — Küresel render ve kamera

- Sınır kafesi: kutu kenarları yerine **enlem/boylam çemberleri** (elipsoid
  teli). Üç eksende halkalar, derinlik sisiyle soluklaşan.
- Kamera: `frame()` artık yarıçapa göre konumlanır, kutu köşegenine göre değil.
- Tıklama toleransı ve seçim mantığı değişmez.

---

## Bölüm B — Kapsamlı test rejimi

Mevcut durum: 38 test, 6 dosya. Kapsam iyi ama dağınık ve bazı alanlar hiç
test edilmiyor (render, etkileşim, performans, senaryo kaydet/yükle, sınır
durumları).

### Test katmanları

| Katman | Neyi doğrular | Araç | Hız |
|---|---|---|---|
| **1. Birim** | Tek modülün sözleşmesi | Vitest | ms |
| **2. Geometri** | Küresel sınırların matematiği | Vitest | ms |
| **3. Bütünleşme** | Adım döngüsünün tutarlılığı | Vitest | sn |
| **4. Belirlenim** | Aynı tohum → aynı evren | Vitest | sn |
| **5. Sınır durumu** | Uç parametrelerde çökmeme | Vitest | sn |
| **6. Evrim** | Uygunluğun gerçekten arttığı | Vitest | dk |
| **7. Performans** | Kare bütçesi ve GC baskısı | Vitest | sn |
| **8. Görsel/etkileşim** | Çizim ve arayüzün çalıştığı | Playwright | sn |

### Faz 16 — Katman 1–2: birim ve geometri

Yeni test dosyaları:
- `genome.test.ts` — mutasyon dağılımı, gen sınırlarında yansıma, genom
  uzaklığının simetrisi ve sıfır noktası
- `brain.test.ts` — ileri beslemenin bilinen girdide bilinen çıktıyı vermesi,
  `senseInfluence`'ın sıfır girdiye sıfır etki ataması, `explainAction`'ın en
  baskın zinciri doğru seçmesi
- `geometry.test.ts` — **yeni geometrinin çekirdek testi:**
  - hiçbir organizma elipsoid dışına çıkamaz (uzun koşu boyunca)
  - sınır itmesi konumu yüzeye taşır, içeri fırlatmaz
  - konum üretimi hacimde düzgün dağılır (kabuk yanlılığı yok — kabuk/çekirdek
    örnek sayıları hacim oranıyla uyumlu olmalı)
  - `verticalSquash = 1` tam küre üretir
- `metrics.test.ts` — halka tamponun sarma noktasında sırayı koruması

### Faz 17 — Katman 3–5: bütünleşme, belirlenim, sınır durumları

- `integration.test.ts`
  - **Enerji muhasebesi:** bir adımda sisteme giren enerji (yiyecek) ile çıkan
    (metabolizma + ölüm) arasındaki ilişki; avlanmada
    `predationEfficiency + carrionYield < 1` kuralının kodda gerçekten
    tutulduğu. *Bu, v2'de yakalanan termodinamik hatasının nöbetçisi.*
  - Ölüm/doğum sayaçlarının havuz durumuyla tutarlılığı
  - Leş yalnızca enerjisi pozitif olan ölümlerde üretilir
- `determinism.test.ts`
  - Aynı tohum → adım adım birebir aynı durum (konum, enerji, genom)
  - `reseed()` sonrası tekrarlanabilirlik
  - **Senaryo kaydet/yükle turu:** config'i dışa aktar → yeni dünyaya yükle →
    aynı evrim. *Bu şu an hiç test edilmiyor ve "deneyi paylaş" özelliğinin
    tüm değeri buna bağlı.*
  - RNG durumunun kaydedilip geri yüklenebilmesi
- `edge-cases.test.ts`
  - Sıfır popülasyonda `step()` ve `getStats()` çökmemeli
  - Kapasite doluyken üreme sessizce başarısız olmalı, taşmamalı
  - `maxFood = 0`, `foodSpawnRate = 0`, `mutationRateScale = 0`
  - Aşırı parametreler: devasa mutasyon şiddeti, sıfır duyu menzili
  - Var olmayan kimlikle `indexOfId`, `lineage.get`, `ancestors`

### Faz 18 — Katman 6–7: evrim ve performans

- Mevcut `evolution.test.ts` ve `interpretability.test.ts` korunur, küresel
  dünyaya uyarlanır
- `performance.test.ts` (yeni)
  - 2000 organizmada adım süresi bir üst sınırın altında (CI gürültüsüne pay
    bırakan gevşek bir eşik — amaç mikro-optimizasyon değil, **regresyon
    yakalamak**)
  - Sıcak döngüde bellek ayırma olmadığının kanıtı: uzun koşuda heap büyümesi
    sınırlı kalmalı
  - Grid sorgusunun kaba kuvvete karşı hız üstünlüğü (ölçekleme testi)

### Faz 19 — Katman 8: görsel ve etkileşim

`tests/e2e/` altında Playwright ile:
- Sayfa hatasız açılıyor, WebGL2 bağlamı kuruluyor
- Canvas gerçekten piksel çiziyor (arka plan dışı piksel sayımı)
- Küresel sınır kafesi çiziliyor
- Organizmaya tıklama inceleme panelini açıyor; beyin diyagramı, karar satırı,
  fenotip çubukları ve soy zinciri dolu geliyor
- Kamera etkileşimi: sürükleme döndürüyor, tekerlek yakınlaştırıyor, tıklama
  ile sürükleme birbirine karışmıyor
- Kaydırıcılar config'i gerçekten değiştiriyor
- "yeni dünya" düğmesi simülasyonu sıfırlıyor
- Dar ekranda düzen bozulmuyor, sayfa yatay taşmıyor

**Not:** Playwright testleri şu an manuel yürütülüyor (ben MCP üzerinden
çağırıyorum). Bu fazda kalıcı, tekrar çalıştırılabilir dosyalara dönüşecekler.

### Faz 20 — Tam koşum ve rapor

- `npm test` tüm katmanları koşturur; ağır katmanlar (evrim, kararlılık) için
  ayrı komut: `npm run test:full`
- Süre bütçesi: hızlı katmanlar < 30 sn (geliştirme döngüsü için), tam takım
  dakikalar
- Kararlılık koşusu: 3 farklı tohumda 30.000 adım, popülasyon sönmemeli
- Sonuçların README'ye işlenmesi

---

## Riskler

- **Geometri değişikliği geniş yüzeye dokunuyor.** `worldWidth/Height/Depth`
  simülasyon, render, kamera, testler ve senaryo JSON'unda geçiyor. Faz 14
  sonunda her şeyin derlenmesi ama testlerin bir kısmının kırmızı olması normal;
  Faz 16–18'de düzeltilecekler.
- **Denge yeniden ayarlanabilir.** Elipsoid hacmi aynı lineer ölçüde kutudan
  ~%48 küçük. Yoğunluk sabit kalsın diye yarıçap veya besin miktarı yeniden
  ölçülecek — v2'de öğrendiğim gibi hacim değişince popülasyon sönebiliyor.
- **Test süresi.** Evrim testleri şu an ~10 dakika. Yeni katmanlar eklenince
  toplam artacak; bu yüzden hızlı/tam ayrımı planın parçası.

## Sıralama

Fazlar tek tek bitirilecek, her biri kendi doğrulamasıyla:

**14** geometri çekirdeği → **15** küresel render → **16** birim+geometri
testleri → **17** bütünleşme+belirlenim+sınır → **18** evrim+performans →
**19** görsel/etkileşim → **20** tam koşum ve rapor
