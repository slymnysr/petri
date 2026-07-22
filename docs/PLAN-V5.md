# Petri v5 — "Farklı" Yönler: Kara Kutuyu Sorgulamayı Öğret

Kullanıcı dört niteliksel-farklı yönün dördünü de seçti. Ortak amaç: Petri'yi
"beyni gösteren"den **"beynin nasıl sorgulanacağını öğreten"e** çıkarmak, ve
gözlemciyi deneyci/seçici yapmak.

Sıra değere ve bağımlılığa göre: interpretability önce (mevcut nöron paneline
oturuyor), sonra deney araçları, sonra etkileşim modları.

## Faz 26 — Ablasyon (bayrak gemisi)

Mevcut nöron etiketleme ağırlık *okuyor* — korelasyonel. Ablasyon nedensel:
nöronu kapat, davranışın bozulmasını izle.

- `forward()`'a opsiyonel maske: bir gizli nöron kapatıldığında aktivasyonu 0.
- Yalnızca seçili organizmaya uygulanır (`World.ablatedId`, `ablationMask`).
- İnceleme panelinde nöron satırları tıklanabilir: tıkla → kapat (üstü çizili,
  sönük). Seçim değişince sıfırlanır.
- Kısa açıklama: "bir nörona tıkla, kapat, davranışın nasıl değiştiğini gör."
- **Ölçüt:** bir nöronu kapatınca seçili organizmanın kararı ölçülebilir şekilde
  değişmeli (çıktı vektörü sapması). Değişmiyorsa o nöron zaten etkisizdi —
  ki bu da bir bulgu (doymuş nöron uyarısıyla tutarlı).

## Faz 27 — Aktivasyon yamalama + probing (interpretability derinliği)

- **Yamalama:** bir canlının gizli aktivasyonlarını, seçili canlıya "yapıştır",
  kararın nasıl kaydığını gör. (İki beyin farklı olduğu için bu daha çok
  "başka bir zihinle düşünürsen ne olur" sorusu.)
- **Probing:** popülasyondan toplanan (aktivasyon, duyu) çiftlerinden, gizli
  katmandan bir duyuyu tahmin eden minik doğrusal probe eğit. "Bu bilgi beyinde
  gerçekten kodlu mu" sorusunu cevaplar.
- **Ölçüt:** probe, rastgele tahminden belirgin iyi olmalı (bilgi kodluysa);
  kodlanmayan bir duyu için probe başarısız olmalı (negatif kontrol).

## Faz 28 — Hipotez test etme modu

Oturum boyu elle yaptığım ölçüm döngüsünü kullanıcıya aç.

- Kullanıcı bir hipotez seçer (ör. "bol yiyecek duyu-sürücülü oranı düşürür").
- Araç N tohumda arka planda koşturur, sonucu toplar, "tuttu / tutmadı" der,
  sayılarıyla.
- ANALIZ.md'deki disiplinin kullanıcı-yüzeyli hali. Determinizm bunu mümkün
  kılıyor.
- **Ölçüt:** aracın verdiği "tuttu/tutmadı" kararı, elle ölçtüğüm sonuçlarla
  aynı çıkmalı (bilinen hipotezlerle doğrula).

## Faz 29 — Sen seçilim baskısı ol (yapay seçilim)

- Kullanıcı bir organizmaya tıklayıp "ödüllendir" (enerji ver / üreme şansı) ya
  da "ayıkla" (öldür) diyebilir; uygunluk fonksiyonu geçici olarak o olur.
- Birkaç nesil sonra popülasyonun kullanıcının seçtiği yöne kaydığını göster.
- Köpek ırkları gibi: doğal değil yapay seçilim, ama aynı mekanizma.
- **Ölçüt:** kullanıcı tutarlı bir özelliği (ör. iri gövde) ödüllendirdiğinde o
  özelliğin popülasyon ortalaması ölçülebilir şekilde kaymalı.

## Faz 30 — İki dünya yan yana

- Aynı tohum, tek parametre değişik, iki simülasyon yan yana, gerçek zamanlı.
- Iraksamayı canlı gösterir: "bu tek değişiklik şu farkı yarattı."
- Render ve UI ikiye bölünür; performans bütçesi iki dünya için kontrol edilir.
- **Ölçüt:** aynı tohum + aynı parametre → iki dünya birebir aynı kalmalı
  (determinizm kontrolü); tek fark → görünür ıraksama.

## Faz 31 — Doğrulama ve yayın

- Her yeni yeteneğe test (ablasyon etkisi, probe doğruluğu, yapay seçilim kayması)
- E2e: yeni etkileşimler (nöron kapatma, hipotez koşusu)
- README + ANALIZ.md + bulgular paneli güncelle, Artifact yayınla

## Risk

- **Kapsam.** Dört büyük yön. Her faz tek tek bitirilecek, çalışır kanıtıyla.
- **Performans.** İki dünya (Faz 30) adım maliyetini ikiye katlar; ölçülecek.
  Gerekirse çözünürlük/nüfus kırpılır.
- **Dürüstlük.** Her yeni "ders" (ablasyon etkisi, probe, seçilim kayması)
  gösterilmeden ölçülecek; tutmayan varsa gizlenmeyip bulgu olarak not edilecek.
