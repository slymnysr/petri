import { HYPOTHESES, runExperiment, type Hypothesis } from '../sim/experiment';

/**
 * Hipotez test paneli — kullanıcı bir iddia seçip "test et" der, araç birkaç
 * tohumda koşturup "tuttu / tutmadı" cevabını sayılarıyla verir.
 *
 * Bu, ANALIZ.md'deki ölçüm disiplinini kullanıcı-yüzeyli bir özelliğe çeviriyor:
 * bilimsel yöntemi anlatmanın en doğrudan yolu, kullanıcıyı deneyci yapmak.
 */
export class ExperimentPanel {
  private readonly overlay: HTMLElement;
  readonly button: HTMLButtonElement;
  private readonly select: HTMLSelectElement;
  private readonly runBtn: HTMLButtonElement;
  private readonly progress: HTMLElement;
  private readonly progressBar: HTMLElement;
  private readonly result: HTMLElement;
  private running = false;

  constructor(parent: HTMLElement = document.body) {
    this.button = document.createElement('button');
    this.button.className = 'experiment-button';
    this.button.textContent = 'deney';
    this.button.title = 'Bir hipotez test et';
    this.button.addEventListener('click', () => this.open());
    parent.appendChild(this.button);

    this.overlay = document.createElement('div');
    this.overlay.className = 'experiment-overlay hidden';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');

    const card = document.createElement('div');
    card.className = 'experiment-card';

    const close = document.createElement('button');
    close.className = 'findings-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'kapat');
    close.addEventListener('click', () => this.hide());

    const eyebrow = document.createElement('div');
    eyebrow.className = 'findings-eyebrow';
    eyebrow.textContent = 'Hipotez testi';

    const title = document.createElement('h2');
    title.className = 'findings-title';
    title.textContent = 'Bir iddiayı sına';

    const intro = document.createElement('p');
    intro.className = 'findings-intro';
    intro.textContent =
      'Bir hipotez seç. Araç iki koşulu birkaç tohumda koşturup ölçer ve "tuttu mu" ' +
      'der — sayılarıyla. Bazı iddialar tutmaz; işin doğrusu da bu.';

    this.select = document.createElement('select');
    this.select.className = 'experiment-select';
    for (const h of HYPOTHESES) {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = h.claim;
      this.select.appendChild(opt);
    }

    this.runBtn = document.createElement('button');
    this.runBtn.className = 'onboard-btn';
    this.runBtn.textContent = 'test et';
    this.runBtn.addEventListener('click', () => void this.run());

    const controls = document.createElement('div');
    controls.className = 'experiment-controls';
    controls.append(this.select, this.runBtn);

    this.progress = document.createElement('div');
    this.progress.className = 'experiment-progress hidden';
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'experiment-progress-bar';
    this.progress.appendChild(this.progressBar);

    this.result = document.createElement('div');
    this.result.className = 'experiment-result';

    card.append(close, eyebrow, title, intro, controls, this.progress, this.result);
    this.overlay.appendChild(card);
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay && !this.running) this.hide();
    });
    document.addEventListener('keydown', (e) => {
      if (!this.overlay.classList.contains('hidden') && e.key === 'Escape' && !this.running) {
        this.hide();
      }
    });

    parent.appendChild(this.overlay);
  }

  open(): void {
    this.overlay.classList.remove('hidden');
  }

  hide(): void {
    this.overlay.classList.add('hidden');
  }

  private currentHypothesis(): Hypothesis {
    return HYPOTHESES.find((h) => h.id === this.select.value) ?? HYPOTHESES[0]!;
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.runBtn.disabled = true;
    this.select.disabled = true;
    this.result.innerHTML = '';
    this.progress.classList.remove('hidden');
    this.setProgress(0, 1);

    const hypothesis = this.currentHypothesis();
    try {
      // 3500 adım: nüfus etkileri (zirve/sönme) bu süreden çok önce oturuyor;
      // daha uzun koşu deneyi yavaşlatmaktan başka işe yaramıyor.
      const res = await runExperiment(hypothesis, [1, 7, 21], 3500, (done, total) =>
        this.setProgress(done, total),
      );
      this.showResult(hypothesis, res.baselineAvg, res.treatmentAvg, res.held, res.relativeChange);
    } finally {
      this.progress.classList.add('hidden');
      this.running = false;
      this.runBtn.disabled = false;
      this.select.disabled = false;
    }
  }

  private setProgress(done: number, total: number): void {
    this.progressBar.style.width = `${(done / total) * 100}%`;
  }

  private showResult(
    h: Hypothesis,
    baseline: number,
    treatment: number,
    held: boolean,
    relativeChange: number,
  ): void {
    this.result.innerHTML = '';

    const verdict = document.createElement('div');
    verdict.className = `experiment-verdict ${held ? 'held' : 'failed'}`;
    verdict.textContent = held ? '✓ İddia tuttu' : '✗ İddia tutmadı';
    this.result.appendChild(verdict);

    const fmt = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(2));
    const rows: [string, string][] = [
      ['ölçüt', h.metricLabel],
      ['temel koşul', fmt(baseline)],
      ['müdahale', fmt(treatment)],
      ['değişim', `${relativeChange >= 0 ? '+' : ''}${relativeChange.toFixed(0)}%`],
      ['beklenen yön', `müdahale ölçütü ${h.direction}`],
    ];
    for (const [k, v] of rows) {
      const row = document.createElement('div');
      row.className = 'experiment-row';
      const kk = document.createElement('span');
      kk.className = 'experiment-key';
      kk.textContent = k;
      const vv = document.createElement('span');
      vv.className = 'experiment-val';
      vv.textContent = v;
      row.append(kk, vv);
      this.result.appendChild(row);
    }

    const note = document.createElement('p');
    note.className = 'experiment-note';
    note.textContent = held
      ? '3 tohumun ortalaması, beklenen yönde ve gürültü eşiğinin üstünde değişti.'
      : 'Beklenen yönde anlamlı bir değişim çıkmadı. Tutmayan bir hipotez de bir bulgudur.';
    this.result.appendChild(note);
  }
}
