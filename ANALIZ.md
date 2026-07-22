# Petri — Analiz Kaydı

Petri yalnızca bir araç değil, aynı zamanda yapay bir dünya üzerinde yürütülmüş
bir dizi ölçülmüş deneydir. Bu dosya o deneylerin sonuçlarını tutar — **hem
tutan hem tutmayan hipotezleri.**

Tutmayan bir hipotez de bir bulgudur: "şunu bekledik, ölçtük, olmadı" bu dünya
hakkında gerçek bir şey söyler. Bu kayıt olmadan o bilgi, atılan koddan ibaret
kalırdı.

Bütün sayılar deterministik koşulardan gelir (tohum ve parametreler belirtilir);
yani her biri tekrar üretilebilir.

---

## 1. Tutan bulgular (ürünü şekillendirenler)

### Evrim kör davranıştan tepkiselliğe geçirir
Bir organizmanın kararını süren baskın girdi, sabit "bias" mı yoksa gerçek bir
duyu mu? Ölçüm:

| | duyu-sürücülü karar |
|---|---|
| Kurucu nesil | %75 |
| ~47. nesil | **%96** |

Evrim yalnızca "daha çok yemeyi" değil, çevreye tepki vermeyi öğretiyor. Bu, HUD'daki
`duyu-sürücülü` metriğinin ve `mutasyon-kapalı` senaryosunun dayanağı.

### Coğrafi ekotipler kendiliğinden oluşur
Isı tercihi geni ile bulunulan enlem arasındaki korelasyon (Pearson) zamanla
0'dan ~0.4–0.5'e tırmanıyor. Sıcak sevenler sıcağa, soğuk sevenler soğuğa
yerleşiyor — kimse yerleşimi programlamadan.

### Evrimin hızı da evrimleşir
Mutasyon oranı sabit bir ayar değil, genomda taşınan ve kendisi de mutasyona
uğrayan bir gen:

| ortam | mutasyon oranı |
|---|---|
| kararlı (mevsimsiz, gecesiz) | 0.068 → **0.061** ↓ |
| çok değişken | 0.068 → **0.081** ↑ |

Kararlı dünyada popülasyon kendi değişim hızını kısıyor, çalkantılıda açıyor.

### Bir beynin içinde nöronlar iş bölümü yapar
Tek bir organizmanın 10 gizli nöronu, ortalama **~7 farklı duyuya** uzmanlaşıyor
(seed 1, 6000 adım, 930 canlı). Beyin bütün duyuları tek yere yığmıyor. Bu,
inceleme panelindeki "nöronlar — her biri neyi dinliyor" bölümünün dayanağı.

### Termodinamik korunumu evrimi ayakta tutar
`predationEfficiency + carrionYield < 1` olmalı. İhlal edildiğinde (leş, gövde
boyutuyla orantılandığında) madde yoktan var oluyor, nüfus patlıyor, herkes
azami boyuta kaçıyor ve trofik ayrışma yok oluyor. `integration.test.ts` bu
kuralı koruyor.

---

## 2. Tutmayan bulgular (ölçülüp reddedilenler)

Bunlar, kullanıcının haklı olarak "analizin bir parçası" dediği sonuçlardır.
Hepsi bir zamanlar makul görünen hipotezlerdi; ölçüm çürüttü ve üründen çıkarıldı
— "çalışıyor gibi" bırakılmadı.

### 2a. "Ölümsüzlük evrimi durdurur" — artık geçerli değil
**Hipotez (v1 bulgusu):** Yaşlanmayı kapatınca organizmalar yalnızca açlıktan
ölür, ömür uzar, popülasyon kapasite tavanına yapışır ve nesil devri durur.

Bu, v1'in basit 2B dünyasında **doğruydu.** Ama v3'ün zengin dünyasında (avcılık
+ iklim + gece) ölçüm (seed 7, 9000 adım):

| ayar | nüfus tavanı (zirve) | nesil (2000→son) |
|---|---|---|
| yaşlanma KAPALI, temiz dünya | %39 | 25 → 51 |
| yaşlanma AÇIK, aynı dünya | %51 | 25 → 49 |

Yaşlanmasız dünya tavana yapışmıyor — hatta kontrolden düşük — ve nesil devri
neredeyse aynı. **Neden:** avcılık ve iklim, yaşlanmanın yerine geçen ölüm
kaynakları sağlıyor; tek başına yaşlanmayı kaldırmak artık nüfus patlaması
yaratmıyor.

**Bulgu:** Bir evrimsel olgunun geçerliliği dünyanın karmaşıklığına bağlı.
Basit dünyada gerçek olan, katmanlar eklenince kaybolabiliyor. Bu yüzden bu
senaryo üründen çıkarıldı.

### 2b. Nöron rolleri organizmalar arasında yakınsar
**Hipotez:** Her beyin farklı olduğuna göre, bir canlının 3. nöronu yiyeceğe
bakıyorsa başka bir canlının 3. nöronu duvara bakıyor olabilir; numara evrensel
değildir.

Ölçüm (seed 1, 6000 adım, 930 canlı) — 1. gizli nöronun (N1) en güçlü bağlandığı
duyunun popülasyondaki dağılımı:

| N1'in baktığı duyu | pay |
|---|---|
| komşu yatay açısı | **%91** |
| komşu boyutu / sınır / komşu dikey | %3'er |

**Bulgu:** Aynı numaralı nöron popülasyonun büyük kısmında **aynı** işi görüyor —
çünkü hepsi ortak bir atadan türüyor ve o çözüm yayılıyor (evrimsel yakınsama).
Yani "her beyin farklı" iddiası fazla güçlüydü. Doğru olan, *bir beyin içindeki*
iş bölümü (bkz. 1. bölüm, ~7/10). Kod yorumu ve arayüz metni buna göre
düzeltildi.

### 2c. Avcılar daha iri bir gövde geliştirmez
**Hipotez:** Avcılık gövde boyutuyla mümkün olduğundan (avcı, avından belirgin
büyük olmalı), avcılar zamanla otlayıcılardan daha iri bir bedene evrilir.

Ölçüm (10000 adım, avcı vs otlayıcı ortalama gövde yarıçapı):

| tohum | avcı % | avcı boyut | otlayıcı boyut | fark |
|---|---|---|---|---|
| 1 | %20 | 10.5 | 9.8 | +0.7 |
| 7 | %61 | 9.8 | 9.8 | −0.0 |
| 21 | %50 | 9.9 | 10.0 | −0.1 |

**Bulgu:** Tutarlı bir boyut farkı yok. Trofik rol (saldırganlık geni) ile gövde
boyutu bu dünyada birbirinden bağımsız evrilmiş; bir arada yaşayan avcılar ve
otlayıcılar neredeyse aynı morfolojiye sahip. "Avcı = iri" beklentisi tutmadı;
bu istatistik eklendikten sonra geri çekildi.

---

## 3. Ölçekle değişen bulgular

Bazı sonuçlar yanlış değil ama **dünya büyüdükçe eksen değiştirdi:**

### Evrimin ilerlediği eksen ortama ve tohuma bağlı
2B'de besin kıttı ve evrim "daha çok bul" ekseninde ilerliyordu (yem/ömür ~5×
artıyordu). 3B'de besin yoğunluğu artırılmak zorunda kaldı (küresel hacim
yarıçapın küpüyle büyüyor) ve o eksen doydu. Aynı ayarda üç tohum (3.000 →
18.000 adım):

| tohum | ömür | beslenme sayısı |
|---|---|---|
| 21 | 280 → 498 (**1.78×**) | 5.48 → 4.99 (0.91×) |
| 33 | 1015 → 472 (0.47×) | 4.38 → 5.33 (**1.22×**) |
| 44 | 297 → 526 (**1.77×**) | 4.40 → 5.25 (1.19×) |

Popülasyon bazen "daha uzun yaşa", bazen "daha çok beslen" yönünde ilerliyor;
hangisinin baskın çıkacağı başlangıç koşullarına bağlı. `evolution.test.ts` bu
yüzden ekseni şart koşmuyor, yalnızca *bir* eksende ilerleme arıyor.

---

## 4. Yorumlanabilirlik yöntemleri (v5)

Petri'nin "kara kutuyu aç" amacını derinleştiren, gerçek yorumlanabilirlik
araştırmasından ödünç alınmış yöntemler — oyuncak ölçekte.

### Ablasyon: nöronun işlevini nedensel test etmek
Bir gizli nöronu kapatıp (aktivasyonu 0) davranışın nasıl bozulduğunu ölçüyoruz.
Ağırlık okuması korelasyoneldi; ablasyon nedensel. Seçili bir organizmada 10
nöronun tek tek kapatılmasının karara (çıktı vektörüne) etkisi:

```
N1:0.15  N2:0.88  N3:1.22  N4:0.73  N5:0.81  N6:1.15  N7:0.49  N8:0.17  N9:0.90  N10:0.03
```

**Bulgu:** Nöronların yükü eşit değil — N3 ve N6 taşıyıcı (~1.2), N10 neredeyse
etkisiz (0.03). Hangi nöronun ne kadar iş gördüğü ancak kapatınca görünüyor.

### Probing: bir bilginin beyinde kodlu olup olmadığı
Beynin gizli katmanından her duyuyu tahmin eden doğrusal bir sonda (least
squares) uyduruyoruz; R² yüksekse duyu doğrusal okunabilir demektir.

**Negatif kontrol (yöntemin geçerlilik kanıtı):** bir duyunun (yiyecek yatay
açısı) tüm giriş ağırlıkları sıfırlandığında — yani beyin onu artık okumadığında
— sondanın R²'si %72'den **%2'ye** düşüyor. Sonda "her şeyi okuyabilirim" diyen
bir hüner değil; gerçekten kodlanan ile kodlanmayanı ayırt ediyor.

### Bırakılan: aktivasyon yamalama
İki farklı beyin arasında aktivasyon kopyalamak (A'nın gizli değerlerini B'nin
çıktı katmanına vermek) planlanmıştı ama bırakıldı: beyinler farklı ağırlıklara
sahip olduğu için sonuç yorumlanabilir bir "başka türlü düşünme" değil, gürültü.
Tutmayan senaryolar gibi, gerekçesiyle çıkarıldı.

### İki dünya yan yana: mutasyonun bedeli
"Karşılaştır" modu aynı tohumu iki dünyada koşturur, tek parametre farklı.
Mutasyon açık (sol) vs kapalı (sağ) karşılaştırmasında çarpıcı bir ıraksama:

| | mutasyon açık (temel) | mutasyon kapalı |
|---|---|---|
| nüfus | 622 | **1182** |
| görünüm | renk cümbüşü (çeşitli) | neredeyse tek renk (tek-tip) |

**Bulgu:** Mutasyon çeşitlilik yaratıyor (soldaki renkler genetik çeşitliliğin
göstergesi) ama bir bedeli var — mutasyonsuz dünya daha kalabalık. Çeşitlilik
bedava değil; her nesil bir miktar zararlı varyasyon da üretiliyor. Bu, tek bir
parametre değişiminin hem görsel (renk) hem sayısal (nüfus) sonucunu aynı anda
gösteriyor.

### Hipotez testi: aracın "tutmadı" diyebilmesi
Hipotez test modunda dört iddiadan biri ("Yüksek mutasyon nüfusu artırır")
bilerek yanlış. Ölçüm: müdahale nüfusu %23 **düşürüyor** (aşırı mutasyon işleyen
genomları bozuyor — "hata felaketi"). Araç bu iddiaya "tutmadı" diyor. Bir
aracın yanlışı da söyleyebilmesi, gerçek bir test olduğunun kanıtı; her şeye
"tuttu" diyen bir gösteri dürüstlük iddiasını çökertirdi.

Not: hipotez configleri de ölçülerek ayarlandı. İlk tasarımda nüfus tavanı
düşüktü (900) ve hem bolluk hem ölümsüzlük tavana yapışıp ayırt edilemiyordu;
tavan 3000'e çıkarıldı. Ayrıca evrimsel etkiler (iklim uyumu, duyu-sürücülü
oran) bu hızlı deneylere sığmıyor — uzun koşu ister; bu yüzden hipotezler nüfus
dinamiğine dayandırıldı.

## 5. Yöntem notu

- **Her senaryo ve gösterge, üründe yer almadan önce ölçüldü.** İlk senaryo
  taslağında 5 vardı; ikisi (2a ve bir "avcılar yoktan doğuyor" varyantı)
  ölçümde vaadini tutmadığı için elendi. Kalan dördü doğrulanmış imzalarıyla
  `src/sim/scenarios.ts` içinde.
- **Tutmayan bir olguyu gizlemek, aracın güvenilirliğini ilk denemede yıkardı.**
  Bu araç "yapay zeka neden böyle karar verdi" sorusuna dürüst cevap vermek
  iddiasında; kendi ölçümlerinde dürüst olmazsa o iddia boşa düşer.
- **Determinizm bu kaydı denetlenebilir kılıyor.** Buradaki her sayı, belirtilen
  tohum ve parametrelerle yeniden üretilebilir; "şans mıydı" sorusu her zaman
  cevaplanabilir.
