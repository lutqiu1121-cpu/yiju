// 弈局 · 横屏大厅外壳：登录 / 凭证 / 好友 / 对弈层级选择
// 不改动对局内核，只通过 window.YJ 暴露的接口调用。
import * as F from './friends.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const esc = F.escapeHtml;

const MAIN_IDS = ['yijuan', 'houlou', 'duzhou', 'dengying', 'huiwen', 'cuojin', 'shiyi', 'tingyu'];
const ENTRIES = [
  { id: 'shop',     ico: '装', name: '装扮' },
  { id: 'stats',    ico: '绩', name: '战绩' },
  { id: 'rooms',    ico: '雅', name: '雅集' },
  { id: 'settings', ico: '案', name: '案牍' },
  { id: 'guide',    ico: '引', name: '小引' },
];
const TABS = [
  { id: 'hall', name: '大厅' }, { id: 'play', name: '对局' }, { id: 'rooms', name: '雅集' },
  { id: 'stats', name: '战绩' }, { id: 'shop', name: '装扮' }, { id: 'settings', name: '案牍' },
];

let YJ = null, pickerAll = false, pickerQuery = '';

function waitYJ(cb, n = 0) {
  if (window.YJ && window.YJ.games && window.YJ.games().length) return cb();
  if (n > 120) return cb(); // 离线资产兜底，不无限等
  setTimeout(() => waitYJ(cb, n + 1), 50);
}

/* ---------------- 首次进入：本机注册（不用手机号 / 密码 / 联网） ---------------- */
let rgAvatar = 'mo';
function initRegister() {
  const box = $('#rgAvatars');
  box.innerHTML = F.AVATARS.map(a =>
    '<button type="button" class="rg-av' + (a.id === rgAvatar ? ' on' : '') +
    '" data-id="' + a.id + '" style="background:' + a.bg + '" title="' + esc(a.ch) + '">' + esc(a.ch) + '</button>'
  ).join('');
  $$('.rg-av').forEach(b => b.onclick = () => {
    rgAvatar = b.dataset.id;
    $$('.rg-av').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#rgGo').onclick = () => {
    const name = String($('#rgName').value || '').trim();
    const err = $('#rgErr');
    if (name.length < 2 || name.length > 12) {
      err.textContent = '称呼要 2–12 个字，随便起一个就行';
      err.hidden = false;
      $('#rgName').focus();
      return;
    }
    err.hidden = true;
    const p = F.createProfile(name, rgAvatar);   // 凭证在这一刻才签发
    F.startPresence && F.startPresence();        // 注册后才参与局域网在线状态
    $('#register').hidden = true;
    bindLogin(true);                             // 展示注册得到的凭证
    $('#lgNew').hidden = false;
    $('#lgNew').textContent = '棋客已创建 · 凭证只存本机，记好它';
    $('#lgHello').textContent = '欢迎，' + p.name;
  };
}

/* ---------------- 登录页（已注册 / 注册完成后） ---------------- */
function bindLogin(justRegistered) {
  $('#login').hidden = false;
  $('#lgCode').textContent = F.peekCode() || '—';
  $('#lgName').value = F.myName();
  const savedMode = get('qipai.loginMode', 'local');
  const savedUrl = get('qipai.loginServer', '');
  setMode(savedMode);
  $('#lgServer').value = savedUrl;
  $('#lgNoticeChk').checked = get('qipai.loginHintOff', '') === '1';
  $('#lgNotice').hidden = $('#lgNoticeChk').checked;
  $('#lgNew').hidden = !justRegistered;
  if (!justRegistered) $('#lgHello').textContent = '欢迎回来，' + F.myName();
  $$('.lg-mode').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  $('#lgCopy').onclick = () => {
    const t = F.peekCode();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(() => {});
    const r = document.createRange(); r.selectNodeContents($('#lgCode'));
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    YJ && YJ.toast('凭证已复制 · 发给好友即可互相添加');
  };
  $('#lgNoticeChk').onchange = (e) => {
    set('qipai.loginHintOff', e.target.checked ? '1' : '0');
    $('#lgNotice').hidden = e.target.checked;
  };
  $('#lgGo').onclick = () => {
    const mode = $('.lg-mode.on').dataset.mode;
    const url = $('#lgServer').value.trim();
    F.setName($('#lgName').value);
    set('qipai.loginMode', mode);
    set('qipai.loginServer', url);
    set('qipai.entered', '1');
    if (mode === 'hall' && url) { YJ.settings.set('serverUrl', url); YJ.reconnect(); }
    else { YJ.settings.set('serverUrl', ''); YJ.reconnect(); }
    $('#login').hidden = true;
    showHall();
  };
}

function initLogin() {
  const registered = F.hasProfile();
  $('#register').hidden = registered;
  $('#login').hidden = true;
  if (!registered) { initRegister(); return; }
  F.startPresence && F.startPresence();
  bindLogin(false);
  // 已入局过且关过提示：下次直接进大厅（凭证与模式都还在本机）
  if (get('qipai.entered', '') === '1' && get('qipai.loginHintOff', '') === '1') {
    $('#login').hidden = true;
    showHall();
  }
}
function setMode(m) {
  $$('.lg-mode').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  const isHall = m === 'hall';
  $('#lgServerRow').hidden = !isHall;
  $('#lgServer').disabled = !isHall;
  $('#lgModeTag').textContent = isHall ? '连接棋馆（可选）' : '本地模式 · 可局域网联机';
}

/* ---------------- 大厅 ---------------- */
function showHall() {
  // 兜底：任何旧路径残留的 modal / 离线条都不许盖在大厅上
  if (YJ && YJ.closeModal) YJ.closeModal();
  const m = $('#modal'); if (m) { m.hidden = true; m.style.removeProperty('display'); }
  $('#offlineBar').hidden = true;
  $('#hall').hidden = false;
  $('#topbar').style.display = 'none';
  $('#screens').style.display = 'none';
  $('#nav').style.display = 'none';
  $$('.ht-tab').forEach(b => b.classList.toggle('on', b.dataset.id === 'hall'));
  renderHallTop(); renderFriends(); renderHallNote();
}
function showApp(screen) {
  $('#hall').hidden = true;
  $('#topbar').style.display = '';
  $('#screens').style.display = '';
  $('#nav').style.display = '';
  $$('.ht-tab').forEach(b => b.classList.toggle('on', b.dataset.id === screen));
  YJ && YJ.go(screen);
}
function goto(id) {
  if (id === 'hall') { showHall(); return; }
  if (id === 'guide') { showApp('settings'); YJ.openGuide(); return; }
  showApp(id);
}
function renderHallTop() {
  const mode = get('qipai.loginMode', 'local');
  $('#hallMode').textContent = mode === 'hall'
    ? '已连棋馆 · ' + (get('qipai.loginServer', '') || '局域网') : '本地模式 · 可局域网联机';
  $('#hallCode').textContent = (F.peekCode() || 'YJ-').slice(3);
  const c = cultivation();
  $('#hallRealm').textContent = c.name + ' · 第 ' + c.idx + ' 境';
  const bal = $('#shopBalance');
  $('#hallCoin').textContent = bal ? (bal.textContent || '0').trim() : '0';
}
function cultivation() {
  try {
    const d = JSON.parse(get('qipai.cultivation', '{}') || '{}');
    const names = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫', '飞升'];
    const idx = Math.max(1, Math.min(10, Number(d.realm || d.level || 1)));
    return { name: names[idx - 1], idx };
  } catch (e) { return { name: '炼气', idx: 1 }; }
}
function todayLine() {
  const s = (YJ && YJ.S.stats) || { plays: 0, wins: 0 };
  const d = new Date();
  const lunarish = (d.getMonth() + 1) + '月' + d.getDate() + '日';
  if (!s.plays) return lunarish + ' · 卷上尚无落子。先与隐士手谈一局，题记自会记下第一笔。';
  return lunarish + ' · 已对 ' + s.plays + ' 局，胜 ' + s.wins + ' 局。' +
    (s.wins >= s.plays / 2 ? '棋路渐稳，宜复盘一局。' : '胜负兵家常事，再开一枰。');
}
function renderHallNote() {
  const box = $('#hallNote');
  if (get('qipai.hallNoticeOff', '') === '1') { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<b>今日 · 题记</b>' + esc(todayLine()) +
    ' <button id="hallNoteOff" style="float:right;background:none;border:0;color:var(--shellSeal);cursor:pointer;font-size:11px">不再提示 ×</button>';
  const b = $('#hallNoteOff');
  if (b) b.onclick = (e) => { e.stopPropagation(); set('qipai.hallNoticeOff', '1'); box.hidden = true; };
  if (YJ && YJ.setTodayLine) YJ.setTodayLine(todayLine());
}

/* ---------------- 好友栏 ---------------- */
function renderFriends() {
  const box = $('#frList'); if (!box) return;
  const presence = YJ ? YJ.presenceCodes() : [];
  const mine = { code: F.peekCode(), name: F.myName() + '（我）' };
  const rows = [mine].concat(F.list());
  const realCount = F.list().length;
  box.innerHTML = rows.map(r => {
    const st = F.statusOf(r.code, presence);
    const ch = (r.name || '?').charAt(0);
    return '<div class="fr-item" title="' + esc(r.code) + '">' +
      '<span class="fr-av">' + esc(ch) + '</span>' +
      '<span class="fr-txt"><b>' + esc(r.name) + '</b><small><i class="fr-dot ' +
      (st.on ? 'on' : '') + '"></i>' + esc(st.text) + '</small></span></div>';
  }).join('') + (realCount === 0
    ? '<div class="fr-empty"><b>还没有好友</b>把你的凭证发给对方，或点下面「凭凭证加好友」填对方的凭证。</div>'
    : '<div class="fr-info"><b>在线怎么看</b>连上同一棋馆，或在同一局域网里开第二个窗口，才会亮起绿点；不连公网、不设账号服务器。</div>');
  $('#frTip').textContent = '凭证只存本机。连同一棋馆 / 局域网时才能看到对方在线，不连公网。';
}
function initFriends() {
  F.startPresence();
  $('#frToggle').onclick = () => {
    const h = $('#hall'); h.classList.toggle('collapsed');
    $('#frToggle').textContent = h.classList.contains('collapsed') ? '»' : '收起';
  };
  $('#frAdd').onclick = () => { $('#friendAdd').hidden = false; $('#faCode').value = ''; $('#faName').value = ''; $('#faCode').focus(); };
  $('#faCancel').onclick = () => $('#friendAdd').hidden = true;
  $('#faOk').onclick = () => {
    const r = F.add($('#faCode').value, $('#faName').value);
    YJ && YJ.toast(r.msg);
    if (r.ok) { $('#friendAdd').hidden = true; renderFriends(); }
  };
  setInterval(renderFriends, 8000);
}

/* ---------------- 「对弈」弹层（层级选择，不跳页） ---------------- */
function renderPicker() {
  const games = (YJ && YJ.games()) || [];
  const main = games.filter(g => MAIN_IDS.indexOf(g.id) >= 0);
  const rest = games.filter(g => MAIN_IDS.indexOf(g.id) < 0);
  const q = pickerQuery.trim().toLowerCase();
  const filt = (a) => a.filter(g => !q || (g.name + g.tag + g.desc + g.id).toLowerCase().includes(q));
  const m = filt(main), r = filt(rest);
  const card = (g) => '<button class="pp-card-item" data-id="' + esc(g.id) + '">' +
    '<i>对弈 · ' + g.min + '–' + g.max + ' 人</i><b>' + esc(g.name) + '</b>' +
    '<small>' + esc(g.desc || g.tag || '') + '</small></button>';
  let html = '<div class="pp-group" style="grid-column:1/-1;font-size:11px;letter-spacing:.14em;color:var(--shellInk2);margin:4px 0 2px">主推 · ' + m.length + ' 局</div>';
  html += m.map(card).join('') || '<div class="empty-guide" style="grid-column:1/-1">没有匹配的对弈</div>';
  if (pickerAll || q) {
    html += '<div class="pp-group" style="grid-column:1/-1;font-size:11px;letter-spacing:.14em;color:var(--shellInk2);margin:12px 0 2px">更多对弈 · ' + r.length + ' 局</div>';
    html += r.map(card).join('') || '<div class="empty-guide" style="grid-column:1/-1">没有匹配的对弈</div>';
  }
  $('#ppGrid').innerHTML = html;
  $('#ppMore').textContent = pickerAll ? '收起更多对弈' : ('更多对弈 · ' + rest.length + ' 局 ▾');
  $$('.pp-card-item').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    $('#playPicker').hidden = true;
    YJ.startGame(id);
    YJ.toast('已择「' + (games.find(g => g.id === id) || {}).name + '」· 隐士入席');
  });
}
function initPicker() {
  $('#hallPlay').onclick = () => {
    pickerAll = false; pickerQuery = ''; $('#ppSearch').value = '';
    renderPicker(); $('#playPicker').hidden = false;
  };
  $('#ppClose').onclick = () => $('#playPicker').hidden = true;
  $('#ppMore').onclick = () => { pickerAll = !pickerAll; renderPicker(); };
  $('#ppSearch').oninput = (e) => { pickerQuery = e.target.value; renderPicker(); };
  $('#playPicker').onclick = (e) => { if (e.target.id === 'playPicker') $('#playPicker').hidden = true; };
}

/* ---------------- 副按钮 / 入口 / tab ---------------- */
function initEntries() {
  $('#hallSetSeat').onclick = () => YJ.openCreate();
  $('#hallJoin').onclick = () => {
    YJ.modal('赴局 · 输入房间号', '<div class="field"><label>房间号（五字，不区分大小写）</label>' +
      '<input id="hjCode" maxlength="5" placeholder="例：AB3KD"></div>' +
      '<button class="btn primary" id="hjGo">赴局</button>' +
      '<div class="hint">本地模式下没有可赴的房间；点「对弈」即可与隐士开枰。</div>', null);
    $('#hjGo').onclick = () => {
      const c = ($('#hjCode').value || '').trim().toUpperCase();
      if (!c) { YJ.toast('请先填房间号'); return; }
      if (YJ.S.net && YJ.S.net.mode !== 'real') { YJ.closeModal(); YJ.toast('局域网内未找到其他玩家，请确认棋馆已启动'); return; }
      $('#roomCode').value = c; YJ.closeModal(); YJ.joinRoom();
    };
  };
  $('#hallEntries').innerHTML = ENTRIES.map(e =>
    '<button class="he-btn" data-id="' + e.id + '"><span class="he-ico">' + e.ico + '</span><span>' + e.name + '</span></button>').join('');
  $$('.he-btn').forEach(b => b.onclick = () => goto(b.dataset.id));
  $('#hallTabs').innerHTML = TABS.map(t =>
    '<button class="ht-tab' + (t.id === 'hall' ? ' on' : '') + '" data-id="' + t.id + '">' + t.name + '</button>').join('');
  $$('.ht-tab').forEach(b => b.onclick = () => goto(b.dataset.id));
  $('#hallGear').onclick = () => goto('settings');
  $('#backHall').onclick = () => goto('hall');
  $('#rhGo').onclick = () => $('#rotateHint').classList.add('dismissed');
}

/* ---------------- 与 app.js 的联动 ---------------- */
window.YJ_SHELL = {
  ready: false,
  onGo(name) {
    if (!this.ready) return;
    if (name === 'hall') showHall();
    else if ($('#hall') && !$('#hall').hidden) showApp(name);
  },
  init() {
    waitYJ(() => {
      YJ = window.YJ;
      initLogin(); initFriends(); initPicker(); initEntries();
      this.ready = true;
      if ($('#login').hidden && $('#register') && $('#register').hidden && $('#hall').hidden) showHall();
      renderHallTop(); renderHallNote();
    });
  }
};
window.YJ_SHELL.init();
