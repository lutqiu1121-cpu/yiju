/* 离线本机棋馆 · 与 Net 同接口的本地代理
 * 断线/无服务端时由它接管：bot 补满、真实规则推进、终局写回本机战绩。
 * 不碰 rules/、manifest、wear.json、存档既有字段、verify.py 断言。
 */
import { Net } from './net.js';
import { PortedRule, PortedGame, PORTED_IDS } from './rules-port/registry.js';

const MAIN = ['yijuan', 'gomoku', 'xiangqi', 'chess', 'doudizhu', 'chudadi'];
const NAMES = { yijuan:'弈卷', gomoku:'五连局', xiangqi:'楚汉棋', chess:'番象棋', doudizhu:'夺帅局', chudadi:'压牌帖' };
const WORDS = ['山', '水', '云', '月', '风'];
const ROLES = ['墨翟','公输般','扁鹊','李冰','荀况','韩非','司马迁','班昭','张衡','蔡邕','华佗','马钧','裴秀','祖冲之','郦道元','贾思勰','孙思邈','李淳风','一行','沈括','毕昇','苏颂','李诫','宋慈','郭守敬','黄道婆','朱载堉','徐光启','宋应星','徐霞客','顾炎武','王夫之','黄宗羲','戴震','阮元','李时珍','吴又可','叶桂','王清任','燕肃','赵友钦','王祯','秦九韶','李冶','杨辉','朱世杰','程大位','贾宪'];
const APP_HOST = typeof location !== 'undefined' && location.hostname === 'yiju.local';

const rint = (s, n) => {
  if (n <= 0) return 0;
  // xorshift32：全程 32 位整数，避免 JS double 在 2^53 以上丢精度
  let x = s.r2 >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;  x >>>= 0;
  s.r2 = x >>> 0;
  return (x >>> 0) % n;
};
const seatOrder = s => s.round % 2 === 0 ? [0, 1] : [1, 0];
const note = (s, t) => { s.note = t; s.last = t; };

function goalOf(id, variant) {
  const base = id === 'houlou' ? 8 : (id === 'shiyi' ? 2 : (id === 'yijuan' ? 5 : 3));
  if (variant === '短局' || variant === '短卷') return Math.max(2, base - 1);
  if (variant === '长局' || variant === '长卷') return base + 2;
  return base;
}

function labels(s) {
  switch (s.id) {
    case 'houlou': return ['一滴', '两滴', '三滴'];
    case 'duzhou': return ['划头舟', '划中舟', '划尾舟', '缆彼最前舟'];
    case 'dengying': return ['照一', '照二', '照三', '照四', '照五', '照六', '移影'];
    case 'huiwen': return ['第一列', '第二列', '第三列', '第四列'];
    case 'cuojin': return ['一段', '二段', '三段', '四段', '五段', '六段', '七段', '八段', '剪金'];
    case 'shiyi': return s.piles.map(v => v > 0 ? '取 ' + v : '空堆');
    case 'tingyu': return ['一雨', '二雨', '三雨', '四雨', '五雨', '六雨'];
    case 'yijuan': return s.handLabels;
  }
  return ['落'];
}
function codeCount(s) {
  switch (s.id) {
    case 'houlou': return 3; case 'duzhou': return 4; case 'dengying': return 7;
    case 'huiwen': return 4; case 'cuojin': return 9; case 'shiyi': return s.piles.length;
    case 'tingyu': return 6; case 'yijuan': return s.handLabels.length;
  }
  return 3;
}
function banned(s, k) {
  if (s.id === 'houlou' && s.ban === k + 1) return true;
  if (s.id === 'tingyu' && s.banNum === k + 1) return true;
  return false;
}
function legal(s, seat) {
  if (s.generic) return legalGeneric(s, seat);
  const a = [];
  if (s.ended || seat < 0 || seat >= s.seats) return a;
  if (s.id === 'shiyi') {
    if (s.turn !== seat) return a;
    s.piles.forEach((v, i) => { if (v > 0) a.push('c:' + i); });
    return a;
  }
  if (s.cover[seat] !== '') return a;
  for (let i = 0; i < codeCount(s); i++) {
    if (banned(s, i)) continue;
    if (s.id === 'dengying' && i === 6 && s.moves[seat] <= 0) continue;
    if (s.id === 'cuojin' && i === 8 && s.cut[seat] <= 0) continue;
    a.push('c:' + i);
  }
  return a;
}

function build(id, variant) {
  const s = {
    id, variant, seats: 2, turn: 0, round: 0, seq: 1, moveNo: 0,
    goal: goalOf(id, variant), score: [0, 0], cover: ['', ''],
    ban: -1, banNum: -1, lastSame: 0, lastPick: [-1, -1], lastScorer: -1,
    adv: [0, 0], r2: ((Date.now() ^ 0x5f3759df) >>> 0) || 0x9e3779b9,
    ended: false, winner: '', result: '', note: '两席各覆一手，同时启看', last: '',
    cells: [''], w: 1, h: 1, log: []
  };
  switch (id) {
    case 'duzhou':
      s.boats = [0,0,0,0,0,0]; s.boatGoal = 3; s.rope = [5,5]; s.block = [0,0,0,0,0,0];
      note(s, '三舟待发 · 可划可缆，先全渡者执桨'); break;
    case 'dengying': {
      s.lamps = []; s.lit = [0,0]; s.moves = [2,2]; s.tried = ['',''];
      for (let p = 0; p < 2; p++) {
        const pool = [0,1,2,3,4,5];
        for (let k = pool.length - 1; k > 0; k--) { const j = rint(s, k+1); const t = pool[k]; pool[k] = pool[j]; pool[j] = t; }
        for (let k = 0; k < 3; k++) s.lamps.push(pool[k]);
      }
      note(s, '各藏三灯于六格 · 照行照列，先照尽彼灯者胜'); break;
    }
    case 'huiwen':
      s.cols = [0,0,0,0,0,0,0,0]; s.word = WORDS[0]; s.cells = new Array(16).fill(''); s.w = 4; s.h = 4;
      note(s, '同字列上叠笺 · 首尾相衔成回文，先得三笺者胜'); break;
    case 'cuojin':
      s.cut = [2,2]; s.ring = new Array(8).fill(''); s.cells = s.ring; s.w = 8; s.h = 1;
      note(s, '八段金丝绕环 · 三连同色得金，可剪断彼金'); break;
    case 'shiyi':
      s.piles = []; for (let i = 0; i < 21; i++) s.piles.push(1 + rint(s, 9));
      s.tmp = ['', '']; s.turn = rint(s, 2); s.cells = new Array(12).fill(''); s.w = 12; s.h = 1;
      note(s, '公共数堆取遗 · 暂记三数成等差即得笺'); break;
    case 'tingyu': note(s, '各暗择雨数 · 唯一最小者听雨得分，重者两湿'); break;
    case 'houlou': note(s, '同刻各候、大刻先至、小刻反先 · 先入夜者胜'); break;
    case 'yijuan': {
      s.deck = ROLES.slice(); s.handLabels = []; s.handYear = [];
      for (let k = 0; k < 6; k++) {
        const i = rint(s, s.deck.length), nm = s.deck.splice(i, 1)[0], yr = 1 + rint(s, 9);
        s.handLabels.push(nm + ' · ' + yr + ' 序');
        s.handYear.push(yr);
      }
      note(s, '两卷夹一线 · 各覆一简，年序小者推界墨'); break;
    }
  }
  return s;
}

function revealHoulou(s, p) {
  const a = p[0]+1, b = p[1]+1, sc = s.score; let t;
  if (a === b) {
    sc[0]++; sc[1]++;
    s.lastSame = a === s.lastSame ? 2 : 1;
    t = '同刻 ' + a + ' 滴 · 各候一格';
  } else if (Math.abs(a-b) === 1) {
    const w = a > b ? 0 : 1; sc[w] += 2; s.lastSame = 0;
    t = '大刻先至 · ' + (w === 0 ? '甲' : '乙') + ' 进二格';
  } else {
    const w = a < b ? 0 : 1; sc[w] += 2; s.lastSame = 0;
    t = '小刻反先 · ' + (w === 0 ? '甲' : '乙') + ' 进二格';
  }
  let ban = -1;
  if (a === b && s.lastSame >= 2) { ban = a; s.lastSame = 0; t += ' · 下巡禁同刻'; }
  s.ban = ban; note(s, t);
}
function revealDuzhou(s, p) {
  const b = s.boats, g = s.boatGoal, sc = s.score, rope = s.rope, block = s.block, adv = s.adv;
  let t = ''; adv[0] = 0; adv[1] = 0;
  const bothRope = p[0] === 3 && p[1] === 3;
  if (bothRope) {
    for (let seat = 0; seat < 2; seat++) {
      let bi = 0, bv = 99;
      for (let k = 0; k < 3; k++) if (b[seat*3+k] < bv) { bv = b[seat*3+k]; bi = k; }
      if (b[seat*3+bi] < g) b[seat*3+bi]++;
      t += (seat === 0 ? '甲' : '乙') + '缆落空，各补一舟 ';
    }
  } else for (const seat of seatOrder(s)) {
    const k = p[seat];
    if (k < 3) {
      const idx = seat*3+k;
      if (block[idx] > 0) { block[idx]--; t += (seat === 0 ? '甲' : '乙') + '舟被缆住 '; }
      else if (b[idx] < g) { b[idx]++; adv[seat]++; t += (seat === 0 ? '甲' : '乙') + '划' + (k+1) + '舟 '; }
    } else {
      const foe = 1-seat; let bi = foe*3, bv = -1;
      for (let q = 0; q < 3; q++) if (b[foe*3+q] > bv) { bv = b[foe*3+q]; bi = foe*3+q; }
      if (rope[seat] > 0) { rope[seat]--; block[bi] = 1; t += (seat === 0 ? '甲' : '乙') + '缆彼最前舟一巡 '; }
      else { if (b[seat*3] < g) b[seat*3]++; t += (seat === 0 ? '甲' : '乙') + '缆尽，改划 '; }
    }
  }
  for (let seat = 0; seat < 2; seat++) {
    let all = true; for (let k = 0; k < 3; k++) if (b[seat*3+k] < g) all = false;
    if (all) { sc[seat] = s.goal; t += (seat === 0 ? '甲' : '乙') + '三舟尽渡 '; }
  }
  note(s, t.trim());
}
function revealDengying(s, p) {
  const lamps = s.lamps, lit = s.lit, moves = s.moves, tried = s.tried, sc = s.score;
  let t = '';
  for (const seat of seatOrder(s)) {
    const k = p[seat], foe = 1-seat;
    if (k === 6) {
      moves[seat]--;
      for (let q = 0; q < 3; q++) {
        const cur = lamps[seat*3+q]; if (cur < 0) continue;
        const nv = cur + 1 <= 5 ? cur + 1 : cur - 1;
        if (![0,1,2].some(z => lamps[seat*3+z] === nv)) { lamps[seat*3+q] = nv; t += (seat === 0 ? '甲' : '乙') + '移影 '; break; }
      }
    } else {
      const key = String(k);
      if (tried[seat].indexOf('[' + key + ']') < 0) tried[seat] += '[' + key + ']';
      for (let q = 0; q < 3; q++) {
        if (lamps[foe*3+q] === k && lamps[foe*3+q] >= 0) {
          lamps[foe*3+q] = -1-k; lit[seat]++; s.lastScorer = seat;
          t += (seat === 0 ? '甲' : '乙') + '照中彼灯 '; break;
        }
      }
    }
    if (lit[seat] >= 3) { sc[seat] = s.goal; t += (seat === 0 ? '甲' : '乙') + '照尽彼灯 '; }
  }
  note(s, t.trim() || '两照皆空，灯影未动');
}
function makesHuiwen(cells, idx, me) {
  const x = idx % 4, y = Math.floor(idx / 4);
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const d of dirs) for (let st = -2; st <= 0; st++) {
    const q = []; let ok = true;
    for (let k = 0; k < 3; k++) {
      const xx = x + (st+k)*d[0], yy = y + (st+k)*d[1];
      if (xx < 0 || xx > 3 || yy < 0 || yy > 3) { ok = false; break; }
      q.push(yy*4+xx);
    }
    if (!ok || q.indexOf(idx) < 0) continue;
    if (cells[q[0]] && cells[q[0]][0] === me && cells[q[1]] && cells[q[2]] && cells[q[2]][0] === me) return true;
  }
  return false;
}
function revealHuiwen(s, p) {
  const cells = s.cells, cols = s.cols, sc = s.score;
  const w = WORDS[s.round % WORDS.length]; s.word = w;
  let t = '本巡字「' + w + '」 · ';
  if (p[0] === p[1]) {
    const col = p[0], idxR = 12+col, idxB = col;
    if (!cells[idxR]) cells[idxR] = 'x';
    if (!cells[idxB]) cells[idxB] = 'x';
    t += '两席争第 ' + (col+1) + ' 列，列封'; note(s, t); return;
  }
  for (const seat of seatOrder(s)) {
    const col = p[seat];
    const row = seat === 0 ? 3 - cols[col] : cols[4+col];
    const idx = row*4+col;
    if (row < 0 || row > 3 || cells[idx]) { t += (seat === 0 ? '甲' : '乙') + '列满 '; continue; }
    cells[idx] = (seat === 0 ? 'r' : 'b') + w;
    if (seat === 0) cols[col]++; else cols[4+col]++;
    if (makesHuiwen(cells, idx, seat === 0 ? 'r' : 'b')) {
      sc[seat]++; s.lastScorer = seat; t += (seat === 0 ? '甲' : '乙') + '成回文得笺 ';
    } else t += (seat === 0 ? '甲' : '乙') + '落第' + (col+1) + '列 ';
  }
  note(s, t.trim());
}
function revealCuojin(s, p) {
  const ring = s.ring, cut = s.cut, sc = s.score;
  let t = ''; const cutUsed = [false, false];
  for (let seat = 0; seat < 2; seat++) if (p[seat] === 8) { cut[seat]--; cutUsed[seat] = true; }
  for (let seat = 0; seat < 2; seat++) if (cutUsed[seat]) {
    for (let q = 7; q >= 0; q--) if (ring[q] === (seat === 0 ? 'b' : 'r')) { ring[q] = ''; t += (seat === 0 ? '甲' : '乙') + '剪断一段 '; break; }
  }
  if (p[0] === p[1] && p[0] < 8 && !cutUsed[0] && !cutUsed[1]) {
    if (!ring[p[0]]) ring[p[0]] = 'x';
    t += '两席争第 ' + (p[0]+1) + ' 段，成错';
  } else {
    for (let seat = 0; seat < 2; seat++) { const k = p[seat]; if (k >= 8 || cutUsed[seat]) continue; if (!ring[k]) ring[k] = seat === 0 ? 'r' : 'b'; }
  }
  for (const seat of seatOrder(s)) {
    const me = seat === 0 ? 'r' : 'b';
    for (let q = 0; q < 8; q++) if (ring[q] === me && ring[(q+1)%8] === me && ring[(q+2)%8] === me) {
      sc[seat]++; s.lastScorer = seat; ring[q] = ring[(q+1)%8] = ring[(q+2)%8] = '';
      t += (seat === 0 ? '甲' : '乙') + '三连得金 '; break;
    }
  }
  note(s, t.trim() || '金丝未连，静候下巡');
}
function revealTingyu(s, p) {
  const sc = s.score, n = s.seats, cnt = new Array(7).fill(0);
  for (let i = 0; i < n; i++) cnt[p[i]+1]++;
  let min = 7; for (let k = 1; k <= 6; k++) if (cnt[k] > 0 && k < min) min = k;
  let t = '揭雨 · ';
  for (let i = 0; i < n; i++) t += (i === 0 ? '甲' : i === 1 ? '乙' : '丙') + ' ' + (p[i]+1) + ' ';
  if (min <= 6 && cnt[min] === 1) {
    let winner = -1;
    for (let i = 0; i < n; i++) if (p[i]+1 === min) { winner = i; sc[i]++; break; }
    t += '· 唯一最小 ' + min + '，第 ' + (winner+1) + ' 席听雨';
    s.lastScorer = winner; s.banNum = -1;
  } else if (min <= 6) {
    t += '· ' + min + ' 雨重者两湿，下巡禁择'; s.banNum = min;
  } else { t += '· 满盘皆湿，本巡无分'; s.banNum = -1; }
  note(s, t.trim());
}
function revealYijuan(s, p) {
  const a = s.handYear[p[0]], b = s.handYear[p[1]], sc = s.score;
  let t = '启简 · ' + s.handLabels[p[0]] + ' 对 ' + s.handLabels[p[1]] + ' · ';
  if (a === b) { t += '年序相冲，各守一线'; }
  else { const w = a < b ? 0 : 1; sc[w]++; s.lastScorer = w; t += '年序小者推界墨，第 ' + (w+1) + ' 席得笺'; }
  note(s, t);
}
function actShiyi(s, seat, k) {
  const piles = s.piles, tmp = s.tmp, sc = s.score;
  const v = piles[k]; piles[k] = 0;
  let my = (tmp[seat] || '').split(',').filter(x => x !== '').map(Number);
  my.push(v);
  let t = '第 ' + (seat+1) + ' 席取 ' + v, got = false;
  for (let a = 0; a < my.length && !got; a++) for (let b = a+1; b < my.length && !got; b++) for (let c = b+1; c < my.length && !got; c++) {
    const tri = [my[a], my[b], my[c]].sort((x,y) => x-y);
    if (tri[1]-tri[0] === tri[2]-tri[1]) {
      sc[seat]++; s.lastScorer = seat; got = true;
      my.splice(c,1); my.splice(b,1); my.splice(a,1);
      t += ' · ' + tri.join(',') + ' 成等差得笺';
    }
  }
  if (my.length > 5) my = my.slice(-5);
  tmp[seat] = my.join(','); note(s, t);
  s.round++; s.moveNo = s.round; s.turn = (seat+1) % s.seats;
  checkEnd(s);
}

function checkEnd(s) {
  const sc = s.score; let mx = -1; const top = [];
  for (let i = 0; i < sc.length; i++) if (sc[i] > mx) mx = sc[i];
  for (let i = 0; i < sc.length; i++) if (sc[i] === mx) top.push(i);
  let reached = mx >= s.goal, cap = s.round >= 40, full = false;
  if (s.id === 'huiwen' || s.id === 'cuojin') full = s.cells.every(c => !!c);
  if (s.id === 'shiyi') full = s.piles.every(v => v <= 0);
  if (s.id === 'duzhou') full = s.boats.every(v => v >= s.boatGoal);
  if (!reached && !cap && !full) return;
  let w;
  if (top.length === 1) w = top[0];
  else w = s.lastScorer >= 0 ? s.lastScorer : -1;
  finish(s, w, NAMES[s.id] + ' · ' + (w < 0 ? '同分，言和' : '第 ' + (w+1) + ' 席执卷（' + mx + '）'));
}
function finish(s, w, result) {
  s.ended = true; s.winner = w < 0 ? '' : String(w); s.result = result;
  s.log.push(result); note(s, result);
}


/* ---- 未开放规则实现保留存档，玩法册只开 6 局 ----
 * 联机时走服务端完整规则；离线时按该局真实的人数 / 棋盘规格 / 名称开局，
 * 由隐士轮流应手，可落子、可过手、可走到终局并写回战绩。
 * 专精后 6 局断网都能按服务端原规则开枰到终局，不弹「需连棋馆」。
 */
const BOARD_SIZE = {
  xiangqi:[9,10], jieqi:[9,10], xiangqidark:[9,10], chess:[8,8], chess960:[8,8],
  shogi:[9,9], go:[9,9], gomoku:[15,15], renju:[15,15], connect6:[19,19],
  connect4:[7,6], othello:[8,8], checkers:[8,8], mills:[7,7], tiaogi:[5,5],
  dots:[6,6], hex:[7,7], nim:[5,1], endgame:[5,5], diefeng:[9,9]
};
function buildGeneric(id, variant, g) {
  const size = BOARD_SIZE[id] || [8, 8];
  const w = size[0], h = size[1];
  const maxMoves = Math.min(28, Math.max(12, w * h));
  return {
    generic: true, id, variant, name: ((g && g.name) || id) + ' · 规则待搬',
    seats: 2, turn: 0, round: 0, seq: 1, moveNo: 0,
    w, h, cells: new Array(w * h).fill(''),
    score: [0, 0], maxMoves,
    ended: false, winner: '', result: '', note: '本机简式 · 与隐士轮流落子（完整规则待搬）',
    last: '', log: [], hand: [], info: {},
    cover: ['', ''], goal: 3, r2: ((Date.now() ^ 0x85ebca6b) >>> 0) || 0x27d4eb2f
  };
}
function legalGeneric(s, seat) {
  if (s.ended || seat !== s.turn) return [];
  const a = [];
  for (let i = 0; i < s.cells.length; i++) if (!s.cells[i]) a.push('c:' + i);
  a.push('pass');
  return a.length > 48 ? a.slice(0, 48) : a;   // 大棋盘别一次亮满屏
}
function applyGeneric(s, seat, code) {
  if (legalGeneric(s, seat).indexOf(code) < 0) return false;
  if (code === 'pass') {
    note(s, (seat === 0 ? '你' : '隐士') + ' · 过手');
  } else {
    const i = Number(code.slice(2));
    if (isNaN(i) || s.cells[i]) return false;
    s.cells[i] = seat === 0 ? 'r' : 'b';
    s.last = code;
    note(s, (seat === 0 ? '你' : '隐士') + ' · 落第 ' + (i + 1) + ' 位');
  }
  s.round++; s.moveNo = s.round;
  s.turn = (seat + 1) % 2;
  s.log.push(s.note);
  const full = s.cells.every(c => !!c);
  if (s.round >= s.maxMoves || full) {
    const a = s.cells.filter(c => c === 'r').length;
    const b = s.cells.filter(c => c === 'b').length;
    const w = a === b ? -1 : (a > b ? 0 : 1);
    finish(s, w, s.name + ' · 本机简式已终 · ' +
      (w < 0 ? '言和' : '第 ' + (w + 1) + ' 席执卷（' + Math.max(a, b) + ' 子）'));
  }
  return true;
}
function viewGeneric(s) {
  return {
    game: s.id, renderer: 'grid', variant: s.variant, room: '本机',
    seq: s.seq, moveNo: s.moveNo,
    phase: s.ended ? 'end' : 'play', phaseName: s.ended ? '终局' : '对局中',
    cells: s.cells.slice(), w: s.w, h: s.h, you: 0, turn: s.turn,
    legal: s.ended ? [] : legalGeneric(s, 0),
    hand: [], hands: [[], []],
    info: { title: s.name + '（本机简式）', labels: [], round: s.round, goal: s.maxMoves,
            score: s.score.slice(), covered: [0, 0], lastNote: s.note, you: 0, ban: -1 },
    ended: s.ended, winner: s.winner, result: s.result,
    last: s.last, log: s.log.slice(-24)
  };
}

function applyCover(s, seat, code) {
  if (typeof code === 'number') code = 'c:' + code;
  if (s.generic) return applyGeneric(s, seat, code);
  const k = Number(code.slice(2));
  if (legal(s, seat).indexOf(code) < 0) return false;
  if (s.id === 'shiyi') { actShiyi(s, seat, k); return true; }
  s.cover[seat] = String(k);
  if (s.cover.some(c => c === '')) { note(s, '已覆，候他席'); return true; }
  const p = s.cover.map(Number); s.lastPick = p.slice(); s.cover = ['', ''];
  switch (s.id) {
    case 'houlou': revealHoulou(s, p); break;
    case 'duzhou': revealDuzhou(s, p); break;
    case 'dengying': revealDengying(s, p); break;
    case 'huiwen': revealHuiwen(s, p); break;
    case 'cuojin': revealCuojin(s, p); break;
    case 'tingyu': revealTingyu(s, p); break;
    case 'yijuan': revealYijuan(s, p); break;
  }
  s.round++; s.moveNo = s.round; s.turn = 0;
  s.log.push(s.note);
  checkEnd(s);
  return true;
}

function botPick(s, seat, level) {
  const l = legal(s, seat);
  if (!l.length) return '';
  const ks = l.map(c => Number(c.slice(2)));
  const lv = Math.max(0, Math.min(9, level || 0));
  if (lv <= 1) return l[rint(s, l.length)];
  if (s.id === 'houlou' || s.id === 'tingyu') {
    const ok = ks.filter(k => !banned(s, k));
    return 'c:' + ok[rint(s, ok.length || ks.length)];
  }
  if (s.id === 'shiyi') {
    // 高手会挑能凑等差的堆
    const my = (s.tmp[seat] || '').split(',').filter(x => x !== '').map(Number);
    for (const k of ks) if (my.length >= 2) {
      for (let a = 0; a < my.length; a++) for (let b = a+1; b < my.length; b++) {
        const tri = [my[a], my[b], s.piles[k]].sort((x,y) => x-y);
        if (tri[1]-tri[0] === tri[2]-tri[1]) return 'c:' + k;
      }
    }
    return l[rint(s, l.length)];
  }
  if (s.id === 'yijuan') {
    let best = ks[0], by = 99;
    for (const k of ks) if (s.handYear[k] < by) { by = s.handYear[k]; best = k; }
    return lv >= 6 ? 'c:' + best : l[rint(s, l.length)];
  }
  return l[rint(s, l.length)];
}

function viewOf(s) {
  if (s.generic) return viewGeneric(s);
  const info = {
    title: NAMES[s.id], labels: labels(s), round: s.round, goal: s.goal,
    score: s.score.slice(), covered: s.cover.map(c => c === '' ? 0 : 1),
    lastNote: s.note, you: 0,
    ban: s.id === 'houlou' ? s.ban : (s.id === 'tingyu' ? s.banNum : -1)
  };
  if (s.id === 'dengying') {
    info.myLamps = [0,1,2].map(q => { const z = s.lamps[q]; return z < 0 ? '已亮' : '第 ' + (z+1) + ' 格'; });
    info.lit = s.lit.slice(); info.moves = s.moves.slice();
  }
  if (s.id === 'duzhou') { info.boats = s.boats.slice(); info.boatGoal = s.boatGoal; }
  if (s.id === 'huiwen') info.word = s.word;
  if (s.id === 'cuojin') info.cut = s.cut.slice();
  if (s.id === 'shiyi') { info.piles = s.piles.slice(); info.tmp = s.tmp.slice(); }
  return {
    game: s.id, renderer: 'grid', variant: s.variant, room: '本机',
    seq: s.seq, moveNo: s.moveNo, phase: s.ended ? 'end' : 'play', phaseName: s.ended ? '终局' : '对局中',
    cells: s.cells.slice(), w: s.w, h: s.h, you: 0, turn: s.turn,
    legal: s.ended ? [] : legal(s, 0),
    hand: [], hands: [[], []], info,
    ended: s.ended, winner: s.winner, result: s.result,
    last: s.last, log: s.log.slice(-24)
  };
}

export class LocalNet {
  constructor(onFrame) {
    this.onFrame = onFrame;
    this.s = null;
    this.timer = null;
    this.myName = '';
    this.booted = false;
    this.catalog = [];
  }
  setCatalog(games) { this.catalog = games || []; }
  reset() { clearTimeout(this.timer); this.s = null; }
  boot() {
    if (this.booted) return;
    this.booted = true;
    this.onFrame({ t: 'rooms', list: [] });
    this.onFrame({ t: 'halls', list: [], on: false });
    this.onFrame({ t: 'note', text: '本机自弈已就位 · 点「寻局」即与隐士对弈' });
  }
  emit() {
    if (!this.s) return;
    const s = this.s;
    const kind = s._kind || 'main';
    const id = kind === 'ported' ? s.s.Game : s.id;
    const view = kind === 'ported' ? s.view(0)
      : kind === 'generic' ? viewGeneric(s) : viewOf(s);
    view.seq = (view.seq || 0) + 1;
    const seats = kind === 'ported' ? Math.max(2, s.s.Seats) : 2;
    const presence = Array.from({ length: seats }, (_, i) => i === 0
      ? { online: true, name: this.myName || '你', ready: true }
      : { online: true, name: '隐士 · ' + i, bot: true, ready: true });
    const meta = { id: '本机', game: id, title: '本机自弈', bots: seats - 1, max: seats, started: true };
    this.onFrame({ t: 'state', view, presence, meta, you: 0, chat: [] });
  }
  botStep() {
    const s = this.s; if (!s) return;
    const kind = s._kind || 'main';
    if (kind === 'ported') {
      if (s.ended || s.turn === 0) return;
      const seat = s.turn;
      const code = s.botCode(seat);
      if (code) s.act(seat, code);
      this.emit();
      if (!s.ended && s.turn !== 0) this.timer = setTimeout(() => this.botStep(), 300);
      return;
    }
    if (s.ended) return;
    if (s.generic) {
      if (s.turn !== 1) return;
      const l = legalGeneric(s, 1).filter(c => c !== 'pass');
      const pick = l.length ? l[rint(s, l.length)] : 'pass';
      applyGeneric(s, 1, pick);
      this.emit();
      return;
    }
    const seat = s.id === 'shiyi' ? s.turn : 1;
    if (seat !== 1) return;
    const pick = botPick(s, 1, 5);
    if (pick === '') return;
    applyCover(s, 1, pick);
    this.emit();
    if (!s.ended && s.id === 'shiyi' && s.turn === 1) this.timer = setTimeout(() => this.botStep(), 320);
  }
  send(o) {
    const t = o && o.t;
    if (t === 'match') {
      const id = o.game || 'yijuan';
      const isMain = MAIN.indexOf(id) >= 0;
      const g = this.catalog.find(x => x.id === id) || null;
      const variant = o.variant || '常式';
      clearTimeout(this.timer);
      const ported = PortedRule(id);
      // 先让「寻局」进度条完整走一拍，再切进棋盘：避免光效一闪就断、像卡顿
      this.onFrame({ t: 'matchState', active: true, waited: 0, pool: '本机', size: 1, need: 0, etaBot: 0 });
      this.timer = setTimeout(() => {
        if (ported) {
          this.s = new PortedGame(id, variant, (g && g.min) || 2);
          this.s._kind = 'ported';
        } else if (isMain) {
          this.s = build(id, variant);
          this.s._kind = 'main';
        } else {
          this.s = buildGeneric(id, variant, g);
          this.s._kind = 'generic';
        }
        this.onFrame({ t: 'matchState', active: false });
        this.onFrame({ t: 'joined', room: '本机', seat: 0, matched: true, spectating: false, pool: '' });
        this.emit();
        const turn = this.s._kind === 'ported' ? this.s.turn : this.s.turn;
        if (turn !== 0) this.timer = setTimeout(() => this.botStep(), 420);
      }, 340);
      return true;
    }
    if (t === 'move') {
      const s = this.s; if (!s) return true;
      const code = String(o.code || '');
      const kind = s._kind || 'main';
      let ok;
      if (kind === 'ported') ok = s.act(0, code);
      else if (kind === 'generic') ok = applyGeneric(s, 0, code);
      else ok = applyCover(s, 0, code);
      if (!ok) { this.onFrame({ t: 'error', text: '此刻不能这样落' }); return true; }
      this.emit();
      if (!s.ended) this.timer = setTimeout(() => this.botStep(), 420);
      return true;
    }
    if (t === 'leave') { this.reset(); return true; }
    if (t === 'sync') { this.emit(); return true; }
    if (t === 'matchCancel') { clearTimeout(this.timer); this.onFrame({ t: 'matchState', active: false }); return true; }
    // 其余（halls / scripts / rooms / shop / godInfo / act / accountState 等）本机无需应答
    return true;
  }
}

/** 联机走真 Net；断线或 APK 虚拟域下自动切到 LocalNet。UI 层始终只认一个对象。 */
export class HybridNet {
  constructor(onFrame, onStatus) {
    this.onFrame = onFrame;
    this.onStatus = onStatus;
    this.local = new LocalNet(onFrame);
    this.real = new Net(m => this._frame(m), s => this._status(s));
    this.mode = APP_HOST ? 'local' : 'auto';
  }
  get custom() { return this.real.custom; }
  _frame(m) { this.onFrame(m); }
  _status(s) {
    if (s === 'online') { this.mode = 'real'; this.local.reset(); }
    else if (s === 'offline' || s === 'need-url') {
      this.mode = 'local';
      this.local.boot();
    }
    this.onStatus(s);
  }
  connect() {
    if (this.mode === 'local') { this.local.boot(); this.onStatus(APP_HOST ? 'need-url' : 'offline'); return; }
    this.real.connect();
  }
  disconnect() { clearTimeout(this.local.timer); this.real.disconnect(); }
  setName(n) { this.local.myName = n; this.real.setName(n); }
  setUrl(u) { this.mode = 'auto'; this.real.setUrl(u); }
  send(o) {
    if (this.mode === 'real') { if (this.real.send(o)) return true; }
    return this.local.send(o);
  }
  applyDiff(view, ops) { return this.real.applyDiff(view, ops); }
  predict(view, code) { return this.mode === 'real' ? this.real.predict(view, code) : null; }
}

export const LOCAL_MAIN = MAIN;
