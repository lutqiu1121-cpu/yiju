/* 第 1 批：server/Rules/BoardGames.cs 的 LineGame / OthelloGame / GoGame。
 * 逐行对照 C# 原文，不做简式、不改规则。
 * 覆盖 7 局：tictactoe gomoku renju connect6 connect4 othello go
 */
import { RuleBase, GameState, MoveResult, DIRS, Cfg } from './base.js';

const D8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

/* ---------------- LineGame ---------------- */
export class LineGame extends RuleBase {
  constructor(id) { super(); this._id = id; }
  get Id() { return this._id; }
  get Variants() {
    if (this._id === 'gomoku') return ['15路', '无禁手'];
    if (this._id === 'renju') return ['Renju 禁手'];
    if (this._id === 'connect6') return ['19路'];
    if (this._id === 'connect4') return ['7×6'];
    return ['3路', '4路'];
  }
  Win(s) {
    if (this._id === 'connect4') return 4;
    if (this._id === 'connect6') return 6;
    if (this._id === 'tictactoe') return Cfg.I(s.Variant) === 4 ? 4 : 3;
    return 5;
  }
  Build(variant, seats, seed, room) {
    const s = new GameState();
    let w = this._id === 'connect4' ? 7 : this._id === 'connect6' ? 19
      : this._id === 'tictactoe' ? (Cfg.I(variant) === 4 ? 4 : 3) : 15;
    let h = this._id === 'connect4' ? 6 : this._id === 'connect6' ? 19
      : this._id === 'tictactoe' ? w : 15;
    const bn = this.O('boardN', 0);
    if (bn >= 3 && bn <= 15 && this._id !== 'connect4' && this._id !== 'connect6') { w = bn; h = bn; }
    this.SetGrid(s, w, h);
    s.V.pending = -1;
    return s;
  }
  Gravity(s) { return this._id === 'connect4' && this.OptB(s, 'gravity', true); }
  TwoPerMove(s) { return this._id === 'connect6'; }

  Legal(s, seat) {
    const r = [];
    if (s.Ended || s.Turn !== seat) return r;
    if (this.Gravity(s)) {
      for (let x = 0; x < s.Width; x++)
        for (let y = s.Height - 1; y >= 0; y--) {
          const i = this.At(s, x, y);
          if (this.Cell(s, i) === '') { r.push('c:' + i); break; }
        }
      return r;
    }
    for (let i = 0; i < s.Cells.length; i++) if (this.Cell(s, i) === '') r.push('c:' + i);
    return r;
  }
  Act(s, seat, action, d) {
    if (action !== 'c') return MoveResult.Fail('未知动作');
    const i = Cfg.I(Cfg.Rest(String(d.code)));
    if (i < 0 || i >= s.Cells.length || this.Cell(s, i) !== '') return MoveResult.Fail('该位置不可落子');
    const p = this.SideChar(seat);
    s.Cells[i] = p;
    s.Last = 'c:' + i;

    const five = this.CheckWin(s, i, seat);
    if (this._id === 'renju' && seat === 0 && this.RenjuForbidden(s, i, five)) {
      this.Finish(s, 1, '黑棋禁手（三三 / 四四 / 长连）负'); return MoveResult.Good('禁手');
    }
    if (five) { this.Finish(s, seat, (seat === 0 ? '红' : '蓝') + '连成 ' + this.Win(s) + ' 子，胜'); return MoveResult.Good('胜'); }
    let full = true; for (let k = 0; k < s.Cells.length; k++) if (this.Cell(s, k) === '') { full = false; break; }
    if (full) { this.Finish(s, -1, '棋盘落满，和棋'); return MoveResult.Good('和棋'); }
    if (this.TwoPerMove(s)) {
      const pend = this.IntV(s, 'pending', -1);
      if (s.MoveNo === 0) { this.Next(s, -1); return MoveResult.Good('首手一子'); }
      if (pend < 0) { s.V.pending = i; this.Say(s, '六子棋：第一子已落，请落第二子'); return MoveResult.Good('待第二子'); }
      s.V.pending = -1; this.Say(s, '六子棋：第二子已落');
    }
    this.Next(s, -1);
    return MoveResult.Good();
  }
  CheckWin(s, i, seat) {
    const p = this.Cell(s, i), x = this.X(s, i), y = this.Y(s, i);
    for (const d of DIRS) {
      const n = this.Line(s, x, y, d[0], d[1], p);
      if (this._id === 'renju' && seat === 0) { if (n === 5) return true; }
      else if (n >= this.Win(s)) return true;
    }
    return false;
  }
  DirLine(s, i, dx, dy, me) {
    let t = '';
    const x = this.X(s, i), y = this.Y(s, i);
    for (let k = -5; k <= 5; k++) {
      const nx = x + dx * k, ny = y + dy * k;
      if (!this.Inside(s, nx, ny)) { t += '#'; continue; }
      const c = this.Cell(s, this.At(s, nx, ny));
      t += c.length === 0 ? '.' : (c[0] === me ? 'x' : 'o');
    }
    return t;
  }
  static RunAt(t, p) {
    if (p < 0 || p >= t.length || t[p] !== 'x') return 0;
    let a = p, b = p;
    while (a > 0 && t[a - 1] === 'x') a--;
    while (b + 1 < t.length && t[b + 1] === 'x') b++;
    return b - a + 1;
  }
  static FivePoints(t) {
    let n = 0;
    for (let q = 0; q < t.length; q++) {
      if (t[q] !== '.') continue;
      const a = t.split(''); a[q] = 'x';
      if (LineGame.RunAt(a.join(''), q) === 5) n++;
    }
    return n;
  }
  static OpenThree(t) {
    for (let q = 0; q < t.length; q++) {
      if (t[q] !== '.') continue;
      const a = t.split(''); a[q] = 'x';
      const u = a.join('');
      if (LineGame.RunAt(u, q) >= 5) continue;
      if (LineGame.FivePoints(u) >= 2) return true;
    }
    return false;
  }
  RenjuForbidden(s, i, five) {
    if (five) return false;
    if (!this.OptB(s, 'forbidden', this._id === 'renju')) return false;
    let fours = 0, threes = 0, overline = false;
    for (const d of DIRS) {
      const t = this.DirLine(s, i, d[0], d[1], 'r');
      if (LineGame.RunAt(t, 5) >= 6) overline = true;
      if (LineGame.FivePoints(t) >= 1) fours++;
      if (LineGame.OpenThree(t)) threes++;
    }
    if (overline && this.OptB(s, 'overline', true)) return true;
    return fours >= 2 || threes >= 2;
  }
}

/* ---------------- OthelloGame ---------------- */
export class OthelloGame extends RuleBase {
  get Id() { return 'othello'; }
  get Variants() { return ['8路']; }
  Build(variant, seats, seed, room) {
    const s = new GameState(); this.SetGrid(s, 8, 8);
    s.Cells[this.At(s, 3, 3)] = 'b'; s.Cells[this.At(s, 4, 4)] = 'b';
    s.Cells[this.At(s, 3, 4)] = 'r'; s.Cells[this.At(s, 4, 3)] = 'r';
    s.V.passes = 0;
    return s;
  }
  Flips(s, i, seat) {
    const me = this.SideChar(seat), op = this.SideChar(1 - seat), res = [];
    if (this.Cell(s, i) !== '') return res;
    const x = this.X(s, i), y = this.Y(s, i);
    for (const d of D8) {
      const line = [];
      let cx = x + d[0], cy = y + d[1];
      while (this.Inside(s, cx, cy) && this.Cell(s, this.At(s, cx, cy)) === op) {
        line.push(this.At(s, cx, cy)); cx += d[0]; cy += d[1];
      }
      if (line.length > 0 && this.Inside(s, cx, cy) && this.Cell(s, this.At(s, cx, cy)) === me) res.push(...line);
    }
    return res;
  }
  Legal(s, seat) {
    const r = [];
    if (s.Ended || s.Turn !== seat) return r;
    for (let i = 0; i < s.Cells.length; i++) if (this.Flips(s, i, seat).length > 0) r.push('c:' + i);
    if (r.length === 0) r.push('pass');
    return r;
  }
  Act(s, seat, action, d) {
    if (action === 'pass') {
      const passes = this.IntV(s, 'passes', 0) + 1;
      s.V.passes = passes;
      if (passes >= 2) { this.Score(s); return MoveResult.Good('双方无子可下'); }
      this.Say(s, (seat === 0 ? '红' : '蓝') + '跳过一手');
      this.Next(s, -1); return MoveResult.Good();
    }
    if (action !== 'c') return MoveResult.Fail('未知动作');
    const i = Cfg.I(Cfg.Rest(String(d.code)));
    const f = this.Flips(s, i, seat);
    if (f.length === 0) return MoveResult.Fail('此处不能翻子');
    s.V.passes = 0;
    s.Cells[i] = this.SideChar(seat); s.Last = 'c:' + i;
    for (const k of f) s.Cells[k] = this.SideChar(seat);
    let empty = false; for (let k = 0; k < s.Cells.length; k++) if (this.Cell(s, k) === '') { empty = true; break; }
    if (!empty) { this.Score(s); return MoveResult.Good(); }
    this.Next(s, -1); return MoveResult.Good();
  }
  Score(s) {
    let a = 0, b = 0;
    for (let i = 0; i < s.Cells.length; i++) {
      if (this.Cell(s, i) === 'r') a++;
      else if (this.Cell(s, i) === 'b') b++;
    }
    this.Finish(s, a === b ? -1 : (a > b ? 0 : 1), '终局 ' + a + ' : ' + b + (a === b ? '，和棋' : ''));
  }
}

/* ---------------- GoGame ---------------- */
export class GoGame extends RuleBase {
  get Id() { return 'go'; }
  get Variants() { return ['9路', '13路', '19路', '让2子']; }
  Build(variant, seats, seed, room) {
    const s = new GameState();
    let n = Cfg.I(variant); if (n <= 0) n = 19;
    this.SetGrid(s, n, n);
    s.V.ko = -1; s.V.passes = 0; s.V.cap0 = 0; s.V.cap1 = 0;
    if (variant === '让2子') {
      const a = this.At(s, 3, 3), b = this.At(s, n - 4, n - 4);
      s.Cells[a] = 'r'; s.Cells[b] = 'r';
      s.V.handicap = 2;
    }
    return s;
  }
  Neighbors(s, i) {
    const r = [], x = this.X(s, i), y = this.Y(s, i);
    if (x > 0) r.push(i - 1);
    if (x + 1 < s.Width) r.push(i + 1);
    if (y > 0) r.push(i - s.Width);
    if (y + 1 < s.Height) r.push(i + s.Width);
    return r;
  }
  Group(s, i, color, stones, libs) {
    const st = [i], seen = new Set([i]), lib = new Set();
    while (st.length) {
      const p = st.pop(); stones.push(p);
      for (const q of this.Neighbors(s, p)) {
        const c = this.Cell(s, q);
        if (c === '') lib.add(q);
        else if (c === color && !seen.has(q)) { seen.add(q); st.push(q); }
      }
    }
    libs.push(...lib);
  }
  Suicide(s, i, seat) {
    const me = this.SideChar(seat), op = this.SideChar(1 - seat);
    s.Cells[i] = me;
    let captured = false;
    for (const nb of this.Neighbors(s, i)) {
      if (this.Cell(s, nb) !== op) continue;
      const st = [], lb = [];
      this.Group(s, nb, op, st, lb);
      if (lb.length === 0) { captured = true; break; }
    }
    if (!captured) {
      const st2 = [], lb2 = [];
      this.Group(s, i, me, st2, lb2);
      if (lb2.length === 0) { s.Cells[i] = ''; return true; }
    }
    s.Cells[i] = '';
    return false;
  }
  Legal(s, seat) {
    const r = [];
    if (s.Ended) return r;
    if (this.StrV(s, 'stage', '') === 'scoring') {
      const ok = s.V._confirm || [false, false];
      if (seat >= 0 && seat < ok.length && !ok[seat]) r.push('score:ok');
      return r;
    }
    if (s.Turn !== seat) return r;
    const ko = this.IntV(s, 'ko', -1);
    for (let i = 0; i < s.Cells.length; i++) {
      if (this.Cell(s, i) !== '' || i === ko) continue;
      if (!this.Suicide(s, i, seat)) r.push('c:' + i);
    }
    r.push('pass');
    return r;
  }
  Act(s, seat, action, d) {
    if (action === 'score') {
      const ok = s.V._confirm || [false, false];
      if (seat < 0 || seat >= ok.length) return MoveResult.Fail('只有对局双方能确认死活');
      ok[seat] = true; s.V._confirm = ok;
      this.Say(s, (seat === 0 ? '黑' : '白') + '确认死活方案');
      if (ok[0] && ok[1]) this.Count(s);
      return MoveResult.Good('已确认');
    }
    if (action === 'pass') {
      const p = this.IntV(s, 'passes', 0) + 1; s.V.passes = p;
      if (p >= 2) {
        if (this.OptB(s, 'deadConfirm', true)) {
          s.V.stage = 'scoring'; s.V._confirm = [false, false];
          s.PhaseName = '死活确认 · 双方确认后数子'; s.V._phase = 'vote';
          this.Say(s, '双方虚着，进入死活确认：请双方确认后再数子');
        } else this.Count(s);
        return MoveResult.Good();
      }
      this.Say(s, (seat === 0 ? '黑' : '白') + '虚着');
      this.Next(s, -1); return MoveResult.Good();
    }
    if (action !== 'c') return MoveResult.Fail('未知动作');
    const i = Cfg.I(Cfg.Rest(String(d.code)));
    if (!this.Legal(s, seat).includes('c:' + i)) return MoveResult.Fail('禁着点 / 劫争 / 自杀');
    const me = this.SideChar(seat), op = this.SideChar(1 - seat);
    s.V.passes = 0;
    s.Cells[i] = me; s.Last = 'c:' + i;
    let captured = 0, lastCap = -1;
    for (const nb of this.Neighbors(s, i)) {
      if (this.Cell(s, nb) !== op) continue;
      const st = [], lb = [];
      this.Group(s, nb, op, st, lb);
      if (lb.length === 0) for (const m of st) { s.Cells[m] = ''; captured++; lastCap = m; }
    }
    const capKey = seat === 0 ? 'cap0' : 'cap1';
    s.V[capKey] = this.IntV(s, capKey, 0) + captured;
    const own = [], ownLib = [];
    this.Group(s, i, me, own, ownLib);
    s.V.ko = (captured === 1 && own.length === 1 && ownLib.length === 1) ? lastCap : -1;
    this.Next(s, -1);
    return MoveResult.Good(captured > 0 ? '提 ' + captured + ' 子' : '');
  }
  Count(s) {
    let a = 0, b = 0;
    const done = new Set();
    for (let i = 0; i < s.Cells.length; i++) {
      if (this.Cell(s, i) === 'r') { a++; continue; }
      if (this.Cell(s, i) === 'b') { b++; continue; }
      if (done.has(i)) continue;
      const st = [i]; done.add(i);
      let ra = 0, rb = 0, size = 0;
      while (st.length) {
        const p = st.pop(); size++;
        for (const q of this.Neighbors(s, p)) {
          const c = this.Cell(s, q);
          if (c === 'r') ra++;
          else if (c === 'b') rb++;
          else if (!done.has(q)) { done.add(q); st.push(q); }
        }
      }
      if (ra > 0 && rb === 0) a += size;
      else if (rb > 0 && ra === 0) b += size;
    }
    const h = this.OptI(s, 'handicap', this.IntV(s, 'handicap', 0));
    const km = this.OptS(s, 'komi', '3.5');
    const scoreMode = this.OptS(s, 'scoring', 'area');
    const territory = scoreMode === 'territory' || km === '6.5';
    let komi = territory ? 6.5 : km === '3.75' ? 3.75 : km === '2.75' ? 2.75 : 3.5;
    if (h > 0) komi = 0;
    const diff = territory ? (a - b) : (a - b) / 2.0;
    const draw = !territory && Math.abs(diff - komi) < 0.001;
    const winner = diff > komi ? 0 : (draw ? -1 : 1);
    const rule = territory ? '日韩数目 6.5 目' : ('中国数子 贴 ' + komi + ' 子');
    this.Finish(s, winner, '终局 黑 ' + a + ' : 白 ' + b + ' · ' + rule +
      (h > 0 ? ' · 让 ' + h + ' 子' : '') + (draw ? '，和棋' : ''));
  }
}
