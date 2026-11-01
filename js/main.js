/* Bin Bros: interactions, scroll story, tools */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
root.classList.add('js');

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const mqMobile = matchMedia('(max-width: 960px)');
const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
$('#yr').textContent = new Date().getFullYear();

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduce && window.Lenis && gsap) {
  lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true });
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
  closeMenu();
  scrollToEl(id === '#top' ? document.body : el);
});

/* ---------- nav ---------- */
const nav = $('#nav'), mbar = $('#mbar');
let lastY = 0, menuOpen = false;
function onScroll() {
  const y = window.scrollY;
  nav.classList.toggle('scrolled', y > 40);
  const goingDown = y > lastY + 4, goingUp = y < lastY - 4;
  if (!menuOpen) {
    if (goingDown && y > 160) nav.classList.add('hide');
    else if (goingUp || y < 160) nav.classList.remove('hide');
  }
  mbar.classList.toggle('show', y > innerHeight * 0.55);
  lastY = y;
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- mobile menu ---------- */
const burger = $('.burger'), menu = $('#menu');
function openMenu() {
  menuOpen = true; menu.hidden = false;
  requestAnimationFrame(() => menu.classList.add('open'));
  burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu');
  nav.classList.remove('hide');
  document.body.style.overflow = 'hidden';
}
function closeMenu() {
  if (!menuOpen) return;
  menuOpen = false; menu.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu');
  setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 700);
  document.body.style.overflow = '';
}
burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

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
  h1.setAttribute('aria-label', h1.textContent);
  splitWords(h1);
  $$('.w', h1).forEach((w) => w.setAttribute('aria-hidden', 'true'));
  gsap.from($$('.wi', h1), { yPercent: 115, rotate: 4, duration: 1.05, ease: 'power4.out', stagger: 0.055, delay: 0.15 });
  gsap.from(['.hero .kicker', '.hero-sub', '.hero-ctas', '.hero-facts', '.hero-tag'], { y: 24, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 0.5 });
}

/* ---------- 3D stage ---------- */
const state = { xf: 0.22, yf: -0.02, scale: 1, spin: 0, tilt: 0, lid: 0, grime: 0, spray: 0, steam: 0, burst: 0, sparkle: 0, bubbles: 1, zoom: 1 };
const layouts = {
  desk: { hero: { xf: 0.23, yf: -0.03, scale: 1.0 }, story: { xf: 0.2, yf: -0.07, scale: 1.05 } },
  mob: { hero: { xf: 0.0, yf: -0.355, scale: 0.42 }, story: { xf: 0.0, yf: 0.13, scale: 0.68 } },
};
const L = () => (mqMobile.matches ? layouts.mob : layouts.desk);
Object.assign(state, L().hero);

let scene = null;
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
const stageEl = $('.stage');
function syncStageVars() {
  stageEl.style.setProperty('--bx', (state.xf * 100).toFixed(2) + '%');
  stageEl.style.setProperty('--by', (-state.yf * 100).toFixed(2) + '%');
}
syncStageVars();

async function bootScene() {
  if (!webglOK()) return;
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    const mod = await import('./scene.js');
    scene = await mod.initScene($('#bin3d'), state);
    root.classList.add('webgl');
    scene.start();
    stageWatch();
  } catch (err) {
    console.warn('3D scene unavailable', err);
  }
}

function stageWatch() {
  // Render only while the stage is visible (hero + how section)
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
const steps = $$('.step'), railFill = $('.how-rail-fill');
let activeStep = 0;
function setStep(i) {
  if (i === activeStep) return;
  activeStep = i;
  steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
  const pct = ((i + 1) / steps.length) * 100 + '%';
  if (mqMobile.matches) { railFill.style.width = pct; railFill.style.height = ''; }
  else { railFill.style.height = pct; railFill.style.width = ''; }
}

function buildStory() {
  if (!gsap || !ScrollTrigger || reduce) {
    root.classList.add('no-pin');
    Object.assign(state, L().story, { grime: 0, sparkle: 0.6, bubbles: 1 });
    return;
  }
  const mm = gsap.matchMedia();
  mm.add({ mob: '(max-width: 960px)', desk: '(min-width: 961px)' }, (ctx) => {
    const lay = ctx.conditions.mob ? layouts.mob : layouts.desk;
    Object.assign(state, lay.hero);

    // hero -> story placement while the hero scrolls away
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.8 } })
      .to(state, { ...lay.story, ease: 'none' }, 0);

    // pinned 3-step story
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '.how', pin: '.how-pin', start: 'top top', end: '+=260%', scrub: 0.9, anticipatePin: 1,
        onUpdate: (self) => setStep(Math.min(2, Math.floor(self.progress * 3 * 0.999))),
      },
    });
    // 01: bins at the curb, a month of grime
    tl.to(state, { grime: 1, duration: 0.6, ease: 'power1.inOut' }, 0.05)
      .to(state, { spin: -0.5, tilt: 0.04, duration: 0.9 }, 0)
    // 02: lid opens, hot water + steam, grime washes off
      .to(state, { lid: 1, duration: 0.25, ease: 'power2.out' }, 1.0)
      .to(state, { spin: 0.25, tilt: 0.2, scale: lay.story.scale * 0.84, yf: lay.story.yf - 0.06, duration: 0.4 }, 1.0)
      .to(state, { spray: 1, steam: 1, duration: 0.12 }, 1.12)
      .to(state, { grime: 0, duration: 0.55, ease: 'power1.in' }, 1.3)
      .to(state, { spray: 0, duration: 0.12 }, 1.82)
      .to(state, { steam: 0, duration: 0.25 }, 1.9)
    // 03: lid shuts, deodorized, bubbles + sparkles, spin back into place
      .to(state, { lid: 0, tilt: 0, zoom: 1, scale: lay.story.scale, yf: lay.story.yf, duration: 0.3, ease: 'power2.inOut' }, 2.0)
      .to(state, { burst: 1, duration: 0.6, ease: 'power1.out' }, 2.2)
      .to(state, { sparkle: 1, duration: 0.3 }, 2.2)
      .to(state, { spin: 0.25 + Math.PI * 2, duration: 0.75, ease: 'power2.inOut' }, 2.15)
      .to({}, { duration: 0.1 }, 2.9);

    return () => { setStep(0); };
  });
}

/* ---------- reveal ---------- */
function reveals() {
  const targets = ['.ba-copy > *', '.ba-frame', '.sec-head > *', '.plan', '.calc', '.tile', '.towns li', '.zip-card', '.badge-wrap', '.about-copy > *', '.gift-in > *', '.contact-l > *', '.cform', '.foot-grid > *'];
  const els = $$(targets.join(','));
  if (!gsap || !ScrollTrigger || reduce) return;
  els.forEach((el) => el.setAttribute('data-reveal', ''));
  ScrollTrigger.batch(els, {
    start: 'top 88%',
    once: true,
    onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, overwrite: true }),
  });
}

/* ---------- before / after ---------- */
(function beforeAfter() {
  const sec = $('#results'), frame = $('#ba');
  if (!frame) return;
  const imgs = $$('.ba-img', frame);
  const kill = () => { sec.remove(); ScrollTrigger && ScrollTrigger.refresh(); };
  imgs.forEach((im) => {
    im.addEventListener('error', kill, { once: true });
    if (im.complete && im.naturalWidth === 0 && im.currentSrc) kill();
  });
  const range = $('.ba-range', frame);
  const set = (v) => frame.style.setProperty('--p', v + '%');
  range.addEventListener('input', () => set(range.value));
  // gentle intro sweep once in view
  if (gsap && ScrollTrigger && !reduce) {
    const o = { v: 50 };
    ScrollTrigger.create({
      trigger: frame, start: 'top 70%', once: true,
      onEnter: () => gsap.timeline().to(o, { v: 78, duration: 0.8, ease: 'power2.inOut', onUpdate: () => set(o.v) })
        .to(o, { v: 50, duration: 1, ease: 'power3.inOut', onUpdate: () => { set(o.v); range.value = o.v; } }),
    });
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
    // bins row: add/remove without re-animating existing ones
    while (shown < bins) { row.insertAdjacentHTML('beforeend', binSVG(shown >= 2)); shown++; }
    while (shown > bins) { row.lastElementChild.remove(); shown--; }
  }
  seg.forEach((b) => b.addEventListener('click', () => {
    seg.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    base = +b.dataset.base; name = b.dataset.name; render();
  }));
  // arrow keys inside radiogroup
  $('.seg').addEventListener('keydown', (e) => {
    const i = seg.findIndex((x) => x.getAttribute('aria-checked') === 'true');
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); seg[(i + 1) % seg.length].click(); seg[(i + 1) % seg.length].focus(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); seg[(i + seg.length - 1) % seg.length].click(); seg[(i + seg.length - 1) % seg.length].focus(); }
  });
  $$('.st-btn').forEach((b) => b.addEventListener('click', () => {
    bins = Math.min(MAX, Math.max(MIN, bins + +b.dataset.d)); render();
  }));
  render(false);
})();

/* ---------- ZIP checker ---------- */
(function zip() {
  const ZIPS = { 23693: 'Yorktown', 23692: 'Yorktown', 23690: 'Yorktown', 23696: 'Seaford', 23662: 'Poquoson', 23185: 'Williamsburg', 23666: 'Hampton', 23608: 'Newport News' };
  const form = $('#zipForm'), input = $('#zip'), res = $('#zipResult'), chips = $$('.zip-list li');
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 5); });
  chips.forEach((c) => { c.style.cursor = 'pointer'; c.addEventListener('click', () => { input.value = c.dataset.zip; form.requestSubmit(); }); });
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
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateY(-6px)`;
    });
    card.addEventListener('pointerleave', () => (card.style.transform = ''));
  });
  const about = $('.about'), badge = $('.badge-img');
  about.addEventListener('pointermove', (e) => {
    const r = badge.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / innerWidth, y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
    badge.style.transform = `rotateY(${x * 28}deg) rotateX(${-y * 28}deg)`;
  });
  about.addEventListener('pointerleave', () => (badge.style.transform = ''));
  if (gsap) $$('.magnetic').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      gsap.to(btn, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.3 });
    });
    btn.addEventListener('pointerleave', () => gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,.45)' }));
  });
}

/* ---------- boot ---------- */
buildStory();
reveals();
if (gsap) gsap.ticker.add(syncStageVars); else syncStageVars();
bootScene();
if (document.fonts) document.fonts.ready.then(() => ScrollTrigger && ScrollTrigger.refresh());
addEventListener('load', () => ScrollTrigger && ScrollTrigger.refresh());
