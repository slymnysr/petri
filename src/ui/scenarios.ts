import { DEFAULT_SCENARIO_ID, SCENARIOS, type Scenario } from '../sim/scenarios';

/**
 * Senaryo seçici ve anlatı bandı.
 *
 * Ekranın üst-ortasında durur (sol-üst HUD ve sağ-üst inceleme paneliyle
 * çakışmaz). Bir senaryo seçilince altında "ne izle, ne öğren" anlatısı belirir.
 * Amaç: yabancıyı rastgele kaydırıcılarla baş başa bırakmak yerine, tek bir
 * olguya odaklanmış bir ders sunmak.
 */
export class ScenarioPanel {
  private readonly select: HTMLSelectElement;
  private readonly narrative: HTMLElement;
  private readonly watchEl: HTMLElement;
  private readonly lessonEl: HTMLElement;

  /** Bir senaryo seçildiğinde çağrılır; dünyayı kuran taraf bunu dinler. */
  onLoad: ((scenario: Scenario) => void) | null = null;

  constructor(parent: HTMLElement = document.body) {
    const root = document.createElement('div');
    root.className = 'scenario-panel';

    const bar = document.createElement('div');
    bar.className = 'scenario-bar';

    const label = document.createElement('label');
    label.className = 'scenario-label';
    label.textContent = 'senaryo';
    label.htmlFor = 'scenario-select';

    this.select = document.createElement('select');
    this.select.id = 'scenario-select';
    this.select.className = 'scenario-select';
    for (const s of SCENARIOS) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      this.select.appendChild(opt);
    }
    this.select.value = DEFAULT_SCENARIO_ID;
    this.select.addEventListener('change', () => this.load(this.select.value));

    const dismiss = document.createElement('button');
    dismiss.className = 'scenario-dismiss';
    dismiss.textContent = '×';
    dismiss.title = 'anlatıyı gizle';
    dismiss.setAttribute('aria-label', 'anlatıyı gizle');
    dismiss.addEventListener('click', () => this.narrative.classList.add('hidden'));

    bar.append(label, this.select, dismiss);

    this.narrative = document.createElement('div');
    this.narrative.className = 'scenario-narrative hidden';
    this.watchEl = document.createElement('div');
    this.watchEl.className = 'scenario-watch';
    this.lessonEl = document.createElement('div');
    this.lessonEl.className = 'scenario-lesson';
    this.narrative.append(this.watchEl, this.lessonEl);

    root.append(bar, this.narrative);
    parent.appendChild(root);
  }

  /** Seçili senaryonun kimliğini programatik olarak ayarlar (yükleme yapmadan). */
  setActive(id: string): void {
    this.select.value = id;
  }

  private load(id: string): void {
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) return;

    this.watchEl.innerHTML = '';
    const eye = document.createElement('span');
    eye.className = 'scenario-watch-icon';
    eye.textContent = 'İZLE';
    this.watchEl.append(eye, document.createTextNode(' ' + scenario.watch));
    this.lessonEl.textContent = scenario.lesson;
    this.narrative.classList.remove('hidden');

    this.onLoad?.(scenario);
  }
}
