

const XQ = {
  rK:'帥',bK:'將',rA:'仕',bA:'士',rB:'相',bB:'象',rN:'傌',bN:'馬',
  rR:'俥',bR:'車',rC:'炮',bC:'砲',rP:'兵',bP:'卒',
  '?':'？'
};
const CHESS = { wK:'王',wQ:'后',wR:'車',wB:'象',wN:'馬',wP:'兵', bK:'王',bQ:'后',bR:'車',bB:'象',bN:'馬',bP:'卒' };
const SHOGI = { K:'玉',R:'飛',B:'角',G:'金',S:'銀',N:'桂',L:'香',P:'歩' };
const ZI = ['東','南','西','北','中','發','白'];
const SUIT = { S:'玄', H:'丹', C:'碧', D:'杏' };
const SUIT_STYLE = {
  S:{ tone:'ink',  heavy:false },
  H:{ tone:'red',  heavy:true  },
  C:{ tone:'ink',  heavy:true  },
  D:{ tone:'red',  heavy:false }
};
const ZI_STYLE = [
  ['ink',false],['ink',true],['ink',false],['ink',true],
  ['red',true],['ink',true],['ink',false]
];
const COLOR_TONE = { R:['red',true], Y:['gold',false], G:['green',true], B:['blue',false] };
const CROSS_GAMES = new Set(['xiangqi','jieqi','go','gomoku','renju','connect6','tiaogi','mills']);
const PATH_GAMES = new Set(['feixingqi','monopoly']);

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
let _pal = null;
export function invalidate() { _pal = null; }
function palette() {
  if (_pal) return _pal;
  _pal = {
    bg: css('--bg') || '#f4f0e6', tile: css('--tile') || '#fbf8ef', ink: css('--ink') || '#2b2a26',
    ink2: css('--ink2') || '#6d685c', accent: css('--accent') || '#b4552d', line: css('--line') || '#d5cebc',
    edge: css('--tileEdge') || '#cdc4ad', shadow: css('--shadow') || 'rgba(60,50,35,.16)',
    shadowA: parseFloat(css('--shadowA') || '.16'), motion: parseFloat(css('--motion') || '1')
  };
  return _pal;
}
function jitter(seed, k) { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return (x - Math.floor(x) - .5); }

function disc(ctx, x, y, r, p, seed, opt) {
  const o = opt || {};
  ctx.save();
  ctx.shadowColor = p.shadow; ctx.shadowBlur = 9 * (p.shadowA / .16); ctx.shadowOffsetY = 3;
  ctx.beginPath();
  const N = 16;
  for (let k = 0; k <= N; k++) {
    const a = Math.PI * 2 * k / N - Math.PI / 2;
    const rr = r * (1 + jitter(seed, k) * .045);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * (o.squash || 1);
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = o.fill || p.tile; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = o.heavy ? 2.2 : 1.6; ctx.strokeStyle = o.edge || p.ink; ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k <= N; k++) {
    const a = Math.PI * 2 * k / N - Math.PI / 2;
    const rr = r * .86 * (1 + jitter(seed + 3, k) * .04);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * (o.squash || 1);
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.lineWidth = .7; ctx.strokeStyle = p.line; ctx.stroke();
  ctx.restore();
}
function label(ctx, text, x, y, size, color) {
  ctx.save(); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(size)}px "Songti SC","Noto Serif CJK SC","STSong",Georgia,serif`;
  ctx.fillText(text, x, y + 1); ctx.restore();
}
function legalFrom(view) {
  const r = { cell:new Set(), from:new Set(), to:new Map(), other:[] };
  for (const code of (view.legal || [])) {
    if (code.startsWith('c:') || code.startsWith('f:') || code.startsWith('x:')) r.cell.add(parseInt(code.slice(2), 10));
    else if (code.startsWith('m:') || code.startsWith('o:') || code.startsWith('d:')) {
      const [a, b] = code.slice(2).split('>').map(Number);
      r.from.add(a);
      if (!r.to.has(b)) r.to.set(b, []);
      r.to.get(b).push(code);
    } else r.other.push(code);
  }
  return r;
}

export function drawBoard(canvas, view, onPick) {
  const p = palette();
  if (!canvas || !view) return;
  const W = canvas.clientWidth || 320, H = canvas.clientHeight || 320;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const g = view.game || '';
  const cells = view.cells || [];
  const w = view.w || 0, h = view.h || 0;
  const empty = view.phase === 'wait' || (view.renderer === 'grid' && (!w || !cells.length));
  const be = document.getElementById('boardEmpty');
  if (be) be.style.display = empty ? 'flex' : 'none';
  if (empty) { canvas.onclick = null; return; }
  if (view.renderer === 'path') { drawPath(ctx, W, H, p, view); canvas.onclick = null; return; }
  if (view.renderer === 'scroll') { drawScroll(ctx, W, H, p, view); canvas.onclick = null; return; }
  if (view.renderer !== 'grid') { drawTable(ctx, W, H, p, view); canvas.onclick = null; return; }
  if (g === 'dots' || g === 'hex' || g === 'nim' || g === 'endgame') {
    drawGridExtra(ctx, W, H, p, view, onPick); return;
  }

  const L = legalFrom(view);
  const pad = Math.max(20, Math.min(W, H) * .075);
  const cross = CROSS_GAMES.has(g);
  const points = (view.info && view.info.boardPoints) ? view.info.boardPoints.map(Number) : null;
  const isPointBoard = g === 'tiaogi' || g === 'mills';
  const stepX = cross ? (W - 2 * pad) / Math.max(1, w - 1) : (W - 2 * pad) / Math.max(1, w);
  const stepY = cross ? (H - 2 * pad) / Math.max(1, h - 1) : (H - 2 * pad) / Math.max(1, h);
  const step = Math.min(stepX, stepY);
  const ox = cross ? pad + (W - 2 * pad - step * (w - 1)) / 2 : pad + (W - 2 * pad - step * w) / 2;
  const oy = cross ? pad + (H - 2 * pad - step * (h - 1)) / 2 : pad + (H - 2 * pad - step * h) / 2;
  const px = (i) => cross ? ox + (i % w) * step : ox + (i % w + .5) * step;
  const py = (i) => cross ? oy + Math.floor(i / w) * step : oy + (Math.floor(i / w) + .5) * step;
  const R = Math.min(step * .40, 26);

  ctx.save();
  ctx.strokeStyle = p.line; ctx.lineWidth = 1;
  if (g === 'xiangqi' || g === 'jieqi') {
    for (let y = 0; y < h; y++) { ctx.beginPath(); ctx.moveTo(ox, oy + y * step); ctx.lineTo(ox + (w - 1) * step, oy + y * step); ctx.stroke(); }
    for (let x = 0; x < w; x++) { ctx.beginPath(); ctx.moveTo(ox + x * step, oy); ctx.lineTo(ox + x * step, oy + 4 * step); ctx.moveTo(ox + x * step, oy + 5 * step); ctx.lineTo(ox + x * step, oy + (h - 1) * step); ctx.stroke(); }

    ctx.beginPath();
    ctx.moveTo(ox + 3 * step, oy); ctx.lineTo(ox + 5 * step, oy + 2 * step);
    ctx.moveTo(ox + 5 * step, oy); ctx.lineTo(ox + 3 * step, oy + 2 * step);
    ctx.moveTo(ox + 3 * step, oy + 7 * step); ctx.lineTo(ox + 5 * step, oy + 9 * step);
    ctx.moveTo(ox + 5 * step, oy + 7 * step); ctx.lineTo(ox + 3 * step, oy + 9 * step); ctx.stroke();

    ctx.fillStyle = p.ink2; ctx.globalAlpha = .75;
    ctx.font = `${Math.round(step * .46)}px "Songti SC",serif`; ctx.textAlign = 'center';
    ctx.fillText('楚 河', ox + step * 2, oy + step * 4.72);
    ctx.fillText('漢 界', ox + step * 6, oy + step * 4.72);
    ctx.globalAlpha = 1;

    const marks = [[1,2],[7,2],[1,7],[7,7]].concat([[0,3],[2,3],[4,3],[6,3],[8,3],[0,6],[2,6],[4,6],[6,6],[8,6]]);
    ctx.strokeStyle = p.edge; ctx.lineWidth = 1.1;
    for (const [mx, my] of marks) {
      const x = ox + mx * step, y = oy + my * step, d = step * .10, len = step * .18;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        if ((mx === 0 && sx === -1) || (mx === 8 && sx === 1)) continue;
        ctx.beginPath();
        ctx.moveTo(x + sx * d, y + sy * (d + len)); ctx.lineTo(x + sx * d, y + sy * d); ctx.lineTo(x + sx * (d + len), y + sy * d);
        ctx.stroke();
      }
    }
  } else if (isPointBoard && points) {
    const set = new Set(points);
    ctx.strokeStyle = p.line; ctx.lineWidth = 1;
    if (g === 'mills' && view.info.boardLines) {
      for (const ln of view.info.boardLines) {
        const a = ln.split(',').map(Number);
        ctx.beginPath();
        for (let k = 0; k < a.length; k++) { const X = px(a[k]), Y = py(a[k]); k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
        ctx.stroke();
      }
    } else {
      for (const i of points) {
        for (const [dx, dy] of [[1,0],[0,1],[1,-1],[1,1]]) {
          const x = i % w, y = Math.floor(i / w);
          const j = (y + dy) * w + x + dx;
          if (x + dx >= 0 && x + dx < w && set.has(j)) { ctx.beginPath(); ctx.moveTo(px(i), py(i)); ctx.lineTo(px(j), py(j)); ctx.stroke(); }
        }
      }
    }
  } else if (cross) {
    for (let y = 0; y < h; y++) { ctx.beginPath(); ctx.moveTo(ox, oy + y * step); ctx.lineTo(ox + (w - 1) * step, oy + y * step); ctx.stroke(); }
    for (let x = 0; x < w; x++) { ctx.beginPath(); ctx.moveTo(ox + x * step, oy); ctx.lineTo(ox + x * step, oy + (h - 1) * step); ctx.stroke(); }
    const stars = g === 'go' ? (w === 19 ? [3,9,15] : w === 13 ? [3,6,9] : [2,4,6]) : (w === 15 ? [3,7,11] : []);
    ctx.fillStyle = p.ink2;
    for (const a of stars) for (const b of stars) { ctx.beginPath(); ctx.arc(ox + a * step, oy + b * step, Math.max(1.6, step * .07), 0, 7); ctx.fill(); }
  } else {

    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dark = (x + y) % 2 === 1;
      ctx.fillStyle = dark ? (g === 'othello' ? mix(p.ink2, p.tile, .82) : mix(p.bg2 || p.bg, p.tile, .55)) : p.tile;
      ctx.fillRect(ox + x * step, oy + y * step, step, step);
      ctx.strokeStyle = p.line; ctx.lineWidth = .7;
      ctx.strokeRect(ox + x * step, oy + y * step, step, step);
    }
    if (g === 'chess' || g === 'chess960') {
      ctx.fillStyle = p.ink2; ctx.font = `${Math.round(step * .16)}px Georgia,serif`; ctx.textAlign = 'left';
      for (let x = 0; x < 8; x++) ctx.fillText('abcdefgh'[x], ox + x * step + 3, oy + h * step - 4);
    }
  }
  ctx.restore();

  ctx.save();
  for (const i of L.cell) {
    const x = px(i), y = py(i);
    ctx.beginPath(); ctx.arc(x, y, R * .28, 0, 7);
    ctx.fillStyle = mix(p.accent, p.tile, .68); ctx.fill();
    ctx.strokeStyle = p.accent; ctx.lineWidth = 1; ctx.stroke();
  }
  for (const i of L.from) {
    ctx.beginPath(); ctx.arc(px(i), py(i), R * 1.04, 0, 7);
    ctx.strokeStyle = mix(p.accent, p.tile, .45); ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const [i] of L.to) {
    ctx.beginPath(); ctx.arc(px(i), py(i), R * .38, 0, 7);
    ctx.strokeStyle = p.accent; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c || c === '#' || c === '?') {
      if (c === '?') {
        disc(ctx, px(i), py(i), R * .94, p, i, { fill: mix(p.ink2, p.tile, .55), edge: p.ink2, heavy: true });
        label(ctx, '？', px(i), py(i), R * .95, p.ink);
      }
      continue;
    }
    if (isPointBoard && points && !points.includes(i)) continue;
    const side = c[0] === 'w' ? 0 : c[0] === 'b' ? 1 : c[0] === 'r' ? 0 : c[0] >= 'c' ? 2 + c.charCodeAt(0) - 99 : -1;
    let text = '', fill = p.tile, edge = p.ink, heavy = false;
    if (g === 'xiangqi' || g === 'jieqi' || g === 'xiangqidark') {
      text = XQ[c] || (c[1] ? c[1] : c);
      fill = side === 0 ? p.tile : mix(p.ink2, p.tile, .78);
      edge = side === 0 ? p.accent : p.ink;
    } else if (g === 'chess' || g === 'chess960') {
      text = CHESS[c] || c.slice(1);
      fill = side === 0 ? p.tile : p.ink;
      edge = p.ink;
      label(ctx, text, px(i), py(i), R * .9, side === 0 ? p.ink : p.tile);
      disc(ctx, px(i), py(i), R * .92, p, i, { fill: 'transparent', edge: mix(p.ink, p.tile, .7) });
      continue;
    } else if (g === 'shogi') {
      const t = c.length > 2 ? c[2] : c[1];
      text = (c.includes('+') ? '成' : '') + (SHOGI[t] || t);
      fill = side === 0 ? p.tile : mix(p.ink2, p.tile, .8);
    } else if (g === 'go' || g === 'gomoku' || g === 'renju' || g === 'connect6' || g === 'connect4' || g === 'othello') {
      fill = side === 0 ? mix(p.ink, p.tile, .12) : p.tile;
      edge = p.ink;
      text = '';
    } else if (g === 'checkers') {
      fill = side === 0 ? p.tile : p.ink;
      edge = side === 0 ? p.ink : p.tile;
      text = c.includes('K') ? '王' : '';
    } else if (g === 'tiaogi') {
      fill = side === 0 ? p.accent : side === 1 ? p.ink : mix(p.ink2, p.tile, .5);
      edge = p.ink; text = '';
    } else if (g === 'mills') {
      fill = side === 0 ? p.tile : p.ink; edge = p.ink; text = '';
    } else if (g === 'diefeng') {
      const h = c.length;
      for (let k = 0; k < h; k++) {
        const owner = c[k] === 'r' ? 0 : 1;
        disc(ctx, px(i), py(i) - k * R * .32, R * (.8 - k * .05), p, i + k * 37,
          { fill: owner === 0 ? mix(p.tile, p.accent, .16) : mix(p.ink, p.tile, .2),
            edge: owner === 0 ? p.accent : p.ink, squash: .6 });
      }
      label(ctx, String(h), px(i), py(i) + R * .66, R * .42, p.ink2);
      continue;
    } else {
      text = XQ[c] || (c.length > 1 ? c.slice(1) : c);
      fill = side === 0 ? p.tile : mix(p.ink2, p.tile, .72);
      edge = side === 0 ? p.accent : p.ink;
    }
    disc(ctx, px(i), py(i), R * .96, p, i, { fill, edge, heavy });
    if (text) label(ctx, text, px(i), py(i), R * (text.length > 1 ? .78 : 1.05), side === 1 && (g === 'xiangqi' || g === 'jieqi') ? p.tile : (side === 1 && fill === p.ink ? p.tile : p.ink));
  }

  if (view.last) {
    const m = view.last.match(/[:>](\d+)(?:>(\d+))?/);
    if (m) {
      const i = parseInt(m[2] || m[1], 10);
      if (!isNaN(i) && i < cells.length) {
        ctx.beginPath(); ctx.arc(px(i), py(i), R * 1.2, 0, 7);
        ctx.strokeStyle = p.accent; ctx.lineWidth = 1.6; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }

  canvas.onclick = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    let best = -1, bd = 1e9;
    for (let i = 0; i < cells.length; i++) {
      if (isPointBoard && points && !points.includes(i)) continue;
      const d = Math.hypot(px(i) - x, py(i) - y);
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0 && bd < step * .62) onPick(best);
  };
}

function drawPath(ctx, W, H, p, view) {
  const info = view.info || {};
  const n = info.pathLength || 20;
  const cx = W / 2, cy = H / 2, rx = W * .40, ry = H * .38;
  const dot = Math.min(W, H) * .019, pos = info.pos || [], owner = info.owner || [];
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 2 * i / n - Math.PI / 2;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    const o = owner[i];
    ctx.beginPath(); ctx.arc(x, y, dot, 0, 7);
    ctx.fillStyle = o >= 0 ? mix(p.accent, p.tile, .45) : p.tile;
    ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = p.line; ctx.stroke();
    if (i % 5 === 0) {
      ctx.fillStyle = p.ink2; ctx.textAlign = 'center';
      ctx.font = `${Math.round(Math.min(W, H) * .022)}px Georgia,serif`;
      ctx.fillText(String(i), x, y + 3);
    }
  }
  for (let k = 0; k < pos.length; k++) {
    const v = pos[k];
    if (v < 0 || v >= n) continue;
    const seat = view.game === 'feixingqi' ? Math.floor(k / 4) : k;
    const a = Math.PI * 2 * ((v + (view.game === 'feixingqi' ? seat * 13 : 0)) % n) / n - Math.PI / 2 + (k % 4) * .012;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    const fill = seat === 0 ? p.accent : seat === 1 ? p.ink : mix(p.ink, p.tile, Math.min(.8, .22 + seat * .12));
    disc(ctx, x, y, Math.min(W, H) * .026, p, k, { fill, edge: p.ink });
  }
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * .60, ry * .56, 0, 0, 7);
  ctx.fillStyle = mix(p.ink, p.tile, .9); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = p.line; ctx.stroke();
  for (let k = 1; k <= 2; k++) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * (.60 - k * .08), ry * (.56 - k * .08), 0, 0, 7);
    ctx.strokeStyle = mix(p.line, p.tile, .4); ctx.stroke();
  }
  ctx.textAlign = 'center'; ctx.fillStyle = p.accent;
  if (info.dice) {
    ctx.font = `${Math.round(Math.min(W, H) * .15)}px Georgia,serif`;
    ctx.fillText(String(info.dice), cx, cy + Math.min(W, H) * .05);
  } else {
    ctx.font = `${Math.round(Math.min(W, H) * .045)}px "Songti SC",serif`;
    ctx.fillText(view.variant || '对局中', cx, cy + 4);
  }
  ctx.restore();
}

function drawTable(ctx, W, H, p, view) {
  ctx.save();
  const r = Math.min(W, H) * .44, cx = W / 2, cy = H / 2;
  ctx.shadowColor = p.shadow; ctx.shadowBlur = 26 * (p.shadowA / .16); ctx.shadowOffsetY = 8;
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * .86, 0, 0, 7);
  ctx.fillStyle = mix(p.ink, p.tile, .86); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.2; ctx.strokeStyle = p.line; ctx.stroke();
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath(); ctx.ellipse(cx, cy, r * (1 - k * .09), r * .86 * (1 - k * .09), 0, 0, 7);
    ctx.strokeStyle = mix(p.line, p.tile, .35); ctx.lineWidth = .8; ctx.stroke();
  }

  ctx.strokeStyle = p.accent; ctx.lineWidth = 1;
  for (const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
    const x = cx + sx * r * .63, y = cy + sy * r * .55;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.ellipse(x, y, r * .10, r * .035, k * Math.PI / 4, 0, 7); ctx.stroke();
    }
  }
  ctx.fillStyle = mix(p.ink2, p.tile, .35);
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(Math.min(W, H) * .052)}px "Songti SC",serif`;
  ctx.fillText(view.variant || '对局中', cx, cy - 8);
  ctx.font = `${Math.round(Math.min(W, H) * .032)}px Georgia,serif`;
  ctx.fillStyle = mix(p.ink2, p.tile, .55);
  ctx.fillText(view.phaseName || '对局中', cx, cy + 20);
  ctx.restore();
}

function mix(a, b, t) {
  const pa = parse(a), pb = parse(b);
  if (!pa || !pb) return b;
  const c = [0, 1, 2].map(i => Math.round(pa[i] * (1 - t) + pb[i] * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function parse(s) {
  if (!s) return null;
  if (s.startsWith('#')) {
    const h = s.slice(1); const n = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  }
  const m = s.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

export function cardLabel(c) {
  if (!c) return '';
  if (c === 'J1') return '小王'; if (c === 'J2') return '大王';
  if (/^W[1-9]$|^T[1-9]$|^B[1-9]$/.test(c)) {
    const n = '一二三四五六七八九'[+c[1] - 1];
    return n + ({ W: '萬', T: '條', B: '筒' }[c[0]]);
  }
  if (/^Z[1-7]$/.test(c)) return ZI[+c[1] - 1];
  if (/^[RYGB]/.test(c)) {
    const col = { R: '朱', Y: '黄', G: '绿', B: '蓝' }[c[0]];
    if (c === 'W' || c === 'W4') return c === 'W4' ? '★+4' : '★换色';
    const f = c.slice(1);
    return col + (f === 'S' ? '停' : f === 'R' ? '转' : f === '+2' ? '+2' : f);
  }
  const s = c[0], r = c.slice(1);
  return (SUIT[s] || '') + r;
}
function toneCls(tone, heavy) { return tone + (heavy ? ' heavy' : ''); }
export function cardFace(c) {
  if (!c) return { cls:'', suit:'', rank:'' };
  if (c === 'J1') return { cls:'red heavy', suit:'小王', rank:'' };
  if (c === 'J2') return { cls:'red', suit:'大王', rank:'' };
  if (/^W[1-9]$|^T[1-9]$|^B[1-9]$/.test(c)) {
    const n = '一二三四五六七八九'[+c[1] - 1];
    return { cls:'ink', suit:({ W:'萬', T:'條', B:'筒' }[c[0]]), rank:n };
  }
  if (/^Z[1-7]$/.test(c)) {
    const st = ZI_STYLE[+c[1] - 1];
    return { cls:toneCls(st[0], st[1]), suit:ZI[+c[1] - 1], rank:'' };
  }
  if (c === 'W' || c === 'W4') return { cls:'gold heavy', suit:'★', rank:c === 'W4' ? '+4' : '换' };
  if (/^[RYGB]/.test(c)) {
    const st = COLOR_TONE[c[0]] || ['ink',false];
    const f = c.slice(1);
    return { cls:toneCls(st[0], st[1]), suit:({ R:'朱', Y:'黄', G:'绿', B:'蓝' }[c[0]]),
             rank:f === 'S' ? '停' : f === 'R' ? '转' : f };
  }
  const st = SUIT_STYLE[c[0]];
  if (st) return { cls:toneCls(st.tone, st.heavy), suit:SUIT[c[0]], rank:c.slice(1) };
  return { cls:'', suit:'', rank:cardLabel(c).slice(0, 4) };
}
function cardColor(c) { return cardFace(c).cls; }

export function renderHand(el, view, sel) {
  if (!el) return;
  const hand = view.hand || [];
  const suggest = (view.info && view.info.suggest) || '';
  const hintIdx = suggest.startsWith('p:') ? suggest.slice(2).split(',').map(Number) : [];
  const pStar = (view.legal || []).some(c => c.startsWith('p:*') || c === 'p:*');
  el.innerHTML = '';
  hand.forEach((c, i) => {
    const d = document.createElement('div');
    const f = cardFace(c);
    d.className = 'card ' + f.cls + (sel.has(i) ? ' sel' : '') + (hintIdx.includes(i) ? ' hint' : '');
    d.innerHTML = `<span class="c-corner">${String(i + 1).padStart(2,'0')}</span><span class="c-num">${f.rank}</span><span class="c-suit">${f.suit}</span>`;
    d.dataset.idx = String(i);
    if (!pStar && !(view.legal || []).some(code => code.startsWith('p:' + i) || code === 'p:' + i)) d.style.opacity = '.72';
    el.appendChild(d);
  });
}

export function renderCenter(el, view) {
  if (!el) return;
  const info = view.info || {};
  const raw = info.lastCards || info.last || [];
  const list = Array.isArray(raw) ? raw : [];
  const parts = [];
  if (info.topCard) parts.push({ c: info.topCard, tag: '顶牌' });
  if (info.boardCards && info.boardCards.length) info.boardCards.forEach(c => parts.push({ c, tag: '' }));
  if (info.trickCards && info.trickCards.length) info.trickCards.forEach(c => parts.push({ c, tag: '' }));
  if (list && list.length) list.forEach(c => parts.push({ c, tag: '' }));
  if (info.discards && info.discards.length) info.discards.slice(-8).forEach(c => parts.push({ c, tag: '' }));
  if (info.bottom && info.bottom.length) info.bottom.forEach(c => parts.push({ c, tag: '底' }));
  el.innerHTML = parts.length ? parts.map(o => {
    const f = cardFace(o.c);
    return `<div class="card ${f.cls}"><span class="c-corner">${o.tag}</span><span class="c-num">${f.rank}</span><span class="c-suit">${f.suit}</span></div>`;
  }).join('') : '';
}

export function renderParty(el, view, onCode) {
  if (!el) return;
  const info = view.info || {};
  const g = view.game || '';
  const you = typeof view.you === 'number' ? view.you : -1;
  const legal = view.legal || [];
  const isParty = view.renderer === 'party' || view.renderer === 'path';
  el.classList.toggle('show', isParty);
  if (!isParty) { el.innerHTML = ''; return; }

  if (g === 'juben') { el.innerHTML = ''; el.classList.remove('show'); return; }

  let html = '';

  if (you >= 0 && (info.myRole || info.myWord !== undefined)) {
    const rr = info.myRole;
    const roleText = rr && typeof rr === 'object' ? (rr.public || '角色') : rr;
    html += `<div class="prole"><b>你的身份 / 词</b><br>${escapeText(roleText || info.myWord || '（白板）')}</div>`;
  }

  if (info.nums) {
    html += `<div class="nums">${info.nums.map(n => `<div class="num">${n}</div>`).join('')}</div>`;
    html += `<div class="join-line"><input id="exprInput" placeholder="如 (1+2+3)*4"><button class="btn small" data-code="solve">提交</button></div>`;
  }

  if (info.dice) html += `<div class="hint">点数：<b style="font:18px Georgia">${info.dice}</b> 点 · ${info.rolled ? '请选择要移动的棋子' : '轮到你时掷点'}</div>`;
  if (info.pathLength || g === 'monopoly') {
    html += `<div class="hint">位置 ${(info.pos || []).join(' / ')} ${info.canBuy ? '· 可购买地块' : ''}</div>`;
  }

  const moveCodes = legal.filter(c => /^m:\d+$/.test(c));
  if (moveCodes.length) {
    const pos = info.pos || [];
    html += `<div class="side-h">MOVE · 选一架飞机</div><div class="variant-row">` +
      moveCodes.map(c => {
        const i = +c.slice(2), k = i % 4 + 1;
        const label = (pos[i] === undefined || pos[i] < 0) ? `起飞 · 第 ${k} 架` : `前进 · 第 ${k} 架`;
        return `<button class="variant" data-code="${c}">${label}</button>`;
      }).join('') + `</div>`;
  }

  if (info.canBuy) {
    html += `<div class="variant-row">` +
      (legal.includes('buy') ? `<button class="variant" data-code="buy">买下地块</button>` : '') +
      (legal.includes('skip') ? `<button class="variant" data-code="skip">不买，过</button>` : '') +
      `</div>`;
  }
  if (info.pile !== undefined) html += `<div class="hint">接龙顶牌 ${info.pile} · 剩余 ${info.restLeft} · 已走 ${info.moves} 手</div>`;

  const speaking = info.phase === 'speech' || info.phase === 'describe';
  if (speaking) {
    const no = info.day || info.round || 1;
    const unit = info.phase === 'speech' ? '天' : '轮';
    html += `<div class="side-h">SPEECH · 第 ${no} ${unit} · 轮流打字</div>`;
    const alive = info.alive || [], speeches = info.speeches || [], spoken = info.spoken || [];
    html += `<div class="speech-list">` + alive.map((a, i) => {
      if (!a) return `<div class="speech out"><b>座位 ${i}</b> 已出局</div>`;
      const text = speeches[i] || '';
      const state = spoken[i] ? escapeText(text || '（选择不发言）') : '<i>等待发言…</i>';
      return `<div class="speech ${i === info.speaker ? 'cur' : ''}"><b>座位 ${i}${i === you ? ' · 你' : ''}</b> ${state}</div>`;
    }).join('') + `</div>`;
    if (legal.includes('say:*')) {
      html += `<div class="join-line"><input id="sayInput" maxlength="120" placeholder="用一句话描述，别直接说出词"><button class="btn small" data-code="say">发出</button></div>`;
      html += `<div class="btn-row"><button class="btn ghost" data-code="say:">跳过不发言</button>` +
        (legal.includes('next') ? `<button class="btn ghost" data-code="next">结束发言，直接投票</button>` : '') +
        `</div>`;
    } else {
      html += `<div class="hint">等待座位 ${info.speaker} 发言…${info.aliveCount ? ` · 本轮 ${info.aliveCount} 人` : ''}</div>`;
    }
  }

  if (info.phase === 'night' || info.phase === 'vote') {
    const alive = info.alive || [];
    const night = info.phase === 'night';
    const no = info.day || info.round || 1;
    html += `<div class="hint">${night ? '夜晚 · 角色行动' : '放逐投票'} · 第 ${no} ${night ? '夜' : '天'}` +
      (!night && info.voted !== undefined ? ` · 已投 ${info.voted}/${info.aliveCount || alive.filter(Boolean).length}` : '') + `</div>`;
    if (night && info.nightRole) html += `<div class="prole"><b>轮到你的角色行动</b><br>${info.nightRole}${info.nightRole === '女巫' ? ' · 可救人 / 毒人 / 跳过' : ''}</div>`;
    const codes = legal.filter(c => /^(vote|night|poison):\d+$/.test(c));
    html += `<div class="variant-row">` + alive.map((a, i) => {
      if (!a) return '';
      const pick = codes.find(c => c === (night ? 'night:' : 'vote:') + i || c === 'poison:' + i);
      if (!pick) return '';
      const label = night ? (pick.startsWith('poison:') ? '毒 ' : '选 ') + i : '投 ' + i;
      return `<button class="variant" data-code="${pick}">${label}</button>`;
    }).join('') + `</div>`;

    const extras = legal.filter(c => ['save', 'skip', 'next'].includes(c));
    if (extras.length) html += `<div class="variant-row">` + extras.map(c =>
      `<button class="variant" data-code="${c}">${{ save: '救人', skip: '跳过', next: '结束本轮' }[c]}</button>`).join('') + `</div>`;
  }

  const pub = info.publicText || info.history;
  if (Array.isArray(pub) && pub.length) {
    html += `<div class="side-h" style="margin-top:12px">PUBLIC · 公栏</div><div class="speech-list">` +
      pub.slice(-8).map(x => `<div class="speech">${escapeText(typeof x === 'string' ? x : (x.text || ''))}</div>`).join('') + `</div>`;
  }
  if (info.question) {
    html += `<div class="side-h" style="margin-top:12px">Q · 第 ${info.round || 1}/${info.rounds || 5} 轮</div>`;
    html += `<div class="hint" style="font-size:14px">${escapeText(info.question)}</div>`;
  }
  if (info.soup) html += `<div class="prole"><b>汤面</b><br>${escapeText(info.soup)}</div>`;
  if (info.myDice) html += `<div class="hint">你的点数：${info.myDice.map(n => '一二三四五六'[n - 1] || n).join(' ')} · 当前叫 ${info.call || '—'}</div>`;
  if (info.call) html += `<div class="hint">场上叫点：<b>${escapeText(String(info.call))}</b></div>`;
  if (Array.isArray(info.options)) {
    html += `<div class="variant-row">` + info.options.map((o, i) =>
      (legal.includes('v:' + i) ? `<button class="variant" data-code="v:${i}">${escapeText(o)}</button>` : '')).join('') + `</div>`;
  }
  const flat = (c) => {
    const m = { n:'继续 · 推进', k:'开盅验点', p:'过 / 跳过', d:'要牌', save:'救人', skip:'跳过', next:'下一轮', buy:'买下地块' };
    if (m[c]) return m[c];
    if (/^b:\d+,\d+$/.test(c)) { const a = c.slice(2).split(','); return `叫 ${a[0]} 个 ${a[1]} 点`; }
    if (/^v:\d+$/.test(c)) return `选 ${c.slice(2)}`;
    if (/^c:\d+$/.test(c)) return `选座位 ${c.slice(2)}`;
    if (/^solve:/.test(c)) return '提交 ' + c.slice(6);
    return c.replace(/^([a-z]+):(.*)$/, (_, a, b) => a + ' · ' + (b || '确认'));
  };
  const taken = /^(vote|night|poison|m|b|v|c):\d+|^b:\d+|^say|^solve|^draw|^p:|^f:|^x:|^o:/;
  const generic = legal.filter(c => !c.endsWith(':*') && !taken.test(c) &&
    !['say', 'solve', 'next', 'skip', 'buy', 'save'].includes(c));
  if (generic.length) {
    html += `<div class="side-h" style="margin-top:12px">可择</div><div class="variant-row">` +
      generic.slice(0, 24).map(c => `<button class="variant" data-code="${c}">${escapeText(flat(c))}</button>`).join('') + `</div>`;
  }
  if (legal.includes('say:*')) {
    html += `<div class="join-line"><input id="sayInput" maxlength="120" placeholder="轮到你了，说一句"><button class="btn small" data-code="say">发出</button></div>`;
  }
  if (legal.includes('solve:*')) {
    html += `<div class="join-line"><input id="exprInput" maxlength="60" placeholder="${info.len ? info.len + ' 位数字' : '写出你的答案'}"><button class="btn small" data-code="solve">提交</button></div>`;
  }
  if (Array.isArray(info.votesDeck)) {  }

  el.innerHTML = html;
  el.querySelectorAll('[data-code]').forEach(b => b.onclick = () => {
    const code = b.dataset.code;
    if (code === 'solve') {
      const e = el.querySelector('#exprInput');
      if (e && e.value.trim()) onCode('solve:' + e.value.trim());
      else if (e) e.focus();
      return;
    }
    if (code === 'say') {
      const e = el.querySelector('#sayInput');
      onCode('say:' + ((e && e.value.trim()) || ''));
      return;
    }
    onCode(code);
  });
  const sayInput = el.querySelector('#sayInput');
  if (sayInput) sayInput.onkeydown = (e) => {
    if (e.key === 'Enter') onCode('say:' + (sayInput.value.trim() || ''));
  };
}
function escapeText(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function drawGridExtra(ctx, W, H, p, view, onPick) {
  const g = view.game || '';
  const cells = view.cells || [], w = view.w || 1, h = view.h || 1;
  const legal = view.legal || [];
  const pad = Math.max(18, Math.min(W, H) * .08);
  ctx.save(); ctx.strokeStyle = p.line; ctx.fillStyle = p.ink; ctx.lineWidth = 1;

  if (g === 'nim') {
    const step = (W - 2 * pad) / Math.max(1, w);
    for (let i = 0; i < w; i++) {
      const n = parseInt(cells[i] || '0', 10) || 0;
      const cx = pad + (i + .5) * step, cy = H / 2;
      ctx.beginPath(); ctx.moveTo(cx - step * .36, cy + 70); ctx.lineTo(cx + step * .36, cy + 70); ctx.stroke();
      for (let k = 0; k < n; k++) {
        const a = (k % 5) * step * .14 - step * .28, b = Math.floor(k / 5) * 15;
        ctx.beginPath(); ctx.arc(cx + a, cy - b, 6, 0, 7); ctx.fillStyle = k % 2 ? p.accent : p.ink; ctx.fill();
      }
      ctx.fillStyle = p.ink2; ctx.font = '11px monospace'; ctx.textAlign = 'center';
      ctx.fillText('第 ' + (i + 1) + ' 堆 · ' + n, cx, H - pad + 14);
    }

    const cv = document.getElementById('board');
    if (cv) cv.onclick = null;
    ctx.restore(); return;
  }

  if (g === 'dots') {
    const step = Math.min((W - 2 * pad) / Math.max(1, w - 1), (H - 2 * pad) / Math.max(1, h - 1));
    const ox = pad + (W - 2 * pad - step * (w - 1)) / 2, oy = pad + (H - 2 * pad - step * (h - 1)) / 2;
    const X = i => ox + (i % w) * step, Y = i => oy + Math.floor(i / w) * step;
    for (let i = 0; i < cells.length; i++) {
      const x = X(i), y = Y(i), c = cells[i] || '';
      if (c === '+') { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fillStyle = p.line; ctx.fill(); }
      else if (c === '.') { ctx.strokeStyle = p.line; ctx.strokeRect(x - step * .30, y - step * .30, step * .60, step * .60); }
      else if (c === 'r*' || c === 'b*') {
        ctx.fillStyle = c[0] === 'r' ? p.accent : p.ink; ctx.globalAlpha = .28;
        ctx.fillRect(x - step * .34, y - step * .34, step * .68, step * .68); ctx.globalAlpha = 1;
      } else if (c === 'r' || c === 'b') {
        ctx.strokeStyle = c === 'r' ? p.accent : p.ink; ctx.lineWidth = 2.4;
        if (i % w % 2 === 0) { ctx.beginPath(); ctx.moveTo(x, y - step / 2); ctx.lineTo(x, y + step / 2); ctx.stroke(); }
        else { ctx.beginPath(); ctx.moveTo(x - step / 2, y); ctx.lineTo(x + step / 2, y); ctx.stroke(); }
        ctx.lineWidth = 1;
      } else if (c === '' && legal.includes('c:' + i)) {
        ctx.fillStyle = p.dot || p.line; ctx.globalAlpha = .5;
        ctx.fillRect(x - step * .12, y - step * .12, step * .24, step * .24); ctx.globalAlpha = 1;
      }
    }
    const cv = document.getElementById('board');
    if (cv && onPick) cv.onclick = (e) => {
      const rect = cv.getBoundingClientRect();
      const gx = Math.round((e.clientX - rect.left - ox) / step), gy = Math.round((e.clientY - rect.top - oy) / step);
      const i = gy * w + gx;
      if (i >= 0 && i < cells.length && legal.includes('c:' + i)) onPick(i);
    };
    ctx.restore(); return;
  }

  if (g === 'hex') {
    const step = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h) * .92;
    const ox = pad + (W - step * w) / 2, oy = pad + (H - step * h) / 2;
    for (let i = 0; i < cells.length; i++) {
      const x = ox + (i % w + .5) * step + (Math.floor(i / w) % 2) * step * .5;
      const y = oy + (Math.floor(i / w) + .5) * step * .86;
      const c = cells[i] || '';
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k - Math.PI / 6; const px = x + step * .46 * Math.cos(a), py = y + step * .46 * Math.sin(a); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.strokeStyle = p.line; ctx.stroke();
      if (c === 'r' || c === 'b') { ctx.fillStyle = c === 'r' ? p.accent : p.ink; ctx.globalAlpha = .82; ctx.fill(); ctx.globalAlpha = 1; }
      else if (legal.includes('c:' + i)) { ctx.fillStyle = p.dot || p.line; ctx.globalAlpha = .35; ctx.fill(); ctx.globalAlpha = 1; }
    }
    const cv = document.getElementById('board');
    if (cv && onPick) cv.onclick = (e) => {
      const rect = cv.getBoundingClientRect();
      let best = -1, bd = 1e9;
      for (let i = 0; i < cells.length; i++) {
        const x = ox + (i % w + .5) * step + (Math.floor(i / w) % 2) * step * .5;
        const y = oy + (Math.floor(i / w) + .5) * step * .86;
        const d = (e.clientX - rect.left - x) ** 2 + (e.clientY - rect.top - y) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0 && bd < (step * .6) ** 2 && legal.includes('c:' + best)) onPick(best);
    };
    ctx.restore(); return;
  }

  const step = Math.min((W - 2 * pad) / 5, (H - 2 * pad) / 5);
  const ox = pad, oy = pad;
  ctx.strokeStyle = p.line;
  for (let i = 0; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(ox + i * step, oy); ctx.lineTo(ox + i * step, oy + 5 * step); ctx.stroke(); }
  for (let j = 0; j <= 5; j++) { ctx.beginPath(); ctx.moveTo(ox, oy + j * step); ctx.lineTo(ox + 5 * step, oy + j * step); ctx.stroke(); }
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i] || ''; if (!c) continue;
    const x = ox + (i % 5 + .5) * step, y = oy + (Math.floor(i / 5) + .5) * step;
    ctx.beginPath(); ctx.arc(x, y, step * .36, 0, 7);
    ctx.fillStyle = c[0] === 'r' ? p.accent : p.ink; ctx.fill();
    ctx.fillStyle = p.cardInk || '#fff'; ctx.font = 'bold 15px "Songti SC",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c[1] === 'K' ? '将' : c[1] === 'R' ? '车' : '兵', x, y);
  }
  ctx.textBaseline = 'alphabetic'; ctx.restore();
}

export function sparkline(svg, values, opts) {
  if (!svg) return;
  const o = opts || {};
  const data = (values && values.length ? values : [0, 0, 0, 0, 0, 0, 0]).map(Number);
  const W = 300, H = o.h || 88, pad = 8;
  const mx = Math.max(1, ...data), mn = Math.min(0, ...data);
  const pts = data.map((v, i) => [pad + i * (W - 2 * pad) / Math.max(1, data.length - 1), H - pad - (v - mn) / (mx - mn || 1) * (H - 2 * pad)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L ${pts[pts.length - 1][0].toFixed(1)} ${H} L ${pts[0][0].toFixed(1)} ${H} Z`;
  const grid = [0.25, 0.5, 0.75].map(t => `M ${pad} ${(pad + t * (H - 2 * pad)).toFixed(1)} L ${W - pad} ${(pad + t * (H - 2 * pad)).toFixed(1)}`).join(' ');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `<path class="grid" d="${grid}"/><path d="${area}" fill="rgba(255,255,255,.06)"/><path class="line" d="${line}"/>` +
    pts.map(p => `<circle class="pt" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6"/>`).join('');
}


function yjCard(c, info) {
  if (!c || c.length < 6) return '空简';
  const y = +c[1], f = +c[3], m = +c[5];
  const fn = ['东', '西', '南', '北'][f] || '？';
  const names = info && info.roleNames;
  const nm = names && names[(y - 1) * 4 + f] ? '「' + names[(y - 1) * 4 + f] + '」 · ' : '';
  return nm + y + ' 序 · ' + fn + ' · ' + m + ' 墨';
}
function drawScroll(ctx, W, H, p, view) {
  const info = view.info || {};
  const n = Math.max(5, +(info.lineN || 9));
  const mid = Math.floor((n - 1) / 2);
  const line = Math.max(0, Math.min(n - 1, +(info.line || mid)));
  const horizontal = W >= H * 1.15;
  ctx.save();
  ctx.textBaseline = 'middle';

  const pad = Math.max(26, Math.min(W, H) * 0.09);
  const title = '弈卷 · 双卷夹一线';
  ctx.fillStyle = mix(p.ink2, p.tile, 0.42);
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(Math.min(W, H) * 0.045)}px "Songti SC",serif`;
  ctx.fillText(title, W / 2, pad * 0.52);

  const a = horizontal ? { x: pad, y: H / 2 } : { x: W / 2, y: pad * 1.6 };
  const b = horizontal ? { x: W - pad, y: H / 2 } : { x: W / 2, y: H - pad * 1.6 };
  const x0 = horizontal ? a.x + 30 : a.x;
  const x1 = horizontal ? b.x - 30 : b.x;
  const y0 = horizontal ? a.y : a.y + 30;
  const y1 = horizontal ? b.y : b.y - 30;
  const len = horizontal ? (x1 - x0) : (y1 - y0);
  const step = len / Math.max(1, n - 1);

  function roll(cx, cy, label, side) {
    const rw = horizontal ? 30 : Math.min(W * 0.32, 150);
    const rh = horizontal ? Math.min(H * 0.30, 130) : 26;
    ctx.save();
    ctx.shadowColor = p.shadow; ctx.shadowBlur = 16;
    ctx.fillStyle = mix(p.ink, p.tile, 0.83);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - rw / 2, cy - rh / 2, rw, rh, 6);
    else ctx.rect(cx - rw / 2, cy - rh / 2, rw, rh);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = p.line; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = mix(p.accent, p.tile, 0.35); ctx.lineWidth = 2;
    const off = side === 0 ? -rw / 2 : rw / 2;
    if (horizontal) { ctx.beginPath(); ctx.moveTo(cx + off, cy - rh / 2); ctx.lineTo(cx + off, cy + rh / 2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(cx - rw / 2, cy + off); ctx.lineTo(cx + rw / 2, cy + off); ctx.stroke(); }
    ctx.fillStyle = p.accent;
    ctx.font = `${Math.round(Math.min(W, H) * 0.032)}px "Songti SC",serif`;
    ctx.fillText(label, cx, cy);
    ctx.restore();
  }
  roll(a.x, a.y, '甲卷端', 0);
  roll(b.x, b.y, '乙卷端', 1);

  ctx.strokeStyle = mix(p.line, p.tile, 0.55); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();

  const box = Math.max(9, Math.min(step * 0.52, Math.min(W, H) * 0.055));
  for (let i = 0; i < n; i++) {
    const cx = horizontal ? x0 + i * step : x0;
    const cy = horizontal ? y0 : y0 + i * step;
    const isMid = i === mid, isHere = i === line;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - box / 2, cy - box / 2, box, box, 3);
    else ctx.rect(cx - box / 2, cy - box / 2, box, box);
    ctx.fillStyle = isHere ? mix(p.accent, p.tile, 0.15) : mix(p.ink, p.tile, 0.92);
    ctx.fill();
    ctx.lineWidth = isHere ? 2 : 1;
    ctx.strokeStyle = isHere ? p.accent : (isMid ? mix(p.ink2, p.tile, 0.5) : mix(p.line, p.tile, 0.5));
    ctx.stroke();
    if (isHere) {
      ctx.beginPath(); ctx.arc(cx, cy, box * 0.22, 0, 7);
      ctx.fillStyle = p.accent; ctx.fill();
    } else if (isMid) {
      ctx.beginPath(); ctx.arc(cx, cy, box * 0.10, 0, 7);
      ctx.fillStyle = mix(p.ink2, p.tile, 0.55); ctx.fill();
    }
  }

  const note = info.lastNote || '';
  const la = info.lastA || '', lb = info.lastB || '';
  const footY = horizontal ? H - pad * 0.72 : H - pad * 0.34;
  if (la && lb) {
    ctx.font = `${Math.round(Math.min(W, H) * 0.030)}px "Songti SC",serif`;
    ctx.fillStyle = mix(p.ink2, p.tile, 0.35);
    ctx.fillText('启简 · 甲 ' + yjCard(la, info) + '　/　乙 ' + yjCard(lb, info), W / 2, footY - Math.min(W, H) * 0.032);
    ctx.fillStyle = p.accent;
    ctx.fillText(note, W / 2, footY);
  } else {
    ctx.font = `${Math.round(Math.min(W, H) * 0.030)}px "Songti SC",serif`;
    ctx.fillStyle = mix(p.ink2, p.tile, 0.45);
    ctx.fillText('两席各择一简覆下，同时启简', W / 2, footY);
  }

  const da = info.discardA || [], db = info.discardB || [];
  const ink = info.ink || [0, 0], pick = info.pick || [0, 0];
  ctx.font = `${Math.round(Math.min(W, H) * 0.024)}px "Songti SC",serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = mix(p.ink2, p.tile, 0.45);
  const sx = pad * 0.55, sy = pad * 1.25;
  ctx.fillText('甲弃简 ' + da.length + ' · 余墨 ' + ink[0] + ' · 可拾 ' + pick[0], sx, sy);
  ctx.fillText('乙弃简 ' + db.length + ' · 余墨 ' + ink[1] + ' · 可拾 ' + pick[1], sx, sy + Math.min(W, H) * 0.030);
  if (horizontal) {
    ctx.textAlign = 'right';
    ctx.fillText('界墨 ' + line + ' / ' + (n - 1) + '　·　第 ' + (+(info.round || 0) + 1) + ' 巡', W - pad * 0.55, sy);
  } else {
    ctx.fillText('界墨 ' + line + ' / ' + (n - 1) + '　·　第 ' + (+(info.round || 0) + 1) + ' 巡', sx, sy + Math.min(W, H) * 0.060);
  }
  ctx.restore();
}
