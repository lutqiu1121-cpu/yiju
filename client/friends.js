// 好友 · 凭证（纯本地，不上公网）
// 凭证由本机随机生成，不依赖任何服务器；在线状态只在「同一棋馆 / 局域网」内可见。
const KEY_CODE = 'qipai.friendCode';
const KEY_NAME = 'qipai.friendName';
const KEY_LIST = 'qipai.friends';
const KEY_AVATAR = 'qipai.avatar';
const KEY_REG = 'qipai.registered';

// 本机注册时挑的标记：纯 CSS 色块 + 一字，不引外部图片、不上传
export const AVATARS = [
  { id: 'mo',  bg: '#2b2a26', ch: '弈' },
  { id: 'zhu', bg: '#a3392b', ch: '朱' },
  { id: 'qing',bg: '#26302b', ch: '青' },
  { id: 'jin', bg: '#8a6a2f', ch: '金' },
  { id: 'zhu2',bg: '#4f5d3a', ch: '竹' },
  { id: 'zi',  bg: '#4b3a55', ch: '紫' },
];

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉 0/O/1/I 等易混字符
const $ = (s) => document.querySelector(s);
const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

function randomBlock(n) {
  const a = new Uint8Array(n);
  (window.crypto || {}).getRandomValues
    ? window.crypto.getRandomValues(a)
    : a.forEach((_, i) => a[i] = Math.floor(Math.random() * 256));
  return Array.from(a, x => ALPHABET[x % ALPHABET.length]).join('');
}

export function peekCode() {
  const c = read(KEY_CODE, null);
  return (c && /^YJ-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c)) ? c : '';
}

export function myCode() {
  const c = peekCode();
  if (c) return c;
  return issueCode();
}

// 注册完成那一刻才签发凭证：覆盖任何早期占位，保证「凭证由注册产生」
export function issueCode() {
  const c = 'YJ-' + randomBlock(4) + '-' + randomBlock(4) + '-' + randomBlock(4);
  write(KEY_CODE, c);
  return c;
}

export function hasProfile() {
  return read(KEY_REG, false) === true && !!peekCode();
}

export function myAvatar() {
  const a = read(KEY_AVATAR, null);
  return AVATARS.find(x => x.id === a) || AVATARS[0];
}
export function setAvatar(id) {
  const a = AVATARS.find(x => x.id === id) || AVATARS[0];
  write(KEY_AVATAR, a.id);
  return a;
}

export function createProfile(name, avatarId) {
  setName(name);
  setAvatar(avatarId);
  const code = issueCode();
  write(KEY_REG, true);
  return { name: myName(), avatar: myAvatar(), code };
}

export function myName() {
  const n = read(KEY_NAME, null);
  return (typeof n === 'string' && n.trim()) ? n.trim() : '本机棋客';
}
export function setName(n) {
  const v = String(n || '').trim().slice(0, 12) || '本机棋客';
  write(KEY_NAME, v);
  return v;
}

export function normalize(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').replace(/^YJ-?/, 'YJ-').trim();
}
export function validCode(code) {
  return /^YJ-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(normalize(code));
}

export function list() {
  const a = read(KEY_LIST, []);
  return Array.isArray(a) ? a.filter(x => x && x.code) : [];
}
export function add(code, name) {
  const c = normalize(code);
  if (!validCode(c)) return { ok: false, msg: '凭证格式不对 · 应形如 YJ-XXXX-XXXX-XXXX' };
  if (c === peekCode()) return { ok: false, msg: '这是你自己的凭证' };
  const arr = list();
  if (arr.some(x => x.code === c)) return { ok: false, msg: '这位已在好友名录里' };
  arr.push({ code: c, name: String(name || '').trim().slice(0, 12) || ('棋客 ' + c.slice(3, 7)) });
  write(KEY_LIST, arr);
  return { ok: true, msg: '已加入好友名录' };
}
export function remove(code) {
  write(KEY_LIST, list().filter(x => x.code !== normalize(code)));
}

// 在线来源：本机凭证 + 同棋馆 presence + 同源多标签 BroadcastChannel 心跳。
// 不连棋馆时好友一律显示「离线」，不会伪装在线。
const peers = new Map();
let chan = null, presenceStarted = false;
export function startPresence() {
  if (presenceStarted || !hasProfile()) return;   // 未注册不发心跳，也不提前占用凭证
  presenceStarted = true;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      chan = new BroadcastChannel('yiju-presence');
      chan.onmessage = (e) => {
        const d = e.data || {};
        if (d && d.code) peers.set(d.code, { name: d.name || '', at: Date.now() });
      };
    } catch (e) { chan = null; }
  }
  const beat = () => {
    const msg = { code: myCode(), name: myName(), at: Date.now() };
    peers.set(msg.code, msg);
    if (chan) { try { chan.postMessage(msg); } catch (e) {} }
  };
  beat();
  setInterval(beat, 6000);
}

export function statusOf(code, presenceCodes) {
  if (code === peekCode()) return { text: '本机 · 在线', on: true };
  const p = peers.get(code);
  if (p && Date.now() - (p.at || 0) < 20000) return { text: '同一局域网 · 在线', on: true };
  const set = presenceCodes || (window.YJ && window.YJ.presenceCodes ? window.YJ.presenceCodes() : []);
  if (set && set.indexOf(code) >= 0) return { text: '同馆 · 在线', on: true };
  return { text: '离线 · 未连同一棋馆', on: false };
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
