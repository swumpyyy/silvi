// ───── La carta Silvi in 3D, disegnata in tempo reale (WebGL2) ─────
// La carta non esiste davvero, quindi non ci sono né foto né video: viene disegnata a ogni aggiornamento dello
// schermo nel punto esatto in cui la porta lo scroll. Tre pezzi:
//  - lo sfondo: cielo (macchie azzurre e lilla di giorno, aurora di notte) sopra un'acqua sempre in movimento, che
//    si increspa dove passa il puntatore e specchia cielo e carta;
//  - la carta: lastra con angoli arrotondati e spessore vero. Il colore è una sfumatura azzurro → blu → indaco →
//    lilla che scivola quando la carta si inclina (come il titanio anodizzato), più i riflessi di quattro luci;
//  - le incisioni (simbolo, nome, chip, retro): disegnate su una tela 2D e incollate sopra come immagine.
// Serve WebGL2; se manca, createCard3D restituisce null e il sito mostra la carta disegnata in SVG.

const CARD = { h: 0.6306, t: 0.012, r: 0.037, D: 4 }; // formato ISO ID-1 con larghezza 1; D = distanza della camera
// il simbolo (riquadro 32×32): una moneta tagliata in due metà che scorrono a formare una "s", più il puntino della "i"
const SILVI_MARK = { path: 'M3.5 14.6A9 9 0 0 1 21.5 14.6ZM10.5 17.4A9 9 0 0 0 28.5 17.4Z', dot: [26.2, 9.4, 2.5] };

// rotazione Rz(rz) · Rx(rx) · Ry(ry) in gradi, per colonne come la vuole GLSL
function cardRotation(rx, ry, rz) {
  const k = Math.PI / 180;
  const ca = Math.cos(rx * k), sa = Math.sin(rx * k), cb = Math.cos(ry * k), sb = Math.sin(ry * k), cc = Math.cos(rz * k), sc = Math.sin(rz * k);
  return new Float32Array([
    cc * cb - sc * sa * sb, sc * cb + cc * sa * sb, -ca * sb,
    -sc * ca, cc * ca, sa,
    cc * sb + sc * sa * cb, sc * sb - cc * sa * cb, ca * cb,
  ]);
}
console.assert(Math.abs(cardRotation(0, 90, 0)[6] - 1) < 1e-6 && Math.abs(cardRotation(0, 0, 90)[1] - 1) < 1e-6, 'cardRotation: assi sbagliati');

// ───── Incisioni: tele 2D trasparenti, W × W·h ─────
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawMark(g, x, y, size, color) {
  g.save();
  g.translate(x, y);
  g.scale(size / 32, size / 32);
  g.fillStyle = color;
  g.fill(new Path2D(SILVI_MARK.path));
  g.beginPath();
  g.arc(...SILVI_MARK.dot, 0, 7);
  g.fill();
  g.restore();
}

const SANS = '"Inter Tight", "Helvetica Neue", Arial, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
function type(g, weight, size, family, spacing) {
  g.font = `${weight} ${size}px ${family}`;
  g.letterSpacing = `${(size * spacing).toFixed(2)}px`; // dove non è supportato resta la spaziatura normale
}

function paintFront(g, W, H) {
  // simbolo gigante in filigrana, tagliato dal bordo
  g.globalAlpha = 0.07;
  drawMark(g, W * 0.47, -H * 0.36, H * 1.8, '#fff');
  g.globalAlpha = 1;

  drawMark(g, W * 0.066, H * 0.09, W * 0.088, '#fff');
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  type(g, 700, W * 0.064, SANS, -0.045);
  g.fillText('silvi', W * 0.158, H * 0.166);

  // chip
  const cx = W * 0.085, cy = H * 0.37, cw = W * 0.148, ch = W * 0.116, cr = W * 0.017;
  const metal = g.createLinearGradient(cx, cy, cx + cw, cy + ch);
  [[0, '#ffffff'], [0.28, '#bdb9f0'], [0.52, '#f6f4ff'], [0.78, '#a39ee2'], [1, '#e6e2ff']].forEach(([t, c]) => metal.addColorStop(t, c));
  g.fillStyle = metal;
  rr(g, cx, cy, cw, ch, cr);
  g.fill();
  g.strokeStyle = 'rgba(255, 255, 255, .75)';
  g.lineWidth = W * 0.0016;
  rr(g, cx + W * 0.0016, cy + W * 0.0016, cw - W * 0.0032, ch - W * 0.0032, cr - W * 0.0016);
  g.stroke();
  g.strokeStyle = 'rgba(38, 32, 112, .6)';
  g.lineWidth = W * 0.0022;
  rr(g, cx + cw * 0.34, cy + ch * 0.27, cw * 0.32, ch * 0.46, cr * 0.45);
  g.stroke();
  g.beginPath();
  for (const v of [0.36, 0.64]) {
    g.moveTo(cx, cy + ch * v); g.lineTo(cx + cw * 0.34, cy + ch * v);
    g.moveTo(cx + cw * 0.66, cy + ch * v); g.lineTo(cx + cw, cy + ch * v);
  }
  g.moveTo(cx + cw * 0.5, cy); g.lineTo(cx + cw * 0.5, cy + ch * 0.27);
  g.moveTo(cx + cw * 0.5, cy + ch * 0.73); g.lineTo(cx + cw * 0.5, cy + ch);
  g.stroke();

  // onde del pagamento a contatto
  g.strokeStyle = 'rgba(255, 255, 255, .92)';
  g.lineWidth = W * 0.0066;
  g.lineCap = 'round';
  for (let i = 1; i <= 3; i++) {
    g.beginPath();
    g.arc(W * 0.262, cy + ch / 2, W * 0.0175 * i, -0.62, 0.62);
    g.stroke();
  }

  g.fillStyle = 'rgba(255, 255, 255, .9)';
  g.textBaseline = 'alphabetic';
  type(g, 500, W * 0.0255, MONO, 0.14);
  g.fillText('AURORA — 01', W * 0.085, H * 0.885);
  g.textAlign = 'right';
  g.fillText('TITANIO GR. 2', W * 0.925, H * 0.885);
}

function paintBack(g, W, H) {
  const band = g.createLinearGradient(0, H * 0.105, 0, H * 0.285);
  [[0, '#0d1138'], [0.45, '#05061a'], [1, '#101544']].forEach(([t, c]) => band.addColorStop(t, c));
  g.fillStyle = band;
  g.fillRect(0, H * 0.105, W, H * 0.18);

  // striscia della firma
  g.fillStyle = 'rgba(238, 234, 255, .93)';
  rr(g, W * 0.07, H * 0.4, W * 0.52, H * 0.115, W * 0.006);
  g.fill();
  g.strokeStyle = 'rgba(112, 100, 220, .32)';
  g.lineWidth = W * 0.0012;
  g.beginPath();
  for (let i = 1; i < 5; i++) { g.moveTo(W * 0.08, H * (0.4 + 0.023 * i)); g.lineTo(W * 0.58, H * (0.4 + 0.023 * i)); }
  g.stroke();

  // ologramma
  const holo = g.createLinearGradient(W * 0.67, H * 0.39, W * 0.83, H * 0.53);
  [[0, '#8fe0ff'], [0.28, '#7f8cff'], [0.52, '#e2d6ff'], [0.74, '#ffffff'], [1, '#9fb4ff']].forEach(([t, c]) => holo.addColorStop(t, c));
  g.fillStyle = holo;
  rr(g, W * 0.67, H * 0.395, W * 0.16, H * 0.125, W * 0.012);
  g.fill();
  drawMark(g, W * 0.722, H * 0.412, W * 0.056, 'rgba(30, 26, 110, .6)');

  g.fillStyle = 'rgba(255, 255, 255, .86)';
  g.textBaseline = 'alphabetic';
  type(g, 500, W * 0.0185, MONO, 0.08);
  ['CARTA DIMOSTRATIVA · NON VALIDA PER I PAGAMENTI', 'NUMERO, SCADENZA E CODICE SONO NELL’APP', 'ASSISTENZA DALL’APP, 24 ORE SU 24']
    .forEach((line, i) => g.fillText(line, W * 0.07, H * (0.665 + 0.062 * i)));

  drawMark(g, W * 0.745, H * 0.775, W * 0.05, '#fff');
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  type(g, 700, W * 0.037, SANS, -0.045);
  g.fillText('silvi', W * 0.798, H * 0.818);
}

// ───── Forma: fronte, retro e bordo ─────
// per ogni vertice: posizione (3), normale (3), faccia (0 fronte, 1 retro, 2 bordo)
function cardMesh() {
  const hw = 0.5, hh = CARD.h / 2, hz = CARD.t / 2, r = CARD.r, n = 14;
  const ring = [];
  [[hw - r, hh - r], [r - hw, hh - r], [r - hw, r - hh], [hw - r, r - hh]].forEach(([cx, cy], q) => {
    for (let i = 0; i <= n; i++) {
      const a = (q + i / n) * Math.PI / 2;
      ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a)]);
    }
  });
  const v = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    v.push(0, 0, hz, 0, 0, 1, 0, a[0], a[1], hz, 0, 0, 1, 0, b[0], b[1], hz, 0, 0, 1, 0);
    v.push(0, 0, -hz, 0, 0, -1, 1, b[0], b[1], -hz, 0, 0, -1, 1, a[0], a[1], -hz, 0, 0, -1, 1);
    v.push(a[0], a[1], hz, a[2], a[3], 0, 2, a[0], a[1], -hz, a[2], a[3], 0, 2, b[0], b[1], hz, b[2], b[3], 0, 2);
    v.push(b[0], b[1], hz, b[2], b[3], 0, 2, a[0], a[1], -hz, a[2], a[3], 0, 2, b[0], b[1], -hz, b[2], b[3], 0, 2);
  });
  return new Float32Array(v);
}

const DROPS = 16; // quanti cerchi nell'acqua restano vivi insieme

const BG_FS = `#version 300 es
precision highp float;
uniform vec2 uRes, uCard, uMouse;
uniform float uW, uDark, uTime, uHorizon, uMirror;
uniform vec4 uDrops[${DROPS}];   // cerchi nell'acqua: x e z sul piano dell'acqua, istante di nascita, forza
uniform sampler2D uRefl;         // la carta da sola, da specchiare
out vec4 o;
float asp, gw;
vec2 card, mouse;
float blob(vec2 p, vec2 c, float r) { vec2 d = (p - c) / r; return exp(-dot(d, d)); }
// un nastro d'aurora: netto in basso, sfuma verso l'alto come una tenda di luce
float ribbon(float y, float base) { float d = y - base; return smoothstep(-0.035, 0.0, d) * exp(-max(d, 0.0) / 0.13); }

// il cielo nel punto q (schermo alto 1, y verso l'alto)
vec3 sky(vec2 q) {
  float t = uTime * 0.06;
  float x = q.x / asp;
  float hz = exp(-abs(q.y - uHorizon) / 0.02);                  // la riga di luce all'orizzonte

  // giorno: bianco ghiaccio con macchie azzurre, lilla e pervinca che si spostano piano
  vec3 day = vec3(0.955, 0.972, 1.0);
  day = mix(day, vec3(0.66, 0.85, 1.00), 0.90 * blob(q, vec2(-0.52 * asp + 0.08 * sin(t * 1.3), 0.40 + 0.05 * cos(t)), 0.62));
  day = mix(day, vec3(0.82, 0.75, 1.00), 0.90 * blob(q, vec2(0.50 * asp + 0.07 * cos(t * 1.1), 0.34 + 0.06 * sin(t * 0.9)), 0.60));
  day = mix(day, vec3(0.70, 0.75, 1.00), 0.62 * blob(q, vec2(0.20 * asp + 0.06 * sin(t * 0.7), uHorizon + 0.04), 0.42));
  day = mix(day, vec3(0.72, 0.90, 1.00), 0.55 * blob(q, vec2(-0.36 * asp, uHorizon + 0.06 + 0.04 * sin(t * 1.2)), 0.36));
  day = mix(day, vec3(0.60, 0.74, 1.00), 0.32 * blob(q, mouse, 0.34));                       // segue il puntatore
  day = mix(day, vec3(1.0), 0.70 * blob(q, card + vec2(-0.08, 0.18) * gw, gw * 0.72));        // luce dietro la carta
  day = mix(day, vec3(1.0), 0.60 * hz);

  // notte: blu quasi nero, l'alone dietro la carta e tre nastri d'aurora che ondeggiano
  vec3 night = vec3(0.016, 0.020, 0.070);
  night += vec3(0.10, 0.09, 0.42) * 0.46 * blob(q, card, gw * 0.82);
  night += vec3(0.02, 0.22, 0.55) * 0.30 * blob(q, card + vec2(-0.50, 0.08) * gw, gw * 0.50);
  night += vec3(0.36, 0.22, 0.72) * 0.27 * blob(q, card + vec2(0.50, -0.06) * gw, gw * 0.50);
  night += vec3(0.04, 0.07, 0.24) * 0.50 * blob(q, mouse, 0.45);
  float rays = 0.72 + 0.28 * sin(x * 46.0 + 3.0 * sin(x * 7.0 + t * 4.0));
  night += vec3(0.08, 0.50, 0.95) * 0.24 * rays * (0.55 + 0.45 * sin(x * 2.2 + t * 0.9))
    * ribbon(q.y, uHorizon + 0.20 + 0.06 * sin(x * 3.1 + t * 2.3) + 0.025 * sin(x * 8.3 - t * 3.1));
  night += vec3(0.36, 0.28, 1.00) * 0.26 * rays * (0.55 + 0.45 * sin(x * 2.9 - t * 1.3 + 2.0))
    * ribbon(q.y, uHorizon + 0.11 + 0.05 * sin(x * 2.3 - t * 1.7 + 1.3) + 0.02 * sin(x * 9.1 + t * 2.6));
  night += vec3(0.72, 0.52, 1.00) * 0.17 * rays * (0.55 + 0.45 * sin(x * 1.7 + t * 0.7 + 4.0))
    * ribbon(q.y, uHorizon + 0.31 + 0.05 * sin(x * 4.0 + t * 1.2 + 2.6));
  night += vec3(0.30, 0.42, 1.00) * hz * (0.16 + 0.55 * blob(q, vec2(card.x, uHorizon), 0.42 * asp));

  // dal giorno alla notte passando per un crepuscolo blu, non per il grigio
  vec3 dusk = vec3(0.13, 0.17, 0.60) + vec3(0.16, 0.10, 0.30) * blob(q, card, gw) + vec3(0.40, 0.38, 0.80) * 0.4 * hz;
  return mix(mix(day, dusk, smoothstep(0.0, 0.6, uDark)), night, smoothstep(0.3, 1.0, uDark));
}

void main() {
  asp = uRes.x / uRes.y;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  card = uCard * 0.5 * vec2(asp, 1.0);
  mouse = uMouse * 0.5 * vec2(asp, 1.0);
  gw = min(uW * asp, 0.62 * asp);
  float s = uHorizon - p.y;                                     // quanto sotto l'orizzonte
  vec3 c;
  if (s <= 0.0) {
    c = sky(p);
  } else {
    // l'acqua è un piano visto in prospettiva: verso l'orizzonte è sempre più lontana
    vec2 P = vec2(p.x, 1.0) * (0.25 / (s + 0.012));
    float near = smoothstep(0.0, 0.11, s);                      // in lontananza le onde si spengono: niente sfarfallio
    vec2 g = vec2(0.0);                                         // pendenza della superficie
    // onda lunga, sempre in movimento
    g += 0.20 * cos(dot(P, vec2(9.0, 23.0)) + uTime * 1.1) * vec2(0.36, 0.93);
    g += 0.15 * cos(dot(P, vec2(-14.0, 31.0)) - uTime * 1.5 + 1.7) * vec2(-0.41, 0.91);
    g += 0.11 * cos(dot(P, vec2(27.0, 12.0)) + uTime * 0.9 + 4.1) * vec2(0.91, 0.41);
    g += 0.09 * cos(dot(P, vec2(-5.0, 52.0)) + uTime * 2.1) * vec2(-0.10, 0.99);
    g += 0.06 * cos(dot(P, vec2(41.0, 67.0)) - uTime * 2.6 + 0.8) * vec2(0.52, 0.85);
    g *= 0.62 + 0.38 * sin(dot(P, vec2(1.9, 3.3)) + uTime * 0.23);
    // cerchi che si allargano da dove è passato il puntatore
    for (int i = 0; i < ${DROPS}; i++) {
      vec4 d = uDrops[i];
      float age = uTime - d.z;
      vec2 v = P - d.xy;
      float dist = length(v) + 0.0001;
      float x = dist - age * 0.55;                              // distanza dal fronte del cerchio
      float w = (0.09 + 0.07 * age) * (x < 0.0 ? 2.6 : 1.0);    // dietro il fronte resta una scia
      g += v / dist * d.w * step(0.0, age) * exp(-age * 0.85) * exp(-x * x / (w * w)) * sin(x * 44.0);
    }
    g *= near;

    // l'acqua specchia il cielo, spostato dalle onde
    vec2 off = g * vec2(0.035, 0.060);
    vec3 refl = sky(vec2(p.x + off.x, uHorizon + max(s + off.y, 0.0)));
    vec3 deep = mix(vec3(0.66, 0.78, 0.98), vec3(0.008, 0.012, 0.050), smoothstep(0.1, 0.9, uDark));
    c = mix(deep, refl, mix(0.50, 1.0, exp(-s * 3.5))) * mix(0.97, 0.80, uDark);   // radente riflette di più
    c *= 1.0 + g.y * mix(0.10, 0.22, uDark);                    // creste chiare, cavi scuri

    // e specchia la carta, sotto di lei
    float below = uMirror - uv.y;
    vec2 ruv = vec2(uv.x + off.x * 0.5 / asp, 2.0 * uMirror - uv.y + off.y * 0.5);
    vec2 px = (1.5 + 16.0 * max(below, 0.0)) / uRes;            // più lontano dalla carta, più sfocato
    vec4 cr = 0.28 * textureLod(uRefl, ruv, 0.0) + 0.18 * (textureLod(uRefl, ruv + px, 0.0) + textureLod(uRefl, ruv - px, 0.0)
      + textureLod(uRefl, ruv + px * vec2(1.0, -1.0), 0.0) + textureLod(uRefl, ruv + px * vec2(-1.0, 1.0), 0.0));
    c = mix(c, cr.rgb * mix(1.0, 0.78, uDark), cr.a * step(0.0, below) * exp(-below * mix(5.0, 2.6, uDark)) * mix(0.42, 0.62, uDark));

    // luccichio sulle creste più ripide
    vec3 n = normalize(vec3(-g.x * 1.4, 1.0, -g.y * 1.4));
    float spec = pow(max(dot(n, normalize(vec3(0.15, 0.78, 0.60))), 0.0), 64.0);
    c += mix(vec3(0.95, 0.98, 1.00), vec3(0.62, 0.72, 1.00), uDark) * spec * mix(0.40, 0.62, uDark) * near;
  }
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 170.0;  // grana: niente righe nelle sfumature
  o = vec4(c, 1.0);
}`;

const CARD_VS = `#version 300 es
in vec3 aPos;
in vec3 aNrm;
in float aFace;
uniform mat3 uR;
uniform float uD, uAspect, uW;
uniform vec2 uOff;
out vec3 vPos;
out vec3 vNrm;
out vec2 vLoc;
out float vFace;
void main() {
  vec3 q = uR * aPos;
  float zv = uD - q.z;                                         // distanza dalla camera
  vec2 ndc = q.xy * vec2(1.0, uAspect) * (2.0 * uW * uD / zv) + uOff;
  gl_Position = vec4(ndc * zv, -q.z * zv, zv);
  vPos = q;
  vNrm = uR * aNrm;
  vLoc = aPos.xy;
  vFace = aFace;
}`;

const CARD_FS = `#version 300 es
precision highp float;
in vec3 vPos;
in vec3 vNrm;
in vec2 vLoc;
in float vFace;
uniform sampler2D uFront, uBack;
uniform mat3 uR;
uniform float uD, uDark, uTime, uSpot;
uniform vec2 uHue, uFocus;
out vec4 o;
const float PI = 3.14159265;

// azzurro → blu → indaco → viola chiaro → lilla
vec3 pal(float t) {
  t = clamp(t, 0.0, 1.0) * 4.0;
  vec3 c = mix(vec3(0.33, 0.80, 1.00), vec3(0.14, 0.44, 0.98), clamp(t, 0.0, 1.0));
  c = mix(c, vec3(0.24, 0.19, 0.80), clamp(t - 1.0, 0.0, 1.0));
  c = mix(c, vec3(0.52, 0.38, 0.97), clamp(t - 2.0, 0.0, 1.0));
  return mix(c, vec3(0.80, 0.73, 1.00), clamp(t - 3.0, 0.0, 1.0));
}
// una luce a striscia verticale, a un certo angolo attorno alla carta (0 = dalla camera)
float strip(float phi, float at, float w) {
  float d = (mod(phi - at + PI, 2.0 * PI) - PI) / w;
  return exp(-d * d);
}
// quello che la carta riflette guardando nella direzione r
vec3 env(vec3 r) {
  float phi = atan(r.x, r.z);
  vec3 c = mix(vec3(0.34, 0.40, 0.56), vec3(0.03, 0.04, 0.15), uDark);
  c += vec3(0.72, 0.93, 1.00) * 1.05 * strip(phi, -0.80, 0.27) * smoothstep(-0.70, 0.05, r.y);   // azzurra, davanti a sinistra
  c += vec3(0.82, 0.70, 1.00) * 0.90 * strip(phi, 1.10, 0.31) * smoothstep(-0.75, 0.00, r.y);    // lilla, a destra
  c += vec3(0.30, 0.46, 1.00) * 0.60 * strip(phi, 2.55, 0.50);                                   // blu, dietro
  c += vec3(1.00, 1.00, 1.00) * 0.95 * strip(phi, -2.30, 0.15);                                  // lama bianca
  c += vec3(0.90, 0.95, 1.00) * mix(0.7, 0.45, uDark) * smoothstep(0.45, 0.95, r.y);             // soffitto
  return c;
}

void main() {
  vec3 N = normalize(vNrm);
  vec3 V = normalize(vec3(0.0, 0.0, uD) - vPos);
  float flat_ = 1.0 - step(1.5, vFace);                        // 1 su fronte e retro, 0 sul bordo
  // la lastra riflette come se fosse appena bombata: i riflessi la attraversano invece di accenderla tutta insieme
  vec3 Nb = normalize(N + (uR[0] * vLoc.x + uR[1] * vLoc.y) * 0.52 * flat_);
  vec3 e = env(reflect(-V, Nb));
  float nv = clamp(dot(N, V), 0.0, 1.0);

  // colore: la sfumatura corre in diagonale e scivola con l'inclinazione
  float side = vFace < 0.5 ? 1.0 : -1.0;
  float d = 0.5 + 0.78 * side * vLoc.x - 0.55 * vLoc.y + 0.55 * (1.0 - nv)
    + 0.045 * sin(vLoc.x * 7.0 - vLoc.y * 5.0 + uTime * 0.3);
  vec3 base = pal(uHue.x + uHue.y * (1.0 - abs(mod(d, 2.0) - 1.0)));
  vec3 col = base * (mix(0.84, 0.64, uDark) + 0.62 * e);
  col += e * dot(e, vec3(0.3, 0.5, 0.2)) * 0.10;
  col += vec3(0.60, 0.72, 1.00) * 0.45 * pow(1.0 - nv, 3.0);

  // smusso: una riga di luce lungo il bordo delle due facce
  vec2 q = abs(vLoc) - vec2(0.5 - ${CARD.r}, ${(CARD.h / 2 - CARD.r).toFixed(4)});
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${CARD.r};
  col += (0.18 + 0.45 * e) * smoothstep(-0.0105, -0.0015, sd) * flat_;

  // bordo: titanio chiaro
  col = mix(vec3(0.42, 0.44, 0.78) * (0.35 + 0.95 * e), col, flat_);

  // faro: nel primo piano resta illuminato solo il dettaglio
  vec2 f = vLoc - uFocus;
  col *= mix(1.0, 0.18 + 0.90 * exp(-dot(f, f) / 0.10), uSpot);

  // le alte luci si avvicinano al bianco senza bruciarsi
  col = mix(col, 0.72 + 0.28 * (1.0 - exp(-(col - 0.72) / 0.28)), step(0.72, col));

  // incisioni
  vec2 uv = vec2(0.5 + side * vLoc.x, vLoc.y / ${CARD.h} + 0.5);
  vec4 ink = mix(texture(uFront, uv), texture(uBack, uv), step(0.5, vFace)) * flat_;
  float lit = (0.74 + 0.42 * dot(e, vec3(0.3, 0.5, 0.2))) * mix(1.0, 0.56 + 0.54 * exp(-dot(f, f) / 0.10), uSpot);
  col = col * (1.0 - ink.a) + ink.rgb * min(lit, 1.15);

  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 170.0;
  o = vec4(col, 1.0);
}`;

// opts.tex: larghezza in px della tela del fronte (4096 per il primo piano a schermo intero)
function createCard3D(canvas, opts = {}) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true });
  if (!gl) return null;

  function program(vs, fs, attribs) {
    const p = gl.createProgram();
    for (const [kind, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(kind);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh);
    }
    attribs.forEach((name, i) => gl.bindAttribLocation(p, i, name));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {};
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
      const u = gl.getActiveUniform(p, i);
      loc[u.name] = gl.getUniformLocation(p, u.name);
    }
    return { p, loc };
  }

  let bg, card;
  try {
    bg = program('#version 300 es\nin vec2 aPos;\nvoid main() { gl_Position = vec4(aPos, 0.0, 1.0); }', BG_FS, ['aPos']);
    card = program(CARD_VS, CARD_FS, ['aPos', 'aNrm', 'aFace']);
  } catch (err) {
    console.warn('Carta 3D non disponibile:', err.message);
    return null;
  }

  const bgVao = gl.createVertexArray();
  gl.bindVertexArray(bgVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // un triangolo che copre lo schermo
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const mesh = cardMesh();
  const cardVao = gl.createVertexArray();
  gl.bindVertexArray(cardVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
  [[0, 3, 0], [1, 3, 12], [2, 1, 24]].forEach(([i, size, offset]) => {
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, size, gl.FLOAT, false, 28, offset);
  });

  // incisioni: trasparenti finché i caratteri non sono arrivati
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const faces = [[paintFront, Math.min(opts.tex || 2048, maxTex)], [paintBack, Math.min(2048, maxTex)]].map(([paint, W], unit) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    return () => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = Math.round(W * CARD.h);
      paint(c.getContext('2d'), c.width, c.height);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // nitide anche quando la carta è vista di taglio
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    };
  });
  const fonts = Promise.all([document.fonts.load(`700 64px ${SANS}`), document.fonts.load(`500 32px ${MONO}`)]).catch(() => {});
  // shortcut: dopo 3 s si incide con i caratteri di sistema; se serve il carattere giusto anche su reti lente, ridisegnare all'arrivo
  const ready = Promise.race([fonts, new Promise((r) => setTimeout(r, 3000))]).then(() => faces.forEach((upload) => upload()));

  // la carta da sola, a metà risoluzione: lo sfondo la specchia nell'acqua
  const mirror = { fb: gl.createFramebuffer(), tex: gl.createTexture(), depth: gl.createRenderbuffer(), w: 0, h: 0 };
  function mirrorSize(w, h) {
    if (mirror.w === w && mirror.h === h) return;
    mirror.w = w;
    mirror.h = h;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, mirror.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindRenderbuffer(gl.RENDERBUFFER, mirror.depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, mirror.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, mirror.tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, mirror.depth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  gl.enable(gl.CULL_FACE);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0, 0, 0, 0);

  // cerchi nell'acqua: [x, z sul piano dell'acqua, istante, forza] × DROPS, il più vecchio viene sovrascritto
  const drops = new Float32Array(DROPS * 4).fill(-1000);
  let nextDrop = 0, asp = 1, horizon = 0;
  // un tocco sull'acqua. x, y: come il centro della carta (frazioni del canvas dal centro, y verso il basso).
  // Sopra l'orizzonte vale il punto specchiato: anche muovendosi nel cielo l'acqua risponde.
  function drop(x, y, force, time) {
    const k = 0.25 / (Math.max(Math.abs(horizon + y), 0.03) + 0.012); // la stessa prospettiva dello sfondo
    drops.set([x * asp * k, k, time, force], nextDrop * 4);
    nextDrop = (nextDrop + 1) % DROPS;
  }

  function drawCard(s) {
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(card.p);
    gl.uniformMatrix3fv(card.loc.uR, false, cardRotation(s.rx, s.ry, s.rz));
    gl.uniform1f(card.loc.uD, CARD.D);
    gl.uniform1f(card.loc.uAspect, asp);
    gl.uniform1f(card.loc.uW, s.w);
    gl.uniform2f(card.loc.uOff, 2 * s.x, -2 * s.y);
    gl.uniform1f(card.loc.uDark, s.dark);
    gl.uniform1f(card.loc.uTime, s.time);
    gl.uniform1f(card.loc.uSpot, s.spot);
    gl.uniform2f(card.loc.uFocus, s.focus[0], s.focus[1]);
    gl.uniform2f(card.loc.uHue, s.hue[0], s.hue[1]);
    gl.uniform1i(card.loc.uFront, 0);
    gl.uniform1i(card.loc.uBack, 1);
    gl.bindVertexArray(cardVao);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 7);
  }

  // s: { w: larghezza della carta (frazione della larghezza del canvas), x, y: centro (frazioni del canvas dal centro,
  //      y verso il basso), rx, ry, rz: gradi, dark, spot: 0–1, focus: [x, y] sulla carta, time: secondi,
  //      mouse: [x, y] tra -1 e 1, hue: [inizio, ampiezza] sulla scala dei colori,
  //      horizon: altezza dell'orizzonte (frazione del canvas sopra il centro) }
  function render(s) {
    const W = canvas.width, H = canvas.height;
    asp = W / H;
    horizon = s.horizon;
    // la linea dello specchio: appena sotto la carta, mai sopra l'orizzonte (0 = fondo del canvas, 1 = cima)
    const mirrorY = 0.5 + Math.min(-s.y - 0.65 * CARD.h * s.w * asp - 0.01, horizon - 0.012);

    if (mirrorY > 0) { // sotto il fondo dello schermo il riflesso non si vede: non lo si disegna
      mirrorSize(Math.max(W >> 1, 2), Math.max(H >> 1, 2));
      gl.bindFramebuffer(gl.FRAMEBUFFER, mirror.fb);
      gl.viewport(0, 0, mirror.w, mirror.h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      drawCard(s);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(bg.p);
    gl.uniform2f(bg.loc.uRes, W, H);
    gl.uniform2f(bg.loc.uCard, 2 * s.x, -2 * s.y);
    gl.uniform2f(bg.loc.uMouse, s.mouse[0], -s.mouse[1]);
    gl.uniform1f(bg.loc.uW, s.w);
    gl.uniform1f(bg.loc.uDark, s.dark);
    gl.uniform1f(bg.loc.uTime, s.time);
    gl.uniform1f(bg.loc.uHorizon, horizon);
    gl.uniform1f(bg.loc.uMirror, mirrorY);
    gl.uniform4fv(bg.loc['uDrops[0]'], drops);
    gl.uniform1i(bg.loc.uRefl, 2);
    gl.bindVertexArray(bgVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.clear(gl.DEPTH_BUFFER_BIT);
    drawCard(s);
  }

  return { ready, render, drop };
}
