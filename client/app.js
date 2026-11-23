import { HybridNet, LOCAL_MAIN } from './local-net.js';
import { Cultivation } from './cultivation.js';
import { Sound } from './audio.js';
import * as R from './render.js';
import { Fx } from './fx.js';
import { Settings, GROUPS, DEFAULTS } from './settings.js';
import { applyWear, WEAR_LIST, WEAR_KINDS, WEAR_RARITY, WEAR_SETS } from './wear.js';

const $ = (s) => document.querySelector(s);
function tap() { if (Settings.get('haptic') && navigator.vibrate) navigator.vibrate(8); }
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
  rankCatalog: [], season: '', seasonName: '', seasonSpan: '', seasonVerified: false, seasonSource: '', seasonNote: '', rankPending: '', rankBefore: null, shop: null, scriptDraft: null 
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
const S1_START = Date.UTC(2026, 10, 22) - 8 * 3600e3;
const S2_START = Date.UTC(2027, 0, 1) - 8 * 3600e3;
function seasonKey(ms) {
  const t = (ms == null ? Date.now() : ms) + 8 * 3600e3;
  if (t < S1_START) return 'S1';
  if (t < S2_START) return 'S1';
  const day = Math.floor((t - S2_START) / 86400e3);
  return 'S' + (Math.floor(day / 30) + 2);
}
const TIME_SOURCES = [
  { url:'https://worldtimeapi.org/api/timezone/Etc/UTC', pick:j => j.utc_datetime },
  { url:'https://timeapi.io/api/Time/current/zone?timeZone=Etc/UTC', pick:j => j.dateTime },
  { url:'https://www.qq.com/', head:true }
];
let seasonProofAt = 0;
async function probeUtc(src) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 3200);
  try {
    const r = await fetch(src.url + (src.url.indexOf('?') < 0 ? '?_=' : '&_=') + Date.now(),
      { cache:'no-store', signal:ctl.signal });
    if (src.head) { const d = r.headers.get('date'); return d ? new Date(d).toUTCString() : null; }
    const j = await r.json(); const v = src.pick(j);
    return v ? new Date(v.length === 24 ? v + 'Z' : v).toUTCString() : null;
  } catch (e) { return null; } finally { clearTimeout(timer); }
}
async function seasonSelfCheck(quiet) {
  if (S.net && S.net.mode !== 'real') {
    const el0 = $('#seasonState'); if (el0) el0.textContent = '未校天时 · 依本席更漏';
    return;   // 纯本地自弈不联网，段位照常记，仅标未校
  }
  const custom = (store('qipai.timeUrl', '') || '').trim();
  const list = custom ? [{ url:custom, pick:j => j.utc_datetime || j.dateTime || j.time }, ...TIME_SOURCES] : TIME_SOURCES;
  const got = (await Promise.all(list.map(probeUtc))).filter(Boolean);
  seasonProofAt = Date.now();
  const el = $('#seasonState'); if (el) el.textContent = got.length >= 2 ? '天时已校 · 待席上确认' : '未连天时 · 依本席更漏';
  if (S.net) S.net.send(got.length >= 2
    ? { t:'season', mode:'net', ts:Date.parse(got[0]), key:seasonKey(Date.parse(got[0])), proof:got }
    : { t:'season', mode:'local', ts:Date.now(), key:seasonKey(), proof:[] });
  if (!quiet && got.length < 2) toast('未连天时 · 段位照常记，仅标未校');
}
function rankApplyLocal(game, win, draw, botLvl) {
  if (!S.account || !S.account.ok) { toast('自修排位需先题名 · 段位记于加密存档'); return { delta:0, info:rankInfo(0) }; }
  S.rankBefore = (S.account.save && S.account.save.rankSum) || 0;
  S.net.send({ t:'accountState' });
  return { delta:0, info:rankInfo(0) };
}
function rankBadgeHtml(id) {
  const rk = rankNameOf(id);
  return rk && rk !== '初执' ? `<i class="game-rank">${escapeHtml(rk)}</i>` : '';
}
function rankNameOf(game) {
  const v = (S.account && S.account.save) || {};
  if (v.rankNames && v.rankNames[game] && v.rankNames[game].name) return v.rankNames[game].name;
  return rankInfo(0).name;
}
function rankIdxOf(game) {
  const v = (S.account && S.account.save) || {};
  if (v.rankNames && v.rankNames[game]) return v.rankNames[game].idx || 0;
  return 0;
}

function boot() {
  const offline = () => {
    const o = window.__YJ_OFFLINE__;
    if (!o || !o.games) return false;
    S.games = o.games; S.cats = o.categories || [];
    S.themes = { themes: o.themes || [], sliders: o.sliders || [] };
    S.offlineAssets = true;
    return true;
  };
  Promise.all([
    fetch('./rules/manifest.json').then(r => r.ok ? r.json() : Promise.reject()),
    fetch('./themes/themes.json').then(r => r.ok ? r.json() : Promise.reject())
  ]).then(([m, t]) => {
    S.manifest = m; S.themes = t; S.games = m.games || []; S.cats = m.categories || [];
  }).catch(() => Promise.all([
    fetch('/rules/manifest.json').then(r => r.json()),
    fetch('/themes/themes.json').then(r => r.json())
  ]).then(([m, t]) => {
    S.manifest = m; S.themes = t; S.games = m.games || []; S.cats = m.categories || [];
  }).catch(() => { if (!offline()) toast('玩法册未至，请检视卷帙'); })
  ).then(() => {
    if (!S.games.length) offline();
    Settings.apply();
    try { applyWear(store('qipai.worn', {})); } catch (e) {}
    applyTheme(S.themeId);
    renderThemeGrid(); renderSliders(); renderCats(); renderGames(); renderRooms(); renderQuick();
    renderSettings(); renderShop(); renderNotice();
    installSendGate(); installLifecycle(); applyAccessibility();
    updateToday(); updateStats();
    bindUI(); bindExtraUI();
    const su = Settings.get('serverUrl');
    if (su && !lsGet('qipai.url')) lsSet('qipai.url', su);
    S.net = new HybridNet(onFrame, onStatus);
    S.net.local.setCatalog(S.games);
    S.net.connect();
    Cultivation.mount();
    // v5：开机不再自动弹「入门小引」或离线 toast——旧版它们会在入局后
    // 半透明盖住横屏大厅，也是「提示被遮挡 / 点不了」的来源。
    // 小引改由大厅右列「引」手动打开；离线说明写进登录页提示条与大厅题记，且均可关闭。
    window.addEventListener('resize', debounce(() => renderPlay(), 120));
    window.addEventListener('orientationchange', () => setTimeout(() => renderPlay(), 220));
  });
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
  if (typeof applyWorn === 'function') applyWorn();
  const mv = (S.sliders && typeof S.sliders.motion === 'number') ? S.sliders.motion : 55;
  document.documentElement.style.setProperty('--fx', String(mv / 100));
  document.body.classList.toggle('fx-off', mv <= 0 || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
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
  const match = g => (S.cat === 'all' || g.cat === S.cat) &&
    (!q || (g.name + g.tag + g.desc + g.id).toLowerCase().includes(q));
  const main = S.games.filter(g => LOCAL_MAIN.indexOf(g.id) >= 0 && match(g));
  const rest = S.games.filter(g => LOCAL_MAIN.indexOf(g.id) < 0 && match(g));
  const expanded = !!S.showAll || !!q || S.cat !== 'all';
  const cards = (arr, off) => arr.map((g, i) =>
    `<div class="game-card ${g.id === S.curGame ? 'sel' : ''}" data-game="${g.id}">
      <span class="no">${String(off + i + 1).padStart(2,'0')}</span><span class="seats">${g.min}–${g.max}人</span>
      ${rankBadgeHtml(g.id)}<h3>${g.name}</h3><p>${g.desc}</p><div class="tag">${g.tag}</div></div>`).join('');
  let html = '<div class="side-h">主推 · 8 局对弈</div>' + (cards(main, 0) || '<div class="hint">没有匹配的对弈</div>');
  if (expanded) {
    html += '<div class="side-h" style="margin-top:18px">更多对弈 · ' + rest.length + ' 局</div>' + cards(rest, main.length);
    if (!q && S.cat === 'all') html += '<button class="btn ghost" id="lessGames">收起更多对弈</button>';
  } else if (rest.length) {
    html += '<button class="btn ghost" id="moreGames">更多对弈 · ' + rest.length + ' 局 ▾</button>';
  }
  el.innerHTML = html;
  const more = $('#moreGames'), less = $('#lessGames');
  if (more) more.onclick = () => { S.showAll = true; renderGames(); tap(); };
  if (less) less.onclick = () => { S.showAll = false; renderGames(); tap(); };
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

setInterval(() => { if (S.conn === 'online' && Date.now() - seasonProofAt > 30 * 60e3) seasonSelfCheck(true); }, 60e3);
window.addEventListener('online', () => { if (S.conn === 'online') seasonSelfCheck(true); });
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
      if (m.season) { S.season = m.season; S.seasonName = m.seasonName || '';
        S.seasonSpan = m.seasonSpan || ''; S.seasonVerified = m.seasonVerified !== false;
        S.seasonSource = m.seasonSource || ''; }
      renderAccount(); renderAccountCard(); renderGames(); renderSeasonState();
      seasonSelfCheck(true);
      S.net.send({ t:'halls' }); S.net.send({ t:'scripts' }); S.net.send({ t:'rooms' }); S.net.send({ t:'shop' }); S.net.send({ t:'godInfo' });
      break;
    case 'godInfo':
      S.godInfo = { best: m.best || 0, title: m.title || '', ranks: m.ranks || {} };
      renderGodPanel(); break;
    case 'shopState':
      S.shop = { items: m.items || [], yizhu: m.yizhu || 0, owned: m.owned || [], worn: m.worn || {} };
      save('qipai.worn', S.shop.worn); S.shopTry = null;
      renderShop(); applyWorn(); renderAccountCard();
      if (m.note) toast(m.note);
      break;
    case 'season':
      S.season = m.key || S.season; S.seasonName = m.name || S.seasonName;
      S.seasonSpan = m.span || ''; S.seasonVerified = !!m.verified; S.seasonSource = m.source || '';
      renderSeasonState(); renderAccountCard();
      if (m.note && m.note !== S.seasonNote) { S.seasonNote = m.note; if (m.ok) toast(m.note); }
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
      if (m.save && m.save.id) {
        const before = S.rankBefore == null ? (m.save.rankSum || 0) : S.rankBefore;
        const after = m.save.rankSum || 0;
        S.account = { ok:true, id:m.save.id, name:m.name || m.save.name, save:m.save };
        renderAccount(); renderAccountCard();
        if (S.rankPending) { const d = after - before;
          toast(S.rankPending + ' · ' + (d >= 0 ? '+' : '') + d + ' 墨分 · 现为' + (m.save.rank || rankInfo(after).name));
          S.rankPending = ''; S.rankBefore = null; }
      }
      if (m.note) toast(m.note);
      break;
    case 'save': downloadSave(m.data, m.name); break;
    case 'rooms': S.rooms = m.list || []; renderRooms(); break;
    case 'joined':
      lsSet('qipai.room', m.room);
      $('#lastRoomLine').textContent = `上回雅集：${m.room} · 第 ${m.seat >= 0 ? m.seat : '旁观'} 席`;
      const mb = $('#matchBar'); if (mb) mb.hidden = true;
      go('play'); toast(m.matched ? '寻局得人' + (m.pool ? ' · ' + m.pool : '') + '，开枰' : (m.spectating ? '入席旁观' : `赴局 ${m.room}`));
      if (Settings.get('autoReady') && !m.spectating && S.net) S.net.send({ t:'act', a:'ready' });
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
    case 'matchState': renderMatchState(m); break;
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
  Cultivation.onEnd(win);
  S.history.unshift({ t: Date.now(), game: v.game, result: v.result, win });
  S.history = S.history.slice(0, 40); save('qipai.history', S.history);
  win ? Sound.win() : Sound.lose();
  let endMsg = v.result || '此局已终';
  const rm = S.meta && S.meta.rankMode;
  if (rm === 'local') {
    S.rankBefore = (S.account && S.account.save && S.account.save.rankSum) || 0;
    S.rankPending = '自修排位';
    S.net.send({ t: 'accountState' });
    renderGames();
  } else if (rm === 'hall') {
    S.rankBefore = (S.account && S.account.save && S.account.save.rankSum) || 0;
    S.rankPending = '馆赛排位';
    S.net.send({ t: 'accountState' });
  }
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
    'juben', 'avalon', 'turtlesoup', 'mastermind', 'drawguess', 'tournament',
    'yijuan'].includes(v.game);
  return simultaneous ? (v.legal || []).length > 0 : v.turn === S.you;
}
function renderPlayNow() {
  const v = S.view;
  const drawV = S.predict || v;
  if (!v) {
    const t = $('#matchTitle'); if (t) t.textContent = '尚未入席';
    syncScriptTheme(); Sound.ambience(null, false);
    const st = $('#stageShow'); if (st) st.hidden = true;
    S._fxPrev = null; Fx.reset();
    return;
  }
  const g = S.games.find(x => x.id === v.game);
  const title = S.meta && S.meta.title;
  $('#matchTitle').textContent = (title ? title + ' · ' : '') + (g ? g.name : '对局') + (v.variant ? ' · ' + v.variant : '');
  $('#matchMeta').textContent = `${(S.meta && S.meta.id) || v.room || ''} · ${v.phaseName} · 第 ${v.moveNo} 手` +
    (S.meta && S.meta.bots ? ` · 隐士 ${S.meta.bots} 位` : '') +
    (S.meta && S.meta.god ? ` · 神域 · ${S.meta.godName || '青冥'}` : '');
  const sig = [v.seq, v.phase, v.moveNo, v.ended, S.you, S.chat.length,
    (S.chat[S.chat.length - 1] || {}).text || '', (S.presence || []).map(p => p && p.name).join(','),
    ((v.hands && v.hands[S.you]) || []).join(','), (v.cells || []).length, v.last || '',
    S.selected.size, S.selFrom, S.meta && S.meta.seq, S.meta && S.meta.bots].join('|');
  if (sig === S._lastSig && !S.predict && !S._forceRender) return;
  S._lastSig = sig; S._forceRender = false;
  if (v.ended && !S._autoSaved && Settings.get('autoReplaySave')) {
    S._autoSaved = true;
    save('qipai.lastReplay', { game: v.game, variant: v.variant, seq: v.seq, moveNo: v.moveNo, at: Date.now() });
  }
  if (!v.ended) S._autoSaved = false;
  const canvas = $('#board');
  if (S._fxPrev) Fx.observe(S._fxPrev, drawV, canvas); else Fx.reset();
  S._fxPrev = drawV ? { seq:drawV.seq, moveNo:drawV.moveNo, phase:drawV.phase, ended:drawV.ended,
    winner:drawV.winner, cells:drawV.cells, hands:drawV.hands, w:drawV.w, h:drawV.h } : null;
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
  const hintsOn = Settings.get('showHints');
  hint.textContent = v.ended ? '此局已终 · 可覆局或再开一枰' : (S.you < 0 ? '旁观中 · 可观不可落' :
    (canAct(v) ? (hintsOn ? `轮到你 · ${n} 个可点位置` : '轮到你') : waitText)) +
    (S.selected.size ? ` · 已选 ${S.selected.size} 张` : '') + (S.selFrom != null ? ' · 再点目标格' : '');
}
function renderSeats() {
  const el = $('#seatList'); if (!el) return;
  el.innerHTML = (S.presence || []).map((p, i) =>
    `<div class="seat ${p.online ? 'on' : ''} ${S.view && S.view.turn === i ? 'turn' : ''}">
      <b>${String(i).padStart(2,'0')}</b><i class="dot"></i><span>${p.empty ? (p.sealed ? '已封盘' : '虚席') : p.name || '访客'}</span>
      <small>${p.bot ? '隐士陪玩' : p.empty ? (p.sealed ? '已封盘' : '虚席') : p.ready ? '已整襟' : p.online ? '在席' : '离席'}${
        (Settings.get('showFoeCount') && S.view && S.view.hands && S.view.hands[i] && i !== S.you) ? ' · 余 ' + S.view.hands[i].length : ''}</small></div>`).join('');
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
    !/^(c|r|f|x|m|o|d|p|solve|vote|night|poison):/.test(c) &&
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
  if (c.startsWith('r:')) return '拾简 · 第 ' + (+c.slice(2) + 1) + ' 张';

  return c.replace(/^([a-z]+):(.*)$/, (_, a, b) => a + ' · ' + (b || '确认'));
}

function handleCell(i) {
  if (Settings.get('longPressConfirm')) {
    const c = $('#board');
    if (c && c.dataset.longPressArmed !== '1') { toast('长按片刻再落子'); return; }
    if (c) delete c.dataset.longPressArmed;
  }
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
  if ((code === 'resign' || code === 'undo') && Settings.get(code === 'resign' ? 'confirmResign' : 'confirmUndo')) {
    askDanger(code === 'resign' ? '投子认负？' : '乞复一着？', () => sendCodeRaw(code));
    return;
  }
  if (S.view && S.view.ended) { toast('对局已结束'); return; }
  sendCodeRaw(code);
}
function sendCodeRaw(code) {
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
  if (typeof renderGodPanel === 'function') renderGodPanel();
  if (name === 'stats') { updateStats(); renderAccountCard(); if (S.net) { S.net.send({ t:'board' }); S.net.send({ t:'halls' }); S.net.send({ t:'accountState' }); } }
  if (name === 'today') updateToday();
  if (window.YJ_SHELL && window.YJ_SHELL.onGo) window.YJ_SHELL.onGo(name);
}

function modal(title, html, onOk) {
  const el = $('#modal');
  $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html;
  el.style.removeProperty('display');
  el.hidden = false;
  $('#modalClose').onclick = closeModal;
  const ok = $('#modalOk'); if (ok && onOk) ok.onclick = () => { onOk(); closeModal(); };
}
function closeModal() { $('#modal').hidden = true; }
let toastTimer;
function toast(text) {
  const el = $('#toast'); if (!el || !text) return;
  // 注册 / 登录页还没入局：浮条会盖住表单标签，一律留到大厅再弹
  if (document.querySelector('#register:not([hidden]), #login:not([hidden])')) return;
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
        <p>折狱录跟幕卡走：旁白逐句浮现、线索翻牌、轮流打字发言、终幕指认；私本只你自己看得见。弈卷则两席同时覆简，启简后界墨按年序与游方推移，弃简区可推对方余牌，余墨够还能拾简复出。</p></div>
      <div class="guide-step"><b>肆 · 横竖与外观</b>
        <p>竖屏：盘在上、牌在下、底部「〇—肆」为引；横屏：左盘右席，导航收作侧边细条。「肆 · 案牍」可换十品纸色；折狱开卷自依本中设色，散场复归君选。落子发牌有轻动画，系统开了减动效便自动收敛。</p></div>
      <div class="guide-step"><b>伍 · 存档 / 段位 / 剧本 / 源码</b>
        <p>不题名照样玩，战绩记本机榜；题名后自动建一份加密存档，每局终了自动写回，可导出 <code>.yijusave</code> 携往别馆，导入须再验口令。</p>
        <p>段位七阶按赛季重置：第一赛季自 2026 年 11 月 22 日至 12 月 31 日，其后自 2027 年 1 月 1 日起每三十日一季。赛季由手机端联网校时、棋馆依凭据判定，改本机更漏或改存档都动不了段位；换季归档上季最高段位并承袭一部分墨分。馆赛所得折半计入，自修全额，隐士十阶随段位增强。纯局域网无外网时照常记段位，只标「未校天时」，体验不缺。「叁 · 战绩」有本机榜与棋馆目录。剧本只在房主本地 <code>scripts/</code>，丢一个新 JSON 即更新，亦可当场呈本。</p>
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
      <p>填房主棋馆给出的任意地址即可：局域网地址、域名、新式网址、带路径地址、本机回环都认，不绑定任何固定地址，也不限定是哪一台。</p>
      <p><b>端口写不写都行</b>：不写自动补「案牍 · 设置 → 缺省端口」（默认 5080，可改）；写了就按你写的端口连。</p>
      <p>填好后本页自动重连，状态灯变「已联机」即可开局。留空则试同源。</p>
    </div></div>
    <div class="field"><label>棋馆地址</label>
      <input id="suInput" class="url-input" placeholder="任意地址 · 内网 / 域名 / 新式网址 · 端口可省" value="${escapeHtml(S.net.custom || '')}"></div>
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
  const PREF = {
    botLevel: () => String(Settings.get('defaultBot')),
    clock: () => Number(Settings.get('defaultClock')) * 1000,
    timeout: () => Settings.get('defaultTimeout'),
    spectatorChat: () => Settings.get('spectatorChat')
  };
  if (PREF[o.key]) o = Object.assign({}, o, { def: PREF[o.key]() });
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
    <div class="field"><label>对弈变体</label><select id="mkVariant">${variants}</select></div>
    <div class="field"><label>房间名（可留空）</label><input id="mkTitle" maxlength="24" placeholder="例：周末手谈 · 来者不拒"></div>
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
    if (S.net && S.net.mode !== 'real') { toast('未连接棋馆 · 本机自弈请点「寻局」'); return; }
    const variant = $('#mkVariant').value;
    S.curVariant = variant; renderVariants();
    const opts = collectOpts();
    if (opts.rankMode === 'local' && !opts.botByRank) {
      const ladder = [0, 1, 2, 3, 5, 7, 9];
      opts.botLevel = ladder[Math.max(0, Math.min(6, rankIdxOf(S.curGame)))];
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
  $('#mkMatch').onclick = () => { startMatch($('#mkVariant').value); closeModal(); };
  $('#mkWatch').onclick = () => { closeModal(); go('rooms'); $('#roomCode').focus(); };
  if ($('#mkImport')) $('#mkImport').onclick = () => openScriptImport();
}
function joinRoom(password) {
  if (S.net && S.net.mode !== 'real') { toast('局域网内未找到其他玩家，请确认棋馆已启动'); return; }
  const code = ($('#roomCode').value || '').trim().toUpperCase();
  if (!code) { toast('请填房间号'); return; }
  S.net.send(password ? { t:'join', room:code, password } : { t:'join', room:code });
}

function recent(n) {
  const out = new Array(n).fill(0);
  S.history.slice(0, n).reverse().forEach((h, i) => out[i] = h.win ? 1 : 0);
  return out;
}
function setTodayLine(text) {
  const el = $('#todayLine'); if (!el) return;
  if (text) { el.textContent = text; return; }
  const d = new Date(), s = S.stats || { plays: 0, wins: 0 };
  const day = (d.getMonth() + 1) + '月' + d.getDate() + '日';
  el.textContent = !s.plays
    ? day + ' · 卷上尚无落子。先与隐士手谈一局，题记自会记下第一笔。'
    : day + ' · 已对 ' + s.plays + ' 局，胜 ' + s.wins + ' 局。' +
      (s.wins >= s.plays / 2 ? '棋路渐稳，宜复盘一局。' : '胜负兵家常事，再开一枰。');
}
function updateToday() {
  $('#gameCount').textContent = S.games.length;
  setTodayLine();
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
  $('#quickMatch').onclick = () => startMatch();
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

function yjLabel(c, names) {
  if (!c || c.length < 6) return '空简';
  const y = +c[1], f = +c[3];
  const nm = names && names[(y - 1) * 4 + f] ? '「' + names[(y - 1) * 4 + f] + '」 · ' : '';
  return nm + y + ' 序 · ' + (['东', '西', '南', '北'][f] || '？') + ' · ' + c[5] + ' 墨';
}
function renderExtraActions() {
  const el = $('#extraActions'); if (!el) return;
  const v = S.view;
  const ok = !!(v && ['nim', 'endgame', 'junqi4', 'yijuan'].includes(v.game) && !v.ended);
  el.hidden = !ok;
  if (!ok) { el.innerHTML = ''; return; }
  if (v.game === 'yijuan') {
    const info = v.info || {}, legal = v.legal || [], hand = v.hand || [], rn = info.roleNames || null;
    const covered = info.covered || [0, 0], you = S.you;
    const ink = info.ink || [0, 0], pick = info.pick || [0, 0];
    const myDisc = info.myDiscard || [], oppDisc = info.oppDiscard || [];
    const n = +(info.lineN || 9);
    let h = `<div class="side-h">覆简 · 第 ${(+(info.round || 0) + 1)} 巡 · 界墨 ${info.line}/${n - 1}</div>`;
    h += `<div class="hint">年序大者推界墨，游方相冲再推；相承各得一墨，同简归中。余墨 ${ink[you] || 0} · 可拾 ${pick[you] || 0}</div>`;
    if (info.lastA && info.lastB)
      h += `<div class="hint">上巡 · 甲 ${yjLabel(info.lastA)} / 乙 ${yjLabel(info.lastB)} · ${escapeHtml(info.lastNote || '')}</div>`;
    if (you < 0) h += '<div class="hint">观卷中 · 双卷夹一线，墨偏谁，谁势危</div>';
    else if (covered[you]) h += '<div class="hint">此席已覆 · 静待另一席启简</div>';
    else {
      h += '<div class="side-h" style="margin-top:10px">覆简 · 择一简</div><div class="variant-row">' +
        hand.map((c, i) => {
          const code = 'c:' + i, on = legal.includes(code);
          return `<button class="variant" data-ac="${code}" ${on ? '' : 'disabled'}>${escapeHtml(yjLabel(c, rn))}</button>`;
        }).join('') + '</div>';
      const rlegal = legal.filter(x => x.startsWith('r:'));
      if (rlegal.length)
        h += '<div class="side-h" style="margin-top:10px">拾简 · 花余墨复出一简</div><div class="variant-row">' +
          myDisc.map((c, i) => {
            const code = 'r:' + i, on = legal.includes(code);
            return `<button class="variant" data-ac="${code}" ${on ? '' : 'disabled'}>${escapeHtml(yjLabel(c, rn))}</button>`;
          }).join('') + '</div>';
    }
    h += `<div class="hint" style="margin-top:10px">己弃简 ${myDisc.length} 张 · 彼弃简 ${oppDisc.length} 张（公开）</div>`;
    el.innerHTML = h;
    $$('#extraActions [data-ac]').forEach(b => b.onclick = () => sendCode(b.dataset.ac));
    return;
  }
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
        <input id="suInput" class="url-input" placeholder="任意地址 · 内网 / 域名 / 新式网址 · 端口可省" value="${escapeHtml(S.net.custom || '')}"></div>
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

function makerBlank() {
  return {
    id: 'my-script-' + Date.now().toString(36), name: '新本', version: 1,
    min: 4, max: 7, minutes: 45, tags: '还原', theme: 'yemo',
    synopsis: '一句题眼，写在这里。', culprit: 'r1',
    roles: [
      { id:'r1', public:'管家', private:'你知道书房的锁换过。', secret:'那封信是你寄的。', goal:'别让人知道信是你写的。', botLines:'雨大，先别上楼。|书房还是别去了。' },
      { id:'r2', public:'医生', private:'你来得最早。', secret:'你看见过第七只杯子。', goal:'找出第七个人。', botLines:'' }
    ],
    clues: [
      { id:'c1', title:'门厅的伞', text:'六把伞，其中一把是干的。' },
      { id:'c2', title:'旧钥匙', text:'齿口和新锁对不上。' }
    ],
    acts: [
      { title:'第一幕 · 门铃', narration:'雨从傍晚就没停过。\n六个人在门厅站定，谁也没先开口。', public:'c1', priv:'r1:c2', discuss:240 },
      { title:'第二幕 · 书房', narration:'锁是新的。\n桌上摆着七只杯子。', public:'c2', priv:'', discuss:300 }
    ],
    endings: [
      { when:'vote:r1', title:'真相', text:'信是管家寄的。' },
      { when:'else', title:'雨没停', text:'众人各自散去。' }
    ]
  };
}
function makerCollect() {
  const d = S.scriptDraft, q = id => document.getElementById(id);
  const val = (id, def) => { const e = q(id); return e ? e.value : def; };
  d.id = val('mkId', d.id); d.name = val('mkName', d.name);
  d.min = +val('mkMin', d.min); d.max = +val('mkMax', d.max);
  d.minutes = +val('mkMinutes', d.minutes); d.tags = val('mkTags', d.tags);
  d.theme = val('mkTheme', d.theme); d.synopsis = val('mkSynopsis', d.synopsis);
  d.culprit = val('mkCulprit', d.culprit);
  const rows = sel => Array.from(document.querySelectorAll(sel));
  d.roles = rows('.mk-role').map(e => ({
    id: e.querySelector('.f-id').value, public: e.querySelector('.f-pub').value,
    private: e.querySelector('.f-pri').value, secret: e.querySelector('.f-sec').value,
    goal: e.querySelector('.f-goal').value, botLines: e.querySelector('.f-bot').value
  }));
  d.clues = rows('.mk-clue').map(e => ({
    id: e.querySelector('.f-id').value, title: e.querySelector('.f-title').value,
    text: e.querySelector('.f-text').value
  }));
  d.acts = rows('.mk-act').map(e => ({
    title: e.querySelector('.f-title').value, narration: e.querySelector('.f-narr').value,
    public: e.querySelector('.f-pubc').value, priv: e.querySelector('.f-priv').value,
    discuss: +e.querySelector('.f-disc').value
  }));
  d.endings = rows('.mk-end').map(e => ({
    when: e.querySelector('.f-when').value, title: e.querySelector('.f-title').value,
    text: e.querySelector('.f-text').value
  }));
}
function makerJson() {
  const d = S.scriptDraft;
  const clues = {}; (d.clues || []).forEach(c => { if (c.id) clues[c.id] = { title:c.title || c.id, text:c.text || '' }; });
  const roles = (d.roles || []).map(r => ({
    id:r.id, public:r.public, private:r.private, secret:r.secret, goal:r.goal,
    botLines:(r.botLines || '').split('|').map(x => x.trim()).filter(Boolean)
  }));
  const acts = (d.acts || []).map((a, i) => {
    const priv = {};
    (a.priv || '').split(',').forEach(p => {
      const kv = p.split(':'); if (kv.length === 2 && kv[0] && kv[1]) {
        if (!priv[kv[0]]) priv[kv[0]] = []; priv[kv[0]].push(kv[1]);
      }
    });
    return { no:i+1, title:a.title || '第 ' + (i+1) + ' 幕',
      narration:(a.narration || '').split('\n').map(x => x.trim()).filter(Boolean),
      revealDelay:900, publicClues:(a.public || '').split(',').map(x => x.trim()).filter(Boolean),
      privateClues:priv, discussMs:(a.discuss || 240) * 1000, cue:'' };
  });
  const endings = (d.endings || []).map(e => ({ when:e.when, title:e.title, text:e.text }));
  return { id:d.id, name:d.name, version:1, min:d.min, max:d.max, minutes:d.minutes,
    tags:(d.tags || '').split(',').map(x => x.trim()).filter(Boolean), theme:d.theme,
    synopsis:d.synopsis, culprit:d.culprit, roles, acts, clues, endings,
    ambience:{ drone:'rain', ink:0.7, paper:0.5, cueVolume:0.6 } };
}
function makerCheck(quiet) {
  makerCollect(); const j = makerJson(), e = [];
  if (!j.id) e.push('剧本编号未填');
  if (!j.roles.length) e.push('至少一位人物');
  if (!j.acts.length) e.push('至少一幕');
  j.roles.forEach((r, i) => { if (!r.id) e.push('第 ' + (i+1) + ' 位人物缺编号'); });
  const ids = Object.keys(j.clues);
  j.acts.forEach((a, i) => a.publicClues.forEach(c => { if (ids.indexOf(c) < 0) e.push('第 ' + (i+1) + ' 幕引用了不存在的线索「' + c + '」'); }));
  j.acts.forEach((a, i) => Object.keys(a.privateClues).forEach(r => {
    if (!j.roles.some(x => x.id === r)) e.push('第 ' + (i+1) + ' 幕私秘线索的角色「' + r + '」不存在');
    a.privateClues[r].forEach(c => { if (ids.indexOf(c) < 0) e.push('第 ' + (i+1) + ' 幕私秘线索「' + c + '」不存在'); });
  }));
  if (!j.endings.length) e.push('至少一个结局');
  if (!quiet) toast(e.length ? '验本未过：' + e[0] : '验本已过 · 可下载或呈本');
  return e;
}
function makerBody() {
  const d = S.scriptDraft;
  const esc = escapeHtml;
  let h = '<div class="guide"><div class="guide-step"><b>制本 · 只在本机编辑</b><p>编好可「下载」放进房主 <code>scripts/</code> 长期用，或「呈本」只作用于本席；草稿存本机，散席不丢。</p></div></div>';
  h += '<div class="maker-row"><input id="mkId" class="mini" style="flex:2" value="' + esc(d.id) + '" placeholder="编号"><input id="mkName" value="' + esc(d.name) + '" placeholder="剧名"><input id="mkTheme" class="mini" value="' + esc(d.theme) + '" placeholder="纸色"></div>';
  h += '<div class="maker-row"><input id="mkMin" class="mini" type="number" value="' + d.min + '" placeholder="最少"><input id="mkMax" class="mini" type="number" value="' + d.max + '" placeholder="最多"><input id="mkMinutes" class="mini" type="number" value="' + d.minutes + '" placeholder="分钟"><input id="mkTags" value="' + esc(d.tags) + '" placeholder="标签，逗号隔"><input id="mkCulprit" class="mini" value="' + esc(d.culprit) + '" placeholder="真凶编号"></div>';
  h += '<div class="maker-row"><textarea id="mkSynopsis" rows="2" placeholder="一句题眼">' + esc(d.synopsis) + '</textarea></div>';
  const role = r => '<div class="maker-row mk-role"><input class="f-id mini" value="' + esc(r.id) + '" placeholder="编号"><input class="f-pub mini" value="' + esc(r.public) + '" placeholder="公开名"><input class="f-pri" value="' + esc(r.private) + '" placeholder="私设"><input class="f-sec" value="' + esc(r.secret) + '" placeholder="秘密"><input class="f-goal" value="' + esc(r.goal) + '" placeholder="目标"><input class="f-bot" value="' + esc(r.botLines) + '" placeholder="配角台词，| 分隔"><button class="btn ghost mini mk-del">删</button></div>';
  h += '<div class="maker-sec"><b>人物</b><div id="mkRoles">' + (d.roles || []).map(role).join('') + '</div><button class="btn ghost mini" id="mkAddRole">添人物</button></div>';
  const clue = c => '<div class="maker-row mk-clue"><input class="f-id mini" value="' + esc(c.id) + '" placeholder="线索编号"><input class="f-title mini" value="' + esc(c.title) + '" placeholder="标题"><input class="f-text" value="' + esc(c.text) + '" placeholder="正文"><button class="btn ghost mini mk-del">删</button></div>';
  h += '<div class="maker-sec"><b>线索</b><div id="mkClues">' + (d.clues || []).map(clue).join('') + '</div><button class="btn ghost mini" id="mkAddClue">添线索</button></div>';
  const act = a => '<div class="maker-sec mk-act"><div class="maker-row"><input class="f-title" value="' + esc(a.title) + '" placeholder="幕题"><input class="f-disc mini" type="number" value="' + a.discuss + '" placeholder="议论秒"></div><div class="maker-row"><textarea class="f-narr" rows="2" placeholder="旁白，一行一句">' + esc(a.narration) + '</textarea></div><div class="maker-row"><input class="f-pubc" value="' + esc(a.public) + '" placeholder="公开线索，逗号隔"><input class="f-priv" value="' + esc(a.priv) + '" placeholder="私秘，如 r1:c2"><button class="btn ghost mini mk-del">删</button></div></div>';
  h += '<div class="maker-sec"><b>幕</b><div id="mkActs">' + (d.acts || []).map(act).join('') + '</div><button class="btn ghost mini" id="mkAddAct">添幕</button></div>';
  const end = e => '<div class="maker-row mk-end"><input class="f-when mini" value="' + esc(e.when) + '" placeholder="条件 vote:r1 / else"><input class="f-title mini" value="' + esc(e.title) + '" placeholder="结局题"><input class="f-text" value="' + esc(e.text) + '" placeholder="结局文"><button class="btn ghost mini mk-del">删</button></div>';
  h += '<div class="maker-sec"><b>结局</b><div id="mkEnds">' + (d.endings || []).map(end).join('') + '</div><button class="btn ghost mini" id="mkAddEnd">添结局</button></div>';
  h += '<div class="btn-row"><button class="btn primary" id="mkCheck">验本</button><button class="btn" id="mkDownload">下载</button><button class="btn" id="mkPresent">呈本到本房</button><button class="btn ghost" id="mkSaveDraft">存草稿</button><button class="btn ghost" id="mkClear">另起新本</button></div>';
  return h;
}
function makerBind() {
  const q = id => document.getElementById(id);
  const add = (btn, list, obj) => { const b = q(btn); if (b) b.onclick = () => { makerCollect(); S.scriptDraft[list].push(obj); makerRefresh(); }; };
  add('mkAddRole', 'roles', { id:'r' + Date.now().toString(36).slice(-3), public:'新人物', private:'', secret:'', goal:'', botLines:'' });
  add('mkAddClue', 'clues', { id:'c' + Date.now().toString(36).slice(-3), title:'新线索', text:'' });
  add('mkAddAct', 'acts', { title:'新一幕', narration:'', public:'', priv:'', discuss:240 });
  add('mkAddEnd', 'endings', { when:'else', title:'新结局', text:'' });
  document.querySelectorAll('.mk-del').forEach(b => b.onclick = () => {
    makerCollect(); const row = b.closest('.maker-row');
    const sec = row.parentElement; const idx = Array.from(sec.children).indexOf(row);
    const map = { mkRoles:'roles', mkClues:'clues', mkActs:'acts', mkEnds:'endings' };
    const key = map[sec.id] || (row.classList.contains('mk-act') ? 'acts' : null);
    if (key && S.scriptDraft[key]) { S.scriptDraft[key].splice(idx, 1); makerRefresh(); }
  });
  const on = (id, fn) => { const e = q(id); if (e) e.onclick = fn; };
  on('mkCheck', () => makerCheck(false));
  on('mkSaveDraft', () => { makerCollect(); save('qipai.scriptDraft', S.scriptDraft); toast('草稿已存本机'); });
  on('mkClear', () => { S.scriptDraft = makerBlank(); save('qipai.scriptDraft', S.scriptDraft); makerRefresh(); toast('已另起新本'); });
  on('mkDownload', () => {
    if (makerCheck(true).length) { toast('先验本，仍有缺漏'); return; }
    const j = makerJson(); const blob = new Blob([JSON.stringify(j, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = j.id + '.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast('已下载 · 放进房主 scripts/ 即可长期用');
  });
  on('mkPresent', () => {
    if (makerCheck(true).length) { toast('先验本，仍有缺漏'); return; }
    S.net.send({ t:'scriptImport', raw:JSON.stringify(makerJson()) });
    save('qipai.scriptDraft', S.scriptDraft); closeModal(); toast('已呈本到本房 · 散席即失效');
  });
}
function makerRefresh() {
  const body = $('#makerBody'); if (!body) return;
  body.innerHTML = makerBody(); makerBind();
}
function openScriptMaker() {
  S.scriptDraft = store('qipai.scriptDraft', null) || makerBlank();
  modal('制本 · 弈局呈本', '<div id="makerBody"></div>', null);
  makerRefresh();
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
  on('#seasonRecheck', 'click', () => seasonSelfCheck(false));
  on('#openScriptMaker', 'click', () => openScriptMaker());
  on('#timeUrl', 'change', e => { save('qipai.timeUrl', (e.target.value || '').trim()); seasonSelfCheck(false); });
  if ($('#timeUrl')) $('#timeUrl').value = store('qipai.timeUrl', '') || '';
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
        else toast('不是有效的弈局棋谱');
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
  const seasonHtml = `<div class="rank-season">${escapeHtml(v.seasonName || S.seasonName || '本季')} · 排位赛<br>
      <span class="season-span">${escapeHtml(v.seasonSpan || S.seasonSpan || '')}</span>
      <span class="season-check">${S.seasonVerified === false ? '未校天时 · 依本席更漏' : '天时已校 · 段位不可自改'}</span><br>
      段位 <b>${escapeHtml(v.rank || ri.name)}</b> · 共 ${v.rankSum || 0} 墨分 · ${ri.next ? '距下段 ' + ri.next + ' 墨分' : '已至顶阶'}<br>
      匣中弈株 ${v.yizhu || 0} 枚<br>
      神的领域 · <b style="color:var(--accent)">${v.godTitle || '未叩域'}</b> · 青冥 / 玄枢 / 太虚 三尊<br>
      ${v.rankBase ? '上季承袭 ' + v.rankBase + ' 墨分 · ' : ''}上赛季 ${escapeHtml(v.lastSeason || '—')} · ${escapeHtml(v.lastRank || '初执')}
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
function applyWorn() {
  const w = (S.shop && S.shop.worn) || {};
  document.body.dataset.face = w.face || '';
  document.body.dataset.seal = w.seal || '';
  document.body.dataset.ink = w.ink || '';
  document.body.dataset.fx = w.fx || '';
  const cv = $('#board'); if (cv) cv.dataset.desk = w.desk || '';
}
function renderGodPanel() {
  const el = $('#godPanel'); if (!el || !S.godInfo) return;
  const g = (S.pending && S.pending.game) || (S.view && S.view.game) || '';
  const r = (S.godInfo.ranks || {})[g] || { rank:0, title:'', nextTier:1, nextName:'青冥' };
  const pts = ((S.account && S.account.save && S.account.save.rankPts) || {})[g] || 0;
  const need = Math.max(0, 800 - pts);
  const gname = (S.games.find(x => x.id === g) || {}).name || '此局';
  let h = '<div class="side-h" style="margin-top:18px">神的领域 · 叩问三尊</div>';
  h += '<div class="hint">段位七阶至「弈圣」方可叩域；三尊依次青冥 → 玄枢 → 太虚，胜首尊即 <b>弈神</b>，再胜加前缀「玄」「太」。禁悔、禁和、隐士九阶，逐尊收更漏。</div>';
  h += '<div class="setting-row"><span>' + escapeHtml(gname) + '</span><span class="season-state">' +
       (r.title ? escapeHtml(r.title) : '未叩域') + '</span></div>';
  h += '<div class="hint">' + (need > 0
       ? '此局尚差 ' + need + ' 墨分至弈圣，神域未启。'
       : '此局已至弈圣 · 下一尊「' + escapeHtml(r.nextName || '青冥') + '」') + '</div>';
  if (S.godInfo.title) h += '<div class="hint">最高神衔：<b style="color:var(--accent)">' + escapeHtml(S.godInfo.title) + '</b></div>';
  el.innerHTML = h;
}
function renderShop() {
  const el = $('#shopGrid'); if (!el) return;
  const sh = S.shop;
  if (!sh) { el.innerHTML = '<div class="hint">候装扮目录…</div>'; return; }
  const bal = $('#shopBalance'); if (bal) bal.textContent = sh.yizhu + ' 枚';
  const kinds = { desk:'牌桌', face:'牌面', seal:'朱印', ink:'墨色', fx:'华彩' };
  const owned = (sh.owned || []).map(String);
  let h = '';
  Object.keys(kinds).forEach(k => {
    h += '<div class="shop-kind">' + kinds[k] + '</div>';
    h += '<button class="shop-item' + (!sh.worn[k] ? ' on' : '') + '" data-wear="' + k + '">素妆</button>';
    (sh.items || []).filter(x => x.kind === k).forEach(x => {
      const has = owned.indexOf(String(x.key)) >= 0, on = sh.worn[k] === x.key;
      h += '<button class="shop-item' + (on ? ' on' : '') + '" data-key="' + escapeHtml(x.key) +
        '" title="' + escapeHtml(x.note || '') + '">' + escapeHtml(x.name) +
        (has ? (on ? ' · 配戴中' : ' · 配戴') : ' · ' + x.cost + ' 株') + '</button>';
    });
  });
  el.innerHTML = h;
  el.querySelectorAll('.shop-item').forEach(b => b.onclick = () => {
    const key = b.dataset.key;
    if (!key) { S.net.send({ t:'shopWear', key:'', kind:b.dataset.wear }); return; }
    const has = owned.indexOf(String(key)) >= 0;
    S.net.send({ t: has ? 'shopWear' : 'shopBuy', key:key, kind:(sh.items.find(x => x.key === key) || {}).kind || '' });
  });
}
function renderSeasonState() {
  const el = $('#seasonState'); if (!el) return;
  el.textContent = (S.seasonName || '本季') + ' · ' +
    (S.seasonVerified === false ? '未校天时' : '天时已校');
  el.title = S.seasonSpan || '';
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

renderAll = function () {
  renderPlay();
  if (S.screen === 'rooms' || S._roomsDirty) { renderRooms(); renderMyRoom(); S._roomsDirty = false; }
  if (S.screen === 'today' || S._todayDirty) { updateToday(); S._todayDirty = false; }
};

onStatus = function (s) {
  S.conn = s;
  const el = $('#conn');
  if (el) {
    el.className = 'conn' + (s === 'online' ? '' : ' off');
    const sp = el.querySelector('span');
    if (sp) sp.textContent = s === 'online' ? '已联机' : s === 'connecting' ? '连接中' :
      s === 'need-url' ? '待填地址' : '本机自弈 · 未连棋馆';
    el.onclick = (s === 'need-url') ? () => askServerUrl(false) : null;
  }
  const bar = $('#offlineBar');
  if (bar) {
    const off = s !== 'online' && Settings.get('offlineNotice');
    bar.hidden = !off;
    if (off) bar.innerHTML = '<span class="ob-mark">◈</span><span>本机自弈：60 局都能点「寻局」与隐士开枰；玩法册、纸色、设置、装扮、战绩与剧本皆可用。联机请填棋馆地址。</span><button class="btn ghost small" id="obFix">连棋馆</button>';
    const b = $('#obFix'); if (b) b.onclick = () => askServerUrl(false);
  }
};

renderSliders = function () {
  const el = $('#sliders'); if (!el) return;
  el.innerHTML = (S.themes.sliders || []).map(sl =>
    `<div class="slider"><label>${sl.name}<b id="sv-${sl.id}">${S.sliders[sl.id] ?? sl.default}</b></label>
      <input type="range" min="${sl.min}" max="${sl.max}" value="${S.sliders[sl.id] ?? sl.default}" data-slider="${sl.id}"></div>`).join('');
  el.querySelectorAll('input[data-slider]').forEach(inp => inp.oninput = () => {
    S.sliders[inp.dataset.slider] = +inp.value;
    const b = $('#sv-' + inp.dataset.slider); if (b) b.textContent = inp.value;
    save('qipai.sliders', S.sliders);
    if (inp.dataset.slider === 'motion') Settings.set('fxLevel', +inp.value);
    applyTheme(S.themeId); renderPlay();
  });
};

function escapeAttr(v) { return escapeHtml(String(v ?? '')); }
function settingsLabel(v) {
  if (typeof v === 'boolean') return v ? '启' : '停';
  if (typeof v === 'number') return String(v);
  return escapeHtml(String(v ?? ''));
}
function renderSettings() {
  const el = $('#settingsPanel'); if (!el) return;
  let h = '';
  GROUPS.forEach(g => {
    h += `<section class="set-group"><div class="set-h"><span class="set-icon">${g.icon}</span><b>${g.name}</b><small>${g.items.length} 项</small></div><div class="set-body">`;
    g.items.forEach(it => {
      const v = Settings.get(it.key);
      let ctl = '';
      if (it.type === 'toggle') ctl = `<button class="toggle ${v ? 'on' : ''}" data-set-toggle="${it.key}">${v ? '启' : '停'}</button>`;
      else if (it.type === 'range') ctl = `<div class="set-range"><input type="range" min="${it.min}" max="${it.max}" step="${it.step || 1}" value="${v}" data-set-range="${it.key}"><b data-set-val="${it.key}">${settingsLabel(v)}</b></div>`;
      else if (it.type === 'select') ctl = `<select class="set-select" data-set-select="${it.key}">${it.options.map((o, ix) => { const val = it.values ? it.values[ix] : o; return `<option value="${escapeAttr(val)}" ${String(val) === String(v) ? 'selected' : ''}>${escapeAttr(o)}</option>`; }).join('')}</select>`;
      else if (it.type === 'text') ctl = `<input class="set-text" data-set-text="${it.key}" value="${escapeAttr(v)}" placeholder="${it.key === 'serverUrl' ? '留空则同源 · 任意 IP / 域名 / 端口可省' : ''}">`;
      else if (it.type === 'number') ctl = `<input class="set-text" type="number" min="${it.min || 0}" max="${it.max || 99999}" value="${escapeAttr(v)}" data-set-number="${it.key}">`;
      else ctl = `<button class="btn ghost small ${it.danger ? 'danger' : ''}" data-set-action="${it.key}">${it.danger ? '删除' : '打开'}</button>`;
      h += `<div class="set-row ${it.danger ? 'danger' : ''}"><div class="set-name">${escapeHtml(it.name)}${it.hint ? `<small>${escapeHtml(it.hint)}</small>` : ''}</div><div class="set-ctl">${ctl}</div></div>`;
    });
    h += '</div></section>';
  });
  h += '<div class="btn-row"><button class="btn ghost small" id="setReset">复旧 · 全部归默认值</button><button class="btn ghost small" id="setExport">导出偏好</button></div>';
  h += '<div id="noticeCard" class="notice-card"></div>';
  el.innerHTML = h;
  el.querySelectorAll('[data-set-toggle]').forEach(b => b.onclick = () => {
    const k = b.dataset.setToggle; Settings.set(k, !Settings.get(k)); renderSettings(); renderShop();
  });
  el.querySelectorAll('[data-set-range]').forEach(inp => inp.oninput = () => {
    const k = inp.dataset.setRange, v = +inp.value; Settings.set(k, v);
    const b = el.querySelector(`[data-set-val="${k}"]`); if (b) b.textContent = String(v);
    if (k === 'fxLevel') { S.sliders.motion = v; save('qipai.sliders', S.sliders); renderSliders(); }
    renderPlay();
  });
  el.querySelectorAll('[data-set-select]').forEach(sel => sel.onchange = () => {
    Settings.set(sel.dataset.setSelect, isNaN(+sel.value) || sel.value === '' ? sel.value : +sel.value);
    renderSettings();
  });
  el.querySelectorAll('[data-set-number]').forEach(inp => inp.onchange = () => {
    const k = inp.dataset.setNumber;
    let v = parseInt(inp.value, 10);
    if (isNaN(v)) v = 5080;
    v = Math.max(1, Math.min(65535, v)); inp.value = String(v);
    Settings.set(k, v); renderSettings();
    if (k === 'defaultPort' && S.net && S.net.custom) S.net.setUrl(S.net.custom);
  });
  el.querySelectorAll('[data-set-text]').forEach(inp => inp.onchange = () => {
    const k = inp.dataset.setText;
    if (k === 'serverUrl') { S.net.setUrl(inp.value.trim()); Settings.set(k, inp.value.trim()); }
    else Settings.set(k, inp.value.trim());
  });
  el.querySelectorAll('[data-set-action]').forEach(b => b.onclick = () => settingsAction(b.dataset.setAction));
  const r = $('#setReset'); if (r) r.onclick = () => askDanger('设置复旧？', () => { Settings.reset(); renderSettings(); renderShop(); toast('已复旧'); });
  const ex = $('#setExport'); if (ex) ex.onclick = () => {
    downloadText('yiju-偏好.json', JSON.stringify(Settings.all, null, 2)); toast('偏好已导出');
  };
  renderNotice();
}

function downloadText(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function askDanger(title, onYes) {
  modal(title, `<p>此举只作用于本机与本馆数据，确认后不可复原。</p>
    <button class="btn primary" id="dYes">确认</button><button class="btn" id="dNo">容后再议</button>`, null);
  const y = $('#dYes'), n = $('#dNo');
  if (y) y.onclick = () => { closeModal(); onYes(); };
  if (n) n.onclick = closeModal;
}
const YJ_NOTICE = '本项目为开源技术分享，不提供官方游戏服务，不构成面向公众的网络游戏运营。游戏核心体验可完全离线进行。任何使用者自行部署、分发或商业化所产生的合规责任（包括但不限于版号、实名制、个人信息保护），由使用者自行承担。';
function renderNotice() {
  const el = $('#noticeCard');
  if (el) el.innerHTML = `<div class="notice-seal">告</div><div class="notice-txt"><b>技术与合规声明</b><p>${YJ_NOTICE}</p>
    <small>源码以 PolyForm Noncommercial 1.0.0 公开，禁止商用；本页与「案牍 · 设置」同文，可随时复阅。</small></div>`;
  const foot = $('#appFooter');
  if (foot) foot.innerHTML = `<span>弈局 · 源码公开 · 禁止商用</span><button class="link" id="footNotice">技术与合规声明</button>`;
  const f = $('#footNotice'); if (f) f.onclick = openNotice;
}
function openNotice() {
  modal('技术与合规声明', `<div class="notice-full"><p>${YJ_NOTICE}</p>
    <p>棋馆是使用者自行在本机运行的本地程序，名录、校时、公共榜单均为可关闭的外部可选项；不联网时，本机棋馆与局域网联机的全部功能照常可用。项目不收集、不上传个人信息，也不提供任何官方在线服务。</p>
    <p>许可：PolyForm Noncommercial 1.0.0 · 源码公开、可改可分发，禁止任何商用。</p></div>
    <button class="btn primary" id="noticeOk">领了</button>`, null);
  const b = $('#noticeOk'); if (b) b.onclick = closeModal;
}
function settingsAction(k) {
  if (k === 'notice') { openNotice(); return; }
  if (k === 'license') { modal('源码公开 · 禁止商用', `<div class="notice-full"><p>PolyForm Noncommercial 1.0.0</p><p>源码照常公开、可阅读、可修改、可分发；任何商业用途须另取书面许可。按 OSI 开源定义，此类限制不属于 OSI 认证开源，故全站称「源码公开」而非「开源软件」。</p></div><button class="btn primary" id="licOk">领了</button>`, null); const b = $('#licOk'); if (b) b.onclick = closeModal; return; }
  if (k === 'diagnostics') {
    modal('本机诊断', `<div class="notice-full"><p>连接：${S.conn} · ${S.net && S.net.custom ? escapeHtml(S.net.custom) : '本机回环 / 同源'}</p>
      <p>玩法册：${S.games.length} 局 ${S.offlineAssets ? '（离线内嵌册）' : '（棋馆下发）'}</p>
      <p>画质：${Settings.get('quality')} · 清晰倍率 ${Settings.get('dpr')} · 华彩 ${Settings.get('fxLevel')}</p>
      <p>装扮：${WEAR_LIST.length} 件可购 · 题名 ${S.account && S.account.ok ? '已入席' : '未题名'}</p>
      <p>外部服务：名录 ${Settings.get('externalDir') ? '开' : '关'} · 校时 ${Settings.get('externalTime') ? '开' : '关'} · 榜单 ${Settings.get('externalBoards') ? '开' : '关'}</p>
      <p>本机数据：账号与加密存档仅存于房主棋馆的 data/；页面不上传个人信息。</p></div>
      <button class="btn primary" id="diagOk">领了</button>`, null);
    const b = $('#diagOk'); if (b) b.onclick = closeModal; return;
  }
  if (k === 'clearCache') { askDanger('清除本机页面缓存？', () => {
    ['qipai.worn','qipai.theme','qipai.sliders','qipai.history','qipai.guideSeen'].forEach(x => { try { localStorage.removeItem(x); } catch (e) {} });
    toast('本机缓存已清，加密存档未动'); setTimeout(() => location.reload(), 700);
  }); return; }
  if (k === 'clearLocalStats') { askDanger('清空本馆本机榜？', () => {
    if (!S.net) return; S.net.send({ t: 'clearLocalStats' }); toast('已请棋馆清空本机榜');
  }); return; }
  if (k === 'changePassword') { modal('更换口令', `<div class="field"><label>旧口令</label><input id="pwOld" type="password" class="url-input"></div>
    <div class="field"><label>新口令（8–64 字）</label><input id="pwNew" type="password" class="url-input"></div>
    <button class="btn primary" id="pwOk">更</button>`, null);
    const b = $('#pwOk'); if (b) b.onclick = () => {
      S.net.send({ t: 'accountPassword', old: $('#pwOld').value, password: $('#pwNew').value });
      closeModal();
    }; return; }
  if (k === 'deleteAccount') { modal('删除本馆账号', `<p>连加密存档、段位、装扮一并删去，不可复原。请先「携谱」备份。</p>
    <div class="field"><label>口令核验</label><input id="delPass" type="password" class="url-input"></div>
    <button class="btn danger" id="delOk">确认删除</button>`, null);
    const b = $('#delOk'); if (b) b.onclick = () => {
      S.net.send({ t: 'accountDelete', password: $('#delPass').value }); closeModal();
    }; return; }
}

function isCellular() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return false;
  return /cellular|2g|3g|4g|5g/i.test(String(c.type || '') + ' ' + String(c.effectiveType || ''));
}
function installSendGate() {
  const ext = { halls: 'externalDir', hallDir: 'externalDir', boards: 'externalBoards', season: 'externalTime', seasonCheck: 'externalTime' };
  window.__YJ_SEND_GATE__ = (m) => {
    const key = ext[m && m.t];
    if (!key) return true;
    if (!Settings.get(key)) return false;
    if (Settings.get('wifiOnly') && isCellular()) return false;
    return true;
  };
}
function applyAccessibility() {
  const s = Settings.all, b = document.body;
  b.dataset.largeTap = s.largeTap ? '1' : '';
  b.dataset.oneHand = s.oneHand ? '1' : '';
  b.dataset.reduceFlash = s.reduceFlash ? '1' : '';
  b.dataset.screenReader = s.screenReader ? '1' : '';
  const cv = $('#board');
  if (cv && s.screenReader && S.view) cv.setAttribute('aria-label',
    (gameName(S.view.game) || '对局') + ' · 第 ' + S.view.moveNo + ' 手 · ' + (S.view.phaseName || '对局中'));
}
function installLifecycle() {
  let logoutTimer = null, wake = null;
  const arm = () => {
    clearTimeout(logoutTimer);
    const v = Settings.get('autoLogout');
    const ms = v === '5分' ? 300000 : v === '30分' ? 1800000 : 0;
    if (ms) logoutTimer = setTimeout(() => {
      if (S.net) S.net.send({ t: 'accountLogout' });
      toast('久未操作，已自动离席');
    }, ms);
  };
  ['click', 'keydown', 'touchstart'].forEach(e => document.addEventListener(e, arm, { passive: true }));
  arm();
  document.addEventListener('visibilitychange', () => {
    const lock = $('#privacyLock');
    if (document.hidden && Settings.get('lockOnHide') && lock) lock.hidden = false;
    else if (lock) lock.hidden = true;
    if (document.hidden) { clearTimeout(logoutTimer); if (wake) { try { wake.release(); } catch (e) {} wake = null; } }
    else { arm(); applyWakeLock(); }
  });
  async function applyWakeLock() {
    if (!Settings.get('keepAwake') || S.screen !== 'play' || !('wakeLock' in navigator)) return;
    try { wake = await navigator.wakeLock.request('screen'); } catch (e) {}
  }
  Settings.subscribe((k) => { if (k === 'keepAwake') applyWakeLock(); applyAccessibility(); });
  window.addEventListener('pagehide', () => {
    if (Settings.get('clearOnExit')) {
      ['qipai.worn', 'qipai.history'].forEach(x => { try { localStorage.removeItem(x); } catch (e) {} });
    }
  });
}
function showOfflineHint() {
  if (!Settings.get('offlineNotice')) return;
  toast('本机自弈已就位 · 60 局皆可与隐士开枰，联机需填棋馆地址');
}

renderShop = function () {
  const grid = $('#shopGrid'); if (!grid) return;
  const sh = S.shop || { items: WEAR_LIST, yizhu: 0, owned: [], worn: store('qipai.worn', {}) };
  const items = (sh.items && sh.items.length) ? sh.items : WEAR_LIST;
  const owned = (sh.owned || []).map(String);
  const worn = sh.worn || {};
  const bal = $('#shopBalance'); if (bal) bal.textContent = (sh.yizhu || 0) + ' 枚';
  const tab = S.shopTab || 'all', filter = S.shopFilter || 'all', q = (S.shopQuery || '').trim();
  const kinds = Object.keys(WEAR_KINDS);
  const tools = $('#shopToolbar');
  if (tools) {
    tools.innerHTML = `<div class="shop-tabs">` +
      `<button class="shop-tab ${tab === 'all' ? 'on' : ''}" data-shop-tab="all">全目 · ${items.length}</button>` +
      kinds.map(k => `<button class="shop-tab ${tab === k ? 'on' : ''}" data-shop-tab="${k}">${WEAR_KINDS[k]}</button>`).join('') +
      `</div><div class="shop-tools"><input id="shopSearch" placeholder="搜装扮 / 品阶 / 套系" value="${escapeAttr(q)}">` +
      `<select id="shopFilter">${[['all','全部'],['owned','已入匣'],['buy','可购'],['miss','未得']].map(([v,n]) => `<option value="${v}" ${filter === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>` +
      `<div class="shop-sets">${Object.keys(WEAR_SETS).map(st => {
        const ks = items.filter(x => x.set === st).map(x => x.key);
        const got = ks.filter(k => owned.indexOf(k) >= 0).length;
        return `<span class="set-chip ${got === ks.length && ks.length ? 'done' : ''}">${st} ${got}/${ks.length}</span>`;
      }).join('')}</div>` +
      `<div class="shop-tip">共 ${items.length} 件 · 已入匣 ${owned.length} 件 · 点击可预览试穿，定妆后才写入存档；离线也能试穿，购买须连本机棋馆。</div>`;
    tools.querySelectorAll('[data-shop-tab]').forEach(b => b.onclick = () => { S.shopTab = b.dataset.shopTab; renderShop(); });
    const ss = $('#shopSearch'); if (ss) ss.oninput = (e) => { S.shopQuery = e.target.value; renderShop(); };
    const sf = $('#shopFilter'); if (sf) sf.onchange = (e) => { S.shopFilter = e.target.value; renderShop(); };
  }
  const list = items.filter(x => {
    if (tab !== 'all' && x.kind !== tab) return false;
    const has = owned.indexOf(String(x.key)) >= 0;
    if (filter === 'owned' && !has) return false;
    if (filter === 'miss' && has) return false;
    if (filter === 'buy' && (has || (sh.yizhu || 0) < (x.cost || 0))) return false;
    if (q && !((x.name || '') + (x.note || '') + (x.rarity || '') + (x.set || '') + (x.key || '')).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  grid.innerHTML = `<button class="shop-item plain ${Object.keys(worn).length ? '' : 'on'}" data-shop-wear="素妆">素妆 · 卸下全部</button>` +
    list.map(x => {
      const has = owned.indexOf(String(x.key)) >= 0, on = worn[x.kind] === x.key;
      return `<button class="shop-item ${on ? 'on' : ''} rar-${x.rarity || '常'}" data-shop-key="${escapeAttr(x.key)}">
        <span class="si-rar">${WEAR_RARITY[x.rarity] || '常品'}</span><b>${escapeHtml(x.name)}</b>
        <small>${escapeHtml(x.set && x.set !== '—' ? x.set : WEAR_KINDS[x.kind] || '')}</small>
        <em>${has ? (on ? '配戴中' : '已入匣') : (x.cost + ' 株')}</em></button>`;
    }).join('') + (list.length ? '' : '<div class="hint">此处暂无合条件的装扮</div>');
  grid.querySelectorAll('[data-shop-key]').forEach(b => b.onclick = () => shopPreview(b.dataset.shopKey, sh, items, owned));
  const pw = grid.querySelector('[data-shop-wear]');
  if (pw) pw.onclick = () => { S.shopTry = { w: {}, t: Date.now() }; applyWear({}); save('qipai.worn', {}); if (S.net) S.net.send({ t: 'shopWear', key: '', kind: 'all' }); renderShop(); toast('已卸下全部装扮'); };
  renderShopPreview(sh, items, owned);
};

function shopPreview(key, sh, items, owned) {
  S.shopPreview = key;
  renderShopPreview(sh, items, owned);
}
function renderShopPreview(sh, items, owned) {
  const el = $('#shopPreview'); if (!el) return;
  const key = S.shopPreview;
  const it = items.find(x => x.key === key);
  if (!it) { el.innerHTML = `<div class="sp-empty">点一件装扮，可先看样式、再试穿。素妆亦在此处卸下。</div>`; return; }
  const has = owned.indexOf(String(it.key)) >= 0;
  const w = Object.assign({}, sh.worn || {}); w[it.kind] = it.key;
  const trial = S.shopTry && S.shopTry.w && S.shopTry.w[it.kind] === it.key;
  el.innerHTML = `<div class="sp-card rar-${it.rarity || '常'}" data-sp-kind="${it.kind}">
    <div class="sp-swatch"><span class="sp-seal">${escapeHtml(it.name.slice(0, 1))}</span></div>
    <div class="sp-info"><b>${escapeHtml(it.name)}</b><span class="si-rar">${WEAR_RARITY[it.rarity] || '常品'} · ${WEAR_KINDS[it.kind]}</span>
    <p>${escapeHtml(it.note || '')}</p><small>${it.set !== '—' ? '套系 · ' + escapeHtml(it.set) : '散品'} · ${has ? '已入匣' : it.cost + ' 株'}</small></div>
    <div class="sp-act"><button class="btn ghost small" id="spTry">试穿</button>
    <button class="btn ghost small" id="spFix">定妆</button>
    <button class="btn primary small" id="spBuy">${has ? '配戴' : '购并配戴'}</button></div></div>`;
  const t = $('#spTry'); if (t) t.onclick = () => {
    S.shopTry = { w, t: Date.now() }; applyWear(w); toast('试穿中 · 点「定妆」写入存档'); renderShopPreview(sh, items, owned);
  };
  const f = $('#spFix'); if (f) f.onclick = () => {
    applyWear(w); save('qipai.worn', w);
    if (S.net && S.conn === 'online') S.net.send({ t: 'shopWear', key: it.key, kind: it.kind });
    else toast('离线试穿已留在本机，连馆后可定妆');
    S.shopTry = null; renderShop(); toast('已定妆 · ' + it.name);
  };
  const b = $('#spBuy'); if (b) b.onclick = () => {
    if (!has) {
      if (S.conn !== 'online') { toast('购买须连本机棋馆；可先试穿'); return; }
      if ((sh.yizhu || 0) < it.cost) { toast('弈株未足，尚差 ' + (it.cost - (sh.yizhu || 0)) + ' 枚'); return; }
      askDanger('购「' + it.name + '」· ' + it.cost + ' 株？', () => S.net.send({ t: 'shopBuy', key: it.key, kind: it.kind }));
    } else if (S.net && S.conn === 'online') S.net.send({ t: 'shopWear', key: it.key, kind: it.kind });
    else { applyWear(w); save('qipai.worn', w); toast('已在本机配戴'); }
  };
}

applyWorn = function () {
  const w = (S.shop && S.shop.worn) || store('qipai.worn', {}) || {};
  document.body.dataset.face = w.face || '';
  document.body.dataset.seal = w.seal || '';
  document.body.dataset.ink = w.ink || '';
  document.body.dataset.fx = w.fx || '';
  const cv = $('#board'); if (cv) cv.dataset.desk = w.desk || '';
  try { applyWear(w); } catch (e) {}
  if (window.Sound && window.Sound.profile) window.Sound.profile(Settings.all);
};

openGuide = function () {
  modal('入门小引 · 与君同弈', `
    <div class="guide">
      <div class="guide-step"><b>壹 · 三种用法，服务器只是可选项</b>
        <p><b>本机自弈（完全不联网）</b>：在本机跑棋馆程序，本页连本机回环即可。60 局、隐士陪玩、加密存档、段位、装扮、制本、神的领域全部可用；仅「多人联机」需另有人入席。</p>
        <p><b>局域网联机</b>：同一 WiFi 填房主棋馆地址，多人对局与房内闲谈照常，依然不需要任何外部服务器。</p>
        <p><b>外部服务（默认开、可全关）</b>：棋馆名录、赛季校时、公共榜单。设置里逐项可关；关掉或挂了，前两种用法一点不缺。纯本机时哪怕没网，段位照常记，只标「未校天时」。</p></div>
      <div class="guide-step"><b>贰 · 连上本机棋馆</b>
        <p>房主那台机器起好棋馆（<code>dotnet run --project server</code>），启动日志会印出可照抄的地址。在「肆 · 案牍 → 联网 · 离线」填<b>任意可达地址</b>：局域网地址、域名、新式网址、带路径地址、本机回环都认，不绑定任何固定地址或某一台机器。</p>
        <p><b>端口写不写都行</b>：不写自动补「缺省端口」（默认 5080，设置里可改），写了就按写的连。不填外网地址、不必题名、不上传任何个人信息。</p></div>
      <div class="guide-step"><b>叁 · 设席开枰</b>
        <p>挑一局，可题雅号、设暗语、许旁观、定每步思考 / 出牌之刻、选超时之法与隐士棋力；每局另有本局专属规制，皆在「房规」里。记五字房号邀人，未齐可请隐士补满。</p></div>
      <div class="guide-step"><b>肆 · 落子出牌与卷面</b>
        <p>棋盘小圆点是可落处；走子类先点己子再点目标格，牌类先点手牌再按「落牌」，也可双击快捷出牌。折狱录跟幕卡走：旁白逐句、线索翻牌、轮流发言、终幕指认，私本只你可见。弈卷两席同时覆简，启简后界墨推移。</p>
        <p>全 60 局共用一套界面特效；画质、字大、高对比、色觉辅助、音量分路、动效浓淡都在「案牍 · 设置」，随系统减动效亦自动收敛。</p></div>
      <div class="guide-step"><b>伍 · 装扮 / 段位 / 神的领域</b>
        <p>弈株只由终局相赠（每日至多六十枚），不入局内、不兑换、无充值。装扮 49 件分十一类、四品阶、四套系，可搜、可筛、可预览试穿、可一键素妆；纸色十品与微调笔意也在设置里。</p>
        <p>段位七阶按赛季重置；此局至顶阶「弈圣」方可叩「神的领域」三尊青冥 / 玄枢 / 太虚，胜首尊即弈神，再胜加前缀为玄弈神、太玄弈神。</p></div>
      <div class="guide-step"><b>陆 · 存档 / 隐私 / 声明</b>
        <p>不题名照样玩，战绩记本机榜；题名后自动建一份本机加密存档，每局终了自动写回，可导出 <code>.yijusave</code> 携往别馆，导入须再验口令。设置里可换口令、清缓存、清本机战绩、删除本馆账号。</p>
        <p>剧本只在房主本地 <code>scripts/</code>，丢新 JSON 即更新，亦可当场呈本。源码以「源码公开 · 禁止商用」协议随版本发布。</p>
        <p class="guide-notice">${YJ_NOTICE}</p></div>
    </div>
    <button class="btn primary" id="guideOk">领了</button><button class="btn ghost" id="guideNotice">观声明</button><button class="btn ghost" id="guideConn">连棋馆</button>`, null);
  $('#guideOk').onclick = () => { S.guideShown = true; lsSet('qipai.guideSeen', '1'); closeModal(); };
  $('#guideNotice').onclick = openNotice;
  $('#guideConn').onclick = () => { closeModal(); askServerUrl(false); };
};

document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest && e.target.closest('#actionBar .chip[data-act]');
  if (!b || b.disabled) return;
  const a = b.dataset.act;
  if ((a === 'resign' && Settings.get('confirmResign')) || (a === 'undo' && Settings.get('confirmUndo'))) {
    if (b.dataset.ok === '1') { delete b.dataset.ok; return; }
    e.preventDefault(); e.stopImmediatePropagation();
    askDanger(a === 'resign' ? '投子认负？' : '乞复一着？', () => { b.dataset.ok = '1'; b.click(); });
  }
}, true);
document.addEventListener('dblclick', (e) => {
  if (!Settings.get('quickPlay')) return;
  const c = e.target && e.target.closest && e.target.closest('#handRow [data-card], #handRow .card');
  if (!c) return;
  const b = document.querySelector('#actionBar .chip[data-act="play-selected"]');
  if (b && !b.disabled) b.click();
});
document.addEventListener('pointerdown', (e) => {
  if (!Settings.get('longPressConfirm')) return;
  const c = $('#board'); if (!c || !c.contains(e.target)) return;
  c.dataset.longPress = '1';
  setTimeout(() => { if (c.dataset.longPress === '1') { c.dataset.longPressArmed = '1'; delete c.dataset.longPress; } }, 650);
  setTimeout(() => { if (c.dataset.longPressArmed === '1') delete c.dataset.longPressArmed; }, 1600);
}, true);

function startMatch(variant) {
  if (!S.net) return;
  const v = variant === undefined ? S.curVariant : variant;
  S.net.send({ t:'match', game:S.curGame, variant:v, maxWait:Number(Settings.get('matchMaxWait')) * 1000 });
  if (!(S.net && S.net.mode !== 'real')) toast('已入寻局池 · 先同段，候久渐放宽');
}
function renderMatchState(m) {
  const bar = $('#matchBar'), txt = $('#matchText'), btn = $('#matchCancel');
  if (!bar || !txt) return;
  if (!m.active) {
    bar.hidden = true;
    if (m.note) toast(m.note);
    return;
  }
  bar.hidden = false;
  txt.textContent = '寻局 · 已候 ' + m.waited + ' 秒 · ' + (m.pool || '同段') +
    ' · 池中 ' + m.size + ' 人' + (m.need > 0 ? ' · 还差 ' + m.need + ' 人' : '') +
    (m.etaBot > 0 ? ' · ' + m.etaBot + ' 秒后隐士补位' : '');
  if (btn) btn.onclick = () => {
    if (S.net) S.net.send({ t:'matchCancel' });
    bar.hidden = true; toast('已止寻局');
  };
}

/* 横屏大厅外壳（shell.js）通过这组接口调用对局内核，不重复实现任何玩法逻辑 */
window.YJ = {
  S, go, toast, modal, closeModal, openCreate, joinRoom, startMatch, openGuide,
  setTodayLine,
  settings: Settings,
  games: () => S.games,
  mainIds: ['yijuan','houlou','duzhou','dengying','huiwen','cuojin','shiyi','tingyu'],
  presenceCodes: () => {
    const out = [];
    (S.presence || []).forEach(p => {
      if (!p) return;
      ['code', 'name', 'id'].forEach(k => {
        const v = p[k];
        if (typeof v === 'string') {
          out.push(v);
          const m = v.match(/YJ-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/);
          if (m) out.push(m[0]);
        }
      });
    });
    (S.chat || []).forEach(c => {
      const m = String((c && c.text) || '').match(/YJ-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/);
      if (m) out.push(m[0]);
    });
    return out;
  },
  reconnect: () => {
    if (!S.net) return;
    S.net.disconnect(); S.net.connect();
  },
  startGame: (id) => {
    const g = S.games.find(x => x.id === id);
    if (!g) { toast('玩法册里没有这一局'); return; }
    S.curGame = id;
    S.curVariant = (g.variants || [])[0] || '';
    renderVariants();
    closeModal();
    startMatch(S.curVariant);
  }
};
