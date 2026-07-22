import type { WorldStats } from '../sim/world';

/**
 * Sol üst köşedeki canlı istatistik paneli.
 *
 * DOM güncellemesi her karede değil, ~6 Hz'de yapılır: metin düğümü yazmak
 * 60 FPS'te gereksiz düzen hesabı tetikliyor ve sayılar zaten okunamayacak
 * hızda değişiyordu.
 */
const UPDATE_INTERVAL_MS = 160;

/**
 * Metriklerin düz dil açıklamaları. Yeni bir ziyaretçi "duyu-sürücülü" ya da
 * "ısı uyumu"nun ne demek olduğunu bilmiyor; bu ipuçları etikete gelince
 * (title) beliriyor. Araç bir yabancıya bir şey öğretecekse, terimlerini de
 * açması gerek.
 */
const HINTS: Record<string, string> = {
  'duyu-sürücülü':
    'Kararı kör bir alışkanlıktan değil, gerçek bir duyudan (yiyecek, komşu, ısı…) ' +
    'gelen canlıların oranı. Evrim ilerledikçe yükselir: canlılar çevrelerine tepki ' +
    'vermeyi öğrenir.',
  avcı: 'Başka canlıları avlayabilecek kadar saldırgan olanların oranı. Gerisi otlayıcı.',
  'ısı uyumu':
    'Isı tercihi ile bulunduğu bölgenin sıcaklığı ne kadar örtüşüyor. 0 = rastgele ' +
    'dağılmış, yükseldikçe sıcak sevenler sıcağa, soğuk sevenler soğuğa yerleşmiş demek.',
  mutasyon:
    'Popülasyonun ortalama mutasyon oranı. Bu oran da bir gen ve o da evrimleşiyor: ' +
    'kararlı dünyada düşer, çalkantılı dünyada yükselir.',
  'yem/ömür': 'Bir canlının yaşamı boyunca ortalama kaç kez beslendiği — uygunluğun ölçüsü.',
  nesil: 'En yaşlı soyun kaçıncı kuşakta olduğu (ve popülasyon ortalaması).',
};

export class Hud {
  private readonly root: HTMLElement;
  private readonly rows = new Map<string, HTMLElement>();
  private lastUpdate = 0;

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    parent.appendChild(this.root);

    for (const key of [
      'nüfus',
      'yiyecek',
      'nesil',
      'yem/ömür',
      'duyu-sürücülü',
      'avcı',
      'ısı uyumu',
      'mutasyon',
      'gökyüzü',
      'adım',
      'FPS',
    ]) {
      const row = document.createElement('div');
      row.className = 'hud-row';
      const label = document.createElement('span');
      label.className = 'hud-label';
      label.textContent = key;
      const hint = HINTS[key];
      if (hint) {
        label.classList.add('has-hint');
        label.title = hint;
        label.setAttribute('aria-label', `${key}: ${hint}`);
      }
      const value = document.createElement('span');
      value.className = 'hud-value';
      value.textContent = '—';
      row.append(label, value);
      this.root.appendChild(row);
      this.rows.set(key, value);
    }
  }

  update(stats: WorldStats, fps: number, now: number): void {
    if (now - this.lastUpdate < UPDATE_INTERVAL_MS) return;
    this.lastUpdate = now;

    this.set('nüfus', String(stats.population));
    this.set('yiyecek', String(stats.foodCount));
    this.set('nesil', `${stats.maxGeneration} (ort ${stats.avgGeneration.toFixed(1)})`);
    this.set('yem/ömür', stats.avgFoodPerLife.toFixed(1));
    this.set('duyu-sürücülü', `%${(stats.senseDrivenRatio * 100).toFixed(0)}`);
    this.set('avcı', `%${(stats.predatorRatio * 100).toFixed(0)}`);
    this.set('ısı uyumu', stats.thermalAdaptation.toFixed(2));
    this.set('mutasyon', stats.avgMutationRate.toFixed(3));
    this.set('gökyüzü', `${skyLabel(stats.light)} · ${seasonLabel(stats.season)}`);
    this.set('adım', stats.tick.toLocaleString('tr-TR'));
    this.set('FPS', fps.toFixed(0));
  }

  private set(key: string, value: string): void {
    const el = this.rows.get(key);
    if (el && el.textContent !== value) el.textContent = value;
  }
}

function skyLabel(light: number): string {
  if (light > 0.75) return 'gündüz';
  if (light > 0.45) return 'alacakaranlık';
  return 'gece';
}

function seasonLabel(season: number): string {
  const pct = Math.round((season - 1) * 100);
  if (pct > 8) return `bolluk +${pct}%`;
  if (pct < -8) return `kıtlık ${pct}%`;
  return 'dengeli';
}
