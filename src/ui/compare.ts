import type { SimConfig } from '../sim/types';

/**
 * İki dünya yan yana — nedenselliği görünür kılar.
 *
 * Aynı tohum, tek parametre değişik. İki dünya birebir aynı başlar ve yalnızca
 * o tek fark yüzünden ıraksar. "Bu tek değişiklik şu farkı yarattı" — bir
 * simülasyonda nedeni izlemenin en doğrudan yolu.
 *
 * Bu modül durumu ve UI'yı (aç/kapa düğmesi, fark seçici, iki etiket) tutar;
 * asıl çift-çizim main.ts'in kare döngüsünde yapılır.
 */

export interface CompareDiff {
  id: string;
  label: string;
  config: Partial<SimConfig>;
}

export const DIFFS: readonly CompareDiff[] = [
  { id: 'mutasyon', label: 'sağda: mutasyon kapalı', config: { mutationRateScale: 0 } },
  { id: 'bolluk', label: 'sağda: bol yiyecek', config: { foodSpawnRate: 32, maxFood: 5000 } },
  { id: 'mevsimsiz', label: 'sağda: mevsim/gece yok', config: { seasonAmplitude: 0, seasonalTempShift: 0, dayNightPeriod: 0 } },
  { id: 'sicak', label: 'sağda: iklim gradyanı yok', config: { latitudeGradient: 0, depthGradient: 0 } },
];

export class Compare {
  active = false;
  readonly button: HTMLButtonElement;
  private readonly select: HTMLSelectElement;
  private readonly bar: HTMLElement;
  private readonly labelLeft: HTMLElement;
  private readonly labelRight: HTMLElement;

  /** Aç/kapa ya da fark değişince main'in dünyaları yeniden kurması için. */
  onChange: (() => void) | null = null;

  constructor(parent: HTMLElement = document.body) {
    this.button = document.createElement('button');
    this.button.className = 'compare-button';
    this.button.textContent = 'karşılaştır';
    this.button.title = 'İki dünyayı yan yana koy';
    this.button.addEventListener('click', () => this.toggle());
    parent.appendChild(this.button);

    // Üstte fark seçici (yalnızca aktifken görünür).
    this.bar = document.createElement('div');
    this.bar.className = 'compare-bar hidden';
    const label = document.createElement('span');
    label.className = 'compare-bar-label';
    label.textContent = 'fark';
    this.select = document.createElement('select');
    this.select.className = 'compare-select';
    for (const d of DIFFS) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.label;
      this.select.appendChild(opt);
    }
    this.select.addEventListener('change', () => this.onChange?.());
    this.bar.append(label, this.select);
    parent.appendChild(this.bar);

    // Her yarının üstünde etiket.
    this.labelLeft = document.createElement('div');
    this.labelLeft.className = 'compare-label compare-label-left hidden';
    this.labelRight = document.createElement('div');
    this.labelRight.className = 'compare-label compare-label-right hidden';
    parent.append(this.labelLeft, this.labelRight);
  }

  currentDiff(): CompareDiff {
    return DIFFS.find((d) => d.id === this.select.value) ?? DIFFS[0]!;
  }

  private toggle(): void {
    this.active = !this.active;
    this.button.classList.toggle('active', this.active);
    this.bar.classList.toggle('hidden', !this.active);
    this.labelLeft.classList.toggle('hidden', !this.active);
    this.labelRight.classList.toggle('hidden', !this.active);
    this.onChange?.();
  }

  /** Etiketleri günceller (nüfusları gösterir). */
  updateLabels(popLeft: number, popRight: number): void {
    if (!this.active) return;
    this.labelLeft.textContent = `temel · nüfus ${popLeft}`;
    this.labelRight.textContent = `${this.currentDiff().label.replace('sağda: ', '')} · nüfus ${popRight}`;
  }
}
