import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Vite çıktısını tek dosyalık, kendi kendine yeten bir HTML'e gömer.
 *
 * Artifact ortamı dış kaynak isteğine izin vermiyor (CDN, font, XHR — hepsi
 * CSP ile kapalı), bu yüzden JS ve CSS satır içine alınmalı. Ayrıca sayfa
 * `<!doctype>`/`<head>`/`<body>` iskeletiyle sarmalandığı için burada yalnızca
 * gövde içeriği üretiliyor.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'dist', 'assets');
const files = readdirSync(assetsDir);

const jsFile = files.find((f) => f.endsWith('.js'));
const cssFile = files.find((f) => f.endsWith('.css'));
if (!jsFile || !cssFile) throw new Error('dist/assets içinde js/css bulunamadı — önce `npm run build`');

const js = readFileSync(join(assetsDir, jsFile), 'utf8');
const css = readFileSync(join(assetsDir, cssFile), 'utf8');

// Satır içi script içinde geçen </script> dizisi HTML ayrıştırıcısını erken
// kapatır. Vite çıktısında beklenmiyor ama sessizce bozulmasındansa patlasın.
if (js.includes('</script')) throw new Error('JS içinde </script> var — satır içine alınamaz');

const html = `<title>Petri — Yapay Yaşam Laboratuvarı</title>

<style>
${css}

/* --- Artifact yerleşimi ---
   Uygulama normalde tam ekran çalışıyor ve panelleri viewport'a sabitliyor.
   Burada sayfanın içinde bir bölüm olarak duruyor, bu yüzden paneller
   canvas kabuğuna göre konumlanmalı. */
html, body {
  height: auto;
  overflow: visible;
}

body {
  background: var(--bg);
  padding: 0 0 32px;
}

.petri-intro {
  max-width: 68ch;
  padding: 28px 24px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.petri-intro h1 {
  margin: 0;
  font-size: clamp(24px, 4vw, 34px);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
  text-wrap: balance;
}

.petri-intro .lede {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--muted);
}

.petri-intro .lede strong {
  color: var(--accent);
  font-weight: 600;
}

.petri-keys {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 12px;
  color: var(--muted);
}

.petri-keys kbd {
  display: inline-block;
  padding: 1px 6px;
  margin-right: 4px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 4px;
  font: inherit;
  font-size: 11px;
  color: var(--text);
}

.petri-shell {
  position: relative;
  height: min(78vh, 760px);
  margin: 0 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg);
}

/* Paneller viewport'a değil, kabuğa göre konumlanır. */
.petri-shell .hud,
.petri-shell .inspector,
.petri-shell .controls {
  position: absolute;
}

.petri-shell .controls {
  max-height: calc(100% - 24px);
}

.petri-shell .inspector {
  max-height: calc(100% - 24px);
}

/* Dar ekranda paneller birbirinin üstüne binmesin: deney paneli gizlenir,
   inceleme paneli tam genişliğe yayılır. Simülasyonun kendisi her boyutta
   çalışmaya devam eder. */
@media (max-width: 860px) {
  .petri-shell {
    height: min(70vh, 560px);
  }
  .petri-shell .controls {
    display: none;
  }
  .petri-shell .inspector {
    width: min(320px, calc(100% - 24px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .ctl-button {
    transition: none;
  }
}
</style>

<div class="petri-intro">
  <h1>Petri — kara kutuyu aç</h1>
  <p class="lede">
    Yapay zeka için sorulan en zor soru şu: <strong>"neden bu kararı verdi?"</strong>
    Bu sistemlerin içi çoğu zaman bir kara kutu. Petri, o sorunun tamamen içine
    bakabildiğin küçük bir halidir.
  </p>
  <p class="lede">
    Aşağıda kapalı bir dünya var. İçindeki her canlının bir beyni — küçük bir sinir
    ağı — var, ama hiçbirinin davranışını kimse programlamadı. Tek yasa kıtlık:
    enerjisi biten ölür, biriktiren bölünür ve yavrusu azıcık değişir. Nesiller
    boyunca işe yarayan beyinler kendiliğinden kalır. Buna evrim deniyor.
  </p>
  <p class="lede">
    <strong>Bir canlıya tıkla</strong> — sağda beyni açılır ve "sola dönüyor çünkü
    yiyecek solunda" gibi düz bir cümleyle <em>neden</em> öyle davrandığını
    görürsün. Üstteki <strong>senaryo</strong> menüsünden hazır dersleri dene:
    mutasyonu kapatınca evrimin nasıl donduğunu, ya da soğuk sevenlerin soğuğa
    nasıl göçtüğünü izle. İlk açılışta çıkan kısa tanıtım da yol gösterir.
  </p>
  <p class="lede" style="font-size:13px;color:var(--muted);">
    Dürüst olmak gerekirse: bu bir araştırma aracı değil, bir <strong>öğrenme</strong>
    aracı. Yapay zekanın "neden" sorununu çözmez — onu, gözünle görüp
    kavrayabileceğin bir ölçeğe indirir.
  </p>
  <div class="petri-keys">
    <span><kbd>tıkla</kbd>bir canlıyı incele</span>
    <span><kbd>senaryo ▾</kbd>hazır ders yükle</span>
    <span><kbd>sürükle</kbd>döndür</span>
    <span><kbd>tekerlek</kbd>yakınlaş</span>
    <span><kbd>?</kbd>tanıtımı tekrar aç</span>
  </div>
</div>

<div class="petri-shell">
  <canvas id="view"></canvas>
</div>

<script type="module">
${js}
</script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', 'petri-artifact.html');
writeFileSync(out, html, 'utf8');
console.log(`Artifact yazıldı: ${out} (${(html.length / 1024).toFixed(1)} KB)`);
