/* 轮弦 · 竖弦五音（副推对战音游）
 * 研究结论落地：好玩来自「输入同帧确认 + 事件反馈」，不是堆叠装饰；
 * 留存单位从「一局」升级成「一个玩家自己」；不催促、不弹邀请、无聊天。
 * 一个面板、一套五色键、直点即响；非活动态整片变暗；八段 64 音轮奏 / 独奏。
 */
import { getAudio, laneFx, heavyFinish, bianzhong, hz, bgmStep, SANBAN, now } from './gu-yue.js';
import { NAMES } from './event-fx.js';

const PX = 96;
let R = null, MODE = 'duet', BGM = null, stepNo = 0, nextAt = 0;
const Q = s => document.querySelector(s);

function el(id) { return document.getElementById(id); }
function trackOf(l) { return Q('#yjStage .yj-track[data-l="' + l + '"]'); }
function HITY(l) { const t = trackOf(l); return (t ? t.clientHeight : 290) - 13; }
function ripple(l) {
  const t = trackOf(l); if (!t) return;
  const d = document.createElement('div'); d.className = 'yj-ripple';
  t.appendChild(d); setTimeout(() => d.remove(), 620);
}
function judge(txt, big) {
  const j = el('yjJudge'); if (!j) return;
  if (!big && j.classList.contains('final')) return;
  j.textContent = txt; j.className = ''; void j.offsetWidth;
  if (big) { j.className = 'final';
    setTimeout(() => { j.classList.add('fade');
      setTimeout(() => { j.className = ''; j.textContent = ''; }, 700); }, 1600);
  } else { j.classList.add('show');
    setTimeout(() => { if (j.textContent === txt && !j.classList.contains('final')) { j.className = ''; j.textContent = ''; } }, 450); }
}
function afterglow(on) { const a = el('yjAfterglow'); if (a) a.classList.toggle('on', !!on); }

function buildScore(t0, mode) {
  const solo = mode === 'solo', n = [];
  const seg = (name, owner, base, gaps, lanes) => gaps.forEach((d, i) => n.push({
    t: t0 + base + d, l: lanes[i % lanes.length], sec: name, owner: solo ? 'me' : owner, hit: false, done: false
  }));
  const L1 = [0,1,2,3,4,3,2,1], L2 = [4,3,2,1,0,1,2,3], L3 = [0,2,4,1,3,0,2,4], L4 = [2,0,3,1,4,2,0,3];
  const eq = c => Array.from({ length: 8 }, (_, i) => i * c);
  seg('散','bot', .55,[0,.60,1.25,1.95,2.70,3.50,4.35,5.25],L1);
  seg('起','me',  6.30,eq(.55),L2); seg('承','bot',10.70,eq(.55),L3);
  seg('转','me', 15.10,eq(.48),L1); seg('折','bot',19.00,eq(.42),L2);
  seg('促','me', 22.40,eq(.42),L3); seg('缓','bot',25.80,eq(.36),L4);
  seg('收','me', 28.90,[0,.70,1.50,2.40,3.30,4.40,5.30,6.40],L1);
  return n.sort((a, b) => a.t - b.t);
}

function start() {
  const { ac, bus } = getAudio();
  const t0 = now() + .55, notes = buildScore(t0, MODE);
  notes.forEach(n => { if (n.owner === 'bot') { n.botPts = (n.sec === '折' || n.sec === '缓') ? 100 : 85;
    laneFx(ac, bus.bus, 'san', n.l, n.t); } });
  bianzhong(ac, bus.bus, { t: t0, f0: hz(0, 196), gain: .07 });
  const endT = notes[notes.length - 1].t + 1.4;
  R = { t0, notes, endT, mode: MODE, my: 0, bot: 0, combo: 0, maxCombo: 0, qi: 0,
        botIdx: 0, missIdx: 0, curOwner: 'bot', stats: { 妙:0, 合:0, 失:0 }, over: false, timer: null };
  window.__YJ_SCORE__ = notes.map(n => ({ t:n.t, l:n.l, sec:n.sec, owner:n.owner }));
  el('yjMy').textContent = '0'; el('yjBot').textContent = MODE === 'solo' ? '—' : '0';
  el('yjCombo').textContent = '0'; el('yjQiFill').style.width = '0%';
  el('yjLast').textContent = '—'; el('yjLane').textContent = '—';
  afterglow(false); const j = el('yjJudge'); if (j) { j.className = ''; j.textContent = ''; }
  Q('#yjStage').classList.remove('dim');
  document.querySelectorAll('.yj-note,.yj-ripple').forEach(e => e.remove());
  notes.forEach((n, i) => {
    const d = document.createElement('div');
    d.className = 'yj-note' + (n.owner === 'bot' ? ' bot' : '');
    d.dataset.i = i; d.dataset.l = n.l; d.textContent = NAMES[n.l];
    d.style.top = (HITY(n.l) - (n.t - t0) * PX) + 'px';
    trackOf(n.l).appendChild(d);
  });
  el('yjReadout').textContent = MODE === 'solo'
    ? '独奏已展卷 · 64 音全归你 · 一个面板全程点亮。'
    : '对坐已展卷 · 隐士段整片变暗只听，你段点亮点键。';
  clearInterval(R.timer);
  R.timer = setInterval(() => {
    if (!R || R.over) return;
    const t = now(), r = R;
    while (r.botIdx < r.notes.length) {
      const n = r.notes[r.botIdx];
      if (n.owner !== 'bot') { r.botIdx++; continue; }
      if (t < n.t) break;
      n.done = true; r.bot += n.botPts; ripple(n.l);
      const e = Q('.yj-note[data-i="' + r.botIdx + '"]'); if (e) e.classList.add('done');
      r.botIdx++;
    }
    el('yjBot').textContent = r.mode === 'solo' ? '—' : r.bot;
    while (r.missIdx < r.notes.length) {
      const n = r.notes[r.missIdx];
      if (n.owner !== 'me') { r.missIdx++; continue; }
      if (t < n.t + .22) break;
      if (!n.hit) { r.combo = 0; const e = Q('.yj-note[data-i="' + r.missIdx + '"]'); if (e) e.style.opacity = '.25'; }
      r.missIdx++;
    }
    el('yjCombo').textContent = r.combo;
    r.notes.forEach((n, i) => { const e = Q('.yj-note[data-i="' + i + '"]');
      if (e) e.style.top = (HITY(n.l) - (n.t - t) * PX) + 'px'; });
    let sec = '散', owner = 'bot';
    for (const n of r.notes) if (t >= n.t - .15) { sec = n.sec; owner = n.owner; }
    r.curOwner = owner;
    const me = (r.mode === 'solo' || owner === 'me');
    Q('#yjStage').classList.toggle('dim', r.mode !== 'solo' && !me);
    Q('#yjStage .seat').textContent = r.mode === 'solo' ? '独奏' : (me ? '你' : '隐士');
    const tt = el('yjTurn');
    tt.textContent = r.mode === 'solo' ? '独奏 · ' + sec : (me ? '你弹 · ' + sec : '隐士 · ' + sec);
    tt.className = me ? 'me' : '';
    if (t > r.endT) {
      r.over = true; clearInterval(r.timer);
      Q('#yjStage').classList.remove('dim');
      heavyFinish(ac, bus.bus, t + .05, bus.wet);
      afterglow(true); setTimeout(() => afterglow(false), 2600);
      if (r.mode === 'solo') {
        const rate = (r.stats.妙 + r.stats.合) / r.notes.length;
        const g = rate >= .90 ? '入神' : rate >= .70 ? '妙品' : rate >= .50 ? '合格' : '再抚';
        judge(g, true);
        el('yjReadout').textContent = '独奏卷收 · ' + r.my + '/6400 · 妙 ' + r.stats.妙 + ' 合 ' + r.stats.合 +
          ' 失 ' + r.stats.失 + ' · 「' + g + '」· 三钟余韵约 3 秒，大字自动收。';
      } else {
        const res = r.my > r.bot ? '胜' : r.my < r.bot ? '负' : '和';
        judge(res, true);
        el('yjReadout').textContent = '卷收 · 你 ' + r.my + ' / 隐士 ' + r.bot + ' · 「' + res + '」· 三钟余韵约 3 秒。';
      }
      try { window.YJ && YJ.noteRhythm && YJ.noteRhythm(r.mode, r.my, r.bot); } catch (e) {}
    }
  }, 25);
}
function tapLane(l) {
  const { ac, bus } = getAudio(); const t = now();
  if (!R || R.over) { laneFx(ac, bus.bus, 'san', l, t + .005); return; }
  if (R.mode !== 'solo' && R.curOwner === 'bot') return;
  let best = -1, bd = .24;
  R.notes.forEach((n, i) => { if (!n.hit && n.owner === 'me' && n.l === l) {
    const d = Math.abs(n.t - t); if (d < bd) { bd = d; best = i; } } });
  if (best < 0) { laneFx(ac, bus.bus, 'san', l, t + .005); return; }
  const n = R.notes[best]; n.hit = true;
  laneFx(ac, bus.bus, 'san', l, t + .005);
  const label = bd < .11 ? '妙' : bd < .22 ? '合' : '失', score = label === '妙' ? 100 : label === '合' ? 60 : 0;
  if (score > 0) { R.my += score; R.combo++; R.maxCombo = Math.max(R.maxCombo, R.combo);
    R.qi = Math.min(100, R.qi + 9); ripple(l);
    const e = Q('.yj-note[data-i="' + best + '"]'); if (e) e.classList.add('done'); }
  else { R.combo = 0; R.qi = Math.max(0, R.qi - 8); }
  R.stats[label]++;
  el('yjMy').textContent = R.my; el('yjCombo').textContent = R.combo;
  el('yjQiFill').style.width = R.qi + '%';
  el('yjLast').textContent = label; el('yjLane').textContent = NAMES[l];
  judge(label, false);
}
function startBgm() {
  const { ac, bus } = getAudio();
  if (BGM) return;
  stepNo = 0; nextAt = now() + .06;
  BGM = setInterval(() => {
    while (nextAt < now() + .28) {
      bgmStep(ac, bus.bus, nextAt, stepNo++, .72);
      const i = stepNo % SANBAN.length;
      const gap = SANBAN[i] - SANBAN[(i - 1 + SANBAN.length) % SANBAN.length];
      nextAt += Math.max(.4, gap > 0 ? gap : .85);
    }
  }, 25);
}
function stopBgm() { if (BGM) { clearInterval(BGM); BGM = null; } }
function buildDom() {
  const wrap = document.createElement('div');
  wrap.id = 'yjRhythm';
  wrap.innerHTML = `
  <div class="yj-rh">
    <h2>轮弦 · 竖弦五音</h2>
    <p class="tip">只有<b>一个</b>面板、<b>一套</b>五色键。音符自上落下，过朱砂「徽」时点一下对应色键即可，
      不用双击、不用按住。轮到隐士<b>整片变暗</b>只听，轮到你面板点亮。无对话、无聊天。</p>
    <div class="row">
      <button class="primary" id="yjStart">展卷（开谱）</button>
      <button id="yjMode" aria-pressed="false">模式：对坐</button>
      <button id="yjBgm">起底乐</button>
      <button id="yjClose">回大厅</button>
      <span class="chip" id="yjInfo">八段 · 64 音</span>
    </div>
    <div id="yjStage">
      <div class="seat">隐士</div>
      <div class="yj-tracks" id="yjTracks"></div>
      <div class="yj-hui"></div>
      <div class="yj-keys" id="yjKeys"></div>
    </div>
    <div id="yjTurn">待展卷</div>
    <div class="yj-score">
      <span>你 <b id="yjMy">0</b></span><span>隐士 <b id="yjBot">0</b></span>
      <span>连击 <b id="yjCombo">0</b></span><span>气韵 <span id="yjQi"><span id="yjQiFill"></span></span></span>
      <span>判定 <b id="yjLast">—</b></span><span>本弦 <b id="yjLane">—</b></span>
    </div>
    <div class="yj-readout" id="yjReadout">未展卷。点色键或按 A S D F G；终局三钟余韵约 3 秒，大字会自动收。</div>
  </div>`;
  document.body.appendChild(wrap);
  for (let l = 0; l < 5; l++) {
    const t = document.createElement('div'); t.className = 'yj-track'; t.dataset.l = l; t.dataset.n = NAMES[l];
    el('yjTracks').appendChild(t);
    const k = document.createElement('button'); k.className = 'yj-key'; k.dataset.l = l; k.textContent = NAMES[l];
    k.addEventListener('pointerdown', e => { e.preventDefault(); k.classList.add('hit');
      setTimeout(() => k.classList.remove('hit'), 110); tapLane(l); });
    el('yjKeys').appendChild(k);
  }
  el('yjStart').onclick = start;
  el('yjMode').onclick = () => {
    MODE = MODE === 'duet' ? 'solo' : 'duet';
    const b = el('yjMode'); b.setAttribute('aria-pressed', String(MODE === 'solo'));
    b.textContent = '模式：' + (MODE === 'solo' ? '独奏' : '对坐');
    el('yjInfo').textContent = MODE === 'solo' ? '八段 · 64 音 · 全归你' : '八段 · 64 音 · 各 32 音';
    el('yjReadout').textContent = MODE === 'solo' ? '已切独奏 · 一个面板全程点亮，64 音全归你。' : '已切对坐 · 隐士段整片变暗，你段点亮。';
  };
  el('yjBgm').onclick = () => { if (BGM) { stopBgm(); el('yjBgm').textContent = '起底乐'; }
    else { startBgm(); el('yjBgm').textContent = '止底乐'; } };
  el('yjClose').onclick = () => close();
  const KM = { KeyA:0, KeyS:1, KeyD:2, KeyF:3, KeyG:4, Space:0 };
  document.addEventListener('keydown', e => {
    if (e.repeat || KM[e.code] === undefined || !wrap.classList.contains('on')) return;
    e.preventDefault(); tapLane(KM[e.code]);
  });
}
export function open() {
  if (!el('yjRhythm')) buildDom();
  el('yjRhythm').classList.add('on');
}
export function close() {
  if (R && !R.over) { R.over = true; clearInterval(R.timer); }
  stopBgm(); afterglow(false);
  const j = el('yjJudge'); if (j) { j.className = ''; j.textContent = ''; }
  const w = el('yjRhythm'); if (w) w.classList.remove('on');
}
window.YJ_RHYTHM = { open, close, start, tapLane, now, get state() { return R; } };
