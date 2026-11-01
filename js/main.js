/* Bin Bros: interactions, scroll story, tools */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
root.classList.add('js');

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const mqMobile = matchMedia('(max-width: 960px)');
const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
}
$('#yr').textContent = new Date().getFullYear();

/* ---------- smooth scroll (desktop wheel only; touch stays native) ---------- */
let lenis = null;
if (!reduce && window.Lenis && gsap) {
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollToEl(el) {
  const y = el === document.body ? 0 : Math.max(0, el.getBoundingClientRect().top + window.scrollY - 70);
  if (lenis) lenis.scrollTo(y, { duration: 1.3, force: true });
  else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  const el = $(id);
  if (!el) return;
  e.preventDefault();
  const wasOpen = menuOpen;
  closeMenu();
  setTimeout(() => scrollToEl(id === '#top' ? document.body : el), wasOpen ? 120 : 0);
});

/* ---------- nav + mobile bar ---------- */
const nav = $('#nav'), mbar = $('#mbar');
let lastY = 0, menuOpen = false;
function onScroll() {
  const y = window.scrollY;
  nav.classList.toggle('scrolled', y > 30);
  const down = y > lastY + 4, up = y < lastY - 4;
  if (!menuOpen) {
    if (down && y > 160) nav.classList.add('hide');
    else if (up || y < 160) nav.classList.remove('hide');
  }
  mbar.classList.toggle('show', y > innerHeight * 0.45);
  lastY = y;
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- mobile dropdown menu ---------- */
const burger = $('.burger'), menu = $('#menu'), scrim = $('#menuScrim');
let menuTimer;
function openMenu() {
  clearTimeout(menuTimer);
  menuOpen = true; menu.hidden = false; scrim.hidden = false;
  nav.classList.remove('hide'); nav.classList.add('scrolled');
  requestAnimationFrame(() => requestAnimationFrame(() => { menu.classList.add('open'); scrim.classList.add('open'); }));
  burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu');
  lenis && lenis.stop();
}
function closeMenu() {
  if (!menuOpen) return;
  menuOpen = false; menu.classList.remove('open'); scrim.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu');
  menuTimer = setTimeout(() => { if (!menuOpen) { menu.hidden = true; scrim.hidden = true; } }, 450);
  lenis && lenis.start();
  onScroll();
}
burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
scrim.addEventListener('click', closeMenu);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
mqMobile.addEventListener('change', () => closeMenu());
window.__closeMenu = closeMenu;

/* ---------- hero headline split ---------- */
const h1 = $('[data-split]');
function splitWords(node) {
  [...node.childNodes].forEach((n) => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/([ \t\n\r]+)/).forEach((part) => {
        if (!part) return;
        if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.className = 'w';
        const wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = part;
        w.appendChild(wi); frag.appendChild(w);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1) splitWords(n);
  });
}
if (h1 && gsap && !reduce) {
  h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' '));
  splitWords(h1);
  $$('.w', h1).forEach((w) => w.setAttribute('aria-hidden', 'true'));
  gsap.from($$('.wi', h1), { yPercent: 110, duration: 1.0, ease: 'power4.out', stagger: 0.05, delay: 0.1 });
  gsap.from(['.hero .kicker', '.hero-sub', '.hero-ctas', '.hero-facts'], { y: 22, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, delay: 0.45, clearProps: 'transform,opacity' });
}

/* ---------- 3D stage: layout fitting ---------- */
// Constants mirror src/scene.js (camera z 7.2, fov 28 → world height at the bin plane)
const VIEW_H = 2 * 7.2 * Math.tan((28 / 2) * Math.PI / 180);
const FLOOR = -0.82, TOP_CLOSED = 0.92, TOP_OPEN = 2.0, BIN_W = 1.55;
const state = { xf: 0.23, yf: -0.02, scale: 1, spin: 0, tip: 0, lid: 0, grime: 0, wet: 0, foam: 0, burst: 0, spray: 0, steam: 0, zoom: 1 };

function fit(top, bottomPx, topPx, maxFrac, xf = 0, widthFrac = 0.62) {
  // place a bin whose world extent is [FLOOR, top] inside screen band [topPx, bottomPx]
  const H = innerHeight, ppu = H / VIEW_H;
  const avail = Math.max(120, bottomPx - topPx);
  const extent = top - FLOOR;
  let scale = (avail * maxFrac) / (extent * ppu);
  scale = Math.min(scale, (innerWidth * widthFrac) / (BIN_W * ppu));
  const midWorld = (top + FLOOR) / 2;
  const cy = (topPx + bottomPx) / 2;
  const yf = (H / 2 - cy) / H - (midWorld * scale) / VIEW_H;
  return { xf, yf, scale };
}
const layout = { hero: null, story: null, open: null };
function computeLayout() {
  const H = innerHeight;
  if (mqMobile.matches) {
    const copy = $('.hero-copy');
    const copyTop = copy ? copy.getBoundingClientRect().top + window.scrollY : H * 0.5;
    const navH = 68;
    layout.hero = fit(TOP_CLOSED, copyTop - 10, navH + 8, 0.92, 0, 0.6);
    const card = $('.how-copy');
    const cardH = card ? card.offsetHeight : 240;
    const cardTop = H - (96 + cardH);
    layout.story = fit(TOP_CLOSED, cardTop - 14, 18, 0.86, 0, 0.66);
    layout.open = fit(TOP_OPEN, cardTop - 10, 14, 0.94, 0, 0.66);
  } else {
    const wide = innerWidth / H;
    const xf = wide > 1.9 ? 0.25 : 0.22;
    layout.hero = fit(TOP_CLOSED, H * 0.86, H * 0.16, 0.92, xf, 0.36);
    layout.story = fit(TOP_CLOSED, H * 0.86, H * 0.14, 0.9, xf - 0.02, 0.36);
    layout.open = fit(TOP_OPEN, H * 0.92, H * 0.06, 0.96, xf - 0.02, 0.36);
  }
}
computeLayout();
Object.assign(state, layout.hero);

let scene = null;
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
const stageEl = $('.stage');
function syncStageVars() {
  const H = innerHeight, ppu = H / VIEW_H;
  const floorPx = H * (0.5 - state.yf) - FLOOR * state.scale * ppu;
  stageEl.style.setProperty('--bx', (state.xf * 100).toFixed(2) + '%');
  stageEl.style.setProperty('--by', (-state.yf * 100).toFixed(2) + '%');
  stageEl.style.setProperty('--fy', ((floorPx / H) * 100).toFixed(2) + '%');
}
syncStageVars();

async function bootScene() {
  if (!webglOK()) return;
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    const mod = await import('./scene.js');
    scene = await mod.initScene($('#bin3d'), state, { logo: 'assets/logo-400.webp' });
    root.classList.add('webgl');
    scene.start();
    stageWatch();
  } catch (err) {
    console.warn('3D scene unavailable', err);
  }
}
function stageWatch() {
  if (!ScrollTrigger) return;
  ScrollTrigger.create({
    trigger: '.how', start: 'bottom top',
    onEnter: () => scene && scene.stop(),
    onLeaveBack: () => scene && scene.start(),
  });
  document.addEventListener('visibilitychange', () => {
    if (!scene) return;
    if (document.hidden) scene.stop();
    else if ($('.how').getBoundingClientRect().bottom > 0) scene.start();
  });
}

/* ---------- scroll story ---------- */
const steps = $$('.step'), bars = $$('.how-progress span');
let activeStep = -1;
function setStep(i) {
  if (i === activeStep) return;
  activeStep = i;
  steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
}
function setProgress(p) {
  bars.forEach((b, k) => b.style.setProperty('--f', Math.min(1, Math.max(0, p * 3 - k)).toFixed(3)));
}
setStep(0);

function buildStory() {
  if (!gsap || !ScrollTrigger || reduce) {
    root.classList.add('no-pin');
    Object.assign(state, layout.hero);
    return;
  }
  const L = (k, prop) => () => layout[k][prop];
  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.8, invalidateOnRefresh: true } })
    .to(state, { xf: L('story', 'xf'), yf: L('story', 'yf'), scale: L('story', 'scale'), ease: 'none' }, 0);

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.how', pin: '.how-pin', start: 'top top', end: '+=270%', scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (self) => { setStep(Math.min(2, Math.floor(self.progress * 3 * 0.999))); setProgress(self.progress); },
    },
  });
  // 01: rolled out to the curb, a few weeks of grime
  tl.to(state, { tip: 1, duration: 0.25, ease: 'power2.out' }, 0.05)
    .to(state, { spin: -0.35, duration: 0.8, ease: 'power1.inOut' }, 0.05)
    .to(state, { grime: 1, duration: 0.5, ease: 'power1.inOut' }, 0.15)
    .to(state, { tip: 0, duration: 0.25, ease: 'power2.inOut' }, 0.55)
  // 02: lid up, hot high-pressure water + steam + foam, grime lifts, plastic goes wet
    .to(state, { xf: L('open', 'xf'), yf: L('open', 'yf'), scale: L('open', 'scale'), spin: 0.15, duration: 0.3, ease: 'power2.inOut' }, 1.0)
    .to(state, { lid: 1, duration: 0.25, ease: 'power2.out' }, 1.02)
    .to(state, { spray: 1, steam: 1, duration: 0.1 }, 1.14)
    .to(state, { foam: 1, duration: 0.15 }, 1.2)
    .to(state, { wet: 1, duration: 0.25 }, 1.25)
    .to(state, { grime: 0, duration: 0.55, ease: 'power1.in' }, 1.3)
    .to(state, { spray: 0, duration: 0.1 }, 1.84)
    .to(state, { steam: 0, duration: 0.2 }, 1.9)
  // 03: lid down, deodorized, foam drifts off, bin spins back into place, drying
    .to(state, { lid: 0, duration: 0.25, ease: 'power2.inOut' }, 2.0)
    .to(state, { xf: L('story', 'xf'), yf: L('story', 'yf'), scale: L('story', 'scale'), duration: 0.3, ease: 'power2.inOut' }, 2.0)
    .to(state, { foam: 0, duration: 0.2 }, 2.15)
    .to(state, { burst: 1, duration: 0.6, ease: 'power1.out' }, 2.15)
    .to(state, { spin: 0.15 + Math.PI * 2, duration: 0.75, ease: 'power2.inOut' }, 2.15)
    .to(state, { wet: 0.3, duration: 0.6 }, 2.3)
    .to({}, { duration: 0.1 }, 2.9);
}

/* ---------- reveal (IntersectionObserver; no transform conflicts) ---------- */
function reveals() {
  const groups = ['.ba-copy > *', '.ba-frame', '.sec-head > *', '.plan', '.includes', '.calc', '.tile', '.towns li', '.zip-card', '.badge-wrap', '.about-copy > *', '.gift-in > *', '.contact-l > *', '.cform', '.foot-grid > *'];
  const els = $$(groups.join(','));
  if (reduce || !('IntersectionObserver' in window)) return;
  els.forEach((el) => {
    el.classList.add('rv');
    const sibs = [...el.parentElement.children].filter((c) => els.includes(c));
    el.style.setProperty('--d', Math.min(sibs.indexOf(el), 6) * 0.07 + 's');
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add('in');
      io.unobserve(el);
      // hand transform back to hover effects once the reveal finishes
      setTimeout(() => { el.classList.remove('rv', 'in'); el.style.removeProperty('--d'); }, 1400);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((el) => io.observe(el));
}

/* ---------- ambient light: only animate while on screen ---------- */
if (!reduce && 'IntersectionObserver' in window) {
  const oio = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('live', e.isIntersecting)));
  $$('.orbs').forEach((o) => oio.observe(o));
}

/* ---------- before / after ---------- */
(function beforeAfter() {
  const sec = $('#results'), frame = $('#ba');
  if (!frame) return;
  const imgs = $$('.ba-img', frame);
  const kill = () => { if (!sec.isConnected) return; sec.remove(); ScrollTrigger && ScrollTrigger.refresh(); };
  imgs.forEach((im) => {
    im.addEventListener('error', kill, { once: true });
    if (im.complete && im.naturalWidth === 0 && im.currentSrc) kill();
  });
  const range = $('.ba-range', frame);
  const set = (v) => frame.style.setProperty('--p', v + '%');
  range.addEventListener('input', () => set(range.value));
  if (gsap && !reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      const o = { v: 50 };
      gsap.timeline({ delay: 0.3 }).to(o, { v: 76, duration: 0.8, ease: 'power2.inOut', onUpdate: () => set(o.v) })
        .to(o, { v: 50, duration: 1, ease: 'power3.inOut', onUpdate: () => { set(o.v); range.value = o.v; } });
    }, { threshold: 0.5 });
    io.observe(frame);
  }
})();

/* ---------- price calculator ---------- */
(function calc() {
  const seg = $$('.seg button'), out = $('#binCount'), total = $('#calcTotal'), brk = $('#calcBreak'), row = $('#binRow');
  const minus = $('.st-btn[data-d="-1"]'), plus = $('.st-btn[data-d="1"]');
  let base = 25, name = 'Monthly', bins = 2;
  const MIN = 2, MAX = 8, EXTRA = 10;
  const binSVG = (extra) => `<svg viewBox="0 0 40 58" class="${extra ? 'extra' : ''}"><rect class="lid" x="2" y="4" width="36" height="7" rx="2" fill="#9FCE10"/><path d="M5 13h30l-3 38a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" fill="#1F6BDB"/><path d="M14 20v26M20 20v26M26 20v26" stroke="#0150B4" stroke-width="2.2" stroke-linecap="round"/><circle cx="11" cy="54" r="3.4" fill="#0b1630"/><circle cx="29" cy="54" r="3.4" fill="#0b1630"/></svg>`;
  let shown = 0;
  function render(animate = true) {
    const price = base + Math.max(0, bins - 2) * EXTRA;
    const from = parseInt(total.textContent, 10) || price;
    if (gsap && animate && !reduce) {
      const o = { v: from };
      gsap.to(o, { v: price, duration: 0.5, ease: 'power2.out', onUpdate: () => (total.textContent = Math.round(o.v)) });
    } else total.textContent = price;
    out.textContent = bins;
    const extra = bins - 2;
    brk.textContent = `${name} · $${base} for 2 bins` + (extra > 0 ? ` + ${extra} extra × $${EXTRA}` : '');
    minus.disabled = bins <= MIN; plus.disabled = bins >= MAX;
    while (shown < bins) { row.insertAdjacentHTML('beforeend', binSVG(shown >= 2)); shown++; }
    while (shown > bins) { row.lastElementChild.remove(); shown--; }
  }
  seg.forEach((b) => b.addEventListener('click', () => {
    seg.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    base = +b.dataset.base; name = b.dataset.name; render();
  }));
  $('.seg').addEventListener('keydown', (e) => {
    const i = seg.findIndex((x) => x.getAttribute('aria-checked') === 'true');
    const go = (j) => { e.preventDefault(); seg[j].click(); seg[j].focus(); };
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go((i + 1) % seg.length);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go((i + seg.length - 1) % seg.length);
  });
  $$('.st-btn').forEach((b) => b.addEventListener('click', () => { bins = Math.min(MAX, Math.max(MIN, bins + +b.dataset.d)); render(); }));
  render(false);
})();

/* ---------- ZIP checker ---------- */
export const ZIPS = { 23693: 'Yorktown', 23692: 'Yorktown', 23690: 'Yorktown', 23696: 'Seaford', 23662: 'Poquoson', 23185: 'Williamsburg', 23666: 'Hampton', 23608: 'Newport News' };
(function zip() {
  const form = $('#zipForm'), input = $('#zip'), res = $('#zipResult'), chips = $$('.zip-list li');
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 5); });
  chips.forEach((c) => c.addEventListener('click', () => { input.value = c.dataset.zip; form.requestSubmit(); }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const z = input.value.trim();
    chips.forEach((c) => c.classList.toggle('hit', c.dataset.zip === z));
    if (!/^\d{5}$/.test(z)) { res.className = 'zip-result no'; res.textContent = 'Enter a 5-digit ZIP code.'; return; }
    if (ZIPS[z]) {
      res.className = 'zip-result ok';
      res.innerHTML = `Good news: we serve ${z} (${ZIPS[z]}). <a href="http://binbrosva.jobatory.com/home" target="_blank" rel="noopener">Schedule your first clean →</a>`;
    } else {
      res.className = 'zip-result no';
      res.innerHTML = `${z} isn't on our list yet, but we may still reach your street. <a href="tel:+17572408445">Call (757) 240-8445</a> to check.`;
    }
  });
})();

/* ---------- contact form → email ---------- */
(function contact() {
  const f = $('#cform'), note = $('#fnote');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    $$('[required]', f).forEach((el) => {
      const bad = !el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value));
      el.classList.toggle('invalid', bad); if (bad) ok = false;
    });
    if (!ok) { note.textContent = 'Please fill in your name, phone, email and address.'; note.style.color = '#ffb3a8'; return; }
    const d = Object.fromEntries(new FormData(f));
    const body = `Name: ${d.name}\nPhone: ${d.phone}\nEmail: ${d.email}\nAddress: ${d.address}\n\n${d.details || ''}`;
    location.href = `mailto:BinBrosSupport@gmail.com?subject=${encodeURIComponent('Bin cleaning inquiry from ' + d.name)}&body=${encodeURIComponent(body)}`;
    note.style.color = ''; note.textContent = "Thanks for your message! Your email app should open now. We'll get back to you as soon as we can.";
  });
  $$('input,textarea', f).forEach((el) => el.addEventListener('input', () => el.classList.remove('invalid')));
})();

/* ---------- 3D tilt + magnetic (desktop only) ---------- */
if (fine && !reduce) {
  $$('.tilt').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      if (card.classList.contains('rv')) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-6px)`;
    });
    card.addEventListener('pointerleave', () => (card.style.transform = ''));
  });
  const about = $('.about'), badge = $('.badge-img');
  about.addEventListener('pointermove', (e) => {
    const r = badge.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / innerWidth, y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
    badge.style.transform = `rotateY(${x * 26}deg) rotateX(${-y * 26}deg)`;
  });
  about.addEventListener('pointerleave', () => (badge.style.transform = ''));
  if (gsap) $$('.magnetic').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      gsap.to(btn, { x: (e.clientX - r.left - r.width / 2) * 0.22, y: (e.clientY - r.top - r.height / 2) * 0.32, duration: 0.3 });
    });
    btn.addEventListener('pointerleave', () => gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,.45)' }));
  });
}

/* ---------- boot ---------- */
buildStory();
reveals();
if (gsap) gsap.ticker.add(syncStageVars); else syncStageVars();
bootScene();
let rT;
addEventListener('resize', () => {
  clearTimeout(rT);
  rT = setTimeout(relayout, 200);
});
function relayout() {
  computeLayout();
  if (window.scrollY < 10) Object.assign(state, layout.hero);
  ScrollTrigger && ScrollTrigger.refresh();
}
if (document.fonts) document.fonts.ready.then(relayout);
addEventListener('load', relayout);
