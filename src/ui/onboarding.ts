/**
 * Açılış rehberi — demoyu araca çeviren katman.
 *
 * Petri'yi inşa etmemiş biri açtığında ne yapacağını bilmiyor: küreleri
 * seyrediyor, kapatıyor. Bu rehber o boşluğu kapatır — 30 saniyede ne baktığını,
 * tıklayabileceğini ve bunun neden önemli olduğunu anlatır.
 *
 * Tasarım kısıtı: deneyimli kullanıcının önüne geçmemeli. İlk ziyarette açılır
 * ama atlanabilir ve kalıcı kapatılabilir; sonradan "?" düğmesiyle çağrılır.
 */

const STORAGE_KEY = 'petri.onboarded.v1';

interface Step {
  title: string;
  body: string;
}

const STEPS: readonly Step[] = [
  {
    title: 'Ne bakıyorsun?',
    body:
      'Bu kapalı bir dünya. İçindeki her canlının bir beyni var — küçük bir sinir ağı. ' +
      'Ama hiçbirinin davranışını kimse programlamadı.',
  },
  {
    title: 'Kurallar bu kadar',
    body:
      'Tek yasa kıtlık: enerjisi biten ölür, yeterince biriktiren ikiye bölünür ve yavrusu ' +
      'azıcık değişir. Nesiller boyunca "işe yarayan" beyinler kendiliğinden kalır. ' +
      'Buna evrim deniyor — ve gözünün önünde oluyor.',
  },
  {
    title: 'Asıl olay: beyni aç',
    body:
      'Bir canlıya tıkla. Sağda beyni açılır: hangi duyusu hangi kararı verdirdi, düz ' +
      'cümleyle görürsün — "sola dönüyor çünkü yiyecek solunda." Kimse bunu ona öğretmedi; ' +
      'evrim buldu.',
  },
  {
    title: 'Bu neden önemli?',
    body:
      'Bugün yapay zeka için sorulan en zor soru şu: "neden bu kararı verdi?" Bu sistemlerin ' +
      'içi çoğu zaman bir kara kutu. Petri, o sorunun tamamen içine bakabildiğin küçük bir ' +
      'halidir.',
  },
];

export class Onboarding {
  private readonly overlay: HTMLElement;
  private readonly helpButton: HTMLButtonElement;
  private readonly titleEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly dotsEl: HTMLElement;
  private readonly backBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;
  private step = 0;

  constructor(parent: HTMLElement = document.body) {
    // "?" yardım düğmesi — her zaman erişilebilir, sonradan rehberi çağırır.
    this.helpButton = document.createElement('button');
    this.helpButton.className = 'help-button';
    this.helpButton.textContent = '?';
    this.helpButton.title = 'Bu nedir?';
    this.helpButton.setAttribute('aria-label', 'Tanıtımı aç');
    this.helpButton.addEventListener('click', () => this.open());
    parent.appendChild(this.helpButton);

    this.overlay = document.createElement('div');
    this.overlay.className = 'onboard-overlay hidden';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');

    const card = document.createElement('div');
    card.className = 'onboard-card';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'onboard-eyebrow';
    eyebrow.textContent = 'Petri';

    this.titleEl = document.createElement('h2');
    this.titleEl.className = 'onboard-title';

    this.bodyEl = document.createElement('p');
    this.bodyEl.className = 'onboard-body';

    this.dotsEl = document.createElement('div');
    this.dotsEl.className = 'onboard-dots';
    for (let i = 0; i < STEPS.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'onboard-dot';
      this.dotsEl.appendChild(dot);
    }

    const nav = document.createElement('div');
    nav.className = 'onboard-nav';

    const skip = document.createElement('button');
    skip.className = 'onboard-skip';
    skip.textContent = 'atla';
    skip.addEventListener('click', () => this.finish());

    const navRight = document.createElement('div');
    navRight.className = 'onboard-nav-right';
    this.backBtn = document.createElement('button');
    this.backBtn.className = 'onboard-btn ghost';
    this.backBtn.textContent = 'geri';
    this.backBtn.addEventListener('click', () => this.go(this.step - 1));
    this.nextBtn = document.createElement('button');
    this.nextBtn.className = 'onboard-btn';
    this.nextBtn.addEventListener('click', () => {
      if (this.step >= STEPS.length - 1) this.finish();
      else this.go(this.step + 1);
    });
    navRight.append(this.backBtn, this.nextBtn);
    nav.append(skip, navRight);

    card.append(eyebrow, this.titleEl, this.bodyEl, this.dotsEl, nav);
    this.overlay.appendChild(card);

    // Boşluğa tıklamak kapatır (ama karta tıklamak kapatmaz).
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.finish();
    });
    document.addEventListener('keydown', (e) => {
      if (this.overlay.classList.contains('hidden')) return;
      if (e.key === 'Escape') this.finish();
      else if (e.key === 'ArrowRight') this.nextBtn.click();
      else if (e.key === 'ArrowLeft') this.go(this.step - 1);
    });

    parent.appendChild(this.overlay);

    if (!this.hasSeen()) this.open();
  }

  private hasSeen(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // localStorage erişilemezse (gizli mod, gömülü bağlam) her açılışta
      // göstermektense hiç göstermemeyi seçiyoruz — tekrarlayan rahatsızlık,
      // bir kez kaçırmaktan kötü.
      return true;
    }
  }

  private markSeen(): void {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // sessizce geç
    }
  }

  open(): void {
    this.go(0);
    this.overlay.classList.remove('hidden');
  }

  private finish(): void {
    this.overlay.classList.add('hidden');
    this.markSeen();
  }

  private go(index: number): void {
    this.step = Math.max(0, Math.min(STEPS.length - 1, index));
    const s = STEPS[this.step]!;
    this.titleEl.textContent = s.title;
    this.bodyEl.textContent = s.body;

    const dots = this.dotsEl.children;
    for (let i = 0; i < dots.length; i++) {
      dots[i]!.classList.toggle('active', i === this.step);
    }

    this.backBtn.style.visibility = this.step === 0 ? 'hidden' : 'visible';
    this.nextBtn.textContent = this.step === STEPS.length - 1 ? 'başla' : 'ileri';
  }
}
