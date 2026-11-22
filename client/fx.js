let layer = null, cx = null, W = 0, H = 0, dpr = 1;
let parts = [], ribbons = [], ripples = [], seals = [], running = false, lastT = 0;
let strength = 1, reduced = false;

function ensure(canvas) {
  if (!canvas) return false;
  if (!layer) {
    layer = document.createElement('canvas');
    layer.id = 'fxLayer';
    layer.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6';
    if (canvas.parentElement) canvas.parentElement.appendChild(layer);
    else return false;
  }
  const r = canvas.getBoundingClientRect();
  const nw = r.width || canvas.clientWidth || 320, nh = r.height || canvas.clientHeight || 320;
  const nd = Math.min((window.__YJ_QUALITY__ || {}).dpr || 2, window.devicePixelRatio || 1);
  if (nw === W && nh === H && nd === dpr && cx) return true;
  W = nw; H = nh; dpr = nd;
  layer.width = Math.round(W * dpr); layer.height = Math.round(H * dpr);
  layer.style.width = W + 'px'; layer.style.height = H + 'px';
  cx = layer.getContext('2d');
  if (cx) cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return !!cx;
}

let lastVer = -1, fxP = {}, trailP = {}, cfg = {};
function conf() {
  const ver = window.__YJ_SETTINGS_VER__ || 0;
  if (ver === lastVer && lastVer >= 0) return;
  lastVer = ver;
  const st = window.__YJ_SETTINGS__ || {};
  const q = window.__YJ_QUALITY__ || { particle: 1 };
  const sys = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  reduced = !!(st.reduceSystem !== false && sys);
  const level = st.fxMaster === false ? 0 : (typeof st.fxLevel === 'number' ? st.fxLevel : 55);
  strength = (reduced || level <= 0) ? 0 : Math.min(1.6, level / 100 * (q.particle || 1));
  const w = window.__YJ_WEAR__ || {};
  fxP = (w.fx && w.fx.p) || {};
  trailP = (w.trail && w.trail.p) || {};
  cfg = st;
}

function rand(a, b) { return a + Math.random() * (b - a); }
function ink() {
  const s = getComputedStyle(document.documentElement);
  return {
    accent: (s.getPropertyValue('--accent') || '#b4552d').trim() || '#b4552d',
    ink: (s.getPropertyValue('--ink') || '#2b2a26').trim() || '#2b2a26',
    tile: (s.getPropertyValue('--tile') || '#fbf8ef').trim() || '#fbf8ef'
  };
}

function burst(x, y, n, color, opt) {
  const o = opt || {};
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(o.sp0 || 18, o.sp1 || 72) * strength;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0),
      life: rand(.45, .95), max: 1, r: rand(1.1, o.r || 2.6), c: color,
      g: o.g === undefined ? 42 : o.g, tw: Math.random() * 6.28 });
  }
}
function ripple(x, y, color, big) {
  ripples.push({ x, y, t: 0, dur: big ? .95 : .62,
    c: trailP.c || color, w: parseFloat(trailP.w || 1), big: !!big });
}
function ribbon(color, dir) {
  ribbons.push({ t: 0, dur: .72, c: color, dir: dir || 1 });
}
function seal(x, y, color) {
  seals.push({ x, y, t: 0, dur: .82, c: color });
}

function onMove(prev, next) {
  if (!strength) return;
  const c = ink();
  const cells = next.cells || [], old = (prev && prev.cells) || [];
  let sx = W * .5, sy = H * .5, found = false, cnt = 0;
  const w = next.w || 1;
  for (let i = 0; i < cells.length; i++) {
    if ((cells[i] || '') !== (old[i] || '')) {
      if (!found) {
        const step = Math.min((W - 36) / Math.max(1, w), (H - 36) / Math.max(1, next.h || w));
        sx = 18 + (i % w + .5) * step;
        sy = 18 + (Math.floor(i / w) + .5) * step;
        found = true;
      }
      cnt++;
    }
  }
  if (!found && next.hands) {
    const nh = JSON.stringify(next.hands), oh = prev ? JSON.stringify(prev.hands) : '';
    if (nh !== oh) found = true;
  }
  if (cfg.fxTrail !== false) ripple(sx, sy, c.accent, false);
  const spark = parseFloat(fxP.spark || 1);
  burst(sx, sy, Math.round((10 * spark) * strength + 4), c.accent, { sp1: 60 * spark, r: 2.2 });
  if (fxP.gold) {
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2;
      ribbons.push({ t: 0, dur: .55, c: c.accent, x: sx, y: sy,
        vx: Math.cos(a) * 150 * strength, vy: Math.sin(a) * 150 * strength, line: true });
    }
  }
  if (cnt > 3 && cfg.fxTrail !== false) seal(sx, sy, c.accent);
}

function onPhase(prev, next) {
  if (!strength) return;
  const c = ink();
  if (cfg.fxCurtain !== false) ribbon(c.ink, 1);
  if (fxP.moon) ripple(W * .5, H * .32, c.tile, true);
  seal(W * .5, H * .32, c.accent);
  burst(W * .5, H * .32, Math.round(14 * strength + 4), c.accent, { sp1: 110, lift: 14 });
}

function onEnd(next) {
  if (!strength) return;
  const c = ink();
  const win = !!(next.winner && String(next.winner).length);
  if (cfg.fxFinale === false) { ripple(W * .5, H * .5, c.accent, false); return; }
  ribbon(win ? c.accent : c.ink, win ? 1 : -1);
  ripple(W * .5, H * .5, win ? c.accent : c.ink, true);
  const spark = parseFloat(fxP.spark || 1), waves = parseInt(fxP.wave || 0, 10);
  burst(W * .5, H * .5, Math.round((38 * spark) * strength + 12),
    win ? c.accent : c.ink, { sp0: 40, sp1: 150 * spark, r: 2.8, lift: 30 });
  for (let k = 0; k < waves; k++) ribbons.push({ t: -k * .12, dur: 1.1, c: c.accent, wave: true, k: k });
  if (fxP.star) {
    for (let k = 0; k < 26; k++)
      parts.push({ x: rand(0, W), y: -rand(0, H * .4), vx: rand(-8, 8), vy: rand(40, 110) * strength,
        life: rand(1.1, 2.0), max: 2, r: rand(.8, 2.0), c: c.accent, g: 12, tw: Math.random() * 6.28, star: true });
  }
  seal(W * .5, H * .5, c.accent);
}

function frame(t) {
  if (!running || !cx) return;
  const dt = Math.min(.05, (t - lastT) / 1000 || .016); lastT = t;
  cx.clearRect(0, 0, W, H);
  cx.save(); cx.globalCompositeOperation = 'source-over';

  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i]; r.t += dt;
    const k = r.t / r.dur; if (k >= 1) { ripples.splice(i, 1); continue; }
    cx.beginPath(); cx.arc(r.x, r.y, (r.big ? 18 : 8) + k * (r.big ? Math.max(W, H) * .42 : 34), 0, 7);
    cx.strokeStyle = r.c; cx.globalAlpha = (1 - k) * .55 * strength;
    cx.lineWidth = ((r.big ? 2.4 : 1.4) * r.w) * (1 - k) + .4; cx.stroke();
    if (r.big) { cx.beginPath(); cx.arc(r.x, r.y, 10 + k * Math.max(W, H) * .22, 0, 7);
      cx.globalAlpha = (1 - k) * .22 * strength; cx.lineWidth = r.w; cx.stroke(); }
  }

  for (let i = ribbons.length - 1; i >= 0; i--) {
    const r = ribbons[i]; r.t += dt;
    if (r.t < 0) continue;
    const k = r.t / r.dur; if (k >= 1) { ribbons.splice(i, 1); continue; }
    cx.globalAlpha = (1 - k) * .5 * strength;
    if (r.line) {
      cx.beginPath(); cx.moveTo(r.x, r.y);
      cx.lineTo(r.x + r.vx * k, r.y + r.vy * k);
      cx.strokeStyle = r.c; cx.lineWidth = 1.2 * (1 - k) + .3; cx.stroke();
    } else if (r.wave) {
      cx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const y = H * (.55 + r.k * .09) + Math.sin(x * .018 + k * 6 + r.k) * (10 + k * 26);
        x === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
      }
      cx.strokeStyle = r.c; cx.lineWidth = 2 * (1 - k) + .4; cx.stroke();
    } else {
      const x = r.dir > 0 ? -W * .2 + k * W * 1.4 : W * 1.2 - k * W * 1.4;
      const grd = cx.createLinearGradient(x - W * .18, 0, x + W * .18, 0);
      grd.addColorStop(0, 'transparent'); grd.addColorStop(.5, r.c); grd.addColorStop(1, 'transparent');
      cx.fillStyle = grd; cx.globalAlpha = (1 - k) * .16 * strength;
      cx.beginPath(); cx.moveTo(x - W * .18, 0); cx.lineTo(x + W * .18, 0);
      cx.lineTo(x + W * .10 + 26, H); cx.lineTo(x - W * .26 + 26, H); cx.closePath(); cx.fill();
    }
  }

  for (let i = seals.length - 1; i >= 0; i--) {
    const s = seals[i]; s.t += dt;
    const k = s.t / s.dur; if (k >= 1) { seals.splice(i, 1); continue; }
    const sc = .6 + Math.min(1, k * 3) * .5, a = (1 - k) * .7 * strength;
    cx.save(); cx.translate(s.x, s.y); cx.rotate((1 - sc) * .3); cx.scale(sc, sc);
    cx.globalAlpha = a; cx.strokeStyle = s.c; cx.lineWidth = 2;
    cx.strokeRect(-16, -16, 32, 32); cx.strokeRect(-11, -11, 22, 22);
    cx.beginPath(); cx.moveTo(-6, 0); cx.lineTo(6, 0); cx.moveTo(0, -6); cx.lineTo(0, 6); cx.stroke();
    cx.restore();
  }

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const a = Math.max(0, Math.min(1, p.life / p.max)) * strength;
    cx.globalAlpha = a * (.6 + .4 * Math.sin(p.tw + p.life * 9));
    cx.fillStyle = p.c;
    if (p.star) {
      cx.beginPath(); cx.moveTo(p.x, p.y - p.r * 2); cx.lineTo(p.x + p.r * .6, p.y - p.r * .6);
      cx.lineTo(p.x + p.r * 2, p.y); cx.lineTo(p.x + p.r * .6, p.y + p.r * .6);
      cx.lineTo(p.x, p.y + p.r * 2); cx.lineTo(p.x - p.r * .6, p.y + p.r * .6);
      cx.lineTo(p.x - p.r * 2, p.y); cx.lineTo(p.x - p.r * .6, p.y - p.r * .6);
      cx.closePath(); cx.fill();
    } else { cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); }
  }
  cx.restore();
  requestAnimationFrame(frame);
}
function start() {
  if (running || !cx || !strength) return;
  running = true; lastT = performance.now(); requestAnimationFrame(frame);
}

export const Fx = {
  observe(prev, next, canvas) {
    conf();
    if (!strength) { if (layer && cx) cx.clearRect(0, 0, W, H); return; }
    if (!ensure(canvas)) return;
    start();
    if (!next) return;
    if (prev && next.ended && !prev.ended) { onEnd(next); return; }
    if (prev && prev.phase !== next.phase) onPhase(prev, next);
    if (prev && (prev.moveNo !== next.moveNo || prev.seq !== next.seq)) onMove(prev, next);
  },
  resize(canvas) { if (layer) { layer = null; running = false; } ensure(canvas); start(); },
  reset() { parts = []; ribbons = []; ripples = []; seals = []; if (cx) cx.clearRect(0, 0, W, H); }
};
