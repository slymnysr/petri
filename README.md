# Petri — kara kutuyu aç

**Petri, "yapay zeka neden o kararı verdi" sorusunu herkesin kavrayabileceği bir ölçekte gözle görülür kılan bir eğitim aracıdır.** Evrimin beyin inşa edişini izlersin, sonra o beynin neden öyle davrandığını tam olarak açarsın.

Bir hacimde binlerce canlı evrimleşiyor; her birinin küçük bir sinir ağı var ve hiçbirinin davranışını kimse programlamadı. Bunu yapan başka simülasyonlar da var. Petri'nin farkı, birine tıkladığında hangi duyusunun hangi nöronunu ateşlediğini, o nöronun hangi kararı sürdüğünü ve bu bireyin atasından hangi mutasyonla ayrıldığını canlı olarak görebilmen — yani bir sinir ağının "neden"ini, tamamen inceleyebildiğin bir boyutta.

**Dürüstlük sınırı:** Bu bir araştırma aracı değil, bir öğrenme aracı. Yapay zekanın yorumlanabilirlik sorununu *çözmez*; onu, gözle görülüp kavranabilen küçük bir örnekle *anlatır*. "AI güvenliği araştırması yapar" gibi bir iddiası yok.

**Bir yabancı için:** İlk açılışta 4 adımlık bir tanıtım çıkar (kapatılabilir, "?" ile geri gelir). Üstteki **senaryo menüsü** hazır dersler sunar — her biri tek bir olguyu tekrarlanabilir şekilde gösterir. Seçili canlının panelinde her nöronun "neyi dinlediği" ve teknik metriklerin düz dil açıklamaları yer alır.

**Beyni sorgulama araçları** (gerçek yorumlanabilirlik yöntemlerinin oyuncak ölçekli hali):
- **Ablasyon** — nöron satırına tıkla, kapat, davranışın nasıl bozulduğunu izle. Nedensel: hangi nöron ne kadar iş görüyor doğrudan görünür.
- **Sonda (probing)** — her duyunun beynin gizli katmanından ne kadar okunabildiği (R²). Beyin o bilgiyi temsil ediyor mu?
- **Hipotez testi** ("deney" düğmesi) — bir iddiayı seç, araç birkaç tohumda koşturup "tuttu/tutmadı" der. Bazı iddialar tutmaz.
- **Yapay seçilim** — bir canlıyı ödüllendir (soyunu üret) ya da ayıkla. Sen seçici olursun; köpek ırkları gibi.
- **İki dünya yan yana** ("karşılaştır") — aynı tohum, tek parametre farklı. Iraksamayı canlı izle.
- **Bulgular paneli** — şimdiye dek ölçülenler, tutan ve tutmayan hipotezler birlikte.

**Dünyada ne var:** 13 duyu → 10 nöron → 5 eylemlik bir beyin; enlem ve derinliğe bağlı sıcaklık alanı; gündüz/gece döngüsü; mevsimler; bitki besini ve avcılık; leş yoluyla kapanan besin döngüsü; ve kendi mutasyon hızını taşıyan bir genom.

**Dünyanın şekli:** merkezi orijinde olan yassı bir elipsoid. Kutu geometrisinden buraya geçildi çünkü küpün sekiz köşesi ayrıcalıklıydı (organizma üç duvarla çevrili kalıp "köşeye sıkışabiliyordu") ve sınır duyusu altı yüzeyin en yakınına bakıyor, yani konuma göre farklı anlamlar taşıyordu. Elipsoidde sınır tek ve tutarlı bir büyüklük: merkezden normalize uzaklık. Yassılık (`verticalSquash`) bilinçli — sığ bir hacimde dikey konum stratejik bir kaynak; `1` verilirse dünya tam küre olur.

## Neden

Yapay yaşam simülasyonlarının çoğu kara kutudur. Güzel görünürler, bir şeyler kıpırdar, "bak evrim!" dersin — ama hiçbir organizmanın neden sola döndüğünü açıklayamazsın. Ortaya çıkan davranışı seyredersin, anlamazsın.

Petri yorumlanabilirliği sonradan eklenen bir panel olarak değil, mimarinin merkezine koyar. Simülasyon bir gösteri değil, **deney aracı**.

## Ne bulundu

> Bütün ölçülmüş bulguların kaydı — **tutan ve tutmayan hipotezler birlikte** —
> ayrı bir dosyada: [ANALIZ.md](ANALIZ.md). Tutmayan bir hipotez de bir bulgudur;
> orada neyin neden çürüdüğü sayılarıyla duruyor.

Yorumlanabilirlik katmanı olmasa görülemeyecek iki şey:

**1. Evrim yalnızca "daha çok yemeyi" değil, çevreye tepki vermeyi öğretiyor.**

Bir organizmanın kararını süren baskın girdi ölçülebilir: sabit bias (kör davranış — çevreye bakmadan hep aynı şeyi yapmak) mı, yoksa gerçek bir duyu mu?

| | duyu-sürücülü karar |
|---|---|
| Kurucu nesil | %75 |
| 47. nesil | **%96** |

Bu metrik arayüzde canlı görünür (`duyu-sürücülü`) ve `tests/interpretability.test.ts` tarafından korunur.

**2. Ölümsüzlük evrimin düşmanı.**

İlk sürümde yaşlanma yoktu; organizmalar yalnızca açlıktan ölüyordu. Ömür uzadıkça popülasyon kapasite tavanına yapıştı, `allocate()` -1 dönmeye başladı ve nesil devri durdu. Seçilimi yapan doğa değil, dizi sınırıydı. Yaşlanma eklendiğinde (metabolizma yaşla artıyor):

| Ölçüt | Yaşlanmasız | Yaşlanmalı |
|---|---|---|
| Doğum (20k adım) | 1.847 | **4.810** |
| Nesil | 14 | **30** |
| Yiyecek/ömür | 19,2 | **36,2** |

Beklenmedik yan etki: yaşlanma, düşük-metabolizma seçilimini zayıflattı (%40 → %28 düşüş). Mantıklı — ömrü zaten yaş sınırlıyorsa tasarrufun getirisi azalır.

**3. Metabolizma seçilimini sürükleyen şey mevsimsel kıtlık.**

Varsayılan mevsim genliği 0,6'dan 0,25'e çekildiğinde düşük-metabolizma seçilimi yalnızca zayıflamadı, **yön değiştirdi**: gen 0,538'den 0,597'ye *yükseldi*. Kıtlık dönemleri yumuşayınca tasarrufun getirisi kayboluyor ve gen rastgele sürüklenmeye (genetic drift) başlıyor. Seçilim baskısı ortadan kalktığında evrim "kötüleşmiyor" — yönsüzleşiyor.

Bu, testlerin kendi dünyalarını tam tanımlaması gerektiğini de gösterdi: ilgili test mevsim ayarlarını sessizce `DEFAULT_CONFIG`'den alıyordu, varsayılan değişince ölçtüğü şey kaydı.

**4. Evrimin hızı da evrimleşiyor.**

Mutasyon oranı sabit bir ayar değil, genomun kendi taşıdığı bir gen — ve o gen de mutasyona uğruyor. Sonuç, kimsenin programlamadığı bir davranış:

| ortam | mutasyon oranı | nüfus | duyu-sürücülü |
|---|---|---|---|
| kararlı (mevsimsiz, gecesiz) | 0,068 → **0,061** ↓ | 1396 | %94 |
| çok değişken | 0,068 → **0,081** ↑ | 1425 | %91 |

Kararlı bir dünyada popülasyon kendi değişim hızını kısıyor (işleyen genomu bozmamak); değişken bir dünyada açıyor (uyum sağlayabilmek). Biyolojide "mutatör fenotip" denen olgunun karşılığı.

**5. Coğrafi ekotipler kendiliğinden oluşuyor.**

Dünyada enlem ve derinliğe bağlı bir sıcaklık alanı var, organizmalarda da bir "ısı tercihi" geni. Kimse kimseye nereye yerleşeceğini söylemiyor:

| enlem kuşağı | ortalama ısı tercihi |
|---|---|
| soğuk uç | 0,61 |
| sıcak uç | 0,72 |

Isı tercihi ile bulunulan enlem arasındaki korelasyon 0,36'ya çıkıyor. Sıcak seven bireyler sıcak bölgede, soğuk sevenler soğukta toplanıyor.

**6. Evrimin ekseni ortama göre yer değiştirir.**

2B sürümde besin kıttı ve evrim tek yönde ilerliyordu: yaşam boyu beslenme sayısı ~5 kat artıyordu. 3B dünyada besin yoğunluğunu yükseltmek zorunda kaldım (küresel hacim yarıçapın küpüyle büyüyor) ve o eksen doydu. Aynı ayarla üç farklı tohumda ölçüm (3.000 → 18.000 adım):

| tohum | ömür | beslenme sayısı |
|---|---|---|
| 21 | 280 → 498 (**1,78×**) | 5,48 → 4,99 (0,91×) |
| 33 | 1015 → 472 (0,47×) | 4,38 → 5,33 (**1,22×**) |
| 44 | 297 → 526 (**1,77×**) | 4,40 → 5,25 (1,19×) |

Popülasyon bazen "daha uzun yaşa", bazen "daha çok beslen" yönünde ilerliyor — hangisinin baskın çıkacağı başlangıç koşullarına bağlı. İlgili test önce beslenmeyi, sonra ömrü şart koşuyordu ve ikisinde de kırıldı; oysa evrim çalışıyordu. Test artık ekseni şart koşmuyor, yalnızca *bir* eksende ilerleme arıyor. Yanlış olan simülasyon değil, ölçütün kendisiydi.

**7. Termodinamik ihlali evrimi bozar.**

Avcılık eklenirken leş miktarını gövde boyutuyla orantıladım. Bu maddeyi yoktan var ediyordu: boyut 11'lik bir birey ölünce 6 yiyecek (168 enerji) bırakıyor, ama hayatı boyunca o kadar toplamamış olabiliyordu. Sonuç nüfus patlaması, herkesin azami boyuta kaçması ve trofik ayrışmanın tamamen kaybolmasıydı — popülasyonun %95'i dev avcıya dönüştü. Leş artık ölüm anındaki *enerjinin* bir kesri (`predationEfficiency + carrionYield < 1`), açlıktan ölen hiç leş bırakmıyor.

### Varsayılanlar nasıl seçildi

Nüfus, kaynak–tüketici döngüsü nedeniyle doğal olarak salınır. İlk varsayılanlarda (2000×2000, mevsim genliği 0,6 ve periyot 6000) mevsim döngüsü bu doğal salınımla rezonansa girip dip noktalarını 66 canlıya kadar indiriyordu — o kadar geniş bir dünyada ekran boşalmış gibi görünüyor:

| Ayar | dip nüfus | tepe | salınım | dip yoğunluk* |
|---|---|---|---|---|
| 2000², mevsim 0,6 | 66 | 521 | 7,9× | 17 |
| mevsim kapalı | 161 | 270 | 1,7× | 40 |
| mevsim 0,25 | 249 | 559 | 2,2× | 62 |
| **1300², mevsim 0,25** | **269** | 742 | 2,8× | **159** |

<sub>*milyon piksel başına canlı</sub>

Mevsimi tamamen kapatmak salınımı öldürüyor ve simülasyonu durgunlaştırıyor; kıtlık baskısı evrimi sürükleyen şeyin kendisi. Seçilen ayar dip yoğunluğu 9,4 katına çıkarırken salınımı koruyor. `world.test.ts` bu dengeyi iki yönlü koruyor: dip 140'ın altına inemez, tepe/dip oranı 1,3'ün altına düşemez.

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # hızlı katmanlar (~30 sn) — geliştirme döngüsü için
npm run test:full  # evrim testleri dahil tam takım (dakikalar)
npm run build
```

**Kullanım:** organizmaya tıkla → inceleme paneli açılır. Sürükle → gezin. Tekerlek → yakınlaş. `+`/`−` hız, `f` dünyaya sığdır, `Esc` seçimi bırak.

## Nasıl çalışıyor

**Organizma:** 9 duyu → 8 gizli (tanh) → 4 eylem MLP. Ağırlıklar genomda; ayrı bir sinir ağı nesnesi yok.

- Duyular: yiyecek uzaklığı/açısı, komşu uzaklığı/açısı/boyutu, kendi enerjisi, yaşı, duvar uzaklığı, bias
- Eylemler: ileri git, dön, ye, üre
- Fenotip genleri: boyut, hız, duyu menzili, metabolizma, renk tonu

**Evrim:** enerjisi biten ölür, eşiği aşan bölünür ve mutasyona uğrar. Seçilim tasarlanmadı — yalnızca kıtlık var. Yiyecek kümeler halinde belirir ve kümeler yavaşça kayar; düzgün dağılım yalnızca "yiyeceğe doğru git" stratejisini ödüllendirip evrimi orada durduruyordu.

**Performans:** Structure-of-Arrays düzeni (organizma nesnesi yok), uzamsal hash grid ile komşu sorgusu, WebGL2 instanced rendering — yiyecek ve organizmalar tek draw call'da. Ölçüm (WSL2, headless Chromium): 6000 organizmada adım 17,2 ms, çizim 0,24 ms. Darboğaz tamamen simülasyonda; render pratikte bedava.

**Tekrarlanabilirlik:** `Math.random()` hiç kullanılmıyor. Aynı tohum birebir aynı evrimi üretir — "bu strateji gerçekten ortaya çıktı mı, yoksa şans mıydı" sorusu ancak böyle cevaplanabilir. Bu yüzden bir deneyi paylaşmak için genom saklamaya gerek yok: *tohum + parametreler* yeter ("deneyi kopyala" düğmesi).

## Dosya düzeni

```
src/sim/
  types.ts     sabitler, duyu/eylem adları, SimConfig
  pool.ts      SoA organizma havuzu
  grid.ts      uzamsal hash grid
  brain.ts     ileri besleme + atıf (senseInfluence, explainAction)
  genome.ts    mutasyon, genom uzaklığı
  world.ts     simülasyon adımı
  lineage.ts   soy kaydı
  metrics.ts   zaman serisi
src/render/    WebGL2 renderer, kamera
src/ui/        HUD, inceleme paneli, beyin diyagramı, deney paneli
```

## Testler

Dokuz katman, üç komut:

- `npm test` — hızlı birim/bütünleşme katmanları (~15 sn), geliştirme döngüsü için
- `npm run test:full` — evrim testlerini de ekler (dakikalar)
- `npm run test:e2e` — Playwright ile gerçek tarayıcıda görsel/etkileşim testleri

| Katman | Dosya | Neyi korur |
|---|---|---|
| Birim | `rng`, `pool`, `grid`, `mat4`, `brain` | Tek modülün sözleşmesi + nöron işlev keşfi + ablasyon maskesi |
| **Yorumlanabilirlik** | `probe` | Doğrusal sonda kodlanan/kodlanmayan duyuyu ayırt ediyor (negatif kontrol) |
| **Geometri** | `geometry` | Elipsoid matematiği: kimse dışarı sızmaz, konum üretimi merkeze yığılmaz |
| **Bütünleşme** | `integration` | Enerji muhasebesi, sayaç tutarlılığı, kimlik benzersizliği |
| **Belirlenim** | `determinism` | Aynı tohum → aynı evren; **deney kaydet/yükle turu** |
| **Sınır durumu** | `integration` | Boş popülasyon, dolu kapasite, aşırı parametreler, tam küre |
| Dünya | `world` | Nüfus dinamiği, sınır kısıtı, uzun koşuda boşalmama |
| Evrim | `evolution`, `interpretability` | Uygunluğun gerçekten arttığı |
| **Performans** | `performance` | Adım süresi, bellek sızıntısı, grid'in kaba kuvvete üstünlüğü |
| **Görsel/etkileşim** | `e2e/*.e2e.ts` | WebGL çiziyor, tıklama doğru canlıyı seçiyor, paneller çalışıyor |
| **Öğrenme yolu** | `e2e/onboarding.e2e.ts` | Açılış rehberi görünüp tamamlanıyor, senaryo yükleyip anlatı gösteriyor |

Birkaçının neden var olduğu:

- `grid.test.ts` — grid sorgusu kaba kuvvetle **birebir** aynı sonucu vermeli. Yanlış komşu döndürürse organizmalar var olmayan yiyeceğe yönelir ve evrimin tamamı çöpe gider.
- `geometry.test.ts` — düzgün dağılım testi somut bir hatanın nöbetçisi: yarıçapı `∛u` almadan seçmek noktaları merkeze yığar (hacim yarıçapın küpüyle büyür). Görsel olarak "dünyanın ortası kalabalık" diye fark edilir ama sayısal olarak sessizdir.
- `integration.test.ts` — `predationEfficiency + carrionYield < 1` kuralını doğrular. Bu, leşin enerji yarattığı ve popülasyonu tek tip dev avcıya çevirdiği hatanın kalıcı nöbetçisi.
- `determinism.test.ts` — "deneyi kopyala" özelliğinin tüm değeri buna bağlı: JSON dışa aktarılıp yüklendiğinde birebir aynı evrim üretilmeli.
- `evolution.test.ts` — uygunluğun arttığını doğrular ama **ekseni şart koşmaz**; hangi eksende ilerleyeceği başlangıç koşullarına bağlı (bkz. yukarıdaki bulgu).
- `e2e/interaction.e2e.ts` — bir organizmanın ekran konumunu kameradan hesaplayıp tam oraya tıklıyor ve inceleme panelinin o canlıyla açıldığını doğruluyor. `mat4.test.ts` izdüşüm matematiğini kontrol eder ama tıklamanın gerçekten doğru organizmayı seçtiğini yalnızca gerçek tarayıcıda görebiliriz — yanlışsa kullanıcı sessizce başkasını seçer.

## Bilinen sınırlar

- Simülasyon ana thread'de çalışıyor. Web Worker'a taşımak planlanmıştı ama ölçüm gereksiz olduğunu gösterdi: 3B'ye geçişten sonra 841 organizmada adım 2,37 ms, çizim 0,07 ms — 60 FPS bütçesinin ~%15'i (`performance.test.ts` bunu regresyona karşı koruyor). Worker, canlı beyin aktivasyonlarını thread sınırından geçirme karmaşıklığını getirecekti ve karşılığında ölçülebilir bir kazanç yok.
- Organizmalar birbirine fiziksel olarak çarpmıyor; rekabet yiyecek ve avlanma üzerinden.
- Soy kaydı 20.000 girdiyle sınırlı; daha eski atalar "kayıt dışı" görünür.
- E2e testleri için Playwright'ın Chromium'u gerekli (`npx playwright install chromium`); `npm test` ve `test:full` bundan bağımsız çalışır.
