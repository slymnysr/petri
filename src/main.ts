import './style.css';
import { Camera } from './render/camera';
import { Renderer } from './render/gl';
import { Controls } from './ui/controls';
import { Hud } from './ui/hud';
import { Inspector } from './ui/inspector';
import { Compare } from './ui/compare';
import { ExperimentPanel } from './ui/experiment-panel';
import { Findings } from './ui/findings';
import { Onboarding } from './ui/onboarding';
import { ScenarioPanel } from './ui/scenarios';
import { DEFAULT_CONFIG } from './sim/types';
import { World } from './sim/world';

const canvas = document.getElementById('view') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#view canvas bulunamadı');

const world = new World();
// +1: seçim halkası da bir instance olarak çiziliyor.
const renderer = new Renderer(
  canvas,
  world.config.maxOrganisms + world.config.maxFood + 1,
  world.config.worldRadius,
  world.config.verticalSquash,
);
const camera = new Camera(canvas);

// Paneller canvas'ın konteynerine bağlanır, body'ye değil. Tam ekran kullanımda
// bu zaten body demek; sayfa içine gömüldüğünde (Artifact) paneller canvas'ın
// dışına taşmak yerine onunla birlikte konumlanır.
const shell = canvas.parentElement ?? document.body;
const hud = new Hud(shell);
const inspector = new Inspector(shell);
const controls = new Controls(world, shell);
const onboarding = new Onboarding(shell);
const scenarios = new ScenarioPanel(shell);
const findings = new Findings(shell);
const experiment = new ExperimentPanel(shell);
const compare = new Compare(shell);

/** Karşılaştırma modunun ikinci dünyası; kapalıyken null. */
let worldB: World | null = null;

function rebuildCompare(): void {
  if (compare.active) {
    // İki dünya da aynı taze tohumla başlar; yalnızca seçilen tek parametre
    // farklı olur. Böylece ıraksama tamamen o farktan kaynaklanır.
    const seed = (Math.random() * 0x7fffffff) | 0;
    world.reseed(seed);
    controls.history.clear();
    select(-1);
    const diff = compare.currentDiff();
    worldB = new World({ ...world.config, ...diff.config, seed });
  } else {
    worldB = null;
  }
  camera.frame(world.config.worldRadius);
}
compare.onChange = rebuildCompare;

renderer.resize();
camera.frame(world.config.worldRadius);
camera.attach();

window.addEventListener('resize', () => renderer.resize());

function select(id: number): void {
  world.watchedId = id;
  renderer.highlightId = id;
  // Yeni bir organizma seçilince önceki ablasyon sıfırlanır: maske bir bireye
  // özgü, başka canlıya taşınması anlamsız olurdu.
  world.clearAblation();
  if (id < 0) inspector.hide();
}

/**
 * 3B seçim: her canlıyı ekrana izdüşürüp tıklamaya en yakın olanı buluyoruz.
 * Işın-küre kesişimi daha "doğru" olurdu ama kullanıcı ekranda gördüğü noktaya
 * tıklıyor; izdüşüm testi tam olarak o beklentiyi karşılıyor. Üst üste binen
 * organizmalarda kameraya en yakın olan kazanır.
 */
function pickOrganism(cssX: number, cssY: number): number {
  const dpr = canvas!.width / Math.max(1, canvas!.clientWidth);
  const px = cssX * dpr;
  const py = cssY * dpr;
  const tolerance = 26 * dpr;

  const pool = world.pool;
  let best = -1;
  let bestDepth = Infinity;

  for (let i = 0; i < pool.capacity; i++) {
    if (pool.alive[i] === 0) continue;
    const p = camera.project(pool.x[i]!, pool.y[i]!, pool.z[i]!, canvas!.width, canvas!.height);
    if (!p) continue;
    if (Math.hypot(p.sx - px, p.sy - py) > tolerance) continue;
    if (p.depth < bestDepth) {
      bestDepth = p.depth;
      best = i;
    }
  }
  return best;
}

camera.onClick = (cssX, cssY) => {
  // Karşılaştırma modunda seçim kapalı: ekran ikiye bölündüğü için tıklama
  // izdüşümü belirsizleşir ve bu mod incelemek değil, ıraksamayı izlemek için.
  if (compare.active) return;
  const index = pickOrganism(cssX, cssY);
  select(index >= 0 ? world.pool.id[index]! : -1);
};

inspector.onClose = () => select(-1);

inspector.onToggleNeuron = (neuron) => {
  if (world.watchedId >= 0) world.toggleNeuron(world.watchedId, neuron);
};

inspector.onReward = () => {
  if (world.watchedId >= 0) world.reward(world.watchedId);
};
inspector.onCull = () => {
  if (world.watchedId >= 0) {
    world.cull(world.watchedId);
    select(-1); // ayıklanan canlı artık yok; seçimi bırak
  }
};

controls.onReset = () => {
  world.reseed((Math.random() * 0x7fffffff) | 0);
  controls.history.clear();
  controls.syncSliders();
  select(-1);
  camera.frame(world.config.worldRadius);
};

scenarios.onLoad = (scenario) => {
  // Önce tüm alanları varsayılana döndürüp senaryonun kısmi config'ini
  // bindiriyoruz: aksi halde bir önceki senaryonun ayarları (örneğin kapalı
  // mutasyon) sızıp senaryoyu bozardı.
  Object.assign(world.config, DEFAULT_CONFIG, scenario.config);
  world.reseed(world.config.seed);
  controls.history.clear();
  controls.syncSliders();
  select(-1);
  camera.frame(world.config.worldRadius);
};

/** Zaman serisi örnekleme aralığı (simülasyon adımı). */
const SAMPLE_INTERVAL = 40;
let lastSampleTick = 0;

// FPS: tek karelik ölçüm çok gürültülü, üstel yumuşatma kullanıyoruz.
let fps = 60;
let lastTime = performance.now();

function frame(now: number): void {
  const dt = now - lastTime;
  lastTime = now;
  if (dt > 0) fps += (1000 / dt - fps) * 0.1;

  if (!controls.paused) {
    for (let i = 0; i < controls.stepsPerFrame; i++) {
      world.step();
      if (compare.active && worldB) worldB.step();
    }
  }

  const stats = world.getStats();
  if (stats.tick - lastSampleTick >= SAMPLE_INTERVAL) {
    lastSampleTick = stats.tick;
    controls.history.push(stats);
  }

  if (compare.active && worldB) {
    // İki dünya yan yana: sol yarı temel, sağ yarı farklı parametre. Kamera
    // ortak (aynı açı) ama en-boy oranı yarım genişliğe göre.
    const halfW = Math.floor(renderer.width / 2);
    camera.update(halfW / Math.max(1, renderer.height));
    renderer.draw(world, camera, [0, 0, halfW, renderer.height]);
    renderer.draw(worldB, camera, [halfW, 0, renderer.width - halfW, renderer.height]);
    compare.updateLabels(world.pool.count, worldB.pool.count);
  } else {
    camera.update(renderer.aspect);
    renderer.draw(world, camera);
  }
  hud.update(stats, fps, now);
  inspector.update(world, now);
  controls.draw(now);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === '+' || e.key === '=') controls.setSpeed(Math.min(64, controls.stepsPerFrame * 2));
  else if (e.key === '-') controls.setSpeed(Math.max(1, Math.floor(controls.stepsPerFrame / 2)));
  else if (e.key === 'f') {
    camera.frame(world.config.worldRadius);
  } else if (e.key === 'Escape') select(-1);
});

Object.assign(globalThis, { world, camera, renderer, inspector, controls, onboarding, scenarios, findings, experiment, compare, getWorldB: () => worldB });
