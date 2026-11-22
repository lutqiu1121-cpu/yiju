export const WEAR_KINDS = {"desk": "牌桌", "face": "牌面", "seal": "朱印", "ink": "墨色", "fx": "华彩", "frame": "卷框", "piece": "棋子", "trail": "落痕", "sound": "音色", "curtain": "幕帘", "badge": "衔牌"};
export const WEAR_SETS = {"竹窗": "竹窗 · 竹簟/澄心笺/清磬/淡墨", "金石": "金石 · 云石/乌金栏/螭钮印/玉振", "星汉": "星汉 · 星槎/蝉翼笺/星雨/星帷", "丹霞": "丹霞 · 洒金/薛涛笺/朱澜/朱线"};
export const WEAR_RARITY = {"常": "常品", "珍": "珍品", "秘": "秘藏", "逸": "逸格"};
export const WEAR = {
  "desk_bamboo": {"a": "#e7e2d2", "b": "#d8d0b6", "pat": "bamboo"},
  "desk_cloud": {"a": "#e9e8e4", "b": "#d5d9da", "pat": "cloud"},
  "desk_gold": {"a": "#2f2a22", "b": "#4a3c28", "pat": "gold"},
  "desk_celadon": {"a": "#dce9e2", "b": "#b9cfc6", "pat": "celadon"},
  "desk_kesi": {"a": "#efe4d2", "b": "#c9a97e", "pat": "kesi"},
  "desk_star": {"a": "#1d2430", "b": "#33405a", "pat": "star"},
  "face_cheng": {"bg": "#fbf8ef", "ink": "#2b2a26", "edge": "#d8cfb8"},
  "face_zhu": {"bg": "#fcf6ea", "ink": "#6c2f22", "edge": "#c98b6b"},
  "face_wu": {"bg": "#27251f", "ink": "#e8dcc0", "edge": "#8a7446"},
  "face_xue": {"bg": "#f8e6e0", "ink": "#7a3b3f", "edge": "#d7a9a0"},
  "face_huang": {"bg": "#eed9a6", "ink": "#4a3a1c", "edge": "#b99a58"},
  "face_chan": {"bg": "#eef3f2", "ink": "#2c3e42", "edge": "#9db9bb"},
  "seal_zhuan": {"shape": "square", "c": "#b4552d", "glow": ".18"},
  "seal_hulu": {"shape": "gourd", "c": "#a8472c", "glow": ".24"},
  "seal_chi": {"shape": "round", "c": "#9c3b2a", "glow": ".32"},
  "seal_wa": {"shape": "tile", "c": "#8d5a3b", "glow": ".22"},
  "seal_jiu": {"shape": "nine", "c": "#a02f22", "glow": ".40"},
  "ink_song": {"c": "#2b2a26", "soft": "#6d685c"},
  "ink_zhu": {"c": "#7a2f22", "soft": "#a8685a"},
  "ink_ni": {"c": "#5a4322", "soft": "#9b7b45"},
  "ink_dai": {"c": "#2b3b45", "soft": "#617783"},
  "ink_qi": {"c": "#1c1b18", "soft": "#4d4a42"},
  "fx_liuying": {"spark": "2.0", "trail": "1.6", "glow": ".18"},
  "fx_miaojin": {"gold": "1", "spark": "1.1", "glow": ".24"},
  "fx_zhulan": {"wave": "3", "spark": "1.2", "glow": ".30"},
  "fx_xingyu": {"star": "1", "spark": "2.4", "glow": ".36"},
  "fx_yuehua": {"moon": "1", "spark": "1.4", "glow": ".34"},
  "frame_su": {"c": "#d5cebc", "w": "1", "rad": "2"},
  "frame_hui": {"c": "#b4552d", "w": "1.5", "rad": "3"},
  "frame_yun": {"c": "#8d6a3f", "w": "2", "rad": "4"},
  "frame_zhi": {"c": "#7a3b3f", "w": "2.4", "rad": "6"},
  "piece_su": {"a": "#f3eee0", "b": "#4a463c", "rim": "#cdc4ad"},
  "piece_ma": {"a": "#c45a3e", "b": "#7a2f22", "rim": "#e0a486"},
  "piece_yu": {"a": "#8fb6a8", "b": "#2f5d57", "rim": "#cfe2d8"},
  "piece_jin": {"a": "#d8b45c", "b": "#6b4a1e", "rim": "#f0d99a"},
  "trail_dan": {"c": "#6d685c", "w": "1", "blur": "2"},
  "trail_fei": {"c": "#b4552d", "w": "1.6", "blur": "3"},
  "trail_zhu": {"c": "#a83c28", "w": "2", "blur": "4"},
  "trail_jin": {"c": "#c9a24a", "w": "2.4", "blur": "6"},
  "sound_qing": {"f": "1.00", "wave": "sine", "dur": "1.00"},
  "sound_song": {"f": "0.86", "wave": "triangle", "dur": "1.20"},
  "sound_yu": {"f": "1.22", "wave": "sine", "dur": "0.82"},
  "sound_shuang": {"f": "0.68", "wave": "sine", "dur": "1.60"},
  "curtain_su": {"c": "#2b2a26", "a": ".55", "speed": "1.00"},
  "curtain_xia": {"c": "#a8472c", "a": ".62", "speed": "1.25"},
  "curtain_xing": {"c": "#2a3a58", "a": ".70", "speed": "1.45"},
  "badge_mu": {"bg": "#e8ddc6", "c": "#5a4322", "edge": "#c2ad86"},
  "badge_tong": {"bg": "#d9b077", "c": "#4a3318", "edge": "#a87b3e"},
  "badge_yu": {"bg": "#d3e5dc", "c": "#2f5d57", "edge": "#8fb6a8"},
};
export const WEAR_LIST = [{"key": "desk_bamboo", "kind": "desk", "name": "竹簟", "cost": 80, "note": "牌桌 · 细竹横纹", "rarity": "常", "set": "竹窗"}, {"key": "desk_cloud", "kind": "desk", "name": "云石", "cost": 160, "note": "牌桌 · 淡云石纹", "rarity": "珍", "set": "金石"}, {"key": "desk_gold", "kind": "desk", "name": "洒金", "cost": 260, "note": "牌桌 · 暗底洒金", "rarity": "秘", "set": "丹霞"}, {"key": "desk_celadon", "kind": "desk", "name": "青瓷", "cost": 220, "note": "牌桌 · 雨过天青", "rarity": "珍", "set": "—"}, {"key": "desk_kesi", "kind": "desk", "name": "缂丝", "cost": 340, "note": "牌桌 · 织金界纹", "rarity": "逸", "set": "—"}, {"key": "desk_star", "kind": "desk", "name": "星槎", "cost": 420, "note": "牌桌 · 夜航星河", "rarity": "逸", "set": "星汉"}, {"key": "face_cheng", "kind": "face", "name": "澄心笺", "cost": 90, "note": "牌面 · 澄心薄笺", "rarity": "常", "set": "竹窗"}, {"key": "face_zhu", "kind": "face", "name": "朱丝栏", "cost": 180, "note": "牌面 · 朱丝界栏", "rarity": "珍", "set": "—"}, {"key": "face_wu", "kind": "face", "name": "乌金栏", "cost": 280, "note": "牌面 · 乌金细栏", "rarity": "秘", "set": "金石"}, {"key": "face_xue", "kind": "face", "name": "薛涛笺", "cost": 200, "note": "牌面 · 桃色小笺", "rarity": "珍", "set": "丹霞"}, {"key": "face_huang", "kind": "face", "name": "硬黄纸", "cost": 320, "note": "牌面 · 染黄蜡笺", "rarity": "秘", "set": "—"}, {"key": "face_chan", "kind": "face", "name": "蝉翼笺", "cost": 400, "note": "牌面 · 轻透如翼", "rarity": "逸", "set": "星汉"}, {"key": "seal_zhuan", "kind": "seal", "name": "小篆印", "cost": 70, "note": "朱印 · 小篆方印", "rarity": "常", "set": "—"}, {"key": "seal_hulu", "kind": "seal", "name": "葫芦印", "cost": 150, "note": "朱印 · 葫芦形", "rarity": "珍", "set": "—"}, {"key": "seal_chi", "kind": "seal", "name": "螭钮印", "cost": 240, "note": "朱印 · 螭钮圆印", "rarity": "秘", "set": "金石"}, {"key": "seal_wa", "kind": "seal", "name": "瓦当印", "cost": 190, "note": "朱印 · 瓦当纹", "rarity": "珍", "set": "—"}, {"key": "seal_jiu", "kind": "seal", "name": "九叠印", "cost": 330, "note": "朱印 · 九叠篆", "rarity": "秘", "set": "—"}, {"key": "ink_song", "kind": "ink", "name": "松烟", "cost": 60, "note": "墨色 · 松烟青", "rarity": "常", "set": "—"}, {"key": "ink_zhu", "kind": "ink", "name": "朱墨", "cost": 140, "note": "墨色 · 朱砂沉", "rarity": "珍", "set": "—"}, {"key": "ink_ni", "kind": "ink", "name": "泥金", "cost": 230, "note": "墨色 · 泥金褐", "rarity": "秘", "set": "—"}, {"key": "ink_dai", "kind": "ink", "name": "青黛", "cost": 180, "note": "墨色 · 青黛远山", "rarity": "珍", "set": "—"}, {"key": "ink_qi", "kind": "ink", "name": "漆烟", "cost": 300, "note": "墨色 · 漆光乌亮", "rarity": "秘", "set": "—"}, {"key": "fx_liuying", "kind": "fx", "name": "流萤", "cost": 120, "note": "华彩 · 落子萤火加倍", "rarity": "珍", "set": "—"}, {"key": "fx_miaojin", "kind": "fx", "name": "描金", "cost": 200, "note": "华彩 · 落点四向金线", "rarity": "珍", "set": "—"}, {"key": "fx_zhulan", "kind": "fx", "name": "朱澜", "cost": 300, "note": "华彩 · 终局三叠朱浪", "rarity": "秘", "set": "丹霞"}, {"key": "fx_xingyu", "kind": "fx", "name": "星雨", "cost": 420, "note": "华彩 · 终局星雨", "rarity": "逸", "set": "星汉"}, {"key": "fx_yuehua", "kind": "fx", "name": "月华", "cost": 360, "note": "华彩 · 幕间月华渐晕", "rarity": "逸", "set": "—"}, {"key": "frame_su", "kind": "frame", "name": "素边", "cost": 60, "note": "卷框 · 一线素框", "rarity": "常", "set": "—"}, {"key": "frame_hui", "kind": "frame", "name": "回纹", "cost": 140, "note": "卷框 · 双线回纹", "rarity": "珍", "set": "—"}, {"key": "frame_yun", "kind": "frame", "name": "云雷", "cost": 220, "note": "卷框 · 云雷暗纹", "rarity": "珍", "set": "—"}, {"key": "frame_zhi", "kind": "frame", "name": "缠枝", "cost": 320, "note": "卷框 · 缠枝绕边", "rarity": "秘", "set": "—"}, {"key": "piece_su", "kind": "piece", "name": "素子", "cost": 70, "note": "棋子 · 素木圆子", "rarity": "常", "set": "—"}, {"key": "piece_ma", "kind": "piece", "name": "玛瑙", "cost": 160, "note": "棋子 · 玛瑙赤纹", "rarity": "珍", "set": "—"}, {"key": "piece_yu", "kind": "piece", "name": "青玉", "cost": 260, "note": "棋子 · 青玉温润", "rarity": "秘", "set": "—"}, {"key": "piece_jin", "kind": "piece", "name": "鎏金", "cost": 360, "note": "棋子 · 鎏金错边", "rarity": "逸", "set": "—"}, {"key": "trail_dan", "kind": "trail", "name": "淡墨", "cost": 60, "note": "落痕 · 落痕淡墨", "rarity": "常", "set": "竹窗"}, {"key": "trail_fei", "kind": "trail", "name": "飞白", "cost": 140, "note": "落痕 · 飞白笔意", "rarity": "珍", "set": "—"}, {"key": "trail_zhu", "kind": "trail", "name": "朱线", "cost": 220, "note": "落痕 · 朱砂细线", "rarity": "珍", "set": "丹霞"}, {"key": "trail_jin", "kind": "trail", "name": "金鳞", "cost": 320, "note": "落痕 · 金鳞碎光", "rarity": "秘", "set": "—"}, {"key": "sound_qing", "kind": "sound", "name": "清磬", "cost": 60, "note": "音色 · 清磬一声", "rarity": "常", "set": "竹窗"}, {"key": "sound_song", "kind": "sound", "name": "松风", "cost": 140, "note": "音色 · 松风低回", "rarity": "珍", "set": "—"}, {"key": "sound_yu", "kind": "sound", "name": "玉振", "cost": 220, "note": "音色 · 玉振清越", "rarity": "珍", "set": "金石"}, {"key": "sound_shuang", "kind": "sound", "name": "霜钟", "cost": 300, "note": "音色 · 霜钟沉远", "rarity": "秘", "set": "—"}, {"key": "curtain_su", "kind": "curtain", "name": "素幕", "cost": 80, "note": "幕帘 · 素幕轻落", "rarity": "常", "set": "—"}, {"key": "curtain_xia", "kind": "curtain", "name": "霞帔", "cost": 200, "note": "幕帘 · 霞帔渐染", "rarity": "珍", "set": "—"}, {"key": "curtain_xing", "kind": "curtain", "name": "星帷", "cost": 340, "note": "幕帘 · 星帷垂光", "rarity": "逸", "set": "星汉"}, {"key": "badge_mu", "kind": "badge", "name": "木牌", "cost": 70, "note": "衔牌 · 木衔牌", "rarity": "常", "set": "—"}, {"key": "badge_tong", "kind": "badge", "name": "铜牌", "cost": 180, "note": "衔牌 · 铜衔牌", "rarity": "珍", "set": "—"}, {"key": "badge_yu", "kind": "badge", "name": "玉牌", "cost": 300, "note": "衔牌 · 玉衔牌", "rarity": "秘", "set": "—"}];

export function wearParams(worn) {
  const out = {};
  for (const k of Object.keys(worn || {})) {
    const key = worn[k];
    if (key && WEAR[key]) out[k] = { key, p: WEAR[key] };
  }
  return out;
}
const DESK_PAT = {
  bamboo: 'repeating-linear-gradient(90deg,rgba(120,140,95,.14) 0 2px,transparent 2px 12px)',
  cloud: 'radial-gradient(circle at 30% 30%,rgba(90,110,130,.18),transparent 60%),radial-gradient(circle at 72% 68%,rgba(90,110,130,.12),transparent 55%)',
  gold: 'repeating-linear-gradient(45deg,rgba(190,150,60,.12) 0 3px,transparent 3px 9px)',
  celadon: 'radial-gradient(circle at 50% 18%,rgba(255,255,255,.40),transparent 62%)',
  kesi: 'repeating-linear-gradient(0deg,rgba(160,120,70,.10) 0 1px,transparent 1px 8px),repeating-linear-gradient(90deg,rgba(160,120,70,.10) 0 1px,transparent 1px 8px)',
  star: 'radial-gradient(circle at 20% 28%,rgba(255,255,255,.28) 0 1px,transparent 2px),radial-gradient(circle at 68% 72%,rgba(255,255,255,.22) 0 1px,transparent 2px)'
};
let lastWearVars = [];
export function applyWear(worn) {
  const r = document.documentElement.style, body = document.body;
  lastWearVars.forEach(k => r.removeProperty(k)); lastWearVars = [];
  const active = wearParams(worn);
  for (const k of Object.keys(WEAR_KINDS)) {
    const a = active[k];
    body.dataset[k] = a ? a.key : '';
    if (!a) continue;
    for (const pk of Object.keys(a.p)) {
      const n = '--wear-' + k + '-' + pk;
      r.setProperty(n, String(a.p[pk])); lastWearVars.push(n);
    }
  }
  const d = active.desk;
  if (d) {
    r.setProperty('--desk-img', 'linear-gradient(135deg,' + d.p.a + ',' + d.p.b + '), ' + (DESK_PAT[d.p.pat] || 'none'));
    lastWearVars.push('--desk-img');
  }
  window.__YJ_WEAR__ = active;
  if (window.Sound && window.Sound.profile && window.__YJ_SETTINGS__) window.Sound.profile(window.__YJ_SETTINGS__);
  return active;
}
