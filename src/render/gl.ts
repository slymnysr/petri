import type { World } from '../sim/world';
import type { Camera } from './camera';

/**
 * WebGL2 instanced 3B renderer.
 *
 * Organizmalar gerçek küre geometrisiyle değil, kameraya dönük dörtgenlerle
 * (billboard) çiziliyor; küresellik fragment shader'da normal hesaplanarak
 * elde ediliyor. Binlerce ajanda gerçek küre ağı yüz binlerce üçgen demekti,
 * impostor yöntemiyle nesne başına iki üçgen yetiyor ve tüm popülasyon tek
 * draw call'da çiziliyor.
 *
 * Instance başına 6 float: [x, y, z, yarıçap, renk tonu, parlaklık].
 */

const FLOATS_PER_INSTANCE = 6;

const SPRITE_VERT = `#version 300 es
in vec2 aCorner;
in vec3 aPos;
in float aRadius;
in float aHue;
in float aBright;

uniform mat4 uViewProj;
uniform vec3 uEye;

out vec2 vCorner;
out vec3 vColor;
out float vDist;

vec3 hsl2rgb(float h, float s, float l) {
  vec3 k = mod(vec3(0.0, 8.0, 4.0) + h * 12.0, 12.0);
  float a = s * min(l, 1.0 - l);
  return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
}

void main() {
  vec3 toEye = normalize(uEye - aPos);
  // Dünyanın "yukarı"sı z ekseni. Bakış tam dikey olduğunda cross tekilleşir,
  // bu yüzden yedek bir eksene düşüyoruz.
  vec3 upRef = abs(toEye.z) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec3 right = normalize(cross(upRef, toEye));
  vec3 up = cross(toEye, right);

  vec3 world = aPos + (right * aCorner.x + up * aCorner.y) * aRadius;
  gl_Position = uViewProj * vec4(world, 1.0);

  vCorner = aCorner;
  vColor = hsl2rgb(aHue, 0.62, aBright);
  vDist = distance(uEye, aPos);
}`;

const SPRITE_FRAG = `#version 300 es
precision highp float;

in vec2 vCorner;
in vec3 vColor;
in float vDist;

uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uFogColor;

out vec4 outColor;

void main() {
  float d2 = dot(vCorner, vCorner);
  if (d2 > 1.0) discard;

  // Dörtgeni küreye çeviren kısım: yüzey normalini diskin yarıçapından üret.
  float nz = sqrt(1.0 - d2);
  vec3 normal = vec3(vCorner, nz);

  vec3 lightDir = normalize(vec3(0.35, 0.25, 0.90));
  float diffuse = max(dot(normal, lightDir), 0.0);
  vec3 color = vColor * (0.34 + diffuse * 0.78);

  // Kenar ışığı: küreselliği okunur kılar, düz disk gibi görünmesini engeller.
  color += pow(1.0 - nz, 2.5) * 0.22;

  float fog = clamp((vDist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  color = mix(color, uFogColor, fog * 0.88);

  outColor = vec4(color, 1.0);
}`;

const LINE_VERT = `#version 300 es
in vec3 aPos;
uniform mat4 uViewProj;
uniform vec3 uEye;
out float vDist;
void main() {
  gl_Position = uViewProj * vec4(aPos, 1.0);
  vDist = distance(uEye, aPos);
}`;

const LINE_FRAG = `#version 300 es
precision highp float;
in float vDist;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uLineColor;
out vec4 outColor;
void main() {
  float fog = clamp((vDist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  outColor = vec4(uLineColor, 0.55 * (1.0 - fog * 0.8));
}`;

export class Renderer {
  private readonly gl: WebGL2RenderingContext;

  private readonly spriteProgram: WebGLProgram;
  private readonly spriteVao: WebGLVertexArrayObject;
  private readonly instanceBuffer: WebGLBuffer;
  private readonly data: Float32Array;

  private readonly lineProgram: WebGLProgram;
  private readonly lineVao: WebGLVertexArrayObject;
  private readonly lineVertexCount: number;

  private readonly uSprite: Record<string, WebGLUniformLocation>;
  private readonly uLine: Record<string, WebGLUniformLocation>;

  /** Son karede çizilen instance sayısı — istatistik için. */
  drawn = 0;

  /**
   * WebGL bağlamı düşmüş mü. Ağır yük altında gerçekten yaşandı
   * (CONTEXT_LOST_WEBGL); sekme arka plana alındığında veya sürücü
   * sıfırlandığında da olur. Bayrak olmadan her kare sessizce siyah ekrana
   * çiziliyor ve hata anlaşılmıyordu.
   */
  contextLost = false;

  /** Seçili organizmanın kimliği; -1 ise vurgu yok. */
  highlightId = -1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    maxInstances: number,
    worldRadius: number,
    verticalSquash: number,
  ) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      depth: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 desteklenmiyor — bu tarayıcıda Petri çalışamaz.');
    this.gl = gl;

    // ---- Organizma/yiyecek impostor'ları ----
    this.spriteProgram = linkProgram(gl, SPRITE_VERT, SPRITE_FRAG);
    this.data = new Float32Array(maxInstances * FLOATS_PER_INSTANCE);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('VAO oluşturulamadı');
    this.spriteVao = vao;
    gl.bindVertexArray(vao);

    const corners = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    const aCorner = gl.getAttribLocation(this.spriteProgram, 'aCorner');
    gl.enableVertexAttribArray(aCorner);
    gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);

    const instanceBuffer = gl.createBuffer();
    if (!instanceBuffer) throw new Error('Instance buffer oluşturulamadı');
    this.instanceBuffer = instanceBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);

    const stride = FLOATS_PER_INSTANCE * 4;
    bindInstanceAttrib(gl, this.spriteProgram, 'aPos', 3, stride, 0);
    bindInstanceAttrib(gl, this.spriteProgram, 'aRadius', 1, stride, 12);
    bindInstanceAttrib(gl, this.spriteProgram, 'aHue', 1, stride, 16);
    bindInstanceAttrib(gl, this.spriteProgram, 'aBright', 1, stride, 20);
    gl.bindVertexArray(null);

    this.uSprite = uniforms(gl, this.spriteProgram, [
      'uViewProj', 'uEye', 'uFogNear', 'uFogFar', 'uFogColor',
    ]);

    // ---- Dünya sınır kafesi ----
    // Hacmin nerede bittiğini göstermek 3B'de şart: sınır çizgisi olmadan
    // derinlik algısı kayboluyor ve organizmalar boşlukta yüzüyormuş gibi
    // görünüyor.
    this.lineProgram = linkProgram(gl, LINE_VERT, LINE_FRAG);
    const box = ellipsoidWireframe(worldRadius, verticalSquash);
    this.lineVertexCount = box.length / 3;

    const lineVao = gl.createVertexArray();
    if (!lineVao) throw new Error('Line VAO oluşturulamadı');
    this.lineVao = lineVao;
    gl.bindVertexArray(lineVao);
    const lineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, box, gl.STATIC_DRAW);
    const aLinePos = gl.getAttribLocation(this.lineProgram, 'aPos');
    gl.enableVertexAttribArray(aLinePos);
    gl.vertexAttribPointer(aLinePos, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.uLine = uniforms(gl, this.lineProgram, [
      'uViewProj', 'uEye', 'uFogNear', 'uFogFar', 'uLineColor',
    ]);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      console.warn('Petri: WebGL bağlamı kayboldu, çizim durduruldu.');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      console.warn('Petri: WebGL bağlamı geri geldi — devam için sayfayı yenileyin.');
    });
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  get aspect(): number {
    return this.canvas.width / Math.max(1, this.canvas.height);
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  /**
   * Bir dünyayı çizer. `viewport` verilirse yalnızca o ekran bölgesine çizer
   * (iki-dünya karşılaştırma modu için); makas testiyle temizleme de o bölgeyle
   * sınırlı kalır, böylece iki dünya birbirinin karesini silmez.
   */
  draw(
    world: World,
    camera: Camera,
    viewport: readonly [number, number, number, number] | null = null,
  ): void {
    if (this.contextLost) return;
    const gl = this.gl;
    const data = this.data;
    const capacity = data.length / FLOATS_PER_INSTANCE;

    let n = 0;

    const food = world.food;
    for (let i = 0; i < food.capacity && n < capacity; i++) {
      if (food.alive[i] === 0) continue;
      const o = n * FLOATS_PER_INSTANCE;
      data[o] = food.x[i]!;
      data[o + 1] = food.y[i]!;
      data[o + 2] = food.z[i]!;
      // Yiyecek bilerek küçük ve sönük: binlerce tane var ve asıl özne
      // organizmalar. Eşit ağırlıkta çizildiğinde yeşil noktalar sahneyi
      // boğup canlıları görünmez kılıyordu.
      data[o + 3] = 2.3;
      data[o + 4] = 0.32; // yeşil: simülasyonun içindeki madde
      data[o + 5] = 0.26;
      n++;
    }

    const pool = world.pool;
    const threshold = world.config.reproduceThreshold;

    if (this.highlightId >= 0 && n < capacity) {
      const sel = world.indexOfId(this.highlightId);
      if (sel >= 0) {
        const o = n * FLOATS_PER_INSTANCE;
        data[o] = pool.x[sel]!;
        data[o + 1] = pool.y[sel]!;
        data[o + 2] = pool.z[sel]!;
        data[o + 3] = pool.phenoSize[sel]! * 2.4 + 5;
        data[o + 4] = 0.55;
        data[o + 5] = 0.72;
        n++;
      }
    }

    for (let i = 0; i < pool.capacity && n < capacity; i++) {
      if (pool.alive[i] === 0) continue;
      const o = n * FLOATS_PER_INSTANCE;
      data[o] = pool.x[i]!;
      data[o + 1] = pool.y[i]!;
      data[o + 2] = pool.z[i]!;
      data[o + 3] = pool.phenoSize[i]!;
      data[o + 4] = pool.phenoHue[i]!;
      // Parlaklık enerjiyi gösterir: açlıktan ölmek üzere olan sönük görünür.
      const e = pool.energy[i]! / threshold;
      data[o + 5] = 0.30 + (e > 1 ? 1 : e < 0 ? 0 : e) * 0.40;
      n++;
    }

    this.drawn = n;

    const vx = viewport ? viewport[0] : 0;
    const vy = viewport ? viewport[1] : 0;
    const vw = viewport ? viewport[2] : this.canvas.width;
    const vh = viewport ? viewport[3] : this.canvas.height;
    gl.viewport(vx, vy, vw, vh);
    gl.clearColor(0.031, 0.043, 0.071, 1);
    if (viewport) {
      // Yalnızca bu bölgeyi temizle; komşu dünyanın çizimi korunsun.
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(vx, vy, vw, vh);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.SCISSOR_TEST);
    } else {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    const fogNear = camera.distance * 0.35;
    const fogFar = camera.distance * 2.1;

    // Sınır kafesi önce: derinlik tamponu organizmaları üstüne yazsın.
    gl.useProgram(this.lineProgram);
    gl.bindVertexArray(this.lineVao);
    gl.uniformMatrix4fv(this.uLine['uViewProj']!, false, camera.viewProj);
    gl.uniform3f(this.uLine['uEye']!, camera.eyeX, camera.eyeY, camera.eyeZ);
    gl.uniform1f(this.uLine['uFogNear']!, fogNear);
    gl.uniform1f(this.uLine['uFogFar']!, fogFar);
    gl.uniform3f(this.uLine['uLineColor']!, 0.22, 0.30, 0.42);
    gl.drawArrays(gl.LINES, 0, this.lineVertexCount);

    if (n === 0) {
      gl.bindVertexArray(null);
      return;
    }

    gl.useProgram(this.spriteProgram);
    gl.bindVertexArray(this.spriteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * FLOATS_PER_INSTANCE);

    gl.uniformMatrix4fv(this.uSprite['uViewProj']!, false, camera.viewProj);
    gl.uniform3f(this.uSprite['uEye']!, camera.eyeX, camera.eyeY, camera.eyeZ);
    gl.uniform1f(this.uSprite['uFogNear']!, fogNear);
    gl.uniform1f(this.uSprite['uFogFar']!, fogFar);
    gl.uniform3f(this.uSprite['uFogColor']!, 0.031, 0.043, 0.071);

    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.bindVertexArray(null);
  }
}

/**
 * Elipsoidin tel kafesi: enlem çemberleri ve boylam yarım-elipsleri.
 *
 * Kutu kafesin yerini aldı. Kutu, bir simülasyonun sınırından çok "bir kutu"
 * gibi duruyordu; enlem/boylam ağı hem kapalı bir dünya izlenimi veriyor hem
 * de dönerken derinlik algısını taşıyor — dönme sırasında çemberlerin
 * birbirine göre kayması hacmi okunur kılıyor.
 */
function ellipsoidWireframe(
  radius: number,
  squash: number,
  latitudeBands = 5,
  longitudeBands = 6,
  segments = 64,
): Float32Array {
  const out: number[] = [];
  const vertical = radius * squash;

  // Enlem çemberleri: sabit z'de xy dairesi. Kutuplara çok yaklaşan çemberler
  // noktaya dönüşüp gürültü yaptığı için uçlar dışarıda bırakılıyor.
  for (let b = 1; b <= latitudeBands; b++) {
    const t = b / (latitudeBands + 1); // 0..1 (uçlar hariç)
    const phi = (t - 0.5) * Math.PI; // -π/2..π/2
    const z = Math.sin(phi) * vertical;
    const ringRadius = Math.cos(phi) * radius;
    for (let s = 0; s < segments; s++) {
      const a0 = (s / segments) * Math.PI * 2;
      const a1 = ((s + 1) / segments) * Math.PI * 2;
      out.push(
        Math.cos(a0) * ringRadius, Math.sin(a0) * ringRadius, z,
        Math.cos(a1) * ringRadius, Math.sin(a1) * ringRadius, z,
      );
    }
  }

  // Boylam elipsleri: kutuptan kutba, sabit yaw düzleminde.
  for (let b = 0; b < longitudeBands; b++) {
    const yaw = (b / longitudeBands) * Math.PI; // yarım tur yeter, elips simetrik
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    for (let s = 0; s < segments; s++) {
      const p0 = (s / segments) * Math.PI * 2;
      const p1 = ((s + 1) / segments) * Math.PI * 2;
      out.push(
        Math.cos(p0) * radius * cy, Math.cos(p0) * radius * sy, Math.sin(p0) * vertical,
        Math.cos(p1) * radius * cy, Math.cos(p1) * radius * sy, Math.sin(p1) * vertical,
      );
    }
  }

  return new Float32Array(out);
}

function uniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: string[],
): Record<string, WebGLUniformLocation> {
  const map: Record<string, WebGLUniformLocation> = {};
  for (const name of names) {
    const loc = gl.getUniformLocation(program, name);
    if (!loc) throw new Error(`Uniform bulunamadı: ${name}`);
    map[name] = loc;
  }
  return map;
}

function bindInstanceAttrib(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  size: number,
  stride: number,
  offset: number,
): void {
  const loc = gl.getAttribLocation(program, name);
  if (loc < 0) throw new Error(`Attribute bulunamadı: ${name}`);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
  gl.vertexAttribDivisor(loc, 1);
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Shader oluşturulamadı');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader derlenemedi: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Program oluşturulamadı');
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program bağlanamadı: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}
