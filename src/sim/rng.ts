/**
 * Deterministik rastgele sayı üreteci (mulberry32).
 *
 * Math.random() bilerek kullanılmıyor: aynı tohum aynı evrimi üretmeli. Aksi
 * halde ilginç bir sonuç gördüğümüzde "bu strateji gerçekten mi ortaya çıktı,
 * yoksa şans mıydı" sorusunu cevaplayamayız — deneyi tekrar edemeyiz.
 */
export class Rng {
  private state: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** [0, 1) aralığında düzgün dağılım. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) aralığında düzgün dağılım. */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** [0, maxExclusive) aralığında tam sayı. */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  /**
   * Ortalama 0, standart sapma 1 normal dağılım (Box-Muller).
   * Yöntem çift üretir; ikincisi bir sonraki çağrı için saklanır.
   */
  gauss(): number {
    if (this.spare !== null) {
      const value = this.spare;
      this.spare = null;
      return value;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const scale = Math.sqrt((-2 * Math.log(s)) / s);
    this.spare = v * scale;
    return u * scale;
  }

  /** Üretecin o anki durumu — senaryo kaydetmek için (Faz 5). */
  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
    this.spare = null;
  }
}
