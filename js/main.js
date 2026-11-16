// ───── La scena: la carta disegnata in tempo reale (js/card3d.js) ─────
// Niente video pre-calcolato: a ogni aggiornamento dello schermo la carta viene ridisegnata esattamente dove la
// porta lo scroll, quindi il movimento è continuo e sempre nitido.
const SCENE = {
  // [p, larghezza della carta (frazione del lato di riferimento), x, y (frazioni dello schermo dal centro, y verso
  //  il basso), rx, ry, rz (gradi), faro 0–1]. ry che cresce = la carta gira su se stessa.
  pose: {
    desktop: [
      [0, 0.46, 0.14, -0.12, -14, -32, -12, 0], [0.08, 0.40, 0.05, -0.04, -10, -16, -5, 0],
      [0.15, 0.38, 0, -0.01, -6, 0, 0, 0], [0.43, 0.38, 0, -0.01, -6, 360, 0, 0],
      [0.50, 0.44, -0.15, 0.06, -12, 388, -5, 0], [0.58, 0.44, -0.16, 0.07, -11, 392, -4, 0],
      [0.66, 0.42, 0.16, -0.06, 10, 330, 6, 0], [0.74, 0.42, 0.17, -0.07, 9, 326, 5, 0],
      [0.86, 1.45, 0.25, 0.17, -10, 345, -3, 1], [1, 1.62, 0.29, 0.19, -8, 353, -2, 1],
    ],
    mobile: [
      [0, 0.80, 0.02, -0.21, -14, -30, -12, 0], [0.08, 0.74, 0, -0.14, -10, -15, -5, 0],
      [0.15, 0.72, 0, -0.08, -6, 0, 0, 0], [0.43, 0.72, 0, -0.08, -6, 360, 0, 0],
      [0.50, 0.76, 0, -0.17, -12, 386, -5, 0], [0.58, 0.76, 0, -0.17, -11, 390, -4, 0],
      [0.66, 0.76, 0, -0.17, 10, 332, 6, 0], [0.74, 0.76, 0, -0.17, 9, 328, 5, 0],
      [0.86, 2.3, 0.62, -0.16, -10, 345, -3, 1], [1, 2.5, 0.68, -0.15, -8, 353, -2, 1],
    ],
  },
  dark: [[0, 0], [0.08, 0], [0.15, 1], [1, 1]], // dal giorno azzurro alla notte indaco
  horizon: { desktop: 0.05, mobile: 0 }, // dove finisce il cielo e comincia l'acqua (frazione dello schermo sopra il centro)
  focus: [-0.3, 0.03], // il punto illuminato nel primo piano (il chip), in larghezze di carta dal centro
};
// Punti della timeline (0–1) usati per i link della nav e per la versione statica
const STOPS = { hero: 0, blocks: [0.53, 0.69, 0.87] };
// Tonalità: [inizio, ampiezza] sulla scala azzurro → blu → indaco → lilla della carta
const TONES = { aurora: [0, 1], azzurro: [0, 0.24], blu: [0.2, 0.2], indaco: [0.44, 0.18], lilla: [0.72, 0.28] };

const smooth = (t) => { t = Math.min(Math.max(t, 0), 1); return t * t * (3 - 2 * t); };
// valori dei keyframe [p, ...valori] nel punto p, con raccordo morbido tra un keyframe e l'altro
function at(keys, p) {
  if (p <= keys[0][0]) return keys[0].slice(1);
  for (let k = 1; k < keys.length; k++) {
    const a = keys[k - 1], b = keys[k];
    if (p <= b[0]) {
      const t = smooth((p - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((v, j) => v + (b[j + 1] - v) * t);
    }
  }
  return keys[keys.length - 1].slice(1);
}
console.assert(at([[0, 0], [1, 10]], 0.5)[0] === 5 && at([[0, 0], [1, 10]], 2)[0] === 10, 'at() non interpola');

const mobile = matchMedia('(max-width: 768px)').matches; // shortcut: impaginazione scelta al caricamento, ruotare il tablet non la cambia
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const still = reduce || !(window.gsap && window.ScrollTrigger && window.Lenis); // versione statica

const stage = document.querySelector('.stage');
const pin = stage.querySelector('.pin');
const canvas = stage.querySelector('.video');
const shop = document.querySelector('.card__canvas');
const shopView = document.querySelector('.card__view');
const blocks = [...stage.querySelectorAll('.block')];
const panels = []; // [canvas, p] della versione statica
let lenis = null;
let progress = 0; // dove si trova la scena (0–1)

const scene3d = createCard3D(canvas, { tex: mobile ? 2048 : 4096 }); // 4096: il primo piano resta nitido a schermo intero
const shop3d = scene3d && createCard3D(shop);
if (!shop3d) document.body.classList.add('no-gl');

const hue = [...TONES.aurora]; // la tonalità mostrata: insegue quella scelta
let tone = 'aurora';
const mouse = { x: 0, y: 0, sx: 0, sy: 0 }; // puntatore sullo schermo tra -1 e 1, e lo stesso ammorbidito
const tilt = { x: 0, y: 0, sx: 0, sy: 0, turn: 0, sturn: 0 }; // puntatore sulla carta da comprare, e quanto è girata

// ───── Carrello, tonalità, giro della carta ─────
let cart = 0;
const cartCount = document.querySelector('.cart-count');
const status = document.querySelector('.card__status');
const toneName = document.querySelector('.tones__name');
document.querySelector('.pill').addEventListener('click', () => {
  cart += 1;
  cartCount.textContent = cart;
  status.textContent = `Aggiunta al carrello · ${cart} ${cart === 1 ? 'carta' : 'carte'} · ${toneName.textContent}`;
});
document.querySelectorAll('.tone input').forEach((input) => input.addEventListener('change', () => {
  tone = input.value;
  toneName.textContent = input.nextElementSibling.textContent;
  if (still) settle();
}));
const flip = document.querySelector('.flip');
flip.addEventListener('click', () => {
  tilt.turn += 180;
  flip.setAttribute('aria-pressed', tilt.turn % 360 !== 0);
  if (still) settle();
});
addEventListener('pointermove', (e) => {
  mouse.x = e.clientX / innerWidth * 2 - 1;
  mouse.y = e.clientY / innerHeight * 2 - 1;
}, { passive: true });
shopView.addEventListener('pointermove', (e) => {
  const r = shopView.getBoundingClientRect();
  tilt.x = (e.clientX - r.left) / r.width * 2 - 1;
  tilt.y = (e.clientY - r.top) / r.height * 2 - 1;
});

// ───── L'acqua risponde: ogni passaggio del puntatore lascia un cerchio, il clic uno più forte ─────
const wake = { x: 0, y: 0 }; // dove è nato l'ultimo cerchio
function touchWater(e, force) {
  if (still || !shop3d) return;
  if (force < 1 && Math.hypot(e.clientX - wake.x, e.clientY - wake.y) < 26) return; // uno ogni 26 px di strada
  wake.x = e.clientX;
  wake.y = e.clientY;
  const now = performance.now() / 1000;
  for (const [view, c] of [[scene3d, canvas], [shop3d, shop]]) {
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    if (Math.abs(x) <= 0.5 && Math.abs(y) <= 0.5) view.drop(x, y, force, now);
  }
}
addEventListener('pointermove', (e) => touchWater(e, 0.55), { passive: true });
addEventListener('pointerdown', (e) => touchWater(e, 1.2), { passive: true });
shopView.addEventListener('pointerleave', () => { tilt.x = tilt.y = 0; });

// ───── Disegno ─────
// la carta della scena nel punto p; live = respira e segue il puntatore
function stageState(p, W, H, t, live) {
  const [size, x, y, rx, ry, rz, spot] = at(SCENE.pose[mobile ? 'mobile' : 'desktop'], p);
  const side = Math.min(W, H * (mobile ? 0.62 : 1.6)); // lato di riferimento: la carta non esce dagli schermi stretti
  return {
    w: size * side / W,
    x,
    y: y + Math.sin(p * Math.PI * 6) * 0.006, // galleggia appena
    rx: rx + (live ? Math.sin(t * 0.7) * 1.1 + mouse.sy * 3 : 0),
    ry: ry + (live ? Math.sin(t * 0.5) * 2.2 + mouse.sx * 5 : 0),
    rz: rz + Math.sin(p * Math.PI * 4) * 1.6,
    dark: at(SCENE.dark, p)[0],
    spot,
    focus: SCENE.focus,
    time: t,
    mouse: live ? [mouse.sx, mouse.sy] : [0, 0],
    hue,
    horizon: SCENE.horizon[mobile ? 'mobile' : 'desktop'],
  };
}

// la carta da comprare: segue il puntatore e si gira con il bottone
function shopState(t, live) {
  return {
    w: 0.58, x: 0, y: -0.07,
    rx: -8 - tilt.sy * 14 + (live ? Math.sin(t * 0.8) * 1.5 : 0),
    ry: -20 + tilt.sx * 26 + tilt.sturn + (live ? Math.sin(t * 0.55) * 4 : 0),
    rz: -5,
    dark: 1, spot: 0, focus: SCENE.focus, time: t,
    mouse: [tilt.sx * 0.6, tilt.sy * 0.6],
    hue,
    horizon: 0,
  };
}

function fit(c) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  c.width = Math.round(c.clientWidth * dpr);
  c.height = Math.round(c.clientHeight * dpr);
}

// versione statica: tutto fermo nella posa finale, ridisegnato solo quando cambia qualcosa
function settle() {
  if (!shop3d) return;
  hue[0] = TONES[tone][0];
  hue[1] = TONES[tone][1];
  tilt.sturn = tilt.turn;
  fit(shop);
  shop3d.render(shopState(0, false));
  panels.forEach(([c, p]) => {
    fit(c);
    canvas.width = c.width; // il canvas 3D è nascosto: fa da tavolozza e viene copiato in ogni pannello
    canvas.height = c.height;
    scene3d.render(stageState(p, c.width, c.height, 0, false));
    c.getContext('2d').drawImage(canvas, 0, 0);
  });
}

let stageOn = true, shopOn = false, last = 0, rain = 0;
function frame() {
  const now = performance.now() / 1000;
  const k = 1 - Math.exp(-Math.min(now - last, 0.1) * 5); // stessa morbidezza a 60 e a 120 Hz
  last = now;
  mouse.sx += (mouse.x - mouse.sx) * k;
  mouse.sy += (mouse.y - mouse.sy) * k;
  tilt.sx += (tilt.x - tilt.sx) * k;
  tilt.sy += (tilt.y - tilt.sy) * k;
  tilt.sturn += (tilt.turn - tilt.sturn) * k;
  hue[0] += (TONES[tone][0] - hue[0]) * k;
  hue[1] += (TONES[tone][1] - hue[1]) * k;
  if (now > rain) { // una goccia ogni tanto: l'acqua si muove anche a puntatore fermo e sui telefoni
    rain = now + 0.9 + Math.random() * 1.3;
    const view = shopOn && (!stageOn || Math.random() < 0.5) ? shop3d : scene3d;
    view.drop(Math.random() - 0.5, Math.random() * 0.5, 0.5, now);
  }
  if (stageOn && canvas.width) scene3d.render(stageState(progress, canvas.width, canvas.height, now, true));
  if (shopOn && shop.width) shop3d.render(shopState(now, true));
}

function resize() {
  if (!shop3d) return;
  if (still) return settle();
  fit(canvas);
  fit(shop);
  frame();
}

// ───── Versione statica: riduci movimento o librerie non arrivate ─────
function staticLayout() {
  document.body.classList.add('is-static');
  stage.classList.add('is-static');
  const items = [stage.querySelector('.hero'), ...blocks];
  [STOPS.hero, ...STOPS.blocks].forEach((p, k) => {
    const panel = document.createElement('div');
    panel.className = 'panel';
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    panel.append(c, items[k]);
    pin.append(panel);
    panels.push([c, p]);
  });
}

// ───── Timeline: lunga 100, le posizioni sono percentuali di scroll ─────
function buildTimeline() {
  const state = { p: 0 };
  const q = gsap.utils.selector(stage);
  const sharp = { opacity: 1, filter: 'blur(0px)' };
  const soft = { opacity: 0, filter: 'blur(14px)' };
  const nums = q('.counter__now > span');

  gsap.set(q('.hero'), { filter: 'blur(0px)' });
  gsap.set('.nav', { filter: 'invert(0)' });
  gsap.set(blocks, soft);
  gsap.set(q('.mask'), { xPercent: -101 });
  gsap.set(q('.mask__in'), { xPercent: 101 });
  gsap.set(q('.specs div'), { opacity: 0, y: 12 });

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } })
    .to(state, { p: 1, duration: 100, ease: 'none', onUpdate: () => { progress = state.p; } }, 0)
    // 0–8: l'hero si sfoca e sparisce
    .to(q('.hero'), { opacity: 0, filter: 'blur(20px)', duration: 8, ease: 'power1.in' }, 0)
    // 8–15: buio, nav bianca, compare il contatore. 15–43: la carta fa un giro intero, senza testi
    .to('.nav', { filter: 'invert(1)', duration: 2.5, ease: 'none' }, 10)
    .to(q('.counter'), { opacity: 1, duration: 4 }, 11.5);

  // tre blocchi: entrano, restano, escono
  [[46, 59], [62, 75], [78, 91]].forEach(([a, b], k) => {
    const el = blocks[k];
    const sel = gsap.utils.selector(el);
    tl.to(el, { ...sharp, duration: 5 }, a)
      .to(sel('.mask'), { xPercent: 0, duration: 5, ease: 'power3.out' }, a)
      .to(sel('.mask__in'), { xPercent: 0, duration: 5, ease: 'power3.out' }, a)
      .to(sel('.specs div'), { opacity: 1, y: 0, duration: 3, stagger: 0.8 }, a + 2)
      .to(el, { ...soft, duration: 3, ease: 'power1.in' }, b - 3);
    if (k) tl.to(nums[k - 1], { opacity: 0, duration: 2 }, a).to(nums[k], { opacity: 1, duration: 2 }, a);
  });

  // 90–100: resta solo il primo piano, e il fondo dello schermo sfuma nella sezione che segue
  return tl.to(q('.counter'), { opacity: 0, duration: 3 }, 92).to(q('.pin__fade'), { opacity: 1, duration: 8, ease: 'none' }, 92);
}

function init() {
  gsap.registerPlugin(ScrollTrigger);
  stage.classList.add('is-pinned');

  lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  ScrollTrigger.create({
    animation: buildTimeline(),
    trigger: stage,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.8,
  });

  // i link della nav portano al punto della timeline dove compare il blocco
  const range = () => stage.offsetHeight - innerHeight;
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const where = a.dataset.at;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(where ? stage.offsetTop + range() * where : target, { duration: 1.6 });
  }));

  if (!shop3d) return;
  // si disegna solo quello che è sullo schermo
  const seen = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.target === pin) stageOn = e.isIntersecting;
    else shopOn = e.isIntersecting;
  }));
  seen.observe(pin);
  seen.observe(shop);
  gsap.ticker.add(frame);
}

if (still) staticLayout();
else init();

addEventListener('resize', resize);
if (shop3d) Promise.all([scene3d.ready, shop3d.ready]).then(() => {
  resize();
  canvas.classList.add('is-on');
  shop.classList.add('is-on');
});
