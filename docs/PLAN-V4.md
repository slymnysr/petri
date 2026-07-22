# Petri v4 — Demodan Araca: "Kara Kutuyu Açan" Eğitim Aracı

## Amaç

Petri şu an etkileyici ama amaçsız: onu inşa etmiş olan bize bir şey anlatıyor,
bir yabancıya hiçbir şey. Bu turun tek hedefi o boşluğu kapatmak — **projeyi
inşa etmemiş biri açtığında bir şey öğrenip ayrılabilsin.**

**Konumlandırma:** Petri, "yapay zeka neden o kararı verdi" sorusunu herkesin
kavrayabileceği bir ölçekte gözle görülür kılan bir eğitim aracıdır. Evrimin
beyin inşa edişini izler, sonra o beynin neden öyle davrandığını tam olarak
açarsın.

**Dürüstlük sınırı (product copy dahil):** "AI güvenliği araştırması",
"biyolojik keşif" gibi iddialar yok. Bu bir *öğretme/gösterme* aracı; büyük
sorunu örnekle anlatır, çözdüğünü iddia etmez.

## Tasarım ilkesi

Her faz, yabancıya değer katmalı. Öncelik sırası "önce anlaşılırlık, sonra
derinlik": en derin yorumlanabilirlik bile, insan ne baktığını bilmiyorsa boşa.

---

## Faz 21 — Açılış ve rehber (demoyu araca çeviren tek şey)

Bir yabancı açtığında 30 saniyede şunu bilmeli: ne bakıyorum, tıklayabilirim,
ve bu neden önemli.

- İlk açılışta karşılama katmanı: 3-4 adımlık rehberli tanıtım
  - "Bu bir dünya. İçindeki canlıların davranışını kimse programlamadı."
  - "Sadece kıtlık var: enerjisi biten ölür, biriktiren çoğalır. Gerisi evrim."
  - "Bir canlıya tıkla — beynini açıp *neden* o kararı verdiğini göreceksin."
  - "İşte 'yapay zeka neden böyle yaptı' sorusunun, tamamen görebildiğin hali."
- Kapat / bir daha gösterme; sonradan açmak için "?" düğmesi
- `localStorage` ile ilk ziyaret hatırlanır
- Kısayol/kontrol ipuçları erişilebilir bir yerde

## Faz 22 — Küratörlü senaryolar (her biri bir gerçeği öğretir)

Determinizm sayesinde tekrarlanabilir dersler. Her senaryo = bir preset config +
düz dille "neye bak, ne göreceksin" anlatısı. Mevcut deney kaydet/yükle
altyapısının üstüne kurulur.

Senaryo taslakları:
- **"Avcılar yoktan doğuyor"** — otobur başlangıçtan avcılığın belirişi
- **"Mutasyonu kapat → evrim donar"** — kontrol deneyi, en öğretici olanı
- **"Soğuk sevenler soğuğa göçer"** — coğrafi uyum canlı izlenir
- **"Bu canlı neden sola döndü?"** — yorumlanabilirlik ödülü, tek bireye odak
- **"Ölümsüzlük evrimi durdurur"** — yaşlanmasız dünya, nüfus tavana yapışır

Her senaryo: yükle düğmesi + anlatı paneli + "ne olduğunu gör" ipucu.

## Faz 23 — Gerçek yorumlanabilirlik yöntemleri (derinlik)

"Şirin beyin diyagramı"ndan "gerçekten mekanistik yorumlanabilirlik"e çıkaran
kısım. Bunlar olmadan "neden" yüzeysel kalır.

- **Nöron işlev keşfi:** popülasyon genelinde her gizli nöronun aktivasyonunu
  duyu girdileriyle korele edip otomatik etiketle — "3. nöron ≈ yiyecek önde".
  Beyin görüntüleyicide nöronlar isimlenir.
- **Strateji kümeleme:** davranış/fenotip vektörlerine göre popülasyonu
  otomatik kümele, ortaya çıkan tipleri etiketle (otlayıcı/avcı/göçebe...).
  Kaç tip var, oranları ne — canlı gösterilir.

## Faz 24 — Düz dil "neden" katmanı

Mevcut karar satırı teknik. Bir uzman olmayanın okuyabileceği açıklamalara
genişlet: beyin, fenotip, soy — hepsi sade Türkçe. Terimlerin yanında minik
"bu ne demek" ipuçları.

## Faz 25 — Çerçeve ve doğrulama

- Artifact açılış metnini "hiç alife duymamış biri" için yeniden yaz; kara kutu
  sorusuna açıkça ama abartmadan bağla
- **Yabancı testi vekili:** onboarding + bir senaryo + bir seçim akışını e2e ile
  baştan sona sürüp "öğrenme yolu tamamlanabiliyor mu" doğrula
- README ve Artifact güncelle, yeni konumlandırmayı yansıt

---

## Sıralama ve gerekçe

**21 → 22** önce, çünkü ikisi olmadan derinlik boşa (kimse tıklamayı bilmezse
nöron etiketi kimin umurunda). **23** farkı yaratan derinlik. **24-25** cilası
ve doğrulaması.

## Risk

- **Kapsam şişmesi:** "eğitim aracı" her şeyi eklemeye davet eder. Ölçüt sabit:
  bir yabancı bir gerçeği öğrenip ayrılabiliyor mu? Ona hizmet etmeyen ekleme
  girmez.
- **Abartı:** product copy'de büyük iddiaya kayma riski. Her metin "öğretir,
  keşfetmez/çözmez" süzgecinden geçer.
- **Onboarding'in yolu kapatması:** rehber, deneyimli kullanıcının önüne
  geçmemeli — atlanabilir ve kalıcı kapatılabilir olmalı.
