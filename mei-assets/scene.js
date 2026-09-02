/* ====================================================================== *
 * 梅 — a night plum bough, grown rather than photographed.
 *
 * Adapted from the Sylva living-world scene. The limb sweep, survey pulse,
 * dock, parallax, portal reveal and butterfly are carried over; the moss
 * cushion, fur and ferns are gone, and in their place the bough carries
 * blossoms and buds, and the air carries a slow fall of petals.
 * ====================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── pointer parallax ─────────────────────────────────────────────── */
  var PARALLAX = '.headline,.lede,.pill,.card--about';

  var pointer = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  var heroEl = document.getElementById('hero');
  var lastX = null, lastY = null;
  var ticking = false, parOn = false;

  function startTick() {
    if (ticking) return;
    ticking = true;
    (function loop() { requestAnimationFrame(loop); tick(); })();
  }

  var lastTick = 0;
  function tick() {
    var now = performance.now();
    var dtUI = lastTick ? Math.min((now - lastTick) / 1000, 0.05) : 0.016;
    lastTick = now;
    drawDock(dtUI);
    drawSpec(dtUI);
    aimMoved = false;
    if (parOn) {
      smooth.x += (pointer.x - smooth.x) * 0.055;
      smooth.y += (pointer.y - smooth.y) * 0.055;
      var nx = Math.round(smooth.x * 1000) / 1000, ny = Math.round(smooth.y * 1000) / 1000;
      if (nx !== lastX || ny !== lastY) {
        lastX = nx; lastY = ny;
        heroEl.style.setProperty('--px', nx);
        heroEl.style.setProperty('--py', ny);
      }
    }
    if (renderer && clock) renderFrame();
  }

  function startParallax() {
    startTick();
    if (REDUCED || parOn) return;
    parOn = true;
    var nodes = document.querySelectorAll(PARALLAX);
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.add('par');

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      var r = hero.getBoundingClientRect();
      ndc.x =  ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    }, { passive: true });

    window.addEventListener('pointerleave', function () {
      pointer.x = pointer.y = 0; ndc.x = 10;
    });
  }

  var canvas   = document.getElementById('scene');
  var hero     = document.getElementById('hero');
  var stageEl  = document.getElementById('stage');
  var NARROW   = window.matchMedia('(max-width: 900px)');

  /* ── where the two boughs sit on the 1600 × 880 reference frame ───── */
  var ARCH   = { w: 1900, left: -180, top: 306, aspect: 2800 / 1377 };
  var ARCH_N = { w: 1120, left: -290, top: 555, aspect: 2800 / 1377 };
  var FAR    = { w: 1150, left:  -40, top: 320, aspect: 1600 /  757, z: -260 };
  var FAR_N  = { w:  780, left: -110, top: 600, aspect: 1600 /  757, z: -260 };

  var renderer, scene, camera;
  var nearGroup, farGroup, motes, shadowMesh, glowMesh;
  var W = 1, H = 1, DIST = 1400;
  var petalTex = null;
  var scanning = false, scanT = 0, scanMax = 3000, scanStart = 0;
  var SCAN_DUR = 3.4;
  var clock = null;
  var readyStarted = false;

  /* ── plate transmission ───────────────────────────────────────────── */
  var CUT_STEPS = 12, CUT_MS = 1450;
  var portalStarted = false;

  function startPortalReveal() {
    if (REDUCED || portalStarted) return;
    portalStarted = true;
    var figs = document.querySelectorAll('.portal');
    for (var i = 0; i < figs.length; i++) revealPortal(figs[i]);
  }

  function revealPortal(fig) {
    var img = fig.querySelector('img');
    var canvasEl = fig.querySelector('.pixel-reveal');
    var media = fig.querySelector('.portal-media');
    if (!img || !canvasEl || !media) return;

    var delay = parseFloat(fig.getAttribute('data-delay')) || 1080;

    function launch() {
      setTimeout(function () {
        var box = canvasEl.getBoundingClientRect();
        if (!box.width || !box.height) return;

        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvasEl.width = Math.max(1, Math.round(box.width * dpr));
        canvasEl.height = Math.max(1, Math.round(box.height * dpr));
        var ctx = canvasEl.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        var cols = 52;
        var rows = Math.max(18, Math.round(cols * box.height / box.width));

        var sample = document.createElement('canvas');
        sample.width = cols; sample.height = rows;
        var sg = sample.getContext('2d', { willReadFrequently:true });
        var rgba = null;
        try {
          sg.drawImage(img, 0, 0, cols, rows);
          rgba = sg.getImageData(0, 0, cols, rows).data;
        } catch (err) { /* file:// — fall back to the pale plum tone */ }

        var over = -media.offsetLeft;
        var span = media.offsetWidth;
        var reach = box.width;

        canvasEl.style.opacity = '1';
        var startedAt = performance.now();

        function paint(now) {
          var t = Math.min(1, (now - startedAt) / CUT_MS);
          var stepped = Math.floor(t * CUT_STEPS) / CUT_STEPS;
          var front = (stepped * span - over) / reach;
          var tailFade = t < .88 ? 1 : (1 - t) / .12;
          ctx.clearRect(0, 0, box.width, box.height);

          for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
              var an = (x + .5) / cols;
              var delta = an - front;
              if (delta < -.16 || delta > .16) continue;

              var band = 1 - Math.abs(delta) / .16;
              var pulse = .68 + .32 * Math.sin(x * 2.71 + y * 1.93 + t * 26);
              var alpha = Math.max(0, band * pulse * tailFade);
              if (alpha < .08) continue;

              var r = 244, g = 206, b = 212;
              if (rgba) {
                var q = (y * cols + x) * 4;
                r = Math.min(255, rgba[q] * 1.18 + 24);
                g = Math.min(255, rgba[q + 1] * 1.12 + 14);
                b = Math.min(255, rgba[q + 2] * 1.14 + 18);
              }

              var px = (x + .5) * box.width / cols;
              var py = (y + .5) * box.height / rows;
              var jitter = (1 - band) * 5;
              px += Math.sin(y * 3.17 + x) * jitter;
              py += Math.cos(x * 2.41 - y) * jitter;
              var radius = (.55 + band * 1.25) * Math.max(.75, reach / 300);

              ctx.fillStyle = 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + (alpha * .92) + ')';
              ctx.beginPath();
              ctx.arc(px, py, radius, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          if (t < 1) requestAnimationFrame(paint);
          else {
            ctx.clearRect(0, 0, box.width, box.height);
            canvasEl.style.opacity = '0';
          }
        }
        requestAnimationFrame(paint);
      }, delay);
    }

    if (img.complete && img.naturalWidth) launch();
    else img.addEventListener('load', launch, { once:true });
  }

  /* ── the dock ─────────────────────────────────────────────────────── */
  var DOCK = { root: null, items: [], on: false, live: false, key: false, dirty: false, u: 1 };
  var SPEC = { items: [], on: false, dirty: false };
  var aimX = 0, aimY = 0, aimSeen = false, aimMoved = false;

  function fineHover() {
    return !REDUCED && window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  }

  function measureDock() {
    if (!DOCK.root) return;
    DOCK.on = fineHover();
    DOCK.u = stageEl.getBoundingClientRect().width / (NARROW.matches ? 760 : 1600);
    for (var i = 0; i < DOCK.items.length; i++) {
      var st = DOCK.items[i];
      st.el.style.width = st.el.style.height = st.el.style.transform = '';
      st.el.dataset.near = 'false';
      st.v = st.vel = st.target = 0;
    }
    for (i = 0; i < DOCK.items.length; i++) {
      var r = DOCK.items[i].el.getBoundingClientRect();
      DOCK.items[i].w = r.width;
      DOCK.items[i].h = r.height;
    }
    DOCK.live = false;
    DOCK.dirty = true;
    aimMoved = aimSeen;
  }

  function dockRest() {
    DOCK.live = false;
    DOCK.dirty = true;
    for (var i = 0; i < DOCK.items.length; i++) {
      DOCK.items[i].target = 0;
      DOCK.items[i].el.dataset.near = 'false';
    }
  }

  function drawDock(dt) {
    if (!DOCK.root || !DOCK.on) return;

    if (aimSeen && aimMoved && !DOCK.key) {
      var rr = DOCK.root.getBoundingClientRect();
      if (aimX > rr.left - 48 && aimX < rr.right + 48 && aimY > rr.top - 44 && aimY < rr.bottom + 104) {
        for (var i = 0; i < DOCK.items.length; i++) {
          var st = DOCK.items[i], r = st.el.getBoundingClientRect();
          var prox = clamp01(1 - Math.abs(aimX - (r.left + r.width * 0.5)) / (128 * DOCK.u));
          st.target = prox * prox * (3 - 2 * prox);
          st.el.dataset.near = st.target > 0.08 ? 'true' : 'false';
        }
        DOCK.live = true;
        DOCK.dirty = true;
      } else if (DOCK.live) dockRest();
    }

    if (!DOCK.dirty) return;
    var moving = false;
    for (i = 0; i < DOCK.items.length; i++) {
      st = DOCK.items[i];
      st.vel += (st.target - st.v) * 190 * dt;
      st.vel *= Math.exp(-23 * dt);
      st.v += st.vel * dt;
      if (Math.abs(st.target - st.v) < 0.001 && Math.abs(st.vel) < 0.004) { st.v = st.target; st.vel = 0; }
      else moving = true;

      var v = Math.min(Math.max(st.v, 0), 1.08);
      var mark = st.el.classList.contains('dock-mark');
      var ew = mark ? 14 * DOCK.u : Math.min(18 * DOCK.u, st.w * 0.24);
      var eh = mark ? 14 * DOCK.u : 16 * DOCK.u;
      st.el.style.width = (st.w + ew * v).toFixed(2) + 'px';
      st.el.style.height = (st.h + eh * v).toFixed(2) + 'px';
      st.el.style.transform = 'translateY(' + (v * 3.5 * DOCK.u).toFixed(2) + 'px)';
    }
    if (!moving) DOCK.dirty = false;
  }

  function drawSpec(dt) {
    if (!SPEC.on) return;

    if (aimSeen && aimMoved) {
      for (var i = 0; i < SPEC.items.length; i++) {
        var st = SPEC.items[i], r = st.el.getBoundingClientRect();
        var cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.5;
        var dx = Math.max(r.left - aimX, 0, aimX - r.right);
        var dy = Math.max(r.top - aimY, 0, aimY - r.bottom);
        var d = Math.sqrt(dx * dx + dy * dy);
        st.tAng = d === 0
          ? Math.atan2(2 / Math.max(r.height, 1), -2 / Math.max(r.width, 1)) +
            ((aimX - cx) / Math.max(r.width * 0.5, 1)) * 0.30 +
            ((cy - aimY) / Math.max(r.height * 0.5, 1)) * 0.15
          : Math.atan2(cy - aimY, aimX - cx);
        var raw = clamp01(1 - d / (st.reach * DOCK.u));
        st.tBr = Math.max(raw * raw * (3 - 2 * raw), st.focused ? 0.9 : 0);
      }
      SPEC.dirty = true;
    }

    if (!SPEC.dirty) return;
    var moving = false;
    for (i = 0; i < SPEC.items.length; i++) {
      st = SPEC.items[i];
      var diff = ((st.tAng - st.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      st.ang += diff * (1 - Math.exp(-dt * 8));
      st.br += (st.tBr - st.br) * (1 - Math.exp(-dt * 9));
      if (Math.abs(diff) < 0.001 && Math.abs(st.tBr - st.br) < 0.002) { st.ang = st.tAng; st.br = st.tBr; }
      else moving = true;
      st.el.style.setProperty('--spec-angle', st.ang.toFixed(4) + 'rad');
      st.el.style.setProperty('--spec-bright', (clamp01(st.br) * 0.92).toFixed(3));
    }
    if (!moving) SPEC.dirty = false;
  }

  function initDock() {
    var root = document.querySelector('.dock');
    if (!root) return;
    DOCK.root = root;
    DOCK.items = [].map.call(root.querySelectorAll('[data-dock]'), function (el) {
      return { el: el, w: 0, h: 0, v: 0, vel: 0, target: 0 };
    });
    SPEC.items = [].map.call(document.querySelectorAll('[data-spec]'), function (el) {
      return { el: el, ang: 2.4, tAng: 2.4, br: 0, tBr: 0, focused: false,
               reach: el.classList.contains('dock') ? 250 : 185 };
    });
    SPEC.on = fineHover();

    measureDock();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureDock);
    window.addEventListener('resize', measureDock);

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      aimX = e.clientX; aimY = e.clientY; aimSeen = true; aimMoved = true; DOCK.key = false;
      DOCK.dirty = SPEC.dirty = true;
    }, { passive: true });

    window.addEventListener('pointerleave', function () {
      aimSeen = false;
      dockRest();
      for (var i = 0; i < SPEC.items.length; i++) SPEC.items[i].tBr = SPEC.items[i].focused ? 0.9 : 0;
      SPEC.dirty = true;
    });

    root.addEventListener('focusin', function (e) {
      var item = e.target.closest('[data-dock]');
      if (!item || !DOCK.on) return;
      var idx = DOCK.items.map(function (st) { return st.el; }).indexOf(item);
      DOCK.items.forEach(function (st, i) {
        st.target = i === idx ? 1 : Math.abs(i - idx) === 1 ? 0.24 : 0;
        st.el.dataset.near = st.target > 0.08 ? 'true' : 'false';
      });
      DOCK.live = false; DOCK.key = true; DOCK.dirty = true;
    });
    root.addEventListener('focusout', function () {
      requestAnimationFrame(function () {
        if (!root.contains(document.activeElement)) { DOCK.key = false; dockRest(); }
      });
    });
    for (var i = 0; i < SPEC.items.length; i++) (function (st) {
      st.el.addEventListener('focusin', function () { st.focused = true; SPEC.dirty = true; });
      st.el.addEventListener('focusout', function () { st.focused = false; SPEC.dirty = true; });
    })(SPEC.items[i]);

    /* the pill throws a handful of petals; real links still navigate */
    root.addEventListener('click', function (e) {
      var item = e.target.closest('[data-dock]');
      if (!item) return;
      var href = item.getAttribute('href') || '#';
      if (href === '#') e.preventDefault();
      if (!item.classList.contains('dock-mark') && href.charAt(0) === '#') {
        for (var i = 0; i < DOCK.items.length; i++) DOCK.items[i].el.classList.remove('is-active');
        item.classList.add('is-active');
      }
      burstAt(e.clientX, e.clientY);
    });
  }

  function ready() {
    if (readyStarted) return;
    readyStarted = true;
    void document.body.offsetHeight;
    document.body.classList.add('is-ready');
    startParallax();
    startPortalReveal();
    initDock();
    setTimeout(function () { document.body.classList.add('intro-done'); }, REDUCED ? 0 : 2900);
  }

  var ndc = { x: 10, y: 10 };

  if (!window.THREE) { ready(); return; }

  /* ================================================================== *
   * deterministic noise — the same bough grows on every reload
   * ================================================================== */
  var rng = (function () {
    var a = 0x2e7d1a4f;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  function rand(lo, hi) { return lo + (hi - lo) * rng(); }
  function sstep(a, b, x) { var t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); }
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  function hash2(x, y) {
    var n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    var t = a + (b - a) * ux;
    return t + ((c + (d - c) * ux) - t) * uy;
  }
  function fbm2(x, y) {
    var s = 0, amp = 0.5, nx, ny;
    for (var i = 0; i < 4; i++) {
      s += amp * vnoise(x, y);
      nx = 0.80 * x + 0.60 * y; ny = -0.60 * x + 0.80 * y;
      x = nx * 2.07 + 3.1; y = ny * 2.07 - 1.7; amp *= 0.5;
    }
    return s / 0.9375;
  }

  /* ================================================================== *
   * limbs — a tapered tube swept along a centreline
   * ================================================================== */
  var UP = new THREE.Vector3(0, 1, 0);
  var TAU = Math.PI * 2;
  var BOXW = 10;

  function makeP(aspect) {
    var bh = BOXW / aspect;
    return function (fx, fy, z) {
      return new THREE.Vector3((fx - 0.5) * BOXW, (0.5 - fy) * bh, z || 0);
    };
  }

  function transportFrames(curve, segs) {
    var pts = [], tans = [], nrms = [], i;
    for (i = 0; i <= segs; i++) {
      pts.push(curve.getPointAt(i / segs));
      tans.push(curve.getTangentAt(i / segs).normalize());
    }
    var ref = Math.abs(tans[0].y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0);
    nrms.push(new THREE.Vector3().crossVectors(tans[0], ref).normalize());
    for (i = 1; i <= segs; i++) {
      var axis = new THREE.Vector3().crossVectors(tans[i - 1], tans[i]);
      var n = nrms[i - 1].clone();
      if (axis.lengthSq() > 1e-12) {
        axis.normalize();
        n.applyAxisAngle(axis, Math.acos(Math.min(1, Math.max(-1, tans[i - 1].dot(tans[i])))));
      }
      nrms.push(n.normalize());
    }
    return { pts: pts, tans: tans, nrms: nrms };
  }

  /* old wood is never a perfect pipe: a slow swell and a finer knobble */
  function barkLump(p) {
    return 1 + 0.16 * (fbm2(p.x * 3.1 + 1.3, p.z * 3.1 - p.y * 2.4) - 0.5)
             + 0.06 * (fbm2(p.x * 9.0 - 4.0, p.z * 9.0 + p.y * 6.0) - 0.5);
  }

  function table(vals) {
    return function (t) {
      var x = clamp01(t) * (vals.length - 1);
      var i = Math.min(vals.length - 2, Math.floor(x));
      return vals[i] + (vals[i + 1] - vals[i]) * (x - i);
    };
  }

  var knot = function (t, a, b) {
    return 1 + a * Math.sin(t * 23.0 + 1.3) + b * Math.sin(t * 57.0 + 0.4) + b * 0.5 * Math.sin(t * 103.0 + 2.2);
  };

  function makeLimb(P, pts, opt) {
    var v3 = pts.map(function (q) { return P(q[0], q[1], q[2]); });
    var curve = new THREE.CatmullRomCurve3(v3, false, 'centripetal', 0.5);
    return {
      curve: curve,
      segs: opt.segs,
      radial: opt.radial,
      rw: opt.rw,
      vScale: opt.vScale,
      fr: transportFrames(curve, opt.segs),
      len: curve.getLength()
    };
  }

  var _fp = new THREE.Vector3(), _ft = new THREE.Vector3(), _fn = new THREE.Vector3(), _fb = new THREE.Vector3();
  function limbFrame(L, t) {
    var f = clamp01(t) * L.segs;
    var i = Math.min(L.segs - 1, Math.floor(f)), a = f - i;
    _fp.copy(L.fr.pts[i]).lerp(L.fr.pts[i + 1], a);
    _ft.copy(L.fr.tans[i]).lerp(L.fr.tans[i + 1], a).normalize();
    _fn.copy(L.fr.nrms[i]).lerp(L.fr.nrms[i + 1], a);
    _fn.addScaledVector(_ft, -_fn.dot(_ft)).normalize();
    _fb.crossVectors(_ft, _fn).normalize();
  }

  function limbSurface(L, t, th, outP, outN) {
    limbFrame(L, t);
    var c = Math.cos(th), s = Math.sin(th);
    outN.set(_fn.x * c + _fb.x * s, _fn.y * c + _fb.y * s, _fn.z * c + _fb.z * s).normalize();
    var rw = L.rw(t);
    outP.copy(_fp).addScaledVector(outN, rw);
    outP.copy(_fp).addScaledVector(outN, rw * barkLump(outP));
    return 0;
  }

  function tessellate(L, bag) {
    var S = L.segs, R = L.radial;
    var base = bag.pos.length / 3;
    var grid = new Float32Array((S + 1) * (R + 1) * 3);
    var p = new THREE.Vector3(), n = new THREE.Vector3();
    var i, j, k;

    for (i = 0; i <= S; i++) {
      for (j = 0; j <= R; j++) {
        limbSurface(L, i / S, (j / R) * TAU, p, n);
        k = (i * (R + 1) + j) * 3;
        grid[k] = p.x; grid[k + 1] = p.y; grid[k + 2] = p.z;
      }
    }

    var a = new THREE.Vector3(), b = new THREE.Vector3(), du = new THREE.Vector3(), dv = new THREE.Vector3();
    function get(i2, j2, out) {
      i2 = Math.min(S, Math.max(0, i2));
      j2 = (j2 + R) % R;
      var q = (i2 * (R + 1) + j2) * 3;
      return out.set(grid[q], grid[q + 1], grid[q + 2]);
    }

    for (i = 0; i <= S; i++) {
      for (j = 0; j <= R; j++) {
        get(i + 1, j, a); get(i - 1, j, b); du.subVectors(a, b);
        get(i, j + 1, a); get(i, j - 1, b); dv.subVectors(a, b);
        n.crossVectors(dv, du);
        if (n.lengthSq() < 1e-12) { limbSurface(L, i / S, (j / R) * TAU, p, n); } else n.normalize();
        k = (i * (R + 1) + j) * 3;
        bag.pos.push(grid[k], grid[k + 1], grid[k + 2]);
        bag.nor.push(n.x, n.y, n.z);
        bag.inf.push(1 - Math.abs(2 * (j / R) - 1), (i / S) * L.vScale, 0);
      }
    }
    for (i = 0; i < S; i++) for (j = 0; j < R; j++) {
      var q0 = base + i * (R + 1) + j, q1 = q0 + R + 1;
      bag.idx.push(q0, q1, q0 + 1, q1, q1 + 1, q0 + 1);
    }
    L.grid = grid; L.S = S; L.R = R;
  }

  /* ---- twigs: a recursive fork, two generations deep, reaching upward
          the way plum wood does ---- */
  function growOffshoot(list, start, dir, len, r0, gen) {
    var side = new THREE.Vector3().crossVectors(dir, UP);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    var up = new THREE.Vector3().crossVectors(side, dir).normalize();
    var bow = gen === 0 ? rand(0.12, 0.50) : rand(0.0, 0.46);
    var kink = rand(-0.30, 0.30);

    function node(f, u2, k) {
      return start.clone()
        .addScaledVector(dir, len * f)
        .addScaledVector(up, len * u2)
        .addScaledVector(side, len * k);
    }
    var pts = [start.clone(), node(0.32, bow * 0.30, kink * 0.70), node(0.68, bow * 0.85, kink * 0.24), node(1.0, bow, kink * 0.44)];
    var curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    var r1 = r0 * 0.45;
    var L = {
      curve: curve, segs: gen === 0 ? 18 : 12, radial: gen === 0 ? 9 : 7,
      rw: function (t) { return (r0 + (r1 - r0) * t) * (1 - 0.88 * sstep(0.90, 1.0, t)); },
      vScale: len * 7.0, twig: true, gen: gen
    };
    L.fr = transportFrames(curve, L.segs);
    L.len = curve.getLength();
    list.push(L);

    if (gen >= 1) return;
    var kids = Math.round(rand(1, 3));
    for (var i = 0; i < kids; i++) {
      var tt = 0.30 + (i / Math.max(kids, 1)) * 0.55 + rand(-0.06, 0.06);
      var pt = curve.getPointAt(Math.min(tt, 0.98));
      var tan = curve.getTangentAt(Math.min(tt, 0.98)).normalize();
      var ax = new THREE.Vector3().crossVectors(tan, UP);
      if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0);
      ax.normalize().applyAxisAngle(tan, rng() * TAU);
      var kdir = tan.clone().applyAxisAngle(ax, rand(0.40, 1.00)).addScaledVector(UP, 0.55).normalize();
      growOffshoot(list, pt, kdir, len * rand(0.45, 0.70), (r0 + (r1 - r0) * tt) * rand(0.55, 0.75), gen + 1);
    }
  }

  /* ================================================================== *
   * the two boughs
   * ================================================================== */
  function buildNearBough() {
    var P = makeP(ARCH.aspect);
    var limbs = [];

    /* the main bough: enters low left, climbs across the frame, crests
       over the first card's shoulder and runs out through the top right */
    var mainR = table([0.118, 0.110, 0.100, 0.090, 0.080, 0.068, 0.056, 0.046, 0.038, 0.031, 0.026]);
    limbs.push(makeLimb(P, [
      [-0.040, 0.640, -0.30],
      [ 0.032, 0.604, -0.16],
      [ 0.200, 0.550,  0.04],
      [ 0.347, 0.470,  0.18],
      [ 0.495, 0.400,  0.22],
      [ 0.621, 0.342,  0.14],
      [ 0.716, 0.293,  0.02],
      [ 0.795, 0.256, -0.10],
      [ 0.874, 0.229, -0.22],
      [ 0.960, 0.210, -0.34]
    ], {
      segs: 320, radial: 22, vScale: 30,
      rw: function (t) { return mainR(t) * knot(t, 0.06, 0.03); }
    }));

    /* a second limb lifting off the main one and climbing the card's edge */
    var sideR = table([0.056, 0.048, 0.040, 0.032, 0.025, 0.018]);
    limbs.push(makeLimb(P, [
      [0.495, 0.400, 0.16],
      [0.516, 0.272, 0.20],
      [0.537, 0.133, 0.20],
      [0.547, 0.015, 0.14],
      [0.540, -0.081, 0.06]
    ], {
      segs: 120, radial: 12, vScale: 18,
      rw: function (t) { return sideR(t) * knot(t, 0.05, 0.02); }
    }));

    return limbs;
  }

  function buildFarBough() {
    var P = makeP(FAR.aspect);
    var farR = table([0.115, 0.105, 0.095, 0.085, 0.075, 0.062, 0.050]);
    return [makeLimb(P, [
      [ 1.060, 0.050, -0.30],
      [ 0.850, 0.180, -0.05],
      [ 0.650, 0.300,  0.18],
      [ 0.450, 0.420,  0.22],
      [ 0.250, 0.500,  0.10],
      [ 0.050, 0.620, -0.08],
      [-0.060, 0.720, -0.25]
    ], {
      segs: 220, radial: 16, vScale: 26,
      rw: function (t) { return farR(1 - t) * knot(t, 0.05, 0.02); }
    })];
  }

  /* ================================================================== *
   * shaders
   * ================================================================== */
  var LIGHT_GLSL = [
    'uniform vec3 uKeyDir, uKeyCol, uFillDir, uFillCol, uAmbCol, uHazeCol;',
    'uniform float uHaze, uFog, uMaskOn, uHazeLift;',
    'uniform vec4 uMask;',
    'vec3 litSurface(vec3 N, vec3 albedo, float ao){',
    '  float k = max(dot(N, uKeyDir), 0.0);',
    '  float f = max(dot(N, uFillDir), 0.0);',
    '  float sky = 0.5 + 0.5 * N.y;',
    '  return albedo * (uKeyCol * (0.09 + 1.05 * k) + uFillCol * (0.04 + 0.34 * f) + uAmbCol * (0.35 + 0.65 * sky)) * ao;',
    '}',
    'vec3 aerial(vec3 c, float h){',
    '  float amt = clamp(uFog + uHaze * smoothstep(0.05, 0.95, h), 0.0, 1.0);',
    '  float gain = smoothstep(0.003, 0.075, dot(c, vec3(0.30, 0.59, 0.11)));',
    '  return mix(c, uHazeCol, amt * mix(uHazeLift, 1.0, gain));',
    '}',
    'uniform vec3 uScanO;',
    'uniform float uScanR, uScanOn;',
    'bool unscanned(vec3 w, float lag){',
    '  if (uScanOn < 0.5) return false;',
    '  float wob = sin(w.y * 0.011 + w.x * 0.007) * 36.0 + sin(w.z * 0.021 + w.y * 0.013) * 17.0;',
    '  return distance(w, uScanO) > uScanR - lag + wob;',
    '}',
    'float maskAt(vec3 lp, float boxH){',
    '  if (uMaskOn < 0.5) return 1.0;',
    '  float e = 1.0 - smoothstep(uMask.x, uMask.y, lp.x);',
    '  float l = smoothstep(uMask.z, uMask.w, lp.y / boxH + 0.5);',
    '  return clamp(e * l, 0.0, 1.0);',
    '}'
  ].join('\n');

  var NOISE_GLSL = [
    'vec2 hash22(vec2 p){',
    '  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));',
    '  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);',
    '}',
    'float gnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(dot(hash22(i + vec2(0,0)), f - vec2(0,0)),',
    '                 dot(hash22(i + vec2(1,0)), f - vec2(1,0)), u.x),',
    '             mix(dot(hash22(i + vec2(0,1)), f - vec2(0,1)),',
    '                 dot(hash22(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y);',
    '}',
    'const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);',
    'float gfbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * gnoise(p); p = ROT * p * 2.03; a *= 0.5; } return s; }',
    'float ridged(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * (1.0 - abs(gnoise(p) * 2.0)); p = ROT * p * 2.11; a *= 0.5; } return s; }'
  ].join('\n');

  var WIND_GLSL = [
    'uniform float uTime;',
    'uniform float uWind;',
    'vec3 windOffset(vec3 p){',
    '  float ph = p.x * 0.42 + p.y * 0.30 + p.z * 0.70;',
    '  float a = 0.030 * uWind;',
    '  return vec3((sin(uTime * 0.58 + ph) + 0.45 * sin(uTime * 1.37 + ph * 2.3)) * a,',
    '              sin(uTime * 0.79 + ph * 1.7) * a * 0.42,',
    '              sin(uTime * 0.51 + ph * 0.9) * a * 0.55);',
    '}'
  ].join('\n');

  /* ---- bark ---- */
  function barkMaterial(cfg) {
    return new THREE.ShaderMaterial({
      uniforms: cfg.uniforms,
      extensions: { derivatives: true },
      vertexShader: WIND_GLSL + [
        'attribute vec3 inf;',
        'varying vec3 vN; varying vec3 vW; varying vec3 vInf; varying float vH; varying vec3 vL;',
        'uniform float uBoxH;',
        'void main(){',
        '  vInf = inf;',
        '  vN = normalize(normal);',
        '  vec3 p = position + windOffset(position) * 0.45;',
        '  vL = p;',
        '  vH = clamp(p.y / uBoxH + 0.5, 0.0, 1.0);',
        '  vec4 wp = modelMatrix * vec4(p, 1.0);',
        '  vW = wp.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: NOISE_GLSL + LIGHT_GLSL + [
        'precision highp float;',
        'uniform float uAlpha; uniform float uBoxH;',
        'varying vec3 vN; varying vec3 vW; varying vec3 vInf; varying float vH; varying vec3 vL;',

        'vec2 barkDomain(vec2 uv){ return vec2(uv.x * 7.0, uv.y * 0.62); }',
        'float barkHeight(vec2 uv){',
        '  vec2 q = barkDomain(uv);',
        '  vec2 w = vec2(gfbm(q * 0.5), gfbm(q * 0.5 + 9.1));',
        '  vec2 p = q + w * 0.60;',
        '  float ridge = ridged(p);',
        '  float plate = smoothstep(-0.25, 0.45, gfbm(q * 0.34));',
        '  float crack = smoothstep(0.30, 0.86, ridged(p * 1.9 + 4.0));',
        '  float fine  = gfbm(p * 5.5) * 0.5 + 0.5;',
        '  return (ridge - 0.5) * 1.85 * mix(0.35, 1.0, plate) - crack * 0.42 + fine * 0.20;',
        '}',
        'vec3 bumped(vec3 N, vec3 p, float h, float k){',
        '  vec3 dpx = dFdx(p), dpy = dFdy(p);',
        '  float dhx = dFdx(h) * k, dhy = dFdy(h) * k;',
        '  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);',
        '  float det = dot(dpx, r1);',
        '  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);',
        '  return normalize(abs(det) * N - grad);',
        '}',

        'void main(){',
        '  if (unscanned(vW, 520.0)) discard;',
        '  vec2 uv = vInf.xy;',
        '  vec3 N = normalize(vN);',

        '  float h = barkHeight(uv);',
        '  N = bumped(N, vW, h, 0.24);',

        '  vec2 q = barkDomain(uv);',
        '  float grain  = gfbm(q * 1.25) * 0.5 + 0.5;',
        '  float mottle = gfbm(q * 0.28 + 21.0) * 0.5 + 0.5;',
        '  float crack  = smoothstep(0.30, 0.86, ridged(q * 1.9 + 4.0));',

        /* old plum wood under a moon: blue-grey where the light rakes it,
           near-black in the splits, a slow drift into warm umber */
        '  vec3 silver = mix(vec3(0.008, 0.009, 0.012), vec3(0.235, 0.240, 0.250), grain);',
        '  vec3 umber  = mix(vec3(0.010, 0.008, 0.007), vec3(0.120, 0.095, 0.075), grain);',
        '  vec3 col    = mix(silver, umber, mottle * 0.70);',
        '  col *= 1.0 - 0.72 * crack;',

        /* moonlight frosting the upward faces */
        '  float frost = smoothstep(0.50, 0.84, gfbm(q * 0.62 + 31.0) * 0.5 + 0.5);',
        '  frost *= smoothstep(0.05, 0.75, N.y) * smoothstep(0.10, 0.50, h);',
        '  col = mix(col, vec3(0.30, 0.31, 0.35), frost * 0.55);',

        '  float ao = mix(0.30, 1.02, smoothstep(-0.40, 0.62, h));',
        '  vec3 lit = litSurface(N, col, ao);',

        '  vec3 V = normalize(cameraPosition - vW);',
        '  lit += col * uAmbCol * pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.85;',
        '  float spec = pow(max(dot(reflect(-uKeyDir, N), V), 0.0), 24.0);',
        '  lit += uKeyCol * spec * 0.09 * ao;',

        '  float a = uAlpha * maskAt(vL, uBoxH);',
        '  if (a < 0.004) discard;',
        '  gl_FragColor = vec4(aerial(lit, vH), a);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n'),
      transparent: cfg.transparent === true,
      depthWrite: cfg.depthWrite !== false,
      side: THREE.DoubleSide
    });
  }

  /* ---- the survey mesh ---- */
  var wireMeshes = [];

  function buildWire(L, out) {
    if (!L.grid) return;
    var S = L.S, R = L.R, g = L.grid, i, j, a, b;
    var ringEvery = Math.max(2, Math.round(S / 52));
    var longEvery = Math.max(2, Math.round(R / 9));
    for (i = 0; i <= S; i += ringEvery) {
      for (j = 0; j < R; j++) {
        a = (i * (R + 1) + j) * 3; b = a + 3;
        out.push(g[a], g[a + 1], g[a + 2], g[b], g[b + 1], g[b + 2]);
      }
    }
    for (j = 0; j < R; j += longEvery) {
      for (i = 0; i < S; i++) {
        a = (i * (R + 1) + j) * 3; b = ((i + 1) * (R + 1) + j) * 3;
        out.push(g[a], g[a + 1], g[a + 2], g[b], g[b + 1], g[b + 2]);
      }
    }
  }

  function wireMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { uScanO: uScanO, uScanR: uScanR, uWire: uWire, uTime: uTime },
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: [
        'varying vec3 vW;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position, 1.0);',
        '  vW = wp.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision highp float;',
        'uniform vec3 uScanO;',
        'uniform float uScanR, uWire, uTime;',
        'varying vec3 vW;',
        'void main(){',
        '  float d = distance(vW, uScanO);',
        '  float rim   = exp(-pow((d - uScanR) / 135.0, 2.0));',
        '  float trail = smoothstep(uScanR, uScanR - 950.0, d);',
        '  float a = (rim * 1.60 + trail * 0.34) * uWire;',
        '  if (a < 0.004) discard;',
        '  a *= 0.66 + 0.34 * sin(d * 0.045 - uTime * 7.0);',
        '  vec3 col = mix(vec3(0.66, 0.24, 0.32), vec3(1.00, 0.88, 0.86), rim);',
        '  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));',
        '}'
      ].join('\n')
    });
  }

  /* ---- blossoms ---- */
  var blossomTex = null, budTex = null;
  function makeBlossomTexture() {
    if (blossomTex) return blossomTex;
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'); var cx = 64, cy = 64;
    /* five narrow petals with real notches between them, filled almost
       flat so they do not shade into a ball, and a cream heart big enough
       to survive the mipmaps */
    for (var p = 0; p < 5; p++) {
      var ang = p / 5 * TAU - Math.PI / 2 + 0.25;
      var px = cx + Math.cos(ang) * 35, py = cy + Math.sin(ang) * 35;
      var grad = g.createLinearGradient(cx + Math.cos(ang) * 14, cy + Math.sin(ang) * 14, cx + Math.cos(ang) * 56, cy + Math.sin(ang) * 56);
      grad.addColorStop(0, 'rgba(196,44,84,1)');
      grad.addColorStop(0.35, 'rgba(232,112,142,1)');
      grad.addColorStop(1, 'rgba(248,178,194,1)');
      g.fillStyle = grad;
      g.beginPath(); g.ellipse(px, py, 14, 21, ang + Math.PI / 2, 0, TAU); g.fill();
    }
    var cg = g.createRadialGradient(cx, cy, 0, cx, cy, 13);
    cg.addColorStop(0, 'rgba(252,236,170,1)'); cg.addColorStop(0.7, 'rgba(240,206,120,1)'); cg.addColorStop(1, 'rgba(236,190,110,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(cx, cy, 13, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(252,238,190,0.9)'; g.lineWidth = 1.5;
    for (var s = 0; s < 10; s++) {
      var a = s / 10 * TAU + 0.2, r = 11 + 5 * ((s * 7) % 3);
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
      g.fillStyle = 'rgba(150,30,56,1)';
      g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.2, 0, TAU); g.fill();
    }
    blossomTex = new THREE.CanvasTexture(c);
    if ('sRGBEncoding' in THREE) blossomTex.encoding = THREE.sRGBEncoding;
    blossomTex.minFilter = THREE.LinearMipmapLinearFilter;
    blossomTex.generateMipmaps = true;
    return blossomTex;
  }
  function makeBudTexture() {
    if (budTex) return budTex;
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(27, 25, 2, 32, 30, 20);
    grad.addColorStop(0, 'rgba(228,110,132,1)'); grad.addColorStop(0.6, 'rgba(168,40,68,1)'); grad.addColorStop(1, 'rgba(96,18,40,1)');
    g.fillStyle = grad; g.beginPath(); g.ellipse(32, 29, 15, 18, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(70,52,38,1)';
    g.beginPath(); g.moveTo(20, 40); g.lineTo(32, 56); g.lineTo(44, 40); g.quadraticCurveTo(32, 48, 20, 40); g.fill();
    budTex = new THREE.CanvasTexture(c);
    if ('sRGBEncoding' in THREE) budTex.encoding = THREE.sRGBEncoding;
    budTex.minFilter = THREE.LinearMipmapLinearFilter;
    return budTex;
  }

  function blossomMaterial(cfg) {
    return new THREE.ShaderMaterial({
      uniforms: cfg.uniforms,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: WIND_GLSL + [
        'attribute vec3 iPos;',
        'attribute vec2 iRnd;',
        'uniform float uBoxH;',
        'varying vec2 vUv; varying float vH; varying vec3 vL; varying vec3 vW;',
        'void main(){',
        '  vUv = uv;',
        '  vec3 p = iPos + windOffset(iPos) * 1.4;',
        '  p += vec3(sin(uTime * 1.3 + iRnd.y * 6.28), 0.0, 0.0) * 0.012 * uWind;',
        '  vL = p;',
        '  vH = clamp(p.y / uBoxH + 0.5, 0.0, 1.0);',
        '  vW = (modelMatrix * vec4(p, 1.0)).xyz;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  float ws = length(modelMatrix[0].xyz);',
        '  float ca = cos(iRnd.y * 6.2831), sa = sin(iRnd.y * 6.2831);',
        '  vec2 q = vec2(position.x * ca - position.y * sa, position.x * sa + position.y * ca);',
        '  mv.xy += q * iRnd.x * ws;',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: LIGHT_GLSL + [
        'precision highp float;',
        'uniform sampler2D uMap;',
        'uniform float uAlpha; uniform float uBoxH;',
        'varying vec2 vUv; varying float vH; varying vec3 vL; varying vec3 vW;',
        'void main(){',
        '  if (unscanned(vW, 520.0)) discard;',
        '  vec4 t = texture2D(uMap, vUv);',
        '  if (t.a < 0.14) discard;',
        /* the petals carry a little light of their own, or the red would
           sink into the night */
        '  vec3 col = t.rgb * t.rgb * (uKeyCol * 0.58 + uAmbCol * 1.2 + vec3(0.34, 0.18, 0.22));',
        '  gl_FragColor = vec4(aerial(col, vH), t.a * uAlpha * maskAt(vL, uBoxH));',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n')
    });
  }

  /* ================================================================== *
   * assembly
   * ================================================================== */
  var uTime  = { value: 0 };
  var uWind  = { value: REDUCED ? 0.0 : 1.0 };
  var uMouseNear = { value: new THREE.Vector3(9999, 9999, 9999) };
  var uMouseFar  = { value: new THREE.Vector3(9999, 9999, 9999) };
  var uScanO  = { value: new THREE.Vector3(-900, -260, 240) };
  var uScanR  = { value: 0 };
  var uScanOn = { value: 0 };
  var uWire   = { value: 0 };

  /* the moon, high and to the right; the fill is the pool of light on
     the ground bouncing back up */
  var KEY  = new THREE.Vector3( 0.52, 0.78, 0.34).normalize();
  var FILL = new THREE.Vector3( 0.10, -0.86, 0.50).normalize();

  function lightUniforms(extra) {
    var u = {
      uTime: uTime, uWind: uWind,
      uKeyDir:  { value: KEY.clone() },
      uKeyCol:  { value: new THREE.Color(0.88, 0.94, 1.12) },
      uFillDir: { value: FILL.clone() },
      uFillCol: { value: new THREE.Color(0.62, 0.55, 0.48) },
      uAmbCol:  { value: new THREE.Color(0.055, 0.062, 0.085) },
      uHazeCol: { value: new THREE.Color(0.105, 0.115, 0.150) },
      uHaze:    { value: 0.14 },
      uHazeLift:{ value: 0.20 },
      uFog:     { value: 0.0 },
      uAlpha:   { value: 1.0 },
      uBoxH:    { value: BOXW / ARCH.aspect },
      uMask:    { value: new THREE.Vector4(0, 1, 0, 1) },
      uMaskOn:  { value: 0 },
      uScanO:   uScanO,
      uScanR:   uScanR,
      uScanOn:  uScanOn,
      uMouse:   { value: uMouseNear.value },
      uMouseR:  { value: 1.5 }
    };
    for (var k in extra) if (extra.hasOwnProperty(k)) u[k] = extra[k];
    return u;
  }

  function spriteGeometry() {
    var g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5,-0.5,0, 0.5,-0.5,0, 0.5,0.5,0, -0.5,0.5,0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, 1,0, 1,1, 0,1], 2));
    g.setIndex([0,1,2, 0,2,3]);
    return g;
  }

  /* one bough: bark shell + blossoms + buds, under a single group */
  function assembleBough(limbs, opt) {
    var group = new THREE.Group();
    var uni = lightUniforms({
      uBoxH:   { value: BOXW / opt.aspect },
      uHaze:   { value: opt.haze },
      uFog:    { value: opt.fog },
      uHazeCol:{ value: new THREE.Color().fromArray(opt.hazeCol || [0.105, 0.115, 0.150]) },
      uHazeLift:{ value: opt.hazeLift === undefined ? 0.20 : opt.hazeLift },
      uAlpha:  { value: opt.alpha },
      uMask:   { value: new THREE.Vector4(opt.mask ? opt.mask[0] : 0, opt.mask ? opt.mask[1] : 1,
                                          opt.mask ? opt.mask[2] : 0, opt.mask ? opt.mask[3] : 1) },
      uMaskOn: { value: opt.mask ? 1 : 0 },
      uMouse:  { value: opt.mouse.value },
      uMouseR: { value: opt.mouseR }
    });
    var soft = !!opt.mask || opt.alpha < 1;

    /* ---- shell ---- */
    var bag = { pos: [], nor: [], inf: [], idx: [] };
    for (var i = 0; i < limbs.length; i++) tessellate(limbs[i], bag);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(bag.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(bag.nor, 3));
    geo.setAttribute('inf', new THREE.Float32BufferAttribute(bag.inf, 3));
    geo.setIndex(bag.idx);
    var shell = new THREE.Mesh(geo, barkMaterial({ uniforms: uni, transparent: soft, depthWrite: true }));
    shell.frustumCulled = false;
    shell.renderOrder = opt.order;
    group.add(shell);

    /* ---- blossoms and buds: clustered on the twigs, a few on the bough ---- */
    var twigs = limbs.filter(function (L) { return L.twig; });
    var boughs = limbs.filter(function (L) { return !L.twig; });
    var plantMaxX = opt.mask ? opt.mask[0] + 0.25 : 1e9;
    var fP = [], fR = [], bP = [], bR = [];
    var p = new THREE.Vector3(), n = new THREE.Vector3();
    var k, guard;

    function pick() {
      if (twigs.length && rng() < 0.78) return twigs[Math.floor(rng() * twigs.length)];
      return boughs[Math.floor(rng() * boughs.length)];
    }

    for (k = 0, guard = 0; k < opt.blossoms && guard < opt.blossoms * 40; guard++) {
      var Lw = pick();
      var t0 = rng(), th0 = rng() * TAU;
      var size = Lw.twig ? 1.0 : 0.85;
      for (var c2 = 0; c2 < 4 && k < opt.blossoms; c2++) {
        var tt = clamp01(t0 + rand(-0.03, 0.03));
        var tth = th0 + rand(-0.7, 0.7);
        limbSurface(Lw, tt, tth, p, n);
        if (p.x > plantMaxX || n.y < -0.35) continue;
        p.addScaledVector(n, rand(0.04, 0.12));
        p.z += 0.05;
        fP.push(p.x, p.y, p.z);
        fR.push(rand(opt.blossomSize[0], opt.blossomSize[1]) * size, rng());
        k++;
      }
    }
    for (k = 0, guard = 0; k < opt.buds && guard < opt.buds * 40; guard++) {
      var Lb = pick();
      limbSurface(Lb, rng(), rng() * TAU, p, n);
      if (p.x > plantMaxX || n.y < -0.2) continue;
      p.addScaledVector(n, rand(0.02, 0.06));
      p.z += 0.04;
      bP.push(p.x, p.y, p.z);
      bR.push(rand(opt.budSize[0], opt.budSize[1]), rng());
      k++;
    }

    if (fP.length) {
      var wg = spriteGeometry();
      wg.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(fP), 3));
      wg.setAttribute('iRnd', new THREE.InstancedBufferAttribute(new Float32Array(fR), 2));
      wg.instanceCount = fP.length / 3;
      /* own uniforms object per material: the light uniforms stay shared
         by reference, but uMap must not — two sprites sharing one object
         would both end up with whichever texture was assigned last */
      var fm = blossomMaterial({ uniforms: Object.assign({}, uni, { uMap: { value: makeBlossomTexture() } }) });
      var blooms = new THREE.Mesh(wg, fm);
      blooms.frustumCulled = false;
      blooms.renderOrder = opt.order + 0.3;
      group.add(blooms);
    }
    if (bP.length) {
      var bg = spriteGeometry();
      bg.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(bP), 3));
      bg.setAttribute('iRnd', new THREE.InstancedBufferAttribute(new Float32Array(bR), 2));
      bg.instanceCount = bP.length / 3;
      var bm = blossomMaterial({ uniforms: Object.assign({}, uni, { uMap: { value: makeBudTexture() } }) });
      var buds = new THREE.Mesh(bg, bm);
      buds.frustumCulled = false;
      buds.renderOrder = opt.order + 0.2;
      group.add(buds);
    }

    if (opt.wire) {
      var wpos = [];
      for (i = 0; i < limbs.length; i++) buildWire(limbs[i], wpos);
      if (wpos.length) {
        var wgeo = new THREE.BufferGeometry();
        wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
        var wmesh = new THREE.LineSegments(wgeo, wireMaterial());
        wmesh.frustumCulled = false;
        wmesh.renderOrder = 8;
        group.add(wmesh);
        wireMeshes.push(wmesh);
      }
    }

    for (i = 0; i < limbs.length; i++) { limbs[i].grid = null; }

    group.userData = { uni: uni, blossoms: fP.length / 3 };
    return group;
  }

  /* ── soft radial sprite ──────────────────────────────────────────── */
  function radialTexture(size, stops) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(function (s) { grad.addColorStop(s[0], s[1]); });
    g.fillStyle = grad; g.fillRect(0, 0, size, size);
    var t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    if ('sRGBEncoding' in THREE) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /* a single petal, drawn inside the inscribed circle so it can be spun */
  function makePetalTexture() {
    if (petalTex) return petalTex;
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(32, 8, 32, 56);
    grad.addColorStop(0, 'rgba(236,140,160,1)'); grad.addColorStop(1, 'rgba(250,206,214,1)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(32, 8);
    g.bezierCurveTo(52, 20, 52, 44, 33, 56);
    g.bezierCurveTo(31, 52, 31, 52, 31, 56);
    g.bezierCurveTo(12, 44, 12, 20, 32, 8);
    g.fill();
    petalTex = new THREE.CanvasTexture(c);
    petalTex.minFilter = THREE.LinearMipmapLinearFilter;
    if ('sRGBEncoding' in THREE) petalTex.encoding = THREE.sRGBEncoding;
    return petalTex;
  }

  /* ================================================================== *
   * build
   * ================================================================== */
  function build() {
    var narrow = NARROW.matches;
    var small = narrow || (window.innerWidth * window.innerHeight) < 620000;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: !small });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.6 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.30;
    if ('sRGBEncoding' in THREE) renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, 10, 8000);
    camera.position.set(0, 0, DIST);

    /* ---- near bough with its twigs ---- */
    var nearLimbs = buildNearBough();
    var hp = new THREE.Vector3(), hn = new THREE.Vector3();
    var extra = [];
    for (var i = 0; i < (small ? 16 : 26); i++) {
      var onMain = rng() < 0.70;
      var src = nearLimbs[onMain ? 0 : 1];
      var t = onMain ? rand(0.10, 0.90) : rand(0.15, 0.95), th = rng() * TAU;
      limbSurface(src, t, th, hp, hn);
      if (hn.y < -0.25) continue;
      limbFrame(src, t);
      var nearCards = onMain && t > 0.60 && t < 0.76;   /* only the stretch under the card is kept low */
      var dir = hn.clone().multiplyScalar(rand(0.4, 1.0))
        .addScaledVector(_ft, rand(-0.3, 1.2))
        .addScaledVector(UP, nearCards ? rand(-0.4, 0.5) : rand(0.6, 1.7)).normalize();
      if (!onMain) dir.x = -Math.abs(dir.x) - 0.35;
      dir.normalize();
      var len = nearCards ? rand(0.22, 0.50) : rand(0.35, onMain ? 1.05 : 0.75);
      hp.addScaledVector(hn, -src.rw(t) * 0.5);
      growOffshoot(extra, hp.clone(), dir, len, src.rw(t) * rand(0.26, 0.46), 0);
    }
    nearLimbs = nearLimbs.concat(extra);

    nearGroup = assembleBough(nearLimbs, {
      aspect: ARCH.aspect, haze: 0.15, fog: 0.0, alpha: 1.0, order: 2,
      blossoms: small ? 90 : 150, buds: small ? 40 : 70,
      blossomSize: [0.18, 0.30], budSize: [0.05, 0.08], wire: true,
      mouse: uMouseNear, mouseR: 1.20
    });
    scene.add(nearGroup);
    if (!small) bf = buildButterfly(nearGroup, nearLimbs, nearGroup.userData.uni);

    /* ---- far bough: pushed back and washed into the night air ---- */
    var farLimbs = buildFarBough();
    var farExtra = [];
    for (i = 0; i < 10; i++) {
      var t2 = rand(0.10, 0.95), th2 = rng() * TAU;
      limbSurface(farLimbs[0], t2, th2, hp, hn);
      if (hn.y < -0.25) continue;
      limbFrame(farLimbs[0], t2);
      var dir2 = hn.clone().multiplyScalar(rand(0.4, 1.0)).addScaledVector(UP, rand(0.6, 1.5)).normalize();
      growOffshoot(farExtra, hp.clone(), dir2, rand(0.35, 0.9), farLimbs[0].rw(t2) * rand(0.25, 0.4), 0);
    }
    farGroup = assembleBough(farLimbs.concat(farExtra), {
      aspect: FAR.aspect, haze: 0.16, fog: 0.30, alpha: 1.0, order: 0,
      hazeCol: [0.095, 0.105, 0.135], hazeLift: 0.92,
      blossoms: small ? 40 : 60, buds: 20,
      blossomSize: [0.09, 0.15], budSize: [0.03, 0.05],
      mask: [0.4, 3.4, 0.0, 0.42], wire: true,
      mouse: uMouseFar, mouseR: 1.4
    });
    scene.add(farGroup);

    buildAmbient();
    layout();
    window.addEventListener('resize', layout);
    clock = new THREE.Clock();
    window.__mei = { scene: scene, near: nearGroup, far: farGroup, renderer: renderer, camera: camera, bf: function () { return bf; } };

    if (!REDUCED && !document.hidden) { uScanOn.value = 1; uScanR.value = 0; scanning = true; scanStart = Date.now(); }

    renderFrame();
    startTick();
  }

  /* everything that needs no geometry — shadow, moon pool, petals */
  function buildAmbient() {
    var geo = new THREE.PlaneGeometry(1, 1, 1, 1);

    shadowMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: radialTexture(256, [[0, 'rgba(6,8,14,0.30)'], [0.45, 'rgba(6,8,14,0.12)'], [1, 'rgba(6,8,14,0)']]),
      transparent: true, depthWrite: false, depthTest: false
    }));
    shadowMesh.renderOrder = 1;
    shadowMesh.position.z = -70;
    scene.add(shadowMesh);

    glowMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: radialTexture(256, [[0, 'rgba(224,230,246,0.26)'], [0.42, 'rgba(214,222,240,0.09)'], [1, 'rgba(214,222,240,0)']]),
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending
    }));
    glowMesh.renderOrder = -1;
    glowMesh.position.z = -320;
    scene.add(glowMesh);

    /* ---- falling petals: animated entirely in the vertex shader ---- */
    var COUNT = (NARROW.matches || (window.innerWidth * window.innerHeight) < 620000) ? 600 : 1000;
    var pos = new Float32Array(COUNT * 3);
    var seed = new Float32Array(COUNT * 4);
    for (var i = 0; i < COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 3400;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1500;
      pos[i * 3 + 2] = -380 + Math.random() * 1000;
      seed[i * 4]     = Math.random() * 6.283;
      seed[i * 4 + 1] = 0.25 + Math.random() * 0.9;
      seed[i * 4 + 2] = 0.4 + Math.random() * 1.4;
      seed[i * 4 + 3] = 0.70 + 1.05 * Math.pow(Math.random(), 2.2);
    }
    var pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('seed', new THREE.BufferAttribute(seed, 4));

    petalTex = makePetalTexture();
    motes = new THREE.Points(pg, new THREE.ShaderMaterial({
      uniforms: {
        uTime: uTime,
        uMap: { value: petalTex },
        uSize: { value: 14 },
        uScale: { value: 440 }
      },
      transparent: true, depthWrite: false, depthTest: true,
      vertexShader: [
        'attribute vec4 seed;',
        'uniform float uTime, uSize, uScale;',
        'varying float vFade; varying float vAng;',
        'void main(){',
        '  float ph = seed.x, sp = seed.y, am = seed.z;',
        '  vec3 p = position;',
        '  float fall = mod(uTime * 14.0 * sp + ph * 60.0, 1500.0);',
        '  p.y += 750.0 - fall;',
        '  p.x += sin(uTime * sp * 0.55 + ph) * 38.0 * am;',
        '  p.x = mod(p.x + uTime * 7.0 * sp + 1700.0, 3400.0) - 1700.0;',
        '  p.z += cos(uTime * sp * 0.33 + ph) * 26.0 * am;',
        '  vAng = uTime * sp * 1.7 + ph * 3.0;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  gl_PointSize = uSize * seed.w * (uScale / max(-mv.z, 1.0));',
        '  float edge = 1.0 - abs(750.0 - fall) / 750.0;',
        '  vFade = clamp(edge * 3.0, 0.0, 1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision highp float;',
        'uniform sampler2D uMap;',
        'varying float vFade; varying float vAng;',
        'void main(){',
        '  vec2 c = gl_PointCoord - 0.5; float ca = cos(vAng), sa = sin(vAng);',
        '  vec2 r = vec2(c.x * ca - c.y * sa, c.x * sa + c.y * ca) + 0.5;',
        '  if (r.x < 0.0 || r.x > 1.0 || r.y < 0.0 || r.y > 1.0) discard;',
        '  vec4 t = texture2D(uMap, r);',
        '  if (t.a < 0.05) discard;',
        '  gl_FragColor = vec4(t.rgb, t.a * vFade * 0.9);',
        '}'
      ].join('\n')
    }));
    motes.frustumCulled = false;
    motes.renderOrder = 6;
    scene.add(motes);

    buildCursorSpray();
  }

  /* ── the trail the pointer lifts off the bough ──────────────────── */
  var SPRAY_N = 620, SPRAY_LIFE = 1.6;
  var spray = null, sprayPos, sprayVel, sprayBirth, sprayRnd;
  var sprayHead = 0, sprayIdle = 0, sprayDirty = false;
  var sprayPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -240);
  var sprayAt = new THREE.Vector3(), sprayLast = new THREE.Vector3(9999, 0, 0);
  var sprayStep = new THREE.Vector3();

  function buildCursorSpray() {
    if (REDUCED) return;
    sprayPos = new Float32Array(SPRAY_N * 3);
    sprayVel = new Float32Array(SPRAY_N * 3);
    sprayBirth = new Float32Array(SPRAY_N);
    sprayRnd = new Float32Array(SPRAY_N * 2);
    for (var i = 0; i < SPRAY_N; i++) sprayBirth[i] = -999;

    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
    g.setAttribute('aVel', new THREE.BufferAttribute(sprayVel, 3));
    g.setAttribute('aBirth', new THREE.BufferAttribute(sprayBirth, 1));
    g.setAttribute('aRnd', new THREE.BufferAttribute(sprayRnd, 2));

    spray = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: {
        uTime: uTime, uMap: { value: petalTex },
        uSize: { value: 16 }, uScale: { value: 440 }, uLife: { value: SPRAY_LIFE }
      },
      transparent: true, depthWrite: false, depthTest: false,
      vertexShader: [
        'attribute vec3 aVel;',
        'attribute float aBirth;',
        'attribute vec2 aRnd;',
        'uniform float uTime, uSize, uScale, uLife;',
        'varying float vA; varying float vAng;',
        'void main(){',
        '  float age = uTime - aBirth;',
        '  if (age < 0.0 || age > uLife) { vA = 0.0; vAng = 0.0; gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }',
        '  float u = age / uLife;',
        '  vec3 p = position + aVel * age * (1.0 - 0.34 * u)',
        '         + vec3(sin(aRnd.y * 6.28 + age * 2.6) * 22.0 * u, 34.0 * age - 40.0 * u * u, 0.0);',
        '  vAng = aRnd.y * 6.28 + age * 3.0;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  gl_PointSize = uSize * aRnd.x * (uScale / max(-mv.z, 1.0)) * (0.45 + 0.55 * (1.0 - u));',
        '  vA = smoothstep(0.0, 0.09, u) * (1.0 - smoothstep(0.40, 1.0, u));',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision highp float;',
        'uniform sampler2D uMap;',
        'varying float vA; varying float vAng;',
        'void main(){',
        '  vec2 c = gl_PointCoord - 0.5; float ca = cos(vAng), sa = sin(vAng);',
        '  vec2 r = vec2(c.x * ca - c.y * sa, c.x * sa + c.y * ca) + 0.5;',
        '  if (r.x < 0.0 || r.x > 1.0 || r.y < 0.0 || r.y > 1.0) discard;',
        '  vec4 t = texture2D(uMap, r);',
        '  if (t.a < 0.05) discard;',
        '  gl_FragColor = vec4(t.rgb, t.a * vA * 0.9);',
        '}'
      ].join('\n')
    }));
    spray.frustumCulled = false;
    spray.renderOrder = 7;
    scene.add(spray);
  }

  function spawnSpray(p, boost) {
    var k = boost || 1;
    var i = sprayHead; sprayHead = (sprayHead + 1) % SPRAY_N;
    var o = i * 3;
    sprayPos[o]     = p.x + rand(-15, 15) * k;
    sprayPos[o + 1] = p.y + rand(-15, 15) * k;
    sprayPos[o + 2] = p.z + rand(-45, 45);
    sprayVel[o]     = rand(-38, 38) * k;
    sprayVel[o + 1] = (rand(2, 64) + 22 * (k - 1)) * k;
    sprayVel[o + 2] = rand(-26, 26) * k;
    sprayBirth[i]   = uTime.value;
    sprayRnd[i * 2]     = rand(0.50, 1.15);
    sprayRnd[i * 2 + 1] = rng();
    sprayDirty = true;
  }

  function flushSpray() {
    if (!spray || !sprayDirty) return;
    var at = spray.geometry.attributes;
    at.position.needsUpdate = at.aVel.needsUpdate = at.aBirth.needsUpdate = at.aRnd.needsUpdate = true;
    sprayDirty = false;
  }

  var burstNdc = { x: 0, y: 0 }, burstAtV = new THREE.Vector3();
  function burstAt(clientX, clientY) {
    if (!spray || !camera || REDUCED) return;
    var r = hero.getBoundingClientRect();
    burstNdc.x =  ((clientX - r.left) / r.width) * 2 - 1;
    burstNdc.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(burstNdc, camera);
    if (!raycaster.ray.intersectPlane(sprayPlane, burstAtV)) return;
    for (var i = 0; i < 52; i++) spawnSpray(burstAtV, 2.5);
    flushSpray();
  }

  function emitSpray(dt) {
    if (!spray) return;
    if (!mouseLive || !raycaster.ray.intersectPlane(sprayPlane, sprayAt)) {
      sprayLast.x = 9999;
      return;
    }
    if (sprayLast.x > 9000) { sprayLast.copy(sprayAt); return; }

    var d = sprayAt.distanceTo(sprayLast);
    var n = Math.min(14, Math.floor(d / 7));
    for (var k = 1; k <= n; k++) {
      sprayStep.lerpVectors(sprayLast, sprayAt, k / n);
      spawnSpray(sprayStep);
    }
    if (n > 0) { sprayLast.copy(sprayAt); sprayIdle = 0; }
    else {
      sprayIdle += dt;
      if (sprayIdle > 0.055) { spawnSpray(sprayAt); sprayIdle = 0; }
    }

    flushSpray();
  }

  /* ── a pale moth ────────────────────────────────────────────────────
     The Sylva butterfly with its colours re-solved for the night: a
     cream-and-ash moth with a faint pearl sheen instead of a swallowtail. */
  var bf = null;

  function wingGeometry(hind) {
    var NS = 30, NU = 10, pos = [], uv = [], idx = [], i, j;
    for (i = 0; i < NS; i++) {
      var sp = i / (NS - 1), lead, chord, span;
      if (!hind) {
        span  = 0.95;
        lead  = 0.10 + 0.32 * sp - 0.14 * sp * sp;
        chord = (0.56 + 0.46 * sp) * Math.pow(Math.max(0, 1 - Math.pow(sp, 2.6)), 0.55);
      } else {
        span  = 0.78;
        lead  = -0.06 - 0.26 * sp;
        chord = (0.54 + 0.48 * sp) * Math.pow(Math.max(0, 1 - Math.pow(sp, 2.2)), 0.55);
        chord *= 1 + 0.035 * Math.cos(sp * 22.0);
      }
      chord *= 0.26 + 0.74 * sstep(0, 0.32, sp);
      chord = Math.max(chord, 0.014);
      for (j = 0; j < NU; j++) {
        var u = j / (NU - 1);
        var cam = 0.030 * Math.sin(Math.PI * u) * (1 - 0.35 * sp);
        pos.push(0.018 + sp * span, cam, lead - chord * u);
        uv.push(sp, u);
      }
    }
    for (i = 0; i < NS - 1; i++) for (j = 0; j < NU - 1; j++) {
      var a = i * NU + j, b = a + NU;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  function wingTexture() {
    var N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
    var ctx = cv.getContext('2d'), img = ctx.createImageData(N, N), d = img.data;
    function h2(x, y) {
      var a = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      var b = Math.sin(x * 269.5 + y * 183.3) * 43758.5453123;
      return [(a - Math.floor(a)) * 2 - 1, (b - Math.floor(b)) * 2 - 1];
    }
    function gn(x, y) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      var g00 = h2(ix, iy), g10 = h2(ix + 1, iy), g01 = h2(ix, iy + 1), g11 = h2(ix + 1, iy + 1);
      var a = g00[0] * fx + g00[1] * fy, b = g10[0] * (fx - 1) + g10[1] * fy;
      var c = g01[0] * fx + g01[1] * (fy - 1), e = g11[0] * (fx - 1) + g11[1] * (fy - 1);
      var top = a + (b - a) * ux, bot = c + (e - c) * ux;
      return top + (bot - top) * uy;
    }
    function fb(x, y, oct) {
      var sum = 0, amp = 0.5;
      for (var i = 0; i < oct; i++) {
        sum += amp * gn(x, y);
        var nx = 0.8 * x + 0.6 * y, ny = -0.6 * x + 0.8 * y;
        x = nx * 2.03; y = ny * 2.03; amp *= 0.5;
      }
      return sum;
    }
    var b255 = function (v) { return Math.max(0, Math.min(255, Math.round((v * 0.5 + 0.5) * 255))); };
    for (var yi = 0; yi < N; yi++) {
      var u = yi / (N - 1);
      for (var xi = 0; xi < N; xi++) {
        var sp = xi / (N - 1), o = (yi * N + xi) * 4;
        d[o]     = b255(fb(u * 70.0, sp * 16.0, 4));
        d[o + 1] = b255(gn(u * 165.0, sp * 52.0));
        d[o + 2] = b255(fb(sp * 4.5, u * 3.0, 3));
        d[o + 3] = b255(fb(sp * 6.5 + 4.0, u * 4.5, 3));
      }
    }
    ctx.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(cv);
    t.flipY = false;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }

  function wingMaterial(hind, bend, tex, uni) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uKeyDir: uni.uKeyDir, uKeyCol: uni.uKeyCol, uAmbCol: uni.uAmbCol,
        uBend: bend, uHind: { value: hind ? 1 : 0 }, uTex: { value: tex }
      },
      side: THREE.DoubleSide,
      extensions: { derivatives: true },
      vertexShader: [
        'uniform float uBend;',
        'varying vec2 vUv; varying vec3 vN; varying vec3 vW;',
        'void main(){',
        '  vUv = uv;',
        '  vec3 p = position;',
        '  float s = uv.x;',
        '  p.y += uBend * s * s;',
        '  p.z += uBend * s * s * (uv.y - 0.45) * 0.35;',
        '  vN = normalize(normalMatrix * normal);',
        '  vec4 wp = modelMatrix * vec4(p, 1.0);',
        '  vW = wp.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision highp float;',
        'uniform vec3 uKeyDir, uKeyCol, uAmbCol;',
        'uniform float uHind;',
        'uniform sampler2D uTex;',
        'varying vec2 vUv; varying vec3 vN; varying vec3 vW;',
        'void main(){',
        '  float s = vUv.x, u = vUv.y;',
        '  vec3 N = normalize(vN);',
        '  if (!gl_FrontFacing) N = -N;',
        '  vec3 V = normalize(cameraPosition - vW);',
        '  float facing = abs(dot(N, V));',
        '  vec3 face = vec3(0.520, 0.500, 0.430);',
        '  vec3 edge = vec3(0.160, 0.150, 0.130);',
        '  vec3 wing = mix(edge, face, pow(facing, 0.65));',
        '  wing *= 0.62 + 0.72 * smoothstep(0.02, 0.46, s) * (1.0 - 0.34 * smoothstep(0.45, 1.0, u));',
        '  vec4 tx = texture2D(uTex, vUv);',
        '  float rows = tx.r, grain = tx.g, mottle = tx.b, shim = tx.a;',
        '  wing *= 0.78 + 0.44 * mottle;',
        '  wing = mix(wing * vec3(0.88, 0.94, 1.08), wing * vec3(1.12, 1.02, 0.86), shim);',
        '  vec3 dark  = vec3(0.030, 0.026, 0.024);',
        '  vec3 cream = vec3(0.520, 0.500, 0.400);',
        '  vec3 amber = vec3(0.400, 0.270, 0.120);',
        '  float border = max(smoothstep(0.60, 0.74, s), smoothstep(0.78, 0.94, u));',
        '  vec3 c = mix(wing, dark, border);',
        '  float vp = pow(u, 0.72) * 5.2 + s * 0.55 + (mottle - 0.5) * 0.22;',
        '  float vk = abs(fract(vp) - 0.5) * 2.0;',
        '  float aa = fwidth(vp) * 2.0 + 0.045;',
        '  float vw = 0.050 * (1.0 - 0.42 * s);',
        '  float vein = 1.0 - smoothstep(vw, vw + aa, vk);',
        '  c = mix(c, vec3(0.330, 0.310, 0.260), vein * 0.26 * (1.0 - border * 0.85));',
        '  float lunBand = exp(-pow((border - 0.58) / 0.20, 2.0));',
        '  float edgeT = u * 0.62 + s * 0.58;',
        '  float lun = exp(-pow((fract(edgeT * 7.0) - 0.5) * 4.2, 2.0));',
        '  c = mix(c, mix(cream, amber, uHind), border * lunBand * lun * 0.90);',
        '  float ap1 = exp(-pow((s - 0.86) / 0.085, 2.0)) * exp(-pow((u - 0.15) / 0.100, 2.0));',
        '  float ap2 = exp(-pow((s - 0.66) / 0.070, 2.0)) * exp(-pow((u - 0.07) / 0.075, 2.0));',
        '  c = mix(c, cream, (1.0 - uHind) * clamp(ap1 + ap2 * 0.75, 0.0, 1.0) * 0.42);',
        '  c *= 0.88 + 0.25 * rows;',
        '  c *= 0.935 + 0.13 * grain;',
        '  float rim = clamp(smoothstep(0.93, 1.0, s) + smoothstep(0.955, 1.0, u), 0.0, 1.0);',
        '  c = mix(c, vec3(0.230, 0.220, 0.200), rim * 0.55);',
        '  float wrap = dot(N, uKeyDir) * 0.5 + 0.5;',
        '  vec3 lit = c * (uKeyCol * (0.34 + 1.05 * wrap) + uAmbCol * (0.5 + 0.5 * N.y) * 1.5);',
        '  float back = pow(max(dot(V, -uKeyDir), 0.0), 2.4);',
        '  lit += mix(vec3(0.80, 0.76, 0.62), vec3(0.34, 0.32, 0.30), border) * back * 0.42;',
        '  float sheen = pow(max(dot(reflect(-uKeyDir, N), V), 0.0), 26.0);',
        '  lit += vec3(0.90, 0.92, 1.00) * sheen * 0.34 * (1.0 - border);',
        '  gl_FragColor = vec4(lit, 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n')
    });
  }

  function buildButterfly(host, limbs, uni) {
    var group = new THREE.Group();
    var bend = { fore: { value: 0 }, hind: { value: 0 } };
    var tex = wingTexture();
    var foreG = wingGeometry(false), hindG = wingGeometry(true);
    var foreM = wingMaterial(false, bend.fore, tex, uni), hindM = wingMaterial(true, bend.hind, tex, uni);

    var wR1 = new THREE.Mesh(foreG, foreM), wL1 = new THREE.Mesh(foreG, foreM);
    var wR2 = new THREE.Mesh(hindG, hindM), wL2 = new THREE.Mesh(hindG, hindM);
    wL1.scale.x = -1; wL2.scale.x = -1;
    wR1.position.set(0.012, 0.012, 0); wL1.position.copy(wR1.position);
    wR2.position.set(0.010, 0.000, 0); wL2.position.copy(wR2.position);
    group.add(wR1, wL1, wR2, wL2);

    var bodyMat = new THREE.ShaderMaterial({
      uniforms: { uKeyDir: uni.uKeyDir, uKeyCol: uni.uKeyCol, uAmbCol: uni.uAmbCol },
      vertexShader: [
        'varying vec3 vN; varying vec3 vW; varying vec3 vP;',
        'void main(){',
        '  vN = normalize(normalMatrix * normal); vP = position;',
        '  vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: NOISE_GLSL + [
        'precision highp float;',
        'uniform vec3 uKeyDir, uKeyCol, uAmbCol;',
        'varying vec3 vN; varying vec3 vW; varying vec3 vP;',
        'void main(){',
        '  vec3 N = normalize(vN);',
        '  float band = 0.5 + 0.5 * sin(vP.z * 150.0);',
        '  float furry = smoothstep(-0.02, 0.10, vP.z);',
        '  vec3 base = mix(vec3(0.020, 0.019, 0.016), vec3(0.070, 0.066, 0.052), band * (1.0 - furry * 0.5));',
        '  float fleck = smoothstep(0.86, 0.99, sin(vP.z * 120.0) * sin(atan(vP.y, vP.x) * 7.0) * 0.5 + 0.5);',
        '  base = mix(base, vec3(0.42, 0.40, 0.32), fleck * 0.75);',
        '  float fur = gfbm(vec2(atan(vP.y, vP.x) * 9.0, vP.z * 70.0)) * 0.5 + 0.5;',
        '  base *= mix(1.0, 0.62 + 0.85 * fur, furry);',
        '  float d = max(dot(N, uKeyDir), 0.0);',
        '  vec3 col = base * (uKeyCol * (0.24 + 1.35 * d) + uAmbCol * (0.5 + 0.5 * N.y) * 1.8);',
        '  vec3 V = normalize(cameraPosition - vW);',
        '  col += uKeyCol * pow(max(dot(reflect(-uKeyDir, N), V), 0.0), 22.0) * 0.05;',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n')
    });

    (function () {
      var N = 30, R = 9, pos = [], idx = [], i, j;
      for (i = 0; i <= N; i++) {
        var a = i / N;
        var r = 0.014 + 0.026 * Math.sin(Math.PI * Math.pow(a, 0.80));
        r += 0.020 * Math.exp(-Math.pow((a - 0.70) / 0.14, 2));
        r += 0.013 * Math.exp(-Math.pow((a - 0.97) / 0.05, 2));
        var z = -0.55 + a * 0.72;
        for (j = 0; j <= R; j++) {
          var th = (j / R) * TAU;
          pos.push(Math.cos(th) * r, Math.sin(th) * r * 0.90, z);
        }
      }
      for (i = 0; i < N; i++) for (j = 0; j < R; j++) {
        var q = i * (R + 1) + j, w = q + R + 1;
        idx.push(q, w, q + 1, w, w + 1, q + 1);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      group.add(new THREE.Mesh(g, bodyMat));

      [1, -1].forEach(function (sx) {
        var teg = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 9), bodyMat);
        teg.position.set(0.030 * sx, 0.026, 0.020);
        teg.scale.set(1.15, 0.62, 1.5);
        teg.rotation.z = -0.35 * sx;
        group.add(teg);
      });

      var antMat = new THREE.MeshBasicMaterial({ color: 0x1a1612 });
      [1, -1].forEach(function (sx) {
        var c = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0.010 * sx, 0.020, 0.150),
          new THREE.Vector3(0.062 * sx, 0.075, 0.300),
          new THREE.Vector3(0.105 * sx, 0.110, 0.430));
        group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.0042, 5, false), antMat));
        var club = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), antMat);
        club.position.copy(c.getPointAt(1)); club.scale.z = 1.9;
        group.add(club);
      });
    })();

    group.scale.setScalar(0.19);
    group.renderOrder = 5;
    group.traverse(function (o) { o.frustumCulled = false; });
    host.add(group);

    /* ---- the perch: the top of the bough where it crests the card ---- */
    var L = limbs[0];
    var pp = new THREE.Vector3(), pn = new THREE.Vector3();
    var probeP = new THREE.Vector3(), probeN = new THREE.Vector3();
    var perchT = 0.40, bestY = -2, perchTh = 0;
    for (var i = 0; i < 64; i++) {
      var th = i / 64 * TAU;
      limbSurface(L, perchT, th, probeP, probeN);
      var score = probeN.y + probeN.z * 0.42;
      if (score > bestY) { bestY = score; perchTh = th; pp.copy(probeP); pn.copy(probeN); }
    }
    var perch = pp.clone().addScaledVector(pn, 0.06);

    var st = {
      pos: perch.clone().add(new THREE.Vector3(-1.0, 1.1, 0.5)),
      vel: new THREE.Vector3(0.5, 0, 0),
      acc: new THREE.Vector3(),
      tgt: new THREE.Vector3(),
      mode: 'cruise', timer: 4.0, settle: 0, bank: 0, flap: 0
    };
    var BOX = { x0: perch.x - 1.6, x1: perch.x + 1.6, y0: perch.y - 0.10, y1: perch.y + 1.35,
                z0: perch.z - 0.25, z1: perch.z + 0.95 };

    function pickTarget() {
      st.tgt.set(rand(BOX.x0 + 0.3, BOX.x1 - 0.3), rand(perch.y + 0.35, BOX.y1 - 0.2), rand(BOX.z0 + 0.2, BOX.z1 - 0.15));
    }
    pickTarget();

    var landQ = new THREE.Quaternion();
    (function () {
      var camLocal = new THREE.Vector3(0, 0, DIST);
      host.worldToLocal(camLocal);
      var dorsal = camLocal.sub(perch).normalize();
      var fwd = new THREE.Vector3(0, 1, 0).addScaledVector(dorsal, -dorsal.y).normalize();
      var right = new THREE.Vector3().crossVectors(dorsal, fwd).normalize();
      landQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, dorsal, fwd));
      landQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.10));
      landQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.14));
    })();

    var SPOOK_R = 0.62;
    var spook = 0, toM = new THREE.Vector3(), away = new THREE.Vector3(0, 1, 0);
    var tmp = new THREE.Vector3(), prevVel = new THREE.Vector3();
    var vRight = new THREE.Vector3(), vUp = new THREE.Vector3(), vFwd = new THREE.Vector3();
    var basis = new THREE.Matrix4(), flightQ = new THREE.Quaternion(), qTmp = new THREE.Quaternion();
    var AX_X = new THREE.Vector3(1, 0, 0), AX_Z = new THREE.Vector3(0, 0, 1);

    function contain(out) {
      var k = 2.2, m = 0.30;
      if (st.pos.x < BOX.x0 + m) out.x += k * (BOX.x0 + m - st.pos.x);
      if (st.pos.x > BOX.x1 - m) out.x -= k * (st.pos.x - BOX.x1 + m);
      if (st.pos.y < BOX.y0 + m) out.y += k * (BOX.y0 + m - st.pos.y);
      if (st.pos.y > BOX.y1 - m) out.y -= k * (st.pos.y - BOX.y1 + m);
      if (st.pos.z < BOX.z0 + m) out.z += k * (BOX.z0 + m - st.pos.z);
      if (st.pos.z > BOX.z1 - m) out.z -= k * (st.pos.z - BOX.z1 + m);
    }

    return function update(dt, t) {
      var m = uMouseNear.value, near = 0;
      if (m.x < 999) {
        toM.set(m.x - st.pos.x, m.y - st.pos.y, (m.z - st.pos.z) * 0.30);
        near = clamp01(1 - toM.length() / SPOOK_R);
        near *= near;
      }
      spook += (near - spook) * (1 - Math.pow(near > spook ? 1e-7 : 0.22, dt));

      st.timer -= dt;
      if (st.mode === 'cruise') { if (st.timer <= 0) { st.mode = 'approach'; st.timer = 14; } }
      else if (st.mode === 'approach') { if (st.pos.distanceTo(perch) < 0.12 || st.timer <= 0) { st.mode = 'landed'; st.timer = rand(7.0, 10.0); } }
      else if (st.mode === 'landed') {
        if (st.timer <= 0 || spook > 0.30) {
          st.mode = 'takeoff'; st.timer = 2.2;
          if (spook > 0.30) {
            away.copy(st.pos).sub(m).setZ(0).normalize();
            st.tgt.set(
              Math.min(BOX.x1 - 0.3, Math.max(BOX.x0 + 0.3, st.pos.x + away.x * 1.5)),
              Math.min(BOX.y1 - 0.2, perch.y + 0.9),
              Math.min(BOX.z1 - 0.15, Math.max(BOX.z0 + 0.2, st.pos.z + 0.4)));
          }
        }
      }
      else if (st.mode === 'takeoff') { if (st.timer <= 0) { st.mode = 'cruise'; st.timer = rand(5.0, 8.5); pickTarget(); } }

      var landing = st.mode === 'landed';
      st.settle += ((landing ? 1 : 0) - st.settle) * Math.min(1, dt * (landing ? 3.4 : 4.5));
      st.settle = Math.min(st.settle, 1 - spook);

      var beat = 8.6 + Math.sin(t * 0.7) * 0.9 + (0.34 - (8.6 + Math.sin(t * 0.7) * 0.9)) * st.settle;
      beat *= 1 + spook * 1.15;
      st.flap += dt * beat * TAU;
      var raw = Math.sin(st.flap);
      var shaped = (raw < 0 ? -1 : 1) * Math.pow(Math.abs(raw), 0.72);
      var flyPhi = 20 + 48 * shaped, restPhi = 15 + 7 * shaped + spook * 30;
      var phi = (flyPhi + (restPhi - flyPhi) * st.settle) * Math.PI / 180;
      var flapVel = Math.cos(st.flap) * beat;

      wR1.rotation.z = phi;  wL1.rotation.z = -phi;
      wR2.rotation.z = phi * 0.95 - 0.03;
      wL2.rotation.z = -(phi * 0.95 - 0.03);
      bend.fore.value = -flapVel * 0.010;
      bend.hind.value = -flapVel * 0.013;

      var goal = st.mode === 'approach' ? perch : st.tgt;
      tmp.copy(goal).sub(st.pos);
      var dist = tmp.length();
      var speed = Math.min(1.5, 0.22 + dist * 1.1);
      var desired = tmp.normalize().multiplyScalar(speed);

      var wander = st.mode === 'approach' ? Math.min(1, dist * 0.8) : 1;
      desired.x += (Math.sin(t * 3.1) + 0.6 * Math.sin(t * 7.7 + 1.1)) * 0.20 * wander;
      desired.y += (Math.sin(t * 1.9 + 1.7) + 0.55 * Math.sin(t * 4.6)) * 0.40 * wander;
      desired.z += Math.sin(t * 2.7 + 3.4) * 0.24 * wander;
      if (st.mode === 'takeoff') { desired.y += 0.7; desired.z += 0.35; }
      if (spook > 0.002) {
        away.copy(st.pos).sub(m); away.z *= 0.30;
        if (away.lengthSq() > 1e-6) desired.addScaledVector(away.normalize(), spook * 2.3);
      }
      contain(desired);

      prevVel.copy(st.vel);
      st.vel.lerp(desired, 1 - Math.pow(0.03, dt));
      st.acc.copy(st.vel).sub(prevVel).divideScalar(Math.max(dt, 1e-4));
      st.pos.addScaledVector(st.vel, dt);
      if (st.settle > 0.001) {
        st.pos.lerp(perch, Math.min(1, dt * 6.0 * st.settle));
        st.vel.multiplyScalar(1 - Math.min(1, dt * 6.0 * st.settle));
      }

      vFwd.copy(st.vel);
      if (vFwd.lengthSq() < 1e-6) vFwd.set(0, 0, 1);
      vFwd.normalize();
      vRight.crossVectors(vFwd, UP);
      if (vRight.lengthSq() < 1e-6) vRight.set(1, 0, 0);
      vRight.normalize();
      vUp.crossVectors(vRight, vFwd).normalize();

      var lateral = vRight.dot(st.acc);
      st.bank += (Math.max(-1.15, Math.min(1.15, -lateral * 0.40)) - st.bank) * Math.min(1, dt * 5.0);

      basis.makeBasis(vRight, vUp, vFwd);
      flightQ.setFromRotationMatrix(basis);
      qTmp.setFromAxisAngle(AX_Z, st.bank + Math.sin(t * 0.83) * 0.30 + Math.sin(st.flap) * 0.05
                                  + Math.sin(t * 21.0) * spook * 0.16);
      flightQ.multiply(qTmp);
      qTmp.setFromAxisAngle(AX_X, Math.sin(st.flap) * 0.10 - 0.06);
      flightQ.multiply(qTmp);

      group.quaternion.copy(flightQ).slerp(landQ, st.settle);
      group.position.copy(st.pos);
      group.position.y += Math.sin(st.flap - 0.9) * 0.022 * (1 - st.settle);
    };
  }

  /* ── size the scene in stage-pixel space ─────────────────────────── */
  function layout() {
    W = hero.clientWidth; H = hero.clientHeight;
    renderer.setSize(W, H, false);
    camera.fov = 2 * Math.atan((H / 2) / DIST) * 180 / Math.PI;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();

    var narrow = NARROW.matches;
    var s = stageEl.getBoundingClientRect();
    var h = hero.getBoundingClientRect();
    var u = s.width / (narrow ? 760 : 1600);
    var ox = s.left - h.left, oy = s.top - h.top;
    function wx(px) { return ox + px * u - W / 2; }
    function wy(py) { return H / 2 - (oy + py * u); }

    var A = narrow ? ARCH_N : ARCH, F = narrow ? FAR_N : FAR;
    var cover = Math.max(1, W / s.width);

    function place(group, box, pinFx, pinFy, z) {
      var boxH = box.w / box.aspect;
      var scale = box.w * u * cover / BOXW;
      var k = (DIST - z) / DIST;
      var lx = (pinFx - 0.5) * BOXW, ly = (0.5 - pinFy) * (BOXW / box.aspect);
      var px = wx(box.left + pinFx * box.w), py = wy(box.top + pinFy * boxH);
      group.scale.setScalar(scale * k);
      group.position.set((px - lx * scale) * k, (py - ly * scale) * k, z);
      return { x: px, y: py, s: scale, boxH: boxH * u * cover };
    }

    /* the near bough pins at its crest over the card; the far one at its crest */
    place(nearGroup, A, 0.716, 0.293, 0);
    place(farGroup,  F, 0.410, 0.32, F.z);

    var aw = A.w * u * cover, ah = aw / A.aspect;
    var cx = wx(A.left + 0.5 * A.w), cy = wy(A.top + 0.5 * (A.w / A.aspect));

    shadowMesh.scale.set(aw * 1.02, ah * 0.72, 1);
    shadowMesh.position.set(cx, cy - ah * 0.40, -70);

    glowMesh.scale.set(aw * 1.15, ah * 1.5, 1);
    glowMesh.position.set(cx - aw * 0.06, cy - ah * 0.18, -320);

    nearGroup.updateMatrixWorld(true);
    uScanO.value.set(-5.2, -0.9, 1.8);
    nearGroup.localToWorld(uScanO.value);
    scanMax = Math.hypot(W, H) * 1.3 + 900;

    motes.material.uniforms.uSize.value = Math.max(7, 14 * u);
    var half = renderer.getDrawingBufferSize(new THREE.Vector2()).y * 0.5;
    motes.material.uniforms.uScale.value = half;
    if (spray) {
      spray.material.uniforms.uScale.value = half;
      spray.material.uniforms.uSize.value = Math.max(8, 16 * u);
    }
  }

  /* ── cursor → the plane the bough stands in ─────────────────────── */
  var raycaster = new THREE.Raycaster();
  var crownPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  var hitWorld = new THREE.Vector3();
  var tmpLocal = new THREE.Vector3();
  var mouseLive = false;

  function updateMouse(dt) {
    if (ndc.x > 2 || REDUCED) { mouseLive = false; }
    else {
      raycaster.setFromCamera(ndc, camera);
      mouseLive = !!raycaster.ray.intersectPlane(crownPlane, hitWorld);
    }
    [[nearGroup, uMouseNear], [farGroup, uMouseFar]].forEach(function (pair) {
      var g = pair[0], u2 = pair[1];
      if (!g) return;
      if (!mouseLive) { u2.value.set(9999, 9999, 9999); return; }
      tmpLocal.copy(hitWorld);
      g.worldToLocal(tmpLocal);
      if (u2.value.x > 999) u2.value.copy(tmpLocal);
      else u2.value.lerp(tmpLocal, 1 - Math.pow(0.0002, dt));
    });
  }

  /* ── frame ──────────────────────────────────────────────────────── */
  var frames = 0;
  function renderFrame() {
    var dt = Math.min(clock.getDelta(), 0.05);
    if (!REDUCED) uTime.value += dt;

    camera.position.x = -smooth.x * 26;
    camera.position.y =  smooth.y * 16;
    camera.lookAt(camera.position.x * 0.42, camera.position.y * 0.42, 0);

    if (!REDUCED) {
      nearGroup.rotation.y = smooth.x * 0.055;
      nearGroup.rotation.x = smooth.y * 0.026;
      nearGroup.rotation.z = Math.sin(uTime.value * 0.22) * 0.0022;
      farGroup.rotation.y  = smooth.x * 0.030;
    }

    if (scanning) {
      scanT += dt / SCAN_DUR;
      /* a tab that was hidden mid-pulse never advances the clock; after a
         few seconds of wall time just finish the reveal */
      if (Date.now() - scanStart > 7000) scanT = 1;
      var e = Math.min(1, scanT);
      uScanR.value = (1 - Math.pow(1 - e, 1.35)) * scanMax;
      uWire.value = Math.min(1, e / 0.06) * (1 - sstep(0.72, 1.0, e));
      if (e >= 1) {
        scanning = false;
        uScanOn.value = 0;
        uWire.value = 0;
        for (var wi = 0; wi < wireMeshes.length; wi++) {
          var wm = wireMeshes[wi];
          if (wm.parent) wm.parent.remove(wm);
          wm.geometry.dispose(); wm.material.dispose();
        }
        wireMeshes.length = 0;
      }
    }

    if (bf && !REDUCED) bf(dt, uTime.value);

    updateMouse(dt);
    emitSpray(dt);

    renderer.render(scene, camera);
    if (++frames === 2) window.__ready = true;
  }

  /* ── boot ───────────────────────────────────────────────────────── */
  ready();
  requestAnimationFrame(function () { requestAnimationFrame(function () {
    try { build(); }
    catch (err) { console.error(err); }
  }); });

  setTimeout(ready, 4000);
})();
