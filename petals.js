/* 梅 — an ink plum branch in the masthead corner, and a few petals drifting down through it.
   Vanilla canvas, no dependencies, no network. Static under prefers-reduced-motion; petals hidden in print. */
(function () {
  const host = document.querySelector('.masthead');
  if (!host) return;

  // ---- ink branch (SVG) ----
  const branch = document.createElement('div');
  branch.className = 'branch';
  branch.setAttribute('aria-hidden', 'true');
  branch.innerHTML = `
  <svg viewBox="0 0 420 240" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <g id="mei">
        <g fill="#c2485d" opacity=".92">
          <circle cx="0" cy="-5.2" r="4.1"/><circle cx="4.9" cy="-1.6" r="4.1"/><circle cx="3.1" cy="4.2" r="4.1"/>
          <circle cx="-3.1" cy="4.2" r="4.1"/><circle cx="-4.9" cy="-1.6" r="4.1"/>
        </g>
        <circle r="1.9" fill="#f4e6bf"/>
        <g stroke="#f4e6bf" stroke-width=".7" stroke-linecap="round">
          <line x1="0" y1="0" x2="0" y2="-3.4"/><line x1="0" y1="0" x2="2.8" y2="-1.4"/><line x1="0" y1="0" x2="-2.8" y2="-1.4"/>
          <line x1="0" y1="0" x2="1.8" y2="2.6"/><line x1="0" y1="0" x2="-1.8" y2="2.6"/>
        </g>
      </g>
      <g id="bud"><circle r="2.6" fill="#b3331d" opacity=".9"/><circle cx="-1" cy="-1" r="1" fill="#e07d8f"/></g>
    </defs>
    <g fill="none" stroke="#2a2420" stroke-linecap="round" stroke-linejoin="round">
      <path d="M420 34 C 372 44, 330 56, 292 84 S 214 150, 166 150" stroke-width="5.2" opacity=".92"/>
      <path d="M170 150 C 138 150, 112 164, 84 190 S 44 222, 22 226" stroke-width="2.6" opacity=".85"/>
      <path d="M292 84 C 280 66, 276 50, 284 28" stroke-width="2.2" opacity=".85"/>
      <path d="M236 122 C 226 106, 226 92, 236 78" stroke-width="1.7" opacity=".8"/>
      <path d="M350 52 C 356 40, 368 30, 386 22" stroke-width="1.8" opacity=".8"/>
      <path d="M118 166 C 108 152, 110 140, 120 130" stroke-width="1.4" opacity=".75"/>
      <path d="M60 206 C 58 194, 64 184, 74 178" stroke-width="1.2" opacity=".7"/>
    </g>
    <use href="#mei" transform="translate(284 26) scale(1.15)"/>
    <use href="#mei" transform="translate(238 76) scale(.95)"/>
    <use href="#mei" transform="translate(388 20) scale(1.05)"/>
    <use href="#mei" transform="translate(206 146) scale(1.1)"/>
    <use href="#mei" transform="translate(121 128) scale(.9)"/>
    <use href="#mei" transform="translate(74 176) scale(1)"/>
    <use href="#mei" transform="translate(318 66) scale(.8)"/>
    <use href="#bud" transform="translate(262 100)"/>
    <use href="#bud" transform="translate(356 46)"/>
    <use href="#bud" transform="translate(96 180)"/>
    <use href="#bud" transform="translate(150 152)"/>
  </svg>`;
  host.prepend(branch);

  // ---- drifting petals (canvas) ----
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const c = document.createElement('canvas');
  c.className = 'petals';
  c.setAttribute('aria-hidden', 'true');
  host.prepend(c);
  const ctx = c.getContext('2d');
  const cols = ['#c94a5e', '#d97a8b', '#e9a7b3', '#b3331d'];
  let W = 0, H = 0, t = 0;
  const P = [];

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = host.clientWidth; H = host.clientHeight;
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = W + 'px'; c.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawn(p, fromTop) {
    p.x = Math.random() * W; p.y = fromTop ? -14 : Math.random() * H;
    p.s = 4.5 + Math.random() * 4.5;
    p.vy = 0.22 + Math.random() * 0.38; p.vx = -0.12 + Math.random() * 0.24;
    p.r = Math.random() * Math.PI * 2; p.vr = (Math.random() - 0.5) * 0.02;
    p.ph = Math.random() * Math.PI * 2;
    p.col = cols[(Math.random() * cols.length) | 0]; p.a = 0.5 + Math.random() * 0.35;
    return p;
  }
  function petal(p) {
    const s = p.s;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
    ctx.globalAlpha = p.a; ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.95, -s * 0.55, s * 0.9, s * 0.55, 0.9, s * 0.95);   // right lobe → notch
    ctx.bezierCurveTo(0, s * 0.6, 0, s * 0.6, -0.9, s * 0.95);
    ctx.bezierCurveTo(-s * 0.9, s * 0.55, -s * 0.95, -s * 0.55, 0, -s);
    ctx.fill(); ctx.restore();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of P) petal(p);
  }
  function step() {
    t++;
    for (const p of P) {
      p.x += p.vx + Math.sin(t * 0.012 + p.ph) * 0.28;
      p.y += p.vy; p.r += p.vr;
      if (p.y > H + 16 || p.x < -24 || p.x > W + 24) spawn(p, true);
    }
    draw();
    if (!document.hidden) requestAnimationFrame(step); else setTimeout(step, 400);
  }

  size();
  const n = W < 720 ? 9 : 14;
  for (let i = 0; i < n; i++) P.push(spawn({}, false));
  if ('ResizeObserver' in window) new ResizeObserver(size).observe(host); else window.addEventListener('resize', size);
  if (reduce) draw(); else requestAnimationFrame(step);
})();
