const KEY = 'qipai.settings.v2';

export const DEFAULTS = {
  quality:'均衡', dpr:1.5, fontScale:1, density:'适中', contrast:false, colorBlind:'关',
  fxMaster:true, fxLevel:55, fxCurtain:true, fxFinale:true, fxTrail:true, haptic:true, reduceSystem:true,
  soundMaster:true, volMaster:70, volMove:80, volAmbience:45, volUi:60,
  autoReady:false, quickPlay:true, confirmResign:true, confirmUndo:true,
  showHints:true, showLegal:true, showFoeCount:true, autoReplaySave:true,
  defaultBot:0, defaultClock:60, defaultTimeout:'auto', spectatorChat:false,
  autoReconnect:true, reconnectMs:3000, wifiOnly:true,
  externalDir:true, externalTime:true, externalBoards:true, offlineNotice:true,
  autoLogout:'30分', lockOnHide:true, clearOnExit:false, serverUrl:'',
  largeTap:false, longPressConfirm:false, oneHand:false, keepAwake:false,
  reduceFlash:true, screenReader:false
};
export const GROUPS = [
  { id:'display', name:'卷面 · 画面', icon:'◈', items:[
    { key:'quality', type:'select', name:'画质', options:['省电','均衡','精致','极致'], hint:'一并调分辨率、粒子、阴影与动画开销' },
    { key:'dpr', type:'range', name:'清晰倍率', min:1, max:2, step:.25, hint:'越低越省电，最高不超过设备本身' },
    { key:'fontScale', type:'range', name:'字大', min:.85, max:1.35, step:.05 },
    { key:'density', type:'select', name:'疏密', options:['舒朗','适中','紧凑'] },
    { key:'contrast', type:'toggle', name:'高对比', hint:'加深墨线与边框，弱光下更清楚' },
    { key:'colorBlind', type:'select', name:'色觉辅助', options:['关','红绿','蓝黄'], hint:'改棋子与花色的辅助色，不只靠颜色分辨' }
  ]},
  { id:'fx', name:'行云 · 动效', icon:'✦', items:[
    { key:'fxMaster', type:'toggle', name:'卷面华彩' },
    { key:'fxLevel', type:'range', name:'华彩浓淡', min:0, max:100, step:5 },
    { key:'fxCurtain', type:'toggle', name:'幕间绫带' },
    { key:'fxFinale', type:'toggle', name:'终局特效' },
    { key:'fxTrail', type:'toggle', name:'落子涟漪' },
    { key:'haptic', type:'toggle', name:'轻触反馈' },
    { key:'reduceSystem', type:'toggle', name:'随系统减动效' }
  ]},
  { id:'sound', name:'清音 · 声音', icon:'♫', items:[
    { key:'soundMaster', type:'toggle', name:'总声音' },
    { key:'volMaster', type:'range', name:'主音量', min:0, max:100, step:5 },
    { key:'volMove', type:'range', name:'落子 / 出牌', min:0, max:100, step:5 },
    { key:'volAmbience', type:'range', name:'氛围雨钟', min:0, max:100, step:5 },
    { key:'volUi', type:'range', name:'界面提示', min:0, max:100, step:5 }
  ]},
  { id:'play', name:'对局 · 习惯', icon:'⬡', items:[
    { key:'autoReady', type:'toggle', name:'入席自动整襟' },
    { key:'quickPlay', type:'toggle', name:'双击快捷出牌' },
    { key:'confirmResign', type:'toggle', name:'投子二次确认' },
    { key:'confirmUndo', type:'toggle', name:'乞复二次确认' },
    { key:'showHints', type:'toggle', name:'显示着手提示' },
    { key:'showLegal', type:'toggle', name:'标出可落之处' },
    { key:'showFoeCount', type:'toggle', name:'显示对手余牌数' },
    { key:'autoReplaySave', type:'toggle', name:'终局自动留谱' },
    { key:'defaultBot', type:'select', name:'隐士默认棋力', options:['随性','试探','进取','老成','谋势','精算','通玄','入微','忘机','弈圣'], values:[0,1,2,3,4,5,6,7,8,9] },
    { key:'defaultClock', type:'select', name:'默认更漏（秒）', options:[15,30,60,120,300], values:[15,30,60,120,300] },
    { key:'defaultTimeout', type:'select', name:'默认超时', options:['auto','skip','lose'] },
    { key:'spectatorChat', type:'toggle', name:'观席可闲谈' }
  ]},
  { id:'net', name:'联网 · 离线', icon:'◎', items:[
    { key:'autoReconnect', type:'toggle', name:'断线自动重连' },
    { key:'reconnectMs', type:'select', name:'重连间隔', options:[1000,3000,8000] },
    { key:'wifiOnly', type:'toggle', name:'仅无线网取外部名录', hint:'蜂窝网络下不取公共名录 / 校时 / 榜单' },
    { key:'externalDir', type:'toggle', name:'棋馆名录（可选）' },
    { key:'externalTime', type:'toggle', name:'赛季校时（可选）' },
    { key:'externalBoards', type:'toggle', name:'公共榜单（可选）' },
    { key:'offlineNotice', type:'toggle', name:'离线状态提示' },
    { key:'serverUrl', type:'text', name:'本机棋馆地址', hint:'本机跑棋馆填 127.0.0.1:5080 · 不需要外网' }
  ]},
  { id:'privacy', name:'案牍 · 隐私', icon:'▣', items:[
    { key:'autoLogout', type:'select', name:'自动离席', options:['从不','5分','30分','离页即'] },
    { key:'lockOnHide', type:'toggle', name:'切到后台即锁卷' },
    { key:'clearOnExit', type:'toggle', name:'离席清本机缓存' },
    { key:'clearCache', type:'action', name:'清除本机缓存', hint:'只清页面缓存与外观预览，不动加密存档' },
    { key:'clearLocalStats', type:'action', name:'清空本机战绩', hint:'清本馆本机榜，需再确认' },
    { key:'changePassword', type:'action', name:'更换口令', hint:'旧口令核验后重设，存档不丢' },
    { key:'deleteAccount', type:'action', name:'删除本馆账号', danger:true, hint:'连加密存档一并删去，不可复原' }
  ]},
  { id:'access', name:'辅佐 · 易用', icon:'✧', items:[
    { key:'largeTap', type:'toggle', name:'加大点按区' },
    { key:'longPressConfirm', type:'toggle', name:'长按才确认落子' },
    { key:'oneHand', type:'toggle', name:'单手握持', hint:'操作条沉到底部，竖屏更好按' },
    { key:'keepAwake', type:'toggle', name:'对局不暗屏', hint:'用系统唤醒锁，退出对局即放' },
    { key:'reduceFlash', type:'toggle', name:'减少明暗闪烁' },
    { key:'screenReader', type:'toggle', name:'读屏补充描述' }
  ]},
  { id:'about', name:'关于 · 声明', icon:'册', items:[
    { key:'notice', type:'action', name:'技术与合规声明' },
    { key:'license', type:'action', name:'源码公开 · 禁止商用' },
    { key:'diagnostics', type:'action', name:'本机诊断' }
  ]}
];
const QUALITY = {
  '省电':{ dpr:1, particle:.35, blur:0, anim:.45, shadow:.5 },
  '均衡':{ dpr:1.5, particle:.7, blur:2, anim:.8, shadow:.8 },
  '精致':{ dpr:2, particle:1, blur:4, anim:1, shadow:1 },
  '极致':{ dpr:2, particle:1.4, blur:6, anim:1.25, shadow:1.2 }
};
let state = null, subs = [], ver = 0;
function load() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
  return Object.assign({}, DEFAULTS, raw);
}
export const Settings = {
  get all() { if (!state) state = load(); return state; },
  get(k) { return this.all[k]; },
  set(k, v) { const s = Object.assign({}, this.all); s[k] = v; state = s;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    ver++; this.apply(); subs.forEach(f => f(k, v)); return v; },
  reset() { state = Object.assign({}, DEFAULTS);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    ver++; this.apply(); subs.forEach(f => f('*', null)); },
  subscribe(f) { subs.push(f); },
  get version() { return ver; },
  quality() { return QUALITY[this.get('quality')] || QUALITY['均衡']; },
  apply() {
    const s = this.all, q = this.quality();
    const r = document.documentElement.style, b = document.body;
    r.setProperty('--fontScale', String(s.fontScale));
    r.setProperty('--density', s.density === '舒朗' ? '1.25' : (s.density === '紧凑' ? '.78' : '1'));
    r.setProperty('--q-particle', String((s.fxMaster ? s.fxLevel / 100 : 0) * q.particle));
    r.setProperty('--q-blur', String(q.blur));
    r.setProperty('--q-anim', String(q.anim));
    r.setProperty('--q-shadow', String(q.shadow));
    r.setProperty('--q-dpr', String(Math.min(s.dpr, q.dpr)));
    r.setProperty('--motion', String((s.fxMaster ? s.fxLevel / 100 : 0) * q.anim * 1.7));
    b.classList.toggle('hi-contrast', !!s.contrast);
    b.classList.toggle('large-tap', !!s.largeTap);
    b.classList.toggle('one-hand', !!s.oneHand);
    b.classList.toggle('reduce-flash', !!s.reduceFlash);
    b.dataset.cb = s.colorBlind || '关';
    const sysReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    b.classList.toggle('fx-off', !s.fxMaster || s.fxLevel <= 0 || (s.reduceSystem && sysReduce));
    window.__YJ_SETTINGS__ = s; window.__YJ_QUALITY__ = q; window.__YJ_SETTINGS_VER__ = ver;
    if (window.Sound && window.Sound.profile) window.Sound.profile(s);
  }
};
