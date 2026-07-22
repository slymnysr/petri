/**
 * Bulgular paneli — analizin uygulama içinden erişilebilir hali.
 *
 * ANALIZ.md deposunda dururken artifact'ı açan bir yabancı onu göremiyordu.
 * Bu panel, ölçülmüş bulguları — tutanları ve tutmayanları — uygulamanın
 * içinden ulaşılabilir kılar. Amaç projenin dürüstlük duruşunu da görünür
 * yapmak: "şunu bekledik, ölçtük, olmadı" da bir sonuçtur.
 *
 * İçerik ANALIZ.md'nin özeti; tam kayıt ve sayılar orada. İkisi kabaca eşzamanlı
 * tutulmalı — bu, gösterilebilir kısa sürüm.
 */

interface Finding {
  title: string;
  detail: string;
}

interface FindingGroup {
  heading: string;
  note?: string;
  items: Finding[];
}

const GROUPS: readonly FindingGroup[] = [
  {
    heading: 'Tutan bulgular',
    items: [
      {
        title: 'Evrim, çevreye tepki vermeyi öğretiyor',
        detail:
          'Kararı kör bir eğilimden değil gerçek bir duyudan gelen canlıların oranı ' +
          'kurucu nesilde %75 iken ~47. nesilde %96’ya çıkıyor.',
      },
      {
        title: 'Coğrafi ekotipler kendiliğinden oluşuyor',
        detail:
          'Isı tercihi ile bulunulan enlem arasındaki korelasyon 0’dan ~0.5’e tırmanıyor: ' +
          'sıcak sevenler sıcağa, soğuk sevenler soğuğa yerleşiyor. Kimse söylemeden.',
      },
      {
        title: 'Evrimin hızı da evrimleşiyor',
        detail:
          'Mutasyon oranı genomda taşınan bir gen. Kararlı dünyada 0.068→0.061 düşüyor, ' +
          'çalkantılıda 0.068→0.081 yükseliyor — popülasyon kendi değişim hızını ayarlıyor.',
      },
      {
        title: 'Beyin içinde iş bölümü var',
        detail:
          'Tek bir beynin 10 gizli nöronu ortalama ~7 farklı duyuya uzmanlaşıyor. Beyin ' +
          'bütün duyuları tek yere yığmıyor — kimse tasarlamadan.',
      },
      {
        title: 'Mutasyonun çeşitlilik yarattığı görülebiliyor',
        detail:
          '"Karşılaştır" modunda aynı tohum, tek fark: sağda mutasyon kapalı. Soldaki dünya ' +
          'renk cümbüşü (çeşitli), sağdaki neredeyse tek renk (tek-tip). Ama mutasyonsuz ' +
          'dünya daha kalabalık kalıyor — çeşitliliğin bir bedeli var.',
      },
    ],
  },
  {
    heading: 'Tutmayan bulgular',
    note: 'Bunlar da bulgu: bir hipotezi ölçüp çürütmek, bu dünya hakkında gerçek bir şey söyler.',
    items: [
      {
        title: '“Ölümsüzlük evrimi durdurur” artık geçerli değil',
        detail:
          'Basit 2B dünyada doğruydu. Ama avcılık ve iklim eklenince yaşlanmayı kapatmak ' +
          'nüfusu tavana yapıştırmıyor (kapalı %39 vs açık %51 zirve). Başka ölüm ' +
          'kaynakları onun yerine geçiyor. Bir olgunun geçerliliği dünyanın karmaşıklığına bağlı.',
      },
      {
        title: 'Nöron rolleri organizmalar arasında yakınsıyor',
        detail:
          '“Her canlının aynı nöronu farklı şeye bakar” sanmıştık. Ölçüm: 1. nöron ' +
          'canlıların %91’inde aynı duyuya bakıyor — çünkü hepsi ortak bir atadan türüyor. ' +
          'Asıl fark beynin içinde, canlılar arasında değil.',
      },
      {
        title: 'Avcılar daha iri bir gövde geliştirmiyor',
        detail:
          'Avlanma boyut gerektirdiğinden avcılar irileşir sanmıştık. Üç tohumda gövde farkı ' +
          '+0.7 / −0.0 / −0.1 — tutarsız. Trofik rol ile beden bu dünyada birbirinden bağımsız.',
      },
    ],
  },
];

export class Findings {
  private readonly overlay: HTMLElement;
  readonly button: HTMLButtonElement;

  constructor(parent: HTMLElement = document.body) {
    this.button = document.createElement('button');
    this.button.className = 'findings-button';
    this.button.textContent = 'bulgular';
    this.button.title = 'Şimdiye dek ölçülenler';
    this.button.addEventListener('click', () => this.open());
    parent.appendChild(this.button);

    this.overlay = document.createElement('div');
    this.overlay.className = 'findings-overlay hidden';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');

    const card = document.createElement('div');
    card.className = 'findings-card';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'findings-eyebrow';
    eyebrow.textContent = 'Ölçülmüş bulgular';

    const title = document.createElement('h2');
    title.className = 'findings-title';
    title.textContent = 'Bu dünya bize ne öğretti?';

    const intro = document.createElement('p');
    intro.className = 'findings-intro';
    intro.textContent =
      'Petri, yapay bir dünyada yürütülen ölçülmüş deneylerdir. Her sayı deterministik, ' +
      'yani tekrar üretilebilir. İşte şimdiye dek ölçülenler.';

    const close = document.createElement('button');
    close.className = 'findings-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'kapat');
    close.addEventListener('click', () => this.hide());

    card.append(close, eyebrow, title, intro);

    for (const group of GROUPS) {
      const h = document.createElement('div');
      h.className = 'findings-group-heading';
      h.textContent = group.heading;
      card.appendChild(h);

      if (group.note) {
        const note = document.createElement('p');
        note.className = 'findings-note';
        note.textContent = group.note;
        card.appendChild(note);
      }

      for (const item of group.items) {
        const el = document.createElement('div');
        el.className = 'finding';
        const ft = document.createElement('div');
        ft.className = 'finding-title';
        ft.textContent = item.title;
        const fd = document.createElement('div');
        fd.className = 'finding-detail';
        fd.textContent = item.detail;
        el.append(ft, fd);
        card.appendChild(el);
      }
    }

    const footer = document.createElement('p');
    footer.className = 'findings-footer';
    footer.textContent = 'Tam kayıt ve tüm sayılar depodaki ANALIZ.md dosyasında.';
    card.appendChild(footer);

    this.overlay.appendChild(card);
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
    document.addEventListener('keydown', (e) => {
      if (!this.overlay.classList.contains('hidden') && e.key === 'Escape') this.hide();
    });

    parent.appendChild(this.overlay);
  }

  open(): void {
    this.overlay.classList.remove('hidden');
  }

  hide(): void {
    this.overlay.classList.add('hidden');
  }
}
