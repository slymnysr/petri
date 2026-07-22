import {
  ACTION_NAMES,
  BRAIN_HIDDEN,
  BRAIN_INPUTS,
  BRAIN_OUTPUTS,
  SENSE_NAMES,
  W_HO_OFFSET,
  W_IH_OFFSET,
} from '../sim/types';

/**
 * Beynin canlı SVG görüntüsü: 9 duyu → 8 gizli → 4 eylem.
 *
 * SVG düğümleri bir kez kurulur, her güncellemede yalnızca renk/opaklık
 * özellikleri yazılır. Her karede DOM yeniden inşa etmek 104 bağlantıda
 * fark edilir şekilde yavaştı.
 *
 * Zayıf bağlantılar (|ağırlık| < WEIGHT_THRESHOLD) hiç çizilmez: hepsini
 * göstermek okunamaz bir spagetti üretiyor ve asıl sinyali gizliyordu.
 */

const NS = 'http://www.w3.org/2000/svg';
const WIDTH = 306;
// Girdi sayısı 13'e çıkınca 210px'de nöronlar 16px aralığa sıkışıyor ve
// etiketler üst üste biniyordu; yükseklik duyu sayısına göre büyütüldü.
const HEIGHT = 258;
const PAD_TOP = 10;
const COL_IN = 104;
const COL_HID = 192;
const COL_OUT = 262;
const R_NEURON = 5.5;
const WEIGHT_THRESHOLD = 0.35;

export class BrainView {
  readonly root: SVGSVGElement;
  private readonly inputNodes: SVGCircleElement[] = [];
  private readonly hiddenNodes: SVGCircleElement[] = [];
  private readonly outputNodes: SVGCircleElement[] = [];
  private readonly ihLines: (SVGLineElement | null)[] = [];
  private readonly hoLines: (SVGLineElement | null)[] = [];

  constructor() {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
    svg.setAttribute('class', 'brain-svg');
    this.root = svg;

    // Bağlantılar önce: nöronların altında kalsınlar.
    const linkLayer = document.createElementNS(NS, 'g');
    svg.appendChild(linkLayer);
    const nodeLayer = document.createElementNS(NS, 'g');
    svg.appendChild(nodeLayer);

    for (let h = 0; h < BRAIN_HIDDEN; h++) {
      for (let i = 0; i < BRAIN_INPUTS; i++) {
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', String(COL_IN));
        line.setAttribute('y1', String(yFor(i, BRAIN_INPUTS)));
        line.setAttribute('x2', String(COL_HID));
        line.setAttribute('y2', String(yFor(h, BRAIN_HIDDEN)));
        linkLayer.appendChild(line);
        this.ihLines.push(line);
      }
    }
    for (let o = 0; o < BRAIN_OUTPUTS; o++) {
      for (let h = 0; h < BRAIN_HIDDEN; h++) {
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', String(COL_HID));
        line.setAttribute('y1', String(yFor(h, BRAIN_HIDDEN)));
        line.setAttribute('x2', String(COL_OUT));
        line.setAttribute('y2', String(yFor(o, BRAIN_OUTPUTS)));
        linkLayer.appendChild(line);
        this.hoLines.push(line);
      }
    }

    for (let i = 0; i < BRAIN_INPUTS; i++) {
      this.inputNodes.push(addNode(nodeLayer, COL_IN, yFor(i, BRAIN_INPUTS)));
      addLabel(nodeLayer, COL_IN - R_NEURON - 5, yFor(i, BRAIN_INPUTS), SENSE_NAMES[i]!, 'end');
    }
    for (let h = 0; h < BRAIN_HIDDEN; h++) {
      this.hiddenNodes.push(addNode(nodeLayer, COL_HID, yFor(h, BRAIN_HIDDEN)));
    }
    for (let o = 0; o < BRAIN_OUTPUTS; o++) {
      this.outputNodes.push(addNode(nodeLayer, COL_OUT, yFor(o, BRAIN_OUTPUTS)));
      addLabel(nodeLayer, COL_OUT + R_NEURON + 5, yFor(o, BRAIN_OUTPUTS), ACTION_NAMES[o]!, 'start');
    }
  }

  update(
    genome: Float32Array,
    offset: number,
    inputs: Float32Array,
    hidden: Float32Array,
    outputs: Float32Array,
  ): void {
    for (let i = 0; i < BRAIN_INPUTS; i++) paintNode(this.inputNodes[i]!, inputs[i]!);
    for (let h = 0; h < BRAIN_HIDDEN; h++) paintNode(this.hiddenNodes[h]!, hidden[h]!);
    for (let o = 0; o < BRAIN_OUTPUTS; o++) paintNode(this.outputNodes[o]!, outputs[o]!);

    let k = 0;
    for (let h = 0; h < BRAIN_HIDDEN; h++) {
      for (let i = 0; i < BRAIN_INPUTS; i++) {
        // Sinyal = ağırlık × o duyunun anlık değeri. Ağırlık büyük olsa bile
        // girdi sıfırsa o bağlantı şu an karara katkı vermiyor demektir.
        paintLink(this.ihLines[k++]!, genome[offset + W_IH_OFFSET + h * BRAIN_INPUTS + i]!, inputs[i]!);
      }
    }
    k = 0;
    for (let o = 0; o < BRAIN_OUTPUTS; o++) {
      for (let h = 0; h < BRAIN_HIDDEN; h++) {
        paintLink(this.hoLines[k++]!, genome[offset + W_HO_OFFSET + o * BRAIN_HIDDEN + h]!, hidden[h]!);
      }
    }
  }
}

function yFor(index: number, count: number): number {
  const usable = HEIGHT - PAD_TOP * 2;
  return PAD_TOP + (usable * (index + 0.5)) / count;
}

function addNode(parent: SVGGElement, x: number, y: number): SVGCircleElement {
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('cx', String(x));
  c.setAttribute('cy', String(y));
  c.setAttribute('r', String(R_NEURON));
  c.setAttribute('class', 'brain-node');
  parent.appendChild(c);
  return c;
}

function addLabel(
  parent: SVGGElement,
  x: number,
  y: number,
  text: string,
  anchor: 'start' | 'end',
): void {
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', String(x));
  t.setAttribute('y', String(y + 3));
  t.setAttribute('text-anchor', anchor);
  t.setAttribute('class', 'brain-label');
  t.textContent = text;
  parent.appendChild(t);
}

/** Aktivasyon: pozitif sıcak (amber), negatif soğuk (mavi). */
function paintNode(node: SVGCircleElement, value: number): void {
  const v = Math.max(-1, Math.min(1, value));
  const magnitude = Math.abs(v);
  const color = v >= 0 ? '245, 158, 11' : '59, 130, 246';
  node.setAttribute('fill', `rgba(${color}, ${(0.12 + magnitude * 0.88).toFixed(3)})`);
}

function paintLink(line: SVGLineElement, weight: number, sourceValue: number): void {
  const signal = weight * sourceValue;
  const magnitude = Math.abs(signal);
  if (Math.abs(weight) < WEIGHT_THRESHOLD || magnitude < 0.02) {
    line.setAttribute('stroke-opacity', '0');
    return;
  }
  const color = signal >= 0 ? '74, 222, 128' : '248, 113, 113';
  line.setAttribute('stroke', `rgb(${color})`);
  line.setAttribute('stroke-opacity', String(Math.min(0.85, 0.1 + magnitude * 0.6)));
  line.setAttribute('stroke-width', String(Math.min(2.4, 0.4 + magnitude * 1.4)));
}
