import { describeNeurons, explainAction, senseInfluence, type NeuronRole } from '../sim/brain';
import { probeOrganism, type ProbeResult } from '../sim/probe';
import {
  ACTION_NAMES,
  Action,
  BRAIN_HIDDEN,
  BRAIN_INPUTS,
  SENSE_NAMES,
  TRAIT_NAMES,
  TRAIT_RANGES,
  TRAIT_OFFSET,
  TRAIT_COUNT,
} from '../sim/types';
import type { World } from '../sim/world';
import { BrainView } from './brain-view';

/**
 * Seçili organizmanın inceleme paneli — projenin asıl iddiasının arayüzü.
 *
 * Buradaki her şey tek bir soruya hizmet eder: "bu canlı şu an neden bunu
 * yapıyor?" Beyin diyagramı ham durumu, karar satırı yorumu, fenotip tablosu
 * bedeni, soy zinciri ise geçmişi gösterir.
 */

const UPDATE_INTERVAL_MS = 100;

export class Inspector {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly vitals: HTMLElement;
  private readonly brain: BrainView;
  private readonly decision: HTMLElement;
  private readonly neurons: HTMLElement;
  private readonly probe: HTMLElement;
  private readonly traits: HTMLElement;
  /** Sonda hesabı pahalı; seçim başına bir kez yapılır ve önbelleğe alınır. */
  private probedId = -1;
  private probeResults: ProbeResult[] = [];
  private readonly lineageEl: HTMLElement;
  private readonly influence = new Float32Array(BRAIN_INPUTS);
  /** Nöron rolleri her güncellemede yeniden hesaplanır; dizi tekrar kullanılır. */
  private readonly neuronRoles: NeuronRole[] = Array.from({ length: BRAIN_HIDDEN }, () => ({
    neuron: 0,
    senseIndex: 0,
    weight: 0,
    saturated: false,
  }));
  private lastUpdate = 0;

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('aside');
    this.root.className = 'inspector hidden';

    this.title = section(this.root, 'inspector-title');
    this.vitals = section(this.root, 'inspector-vitals');

    // Yapay seçilim: kullanıcı seçici olur. Ödüllendir → soyunu üret, ayıkla →
    // kaldır. Köpek ırkları gibi; bir özelliği tutarlı ödüllendirmek popülasyonu
    // o yöne kaydırır.
    const selectRow = document.createElement('div');
    selectRow.className = 'select-actions';
    const reward = document.createElement('button');
    reward.className = 'select-btn select-reward';
    reward.textContent = '★ ödüllendir';
    reward.title = 'Bu canlının soyunu üret (yapay seçilim)';
    reward.addEventListener('click', () => this.onReward?.());
    const cull = document.createElement('button');
    cull.className = 'select-btn select-cull';
    cull.textContent = '✗ ayıkla';
    cull.title = 'Bu canlıyı kaldır';
    cull.addEventListener('click', () => this.onCull?.());
    selectRow.append(reward, cull);
    this.root.appendChild(selectRow);

    heading(this.root, 'beyin');
    this.brain = new BrainView();
    this.root.appendChild(this.brain.root);

    heading(this.root, 'karar');
    this.decision = section(this.root, 'inspector-decision');

    heading(this.root, 'nöronlar — her biri neyi dinliyor');
    this.neurons = section(this.root, 'inspector-neurons');

    heading(this.root, 'sonda — beyinden ne okunabiliyor');
    this.probe = section(this.root, 'inspector-probe');

    heading(this.root, 'fenotip');
    this.traits = section(this.root, 'inspector-traits');

    heading(this.root, 'soy');
    this.lineageEl = section(this.root, 'inspector-lineage');

    const close = document.createElement('button');
    close.className = 'inspector-close';
    close.textContent = '×';
    close.title = 'seçimi bırak';
    close.addEventListener('click', () => this.onClose?.());
    this.root.appendChild(close);

    parent.appendChild(this.root);
  }

  onClose: (() => void) | null = null;
  /** Bir nöron satırına tıklanınca çağrılır (ablasyon aç/kapat). */
  onToggleNeuron: ((neuron: number) => void) | null = null;
  /** Yapay seçilim düğmeleri. */
  onReward: (() => void) | null = null;
  onCull: (() => void) | null = null;

  hide(): void {
    this.root.classList.add('hidden');
  }

  update(world: World, now: number): void {
    const id = world.watchedId;
    if (id < 0) {
      this.hide();
      return;
    }
    const index = world.indexOfId(id);
    if (index < 0) {
      // Organizma öldü: paneli kapatmak yerine bunu söylüyoruz, çünkü
      // "az önce baktığım canlı ne oldu" cevaplanması gereken bir soru.
      this.root.classList.remove('hidden');
      this.title.textContent = `#${id} öldü`;
      this.vitals.textContent = `yaşadığı süre kayıtta: ${describeDeath(world, id)}`;
      return;
    }
    if (now - this.lastUpdate < UPDATE_INTERVAL_MS) return;
    this.lastUpdate = now;

    this.root.classList.remove('hidden');
    const pool = world.pool;
    const offset = pool.genomeOffset(index);

    this.title.textContent = `#${id}`;
    this.vitals.textContent =
      `nesil ${pool.generation[index]} · yaş ${Math.round(pool.age[index]!)} · ` +
      `enerji ${pool.energy[index]!.toFixed(0)} · yediği ${pool.foodEaten[index]}`;

    this.brain.update(
      pool.genome,
      offset,
      world.watchedInputs,
      world.watchedHidden,
      world.watchedOutputs,
    );

    this.renderDecision(world, offset);
    this.renderNeurons(world, offset, id);
    this.renderProbe(world, offset, id);
    this.renderTraits(world, index);
    this.renderLineage(world, id);
  }

  /**
   * Her gizli nöronun hangi duyuya "kulak verdiğini" gösterir.
   *
   * Bu, projenin en derin yorumlanabilirlik iddiası: nöron aktivasyonunu tahmin
   * etmiyoruz, öğrenilmiş ağırlıkları okuyup her nöronun uzmanlaştığı duyuyu
   * çıkarıyoruz. Gösterdiği ders: beyin, bütün duyuları tek yere yığmamış —
   * farklı nöronlar farklı şeylere "kulak vermiş" (bir beyindeki 10 nöron ölçümde
   * ~7 ayrı duyuya uzmanlaşıyor). İş bölümü, kimse tasarlamadan evrimle çıkıyor.
   */
  private renderNeurons(world: World, offset: number, id: number): void {
    describeNeurons(world.pool.genome, offset, this.neuronRoles);
    this.neurons.innerHTML = '';

    const caption = document.createElement('div');
    caption.className = 'neuron-caption';
    caption.textContent = 'bir nörona tıkla → kapat → davranış nasıl değişiyor izle';
    this.neurons.appendChild(caption);

    const ablatedHere = world.ablatedId === id;

    for (const role of this.neuronRoles) {
      const h = role.neuron;
      const row = document.createElement('div');
      row.className = 'neuron-row clickable';
      const off = ablatedHere && world.ablationMask[h] === 0;
      if (off) row.classList.add('ablated');
      row.title = off ? 'kapalı — açmak için tıkla' : 'açık — kapatmak için tıkla';
      row.addEventListener('click', () => this.onToggleNeuron?.(h));

      const tag = document.createElement('span');
      tag.className = 'neuron-tag';
      tag.textContent = `N${h + 1}`;

      const desc = document.createElement('span');
      desc.className = 'neuron-desc';
      if (role.saturated) {
        // Doymuş nöron bir duyuya tepki vermiyor; sabit bir eğilim sağlıyor.
        desc.classList.add('muted');
        desc.textContent = 'hep açık — bir duyuya bağlı değil';
      } else {
        const arrow = document.createElement('span');
        arrow.className = role.weight >= 0 ? 'neuron-up' : 'neuron-down';
        arrow.textContent = role.weight >= 0 ? '▲' : '▼';
        desc.append(SENSE_NAMES[role.senseIndex]!, ' ', arrow);
      }

      row.append(tag, desc);
      this.neurons.appendChild(row);
    }
  }

  /**
   * Doğrusal sonda: her duyunun bu beynin gizli katmanından ne kadar
   * okunabildiğini (R²) çubuk olarak gösterir. Gerçek yorumlanabilirlikteki
   * "probing" yönteminin oyuncak ölçekli hali — "bu bilgi beyinde gerçekten
   * kodlu mu" sorusunu cevaplar. Seçim başına bir kez hesaplanır (pahalı).
   */
  private renderProbe(world: World, offset: number, id: number): void {
    if (id !== this.probedId) {
      // Sabit tohum: aynı beyin her seçimde aynı sonda sonucunu versin.
      this.probeResults = probeOrganism(world.pool.genome, offset, 12345);
      this.probedId = id;

      this.probe.innerHTML = '';
      const caption = document.createElement('div');
      caption.className = 'probe-caption';
      caption.textContent =
        'gizli katmandan her duyu ne kadar geri okunabiliyor — yüksekse beyin onu temsil ediyor';
      this.probe.appendChild(caption);

      for (const r of this.probeResults) {
        this.probe.appendChild(bar(r.senseName, r.r2, r.r2, true));
      }
    }
  }

  /**
   * En belirgin eylemi seçip nedenini cümleye çevirir. "En belirgin" = mutlak
   * değeri en büyük çıktı; hareketsiz duran bir canlıda bu "ye" veya "üre"
   * olabilir, o yüzden sabit bir eyleme bakmıyoruz.
   */
  private renderDecision(world: World, offset: number): void {
    const outputs = world.watchedOutputs;
    let action = 0;
    for (let o = 1; o < outputs.length; o++) {
      if (Math.abs(outputs[o]!) > Math.abs(outputs[action]!)) action = o;
    }

    const explanation = explainAction(
      world.pool.genome,
      offset,
      world.watchedInputs,
      world.watchedHidden,
      action,
    );
    senseInfluence(
      world.pool.genome,
      offset,
      world.watchedInputs,
      world.watchedHidden,
      action,
      this.influence,
    );

    const value = outputs[action]!;
    const verb = describeAction(action, value);
    const cause = SENSE_NAMES[explanation.senseIndex]!;
    const direction = explanation.senseContribution >= 0 ? 'iterek' : 'bastırarak';

    this.decision.innerHTML = '';
    const line = document.createElement('div');
    line.className = 'decision-line';
    line.textContent = `${verb} — başlıca sebep: ${cause} (${direction})`;
    this.decision.appendChild(line);

    // Tüm duyuların bu eyleme etkisi, büyükten küçüğe.
    const ranked = Array.from(this.influence, (v, i) => ({ v, i }))
      .filter((e) => Math.abs(e.v) > 0.001)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
      .slice(0, 4);
    const max = ranked.length > 0 ? Math.abs(ranked[0]!.v) : 1;

    for (const entry of ranked) {
      this.decision.appendChild(
        bar(SENSE_NAMES[entry.i]!, entry.v, Math.abs(entry.v) / max, entry.v >= 0),
      );
    }
    if (ranked.length === 0) {
      const none = document.createElement('div');
      none.className = 'decision-muted';
      none.textContent = 'hiçbir duyu şu an bu kararı sürmüyor (tüm girdiler sıfır)';
      this.decision.appendChild(none);
    }
  }

  private renderTraits(world: World, index: number): void {
    const base = world.pool.genomeOffset(index) + TRAIT_OFFSET;
    this.traits.innerHTML = '';
    for (let t = 0; t < TRAIT_COUNT; t++) {
      const gene = world.pool.genome[base + t]!;
      const [lo, hi] = TRAIT_RANGES[t]!;
      const actual = lo + gene * (hi - lo);
      this.traits.appendChild(bar(TRAIT_NAMES[t]!, actual, gene, true));
    }
  }

  private renderLineage(world: World, id: number): void {
    const self = world.lineage.get(id);
    const chain = world.lineage.ancestors(id, 6);
    this.lineageEl.innerHTML = '';

    const path = document.createElement('div');
    path.className = 'lineage-path';
    path.textContent = [`#${id}`, ...chain.map((a) => `#${a.id}`)].join(' ← ');
    this.lineageEl.appendChild(path);

    const note = document.createElement('div');
    note.className = 'decision-muted';
    if (self && self.parentId === 0) {
      note.textContent = 'kurucu nesil — atası yok';
    } else if (chain.length === 0) {
      note.textContent = 'atalar kayıttan düşmüş (kayıt sınırı aşıldı)';
    } else {
      note.textContent =
        `ebeveyninden genom farkı: ${self ? self.mutationDistance.toFixed(4) : '?'}`;
    }
    this.lineageEl.appendChild(note);
  }
}

function describeAction(action: number, value: number): string {
  const name = ACTION_NAMES[action]!;
  // Dönüş eylemleri işaretli: ham sayı yerine yönü söylemek okuyana daha
  // fazla şey anlatıyor.
  if (action === Action.Yaw) return value >= 0 ? 'sağa dönüyor' : 'sola dönüyor';
  if (action === Action.Pitch) return value >= 0 ? 'yukarı çıkıyor' : 'aşağı iniyor';
  if (value >= 0) return `${name} (${value.toFixed(2)})`;
  return `${name} istemiyor (${value.toFixed(2)})`;
}

function describeDeath(world: World, id: number): string {
  const entry = world.lineage.get(id);
  if (!entry) return 'kayıt dışı';
  if (entry.deathTick < 0) return 'kayıtta ölüm yok';
  return `${entry.deathTick - entry.birthTick} adım, ${entry.foodEaten} yiyecek`;
}

function bar(label: string, value: number, ratio: number, positive: boolean): HTMLElement {
  const row = document.createElement('div');
  row.className = 'bar-row';

  const name = document.createElement('span');
  name.className = 'bar-label';
  name.textContent = label;

  const track = document.createElement('span');
  track.className = 'bar-track';
  const fill = document.createElement('span');
  fill.className = positive ? 'bar-fill' : 'bar-fill negative';
  fill.style.width = `${Math.min(100, Math.abs(ratio) * 100).toFixed(1)}%`;
  track.appendChild(fill);

  const num = document.createElement('span');
  num.className = 'bar-value';
  num.textContent = value.toFixed(2);

  row.append(name, track, num);
  return row;
}

function section(parent: HTMLElement, className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  parent.appendChild(el);
  return el;
}

function heading(parent: HTMLElement, text: string): void {
  const h = document.createElement('div');
  h.className = 'inspector-heading';
  h.textContent = text;
  parent.appendChild(h);
}
