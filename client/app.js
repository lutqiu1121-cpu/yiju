import { Net } from './net.js';
import { Sound } from './audio.js';
import * as R from './render.js';

const $ = (s) => document.querySelector(s);
function tap() { tap(); if (navigator.vibrate) navigator.vibrate(8); }
const $$ = (s) => Array.from(document.querySelectorAll(s));

const lsGet = (k, d) => { try { const v = localStorage['getItem'](k); return v === null ? (d === undefined ? null : d) : v; } catch (e) { return d === undefined ? null : d; } };
const lsSet = (k, v) => { try { localStorage['setItem'](k, v); } catch (e) {} };
const store = (k, d) => { try { const v = lsGet(k, null); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const save = (k, v) => { try { lsSet(k, JSON.stringify(v)); } catch (e) {} };

const S = {
  manifest: null, themes: null, view: null, presence: [], meta: null, chat: [], you: -1,
  screen: 'today', selected: new Set(), selFrom: null, predict: null,
  games: [], cats: [], curGame: 'xiangqi', curVariant: '', cat: 'all', search: '',
  rooms: [], themeId: lsGet('qipai.theme') || 'rice',
  sliders: store('qipai.sliders', { grain: 38, shadow: 52, dot: 44, round: 50, motion: 55 }),
  history: store('qipai.history', []), stats: store('qipai.stats', { plays: 0, wins: 0, streak: 0 }),
  lastEnded: false, replayTimer: null, net: null, conn: 'connecting',
  sourceUrl: lsGet('qipai.sourceUrl') || '',
  guideShown: lsGet('qipai.guideSeen') === '1',
  typing: new Map(), typingTimer: null, lastTypingSent: 0,
  quickPhrases: ['承让', '请', '这一手妙', '且慢', '再开一枰？', '方才断线，重续中'],
  hall: null, scripts: [], board: [], halls: [], stageCue: '', baseTheme: null,
  botLevel: 0, hallOn: true, hallUrl: '', drawing: false, stroke: [],
  account: null, saveData: '', titleCatalog: [], wornKey: '', rafPending: false, lastChatLen: 0,
  rankCatalog: [], season: '', seasonName: '' 
};
const DEFAULT_HALL_DIR = 'https://gist.githubusercontent.com/yiju-archive/board/raw/halls.json';
const RANK_FALLBACK = [
  { name:'初执', gate:0 }, { name:'登堂', gate:40 }, { name:'入室', gate:100 },
  { name:'知味', gate:200 }, { name:'妙手', gate:350 }, { name:'国手', gate:560 },
  { name:'弈圣', gate:800 }
];
function rankGates() {
  const rc = (S.rankCatalog || []).filter(x => x && typeof x.gate === 'number');
  return rc.length === 7 ? rc : RANK_FALLBACK;
}
function rankInfo(pts) {
  const g = rankGates(); let i = 0;
  for (let k = 0; k < g.length; k++) if (pts >= g[k].gate) i = k;
  const nextGate = i + 1 < g.length ? g[i + 1].gate : null;
  return { name:g[i].name, idx:i, gate:g[i].gate, nextGate,
    next: nextGate === null ? 0 : Math.max(0, nextGate - pts) };
}
function seasonKey() { return new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7); }
function localRankData() {
  let r = store('qipai.rank', { season:'', pts:{}, lastSeason:'', lastRank:'初执' });
  if (!r.pts || typeof r.pts !== 'object') r.pts = {};
  const k = seasonKey();
  if (r.season !== k) {
    const vals = Object.values(r.pts).map(Number).filter(n => !isNaN(n));
    r.lastSeason = r.season; r.lastRank = rankInfo(vals.length ? Math.max(...vals) : 0).name;
    r.season = k; r.pts = {};
    save('qipai.rank', r);
  }
  return r;
}
function rankApplyLocal(game, win, draw, botLvl) {
  const r = localRankData();
  const base = draw ? 6 : win ? 30 + 4 * Math.max(0, Math.min(6, botLvl | 0)) : -12;
  r.pts[game] = Math.max(0, (r.pts[game] || 0) + base);
  save('qipai.rank', r);
  return { delta:base, info:rankInfo(r.pts[game]) };
}
function rankBadgeHtml(id) {
  const rk = rankNameOf(id);
  return rk && rk !== '初执' ? `<i class="game-rank">${escapeHtml(rk)}</i>` : '';
}
function rankNameOf(game) {
  const v = (S.account && S.account.save) || {};
  if (v.rankNames && v.rankNames[game] && v.rankNames[game].name) return v.rankNames[game].name;
  const r = localRankData();
  return rankInfo(r.pts[game] || 0).name;
}
function rankIdxOf(game) {
  const v = (S.account && S.account.save) || {};
  if (v.rankNames && v.rankNames[game]) return v.rankNames[game].idx || 0;
  const r = localRankData();
  return rankInfo(r.pts[game] || 0).idx;
}

async function boot() {
  try {
    const [m, t] = await Promise.all([
      fetch('./rules/manifest.json').then(r => r.ok ? r.json() : Promise.reject()),
      fetch('./themes/themes.json').then(r => r.ok ? r.json() : Promise.reject())
    ]);
    S.manifest = m; S.themes = t;
    S.games = m.games || []; S.cats = m.categories || [];
  } catch (e) {

    try {
      const [m, t] = await Promise.all([
        fetch('/rules/manifest.json').then(r => r.json()), fetch('/themes/themes.json').then(r => r.json())
      ]);
      S.manifest = m; S.themes = t; S.games = m.games || []; S.cats = m.categories || [];
    } catch (e2) {
      toast('玩法册未至，请检视卷帙');
      S.games = []; S.themes = { themes: [], sliders: [] };
    }
  }
  applyTheme(S.themeId);
  renderThemeGrid(); renderSliders(); renderCats(); renderGames(); renderRooms(); renderQuick();
  updateToday(); updateStats();
  bindUI(); bindExtraUI();
  S.net = new Net(onFrame, onStatus);
  S.net.connect();

  setTimeout(() => {
    if (!S.net.custom && location.protocol === 'file:') openHallPicker(true);
    else if (!S.guideShown) openGuide();
  }, 500);
  window.addEventListener('resize', debounce(() => renderPlay(), 120));
  window.addEventListener('orientationchange', () => setTimeout(() => renderPlay(), 220));
}
boot();

function rgbaAlpha(rgba, a) {
  const m = (rgba || '').match(/(\d+),\s*(\d+),\s*(\d+)/);
  return m ? `rgba(${m[1]},${m[2]},${m[3]},${a.toFixed(3)})` : `rgba(60,50,35,${a.toFixed(3)})`;
}
function applyTheme(id, persist = true) {
  const t = (S.themes && S.themes.themes || []).find(x => x.id === id) || (S.themes.themes || [])[0];
  if (!t) return;
  S.themeId = t.id; if (persist) lsSet('qipai.theme', t.id);
  const r = document.documentElement.style;
  const keys = ['bg','bg2','ink','ink2','accent','line','dot','card','cardInk','tile','tileEdge'];
  keys.forEach(k => r.setProperty('--' + k, t[k]));
  const sA = (S.sliders.shadow / 100) * .30;
  r.setProperty('--shadow', rgbaAlpha(t.shadow, sA));
  r.setProperty('--shadowA', String(sA));
  r.setProperty('--grain', String((S.sliders.grain / 100) * (t.paper || .4)));
  r.setProperty('--dotSize', (22 - (S.sliders.dot / 100) * 12).toFixed(1) + 'px');
  r.setProperty('--radius', (2 + (S.sliders.round / 100) * (t.radius || 6) * 1.6).toFixed(1) + 'px');
  r.setProperty('--motion', (S.sliders.motion / 100 * 1.7).toFixed(2));
  R.invalidate();
  const meta = $('meta[name="theme-color"]'); if (meta) meta.content = t.bg;
  $$('.theme').forEach(e => e.classList.toggle('on', e.dataset.theme === t.id));
}
function renderThemeGrid() {
  const el = $('#themeGrid'); if (!el) return;
  el.innerHTML = (S.themes.themes || []).map(t =>
    `<div class="theme ${t.id === S.themeId ? 'on' : ''}" data-theme="${t.id}">
      <div class="sw" style="background:linear-gradient(135deg,${t.bg},${t.bg2});border:1px solid ${t.line}"></div>
      <div class="tn">${t.name}<small>${t.en}</small></div></div>`).join('');
  el.querySelectorAll('.theme').forEach(e => e.onclick = () => { applyTheme(e.dataset.theme); tap(); renderPlay(); });
}
function renderSliders() {
  const el = $('#sliders'); if (!el) return;
  el.innerHTML = (S.themes.sliders || []).map(sl =>
    `<div class="slider"><label>${sl.name}<b id="sv-${sl.id}">${S.sliders[sl.id] ?? sl.default}</b></label>
      <input type="range" min="${sl.min}" max="${sl.max}" value="${S.sliders[sl.id] ?? sl.default}" data-slider="${sl.id}"></div>`).join('');
  el.querySelectorAll('input[data-slider]').forEach(inp => inp.oninput = () => {
    S.sliders[inp.dataset.slider] = +inp.value;
    const b = $('#sv-' + inp.dataset.slider); if (b) b.textContent = inp.value;
    save('qipai.sliders', S.sliders); applyTheme(S.themeId); renderPlay();
  });
}

function renderCats() {
  const el = $('#roomCats'); if (!el) return;
  const all = [{ id:'all', name:'全部 · ALL', no:'00' }].concat(S.cats);
  el.innerHTML = all.map(c => `<button class="cat ${S.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${c.no || ''} ${c.name}</button>`).join('');
  el.querySelectorAll('.cat').forEach(b => b.onclick = () => { S.cat = b.dataset.cat; renderCats(); renderGames(); tap(); });
}
function renderGames() {
  const el = $('#gameList'); if (!el) return;
  const q = S.search.trim().toLowerCase();
  const list = S.games.filter(g => (S.cat === 'all' || g.cat === S.cat) &&
    (!q || (g.name + g.tag + g.desc + g.id).toLowerCase().includes(q)));
  el.innerHTML = list.map((g, i) =>
    `<div class="game-card ${g.id === S.curGame ? 'sel' : ''}" data-game="${g.id}">
      <span class="no">${String(i + 1).padStart(2,'0')}</span><span class="seats">${g.min}–${g.max}人</span>
      ${rankBadgeHtml(g.id)}<h3>${g.name}</h3><p>${g.desc}</p><div class="tag">${g.tag}</div></div>`).join('') || '<div class="hint">没有匹配的玩法</div>';
  el.querySelectorAll('.game-card').forEach(c => c.onclick = () => {
    S.curGame = c.dataset.game;
    const g = S.games.find(x => x.id === S.curGame);
    S.curVariant = (g && g.variants[0]) || '';
    renderGames(); renderVariants(); openCreate(); tap();
  });
  renderVariants();
}
function renderVariants() {
  const el = $('#variantRow'); if (!el) return;
  const g = S.games.find(x => x.id === S.curGame); if (!g) { el.innerHTML = ''; return; }
  let vs;
  if (S.curGame === 'juben') {

    vs = (S.scripts || []).map(x => ({ v: x.id, label: `${escapeHtml(x.name)} · ${x.roles}人 · ${x.minutes}分` }));
    vs.push({ v: '现场导入', label: '现场导入（房主粘贴 JSON）' });
  } else vs = (g.variants || []).map(v => ({ v, label: escapeHtml(v) }));
  el.innerHTML = vs.map(x =>
    `<button class="variant ${x.v === S.curVariant ? 'on' : ''}" data-v="${escapeHtml(x.v)}">${x.label}</button>`).join('');
  el.querySelectorAll('.variant').forEach(b => b.onclick = () => {
    S.curVariant = b.dataset.v; renderVariants();
    if (S.curVariant === '现场导入') openScriptImport();
  });
}
function renderRooms() {
  const el = $('#openRooms'); if (!el) return;
  if (!S.rooms.length) { el.innerHTML = '<div class="hint">尚无雅集，设一席吧</div>'; return; }
  el.innerHTML = S.rooms.map(r =>
    `<div class="open-room" data-room="${r.id}" data-locked="${r.locked ? 1 : 0}">
      <span class="rid">${r.id}</span>
      <span class="rname">${escapeHtml(r.title || gameName(r.game))}${r.locked ? ' <i class="lock">· 锁</i>' : ''}</span>
      <span>${gameName(r.game)} · ${r.variant || ''}</span>
      <span class="rinfo">${r.seats}/${r.max} 席${r.bots ? ` · 隐士 ${r.bots}` : ''} · ${r.spectators} 旁观 · ${
        r.started ? '对局中' : (r.need ? `还差 ${r.need} 人` : '候着')}</span></div>`).join('');
  el.querySelectorAll('.open-room').forEach(e => e.onclick = () => {
    $('#roomCode').value = e.dataset.room;
    if (e.dataset.locked === '1') askRoomPassword(e.dataset.room);
    else joinRoom();
  });
}
function askRoomPassword(code) {
  modal('此席设有暗语', `
    <div class="guide"><div class="guide-step"><b>输入主家给的暗语</b>
      <p>暗语只于赴局时一验，不录于名录。</p></div></div>
    <div class="field"><label>入席暗语</label><input id="rpInput" maxlength="24" placeholder="暗语"></div>
    <div class="btn-row"><button class="btn primary" id="rpOk">赴局</button>
      <button class="btn" id="rpCancel">作罢</button></div>`, null);
  $('#rpOk').onclick = () => { const pw = $('#rpInput').value.trim(); closeModal(); joinRoom(pw); };
  $('#rpCancel').onclick = closeModal;
}
function gameName(id) { const g = S.games.find(x => x.id === id); return g ? g.name : '对局'; }

function onStatus(s) {
  S.conn = s;
  const el = $('#conn');
  el.className = 'conn' + (s === 'online' ? '' : ' off');
  el.querySelector('span').textContent = s === 'online' ? '已联机' :
    s === 'connecting' ? '连接中' : s === 'need-url' ? '待填地址' : '断线 · 重连中';
  if (s === 'need-url') el.onclick = () => askServerUrl(false);
  else el.onclick = null;
}
function onFrame(m) {
  switch (m.t) {
    case 'welcome':
      if (m.hall) { S.hall = m.hall; S.hallOn = m.hall.directoryOn !== false;
        S.hallUrl = m.hall.directory || DEFAULT_HALL_DIR; renderHallInfo(); }
      if (m.account && m.account.id) {
        S.account = { ok: true, id: m.account.id, name: m.account.name, save: m.account };
        renderAccount(); renderAccountCard();
      }
      if (m.reconnected) toast('已续前局');
      if (Array.isArray(m.titleCatalog)) S.titleCatalog = m.titleCatalog;
      if (Array.isArray(m.rankCatalog)) S.rankCatalog = m.rankCatalog;
      if (m.season) { S.season = m.season; S.seasonName = m.seasonName || ''; }
      renderAccount(); renderAccountCard(); renderGames();
      S.net.send({ t:'halls' }); S.net.send({ t:'scripts' }); S.net.send({ t:'rooms' });
      break;
    case 'scripts': S.scripts = m.list || []; if (S.curGame === 'juben') renderVariants(); break;
    case 'board': S.board = m.rows || []; renderBoards(); break;
    case 'halls':
      S.halls = m.list || []; S.hallOn = m.on !== false; S.hallUrl = m.url || S.hallUrl;
      renderBoards(); renderHallInfo(); if (m.note) toast(m.note);
      break;
    case 'record': downloadRecord(m); break;
    case 'account':
      S.account = m.ok ? { ok: true, id: m.id || '', name: m.name || '', save: m.save } : null;
      renderAccount(); renderAccountCard();
      if (m.note) toast(m.note);
      if (m.ok && m.name) S.net.setName(m.name);
      if (S.screen === 'stats') S.net.send({ t:'board' });
      break;
    case 'accountState':
      if (m.save && m.save.id) S.account = { ok:true, id:m.save.id, name:m.name || m.save.name, save:m.save };
      renderAccount(); renderAccountCard();
      if (m.note) toast(m.note);
      break;
    case 'save': downloadSave(m.data, m.name); break;
    case 'rooms': S.rooms = m.list || []; renderRooms(); break;
    case 'joined':
      lsSet('qipai.room', m.room);
      $('#lastRoomLine').textContent = `上回雅集：${m.room} · 第 ${m.seat >= 0 ? m.seat : '旁观'} 席`;
      go('play'); toast(m.matched ? '寻局得人，开枰' : (m.spectating ? '入席旁观' : `赴局 ${m.room}`));
      break;
    case 'state':
      S.view = m.view; S.presence = m.presence || []; S.meta = m.meta || S.meta;
      S.chat = m.chat || []; S.you = typeof m.you === 'number' ? m.you : (m.view && m.view.you) || -1;
      S.predict = null; S.selFrom = null; S.selected.clear();
      renderAll(); break;
    case 'diff': {
      if (!S.view) { S.net.send({ t: 'sync' }); break; }
      const cur = S.view.seq || 0;
      if (typeof m.seq === 'number' && m.seq > cur + 1) { S.net.send({ t: 'sync' }); break; }
      S.view = S.net.applyDiff(S.view, m.ops);
      if (m.presence) S.presence = m.presence;
      if (m.meta) S.meta = m.meta;
      S.predict = null; S.selected.clear();
      renderAll(); break;
    }
    case 'chat': S.chat.push(m.msg); renderChat(); break;
    case 'typing': onTyping(m); break;
    case 'error': toast(m.text || '此令未行'); Sound.alert(); break;
    case 'note': toast(m.text || ''); break;
    case 'undoAsk': askUndo(m.by); break;
    case 'stats':
      S.stats = { ...S.stats, ...m.stats }; save('qipai.stats', S.stats); updateStats(); break;
    case 'replay': playReplay(m); break;
    case 'pong': break;
  }
  if (S.view && S.view.ended && !S.lastEnded) onEnd();
  if (S.view && !S.view.ended) S.lastEnded = false;
}
function onEnd() {
  S.lastEnded = true;
  const v = S.view;
  const win = String(v.winner || '').length > 0 &&
    String(v.winner).split(',').includes(String(S.you));
  S.stats.plays++; if (win) S.stats.wins++;
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const today = dayKey(new Date()), yesterday = dayKey(new Date(Date.now() - 86400000));
  if (S.stats.lastDay !== today) {
    S.stats.streak = S.stats.lastDay === yesterday ? (S.stats.streak || 0) + 1 : 1;
    S.stats.lastDay = today;
  }
  save('qipai.stats', S.stats);
  S.history.unshift({ t: Date.now(), game: v.game, result: v.result, win });
  S.history = S.history.slice(0, 40); save('qipai.history', S.history);
  win ? Sound.win() : Sound.lose();
  let endMsg = v.result || '此局已终';
  const rm = S.meta && S.meta.rankMode;
  if (rm === 'local') {
    const r = rankApplyLocal(v.game, win, !win && !String(v.winner || '').length, (S.meta && S.meta.botLevel) || 0);
    endMsg += ' · 自修排位 ' + (r.delta >= 0 ? '+' : '') + r.delta + ' 墨分 · 现为' + r.info.name;
    renderGames();
  } else if (rm === 'hall') S.net.send({ t: 'accountState' });
  toast(endMsg);
  updateToday(); updateStats();
}

function renderPlay() {
  if (S.rafPending) return;
  S.rafPending = true;
  requestAnimationFrame(() => { S.rafPending = false; renderPlayNow(); });
}
function renderAll() { renderPlay(); renderRooms(); renderMyRoom(); updateToday(); }
function renderMyRoom() {
  const el = $('#myRoomPanel'); if (!el) return;
  const m = S.meta;
  const can = m && !m.started && S.you === 0;
  el.hidden = !can;
  if (!can) return;
  $('#mrTitle').textContent = m.title || (gameName(m.game) + ' · ' + m.id);
  $('#mrInfo').textContent = `邀请码 ${m.id} · ${m.locked ? '已设暗语' : '公开'} · ${
    m.allowSpectators ? '可旁观' : '不旁观'} · 隐士 ${m.bots || 0} 位 / 共 ${m.max} 席`;
}

function canAct(v) {
  if (!v || S.you < 0 || v.ended) return false;
  const simultaneous = ['point24', 'werewolf', 'undercover', 'solitaire',
    'juben', 'avalon', 'turtlesoup', 'mastermind', 'drawguess', 'tournament'].includes(v.game);
  return simultaneous ? (v.legal || []).length > 0 : v.turn === S.you;
}
function renderPlayNow() {
  const v = S.view;
  const drawV = S.predict || v;
  if (!v) {
    const t = $('#matchTitle'); if (t) t.textContent = '尚未入席';
    syncScriptTheme(); Sound.ambience(null, false);
    const st = $('#stageShow'); if (st) st.hidden = true;
    return;
  }
  const g = S.games.find(x => x.id === v.game);
  const title = S.meta && S.meta.title;
  $('#matchTitle').textContent = (title ? title + ' · ' : '') + (g ? g.name : '对局') + (v.variant ? ' · ' + v.variant : '');
  $('#matchMeta').textContent = `${(S.meta && S.meta.id) || v.room || ''} · ${v.phaseName} · 第 ${v.moveNo} 手` +
    (S.meta && S.meta.bots ? ` · 隐士 ${S.meta.bots} 位` : '');
  const canvas = $('#board');
  R.drawBoard(canvas, drawV, handleCell);
  R.renderHand($('#handRow'), v, S.selected);
  bindHand();
  R.renderCenter($('#tableCenter'), v);
  R.renderParty($('#partyPanel'), v, sendCode);
  renderSeats(); renderStatus(); renderChat(); renderLog(); renderActions();
  renderStage(); renderExtraActions(); renderDrawBoard(); syncScriptTheme();
  const hint = $('#handHint');
  const n = (v.legal || []).length;
  const party = v.renderer === 'party' || v.renderer === 'path';
  const waitText = party ? (v.phaseName || '等待其他人行动') : `等待座位 ${v.turn} 行动`;
  hint.textContent = v.ended ? '此局已终 · 可覆局或再开一枰' : (S.you < 0 ? '旁观中 · 可观不可落' :
    (canAct(v) ? `轮到你 · ${n} 个可点位置` : waitText)) +
    (S.selected.size ? ` · 已选 ${S.selected.size} 张` : '') + (S.selFrom != null ? ' · 再点目标格' : '');
}
function renderSeats() {
  const el = $('#seatList'); if (!el) return;
  el.innerHTML = (S.presence || []).map((p, i) =>
    `<div class="seat ${p.online ? 'on' : ''} ${S.view && S.view.turn === i ? 'turn' : ''}">
      <b>${String(i).padStart(2,'0')}</b><i class="dot"></i><span>${p.empty ? (p.sealed ? '已封盘' : '虚席') : p.name || '访客'}</span>
      <small>${p.bot ? '隐士陪玩' : p.empty ? (p.sealed ? '已封盘' : '虚席') : p.ready ? '已整襟' : p.online ? '在席' : '离席'}</small></div>`).join('');
}
function renderStatus() {
  const v = S.view; if (!v) return;
  const info = v.info || {};
  const bits = [];
  if (info.landlord >= 0) bits.push('帅方：座位 ' + info.landlord);
  if (info.mult > 1) bits.push('倍数 ×' + info.mult);
  if (info.wild) bits.push('癞子 ' + info.wild);
  if (info.pot) bits.push('共分 ' + info.pot);
  if (info.chips) bits.push('记分 ' + info.chips.join(' / '));
  if (info.wallLeft !== undefined) bits.push('牌墙 ' + info.wallLeft);
  if (info.wolves !== undefined) bits.push('存活狼人 ' + info.wolves);
  if (info.level) bits.push('级牌 ' + info.level);
  if (info.topCard) bits.push('顶牌 ' + R.cardLabel(info.topCard));
  if (info.color) bits.push('当前色 ' + info.color);
  if (info.phase === 'speech' || info.phase === 'describe')
    bits.push(`轮流打字 · 座位 ${info.speaker} 发言`);
  if (info.phase === 'vote' && info.voted !== undefined)
    bits.push(`已投 ${info.voted}/${info.aliveCount || 0}`);
  if (info.phase === 'night' && info.nightRole) bits.push('你的角色行动');
  if (info.canBuy) bits.push('可买地');
  if (v.result) bits.push(v.result);
  $('#statusText').textContent = bits.join(' · ') || (v.ended ? '对局结束' : v.phaseName);
  const lim = (S.meta && S.meta.turnLimit) || 60000;
  const c = Math.max(0, Math.min(1, (v.clock || lim) / lim));
  $('#clockBar').style.width = (c * 100).toFixed(1) + '%';
}
function renderChat() {
  const el = $('#chatList'); if (!el) return;
  el.innerHTML = (S.chat || []).slice(-30).map(c => {
    const tag = c.spectator ? '旁观' : (typeof c.seat === 'number' && c.seat >= 0 ? '座位 ' + c.seat : '');
    const who = escapeHtml(c.name || '访客') + (tag ? ` <small>${tag}</small>` : '');
    const sys = c.name === '系统';
    return `<div class="${sys ? 'sys' : ''}"><b>${who}</b> · ${escapeHtml(c.text)}</div>`;
  }).join('') || '<div class="hint">还没有人说话，先打个招呼吧</div>';
  el.scrollTop = el.scrollHeight;
}
function onTyping(m) {
  const key = String(m.seat);
  if (m.v) S.typing.set(key, { name: m.name || '访客', at: Date.now() });
  else S.typing.delete(key);
  renderTyping();
  clearTimeout(S.typingTimer);
  S.typingTimer = setTimeout(() => {
    const now = Date.now();
    for (const [k, val] of S.typing) if (now - val.at > 3200) S.typing.delete(k);
    renderTyping();
  }, 3400);
}
function renderTyping() {
  const el = $('#typingLine'); if (!el) return;
  const names = Array.from(S.typing.values()).map(x => x.name);
  el.textContent = names.length ? names.join('、') + ' 正在输入…' : '';
  el.classList.toggle('show', names.length > 0);
}
function sendTyping(on) { if (S.net) S.net.send({ t: 'typing', v: !!on }); }
function renderQuick() {
  const el = $('#quickRow'); if (!el) return;
  el.innerHTML = S.quickPhrases.map(p =>
    `<button class="qp" data-p="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join('');
  el.querySelectorAll('.qp').forEach(b => b.onclick = () => {
    $('#chatText').value = b.dataset.p; sendChat(); tap();
  });
}
function renderLog() {
  const el = $('#logList'); if (!el) return;
  el.innerHTML = (S.view && S.view.log || []).slice(-24).map(x => `<div>${escapeHtml(x)}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}
function renderActions() {
  const v = S.view; const bar = $('#actionBar'); if (!v || !bar) return;
  const legal = v.legal || [];
  const has = (c) => legal.includes(c);
  const act = canAct(v);
  $$('#actionBar .chip[data-act]').forEach(b => {
    const a = b.dataset.act;
    let on = true;
    if (a === 'pass') on = act && (has('pass') || has('skip'));
    else if (a === 'roll') on = act && has('roll');
    else if (a === 'draw') on = act && has('draw');
    else if (a === 'play-selected') on = act && (has('p:*') || legal.some(c => c.startsWith('p:')));
    else if (a === 'ready' || a === 'start') on = !v.ended && v.phase !== 'end';
    else if (a === 'undo' || a === 'draw-deal' || a === 'resign') on = !v.ended && S.you >= 0;
    b.disabled = !on;
  });

  $$('#actionBar .chip[data-code]').forEach(b => b.remove());
  const boardLike = v.renderer === 'party' || v.renderer === 'path';

  const extras = act && !boardLike ? legal.filter(c => !c.endsWith(':*') && !c.endsWith(':') &&
    !/^(c|f|x|m|o|d|p|solve|vote|night|poison):/.test(c) &&
    !['roll', 'skip'].includes(c)) : [];
  extras.slice(0, 18).forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip on'; b.dataset.code = c; b.textContent = chipLabel(c);
    b.onclick = () => sendCode(c);
    bar.appendChild(b);
  });
}
function chipLabel(c) {
  const map = { 'b:call':'随帖', 'b:raise':'加帖', 'b:fold':'敛牌', 'b:check':'过牌', 'b:ready':'摆好', 'b:show':'亮牌',
    hu:'胡牌', peng:'碰', gang:'杠', pass:'过 / 不响应', draw:'摸一张', uno:'呼笺!',
    'arrange:auto':'自动摆三道', save:'救人', poison:'毒人', buy:'买地', next:'下一步', new:'换一题',
    n:'继续 · 推进', k:'开盅验点', d:'要牌', p:'过 / 跳过' };
  if (map[c]) return map[c];
  if (c.startsWith('bid:')) return c === 'bid:0' ? '不叫' : '叫 ' + c.slice(4);
  if (c.startsWith('vote:')) return '投 ' + c.slice(5);
  if (c.startsWith('night:')) return '选 ' + c.slice(6);
  if (c.startsWith('color:')) return '换 ' + ({R:'朱',Y:'黄',G:'绿',B:'蓝'}[c.slice(6)] || c.slice(6));
  if (c.startsWith('trump:')) return '将牌 · ' + ({N:'无将',S:'黑桃',H:'红桃',C:'梅花',D:'方块'}[c.slice(6)] || c.slice(6));
  if (c.startsWith('chi:')) return '吃 ' + c.slice(4);
  if (c.startsWith('reveal:')) return '亮出线索 ' + c.slice(7);
  if (c.startsWith('hold:')) return '扣着不公开';
  if (c.startsWith('poison:')) return '毒 ' + c.slice(7);
  if (c.startsWith('b:')) return '落帖 · ' + c.slice(2);
  if (c.startsWith('p:')) return '出牌 ' + c.slice(2);

  return c.replace(/^([a-z]+):(.*)$/, (_, a, b) => a + ' · ' + (b || '确认'));
}

function handleCell(i) {
  const v = S.predict || S.view; if (!v) return;
  const legal = v.legal || [];
  if (S.selFrom != null) {
    const code = legal.find(c => c === `m:${S.selFrom}>${i}` || c === `o:${S.selFrom}>${i}` || new RegExp(`^d:\\d+>${i}$`).test(c));
    S.selFrom = null;
    if (code) { sendCode(code); return; }
    renderPlay(); return;
  }
  const direct = legal.find(c => c === `c:${i}` || c === `f:${i}` || c === `x:${i}` || new RegExp(`^d:\\d+>${i}$`).test(c));
  if (direct) { sendCode(direct); return; }
  const asFrom = legal.find(c => c.startsWith(`m:${i}>`) || c.startsWith(`o:${i}>`));
  if (asFrom) { S.selFrom = i; tap(); renderPlay(); return; }
  const to = legal.filter(c => /^(m|o|d):/.test(c) && Number(c.split('>')[1]) === i);
  if (to.length === 1) { sendCode(to[0]); return; }
  if (to.length > 1) { S.selFrom = Number(to[0].split('>')[0].split(':')[1]); tap(); renderPlay(); }
}
function bindHand() {
  $$('#handRow .card').forEach(el => el.onclick = () => {
    const i = +el.dataset.idx, v = S.view;
    if (!v) return;
    const pStar = (v.legal || []).some(c => c === 'p:*');
    const single = (v.legal || []).includes('p:' + i);
    const canSwap = (v.legal || []).includes('arrange:swap:*');
    if (!pStar && single && !canSwap) { sendCode('p:' + i); return; }
    if (S.selected.has(i)) S.selected.delete(i); else S.selected.add(i);
    if (canSwap && S.selected.size === 2) {
      const pair = Array.from(S.selected);
      S.selected.clear();
      sendCode('arrange:swap:' + pair.join(','));
      return;
    }
    Sound.card(); renderPlay();
  });
}
function sendCode(code) {
  if (!S.net || !code) return;
  if (S.view && S.view.ended) { toast('对局已结束'); return; }
  S.predict = S.net.predict(S.view, code);
  S.net.send({ t: 'move', code });
  if (/^(c|f|x|m|o):/.test(code)) Sound.place(); else Sound.card();
  renderPlay();
}
function go(name) {
  S.screen = name;
  $$('.screen').forEach(e => e.classList.toggle('active', e.id === 'screen-' + name));
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
  $('#screens').scrollTop = 0;
  if (name === 'play') setTimeout(renderPlay, 30);
  if (name === 'stats') { updateStats(); renderAccountCard(); if (S.net) { S.net.send({ t:'board' }); S.net.send({ t:'halls' }); S.net.send({ t:'accountState' }); } }
  if (name === 'today') updateToday();
}

function modal(title, html, onOk) {
  $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html;
  $('#modal').hidden = false;
  $('#modalClose').onclick = closeModal;
  const ok = $('#modalOk'); if (ok && onOk) ok.onclick = () => { onOk(); closeModal(); };
}
function closeModal() { $('#modal').hidden = true; }
let toastTimer;
function toast(text) {
  const el = $('#toast'); if (!el || !text) return;
  el.textContent = text; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
function askUndo(by) {
  modal('乞复之请', `<p>${escapeHtml(by)} 请复一着，允否？</p>
    <button class="btn primary" id="uYes">允</button><button class="btn" id="uNo">不允</button>`, null);
  $('#uYes').onclick = () => { S.net.send({ t:'act', a:'undoYes' }); closeModal(); };
  $('#uNo').onclick = () => { S.net.send({ t:'act', a:'undoNo' }); closeModal(); };
}

function openGuide() {
  modal('入门小引 · 与君同弈', `
    <div class="guide">
      <div class="guide-step"><b>壹 · 连上棋馆</b>
        <p>房主那台机器起好棋馆（<code>dotnet run --project server</code>），启动时会印出可直接照抄的局域网地址。</p>
        <p>手机或 APK：与主机同一 WiFi，首启「选一个棋馆」点一下即可；亦可到「肆 · 案牍 → 棋馆地址」手填，例如 <code>192.168.1.8:5080</code>。名录默认开启，万一不通，手填照样玩。</p></div>
      <div class="guide-step"><b>贰 · 设席开枰</b>
        <p>于「设席」挑一局，可题雅号、设暗语、许旁观、定每步思考 / 出牌之刻、选超时之法，并挑隐士棋力；每局另有本局专属规制，皆在「房规」里。</p>
        <p>记下五字房号，另一席填之点「赴局」。人未齐可一键请隐士补满，寻局八息亦自补齐；真人入席，隐士自退。</p></div>
      <div class="guide-step"><b>叁 · 落子出牌</b>
        <p>棋盘小圆点是可落处；走子类先点己子再点目标格，牌类先点手牌再按「出牌」。房内可打字闲谈、发一键短句，还看得见谁正在打字。</p>
        <p>折狱录跟幕卡走：旁白逐句浮现、线索翻牌、轮流打字发言、终幕指认；私本只你自己看得见。</p></div>
      <div class="guide-step"><b>肆 · 横竖与外观</b>
        <p>竖屏：盘在上、牌在下、底部「〇—肆」为引；横屏：左盘右席，导航收作侧边细条。「肆 · 案牍」可换十品纸色；折狱开卷自依本中设色，散场复归君选。落子发牌有轻动画，系统开了减动效便自动收敛。</p></div>
      <div class="guide-step"><b>伍 · 存档 / 段位 / 剧本 / 源码</b>
        <p>不题名照样玩，战绩记本机榜；题名后自动建一份加密存档，每局终了自动写回，可导出 <code>.yijusave</code> 携往别馆，导入须再验口令。</p>
        <p>段位七阶按月重置，馆赛所得折半计入，自修全额且隐士随段位增强。「叁 · 战绩」有本机榜与棋馆目录。剧本只在房主本地 <code>scripts/</code>，丢一个新 JSON 即更新，亦可当场呈本。</p>
        <p>断线自续，终局可覆，「肆 · 案牍」可携谱还谱。源码与「源码公开 · 禁止商用」协议随版本发布。</p></div>
    </div>
    <button class="btn primary" id="guideOk">领了</button>`, null);
  $('#guideOk').onclick = () => {
    S.guideShown = true; lsSet('qipai.guideSeen', '1'); closeModal();
  };
}
function askServerUrl(first) {
  modal(first ? '第一步 · 连接棋馆' : '连接棋馆', `
    <div class="guide"><div class="guide-step">
      <b>填一下棋馆地址</b>
      <p>你现在用的是 APK / 本地页面，页面本身不带棋馆。先在隐士上运行 <code>dotnet publish/server/qipai-server.dll</code>，启动日志会打印可照抄的局域网地址。</p>
      <p>手机与隐士需在同一 WiFi。填好后本页会自动重连，状态灯变「已联机」即可开局。</p>
    </div></div>
    <div class="field"><label>棋馆地址</label>
      <input id="suInput" class="url-input" placeholder="192.168.1.8:5080" value="${escapeHtml(S.net.custom || '')}"></div>
    <div class="btn-row"><button class="btn primary" id="suOk">连馆</button>
      <button class="btn" id="suSkip">容后再议</button>
      <button class="btn ghost" id="suGuide">观小引</button></div>`, null);
  $('#suOk').onclick = () => {
    const u = ($('#suInput').value || '').trim();
    if (!u) { toast('请先填地址'); return; }
    $('#serverUrl').value = u;
    S.net.setUrl(u); closeModal(); toast('正在连接 ' + u);
  };
  $('#suSkip').onclick = closeModal;
  $('#suGuide').onclick = () => { closeModal(); openGuide(); };
}

function optFieldHtml(o) {
  const k = escapeHtml(o.key), l = escapeHtml(o.label);
  if (o.type === 'toggle') return `<label class="check"><input type="checkbox" data-opt="${k}" ${o.def ? 'checked' : ''}> ${l}</label>`;
  if (o.type === 'select') {
    const os = (o.values || []).map(v => {
      const parts = String(v).split('|');
      return `<option value="${escapeHtml(parts[0])}" ${parts[0] === String(o.def) ? 'selected' : ''}>${escapeHtml(parts[1] || parts[0])}</option>`;
    }).join('');
    return `<div class="field"><label>${l}</label><select data-opt="${k}">${os}</select></div>`;
  }
  if (o.type === 'number') return `<div class="field"><label>${l}</label><input data-opt="${k}" type="number" value="${o.def}" min="${o.min}" max="${o.max}" step="${o.step}"></div>`;
  return `<div class="field"><label>${l}</label><input data-opt="${k}" maxlength="60" value="${escapeHtml(String(o.def || ''))}"></div>`;
}
function optGroupsHtml(g) {
  const order = (S.manifest && S.manifest.optionGroups) || ['更漏', '节候', '缓急', '局仪', '规制'];
  const by = {};
  (g.options || []).forEach(o => { (by[o.group] = by[o.group] || []).push(o); });
  const names = order.filter(x => by[x]).concat(Object.keys(by).filter(x => !order.includes(x)));
  return names.map(n => `<div class="opt-group"><div class="side-h" style="margin-top:12px">${escapeHtml(n)}</div>` +
    by[n].map(optFieldHtml).join('') + '</div>').join('');
}
function collectOpts() {
  const o = {};
  $$('[data-opt]').forEach(el => {
    o[el.dataset.opt] = el.type === 'checkbox' ? el.checked
      : el.type === 'number' ? Number(el.value) : el.value;
  });
  return o;
}
function openCreate() {
  const g = S.games.find(x => x.id === S.curGame) || S.games[0]; if (!g) return;
  const variants = S.curGame === 'juben'
    ? ((S.scripts || []).map(x => `<option value="${escapeHtml(x.id)}">${escapeHtml(x.name)} · ${x.roles}人</option>`).join('') +
       `<option value="现场导入">现场导入（先粘贴剧本）</option>`)
    : (g.variants || []).map(v => `<option value="${escapeHtml(v)}" ${v === S.curVariant ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('');
  modal('设席 · ' + g.name, `
    <div class="field"><label>玩法变体</label><select id="mkVariant">${variants}</select></div>
    <div class="field"><label>雅号（可留空）</label><input id="mkTitle" maxlength="24" placeholder="例：周末手谈 · 来者不拒"></div>
    <div class="field"><label>开局人数 ${g.min}–${g.max} 人 · 开局后空席封存</label>
      <input id="mkSeats" type="number" min="${g.min}" max="${g.max}" value="${g.min}"></div>
    <div class="field"><label>入席暗语（留空=公开）</label><input id="mkPassword" maxlength="24" placeholder="不填即无暗语"></div>
    <label class="check"><input type="checkbox" id="mkFill"> 一键请隐士补满到开局人数</label>
    <div class="field"><label>或指定请几位隐士（0–${g.max - 1}）</label>
      <input id="mkBots" type="number" min="0" max="${g.max - 1}" value="0"></div>
    ${optGroupsHtml(g)}
    <div class="hint">人未至亦可开枰：隐士先陪，真人入席自替之。诸项皆随此席生效。<br>
      「局仪」里可开排位：馆赛须先题名，所得按折算计入段位；自修只记本机，隐士随段位增强。</div>
    ${S.curGame === 'juben' ? '<button class="btn ghost" id="mkImport">导入剧本 JSON</button>' : ''}
    <button class="btn primary" id="mkCreate">设席入座</button>
    <button class="btn" id="mkMatch">寻局（八息未齐自邀隐士）</button>
    <button class="btn" id="mkWatch">旁观雅集</button>`, null);
  $('#mkCreate').onclick = () => {
    const variant = $('#mkVariant').value;
    S.curVariant = variant; renderVariants();
    const opts = collectOpts();
    if (opts.rankMode === 'local') {
      opts.botLevel = Math.min(6, rankIdxOf(S.curGame));
      toast('自修排位 · 隐士随段位增强至第 ' + (opts.botLevel + 1) + ' 阶');
    }
    S.net.send({ t:'create', game:S.curGame, variant,
      seats:+$('#mkSeats').value, clock:opts.clock,
      title:$('#mkTitle').value.trim(), password:$('#mkPassword').value.trim(),
      spectators:opts.spectators, fillBots:$('#mkFill').checked,
      bots:+$('#mkBots').value, botLevel:+opts.botLevel,
      opts });
    closeModal();
  };
  $('#mkMatch').onclick = () => { S.net.send({ t:'match', game:S.curGame, variant:$('#mkVariant').value }); closeModal(); toast('匹配中… 8 秒凑不齐会自动请隐士补位'); };
  $('#mkWatch').onclick = () => { closeModal(); go('rooms'); $('#roomCode').focus(); };
  if ($('#mkImport')) $('#mkImport').onclick = () => openScriptImport();
}
function joinRoom(password) {
  const code = ($('#roomCode').value || '').trim().toUpperCase();
  if (!code) { toast('请填雅号'); return; }
  S.net.send(password ? { t:'join', room:code, password } : { t:'join', room:code });
}

function recent(n) {
  const out = new Array(n).fill(0);
  S.history.slice(0, n).reverse().forEach((h, i) => out[i] = h.win ? 1 : 0);
  return out;
}
function updateToday() {
  $('#gameCount').textContent = S.games.length;
  $('#themeCount').textContent = (S.themes.themes || []).length;
  $('#rendererCount').textContent = (S.manifest && S.manifest.renderers || []).length;
  $('#streakNum').textContent = (S.stats.streak || 0) + ' 天';
  $('#winrate').textContent = '胜率 ' + (S.stats.plays ? Math.round(S.stats.wins / S.stats.plays * 100) + '%' : '—');
  $('#playCount').textContent = '对局 ' + S.stats.plays;
  const r = lsGet('qipai.room');
  const inp = $('#roomCode'), line = $('#lastRoomLine');
  if (r && inp && !inp.value) inp.value = r;
  if (r && line && !line.textContent) line.textContent = '已回填上回雅集 ' + r + ' · 点「赴局」续局';
  R.sparkline($('#streakChart'), recent(9).map((x, i, a) => a.slice(0, i + 1).reduce((s, y) => s + y, 0)));
}
function updateStats() {
  $('#stPlays').textContent = S.stats.plays; $('#stWins').textContent = S.stats.wins;
  $('#stRate').textContent = S.stats.plays ? Math.round(S.stats.wins / S.stats.plays * 100) + '%' : '—';
  $('#stStreak').textContent = S.stats.streak;
  $('#formLabel').textContent = S.history.length ? '最近 ' + Math.min(12, S.history.length) + ' 局' : '尚无记录';
  R.sparkline($('#formChart'), recent(12), { h: 96 });
  $('#historyList').innerHTML = S.history.slice(0, 14).map(h =>
    `<div class="history"><i>${new Date(h.t).toLocaleDateString('zh-CN')}</i><span>${gameName(h.game)}</span>
      <span style="margin-left:auto;color:var(--accent)">${h.win ? '胜' : '负'}</span></div>`).join('') || '<div class="hint">还没有对局记录</div>';
}

function playReplay(m) {
  clearInterval(S.replayTimer);
  let v = m.start || {};
  let i = 0;
  const frames = m.frames || [];
  toast('覆局起 · 共 ' + frames.length + ' 帧');
  const saved = S.view;
  go('play');
  S.replayTimer = setInterval(() => {
    if (i >= frames.length) { clearInterval(S.replayTimer); S.view = saved; renderPlay(); toast('覆局毕'); return; }
    v = S.net.applyDiff(v, frames[i++]);
    S.view = v; renderPlay();
  }, 380);
}

function bindUI() {
  $$('.nav-item').forEach(b => b.onclick = () => { go(b.dataset.screen); tap(); });
  $('#quickMatch').onclick = () => { S.net.send({ t:'match', game:S.curGame, variant:S.curVariant }); toast('匹配中…'); };
  $('#openCreate').onclick = openCreate;
  $('#joinRoom').onclick = joinRoom;
  $('#roomCode').onkeydown = (e) => { if (e.key === 'Enter') joinRoom(); };
  $('#refreshRooms').onclick = () => S.net.send({ t:'rooms' });
  $('#gameSearch').oninput = (e) => { S.search = e.target.value; renderGames(); };
  $('#chatSend').onclick = sendChat;
  $('#chatText').onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
  $('#chatText').oninput = () => {
    const now = Date.now();
    if (now - S.lastTypingSent > 1200) { S.lastTypingSent = now; sendTyping(true); }
    clearTimeout(S.typingOff);
    S.typingOff = setTimeout(() => sendTyping(false), 1800);
  };
  $$('#actionBar .chip[data-act]').forEach(b => b.onclick = () => action(b.dataset.act));
  $('#modalClose').onclick = closeModal;
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
  $('#soundToggle').onclick = (e) => {
    const on = !Sound.isEnabled(); Sound.setEnabled(on);
    e.target.classList.toggle('on', on); e.target.textContent = on ? '开' : '关';
  };
  $('#motionToggle').onclick = (e) => {
    const on = !e.target.classList.contains('on');
    e.target.classList.toggle('on', on); e.target.textContent = on ? '开' : '关';
    document.documentElement.style.setProperty('--motion', on ? (S.sliders.motion / 100 * 1.7).toFixed(2) : '0');
  };
  $('#serverUrl').value = lsGet('qipai.url') || '';
  $('#serverUrl').onchange = (e) => S.net.setUrl(e.target.value.trim());
  $('#sourceUrl').value = S.sourceUrl;
  $('#sourceUrl').onchange = (e) => {
    S.sourceUrl = e.target.value.trim(); lsSet('qipai.sourceUrl', S.sourceUrl);
  };
  $('#openSource').onclick = () => {
    const u = ($('#sourceUrl').value || '').trim();
    if (!u) { toast('先在上方填源码地址'); return; }
    const target = /^https?:\/\//.test(u) ? u : 'https://' + u;
    if (location.protocol === 'file:') location.href = target;
    else window.open(target, '_blank', 'noopener');
  };
  $('#openGuide').onclick = openGuide;
  $('#openGuide2').onclick = openGuide;
  $('#playerName').value = lsGet('qipai.name') || '';
  $('#playerName').onchange = (e) => S.net.setName(e.target.value.trim());
  $('#reconnectBtn').onclick = () => { S.net.disconnect(); S.net.connect(); toast('重新连接中'); };
  $('#mrAddBot').onclick = () => S.net.send({ t:'act', a:'addBot' });
  $('#mrFillBots').onclick = () => S.net.send({ t:'act', a:'fillBots', to: S.meta ? S.meta.max : 2 });
  $('#mrRemoveBot').onclick = () => S.net.send({ t:'act', a:'removeBot' });
  $('#clearHistory').onclick = () => {
    S.history = []; S.stats = { plays: 0, wins: 0, streak: 0 };
    save('qipai.history', []); save('qipai.stats', S.stats);
    updateToday(); updateStats(); toast('已清空本机显示记录（账号存档不受影响）');
  };
  const st = $('#soundToggle'); st.classList.toggle('on', Sound.isEnabled()); st.textContent = Sound.isEnabled() ? '开' : '关';
}
function sendChat() {
  const el = $('#chatText'), t = (el.value || '').trim();
  if (!t) return;
  S.net.send({ t:'chat', text:t }); el.value = '';
  clearTimeout(S.typingOff); sendTyping(false);
}
function action(a) {
  switch (a) {
    case 'ready': S.net.send({ t:'ready', v:true }); break;
    case 'start': S.net.send({ t:'start' }); break;
    case 'play-selected': {
      if (!S.selected.size) { toast('先点选手牌'); break; }
      const idx = Array.from(S.selected).sort((x, y) => x - y);
      sendCode('p:' + idx.join(','));
      break;
    }
    case 'pass': sendCode((S.view.legal || []).includes('pass') ? 'pass' : 'skip'); break;
    case 'roll': sendCode('roll'); break;
    case 'draw': sendCode('draw'); break;
    case 'undo': S.net.send({ t:'act', a:'undo' }); break;
    case 'draw-deal': S.net.send({ t:'act', a:'draw' }); break;
    case 'resign': S.net.send({ t:'act', a:'resign' }); break;
    case 'replay': S.net.send({ t:'replay' }); break;
    case 'leave': S.net.send({ t:'leave' }); S.view = null; S.presence = []; renderPlay(); go('today'); break;
  }
}
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function debounce(f, ms) { let t; return () => { clearTimeout(t); t = setTimeout(f, ms); }; }

function renderStage() {
  const v = S.view, el = $('#stageShow'); if (!el) return;
  const info = (v && v.info) || {};
  const isScript = !!(v && v.game === 'juben');
  el.hidden = !isScript;
  if (!isScript) { S.stageCue = ''; Sound.ambience(null, false); return; }
  const cue = info.cue || '';
  if (cue && cue !== S.stageCue) { S.stageCue = cue; Sound.cue(cue); }
  const amb = info.ambience || {};
  Sound.ambience(amb.drone || 'rain', !v.ended);
  const stage = info.stage || 'curtain';
  $('#showCurtain').innerHTML = `<div class="act-no">第 ${String(info.actNo || 1).padStart(2,'0')} 幕 / 共 ${info.actCount || 3} 幕</div>
    <div class="act-title">${escapeHtml(info.actTitle || info.scriptName || '幕')}</div>
    <div class="script-name">${escapeHtml(info.scriptName || '')} · ${escapeHtml(info.synopsis || '')}</div>`;
  const legal = v.legal || [];
  let body = '';
  const lines = info.narration || [];
  if (lines.length) body += `<div class="show-lines">${lines.map(x => `<p>${escapeHtml(x)}</p>`).join('')}</div>`;
  const pub = info.publicClues || [];
  if (pub.length) body += `<div class="side-h" style="margin-top:14px">CLUES · 已公开线索（点一下翻面）</div><div class="clue-wall">` +
    pub.map(c => `<div class="clue" data-flip><b>${escapeHtml(c.title)}</b><small>${escapeHtml(c.text)}</small></div>`).join('') + `</div>`;
  if (info.myRole) {
    const r = info.myRole, priv = info.privateClues || [];
    body += `<div class="role-card"><h4>${escapeHtml(r.public || '你的角色')}</h4>
      <p>${escapeHtml(r.private || '')}</p><p class="sec">秘：${escapeHtml(r.secret || '')}</p>
      <p>目标：${escapeHtml(r.goal || '')}</p></div>`;
    if (priv.length) body += `<div class="side-h">PRIVATE · 只有你拿到的线索</div><div class="clue-wall">` +
      priv.map(c => `<div class="clue secret" data-flip><b>${escapeHtml(c.title)}</b><small>${escapeHtml(c.text)}</small></div>`).join('') + `</div>`;
  }
  if (stage === 'discuss') {
    body += `<div class="side-h" style="margin-top:14px">DISCUSS · 已发言 ${info.said || 0}/${info.seatsTotal || 0} · 当前座位 ${info.speaker} · 剩 ${info.discussSeconds || 0} 秒</div>`;
    if (legal.includes('say:*')) body += `<div class="join-line"><input id="stageSay" maxlength="120" placeholder="轮到你了，留一句"><button class="btn small" data-sc="say">发出</button></div>`;
    if (legal.includes('n')) body += `<div class="show-actions"><button data-sc="n">收起讨论，转入下一幕</button></div>`;
  }
  if (stage === 'vote') {
    body += `<div class="side-h" style="margin-top:14px">${escapeHtml(info.question || '请指认')} · 已投 ${info.voted || 0}/${info.seatsTotal || 0}${info.revote ? ' · 平票复议' : ''}</div>`;
    const names = info.roleNames || [];
    const vs = legal.filter(c => /^v:\d+$/.test(c));
    if (vs.length) body += `<div class="show-actions">` + vs.map(c => {
      const i = +c.slice(2), nm = (names[i] && names[i].name) || ('角色 ' + i);
      return `<button data-sc="${c}">指认「${escapeHtml(nm)}」</button>`;
    }).join('') + `</div>`;
  }
  if (stage === 'clues' && !info.isDm) {
    const mine = info.privateClues || [];
    const rc = legal.filter(c => /^reveal:/.test(c));
    if (rc.length) body += `<div class="side-h" style="margin-top:14px">此幕 · 手中线索，示于全席抑或扣着？</div><div class="show-actions">` +
      rc.map(c => {
        const id = c.slice(7), card = mine.find(x => x.id === id) || { title: id };
        return `<button data-sc="${c}">亮出「${escapeHtml(card.title)}」</button>`;
      }).join('') + `<button data-sc="hold:all">都扣着</button></div>`;
    else if (legal.includes('hold:all')) body += `<div class="side-h" style="margin-top:14px">此幕 · 手中无私秘线索</div><div class="show-actions"><button data-sc="hold:all">跳过表态</button></div>`;
  }
  if (info.isDm && info.dmAnswer) body += `<div class="role-card"><h4>主持人 · 答案</h4><p>${escapeHtml(info.dmAnswer)}</p></div>`;
  if (legal.includes('n') && stage !== 'discuss') {
    const t = stage === 'curtain' ? '幕起' : stage === 'narration' ? '读下一句' : stage === 'clues' ? '发线索 / 进入讨论' : '继续';
    body += `<div class="show-actions"><button class="primary" data-sc="n">${t}</button></div>`;
  }
  if (info.ending) body += `<div class="show-ending"><b>${escapeHtml(info.ending.title || '散场')}</b><p>${escapeHtml(info.ending.text || '')}</p>` +
    (info.ending.picked ? `<p class="sec">全桌指认了「${escapeHtml(info.ending.picked)}」</p>` : '') + `</div>`;
  if (info.myEnding) body += `<div class="role-card"><h4>${escapeHtml(info.myEnding.role || '你的结局')}</h4><p>${escapeHtml(info.myEnding.text || '')}</p><p class="sec">目标：${escapeHtml(info.myEnding.goal || '')}</p></div>`;
  else if (v.ended) body += `<div class="show-ending"><b>${escapeHtml(v.result || '本局结束')}</b></div>`;
  $('#showBody').innerHTML = body;
  $$('#showBody .clue[data-flip]').forEach(e => e.onclick = () => e.classList.toggle('flipped'));
  $$('#showBody [data-sc]').forEach(b => b.onclick = () => {
    const c = b.dataset.sc;
    if (c === 'say') { const inp = $('#stageSay'); sendCode('say:' + ((inp && inp.value.trim()) || '')); }
    else sendCode(c);
  });
  const si = $('#stageSay');
  if (si) si.onkeydown = e => { if (e.key === 'Enter') sendCode('say:' + (si.value.trim() || '')); };
}

function syncScriptTheme() {
  const v = S.view, info = (v && v.info) || {};
  const isScript = !!(v && v.game === 'juben' && !v.ended && info.theme);
  if (isScript) {
    if (!S.baseTheme) S.baseTheme = lsGet('qipai.theme') || S.themeId;
    const t = (S.themes.themes || []).find(x => x.name === info.theme || x.id === info.theme);
    if (t && t.id !== S.themeId) applyTheme(t.id, false);
  } else if (S.baseTheme) {
    applyTheme(S.baseTheme, false); S.themeId = S.baseTheme; S.baseTheme = null;
  }
}

function renderExtraActions() {
  const el = $('#extraActions'); if (!el) return;
  const v = S.view;
  const ok = !!(v && ['nim', 'endgame', 'junqi4'].includes(v.game) && !v.ended);
  el.hidden = !ok;
  if (!ok) { el.innerHTML = ''; return; }
  const legal = (v.legal || []).filter(c => c.startsWith('c:'));
  el.innerHTML = `<div class="side-h">请择一手</div><div class="variant-row">` +
    legal.slice(0, 40).map(c => {
      let label;
      if (v.game === 'nim') { const a = c.slice(2).split(','); label = `第 ${+a[0] + 1} 堆取 ${a[1]} 枚`; }
      else if (v.game === 'endgame') label = `候选解 ${+c.slice(2) + 1}`;
      else label = `出第 ${+c.slice(2) + 1} 枚暗子`;
      return `<button class="variant" data-ac="${escapeHtml(c)}">${escapeHtml(label)}</button>`;
    }).join('') + `</div>`;
  $$('#extraActions [data-ac]').forEach(b => b.onclick = () => sendCode(b.dataset.ac));
}

function drawPoint(cv, e) {
  const r = cv.getBoundingClientRect();
  return [Math.round((e.clientX - r.left) / r.width * 1000), Math.round((e.clientY - r.top) / r.height * 1000)];
}
function renderDrawBoard() {
  const wrap = $('#drawWrap'), cv = $('#drawCanvas'); if (!wrap || !cv) return;
  const v = S.view, info = (v && v.info) || {};
  const on = !!(v && v.game === 'drawguess' && !v.ended);
  wrap.hidden = !on;
  if (!on) return;
  const painter = !!info.isPainter;
  $('#drawHint').textContent = painter ? `你来画：「${info.myWord || ''}」` : `看座位 ${info.painter} 画，打字猜词`;
  const ctx = cv.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  ctx.fillStyle = (css.getPropertyValue('--tile') || '#fff').trim(); ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = (css.getPropertyValue('--ink') || '#222').trim();
  ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  (info.strokes || []).forEach(st => {
    const a = String(st).split(',').map(Number); if (a.length < 4) return;
    ctx.beginPath(); ctx.moveTo(a[0] / 1000 * cv.width, a[1] / 1000 * cv.height);
    for (let i = 2; i + 1 < a.length; i += 2) ctx.lineTo(a[i] / 1000 * cv.width, a[i + 1] / 1000 * cv.height);
    ctx.stroke();
  });
  if (!painter) { cv.style.cursor = 'default'; cv.onpointerdown = cv.onpointermove = cv.onpointerup = null; return; }
  cv.style.cursor = 'crosshair';
  cv.onpointerdown = (e) => {
    e.preventDefault(); S.drawing = true; S.stroke = [];
    const q = drawPoint(cv, e); S.stroke.push(q[0], q[1]);
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
  };
  cv.onpointermove = (e) => {
    if (!S.drawing) return;
    const q = drawPoint(cv, e), n = S.stroke.length;
    if (n < 2 || Math.abs(q[0] - S.stroke[n - 2]) + Math.abs(q[1] - S.stroke[n - 1]) < 4) return;
    S.stroke.push(q[0], q[1]);
    ctx.beginPath(); ctx.moveTo(S.stroke[n - 2] / 1000 * cv.width, S.stroke[n - 1] / 1000 * cv.height);
    ctx.lineTo(q[0] / 1000 * cv.width, q[1] / 1000 * cv.height); ctx.stroke();
  };
  cv.onpointerup = () => {
    if (!S.drawing) return; S.drawing = false;
    if (S.stroke.length >= 4) sendCode('draw:' + S.stroke.join(','));
    S.stroke = [];
  };
}

function renderBoards() {
  const el = $('#boardLocal');
  if (el) {
    const rows = S.board || [];
    el.innerHTML = rows.length ? rows.map(r =>
      `<div class="board-row"><span class="brank">${String(r.rank).padStart(2,'0')}</span>
        <span class="bname">${escapeHtml(r.name)}</span>
        <span class="bmeta">${r.wins} 胜 / ${r.plays} 局 · 连 ${r.streak}</span></div>`).join('')
      : '<div class="hint">还没有本机战绩，打一局就有了</div>';
  }
  const h = $('#boardHalls');
  if (h) {
    const list = S.halls || [], self = S.hall && S.hall.fp;
    h.innerHTML = list.length ? list.map(x =>
      `<div class="hall-row ${x.fp === self ? 'self' : ''}" data-addr="${escapeHtml(x.addr || '')}">
        <i class="hdot"></i><span class="hname">${escapeHtml(x.name || '未命名棋馆')}</span>
        <span class="hmeta">${escapeHtml(x.addr || '地址未公布')} · ${x.scripts || 0} 本 · ${x.sessions7d || 0} 场</span></div>`).join('')
      : '<div class="hint">目录暂不可用，可手动填棋馆地址</div>';
    h.querySelectorAll('.hall-row').forEach(e => e.onclick = () => {
      if (e.dataset.addr) { connectTo(e.dataset.addr); closeModal(); }
    });
  }
}
function renderHallInfo() {
  const h = S.hall, n = $('#hallName'), t = $('#hallDirToggle'), u = $('#hallDirUrl');
  if (n && h) n.value = h.name || '';
  if (t) { t.textContent = S.hallOn ? '开' : '关'; t.classList.toggle('on', S.hallOn); }
  if (u) u.value = (S.hallUrl && S.hallUrl !== DEFAULT_HALL_DIR) ? S.hallUrl : '';
}
function connectTo(u) {
  const inp = $('#serverUrl'); if (inp) inp.value = u;
  S.net.setUrl(u); toast('正在连接 ' + u);
}

function openHallPicker(first) {
  const paint = () => {
    const list = S.halls || [];
    modal(first ? '第一步 · 选一个棋馆' : '选一个棋馆', `
      <div class="guide"><div class="guide-step"><b>连到一台房主棋馆</b>
        <p>每个房主的棋馆就是一个独立棋馆，自带自己的剧本与本机榜。目录默认开启，点下面一个就能连；目录挂了也不影响，手动填地址照样玩。不必题名也能开局；题名之后，战绩才写进可携走的加密存档。</p></div></div>
      <div class="side-h">诸馆 · 名录${S.hallOn ? '（已开启）' : '（已关闭）'}</div>
      <div class="board-list">${list.length ? list.map(x =>
        `<div class="hall-row" data-addr="${escapeHtml(x.addr || '')}"><i class="hdot"></i>
          <span class="hname">${escapeHtml(x.name || '未命名棋馆')}</span>
          <span class="hmeta">${escapeHtml(x.addr || '地址未公布')} · ${x.scripts || 0} 本</span></div>`).join('')
        : '<div class="hint">正在读取目录…若一直空白，直接手动填地址</div>'}</div>
      <div class="field"><label>或手动填棋馆地址</label>
        <input id="suInput" class="url-input" placeholder="192.168.1.8:5080" value="${escapeHtml(S.net.custom || '')}"></div>
      <div class="btn-row"><button class="btn primary" id="suOk">连馆</button>
        <button class="btn" id="suRefresh">重览名录</button>
        <button class="btn ghost" id="suGuide">入门小引</button></div>`, null);
    $$('#modalBody .hall-row').forEach(e => e.onclick = () => {
      if (e.dataset.addr) { connectTo(e.dataset.addr); closeModal(); }
    });
    $('#suOk').onclick = () => {
      const u = ($('#suInput').value || '').trim();
      if (!u) { toast('请先填地址或点一个棋馆'); return; }
      connectTo(u); closeModal();
    };
    $('#suRefresh').onclick = () => {
      if (S.net && S.conn === 'online') S.net.send({ t: 'hallPull' });
      else fetch(S.hallUrl || DEFAULT_HALL_DIR).then(r => r.json()).then(d => {
        const a = Array.isArray(d) ? d : (d.halls || []);
        if (a.length) { S.halls = a; paint(); }
      }).catch(() => toast('目录暂不可用，可手动填地址'));
      toast('正在重览名录');
    };
    $('#suGuide').onclick = () => { closeModal(); openGuide(); };
  };
  paint();

  if (!S.halls.length && S.hallOn) {
    fetch(S.hallUrl || DEFAULT_HALL_DIR).then(r => r.json()).then(d => {
      const a = Array.isArray(d) ? d : (d.halls || []);
      if (a.length && !$('#modal').hidden) { S.halls = a; paint(); }
    }).catch(() => {});
  }
}

function openScriptImport() {
  modal('现场导入剧本', `
    <div class="guide"><div class="guide-step"><b>只作用于本席</b>
      <p>粘贴一个剧本 JSON（含 <code>id / roles / acts</code>），或选 .json 文件。它不入棋馆卷帙、不落盘、他席不见，散席即失效。想长期用，把文件放进房主棋馆 <code>scripts/</code> 即可。</p></div></div>
    <div class="field"><label>剧本 JSON</label><textarea id="siText" rows="8" placeholder='{"id":"my-script","name":"我的本","roles":[...],"acts":[...]}'></textarea></div>
    <div class="btn-row"><button class="btn primary" id="siOk">导入到本房</button>
      <button class="btn" id="siFile">选文件</button>
      <input type="file" id="siFileInput" accept=".json" hidden></div>`, null);
  const send = (raw) => {
    if (!raw || !raw.trim()) { toast('还没有内容'); return; }
    S.net.send({ t: 'scriptImport', raw }); closeModal();
  };
  $('#siOk').onclick = () => send($('#siText').value);
  $('#siFile').onclick = () => $('#siFileInput').click();
  $('#siFileInput').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader(); rd.onload = () => send(String(rd.result)); rd.readAsText(f);
  };
}

function downloadRecord(m) {
  try {
    const data = { v: 1, game: m.game, variant: m.variant, room: m.room, start: m.start, frames: m.frames };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `yiju-棋谱-${m.game}-${m.room || 'local'}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('棋谱已导出');
  } catch (e) { toast('导出失败'); }
}

function bindExtraUI() {
  const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
  const profile = () => S.net.send({ t: 'profile',
    name: ($('#hallName') ? $('#hallName').value : '').trim(),
    url: ($('#hallDirUrl') ? $('#hallDirUrl').value : '').trim(), on: S.hallOn });
  on('#refreshBoards', 'click', () => { S.net.send({ t: 'board' }); S.net.send({ t: 'hallPull' }); });
  on('#openHalls', 'click', () => openHallPicker(false));
  on('#hallName', 'change', profile);
  on('#hallDirUrl', 'change', profile);
  on('#hallDirToggle', 'click', () => { S.hallOn = !S.hallOn; renderHallInfo(); profile(); toast(S.hallOn ? '棋馆目录已开启' : '棋馆目录已关闭'); });
  on('#botLevel', 'change', e => {
    S.botLevel = +e.target.value;
    if (S.meta && !S.meta.started) S.net.send({ t: 'act', a: 'setBotLevel', v: S.botLevel });
  });
  on('#openScriptImport', 'click', () => openScriptImport());
  on('#exportRecord', 'click', () => S.net.send({ t: 'act', a: 'export' }));
  on('#importRecord', 'click', () => $('#recordFile').click());
  on('#recordFile', 'change', e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const m = JSON.parse(rd.result);
        if (m.start && m.frames) { m.meta = m.meta || {}; playReplay(m); toast('棋谱已导入，正在回放'); }
        else toast('不是有效的奕局棋谱');
      } catch (x) { toast('棋谱解析失败'); }
    };
    rd.readAsText(f); e.target.value = '';
  });
  on('#drawClear', 'click', () => toast('笔迹由全房同步，重开一局即清空'));
  on('#acctRegister', 'click', () => openAccount('register'));
  on('#acctLogin', 'click', () => openAccount('login'));
  on('#acctExport', 'click', () => openAccount('export'));
  on('#acctImport', 'click', () => openAccount('import'));
  on('#acctLogout', 'click', () => { S.net.send({ t: 'accountLogout' }); toast('已离席（谱仍存）'); });
  renderAccount(); renderAccountCard();
}

function renderAccount() {
  const el = $('#accountState'); if (!el) return;
  const a = S.account;
  if (!a || !a.ok) { el.innerHTML = '<span class="bname">未题名</span><span class="bmeta">过客战绩仍记在本机榜</span>'; return; }
  const v = a.save || {};
  const rank = v.rank ? `<span class="rank-seal">${escapeHtml(v.rank)}</span>` : '';
  el.innerHTML = `<span class="brank">●</span><span class="bname">${escapeHtml(v.name || a.name || '题名')}</span>
    ${rank}<span class="bmeta">${v.wins || 0} 胜 / ${v.plays || 0} 局 · 密谱已缄</span>` + titleSeals(v);
  bindSeals(el);
}
function titleSeals(v) {
  const keys = Array.isArray(v.titleKeys) ? v.titleKeys : [];
  const names = Array.isArray(v.titles) ? v.titles : [];
  if (!names.length) return '<div class="seal-empty">尚无衔记 · 胜一局即得本局雅号</div>';
  const worn = v.wornKey || '';
  return '<div class="seal-row">' + names.map((n, i) =>
    `<button class="seal ${keys[i] === worn ? 'on' : ''}" data-title="${escapeHtml(keys[i] || '')}">${escapeHtml(n)}</button>`
  ).join('') + '</div>';
}
function bindSeals(root) {
  Array.from(root.querySelectorAll('.seal')).forEach(b => b.onclick = () => {
    S.net.send({ t: 'wearTitle', key: b.dataset.title || '' });
    tap();
  });
}
function renderAccountCard() {
  const body = $('#accountCardBody'), tag = $('#accountCardTag'); if (!body) return;
  const a = S.account, v = (a && a.save) || {};
  if (!a || !a.ok) {
    tag.textContent = '未题名';
    body.innerHTML = '题名之后，战绩自入密谱；换馆可持谱与口令相还。未题名时战绩仍记在下方本机榜。';
    return;
  }
  tag.textContent = '已入席';
  const games = v.games && typeof v.games === 'object' ? Object.keys(v.games).slice(0, 6) : [];
  const scripts = Array.isArray(v.scripts) ? v.scripts : [];
  const rp = v.rankPts || {}, rn = v.rankNames || {};
  const nums = Object.values(rp).map(Number).filter(n => !isNaN(n));
  const top = nums.length ? Math.max(...nums) : 0;
  const ri = rankInfo(top);
  const pct = ri.nextGate ? Math.min(100, Math.round((top - ri.gate) / (ri.nextGate - ri.gate) * 100)) : 100;
  const gamesRank = Object.keys(rn).sort((a, b) => (rn[b].pts || 0) - (rn[a].pts || 0)).slice(0, 8)
    .map(k => `<i>${escapeHtml(rn[k].name)}</i>${escapeHtml((S.games.find(x => x.id === k) || {}).name || k)} ${rn[k].pts} 墨分`).join(' · ');
  const seasonHtml = `<div class="rank-season">${escapeHtml(v.seasonName || S.seasonName || '本月')} · 排位赛<br>
      段位 <b>${escapeHtml(v.rank || ri.name)}</b> · 共 ${v.rankSum || 0} 墨分 · ${ri.next ? '距下段 ' + ri.next + ' 墨分' : '已至顶阶'}<br>
      上赛季 ${escapeHtml(v.lastSeason || '—')} · ${escapeHtml(v.lastRank || '初执')}
      <div class="rank-bar"><span style="width:${pct}%"></span></div></div>
      ${gamesRank ? '<div class="rank-games">各局段位 · ' + gamesRank + '</div>' : ''}`;
  body.innerHTML = seasonHtml + `<div class="account-metrics">
      <div><b>${v.plays || 0}</b><span>总局</span></div>
      <div><b>${v.wins || 0}</b><span>胜局</span></div>
      <div><b>${v.streak || 0}</b><span>连胜</span></div>
      <div><b>${scripts.length}</b><span>历本</span></div>
    </div>
    <div class="account-games">题名：${escapeHtml(v.name || a.name || '')} · 最近 ${escapeHtml(v.lastDay || '—')}
      ${games.length ? '<br>常玩：' + games.map(escapeHtml).join(' / ') : ''}
      ${scripts.length ? '<br>剧本：' + scripts.map(escapeHtml).join(' / ') : ''}</div>`;
}
function accountField(id, label, type, placeholder) {
  return `<div class="field"><label>${label}</label><input id="${id}" class="url-input" type="${type}"
    placeholder="${escapeHtml(placeholder)}" autocomplete="off"></div>`;
}
function openAccount(mode) {
  const T = { register: '题名于本馆', login: '入席取谱', export: '携加密之谱', import: '还加密之谱' };
  let html = `<div class="guide"><div class="guide-step"><b>${T[mode]}</b><p>`;
  if (mode === 'register') html += '题名只存本馆。题名即自动立一份密谱，此后每局终自更新。口令不落明文。';
  else if (mode === 'login') html += '输口令取回本馆之谱。断线自续，不必每回入席。';
  else if (mode === 'export') html += '携谱以口令再加一层缄封，含随机盐与完整性校验。请连同口令一并收好。';
  else html += '选 .yijusave 或粘贴谱文，再输当时口令。口令不合或谱被改，皆不受。';
  html += '</p></div></div>';
  if (mode === 'register') html += accountField('acName', '账号名（2–16 字）', 'text', '例：阿奕') +
    accountField('acPass', '口令（6–64 字）', 'password', '设一个记得住的') +
    accountField('acPass2', '再输一次口令', 'password', '确认');
  if (mode === 'login') html += accountField('acName', '雅号', 'text', '题名时所用') +
    accountField('acPass', '口令', 'password', '口令');
  if (mode === 'export') html += accountField('acPass', '再输一次口令（核验）', 'password', '口令');
  if (mode === 'import') html += accountField('acName', '在这台棋馆的新账号名', 'text', '例：阿奕') +
    accountField('acPass', '谱口令', 'password', '携谱时所用') +
    `<div class="field"><label>存档文件 / 文本</label><textarea id="acData" class="save-text" rows="4"
      placeholder="点「选文件」后自动填入，或直接粘贴 .yijusave 内容"></textarea></div>
     <div class="btn-row"><button class="btn ghost small" id="acPick">选文件</button>
       <input type="file" id="acFile" accept=".yijusave,.txt,.json" hidden></div>`;
  const okLabel = { register: '题名立谱', login: '入席', export: '生成谱卷', import: '核验还谱' }[mode];
  html += `<div class="btn-row"><button class="btn primary" id="acOk">${okLabel}</button>
    <button class="btn" id="acCancel">取消</button></div>`;
  modal(T[mode], html, null);
  $('#acCancel').onclick = closeModal;
  if ($('#acFile')) {
    $('#acPick').onclick = () => $('#acFile').click();
    $('#acFile').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const t = String(rd.result || '').trim();
        const ta = $('#acData'); if (ta) ta.value = t;
        S.saveData = t; toast('谱已读入，输口令后点核验');
      };
      rd.readAsText(f);
    };
  }
  $('#acOk').onclick = () => {
    const name = ($('#acName') && $('#acName').value || '').trim();
    const pass = ($('#acPass') && $('#acPass').value) || '';
    if (mode === 'register') {
      if (pass !== (($('#acPass2') && $('#acPass2').value) || '')) { toast('两番口令不合'); return; }
      S.net.send({ t: 'accountRegister', name, password: pass });
    } else if (mode === 'login') S.net.send({ t: 'accountLogin', name, password: pass });
    else if (mode === 'export') S.net.send({ t: 'accountExport', password: pass });
    else {
      const data = (($('#acData') && $('#acData').value) || S.saveData || '').trim();
      if (!data) { toast('先选存档文件或粘贴内容'); return; }
      S.net.send({ t: 'accountImport', name, password: pass, data });
    }
    closeModal();
  };
}
function downloadSave(data, name) {
  try {
    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = name || 'yiju-存档.yijusave';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('密谱已携出，口令请自收好');
  } catch (e) { toast('导出失败'); }
}
