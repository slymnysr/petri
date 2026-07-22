import {
  METRIC_KEYS,
  METRIC_LABELS,
  METRIC_RANGES,
  MetricHistory,
  type MetricKey,
} from '../sim/metrics';
import type { World } from '../sim/world';

/**
 * Deney paneli: simülasyonu durdurma/hızlandırma, ortam parametrelerini canlı
 * değiştirme ve zaman serilerini izleme.
 *
 * Amaç "ayar menüsü" değil, deney yapabilmek: kıtlık yaratıp popülasyonun ne
 * yaptığını görmek, mutasyonu kapatıp evrimin durduğunu izlemek gibi. Bu
 * yüzden parametreler koşu sırasında değişebiliyor ve etkileri grafiklerde
 * anında görünüyor.
 */

const CHART_W = 268;
const CHART_H = 42;

interface SliderSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  get: (w: World) => number;
  set: (w: World, v: number) => void;
  format: (v: number) => string;
}

const SLIDERS: SliderSpec[] = [
  {
    label: 'yiyecek üretimi',
    min: 0, max: 30, step: 0.5,
    get: (w) => w.config.foodSpawnRate,
    set: (w, v) => { w.config.foodSpawnRate = v; },
    format: (v) => v.toFixed(1),
  },
  {
    label: 'mutasyon çarpanı',
    min: 0, max: 3, step: 0.05,
    get: (w) => w.config.mutationRateScale,
    set: (w, v) => { w.config.mutationRateScale = v; },
    format: (v) => v.toFixed(2),
  },
  {
    label: 'mutasyon şiddeti',
    min: 0, max: 0.5, step: 0.01,
    get: (w) => w.config.mutationScale,
    set: (w, v) => { w.config.mutationScale = v; },
    format: (v) => v.toFixed(2),
  },
  {
    label: 'yaşlanma',
    min: 0, max: 0.006, step: 0.0001,
    get: (w) => w.config.agingRate,
    set: (w, v) => { w.config.agingRate = v; },
    format: (v) => v.toFixed(4),
  },
  {
    label: 'mevsim şiddeti',
    min: 0, max: 1, step: 0.05,
    get: (w) => w.config.seasonAmplitude,
    set: (w, v) => { w.config.seasonAmplitude = v; },
    format: (v) => v.toFixed(2),
  },
];

export class Controls {
  readonly history = new MetricHistory();
  private readonly root: HTMLElement;
  private readonly charts = new Map<MetricKey, CanvasRenderingContext2D>();
  private readonly buffer = new Float32Array(this.history.capacity);
  private readonly sliderValues: HTMLElement[] = [];
  private readonly speedLabel: HTMLElement;
  private readonly pauseButton: HTMLButtonElement;
  private ioStatus!: HTMLElement;
  private lastChartDraw = 0;

  paused = false;
  stepsPerFrame = 1;
  onReset: (() => void) | null = null;

  constructor(
    private readonly world: World,
    parent: HTMLElement = document.body,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'controls';
    parent.appendChild(this.root);

    // --- Çalıştırma kontrolleri ---
    const runRow = document.createElement('div');
    runRow.className = 'control-row';

    this.pauseButton = button('duraklat', () => this.togglePause());
    runRow.appendChild(this.pauseButton);
    runRow.appendChild(button('−', () => this.setSpeed(Math.max(1, Math.floor(this.stepsPerFrame / 2)))));
    this.speedLabel = document.createElement('span');
    this.speedLabel.className = 'speed-label';
    runRow.appendChild(this.speedLabel);
    runRow.appendChild(button('+', () => this.setSpeed(Math.min(64, this.stepsPerFrame * 2))));
    runRow.appendChild(button('yeni dünya', () => this.onReset?.()));
    this.root.appendChild(runRow);
    this.setSpeed(1);

    // --- Deney kaydet/yükle ---
    // Simülasyon deterministik olduğu için tohum + parametreler bir deneyi
    // tamamen tanımlar; binlerce genomu saklamaya gerek yok. Aynı JSON'u
    // yükleyen herkes birebir aynı evrimi görür.
    const ioRow = document.createElement('div');
    ioRow.className = 'control-row';
    ioRow.appendChild(button('deneyi kopyala', () => this.copyScenario()));
    ioRow.appendChild(button('deney yükle', () => this.loadScenario()));
    this.ioStatus = document.createElement('span');
    this.ioStatus.className = 'io-status';
    ioRow.appendChild(this.ioStatus);
    this.root.appendChild(ioRow);

    // --- Parametreler ---
    for (const spec of SLIDERS) {
      const row = document.createElement('label');
      row.className = 'slider-row';

      const name = document.createElement('span');
      name.className = 'slider-label';
      name.textContent = spec.label;

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.value = String(spec.get(this.world));

      const value = document.createElement('span');
      value.className = 'slider-value';
      value.textContent = spec.format(spec.get(this.world));
      this.sliderValues.push(value);

      input.addEventListener('input', () => {
        const v = Number(input.value);
        spec.set(this.world, v);
        value.textContent = spec.format(v);
      });

      row.append(name, input, value);
      this.root.appendChild(row);
    }

    // --- Grafikler ---
    for (const key of METRIC_KEYS) {
      const wrap = document.createElement('div');
      wrap.className = 'chart-wrap';

      const label = document.createElement('div');
      label.className = 'chart-label';
      label.textContent = METRIC_LABELS[key];

      const canvas = document.createElement('canvas');
      canvas.width = CHART_W * 2;
      canvas.height = CHART_H * 2;
      canvas.className = 'chart-canvas';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        this.charts.set(key, ctx);
      }

      wrap.append(label, canvas);
      this.root.appendChild(wrap);
    }
  }

  /** Deneyi tanımlayan her şeyi JSON olarak panoya kopyalar. */
  private async copyScenario(): Promise<void> {
    const scenario = JSON.stringify({ petri: 1, config: this.world.config }, null, 2);
    try {
      await navigator.clipboard.writeText(scenario);
      this.flashStatus('kopyalandı');
    } catch {
      // Pano izni yoksa (veya güvenli bağlam değilse) kullanıcı elle alsın.
      window.prompt('Deney JSON — kopyalayın:', scenario);
    }
  }

  private loadScenario(): void {
    const text = window.prompt('Deney JSON yapıştırın:');
    if (!text) return;
    try {
      const parsed = JSON.parse(text) as { petri?: number; config?: Record<string, unknown> };
      if (parsed.petri !== 1 || !parsed.config) throw new Error('tanınmayan biçim');

      // Yalnızca mevcut anahtarları alıyoruz: yabancı alanlar config'i
      // kirletmesin, eksik alanlar da mevcut değerinde kalsın.
      for (const key of Object.keys(this.world.config)) {
        const value = parsed.config[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
          (this.world.config as unknown as Record<string, number>)[key] = value;
        }
      }
      this.world.reseed(this.world.config.seed);
      this.history.clear();
      this.syncSliders();
      this.flashStatus('yüklendi');
    } catch (error) {
      this.flashStatus('geçersiz JSON');
      console.warn('Petri: deney yüklenemedi', error);
    }
  }

  private flashStatus(text: string): void {
    this.ioStatus.textContent = text;
    window.setTimeout(() => {
      if (this.ioStatus.textContent === text) this.ioStatus.textContent = '';
    }, 2000);
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.pauseButton.textContent = this.paused ? 'devam' : 'duraklat';
    this.pauseButton.classList.toggle('active', this.paused);
  }

  setSpeed(value: number): void {
    this.stepsPerFrame = value;
    this.speedLabel.textContent = `${value}×`;
  }

  /** Kaydırıcıları dünyanın gerçek değerleriyle eşitler (yeni dünya sonrası). */
  syncSliders(): void {
    SLIDERS.forEach((spec, i) => {
      const el = this.sliderValues[i];
      if (el) el.textContent = spec.format(spec.get(this.world));
    });
  }

  draw(now: number): void {
    // Grafikler ~5 Hz'de yenilenir; her karede 5 canvas çizmek gereksiz.
    if (now - this.lastChartDraw < 200) return;
    this.lastChartDraw = now;

    for (const key of METRIC_KEYS) {
      const ctx = this.charts.get(key);
      if (!ctx) continue;
      const n = this.history.read(key, this.buffer);
      drawSeries(ctx, this.buffer, n, METRIC_RANGES[key] ?? null);
    }
  }
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'ctl-button';
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

/**
 * Tek bir seriyi çizer. Ölçek verilmezse veriden türetilir; duyu-sürücülü oran
 * gibi doğal olarak 0..1 olan seriler sabit ölçekle çizilir ki küçük
 * dalgalanmalar tüm grafiği doldurup dramatik görünmesin.
 */
function drawSeries(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  count: number,
  fixedRange: [number, number] | null,
): void {
  ctx.clearRect(0, 0, CHART_W, CHART_H);
  ctx.fillStyle = '#0b1018';
  ctx.fillRect(0, 0, CHART_W, CHART_H);
  if (count < 2) return;

  let min = fixedRange ? fixedRange[0] : Infinity;
  let max = fixedRange ? fixedRange[1] : -Infinity;
  if (!fixedRange) {
    for (let i = 0; i < count; i++) {
      const v = data[i]!;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (max - min < 1e-6) {
      min -= 0.5;
      max += 0.5;
    }
  }

  const scaleX = CHART_W / (count - 1);
  const scaleY = CHART_H / (max - min);

  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const x = i * scaleX;
    const y = CHART_H - (data[i]! - min) * scaleY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Son değeri sağ üstte yaz — eğrinin nerede bittiği en çok merak edilen şey.
  ctx.fillStyle = '#6b7789';
  ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(formatValue(data[count - 1]!), CHART_W - 3, 10);
}

function formatValue(v: number): string {
  if (v >= 1000) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
