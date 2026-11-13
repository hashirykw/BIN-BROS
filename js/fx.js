/* Bin Bros v2 effects: soap-bubble field, scroll reveals, spotlight cards, click ripples */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer:fine)').matches;

  /* ---- scroll reveals ---- */
  const groups = [
    ['.sec-head > *, .ba-copy > *, .area-l > *, .about-copy > *, .contact-l > *, .gift-title, .gift-ctas', 'rv', .08],
    ['.ba-frame, .zip-card, .cform, .calc, .badge-wrap, .includes', 'rv', 0],
    ['.plans .plan', 'rv', .1],
    ['.bento .tile', 'rv', .08],
    ['.towns li, .includes li, .contact-list li, .foot-col', 'rv', .05],
    ['.foot-mark', 'rv-clip', 0]
  ];
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: .12 });
    groups.forEach(([sel, cls, step]) => {
      const seen = new Map();
      document.querySelectorAll(sel).forEach((el) => {
        if (el.closest('.hero')) return;
        const p = el.parentElement; const i = seen.get(p) || 0; seen.set(p, i + 1);
        el.classList.add(cls); el.style.setProperty('--d', (i * step).toFixed(2) + 's');
        io.observe(el);
      });
    });
  }

  /* ---- spotlight follow ---- */
  if (fine) {
    document.querySelectorAll('.plan, .tile, .zip-card, .calc').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    addEventListener('pointerdown', (e) => {
      if (reduce) return;
      const d = document.createElement('i'); d.className = 'bb-ripple';
      d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
      document.body.appendChild(d); setTimeout(() => d.remove(), 750);
    });
  }

  /* ---- soap bubbles rising over the 3D stage ---- */
  if (reduce || !fine) return;
  const stage = document.querySelector('.stage'); if (!stage) return;
  const c = document.createElement('canvas'); c.className = 'bb-bubbles'; c.setAttribute('aria-hidden', 'true');
  stage.appendChild(c);
  const ctx = c.getContext('2d'); let W, H, dpr, bubbles = [], run = true;
  const N = innerWidth < 760 ? 16 : 34;
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = c.width = innerWidth * dpr; H = c.height = innerHeight * dpr; c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px'; };
  const mk = (init) => ({ x: Math.random() * W, y: init ? Math.random() * H : H + 40 * dpr, r: (4 + Math.random() * 18) * dpr, v: (.25 + Math.random() * .7) * dpr, w: Math.random() * 6.28, a: .25 + Math.random() * .5 });
  size(); for (let i = 0; i < N; i++) bubbles.push(mk(true));
  addEventListener('resize', size);
  document.addEventListener('visibilitychange', () => { run = !document.hidden; if (run) requestAnimationFrame(tick); });
  function draw(b) {
    const g = ctx.createRadialGradient(b.x - b.r * .35, b.y - b.r * .35, b.r * .1, b.x, b.y, b.r);
    g.addColorStop(0, `rgba(255,255,255,${b.a * .55})`); g.addColorStop(.6, `rgba(111,224,255,${b.a * .08})`); g.addColorStop(1, `rgba(170,230,255,${b.a * .6})`);
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x - b.r * .38, b.y - b.r * .38, b.r * .18, 0, 6.283); ctx.fillStyle = `rgba(255,255,255,${b.a})`; ctx.fill();
  }
  function tick() {
    if (!run) return;
    ctx.clearRect(0, 0, W, H);
    const fade = Math.max(0, 1 - scrollY / (innerHeight * 2.2));
    ctx.globalAlpha = fade;
    if (fade > 0) for (const b of bubbles) {
      b.y -= b.v; b.w += .02; b.x += Math.sin(b.w) * .4 * dpr;
      if (b.y < -b.r * 2) Object.assign(b, mk(false));
      draw(b);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
