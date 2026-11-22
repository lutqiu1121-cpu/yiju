/* 服务端 server/Rules/IGameRule.cs 的 JS 等价实现（1:1 语义）。
 * 逐局移植的公共基座：GameState / MoveResult / RuleBase / Cfg。
 * 验收：tools/rules-vector.test.mjs 用 rules/vectors.json 的真实走法序列比对。
 */
export const Cfg = {
  I(s) {
    if (!s) return -1;
    let k = 0;
    while (k < s.length && s[k] >= '0' && s[k] <= '9') k++;
    if (k === 0) return -1;
    const n = parseInt(s.slice(0, k), 10);
    return Number.isNaN(n) ? -1 : n;
  },
  Rest(code) { const i = code.indexOf(':'); return i < 0 ? '' : code.slice(i + 1); },
  Act(code) { const i = code.indexOf(':'); return i < 0 ? code : code.slice(0, i); }
};

export class GameState {
  constructor() {
    this.Game = ''; this.Variant = ''; this.Renderer = ''; this.Room = '';
    this.Phase = 'wait'; this.PhaseName = '候开枰';
    this.Turn = 0; this.Seats = 2; this.Width = 0; this.Height = 0;
    this.Cells = []; this.Hands = {}; this.V = {}; this.Log = [];
    this.Last = ''; this.Winner = ''; this.Result = '';
    this.Ended = false; this.MoveNo = 0;
  }
}

export class MoveResult {
  constructor() { this.Ok = false; this.Error = ''; this.Note = ''; this.Advance = true; }
  static Fail(e) { const r = new MoveResult(); r.Ok = false; r.Error = e; return r; }
  static Good(n = '') { const r = new MoveResult(); r.Ok = true; r.Note = n; return r; }
}

export const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

export class RuleBase {
  constructor() { this.BuildOptions = {}; this._buildSeed = 20261121; }

  get Id() { return ''; }
  get Renderer() { return 'grid'; }
  get MinSeats() { return 2; }
  get MaxSeats() { return 2; }
  get Variants() { return ['标准']; }

  Build(variant, seats, seed, room) { throw new Error('Build 未实现'); }
  Legal(s, seat) { return []; }
  Act(s, seat, action, d) { return MoveResult.Fail('未知动作'); }
  Info(s, seat) { return {}; }
  BotPick(s, seat, level, legal) { return ''; }

  O(k, def) { return this.BuildOptions[k] === undefined ? def : Number(this.BuildOptions[k]) | 0; }
  OL(k, def) { return this.BuildOptions[k] === undefined ? def : Number(this.BuildOptions[k]); }
  OB(k, def) { return this.BuildOptions[k] === undefined ? def : !!this.BuildOptions[k]; }
  OS(k, def) { return this.BuildOptions[k] === undefined ? def : String(this.BuildOptions[k]); }

  OptB(s, k, def) { return s.V._opt && s.V._opt[k] !== undefined ? !!s.V._opt[k] : def; }
  OptI(s, k, def) { return s.V._opt && s.V._opt[k] !== undefined ? (Number(s.V._opt[k]) | 0) : def; }
  OptS(s, k, def) { return s.V._opt && s.V._opt[k] !== undefined ? String(s.V._opt[k]) : def; }
  IntV(s, k, def) { return s.V[k] === undefined ? def : (Number(s.V[k]) | 0); }
  StrV(s, k, def) { return s.V[k] === undefined ? def : String(s.V[k]); }

  New(variant, seats, seed, room) {
    this._buildSeed = seed === 0 ? 20261121 : seed * 2654435761;
    const snap = Object.assign({}, this.BuildOptions);
    const s = this.Build(variant, seats, seed, room);
    s.V._opt = snap;
    s.Game = this.Id;
    s.Variant = (!variant && this.Variants.length) ? this.Variants[0] : (variant || '标准');
    s.Renderer = this.Renderer;
    s.Room = room;
    s.Seats = seats;
    s.Phase = 'playing';
    s.PhaseName = '对局中';
    if (s.V.rng === undefined) s.V.rng = this._buildSeed;
    if (s.V.hidden === undefined) s.V.hidden = false;
    s.V.game = this.Id;
    s.V.variant = s.Variant;
    return s;
  }

  NextRng(s, n) {
    if (s.V.rng === undefined) s.V.rng = this._buildSeed || 20261121;
    // xorshift32 等价：避开 JS double 在 2^53 以上丢精度
    let x = (Number(s.V.rng) >>> 0) || 0x9e3779b9;
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    s.V.rng = x >>> 0;
    return n <= 0 ? 0 : (x >>> 0) % n;
  }
  Shuffle(s, a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.NextRng(s, i + 1);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
  }

  Say(s, text) { s.Log.push(text); if (s.Log.length > 40) s.Log.shift(); }
  Next(s, skip) {
    if (s.Ended) return;
    const n = Math.max(1, s.Seats);
    let t = (s.Turn + 1) % n;
    for (let k = 0; k < n - 1 && skip === t; k++) t = (t + 1) % n;
    s.Turn = t; s.MoveNo++;
  }
  Finish(s, winner, result) {
    s.Ended = true; s.Phase = 'end'; s.PhaseName = '终局';
    s.Winner = winner < 0 ? '' : String(winner);
    s.Result = result; this.Say(s, result);
  }

  Cell(s, i) { return (s.Cells && i >= 0 && i < s.Cells.length) ? (s.Cells[i] || '') : ''; }
  At(s, x, y) { return y * s.Width + x; }
  X(s, i) { return s.Width > 0 ? i % s.Width : 0; }
  Y(s, i) { return s.Width > 0 ? Math.floor(i / s.Width) : 0; }
  Inside(s, x, y) { return x >= 0 && y >= 0 && x < s.Width && y < s.Height; }
  CountLine(s, x, y, dx, dy, p) {
    let n = 0, cx = x + dx, cy = y + dy;
    while (this.Inside(s, cx, cy) && this.Cell(s, this.At(s, cx, cy)) === p) { n++; cx += dx; cy += dy; }
    return n;
  }
  Line(s, x, y, dx, dy, p) {
    return 1 + this.CountLine(s, x, y, dx, dy, p) + this.CountLine(s, x, y, -dx, -dy, p);
  }
  BelongsTo(c, seat) {
    if (c.length < 2) return false;
    const side = c[0] === '?' ? c[1] : c[0];
    return side === (seat === 0 ? 'r' : seat === 1 ? 'b' : String.fromCharCode('c'.charCodeAt(0) + seat - 2));
  }
  SideOf(c) {
    if (!c || c.length < 2) return -1;
    const ch = c[0] === '?' ? c[1] : c[0];
    if (ch === 'r') return 0;
    if (ch === 'b') return 1;
    if (ch >= 'c' && ch <= 'k') return 2 + (ch.charCodeAt(0) - 'c'.charCodeAt(0));
    return -1;
  }
  SideChar(seat) { return seat === 0 ? 'r' : seat === 1 ? 'b' : String.fromCharCode('c'.charCodeAt(0) + seat - 2); }
  Mine(s, i, seat) { return this.SideOf(this.Cell(s, i)) === seat; }
  Put(s, from, to, note) { s.Cells[to] = s.Cells[from]; s.Cells[from] = ''; s.Last = note; }
  SetGrid(s, w, h) { s.Width = w; s.Height = h; s.Cells = new Array(w * h).fill(''); }
  ParseList(code) {
    const r = [];
    for (const q of String(code == null ? '' : code).split(',')) {
      const n = parseInt(q.trim(), 10);
      if (!Number.isNaN(n)) r.push(n);
    }
    return r;
  }
  ParsePair(code, sep) {
    const a = String(code).split(sep);
    return [parseInt(a[0], 10) || 0, parseInt(a[1], 10) || 0];
  }

  HandSizes(s) {
    const d = {};
    for (const k of Object.keys(s.Hands)) d[String(k)] = s.Hands[k].length;
    return d;
  }
  InfoBase(s) {
    const d = {};
    for (const k of Object.keys(s.V)) {
      if (!k || k[0] === '_') continue;
      if (['rng', 'hidden', 'game', 'variant'].includes(k)) continue;
      const lk = k.toLowerCase();
      if (lk.includes('rest') || ['wall', 'deck', 'poslast', 'checkby'].includes(lk)) continue;
      const v = s.V[k];
      if (Array.isArray(v) || (v && typeof v === 'object') ||
          ['string', 'number', 'boolean'].includes(typeof v)) d[k] = v;
    }
    return d;
  }
  View(s, seat) {
    const hidden = !!s.V.hidden;
    const cells = s.Cells.map(c => {
      c = c || '';
      return hidden && c.length && c[0] === '?' && !this.BelongsTo(c, seat) ? '?' : c;
    });
    return {
      game: s.Game, variant: s.Variant, renderer: s.Renderer, room: s.Room,
      phase: s.Phase, phaseName: s.PhaseName, turn: s.Turn, you: seat, seats: s.Seats,
      w: s.Width, h: s.Height, cells,
      hand: s.Hands[seat] ? s.Hands[seat].slice() : [],
      handSizes: this.HandSizes(s), hands: s.Hands,
      last: s.Last, winner: s.Winner, result: s.Result, ended: s.Ended,
      moveNo: s.MoveNo, log: s.Log.slice(),
      legal: (s.Phase === 'playing' && seat >= 0 && !s.Ended) ? this.Legal(s, seat) : [],
      info: Object.assign(this.InfoBase(s), this.Info(s, seat)),
      score: s.V.score || []
    };
  }

  // —— 以下为 server/Rules/IGameRule.cs 中 RuleBase 的其余成员，供转译产物调用 ——
  OL(k, def) { return this.BuildOptions[k] === undefined ? def : Number(this.BuildOptions[k]); }
  OptL(s, k, def) { return s.V._opt && s.V._opt[k] !== undefined ? Number(s.V._opt[k]) : def; }
  Opt(s) { return s.V._opt || {}; }
  BoolV(s, k, def) { return s.V[k] === undefined ? def : !!s.V[k]; }
  MarkFeat(s, f) {
    const a = s.V._feats || [];
    a.push(f); s.V._feats = a.slice();
  }
  FinishTeam(s, seats, result) {
    s.Ended = true; s.Phase = 'end'; s.PhaseName = '终局';
    s.Winner = Array.from(seats).join(',');
    s.Result = result; this.Say(s, result);
  }
  In(a, x) { return Array.isArray(a) ? a.includes(x) : false; }
  BotLine(s, seat) { return ''; }
  Tick(s, dtMs) {}
  BotScore(s, seat, code) { return 0; }
  GodPick(s, seat, tier, legal) { return this.BotThink(s, seat, tier, legal); }
  Score(s, seat) { return 0; }
  Clone(a) {
    const b = new GameState();
    for (const k of Object.keys(a)) {
      const v = a[k];
      if (Array.isArray(v)) b[k] = v.slice();
      else if (v && typeof v === 'object') b[k] = JSON.parse(JSON.stringify(v));
      else b[k] = v;
    }
    return b;
  }

  /** 通用 bot：随机选；具体规则可覆写 BotPick */
  BotThink(s, seat, level, legal) {
    if (!legal || !legal.length) return '';
    if (this.BotPick) {
      const p = this.BotPick(s, seat, level, legal);
      if (p) return p;
    }
    return legal[this.NextRng(s, legal.length)];
  }
}


// C# 中这些是 protected static，转译产物在静态方法里会以 this.X() 调用；
// JS 静态方法内 this 是类，故在 RuleBase 上注册同名静态转发，保证两种上下文都能用。
const STATIC_HELPERS = [
  'Say','MarkFeat','Next','Finish','FinishTeam','Cell','At','X','Y','Inside',
  'CountLine','Line','BelongsTo','SideOf','SideChar','Mine','Put','SetGrid',
  'ParsePair','ParseList','HandSizes','InfoBase','Clone','In',
  'StrV','IntV','BoolV','Opt','OptB','OptI','OptL','OptS'
];
for (const n of STATIC_HELPERS) {
  if (typeof RuleBase.prototype[n] === 'function') {
    RuleBase[n] = function (...args) { return RuleBase.prototype[n].apply(this, args); };
  }
}
