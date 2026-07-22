# Petri v2 — Derinleştirme Planı

v1'de çalışan çekirdek vardı: 2D dünya, tek besin kaynağı, sinüzoidal mevsim,
aseksüel bölünme, sabit mutasyon oranı. v2 bunların her birini gerçek bir
mekanizmaya dönüştürüyor ve dünyayı üç boyuta taşıyor.

## Tasarım ilkesi

Her yeni etken **evrime yeni bir strateji alanı açmalı**. Süs olan hiçbir şey
eklenmiyor: bir özellik ancak popülasyonun ona tepki olarak farklılaşabildiği
durumda giriyor. Ölçüt her fazda aynı — özellik eklendiğinde ortaya çıkan yeni
davranış ölçülebiliyor mu?

## Fazlar

### Faz 7 — Üç boyutlu dünya ve Worker
Simülasyon ana thread'i bloke etmemeli; 3D'de komşu sorgusu pahalılaşıyor.
- `z` ekseni: konum, hız, yön (yaw + pitch)
- Uzamsal grid 3B hücrelere geçer
- Duyulara yükseklik açısı eklenir
- ~~Simülasyon Web Worker'da~~ → **yapılmadı, gerekçesi ölçüm.** 3B geçiş
  sonrası profil: 841 organizmada adım 2.37 ms, çizim 0.07 ms, toplam 2.45 ms —
  60 FPS bütçesinin %15'i. Arayüzde görülen düşük FPS headless tarayıcının rAF
  kısıtlamasıydı, kodun değil. Worker, yorumlanabilirlik verisini (canlı beyin
  aktivasyonları) thread sınırından geçirme karmaşıklığını getirecekti ve
  karşılığında ölçülebilir bir kazanç yok. Faz 9–11 simülasyonu ağırlaştırırsa
  yeniden değerlendirilecek.

### Faz 8 — 3D render
- Perspektif kamera, orbit/pan/zoom kontrolü
- Instanced küre impostor'ları (gerçek geometri değil, shader'da küre) —
  binlerce ajanda tek draw call korunur
- Yönlü ışık + ambient, derinlik sisi, hacim sınırları
- Yiyecek ve organizma ayrı görsel dil

### Faz 9 — Besin ağı ve avcılık
Tek besin kaynağı tek strateji üretiyor. Trofik seviye eklendiğinde otobur,
etobur ve leşçil ayrışabilir.
- Organizmalar birbirini avlayabilir (boyut ve saldırganlık geni)
- Leş: ölen organizma besin bırakır
- Yeni duyular: avın/avcının göreli tehdidi
- Ölçüt: popülasyon trofik olarak ayrışıyor mu?

### Faz 10 — İklim sistemi
Mevsim şu an tek sayı. Gerçek bir iklim uzamsal ve çok değişkenli olmalı.
- Sıcaklık alanı: enlem gradyanı + mevsimsel kayma + gürültü
- Gündüz/gece: görüş menzilini ve metabolizmayı etkiler
- Termal tolerans geni (optimum sıcaklık + tolerans genişliği)
- Ölçüt: popülasyon coğrafi olarak ayrışıyor mu (sıcak/soğuk ekotipler)?

### Faz 11 — Genetik derinlik
- Cinsel üreme: iki ebeveyn, çaprazlama; eşey seçimi geni
- Evrimleşen mutasyon oranı (genomun kendi mutasyon parametresi)
- Gen duplikasyonu ve yapısal mutasyon (gizli nöron ekleme/silme)
- Ölçüt: mutasyon oranı kararlı ortamda düşüyor, değişken ortamda yükseliyor mu?

### Faz 12 — Modern arayüz
- Kart tabanlı panel sistemi, katmanlı yüzeyler, yumuşak geçişler
- Tipografik hiyerarşi ve ölçek
- Zenginleşmiş grafikler: alan dolgusu, çoklu seri, vurgulu uç nokta
- Trofik/ekotip dağılımı görselleştirmesi

### Faz 13 — Doğrulama ve yayın
- Tüm testlerin 3D'ye uyarlanması, yeni mekanizmalar için yeni testler
- Performans profili ve hedef doğrulaması
- README ve Artifact güncellemesi

## Riskler

- **Performans:** 3D grid + avcılık sorguları adım maliyetini artırır. Worker
  bunu gizler ama simülasyon hızı düşerse evrim yavaşlar. Her fazda ölçülecek.
- **Karmaşıklık dengesizliği:** çok fazla etken aynı anda eklenirse hangisinin
  hangi davranışı ürettiği ayırt edilemez. Bu yüzden fazlar tek tek bitiriliyor
  ve her biri kendi ölçütüyle doğrulanıyor.
- **Yorumlanabilirliğin kaybı:** projenin asıl iddiası bu. Duyu sayısı arttıkça
  beyin diyagramı okunamaz hale gelebilir; panel her fazda gözden geçirilecek.
