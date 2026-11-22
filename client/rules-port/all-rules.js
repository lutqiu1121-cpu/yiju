/* 由 tools/cs2js.py 从 server/Rules/*.cs 定向转译，勿手改。
 * 60 局全部登记在同目录 registry.js；验收见 tools/rules-vector.test.mjs
 * 与 tools/rules-all.test.mjs。运行时语义由 cs-runtime.js 吸收。
 */
import { GameState, MoveResult, RuleBase, Cfg, DIRS } from './base.js';
import { CS, J } from './cs-runtime.js';

// ===== IGameRule.cs =====








    class Cards
    {
        static SUITS = [ "S", "H", "C", "D" ];
        static RANKS = [ "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2" ];

        static Deck(decks, jokers)
        {
            let d = [];
            for (let k = 0; k < decks; k++)
                for (let i = 0; i < Cards.SUITS.length; i++)
                    for (let j = 0; j < Cards.RANKS.length; j++) d.Add(Cards.SUITS[i] + Cards.RANKS[j]);
            if (jokers) { d.Add("J1"); d.Add("J2"); }
            return d;
        }
        static Val(c)
        {
            if (c == "J1") return 16;
            if (c == "J2") return 17;
            let r = Cards.Rank(c);
            for (let i = 0; i < Cards.RANKS.length; i++) if (Cards.RANKS[i] == r) return i + 3;
            return 0;
        }
        static Rank(c)
        {
            if (c.length < 2) return c;
            if (c[0] == 'J') return c;
            return CS.substr(c, 1);
        }
        static Suit(c) { return c.length > 1 ? CS.substr(c, 0, 1) : ""; }
        static IsJoker(c) { return c == "J1" || c == "J2"; }
        static Label(c)
        {
            if (c == "J1") return "小王";
            if (c == "J2") return "大王";
            let r = Cards.Rank(c);
            let s = Cards.Suit(c);
            let sym = s == "S" ? "♠" : s == "H" ? "♥" : s == "C" ? "♣" : s == "D" ? "♦" : "";
            return sym + r;
        }
        static SortHand(h)
        {
            h.Sort((a, b) => { return Cards.Val(b).CompareTo(Cards.Val(a)); });
        }
        static Take(s, hands, seat, idx)
        {
            let r = [];
            if (!hands.ContainsKey(seat)) return r;
            let h = hands[seat];
            let sorted = (idx).slice();
            sorted.Sort(); sorted.Reverse();
            for (let i = 0; i < sorted.length; i++)
            {
                let k = sorted[i];
                if (k < 0 || k >= h.length) return null;
                r.Add(h[k]); h.RemoveAt(k);
            }
            r.Reverse();
            return r;
        }

        static Type(cards, wild)
        {
            let bad = [ -1, 0, 0 ];
            if (cards == null || cards.length == 0) return bad;
            let v = [];
            let wilds = 0;
            for (let i = 0; i < cards.length; i++)
            {
                if (!CS.empty(wild) && Cards.Rank(cards[i]) == wild) wilds++;
                else v.Add(Cards.Val(cards[i]));
            }
            v.Sort();
            let n = cards.length;
            if (wilds == n && n > 0) return [ 10, 20, n ];
            if (n == 1) return [ 0, v.length > 0 ? v[0] : 17, 1 ];
            if (n == 2)
            {
                if (v.length == 2 && v[0] == 16 && v[1] == 17) return [ 11, 100, 2 ];
                if ((v.length == 2 && v[0] == v[1]) || (v.length == 1 && wilds == 1) || wilds == 2) return [ 1, v.length > 0 ? v[0] : 17, 2 ];
                return bad;
            }
            let cnt = [];
            for (let i = 0; i < v.length; i++) { if (!cnt.ContainsKey(v[i])) cnt[v[i]] = 0; cnt[v[i]]++; }

            if (wilds > 0)
            {
                let best = 0;
                for (let kv of CS.entries(cnt)) if (kv.Value > best) { best = kv.Value; }
                if (v.length > 0)
                {
                    let key = 0, mx = 0;
                    for (let kv of CS.entries(cnt)) if (kv.Value >= mx) { mx = kv.Value; key = kv.Key; }
                    cnt[key] = mx + wilds;
                }
            }
            let keys = cnt.Keys.ToList(); keys.Sort();
            let groups = cnt.Values.ToList();
            if (n == 4 && keys.length == 1 && groups[0] == 4) return [ 10, keys[0], 4 ];
            if (n == 3 && keys.length == 1 && groups[0] == 3) return [ 2, keys[0], 3 ];
            if (n == 4 && keys.length == 2 && groups.Contains(3)) return [ 3, Cards.KeyOf(cnt, 3), 4 ];
            if (n == 5 && keys.length == 2 && groups.Contains(3) && groups.Contains(2)) return [ 4, Cards.KeyOf(cnt, 3), 5 ];
            if (n == 6 && keys.length == 2 && groups.Contains(4)) return [ 9, Cards.KeyOf(cnt, 4), 6 ];
            if (n == 8 && keys.length == 3 && groups.Contains(4)) return [ 9, Cards.KeyOf(cnt, 4), 8 ];

            let straight = keys.length == n && keys[keys.length - 1] <= 14 && Cards.Sequence(keys);
            if (straight && n >= 5) return [ 5, keys[keys.length - 1], n ];
            let pairs = keys.length * 2 == n && keys[keys.length - 1] <= 14 && Cards.Sequence(keys) && Cards.All(cnt, 2);
            if (pairs && n >= 6) return [ 6, keys[keys.length - 1], n ];
            let plane = keys.length >= 2 && keys[keys.length - 1] <= 14 && Cards.Sequence(keys) && Cards.All(cnt, 3);
            if (plane && n == keys.length * 3) return [ 7, keys[keys.length - 1], n ];
            if (plane && n == keys.length * 4) return [ 8, keys[keys.length - 1], n ];
            return bad;
        }
        static KeyOf(c, n)
        {
            for (let kv of CS.entries(c)) if (kv.Value == n) return kv.Key;
            return 0;
        }
        static All(c, n)
        {
            for (let kv of CS.entries(c)) if (kv.Value != n) return false;
            return true;
        }
        static Sequence(k)
        {
            for (let i = 1; i < k.length; i++) if (k[i] != k[i - 1] + 1) return false;
            return true;
        }
        static Beats(a, b)
        {
            if (a == null || a[0] < 0) return false;
            if (b == null || b[0] < 0) return true;
            if (a[0] == 11) return true;
            if (b[0] == 11) return false;
            if (a[0] == 10 && b[0] != 10) return true;
            if (b[0] == 10 && a[0] != 10) return false;
            return a[0] == b[0] && a[2] == b[2] && a[1] > b[1];
        }
    }




// ===== BoardGames.cs =====


    class LineGame extends RuleBase
    {
        _id ;
        constructor(id) { super(); this._id = id; }
        get Id() { return this._id; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 2; }
        get Variants() {
                if (this._id == "gomoku") return [ "15路", "无禁手" ];
                if (this._id == "renju") return [ "Renju 禁手" ];
                if (this._id == "connect6") return [ "19路" ];
                if (this._id == "connect4") return [ "7×6" ];
                return [ "3路", "4路" ];
            }
        Win(s)
        {
            if (this._id == "connect4") return 4;
            if (this._id == "connect6") return 6;
            if (this._id == "tictactoe") return Cfg.I(s.Variant) == 4 ? 4 : 3;
            return 5;
        }
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            let w = this._id == "connect4" ? 7 : this._id == "connect6" ? 19 : this._id == "tictactoe" ? (Cfg.I(variant) == 4 ? 4 : 3) : 15;
            let h = this._id == "connect4" ? 6 : this._id == "connect6" ? 19 : this._id == "tictactoe" ? w : 15;
            let bn = this.O("boardN", 0);
            if (bn >= 3 && bn <= 15 && this._id != "connect4" && this._id != "connect6") { w = bn; h = bn; }
            this.SetGrid(s, w, h);
            s.V["pending"] = -1;
            return s;
        }
        Gravity(s) { return this._id == "connect4" && this.OptB(s, "gravity", true); }
        TwoPerMove(s) { return this._id == "connect6"; }

        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat) return r;
            if (this.Gravity(s))
            {
                for (let x = 0; x < s.Width; x++)
                    for (let y = s.Height - 1; y >= 0; y--)
                    {
                        let i = this.At(s, x, y);
                        if (this.Cell(s, i) == "") { r.Add("c:" + i); break; }
                    }
                return r;
            }
            for (let i = 0; i < s.Cells.length; i++)
                if (this.Cell(s, i) == "") r.Add("c:" + i);
            return r;
        }

        Act(s, seat, action, d)
        {
            if (action != "c") return MoveResult.Fail("未知动作");
            let i = Cfg.I(Cfg.Rest(CS.str(d["code"])));
            if (i < 0 || i >= s.Cells.length || this.Cell(s, i) != "") return MoveResult.Fail("该位置不可落子");
            let p = this.SideChar(seat);
            s.Cells[i] = p;
            s.Last = "c:" + i;

            let five = this.CheckWin(s, i, seat);
            if (this._id == "renju" && seat == 0 && this.RenjuForbidden(s, i, five))
            { this.Finish(s, 1, "黑棋禁手（三三 / 四四 / 长连）负"); return MoveResult.Good("禁手"); }
            if (five) { this.Finish(s, seat, (seat == 0 ? "红" : "蓝") + "连成 " + this.Win(s) + " 子，胜"); return MoveResult.Good("胜"); }
            let full = true; for (let k = 0; k < s.Cells.length; k++) if (this.Cell(s, k) == "") { full = false; break; }
            if (full) { this.Finish(s, -1, "棋盘落满，和棋"); return MoveResult.Good("和棋"); }
            if (this.TwoPerMove(s))
            {
                let pend = this.IntV(s, "pending", -1);
                if (s.MoveNo == 0) { this.Next(s, -1); return MoveResult.Good("首手一子"); }
                if (pend < 0) { s.V["pending"] = i; this.Say(s, "六子棋：第一子已落，请落第二子"); return MoveResult.Good("待第二子"); }
                s.V["pending"] = -1;
                this.Say(s, "六子棋：第二子已落");
            }
            this.Next(s, -1);
            return MoveResult.Good();
        }

        CheckWin(s, i, seat)
        {
            let p = this.Cell(s, i);
            let x = this.X(s, i), y = this.Y(s, i);
            for (let k = 0; k < DIRS.length; k++)
            {
                let n = this.Line(s, x, y, DIRS[k][0], DIRS[k][1], p);

                if (this._id == "renju" && seat == 0) { if (n == 5) return true; }
                else if (n >= this.Win(s)) return true;
            }
            return false;
        }

        DirLine(s, i, dx, dy, me)
        {
            let sb = new CS.SB();
            let x = this.X(s, i), y = this.Y(s, i);
            for (let k = -5; k <= 5; k++)
            {
                let nx = x + dx * k, ny = y + dy * k;
                if (!this.Inside(s, nx, ny)) { sb.Append('#'); continue; }
                let c = this.Cell(s, this.At(s, nx, ny));
                sb.Append(c.length == 0 ? '.' : (c[0] == me ? 'x' : 'o'));
            }
            return CS.str(sb);
        }
        static RunAt(t, p)
        {
            if (p < 0 || p >= t.length || t[p] != 'x') return 0;
            let a = p, b = p;
            while (a > 0 && t[a - 1] == 'x') a--;
            while (b + 1 < t.length && t[b + 1] == 'x') b++;
            return b - a + 1;
        }

        static FivePoints(t)
        {
            let n = 0;
            for (let q = 0; q < t.length; q++)
            {
                if (t[q] != '.') continue;
                let a = t.ToCharArray(); a[q] = 'x';
                if (LineGame.RunAt(a.join(""), q) == 5) n++;
            }
            return n;
        }

        static OpenThree(t)
        {
            for (let q = 0; q < t.length; q++)
            {
                if (t[q] != '.') continue;
                let a = t.ToCharArray(); a[q] = 'x';
                let u = a.join("");
                let run = LineGame.RunAt(u, q);
                if (run >= 5) continue;
                if (LineGame.FivePoints(u) >= 2) return true;
            }
            return false;
        }

        RenjuForbidden(s, i, five)
        {
            if (five) return false;
            if (!this.OptB(s, "forbidden", this._id == "renju")) return false;
            let fours = 0, threes = 0; let overline = false;
            for (let k = 0; k < DIRS.length; k++)
            {
                let t = this.DirLine(s, i, DIRS[k][0], DIRS[k][1], 'r');
                if (LineGame.RunAt(t, 5) >= 6) overline = true;
                if (LineGame.FivePoints(t) >= 1) fours++;
                if (LineGame.OpenThree(t)) threes++;
            }
            if (overline && this.OptB(s, "overline", true)) return true;
            return fours >= 2 || threes >= 2;
        }
    }

    class OthelloGame extends RuleBase
    {
        get Id() { return "othello"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 2; }
        get Variants() { return [ "8路" ]; }
        static D8 = [
            [1,0],[-1,0],[0,1],[0,-1],
            [1,1],[1,-1],[-1,1],[-1,-1]
        ];
        Build(variant, seats, seed, room)
        {
            let s = new GameState(); this.SetGrid(s, 8, 8);
            s.Cells[this.At(s, 3, 3)] = "b"; s.Cells[this.At(s, 4, 4)] = "b";
            s.Cells[this.At(s, 3, 4)] = "r"; s.Cells[this.At(s, 4, 3)] = "r";
            s.V["passes"] = 0;
            return s;
        }
        Flips(s, i, seat)
        {
            let me = this.SideChar(seat), op = this.SideChar(1 - seat);
            let res = [];
            if (this.Cell(s, i) != "") return res;
            let x = this.X(s, i), y = this.Y(s, i);
            for (let k = 0; k < OthelloGame.D8.length; k++)
            {
                let line = [];
                let cx = x + OthelloGame.D8[k][0], cy = y + OthelloGame.D8[k][1];
                while (this.Inside(s, cx, cy) && this.Cell(s, this.At(s, cx, cy)) == op) { line.Add(this.At(s, cx, cy)); cx += OthelloGame.D8[k][0]; cy += OthelloGame.D8[k][1]; }
                if (line.length > 0 && this.Inside(s, cx, cy) && this.Cell(s, this.At(s, cx, cy)) == me) res.AddRange(line);
            }
            return res;
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat) return r;
            for (let i = 0; i < s.Cells.length; i++) if (this.Flips(s, i, seat).length > 0) r.Add("c:" + i);
            if (r.length == 0) r.Add("pass");
            return r;
        }
        Act(s, seat, action, d)
        {
            if (action == "pass")
            {
                let passes = this.IntV(s, "passes", 0) + 1;
                s.V["passes"] = passes;
                if (passes >= 2) { this.Score(s); return MoveResult.Good("双方无子可下"); }
                this.Say(s, (seat == 0 ? "红" : "蓝") + "跳过一手");
                this.Next(s, -1); return MoveResult.Good();
            }
            if (action != "c") return MoveResult.Fail("未知动作");
            let i = Cfg.I(Cfg.Rest(CS.str(d["code"])));
            let f = this.Flips(s, i, seat);
            if (f.length == 0) return MoveResult.Fail("此处不能翻子");
            s.V["passes"] = 0;
            s.Cells[i] = this.SideChar(seat); s.Last = "c:" + i;
            for (let k = 0; k < f.length; k++) s.Cells[f[k]] = this.SideChar(seat);
            let empty = false; for (let k = 0; k < s.Cells.length; k++) if (this.Cell(s, k) == "") { empty = true; break; }
            if (!empty) { this.Score(s); return MoveResult.Good(); }
            this.Next(s, -1); return MoveResult.Good();
        }
        Score(s)
        {
            let a = 0, b = 0;
            for (let i = 0; i < s.Cells.length; i++) { if (this.Cell(s, i) == "r") a++; else if (this.Cell(s, i) == "b") b++; }
            this.Finish(s, a == b ? -1 : (a > b ? 0 : 1), "终局 " + a + " : " + b + (a == b ? "，和棋" : ""));
        }
    }

    class CheckersGame extends RuleBase
    {
        get Id() { return "checkers"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 2; }
        get Variants() { return [ "8路", "10路" ]; }
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            let n = this.OS("variantRule", "english") == "international" ? 10 : (Cfg.I(variant) == 10 ? 10 : 8);
            this.SetGrid(s, n, n);
            let rows = n == 8 ? 3 : 4;
            for (let y = 0; y < rows; y++)
                for (let x = 0; x < n; x++)
                    if ((x + y) % 2 == 1) s.Cells[this.At(s, x, y)] = "b";
            for (let y = n - rows; y < n; y++)
                for (let x = 0; x < n; x++)
                    if ((x + y) % 2 == 1) s.Cells[this.At(s, x, y)] = "r";
            s.V["jump"] = -1;
            return s;
        }
        King(c) { return c.length > 1 && c[1] == 'K'; }
        Dir(seat) { return seat == 0 ? -1 : 1; }
        MovesFrom(s, i, seat, capturesOnly)
        {
            let r = [];
            let c = this.Cell(s, i);
            if (this.SideOf(c) != seat) return r;
            let x = this.X(s, i), y = this.Y(s, i), dy = this.Dir(seat);
            let ds = this.King(c) ? [ [ 1, 1 ], [ 1, -1 ], [ -1, 1 ], [ -1, -1 ] ]
                                 : [ [ 1, dy ], [ -1, dy ] ];

            for (let k = 0; k < ds.length; k++)
            {
                let mx = x + ds[k][0], my = y + ds[k][1], tx = x + 2 * ds[k][0], ty = y + 2 * ds[k][1];
                if (!this.Inside(s, tx, ty)) continue;
                if (this.SideOf(this.Cell(s, this.At(s, mx, my))) == 1 - seat && this.Cell(s, this.At(s, tx, ty)) == "") r.Add("m:" + i + ">" + this.At(s, tx, ty));
            }
            if (capturesOnly || r.length > 0) return r;
            for (let k = 0; k < ds.length; k++)
            {
                let nx = x + ds[k][0], ny = y + ds[k][1];
                if (this.Inside(s, nx, ny) && this.Cell(s, this.At(s, nx, ny)) == "") r.Add("m:" + i + ">" + this.At(s, nx, ny));
            }
            return r;
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat) return r;
            let jump = this.IntV(s, "jump", -1);
            if (jump >= 0) return this.MovesFrom(s, jump, seat, true);
            for (let i = 0; i < s.Cells.length; i++) r.AddRange(this.MovesFrom(s, i, seat, true));
            if (r.length > 0 && this.OptB(s, "maxCapture", true)) return r;
            for (let i = 0; i < s.Cells.length; i++) r.AddRange(this.MovesFrom(s, i, seat, false));
            if (r.length == 0) r.Add("pass");
            return r;
        }
        Act(s, seat, action, d)
        {
            if (action == "pass") { this.Finish(s, 1 - seat, "无子可动，负"); return MoveResult.Good(); }
            if (action != "m") return MoveResult.Fail("未知动作");
            let ij = this.ParsePair(Cfg.Rest(CS.str(d["code"])), '>');
            let from = ij[0], to = ij[1];
            let legal = this.Legal(s, seat);
            if (!legal.Contains("m:" + from + ">" + to)) return MoveResult.Fail("非法走法");
            let piece = this.Cell(s, from);
            let fx = this.X(s, from), fy = this.Y(s, from), tx = this.X(s, to), ty = this.Y(s, to);
            let cap = Math.abs(tx - fx) == 2;
            if (cap) s.Cells[this.At(s, (fx + tx) / 2, (fy + ty) / 2)] = "";
            s.Cells[from] = ""; s.Cells[to] = piece; s.Last = "m:" + from + ">" + to;
            let crowned = (seat == 0 && ty == 0) || (seat == 1 && ty == s.Height - 1);
            if (crowned) s.Cells[to] = this.SideChar(seat) + "K";
            let opponent = 0;
            for (let i = 0; i < s.Cells.length; i++) if (this.SideOf(this.Cell(s, i)) == 1 - seat) opponent++;
            if (opponent == 0) { this.Finish(s, seat, "吃光对方，胜"); return MoveResult.Good(); }

            if (cap && !(crowned && this.OptS(s, "variantRule", "english") != "international"))
            {
                let more = this.MovesFrom(s, to, seat, true);
                if (more.length > 0) { s.V["jump"] = to; this.Say(s, "连跳中"); return MoveResult.Good("连跳"); }
            }
            s.V["jump"] = -1;
            this.Next(s, -1); return MoveResult.Good();
        }
    }

    class GoGame extends RuleBase
    {
        get Id() { return "go"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 2; }
        get Variants() { return [ "9路", "13路", "19路", "让2子" ]; }
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            let n = Cfg.I(variant); if (n <= 0) n = 19;
            this.SetGrid(s, n, n);
            s.V["ko"] = -1; s.V["passes"] = 0; s.V["cap0"] = 0; s.V["cap1"] = 0;
            if (variant == "让2子")
            {
                let a = this.At(s, 3, 3), b = this.At(s, n - 4, n - 4);
                s.Cells[a] = "r"; s.Cells[b] = "r";
                s.V["handicap"] = 2;
            }
            return s;
        }
        Neighbors(s, i)
        {
            let r = [];
            let x = this.X(s, i), y = this.Y(s, i);
            if (x > 0) r.Add(i - 1);
            if (x + 1 < s.Width) r.Add(i + 1);
            if (y > 0) r.Add(i - s.Width);
            if (y + 1 < s.Height) r.Add(i + s.Width);
            return r;
        }
        Group(s, i, color, stones, libs)
        {
            let st = new CS.Stack(); st.Push(i);
            let seen = new CS.Set(); seen.Add(i);
            let lib = new CS.Set();
            while (st.length > 0)
            {
                let p = st.Pop(); stones.Add(p);
                let nb = this.Neighbors(s, p);
                for (let k = 0; k < nb.length; k++)
                {
                    let q = nb[k]; let c = this.Cell(s, q);
                    if (c == "") lib.Add(q);
                    else if (c == color && !seen.Contains(q)) { seen.Add(q); st.Push(q); }
                }
            }
            libs.AddRange(lib);
        }
        Suicide(s, i, seat)
        {
            let me = this.SideChar(seat), op = this.SideChar(1 - seat);
            s.Cells[i] = me;
            let captured = false;
            let nb = this.Neighbors(s, i);
            for (let k = 0; k < nb.length; k++)
            {
                if (this.Cell(s, nb[k]) != op) continue;
                let st = [], lb = [];
                this.Group(s, nb[k], op, st, lb);
                if (lb.length == 0) { captured = true; break; }
            }
            if (!captured)
            {
                let st2 = [], lb2 = [];
                this.Group(s, i, me, st2, lb2);
                if (lb2.length == 0) { s.Cells[i] = ""; return true; }
            }
            s.Cells[i] = "";
            return false;
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended) return r;
            if (this.StrV(s, "stage", "") == "scoring")
            {
                let ok = s.V.ContainsKey("_confirm") ? s.V["_confirm"] : CS.newArr(2, false);
                if (seat >= 0 && seat < ok.length && !ok[seat]) r.Add("score:ok");
                return r;
            }
            if (s.Turn != seat) return r;
            let ko = this.IntV(s, "ko", -1);
            for (let i = 0; i < s.Cells.length; i++)
            {
                if (this.Cell(s, i) != "" || i == ko) continue;
                if (!this.Suicide(s, i, seat)) r.Add("c:" + i);
            }
            r.Add("pass");
            return r;
        }
        Act(s, seat, action, d)
        {
            if (action == "score")
            {
                let ok = s.V.ContainsKey("_confirm") ? s.V["_confirm"] : CS.newArr(2, false);
                if (seat < 0 || seat >= ok.length) return MoveResult.Fail("只有对局双方能确认死活");
                ok[seat] = true; s.V["_confirm"] = ok;
                this.Say(s, (seat == 0 ? "黑" : "白") + "确认死活方案");
                if (ok[0] && ok[1]) this.Count(s);
                return MoveResult.Good("已确认");
            }
            if (action == "pass")
            {
                let p = this.IntV(s, "passes", 0) + 1; s.V["passes"] = p;
                if (p >= 2)
                {
                    if (this.OptB(s, "deadConfirm", true))
                    {
                        s.V["stage"] = "scoring"; s.V["_confirm"] = CS.newArr(2, false);
                        s.PhaseName = "死活确认 · 双方确认后数子";
                        s.V["_phase"] = "vote";
                        this.Say(s, "双方虚着，进入死活确认：请双方确认后再数子");
                    }
                    else this.Count(s);
                    return MoveResult.Good();
                }
                this.Say(s, (seat == 0 ? "黑" : "白") + "虚着");
                this.Next(s, -1); return MoveResult.Good();
            }
            if (action != "c") return MoveResult.Fail("未知动作");
            let i = Cfg.I(Cfg.Rest(CS.str(d["code"])));
            if (!this.Legal(s, seat).Contains("c:" + i)) return MoveResult.Fail("禁着点 / 劫争 / 自杀");
            let me = this.SideChar(seat), op = this.SideChar(1 - seat);
            s.V["passes"] = 0;
            s.Cells[i] = me; s.Last = "c:" + i;
            let captured = 0, lastCap = -1;
            let nb = this.Neighbors(s, i);
            for (let k = 0; k < nb.length; k++)
            {
                if (this.Cell(s, nb[k]) != op) continue;
                let st = [], lb = [];
                this.Group(s, nb[k], op, st, lb);
                if (lb.length == 0)
                {
                    for (let m = 0; m < st.length; m++) { s.Cells[st[m]] = ""; captured++; lastCap = st[m]; }
                }
            }
            let capKey = seat == 0 ? "cap0" : "cap1";
            s.V[capKey] = this.IntV(s, capKey, 0) + captured;
            let own = [], ownLib = [];
            this.Group(s, i, me, own, ownLib);
            s.V["ko"] = (captured == 1 && own.length == 1 && ownLib.length == 1) ? lastCap : -1;
            this.Next(s, -1); return MoveResult.Good(captured > 0 ? "提 " + captured + " 子" : "");
        }

        Count(s)
        {
            let a = 0, b = 0;
            let done = new CS.Set();
            for (let i = 0; i < s.Cells.length; i++)
            {
                if (this.Cell(s, i) == "r") { a++; continue; }
                if (this.Cell(s, i) == "b") { b++; continue; }
                if (done.Contains(i)) continue;
                let st = new CS.Stack(); st.Push(i); done.Add(i);
                let ra = 0, rb = 0, size = 0;
                while (st.length > 0)
                {
                    let p = st.Pop(); size++;
                    let nb = this.Neighbors(s, p);
                    for (let k = 0; k < nb.length; k++)
                    {
                        let q = nb[k]; let c = this.Cell(s, q);
                        if (c == "r") ra++;
                        else if (c == "b") rb++;
                        else if (!done.Contains(q)) { done.Add(q); st.Push(q); }
                    }
                }
                if (ra > 0 && rb == 0) a += size;
                else if (rb > 0 && ra == 0) b += size;
            }
            let h = this.OptI(s, "handicap", this.IntV(s, "handicap", 0));
            let km = this.OptS(s, "komi", "3.5");
            let scoreMode = this.OptS(s, "scoring", "area");

            let komi;
            let territory = scoreMode == "territory" || km == "6.5";
            if (territory) komi = 6.5;
            else if (km == "3.75") komi = 3.75;
            else if (km == "2.75") komi = 2.75;
            else komi = 3.5;
            if (h > 0) komi = 0;
            let diff = territory ? (a - b) : (a - b) / 2.0;

            let draw = !territory && Math.abs(diff - komi) < 0.001;
            let winner = diff > komi ? 0 : (draw ? -1 : 1);
            let rule = territory ? "日韩数目 6.5 目" : ("中国数子 贴 " + komi.ToString("0.##") + " 子");
            this.Finish(s, winner, "终局 黑 " + a + " : 白 " + b + " · " + rule +
                (h > 0 ? " · 让 " + h + " 子" : "") + (draw ? "，和棋" : ""));
        }
    }

    class MillsGame extends RuleBase
    {
        get Id() { return "mills"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 2; }
        get Variants() { return [ "成三" ]; }
        lines = [];
        points = [];
        adj = [];
        BuildGraph()
        {
            if (this.points.length > 0) return;

            for (let r = 0; r < 3; r++)
            {
                let d = 3 - r;
                let xy = [
                    3-d,3-d, 3,3-d, 3+d,3-d, 3+d,3,
                    3+d,3+d, 3,3+d, 3-d,3+d, 3-d,3
                ];
                for (let k = 0; k < 8; k++) this.points.Add(xy[k * 2 + 1] * 7 + xy[k * 2]);
                let b = r * 8;
                this.lines.Add([ this.points[b + 0], this.points[b + 1], this.points[b + 2] ]);
                this.lines.Add([ this.points[b + 2], this.points[b + 3], this.points[b + 4] ]);
                this.lines.Add([ this.points[b + 4], this.points[b + 5], this.points[b + 6] ]);
                this.lines.Add([ this.points[b + 6], this.points[b + 7], this.points[b + 0] ]);
            }
            for (let k = 1; k < 8; k += 2)
                this.lines.Add([ this.points[k], this.points[8 + k], this.points[16 + k] ]);
            for (let i = 0; i < this.points.length; i++) this.adj.Add(CS.newArr(0, 0));
            for (let i = 0; i < this.lines.length; i++)
                for (let k = 0; k < 2; k++)
                {
                    let a = this.points.IndexOf(this.lines[i][k]), b = this.points.IndexOf(this.lines[i][k + 1]);
                    let la = (this.adj[a]).slice(); if (!la.Contains(this.points[b])) la.Add(this.points[b]); this.adj[a] = la.ToArray();
                    let lb = (this.adj[b]).slice(); if (!lb.Contains(this.points[a])) lb.Add(this.points[a]); this.adj[b] = lb.ToArray();
                }
        }
        Build(variant, seats, seed, room)
        {
            this.BuildGraph();
            let s = new GameState(); this.SetGrid(s, 7, 7);
            s.V["left0"] = 9; s.V["left1"] = 9; s.V["placed0"] = 0; s.V["placed1"] = 0;
            return s;
        }
        IsMill(s, i, p)
        {
            for (let k = 0; k < this.lines.length; k++)
            {
                let L = this.lines[k];
                if (L[0] != i && L[1] != i && L[2] != i) continue;
                if (this.Cell(s, L[0]) == p && this.Cell(s, L[1]) == p && this.Cell(s, L[2]) == p) return true;
            }
            return false;
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat) return r;
            let cap = this.StrV(s, "capture", "");
            if (cap == "yes")
            {
                let op = this.SideChar(1 - seat);
                for (let i = 0; i < this.points.length; i++)
                {
                    let p = this.points[i];
                    if (this.Cell(s, p) != op) continue;
                    if (!this.IsMill(s, p, op) || this.OnlyMills(s, op)) r.Add("x:" + p);
                }
                return r;
            }
            if (this.IntV(s, "left" + seat, 0) > 0)
            {
                for (let i = 0; i < this.points.length; i++) if (this.Cell(s, this.points[i]) == "") r.Add("c:" + this.points[i]);
                return r;
            }
            let me = this.SideChar(seat);
            let cnt = 0; for (let i = 0; i < this.points.length; i++) if (this.Cell(s, this.points[i]) == me) cnt++;
            for (let i = 0; i < this.points.length; i++)
            {
                if (this.Cell(s, this.points[i]) != me) continue;
                for (let k = 0; k < this.adj[i].length; k++)
                    if (this.Cell(s, this.adj[i][k]) == "") r.Add("m:" + this.points[i] + ">" + this.adj[i][k]);
                if (cnt <= 3)
                    for (let j = 0; j < this.points.length; j++)
                        if (this.Cell(s, this.points[j]) == "") r.Add("m:" + this.points[i] + ">" + this.points[j]);
            }
            if (r.length == 0) r.Add("pass");
            return r;
        }
        OnlyMills(s, op)
        {
            for (let i = 0; i < this.points.length; i++)
                if (this.Cell(s, this.points[i]) == op && !this.IsMill(s, this.points[i], op)) return false;
            return true;
        }
        Act(s, seat, action, d)
        {
            let code = CS.str(d["code"]);
            let me = this.SideChar(seat), op = this.SideChar(1 - seat);
            if (action == "x")
            {
                let i = Cfg.I(Cfg.Rest(code));
                if (!this.Legal(s, seat).Contains(code)) return MoveResult.Fail("不可提该子");
                s.Cells[i] = ""; s.V["capture"] = ""; s.Last = "x:" + i;
                this.CheckEnd(s, seat); this.Next(s, -1); return MoveResult.Good();
            }
            if (action == "pass") { this.Finish(s, 1 - seat, "无子可动，负"); return MoveResult.Good(); }
            let target = -1, from = -1;
            if (action == "c") target = Cfg.I(Cfg.Rest(code));
            else if (action == "m") { let ij = this.ParsePair(Cfg.Rest(code), '>'); from = ij[0]; target = ij[1]; }
            else return MoveResult.Fail("未知动作");
            if (!this.Legal(s, seat).Contains(code)) return MoveResult.Fail("非法走法");
            if (from >= 0) s.Cells[from] = "";
            else s.V["left" + seat] = this.IntV(s, "left" + seat, 0) - 1;
            s.Cells[target] = me; s.Last = code;
            if (this.IsMill(s, target, me))
            {
                let any = false;
                for (let i = 0; i < this.points.length; i++)
                    if (this.Cell(s, this.points[i]) == op && (!this.IsMill(s, this.points[i], op) || this.OnlyMills(s, op))) { any = true; break; }
                if (any) { s.V["capture"] = "yes"; this.Say(s, "成三！请提对方一子"); return MoveResult.Good("成三"); }
            }
            this.CheckEnd(s, seat); this.Next(s, -1); return MoveResult.Good();
        }
        CheckEnd(s, seat)
        {
            let op = this.SideChar(1 - seat);
            let cnt = 0; for (let i = 0; i < this.points.length; i++) if (this.Cell(s, this.points[i]) == op) cnt++;
            let keep = s.Turn; s.Turn = 1 - seat;
            let reply = this.Legal(s, 1 - seat);
            s.Turn = keep;
            if (cnt < 3 || reply.length == 1 && reply[0] == "pass") this.Finish(s, seat, "对方不足三子 / 无路可走，胜");
        }
        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            d["boardPoints"] = this.points.Select(x => CS.str(x)).ToArray();
            d["boardLines"] = this.lines.Select(L => CS.join(",", L.Select(x => CS.str(x)).ToArray())).ToArray();
            return d;
        }
    }

    class HexJumpGame extends RuleBase
    {
        get Id() { return "tiaogi"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 6; }
        get Variants() { return [ "2人", "3人", "6人" ]; }
        axial = [];
        index = [];
        static HEX = [
            [1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]
        ];
        BuildBoard()
        {
            if (this.axial.length > 0) return;
            let widths = [ 1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1 ];
            for (let y = 0; y < widths.length; y++)
            {
                let w = widths[y], start = (13 - w) / 2;
                for (let x = 0; x < w; x++) this.index[y * 17 + start + x] = this.axial.length;
            }

            this.axial.Clear();
            for (let kv of CS.entries(this.index)) this.axial.Add([ kv.Key % 17, kv.Key / 17 ]);
        }

        Neighbor(x, y, k)
        {
            let dx = HexJumpGame.HEX[k][0], dy = HexJumpGame.HEX[k][1];
            if (dy == 0) return y * 17 + (x + dx);
            let nx = x + dx, ny = y + dy;
            let a = ny * 17 + nx;
            if (ny >= 0 && ny < 17 && nx >= 0 && nx < 17 && this.index.ContainsKey(a)) return a;
            let shift = (y % 2 == 0) ? 1 : -1;
            let b = ny * 17 + (nx + shift);
            if (ny >= 0 && ny < 17 && nx + shift >= 0 && nx + shift < 17 && this.index.ContainsKey(b)) return b;
            return -1;
        }
        Build(variant, seats, seed, room)
        {
            this.BuildBoard();
            let s = new GameState(); this.SetGrid(s, 17, 17);
            for (let i = 0; i < s.Cells.length; i++) s.Cells[i] = "#";
            for (let kv of CS.entries(this.index)) s.Cells[kv.Key] = "";

            let dirs = [ [0,-1],[1,-1],[1,0],[0,1],[-1,1],[-1,0] ];
            for (let seat = 0; seat < 6; seat++)
            {
                let score = [];
                let order = [];
                for (let kv of CS.entries(this.index))
                {
                    let x = kv.Key % 17, y = kv.Key / 17;
                    score[kv.Key] = (x - 8) * dirs[seat][0] + (y - 8) * dirs[seat][1];
                    order.Add(kv.Key);
                }
                order.Sort((a, b) => { return score[b].CompareTo(score[a]); });
                let camp = CS.newArr(10, 0);
                for (let k = 0; k < 10; k++) camp[k] = order[k];
                s.V["camp" + seat] = camp;
            }
            let use = seats == 2 ? [ 0, 3 ] : seats == 3 ? [ 0, 2, 4 ] : [ 0, 1, 2, 3, 4, 5 ];
            for (let i = 0; i < seats; i++)
            {
                let camp = s.V["camp" + use[i]];
                for (let k = 0; k < camp.length; k++) s.Cells[camp[k]] = this.SideChar(i);
                s.V["home" + i] = camp;
                s.V["goal" + i] = s.V["camp" + use[(i + (seats == 2 ? 1 : seats / 2)) % use.length]];
            }
            return s;
        }
        Jumps(s, from)
        {
            let res = [];
            let seen = new CS.Set(); seen.Add(from);
            let q = new CS.Queue(); q.Enqueue(from);
            while (q.length > 0)
            {
                let p = q.Dequeue(), x = p % 17, y = p / 17;
                for (let k = 0; k < HexJumpGame.HEX.length; k++)
                {
                    let mid = this.Neighbor(x, y, k);
                    if (mid < 0 || mid >= s.Cells.length || this.Cell(s, mid) == "#" || this.Cell(s, mid) == "") continue;
                    let mx = mid % 17, my = mid / 17;
                    let dst = this.Neighbor(mx, my, k);
                    if (dst < 0 || dst >= s.Cells.length || this.Cell(s, dst) != "" || seen.Contains(dst)) continue;
                    seen.Add(dst); res.Add(dst); q.Enqueue(dst);
                }
            }
            return res;
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat) return r;
            for (let p = 0; p < s.Cells.length; p++)
            {
                if (this.Cell(s, p) != this.SideChar(seat)) continue;
                let x = p % 17, y = p / 17;
                for (let k = 0; k < HexJumpGame.HEX.length; k++)
                {
                    let n = this.Neighbor(x, y, k);
                    if (n >= 0 && n < s.Cells.length && this.Cell(s, n) == "") r.Add("m:" + p + ">" + n);
                }
                let j = this.Jumps(s, p);
                for (let k = 0; k < j.length; k++) r.Add("m:" + p + ">" + j[k]);
            }
            if (r.length == 0) r.Add("pass");
            return r;
        }
        Act(s, seat, action, d)
        {
            if (action == "pass") { this.Next(s, -1); return MoveResult.Good(); }
            if (action != "m") return MoveResult.Fail("未知动作");
            let code = CS.str(d["code"]);
            if (!this.Legal(s, seat).Contains(code)) return MoveResult.Fail("非法跳跃");
            let ij = this.ParsePair(Cfg.Rest(code), '>');
            s.Cells[ij[0]] = ""; s.Cells[ij[1]] = this.SideChar(seat); s.Last = code;
            let goal = s.V.ContainsKey("goal" + seat) ? s.V["goal" + seat] : CS.newArr(0, 0);
            let win = goal.length > 0;
            for (let k = 0; k < goal.length; k++) if (this.Cell(s, goal[k]) != this.SideChar(seat)) { win = false; break; }
            if (win) { this.Finish(s, seat, "占满对面营，胜"); return MoveResult.Good(); }
            this.Next(s, -1); return MoveResult.Good();
        }
        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            let pts = [];
            for (let kv of CS.entries(this.index)) pts.Add(CS.str(kv.Key));
            d["boardPoints"] = pts.ToArray();
            return d;
        }
    }


// ===== PieceGames.cs =====
    class XiangqiGame extends RuleBase
    {
        get Id() { return "xiangqi"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 2; }
        get Variants() { return [ "标准", "快棋" ]; }
        static BACK = [ "R", "N", "B", "A", "K", "A", "B", "N", "R" ];
        Build(variant, seats, seed, room)
        {
            let s = new GameState(); this.SetGrid(s, 9, 10);
            for (let x = 0; x < 9; x++)
            {
                s.Cells[this.At(s, x, 0)] = "b" + XiangqiGame.BACK[x];
                s.Cells[this.At(s, x, 9)] = "r" + XiangqiGame.BACK[x];
            }
            s.Cells[this.At(s, 1, 2)] = "bC"; s.Cells[this.At(s, 7, 2)] = "bC";
            s.Cells[this.At(s, 1, 7)] = "rC"; s.Cells[this.At(s, 7, 7)] = "rC";
            let px = [ 0, 2, 4, 6, 8 ];
            for (let k = 0; k < px.length; k++)
            {
                s.Cells[this.At(s, px[k], 3)] = "bP";
                s.Cells[this.At(s, px[k], 6)] = "rP";
            }
            s.V["posLast"] = ""; s.V["posCount"] = 0; s.V["checkBy"] = -1;
            s.V["half"] = 0;
            return s;
        }
        Forward(seat) { return seat == 0 ? -1 : 1; }
        OwnHalf(seat, y) { return seat == 0 ? y >= 5 : y <= 4; }
        Palace(seat, x, y)
        {
            if (x < 3 || x > 5) return false;
            return seat == 0 ? (y >= 7 && y <= 9) : (y >= 0 && y <= 2);
        }
        KingAt(s, seat)
        {
            let k = this.SideChar(seat) + "K";
            for (let i = 0; i < s.Cells.length; i++) if (this.Cell(s, i) == k) return i;
            return -1;
        }
        static ORTHO = [
            [1,0],[-1,0],[0,1],[0,-1]
        ];
        static DIAG = [
            [1,1],[1,-1],[-1,1],[-1,-1]
        ];
        static KNIGHT = [
            [1,2,0,1],[-1,2,0,1],[1,-2,0,-1],[-1,-2,0,-1],
            [2,1,1,0],[2,-1,1,0],[-2,1,-1,0],[-2,-1,-1,0]
        ];

        Pseudo(s, from)
        {
            let r = [];
            let c = this.Cell(s, from);
            if (c.length < 2) return r;
            let seat = this.SideOf(c), x = this.X(s, from), y = this.Y(s, from);
            let t = c[1];
            let add = (nx, ny) =>
            {
                if (!this.Inside(s, nx, ny)) return;
                let to = this.At(s, nx, ny);
                if (this.SideOf(this.Cell(s, to)) == seat) return;
                r.Add(to);
            };
            if (t == 'R' || t == 'C')
            {
                for (let k = 0; k < XiangqiGame.ORTHO.length; k++)
                {
                    let nx = x + XiangqiGame.ORTHO[k][0], ny = y + XiangqiGame.ORTHO[k][1];
                    let jumped = false;
                    while (this.Inside(s, nx, ny))
                    {
                        let to = this.At(s, nx, ny);
                        if (!jumped)
                        {
                            if (this.Cell(s, to) == "") r.Add(to);
                            else { if (t == 'R' && this.SideOf(this.Cell(s, to)) != seat) r.Add(to); jumped = true; }
                        }
                        else if (this.Cell(s, to) != "")
                        {
                            if (t == 'C' && this.SideOf(this.Cell(s, to)) != seat) r.Add(to);
                            break;
                        }
                        nx += XiangqiGame.ORTHO[k][0]; ny += XiangqiGame.ORTHO[k][1];
                    }
                }
            }
            else if (t == 'N')
            {
                for (let k = 0; k < XiangqiGame.KNIGHT.length; k++)
                {
                    let nx = x + XiangqiGame.KNIGHT[k][0], ny = y + XiangqiGame.KNIGHT[k][1];
                    let lx = x + XiangqiGame.KNIGHT[k][2], ly = y + XiangqiGame.KNIGHT[k][3];
                    if (!this.Inside(s, lx, ly) || this.Cell(s, this.At(s, lx, ly)) != "") continue;
                    add(nx, ny);
                }
            }
            else if (t == 'B')
            {
                for (let k = 0; k < XiangqiGame.DIAG.length; k++)
                {
                    let nx = x + 2 * XiangqiGame.DIAG[k][0], ny = y + 2 * XiangqiGame.DIAG[k][1];
                    let ex = x + XiangqiGame.DIAG[k][0], ey = y + XiangqiGame.DIAG[k][1];
                    if (!this.Inside(s, nx, ny) || !this.OwnHalf(seat, ny)) continue;
                    if (this.Cell(s, this.At(s, ex, ey)) != "") continue;
                    add(nx, ny);
                }
            }
            else if (t == 'A')
            {
                for (let k = 0; k < XiangqiGame.DIAG.length; k++)
                {
                    let nx = x + XiangqiGame.DIAG[k][0], ny = y + XiangqiGame.DIAG[k][1];
                    if (!this.Palace(seat, nx, ny)) continue;
                    add(nx, ny);
                }
            }
            else if (t == 'K')
            {
                for (let k = 0; k < XiangqiGame.ORTHO.length; k++)
                {
                    let nx = x + XiangqiGame.ORTHO[k][0], ny = y + XiangqiGame.ORTHO[k][1];
                    if (!this.Palace(seat, nx, ny)) continue;
                    add(nx, ny);
                }

                let op = this.KingAt(s, 1 - seat);
                if (op >= 0 && this.X(s, op) == x)
                {
                    let clear = true;
                    let lo = Math.min(y, this.Y(s, op)) + 1, hi = Math.max(y, this.Y(s, op));
                    for (let yy = lo; yy < hi; yy++) if (this.Cell(s, this.At(s, x, yy)) != "") { clear = false; break; }
                    if (clear) r.Add(op);
                }
            }
            else if (t == 'P')
            {
                let ny = y + this.Forward(seat);
                add(x, ny);
                if (!this.OwnHalf(seat, y)) { add(x - 1, y); add(x + 1, y); }
            }
            return r;
        }
        InCheck(s, seat)
        {
            let k = this.KingAt(s, seat);
            if (k < 0) return true;
            for (let i = 0; i < s.Cells.length; i++)
                if (this.SideOf(this.Cell(s, i)) == 1 - seat && this.Pseudo(s, i).Contains(k)) return true;
            return false;
        }
        Safe(s, from, to, seat)
        {
            let keep = this.Cell(s, to);
            s.Cells[to] = this.Cell(s, from); s.Cells[from] = "";
            let bad = this.InCheck(s, seat);
            s.Cells[from] = s.Cells[to]; s.Cells[to] = keep;
            return !bad;
        }
        Moves(s, seat)
        {
            let r = [];
            for (let i = 0; i < s.Cells.length; i++)
            {
                if (this.SideOf(this.Cell(s, i)) != seat) continue;
                let ps = this.Pseudo(s, i);
                for (let k = 0; k < ps.length; k++)
                    if (this.Safe(s, i, ps[k], seat)) r.Add("m:" + i + ">" + ps[k]);
            }
            return r;
        }
        Legal(s, seat)
        {
            if (s.Ended || s.Turn != seat) return [];
            return this.Moves(s, seat);
        }
        Hash(s)
        {
            let b = new CS.SB();
            for (let i = 0; i < s.Cells.length; i++) b.Append(this.Cell(s, i)).Append('|');
            return CS.str(b);
        }
        Act(s, seat, action, d)
        {
            if (action != "m") return MoveResult.Fail("未知动作");
            let code = CS.str(d["code"]);
            if (!this.Moves(s, seat).Contains(code)) return MoveResult.Fail("非法着法 / 送将");
            let ij = this.ParsePair(Cfg.Rest(code), '>');
            let eaten = this.Cell(s, ij[1]);
            this.Put(s, ij[0], ij[1], code);
            let op = 1 - seat;
            let check = this.InCheck(s, op);
            let savedTurn = s.Turn; s.Turn = op;
            let noReply = this.Moves(s, op).length == 0;
            s.Turn = savedTurn;
            if (eaten == this.SideChar(op) + "K") { this.Finish(s, seat, "吃掉将帅，胜"); return MoveResult.Good(); }
            if (noReply) { this.Finish(s, seat, check ? "将死，胜" : "困毙，胜"); return MoveResult.Good(); }
            let h = this.Hash(s);
            if (this.StrV(s, "posLast", "") == h)
            {
                let c = this.IntV(s, "posCount", 0) + 1;
                s.V["posCount"] = c;
                if (c >= 3 && check && this.IntV(s, "checkBy", -1) == seat && this.OptB(s, "longCheck", true))
                { this.Finish(s, op, "长将判负"); return MoveResult.Good(); }
            }
            else { s.V["posCount"] = 1; s.V["posLast"] = h; }
            s.V["checkBy"] = check ? seat : -1;

            let half = eaten.length > 0 ? 0 : this.IntV(s, "half", 0) + 1;
            s.V["half"] = half;
            if (this.OptB(s, "rule60", true) && half >= 120)
            { this.Finish(s, -1, "连续 60 回合未吃子 · 自然限着和棋"); return MoveResult.Good(); }
            this.Say(s, check ? "将军！" : "");
            this.Next(s, -1); return MoveResult.Good(check ? "将军" : "");
        }
    }

    class DarkGame extends RuleBase
    {
        _id ;
        constructor(id) { super(); this._id = id; }
        get Id() { return this._id; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 2; }
        get Variants() {
                if (this._id == "jieqi") return [ "标准" ];
                if (this._id == "xiangqidark") return [ "标准" ];
                if (this._id == "junqi") return [ "暗棋", "翻棋" ];
                return [ "标准", "翻棋" ];
            }
        static XQ_RANK = {
            'K':7,'A':6,'B':5,'N':4,'R':3,'C':2,'P':1
        };
        static JQ_RANK = {
            '9':9,'8':8,'7':7,'6':6,'5':5,'4':4,'3':3,'2':2,'1':1,'0':0,'F':-1,'B':10
        };
        static DS_RANK = {
            '8':8,'7':7,'6':6,'5':5,'4':4,'3':3,'2':2,'1':1
        };
        IsJieqi() { return this._id == "jieqi"; }
        IsDoushou() { return this._id == "doushou"; }
        IsJunqi() { return this._id == "junqi"; }

        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.V["hidden"] = true;
            s.V["flipped"] = 0;
            if (this.IsJieqi())
            {
                this.SetGrid(s, 9, 10);
                let pieces = [];
                let types = [ "R", "N", "B", "A", "K", "A", "B", "N", "R", "C", "C", "P", "P", "P", "P", "P" ];
                for (let i = 0; i < types.length; i++) { pieces.Add("r" + types[i]); pieces.Add("b" + types[i]); }
                this.Shuffle(s, pieces);
                let slots = [];
                for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) slots.Add(this.At(s, x, y));

                let use = [];
                for (let y = 0; y < 4; y++) for (let x = 0; x < 9; x++) if (y < 3 || x == 1 || x == 7) use.Add(this.At(s, x, y));
                for (let y = 6; y < 10; y++) for (let x = 0; x < 9; x++) if (y > 6 || x == 1 || x == 7) use.Add(this.At(s, x, y));
                for (let i = 0; i < pieces.length && i < use.length; i++) s.Cells[use[i]] = "?" + pieces[i];
            }
            else if (this.IsDoushou() && variant != "翻棋")
            {
                this.SetGrid(s, 7, 9);
                let top = [ "1", "4", "5", "6", "7", "5", "4" ];
                for (let x = 0; x < 7; x++)
                {
                    s.Cells[this.At(s, x, 0)] = "b" + top[x];
                    s.Cells[this.At(s, x, 8)] = "r" + top[x];
                }
                let bx = [ 0, 2, 4, 6 ];
                for (let k = 0; k < bx.length; k++)
                {
                    s.Cells[this.At(s, bx[k], 1)] = "b8"; s.Cells[this.At(s, bx[k], 7)] = "r8";
                }
                s.V["hidden"] = false;
                s.V["trap0"] = [ this.At(s, 2, 8), this.At(s, 4, 8), this.At(s, 3, 7) ];
                s.V["trap1"] = [ this.At(s, 2, 0), this.At(s, 4, 0), this.At(s, 3, 1) ];
                s.V["den0"] = this.At(s, 3, 8); s.V["den1"] = this.At(s, 3, 0);
                s.V["river"] = [ 3, 4, 5 ];
            }
            else
            {
                let w = 4, h = 8;
                this.SetGrid(s, w, h);
                let pieces = [];
                if (this.IsJunqi())
                {
                    let t = [ "9", "8", "8", "7", "7", "6", "6", "5", "5", "4", "4", "3", "3", "2", "2", "1", "1", "1", "0", "0", "0", "F", "B", "B", "9", "8", "7", "6", "5", "4", "3", "2" ];
                    for (let i = 0; i < 32; i++) pieces.Add((i < 16 ? "r" : "b") + t[i]);
                }
                else
                {
                    let t = [ "K", "A", "A", "B", "B", "N", "N", "R", "R", "C", "C", "P", "P", "P", "P", "P" ];
                    for (let i = 0; i < t.length; i++) { pieces.Add("r" + t[i]); pieces.Add("b" + t[i]); }
                }
                this.Shuffle(s, pieces);
                for (let i = 0; i < pieces.length; i++) s.Cells[i] = "?" + pieces[i];
            }
            return s;
        }
        True(s, i)
        {
            let c = this.Cell(s, i);
            return c.length > 0 && c[0] == '?' ? CS.substr(c, 1) : c;
        }
        FaceUp(s, i)
        {
            let c = this.Cell(s, i);
            return c.length > 1 && c[0] != '?' && c[0] != '#';
        }
        Level(c)
        {
            if (this.IsJieqi() || this._id == "xiangqidark") { let v; return CS.tg(DarkGame.XQ_RANK, c[1], _v => v = _v).ok ? v : 0; }
            if (this.IsJunqi()) { let v; return CS.tg(DarkGame.JQ_RANK, c[1], _v => v = _v).ok ? v : 0; }
            let w; return CS.tg(DarkGame.DS_RANK, c[1], _v => w = _v).ok ? w : 0;
        }
        CanCapture(s, from, to, seat)
        {
            let a = this.True(s, from), b = this.True(s, to);
            if (a.length < 2 || b.length < 2) return false;
            if (this.SideOf(b) == seat) return false;
            if (this.IsDoushou())
            {

                let tp; if (this.OptB(s, "trapRule", true) && CS.tg(s.V, "trap" + (1 - seat), _v => tp = _v).ok)
                {
                    let traps = tp;
                    if (traps != null && CS.indexOf(traps, to) >= 0) return true;
                }
                let river = s.V.ContainsKey("river") ? s.V["river"] : CS.newArr(0, 0);
                let inRiver = CS.indexOf(river, this.Y(s, from)) >= 0 || CS.indexOf(river, this.Y(s, to)) >= 0;
                if (this.OptB(s, "riverRule", true) && inRiver && (this.Level(a) == 8 || this.Level(b) == 8)) return false;
            }
            if (this.IsJieqi())
            {

                return this.Level(a) >= this.Level(b);
            }
            if (this._id == "xiangqidark")
            {
                if (a[1] == 'P' && b[1] == 'K') return true;
                if (a[1] == 'K' && b[1] == 'P') return false;
                return this.Level(a) >= this.Level(b);
            }
            if (this.IsJunqi())
            {
                if (a[1] == 'B' || b[1] == 'B') return true;
                if (b[1] == 'F') return true;
                if (b[1] == '0') return a[1] == '1';
                return this.Level(a) >= this.Level(b);
            }

            if (this.OptB(s, "mouseElephant", true))
            {
                if (a[1] == '1' && b[1] == '8') return true;
                if (a[1] == '8' && b[1] == '1') return false;
            }
            let trap = this.OptB(s, "trapRule", true) && s.V.ContainsKey("trap" + (1 - seat))
                ? s.V["trap" + (1 - seat)] : CS.newArr(0, 0);
            if (CS.indexOf(trap, to) >= 0) return true;
            return this.Level(a) >= this.Level(b);
        }
        Steps(s, i)
        {
            let r = [];
            let x = this.X(s, i), y = this.Y(s, i);
            for (let k = 0; k < DarkGame.ORTHO_D.length; k++)
            {
                let nx = x + DarkGame.ORTHO_D[k][0], ny = y + DarkGame.ORTHO_D[k][1];
                if (this.Inside(s, nx, ny)) r.Add(this.At(s, nx, ny));
            }

            if (this.IsDoushou() && this.OptB(s, "riverRule", true))
            {
                let c = this.True(s, i);
                if (c.length > 1 && (this.Level(c) == 7 || this.Level(c) == 6))
                {
                    let river = s.V.ContainsKey("river") ? s.V["river"] : CS.newArr(0, 0);
                    if (river.length >= 3)
                    {
                        let toY = -1;
                        if (y == river[0] - 1) toY = river[river.length - 1] + 1;
                        else if (y == river[river.length - 1] + 1) toY = river[0] - 1;
                        if (toY >= 0 && toY < s.Height)
                        {
                            let clear = true;
                            for (let k = 0; k < river.length; k++)
                                if (this.Cell(s, this.At(s, x, river[k])) != "") { clear = false; break; }
                            if (clear)
                            {
                                let dest = this.At(s, x, toY);
                                let seat = this.SideOf(this.Cell(s, i));
                                if (this.Cell(s, dest) == "" || this.CanCapture(s, i, dest, seat)) r.Add(dest);
                            }
                        }
                    }
                }
            }
            return r;
        }
        static ORTHO_D = [
            [1,0],[-1,0],[0,1],[0,-1]
        ];
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat) return r;
            if (this.BoolV(s, "hidden", false))
            {
                for (let i = 0; i < s.Cells.length; i++)
                {
                    let c = this.Cell(s, i);
                    if (c.length > 0 && c[0] == '?') { r.Add("f:" + i); continue; }
                    if (!this.FaceUp(s, i) || this.SideOf(c) != seat) continue;
                    let nb = this.Steps(s, i);
                    for (let k = 0; k < nb.length; k++)
                    {
                        let t = nb[k];
                        if (this.Cell(s, t) == "" || this.CanCapture(s, i, t, seat)) r.Add("m:" + i + ">" + t);
                    }
                }
                return r;
            }

            for (let i = 0; i < s.Cells.length; i++)
            {
                if (this.SideOf(this.Cell(s, i)) != seat) continue;
                let nb = this.Steps(s, i);
                for (let k = 0; k < nb.length; k++)
                {
                    let t = nb[k];
                    if (this.IsDoushou())
                    {
                        let den = s.V.ContainsKey("den" + seat) ? CS.int(s.V["den" + seat]) : 0;
                        if (this.Y(s, t) == this.Y(s, den) && this.X(s, t) == this.X(s, den)) continue;
                        let river = s.V.ContainsKey("river") ? s.V["river"] : CS.newArr(0, 0);
                        let targetRiver = CS.indexOf(river, this.Y(s, t)) >= 0;
                        let mover = this.True(s, i);
                        let lvl = mover.length > 1 ? this.Level(mover) : 0;
                        if (targetRiver && lvl != 1) continue;
                        if (targetRiver && lvl == 1 && this.Cell(s, t) != "")
                        {
                            let target = this.True(s, t);
                            if (target.length > 1 && this.Level(target) == 8) continue;
                        }
                    }
                    if (this.Cell(s, t) == "" || this.CanCapture(s, i, t, seat)) r.Add("m:" + i + ">" + t);
                }
            }
            if (r.length == 0) r.Add("pass");
            return r;
        }
        Act(s, seat, action, d)
        {
            let code = CS.str(d["code"]);
            if (!this.Legal(s, seat).Contains(code)) return MoveResult.Fail("非法动作");
            if (action == "pass") { this.Finish(s, 1 - seat, "无子可动，负"); return MoveResult.Good(); }
            if (action == "f")
            {
                let i = Cfg.I(Cfg.Rest(code));
                s.Cells[i] = this.True(s, i); s.Last = "f:" + i;
                s.V["flipped"] = this.IntV(s, "flipped", 0) + 1;
                this.Say(s, "翻开一枚棋子");
                this.Next(s, -1); return MoveResult.Good();
            }
            if (action != "m") return MoveResult.Fail("未知动作");
            let ij = this.ParsePair(Cfg.Rest(code), '>');
            let eaten = this.True(s, ij[1]);
            let bomb = this.IsJunqi() && (this.True(s, ij[0]).EndsWith("B") || eaten.EndsWith("B"));
            s.Cells[ij[0]] = "";
            s.Cells[ij[1]] = bomb ? "" : this.True(s, ij[0]);
            if (bomb && eaten.length > 0) s.Cells[ij[1]] = "";
            s.Last = code;
            if (eaten.length > 1 && (eaten[1] == 'K' || eaten[1] == 'F'))
            { this.Finish(s, seat, "吃掉主帅 / 扛旗，胜"); return MoveResult.Good(); }
            if (this.IsDoushou() && s.V.ContainsKey("den" + (1 - seat)) && ij[1] == CS.int(s.V["den" + (1 - seat)]))
            { this.Finish(s, seat, "进入对方兽穴，胜"); return MoveResult.Good(); }
            let alive = 0;
            for (let i = 0; i < s.Cells.length; i++) if (this.SideOf(this.True(s, i)) == 1 - seat) alive++;
            if (alive == 0) { this.Finish(s, seat, "对方无子，胜"); return MoveResult.Good(); }
            this.Next(s, -1); return MoveResult.Good();
        }
        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            d["hidden"] = this.BoolV(s, "hidden", false);
            return d;
        }
    }

    class ChessGame extends RuleBase
    {
        _id ;
        constructor(id) { super(); this._id = id; }
        get Id() { return this._id; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 2; }
        get Variants() { return this._id == "chess960" ? [ "随机初始" ] : [ "标准", "快棋" ]; }
        static N8 = [
            [1,2],[2,1],[2,-1],[1,-2],
            [-1,-2],[-2,-1],[-2,1],[-1,2]
        ];
        static D8 = [
            [1,1],[1,-1],[-1,1],[-1,-1]
        ];
        static O4 = [
            [1,0],[-1,0],[0,1],[0,-1]
        ];
        Build(variant, seats, seed, room)
        {
            let s = new GameState(); this.SetGrid(s, 8, 8);
            let back = [ "R", "N", "B", "Q", "K", "B", "N", "R" ];
            if (this._id == "chess960")
            {
                let b = (back).slice();
                this.Shuffle(s, b);

                for (let guard = 0; guard < 200; guard++)
                {
                    this.Shuffle(s, b);
                    let i1 = b.IndexOf("B"), i2 = b.LastIndexOf("B");
                    let k = b.IndexOf("K"), r1 = b.IndexOf("R"), r2 = b.LastIndexOf("R");
                    if (i1 % 2 != i2 % 2 && k > Math.min(r1, r2) && k < Math.max(r1, r2)) break;
                }
                back = b.ToArray();
            }
            for (let x = 0; x < 8; x++)
            {
                s.Cells[this.At(s, x, 0)] = "b" + back[x];
                s.Cells[this.At(s, x, 7)] = "w" + back[x];
                s.Cells[this.At(s, x, 1)] = "bP";
                s.Cells[this.At(s, x, 6)] = "wP";
            }
            s.V["castle0"] = 3; s.V["castle1"] = 3;
            s.V["ep"] = -1;
            s.V["_half"] = 0;
            s.V["_hist"] = [];
            (s.V["_hist"]).Add(this.Position(s, 0));
            return s;
        }
        W(seat) { return seat == 0 ? "w" : "b"; }
        Side(c)
        {
            if (c.length < 2) return -1;
            return c[0] == 'w' ? 0 : c[0] == 'b' ? 1 : -1;
        }
        KingAt(s, seat)
        {
            let k = this.W(seat) + "K";
            for (let i = 0; i < s.Cells.length; i++) if (this.Cell(s, i) == k) return i;
            return -1;
        }
        Pseudo(s, from)
        {
            let r = [];
            let c = this.Cell(s, from);
            if (c.length < 2) return r;
            let seat = this.Side(c), x = this.X(s, from), y = this.Y(s, from);
            let t = c[1];
            let add = (nx, ny) =>
            {
                if (!this.Inside(s, nx, ny)) return;
                let to = this.At(s, nx, ny);
                if (this.Side(this.Cell(s, to)) == seat) return;
                r.Add(to);
            };
            if (t == 'P')
            {
                let f = seat == 0 ? -1 : 1, start = seat == 0 ? 6 : 1;
                if (this.Inside(s, x, y + f) && this.Cell(s, this.At(s, x, y + f)) == "")
                {
                    add(x, y + f);
                    if (y == start && this.Cell(s, this.At(s, x, y + 2 * f)) == "") add(x, y + 2 * f);
                }
                for (let k = -1; k <= 1; k += 2)
                {
                    let nx = x + k, ny = y + f;
                    if (!this.Inside(s, nx, ny)) continue;
                    let to = this.At(s, nx, ny);
                    if (this.Side(this.Cell(s, to)) == 1 - seat) r.Add(to);
                    else if (this.OptB(s, "enPassant", true) && to == this.IntV(s, "ep", -1)) r.Add(to);
                }
                return r;
            }
            if (t == 'N')
            {
                for (let k = 0; k < ChessGame.N8.length; k++) add(x + ChessGame.N8[k][0], y + ChessGame.N8[k][1]);
                return r;
            }
            if (t == 'K')
            {
                for (let k = 0; k < ChessGame.D8.length; k++) add(x + ChessGame.D8[k][0], y + ChessGame.D8[k][1]);
                for (let k = 0; k < ChessGame.O4.length; k++) add(x + ChessGame.O4[k][0], y + ChessGame.O4[k][1]);
                return r;
            }
            let dirs = t == 'B' ? ChessGame.D8 : t == 'R' ? ChessGame.O4 : ChessGame.D8.Concat(ChessGame.O4).ToArray();
            for (let k = 0; k < dirs.length; k++)
            {
                let nx = x + dirs[k][0], ny = y + dirs[k][1];
                while (this.Inside(s, nx, ny))
                {
                    let to = this.At(s, nx, ny);
                    if (this.Cell(s, to) == "") r.Add(to);
                    else { if (this.Side(this.Cell(s, to)) != seat) r.Add(to); break; }
                    nx += dirs[k][0]; ny += dirs[k][1];
                }
            }
            return r;
        }
        InCheck(s, seat)
        {
            let k = this.KingAt(s, seat);
            if (k < 0) return true;
            for (let i = 0; i < s.Cells.length; i++)
                if (this.Side(this.Cell(s, i)) == 1 - seat && this.Pseudo(s, i).Contains(k)) return true;
            return false;
        }
        Safe(s, from, to, seat)
        {
            let keep = this.Cell(s, to), pc = this.Cell(s, from);

            let cap = -1; let capKeep = "";
            if (pc.length > 1 && pc[1] == 'P' && to == this.IntV(s, "ep", -1) &&
                X(s, from) != this.X(s, to) && this.Inside(s, this.X(s, to), this.Y(s, from)))
            {
                cap = this.At(s, this.X(s, to), this.Y(s, from));
                capKeep = this.Cell(s, cap); s.Cells[cap] = "";
            }
            s.Cells[to] = pc; s.Cells[from] = "";
            let bad = this.InCheck(s, seat);
            s.Cells[from] = s.Cells[to]; s.Cells[to] = keep;
            if (cap >= 0) s.Cells[cap] = capKeep;
            return !bad;
        }
        Moves(s, seat)
        {
            let r = [];
            for (let i = 0; i < s.Cells.length; i++)
            {
                if (this.Side(this.Cell(s, i)) != seat) continue;
                let ps = this.Pseudo(s, i);
            for (let k = 0; k < ps.length; k++)
            {
                if (!this.Safe(s, i, ps[k], seat)) continue;
                let bc = "m:" + i + ">" + ps[k];
                let type = this.Cell(s, i).length > 1 ? this.Cell(s, i)[1] : ' ';
                if (type == 'P' && (this.Y(s, ps[k]) == 0 || this.Y(s, ps[k]) == 7) && this.OptB(s, "promoteChoice", true))
                {
                    let opts = [ 'q', 'r', 'b', 'n' ];
                    for (let q = 0; q < opts.length; q++) r.Add(bc + "=" + opts[q]);
                }
                else r.Add(bc);
            }
        }
        this.CastleMoves(s, seat, r);
        return r;
        }
        Position(s, turn)
        {
            let sb = new CS.SB();
            for (let i = 0; i < s.Cells.length; i++) sb.Append(this.Cell(s, i).length == 0 ? "." : this.Cell(s, i));
            sb.Append('|').Append(turn).Append('|')
              .Append(this.IntV(s, "castle0", 0)).Append(this.IntV(s, "castle1", 0))
              .Append('|').Append(this.IntV(s, "ep", -1));
            return CS.str(sb);
        }
        CastleMoves(s, seat, r)
        {
            let kpos = this.KingAt(s, seat), ci = this.IntV(s, "castle" + seat, 0);
            if (kpos < 0 || ci == 0 || this.InCheck(s, seat)) return;
            let row = seat == 0 ? 7 : 0, kx = this.X(s, kpos);
            for (let side = 0; side < 2; side++)
            {
                if ((ci & (side == 0 ? 1 : 2)) == 0) continue;
                let dir = side == 0 ? 1 : -1, rookX = -1;
                for (let xx = kx + dir; xx >= 0 && xx < 8; xx += dir)
                    if (this.Cell(s, this.At(s, xx, row)) == this.W(seat) + "R") { rookX = xx; break; }
                if (rookX < 0) continue;
                let toX = side == 0 ? 6 : 2, rookToX = side == 0 ? 5 : 3;
                let kingTo = this.At(s, toX, row), rookFrom = this.At(s, rookX, row), rookTo = this.At(s, rookToX, row);
                let rook = this.Cell(s, rookFrom), rookKeep = this.Cell(s, rookTo);
                s.Cells[rookFrom] = ""; s.Cells[rookTo] = rook;
                let self = new CS.Set(); self.Add(kpos); self.Add(rookTo);
                let clear = true;
                let lo = Math.min(Math.min(kx, toX), Math.min(rookX, rookToX));
                let hi = Math.max(Math.max(kx, toX), Math.max(rookX, rookToX));
                for (let xx = lo; xx <= hi; xx++)
                {
                    let q = this.At(s, xx, row);
                    if (!self.Contains(q) && this.Cell(s, q) != "") { clear = false; break; }
                }
                let safe = clear;
                if (safe)
                {
                    let kc = this.Cell(s, kpos); s.Cells[kpos] = "";
                    let step = toX >= kx ? 1 : -1, xx2 = kx;
                    while (true)
                    {
                        if (xx2 != kx)
                        {
                            let q = this.At(s, xx2, row); let keep = this.Cell(s, q);
                            s.Cells[q] = kc;
                            if (this.InCheck(s, seat)) safe = false;
                            s.Cells[q] = keep;
                        }
                        if (xx2 == toX || !safe) break;
                        xx2 += step;
                    }
                    s.Cells[kpos] = kc;
                }
                s.Cells[rookFrom] = rook; s.Cells[rookTo] = rookKeep;
                if (safe) r.Add("o:" + kpos + ">" + kingTo);
            }
        }
        Legal(s, seat)
        {
            if (s.Ended || s.Turn != seat) return [];
            let r = this.Moves(s, seat);
            if (this.OptB(s, "threefold", true))
            {
                let cur = this.Position(s, s.Turn);
                let hist = s.V.ContainsKey("_hist") ? s.V["_hist"] : [];
                let n = 0;
                if (hist != null) for (let i = 0; i < hist.length; i++) if (hist[i] == cur) n++;
                if (n >= 3) r.Add("draw:threefold");
            }
            if (this.OptB(s, "rule50", true) && this.IntV(s, "_half", 0) >= 100) r.Add("draw:50");
            return r;
        }
        Act(s, seat, action, d)
        {
        let code = CS.str(d["code"]);
        if (action == "draw")
        {
            let why = code == "draw:50" ? "50 回合无吃子无兵动 · 提和成立" : "三次重复局面 · 提和成立";
            this.Finish(s, -1, why); return MoveResult.Good("和棋");
        }
        if (action != "m" && action != "o") return MoveResult.Fail("未知动作");
        if (!this.Moves(s, seat).Contains(code)) return MoveResult.Fail("非法着法 / 送王");
        let body = Cfg.Rest(code), promo = "";
        let eq = body.IndexOf('=');
        if (eq >= 0) { promo = CS.substr(body, eq + 1); body = CS.substr(body, 0, eq); }
        let ij = this.ParsePair(body, '>');
            let from = ij[0], to = ij[1];
            let piece = this.Cell(s, from), eaten = this.Cell(s, to);
            let savedEp = this.IntV(s, "ep", -1);
            s.V["ep"] = -1;
            if (piece.length > 1 && piece[1] == 'P' && Math.abs(this.Y(s, to) - this.Y(s, from)) == 2)
                s.V["ep"] = this.At(s, this.X(s, from), (this.Y(s, from) + this.Y(s, to)) / 2);
            if (piece.length > 1 && piece[1] == 'P' && to == savedEp)
            {
                let cap = this.At(s, this.X(s, to), this.Y(s, from));
                s.Cells[cap] = "";
            }
        s.Cells[from] = "";
        s.Cells[to] = piece;
        if (piece.length > 1 && piece[1] == 'P' && (this.Y(s, to) == 0 || this.Y(s, to) == 7))
        {
            let up = promo.length > 0 ? char.ToUpperInvariant(promo[0]) : 'Q';
            if ("QRBN".IndexOf(up) < 0) up = 'Q';
            s.Cells[to] = this.W(seat) + up;
        }
        if (action == "o")
        {
            let row = this.Y(s, to), kx = this.X(s, to);
            let rookToX = kx == 6 ? 5 : 3, dir = kx == 6 ? 1 : -1, rookX = -1;
            for (let xx = this.X(s, from) + dir; xx >= 0 && xx < 8; xx += dir)
                if (this.Cell(s, this.At(s, xx, row)) == this.W(seat) + "R") { rookX = xx; break; }
            if (rookX >= 0)
            {
                let rook = this.Cell(s, this.At(s, rookX, row));
                s.Cells[this.At(s, rookX, row)] = "";
                s.Cells[this.At(s, rookToX, row)] = rook;
            }
        }
            if (piece.length > 1 && piece[1] == 'K') s.V["castle" + seat] = 0;
            for (let k = 0; k < 2; k++)
            {
                let rx = k == 0 ? 7 : 0, row = seat == 0 ? 7 : 0;
                if (from == this.At(s, rx, row) || to == this.At(s, rx, row))
                    s.V["castle" + seat] = this.IntV(s, "castle" + seat, 0) & ~(k == 0 ? 1 : 2);
            }
        s.Last = code;
        let pawnMove = piece.length > 1 && piece[1] == 'P';
        let capture = eaten.length > 0 || (pawnMove && to == savedEp);
        s.V["_half"] = (pawnMove || capture) ? 0 : this.IntV(s, "_half", 0) + 1;
        let hist = s.V.ContainsKey("_hist") ? s.V["_hist"] : [];
        if (hist == null) { hist = []; s.V["_hist"] = hist; }
        hist.Add(this.Position(s, 1 - seat));
        if (hist.length > 300) hist.RemoveAt(0);
        if (eaten == this.W(1 - seat) + "K") { this.Finish(s, seat, "吃掉王，胜"); return MoveResult.Good(); }
        let op = 1 - seat, savedTurn = s.Turn; s.Turn = op;
        let noReply = this.Moves(s, op).length == 0;
        s.Turn = savedTurn;
        if (noReply)
        {
            let mate = this.InCheck(s, op);
            this.Finish(s, mate ? seat : -1, mate ? "将死，胜" : "逼和（无合法着法且未被将），和棋");
            return MoveResult.Good();
        }
        this.Next(s, -1); return MoveResult.Good();
        }
    }

    class ShogiGame extends RuleBase
    {
        get Id() { return "shogi"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 2; }
        get Variants() { return [ "标准" ]; }
        static BACK = [ "L", "N", "S", "G", "K", "G", "S", "N", "L" ];
        Build(variant, seats, seed, room)
        {
            let s = new GameState(); this.SetGrid(s, 9, 9);
            for (let x = 0; x < 9; x++)
            {
                s.Cells[this.At(s, x, 0)] = "b" + ShogiGame.BACK[x];
                s.Cells[this.At(s, x, 8)] = "r" + ShogiGame.BACK[x];
                s.Cells[this.At(s, x, 2)] = "bP";
                s.Cells[this.At(s, x, 6)] = "rP";
            }
            s.Cells[this.At(s, 1, 1)] = "bB"; s.Cells[this.At(s, 7, 1)] = "bR";
            s.Cells[this.At(s, 7, 7)] = "rB"; s.Cells[this.At(s, 1, 7)] = "rR";
            s.Hands[0] = []; s.Hands[1] = [];
            return s;
        }
        F(seat) { return seat == 0 ? -1 : 1; }
        Promotable(seat, y) { return seat == 0 ? y <= 2 : y >= 6; }
        Pseudo(s, from)
        {
            let r = [];
            let c = this.Cell(s, from);
            if (c.length < 2) return r;
            let seat = this.SideOf(c), x = this.X(s, from), y = this.Y(s, from), f = this.F(seat);
            let t = c.length > 2 ? c[2] : c[1];
            let promoted = c.length > 2 && c[1] == '+';
            let add = (nx, ny) =>
            {
                if (!this.Inside(s, nx, ny)) return;
                let to = this.At(s, nx, ny);
                if (this.SideOf(this.Cell(s, to)) == seat) return;
                r.Add(to);
            };
            if (promoted && (t == 'P' || t == 'L' || t == 'N' || t == 'S'))
            {
                for (let k = 0; k < 3; k++) for (let m = 0; m < 3; m++)
                {
                    if (k == 1 && m == 1) continue;
                    let ny = y + (m - 1), nx = x + (k - 1);
                    if (t == 'L' && k != 1) continue;
                    if (t == 'N' && (k == 1 || m == 1)) continue;
                    add(nx, ny);
                }
                return r;
            }
            switch (t)
            {
                case 'P': add(x, y + f); break;
                case 'L':
                    for (let ny = y + f; this.Inside(s, x, ny); ny += f)
                    {
                        if (this.Cell(s, this.At(s, x, ny)) != "") { add(x, ny); break; }
                        r.Add(this.At(s, x, ny));
                    }
                    break;
                case 'N':
                    add(x - 1, y + 2 * f); add(x + 1, y + 2 * f); break;
                case 'S':
                    add(x, y + f); add(x - 1, y + f); add(x + 1, y + f); add(x - 1, y - f); add(x + 1, y - f); break;
                case 'G':
                    add(x, y + f); add(x - 1, y + f); add(x + 1, y + f); add(x - 1, y); add(x + 1, y); add(x, y - f); break;
                case 'K':
                    for (let k = 0; k < 3; k++) for (let m = 0; m < 3; m++) if (k != 1 || m != 1) add(x + k - 1, y + m - 1);
                    break;
                case 'R':
                case 'B':
                    let dirs = t == 'R' ? ShogiGame.ORTHO_S : ShogiGame.DIAG_S;
                    for (let k = 0; k < dirs.length; k++)
                    {
                        let nx = x + dirs[k][0], ny = y + dirs[k][1];
                        while (this.Inside(s, nx, ny))
                        {
                            let to = this.At(s, nx, ny);
                            if (this.Cell(s, to) == "") r.Add(to); else { add(nx, ny); break; }
                            nx += dirs[k][0]; ny += dirs[k][1];
                        }
                    }
                    if (promoted)
                        for (let k = 0; k < ShogiGame.ORTHO_S.length; k++)
                            add(x + ShogiGame.ORTHO_S[k][0], y + ShogiGame.ORTHO_S[k][1]);
                    break;
            }
            return r;
        }
        static ORTHO_S = [ [ 1, 0 ], [ -1, 0 ], [ 0, 1 ], [ 0, -1 ] ];
        static DIAG_S = [ [ 1, 1 ], [ 1, -1 ], [ -1, 1 ], [ -1, -1 ] ];
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat) return r;
            for (let i = 0; i < s.Cells.length; i++)
            {
                if (this.SideOf(this.Cell(s, i)) != seat) continue;
                let ps = this.Pseudo(s, i);
                for (let k = 0; k < ps.length; k++) r.Add("m:" + i + ">" + ps[k]);
            }
            if (s.Hands.ContainsKey(seat))
                for (let h = 0; h < s.Hands[seat].length; h++)
                    for (let i = 0; i < s.Cells.length; i++)
                        if (this.Cell(s, i) == "") r.Add("d:" + h + ">" + i);
            return r;
        }
        Act(s, seat, action, d)
        {
            let code = CS.str(d["code"]);
            if (!this.Legal(s, seat).Contains(code)) return MoveResult.Fail("非法着法");
            let ij = this.ParsePair(Cfg.Rest(code), '>');
            if (action == "d")
            {
                let h = ij[0], to = ij[1];
                if (!s.Hands.ContainsKey(seat) || h >= s.Hands[seat].length) return MoveResult.Fail("无此持驹");
                let pc = s.Hands[seat][h];
                s.Hands[seat].RemoveAt(h);
                s.Cells[to] = this.SideChar(seat) + pc; s.Last = code;
                this.Next(s, -1); return MoveResult.Good("打入");
            }
            if (action != "m") return MoveResult.Fail("未知动作");
            let from = ij[0], to2 = ij[1];
            let eaten = this.Cell(s, to2), piece = this.Cell(s, from);
            if (eaten == this.SideChar(1 - seat) + "K") { this.Finish(s, seat, "取玉，胜"); return MoveResult.Good(); }
            s.Cells[from] = "";
            let baseType = piece.length > 2 ? CS.substr(piece, 2, 1) : CS.substr(piece, 1, 1);
            if (eaten.length > 1)
            {
                let e = eaten.length > 2 ? CS.substr(eaten, 2, 1) : CS.substr(eaten, 1, 1);
                if (!s.Hands.ContainsKey(seat)) s.Hands[seat] = [];
                s.Hands[seat].Add(e);
            }
            let canPromote = "PLNSRB".IndexOf(baseType) >= 0;
            let force = (baseType == "P" || baseType == "L") && (this.Y(s, to2) == (seat == 0 ? 0 : 8)) ||
                         baseType == "N" && (this.Y(s, to2) == (seat == 0 ? 0 : 1) || this.Y(s, to2) == (seat == 0 ? 7 : 8));
            if (canPromote && (force || this.Promotable(seat, this.Y(s, from)) || this.Promotable(seat, this.Y(s, to2))))
                s.Cells[to2] = this.SideChar(seat) + "+" + baseType;
            else s.Cells[to2] = piece;
            s.Last = code;
            this.Next(s, -1); return MoveResult.Good();
        }
    }


// ===== CardGames.cs =====
    class TrickGame extends RuleBase
    {
        _id ;
        constructor(id) { super(); this._id = id; }
        get Id() { return this._id; }
        get Renderer() { return "table"; }
        get MinSeats() { return this._id == "doudizhu2" ? 2 : this._id == "doudizhu" || this._id == "laizi" || this._id == "paodekuai" ? 3 : 4; }
        get MaxSeats() { return this.MinSeats; }
        get Variants() {
                if (this._id == "doudizhu") return [ "经典", "明牌" ];
                if (this._id == "doudizhu2") return [ "二人" ];
                if (this._id == "laizi") return [ "单癞", "双癞" ];
                if (this._id == "guandan") return [ "经典" ];
                if (this._id == "shengji") return [ "双升", "炒地皮" ];
                if (this._id == "paodekuai") return [ "经典" ];
                if (this._id == "gongzhu") return [ "经典" ];
                return [ "经典" ];
            }
        IsLandlordGame() { return this._id == "doudizhu" || this._id == "doudizhu2" || this._id == "laizi"; }
        TeamGame() { return this._id == "guandan" || this._id == "shengji" || this._id == "hongshi"; }
        Decks() { return this.O("decks", this._id == "guandan" || this._id == "shengji" ? 2 : 1); }

        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Width = 0; s.Height = 0; s.Cells = CS.newArr(0, "");
            let deck = Cards.Deck(this.Decks(), this._id != "paodekuai" && this._id != "gongzhu" && this._id != "hongshi" && this._id != "shengji");
            this.Shuffle(s, deck);
            for (let i = 0; i < seats; i++) s.Hands[i] = [];
            s.V["last"] = CS.newArr(0, "");
            s.V["lastBy"] = -1;
            s.V["passes"] = 0;
            s.V["mult"] = 1;
            s.V["bids"] = CS.newArr(seats, 0);
            s.V["bidTurn"] = 0;
            s.V["landlord"] = -1;
            s.V["bottom"] = CS.newArr(0, "");
            s.V["trick"] = CS.newArr(0, "");
            s.V["trickBy"] = -1;
            s.V["team"] = CS.newArr(seats, 0);
            s.V["level"] = 2;
            s.V["trump"] = "H2";
            s.V["score"] = CS.newArr(seats, 0);
            s.V["pot"] = 0;
            s.V["phase"] = this.IsLandlordGame() ? "bid" : "play";
            if (this.IsLandlordGame()) s.PhaseName = "叫抢帅方"; else s.PhaseName = "出牌";

            let per = 17, bottom = 3;
            if (this._id == "doudizhu2")
            {

                deck = deck.Where(c => Cards.Rank(c) != "3" && Cards.Rank(c) != "4").ToList();
                per = 20; bottom = deck.length - per * seats;
            }
            else if (this._id == "paodekuai") { per = 17; bottom = deck.length - per * seats; }
            else if (this.TeamGame() || this._id == "gongzhu" || this._id == "hongshi") { per = deck.length / seats; bottom = 0; }
            for (let k = 0; k < per; k++)
                for (let i = 0; i < seats; i++)
                    if (deck.length > 0) { s.Hands[i].Add(deck[0]); deck.RemoveAt(0); }
            for (let i = 0; i < seats; i++) Cards.SortHand(s.Hands[i]);
            let bot = [];
            for (let k = 0; k < bottom && deck.length > 0; k++) { bot.Add(deck[0]); deck.RemoveAt(0); }
            s.V["bottom"] = bot.ToArray();
            s.V["rest"] = deck.ToArray();
            if (this._id == "laizi" && bot.length > 0) s.V["wild"] = Cards.Rank(bot[0]);
            else s.V["wild"] = "";
            if (variant == "双癞" && bot.length > 1) s.V["wild2"] = Cards.Rank(bot[1]);
            else s.V["wild2"] = "";
            if (variant == "明牌") s.V["mult"] = 2;
            if (this._id == "shengji") s.V["phase"] = "bid";
            if (this._id == "hongshi")
            {
                for (let i = 0; i < seats; i++)
                    if (s.Hands[i].Contains("H10") || s.Hands[i].Contains("D10"))
                        s.V["team"] = TrickGame.MarkTeam(s, i, seats);
            }
            if (this._id == "guandan" || this._id == "shengji")
            {
                let t = CS.newArr(seats, 0); t[0] = 0; t[1] = 1; t[2] = 0; t[3] = 1;
                s.V["team"] = t;
            }
            return s;
        }
        static MarkTeam(s, seat, n)
        {
            let t = CS.newArr(n, 0);
            for (let i = 0; i < t.length; i++) t[i] = 1;
            t[seat] = 0; t[(seat + 2) % n] = 0;
            return t;
        }
        Wild(s) { return this.StrV(s, "wild", ""); }
        Last(s) { return s.V.ContainsKey("last") ? s.V["last"] : CS.newArr(0, ""); }
        Bidding(s) { return this.StrV(s, "phase", "play") == "bid"; }
        IsTrump(c, s)
        {
            if (this._id != "shengji") return false;
            let t = this.StrV(s, "trump", "H2");
            return Cards.Rank(c) == Cards.Rank(t) || Cards.Suit(c) == Cards.Suit(t) || Cards.IsJoker(c);
        }

        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat) return r;
            if (this.Bidding(s))
            {
                if (this._id == "shengji") { r.Add("bid:0"); r.Add("bid:1"); return r; }
                let mx = this.MaxBid(s);
                for (let b = mx + 1; b <= 3; b++) r.Add("bid:" + b);
                r.Add("bid:0");
                return r;
            }
            r.Add("p:*");
            if (this.IntV(s, "lastBy", -1) != seat && this.Last(s).length > 0) r.Add("pass");
            return r;
        }
        MaxBid(s)
        {
            let b = s.V.ContainsKey("bids") ? s.V["bids"] : CS.newArr(0, 0);
            let m = 0; for (let i = 0; i < b.length; i++) if (b[i] > m) m = b[i];
            return m;
        }

        Act(s, seat, action, d)
        {
            let code = CS.str(d["code"]);
            if (this.Bidding(s))
            {
                let b = Cfg.I(Cfg.Rest(code));
                if (action != "bid" || b < 0 || b > 3) return MoveResult.Fail("叫分不合法");
                if (b > 0 && b <= this.MaxBid(s)) return MoveResult.Fail("叫分必须高于当前");
                let bids = s.V["bids"]; bids[seat] = b; s.V["bids"] = bids;
                this.Say(s, "座位 " + seat + " 叫 " + (b == 0 ? "不叫" : b + " 分"));
                if (this._id == "shengji")
                {
                    if (b > 0) { s.V["trump"] = s.Hands[seat][0]; s.V["phase"] = "play"; s.PhaseName = "出牌"; s.V["mult"] = 2; }
                    this.Next(s, -1); return MoveResult.Good();
                }
                let bt = this.IntV(s, "bidTurn", 0) + 1; s.V["bidTurn"] = bt;
                if (bt >= s.Seats || b == 3)
                {
                    let lord = -1, mx = 0;
                    for (let i = 0; i < bids.length; i++) if (bids[i] > mx) { mx = bids[i]; lord = i; }
                    if (lord < 0) lord = this.NextRng(s, s.Seats);
                    s.V["landlord"] = lord;
                    let bot = s.V["bottom"];
                    for (let i = 0; i < bot.length; i++) s.Hands[lord].Add(bot[i]);
                    Cards.SortHand(s.Hands[lord]);
                    s.V["bottom"] = CS.newArr(0, "");
                    s.V["phase"] = "play"; s.PhaseName = "出牌";
                    s.Turn = lord;
                    this.Say(s, "座位 " + lord + " 成为帅方，底牌已收");
                    return MoveResult.Good();
                }
                this.Next(s, -1); return MoveResult.Good();
            }
            if (action == "pass")
            {
                if (this.IntV(s, "lastBy", -1) == seat || this.Last(s).length == 0) return MoveResult.Fail("你先出牌，不能不出");
                s.V["passes"] = this.IntV(s, "passes", 0) + 1;
                if (this.IntV(s, "passes", 0) >= s.Seats - 1)
                {
                    let owner = this.IntV(s, "lastBy", 0);
                    s.V["last"] = CS.newArr(0, ""); s.V["lastBy"] = -1; s.V["passes"] = 0;
                    s.Turn = owner;
                    this.Say(s, "一轮无人应，座位 " + owner + " 重新领出");
                }
                else this.Next(s, -1);
                return MoveResult.Good();
            }
            if (action != "p") return MoveResult.Fail("未知动作");
            let idx = this.ParseList(Cfg.Rest(code));
            if (idx.length == 0) return MoveResult.Fail("请先选牌");
            let chosen = Cards.Take(s, s.Hands, seat, idx);
            if (chosen == null) return MoveResult.Fail("手牌索引无效");
            let prev = this.Last(s);
            let t = Cards.Type(chosen, this.Wild(s));
            if (t[0] < 0) { TrickGame.PutBack(s, seat, chosen); return MoveResult.Fail("不构成合法牌型"); }
            if (prev.length > 0 && this.IntV(s, "lastBy", -1) != seat)
            {
                let pt = Cards.Type(prev.ToList(), this.Wild(s));
                if (!Cards.Beats(t, pt)) { TrickGame.PutBack(s, seat, chosen); return MoveResult.Fail("压不过上一手"); }
                if (this._id == "shengji" && this.IsTrump(prev[0], s) != this.IsTrump(chosen[0], s))
                { TrickGame.PutBack(s, seat, chosen); return MoveResult.Fail("须跟主 / 副牌花色"); }
            }
            if (this.IsLandlordGame() && seat != this.IntV(s, "landlord", -1))
                s.V["farmerPlayed"] = this.IntV(s, "farmerPlayed", 0) + 1;
            s.V["last"] = chosen.ToArray(); s.V["lastBy"] = seat;
            s.V["passes"] = 0; s.Last = code;
            if (t[0] == 10 || t[0] == 11) s.V["mult"] = this.IntV(s, "mult", 1) * 2;
            if (this._id == "gongzhu") this.CollectTrick(s, seat, chosen);
            this.Say(s, "座位 " + seat + " 出 " + CS.join(" ", chosen.Select(Cards.Label).ToArray()));
            if (s.Hands[seat].length == 0) { this.Settle(s, seat); return MoveResult.Good(); }
            this.Next(s, -1); return MoveResult.Good();
        }
        static PutBack(s, seat, cards)
        {
            for (let i = 0; i < cards.length; i++) s.Hands[seat].Add(cards[i]);
            Cards.SortHand(s.Hands[seat]);
        }
        CollectTrick(s, seat, cards)
        {
            let pts = 0; let transformer = false;
            for (let i = 0; i < cards.length; i++)
            {
                let c = cards[i];
                if (c == "SQ") pts -= 100;
                if (c == "DJ") pts += 100;
                if (Cards.Suit(c) == "H") pts += 1;
                if (c == "C10") transformer = true;
            }
            if (transformer) pts *= 2;
            let sc = s.V["score"]; sc[seat] += pts; s.V["score"] = sc;
        }
        Settle(s, winner)
        {
            let mult = this.IntV(s, "mult", 1);
            if (this.IsLandlordGame())
            {
                let lord = this.IntV(s, "landlord", -1);
                let lordWin = winner == lord;

            let spring = lordWin && this.IntV(s, "farmerPlayed", 0) == 0 && this.OptB(s, "spring", true);
            if (spring) mult *= 2;
            let baseScore = this.OptI(s, "baseScore", 1);
            mult *= Math.max(1, baseScore);
                let txt = (lordWin ? "帅方胜" : "群客胜") + " ×" + mult + (spring ? "（春天）" : "");
                let sc = s.V["score"];
                for (let i = 0; i < sc.length; i++) sc[i] = (i == lord ? lordWin : !lordWin) ? 3 * mult : -3 * mult;
                s.V["score"] = sc;
                if (lordWin) this.Finish(s, lord, txt);
                else
                {
                    let farmers = [];
                    for (let i = 0; i < s.Seats; i++) if (i != lord) farmers.Add(i);
                    this.FinishTeam(s, farmers, txt);
                }
                return;
            }
            if (this._id == "paodekuai")
            {
                let sc = s.V["score"];
                for (let i = 0; i < sc.length; i++) sc[i] = -s.Hands[i].length;
                sc[winner] = 0; s.V["score"] = sc;
                this.Finish(s, winner, "先出完，胜；其余按剩牌计分"); return;
            }
            if (this._id == "gongzhu")
            {

                let sc = s.V["score"];
                let best = 0; for (let i = 1; i < sc.length; i++) if (sc[i] < sc[best]) best = i;
                this.Finish(s, best, "拱猪计分，负分最多（吃进分最少）者胜"); return;
            }
            if (this.TeamGame())
            {
                let team = s.V["team"];
                let winTeam = team[winner];
                s.V["level"] = this.IntV(s, "level", 2) + 1;
                let mates = [];
                for (let i = 0; i < team.length; i++) if (team[i] == winTeam) mates.Add(i);
                this.FinishTeam(s, mates, "队伍 " + (winTeam == 0 ? "一" : "二") + " 胜，升级到 " + this.IntV(s, "level", 3)); return;
            }
            this.Finish(s, winner, "先出完，胜");
        }

        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            d["lastCards"] = this.Last(s);
            d["lastBy"] = this.IntV(s, "lastBy", -1);
            d["landlord"] = this.IntV(s, "landlord", -1);
            d["mult"] = this.IntV(s, "mult", 1);
            d["wild"] = this.Wild(s);
            d["bottom"] = this.Bidding(s) ? CS.newArr(0, "") : s.V["bottom"];
            d["team"] = s.V["team"];
            d["level"] = this.IntV(s, "level", 2);
            d["trump"] = this.StrV(s, "trump", "H2");
            d["bidPhase"] = this.Bidding(s);
            d["suggest"] = this.Suggest(s, seat);
            return d;
        }

        Suggest(s, seat)
        {
            if (!s.Hands.ContainsKey(seat) || s.Turn != seat) return "";
            let h = s.Hands[seat];
            let prev = this.Last(s);
            if (prev.length == 0 || this.IntV(s, "lastBy", -1) == seat)
                return h.length > 0 ? "p:" + (h.length - 1) : "";
            let pt = Cards.Type(prev.ToList(), this.Wild(s));
            for (let i = h.length - 1; i >= 0; i--)
            {
                let cand = [];
                if (pt[0] == 0)
                {
                    cand.Add(i);
                    if (i > 0 && Cards.Val(h[i]) == Cards.Val(h[i - 1])) cand.Add(i - 1);
                }
                else if (pt[0] == 1 && i > 0 && Cards.Val(h[i]) == Cards.Val(h[i - 1])) { cand.Add(i); cand.Add(i - 1); }
                else if (pt[0] == 10 || pt[0] == 11)
                {
                    for (let k = 0; k < h.length; k++) if (Cards.Val(h[k]) == Cards.Val(h[i])) cand.Add(k);
                }
                if (cand.length == 0) continue;
                let pick = [];
                for (let k = 0; k < cand.length; k++) pick.Add(h[cand[k]]);
                let t = Cards.Type(pick, this.Wild(s));
                if (Cards.Beats(t, pt)) return "p:" + JoinInts(cand);
            }

            for (let i = 0; i < h.length; i++)
            {
                let bomb = [];
                for (let k = 0; k < h.length; k++) if (Cards.Val(h[k]) == Cards.Val(h[i])) bomb.Add(k);
                if (bomb.length == 4) return "p:" + JoinInts(bomb);
            }
            if (h.length > 1 && Cards.IsJoker(h[0]) && Cards.IsJoker(h[1])) return "p:0,1";
            return "";
        }
    }

    class ShowdownGame extends RuleBase
    {
        _id ;
        constructor(id) { super(); this._id = id; }
        get Id() { return this._id; }
        get Renderer() { return "table"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return this._id == "texas" ? 9 : this._id == "shisanszhang" ? 4 : 6; }
        get Variants() {
                if (this._id == "texas") return [ "常规", "快桌" ];
                return [ "经典" ];
            }
        HoleCount() { return this._id == "texas" ? 2 : this._id == "zhajinhua" || this._id == "sangong" ? 3 : this._id == "shisanszhang" ? 13 : 5; }
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Cells = CS.newArr(0, ""); s.Width = 0; s.Height = 0;
            let deck = Cards.Deck(1, false); this.Shuffle(s, deck);
            for (let i = 0; i < seats; i++) s.Hands[i] = [];
            for (let k = 0; k < this.HoleCount(); k++)
                for (let i = 0; i < seats; i++)
                    if (deck.length > 0) { s.Hands[i].Add(deck[0]); deck.RemoveAt(0); }
            for (let i = 0; i < seats; i++) Cards.SortHand(s.Hands[i]);
            s.V["board"] = CS.newArr(0, "");
            s.V["rest"] = deck.ToArray();
            s.V["chips"] = CS.repeat(this.O("startChips", 200), seats).ToArray();
            s.V["pot"] = this._id == "texas" ? 3 : 0;
            s.V["bets"] = CS.newArr(seats, 0);
            s.V["folded"] = CS.newArr(seats, false);
            s.V["contrib"] = CS.newArr(seats, 0);
            s.V["allin"] = CS.newArr(seats, false);
            s.V["round"] = 0;
            s.V["acted"] = CS.newArr(seats, false);
            s.V["stage"] = "bet";
            s.V["_phase"] = "bid";
            s.PhaseName = "落帖";
            if (this._id == "texas")
            {
                let sb = Math.max(1, this.O("smallBlind", 1));
                let chips = s.V["chips"]; chips[0] -= sb; chips[1 % seats] -= 2 * sb; s.V["chips"] = chips;
                let bets = s.V["bets"]; bets[0] = sb; bets[1 % seats] = 2 * sb; s.V["bets"] = bets;
                let ctr = s.V["contrib"]; ctr[0] = sb; ctr[1 % seats] = 2 * sb; s.V["contrib"] = ctr;
                s.V["pot"] = 3 * sb;
                s.Turn = seats > 2 ? 2 : 0;
            }
            return s;
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat || ShowdownGame.BoolAt(s, "folded", seat)) return r;
            if (this.StrV(s, "stage", "bet") == "bet")
            {
                r.Add("b:call"); r.Add("b:raise"); r.Add("b:fold"); r.Add("b:check");
                if (this._id == "shisanszhang")
                {
                    r.Add("b:ready");
                    r.Add("arrange:auto");
                    r.Add("arrange:swap:*");
                }
                return r;
            }
            r.Add("b:show");
            return r;
        }
        static BoolAt(s, k, i)
        {
            let a = s.V.ContainsKey(k) ? s.V[k] : CS.newArr(0, false);
            return i < a.length && a[i];
        }
        SetActed(s, seat)
        {
            let a = s.V["acted"]; a[seat] = true; s.V["acted"] = a;
        }
        AllActed(s)
        {
            let a = s.V["acted"];
            for (let i = 0; i < s.Seats; i++) if (!ShowdownGame.BoolAt(s, "folded", i) && (i >= a.length || !a[i])) return false;
            return true;
        }
        Act(s, seat, action, d)
        {
            if (action != "b" && action != "arrange") return MoveResult.Fail("未知动作");
            let what = Cfg.Rest(CS.str(d["code"]));
            let chips = s.V["chips"], bets = s.V["bets"];
            let folded = s.V["folded"];
            if (action == "arrange")
            {
                let arg = Cfg.Rest(CS.str(d["code"]));
                if (arg == "auto")
                {

                    let sorted = (s.Hands[seat]).slice();
                    sorted.Sort((a, b) => { return Cards.Val(a).CompareTo(Cards.Val(b)); });
                    s.Hands[seat] = sorted;
                    this.Say(s, "座位 " + seat + " 自动摆好了三道");
                    return MoveResult.Good("摆牌完成");
                }
                if (arg.StartsWith("swap:"))
                {
                    let ij = CS.substr(arg, 5).Split(',');
                    let a, b;
                    if (ij.length < 2 || !CS.tp(ij[0], _v => a = _v) || !CS.tp(ij[1], _v => b = _v) ||
                        a < 0 || b < 0 || a >= s.Hands[seat].length || b >= s.Hands[seat].length)
                        return MoveResult.Fail("选两张手牌来交换");
                    let t = s.Hands[seat][a]; s.Hands[seat][a] = s.Hands[seat][b]; s.Hands[seat][b] = t;
                    return MoveResult.Good("已交换");
                }
                let order = this.ParseList(arg);
                if (order.length != s.Hands[seat].length) return MoveResult.Fail("要重排全部 13 张");
                let used = CS.newArr(order.length, false);
                for (let i = 0; i < order.length; i++)
                {
                    if (order[i] < 0 || order[i] >= used.length || used[order[i]]) return MoveResult.Fail("摆牌序号重复或越界");
                    used[order[i]] = true;
                }
                let nh = [];
                for (let i = 0; i < order.length; i++) nh.Add(s.Hands[seat][order[i]]);
                s.Hands[seat] = nh;
                this.Say(s, "座位 " + seat + " 重新摆好了三道");
                return MoveResult.Good("摆牌完成");
            }
            if (what == "ready")
            {
                if (this._id != "shisanszhang") return MoveResult.Fail("这个玩法不用确认摆牌");
                let bad = this.CheckDao(s, seat);
            if (bad.length > 0 && this.OptB(s, "daoCheck", true))
            { this.Say(s, "座位 " + seat + " 倒道：" + bad + "，本局按最小牌力计"); s.V["daoBad" + seat] = true; }
                this.SetActed(s, seat);
                if (this.AllActed(s)) { this.EnterShow(s); return MoveResult.Good(); }
                this.Next(s, -1); return MoveResult.Good();
            }
            if (what == "show")
            {
                this.SetActed(s, seat);
                if (this.AllActed(s)) { this.Showdown(s); return MoveResult.Good(); }
                this.Next(s, -1); return MoveResult.Good();
            }
            if (what == "fold")
            {
                folded[seat] = true; s.V["folded"] = folded; this.SetActed(s, seat);
                this.Say(s, "座位 " + seat + " 敛牌");
                let alive = 0, last = 0;
                for (let i = 0; i < s.Seats; i++) if (!folded[i]) { alive++; last = i; }
                if (alive <= 1) { this.WinPot(s, last); return MoveResult.Good(); }
                this.Advance(s); return MoveResult.Good();
            }
            let mx = 0; for (let i = 0; i < bets.length; i++) if (bets[i] > mx) mx = bets[i];
            let pay = 0;
            if (what == "call") pay = Math.min(chips[seat], Math.max(0, mx - bets[seat]));
            else if (what == "raise") pay = Math.min(chips[seat], mx - bets[seat] + 10);
            else if (what == "check") pay = 0;
            else return MoveResult.Fail("未知落帖动作");
            if (what == "check" && mx > bets[seat]) return MoveResult.Fail("有注须跟，不能过牌");
            if (pay > chips[seat]) pay = chips[seat];
            chips[seat] -= pay; bets[seat] += pay; s.V["chips"] = chips; s.V["bets"] = bets;
            s.V["pot"] = this.IntV(s, "pot", 0) + pay;
            let ctr = s.V.ContainsKey("contrib") ? s.V["contrib"] : CS.newArr(s.Seats, 0);
            ctr[seat] += pay; s.V["contrib"] = ctr;
            let ai = s.V.ContainsKey("allin") ? s.V["allin"] : CS.newArr(s.Seats, false);
            if (chips[seat] <= 0 && !folded[seat]) { ai[seat] = true; this.Say(s, "座位 " + seat + " 分尽"); }
            s.V["allin"] = ai;
            this.SetActed(s, seat);
            this.Say(s, "座位 " + seat + " " + (what == "raise" ? "加帖" : what == "call" ? "随帖" : "过牌") + " " + pay);
            if (!this.AllActed(s)) { this.Next(s, -1); return MoveResult.Good(); }
            if (this._id == "shisanszhang") { this.EnterShow(s); return MoveResult.Good(); }
            if (this._id == "texas" && this.IntV(s, "round", 0) < 3)
            {
                let rnd = this.IntV(s, "round", 0) + 1; s.V["round"] = rnd;
                let rest = (s.V["rest"]).slice();
                let board = (s.V["board"]).slice();
                let n = rnd == 1 ? 3 : 1;
                for (let k = 0; k < n && rest.length > 0; k++) { board.Add(rest[0]); rest.RemoveAt(0); }
                s.V["board"] = board.ToArray(); s.V["rest"] = rest.ToArray();
                s.V["bets"] = CS.newArr(s.Seats, 0);
                s.V["acted"] = CS.newArr(s.Seats, false);
                this.Say(s, rnd == 1 ? "翻牌 " + CS.join(" ", board.Select(Cards.Label).ToArray()) : "发出第 " + (rnd + 2) + " 张公共牌");
                this.Next(s, -1); return MoveResult.Good();
            }
            this.EnterShow(s); return MoveResult.Good();
        }
        EnterShow(s)
        {
            s.V["stage"] = "show";
            s.V["acted"] = CS.newArr(s.Seats, false);
            for (let i = 0; i < s.Seats; i++) if (ShowdownGame.BoolAt(s, "folded", i)) (s.V["acted"])[i] = true;
            for (let i = 0; i < s.Seats; i++) if (!ShowdownGame.BoolAt(s, "folded", i)) { s.Turn = i; break; }
            s.PhaseName = "摊牌确认";
            this.Say(s, "都确认后一起亮牌");
        }
        CheckDao(s, seat)
        {
            let h = s.Hands[seat];
            if (h.length < 13) return "";
            let a = ShowdownGame.TexasRank(h.Skip(8).Take(5).ToList());
            let b = ShowdownGame.TexasRank(h.Skip(3).Take(5).ToList());
            let c = ShowdownGame.TexasRank(h.Take(3).ToList());
            if (ShowdownGame.Compare(c, b) > 0 || ShowdownGame.Compare(b, a) > 0) return "头道不能强过中道，中道不能强过尾道";
            return "";
        }
        Advance(s)
        {
            if (this.AllActed(s)) { this.EnterShow(s); return; }
            this.Next(s, -1);
            let guard = 0;
            while (ShowdownGame.BoolAt(s, "folded", s.Turn) && guard++ < s.Seats) this.Next(s, -1);
        }

        Strength(s, seat)
        {
            let h = (s.Hands[seat]).slice();
            let board = s.V["board"];
            if (this._id == "texas") h.AddRange(board);
            if (this._id == "zhajinhua") return ShowdownGame.Zjh(h);
            if (this._id == "niuniu") return ShowdownGame.Niu(h);
            if (this._id == "sangong") return ShowdownGame.Sangong(h);
            if (this._id == "shisanszhang") return ShowdownGame.Shisan(h);
            return ShowdownGame.TexasRank(h);
        }
        static Counts(h)
        {
            let d = [];
            for (let i = 0; i < h.length; i++) { let v = Cards.Val(h[i]); if (!d.ContainsKey(v)) d[v] = 0; d[v]++; }
            return d;
        }

        static TVal(c)
        {
            let r = Cards.Rank(c);
            if (r == "A") return 14;
            if (r == "K") return 13;
            if (r == "Q") return 12;
            if (r == "J") return 11;
            if (r == "2") return 2;
            let n; return CS.tp(r, _v => n = _v) ? n : 0;
        }
        static TexasRank(h)
        {
            let v = h.Select(ShowdownGame.TVal).ToList(); v.Sort(); v.Reverse();
            let c = [];
            for (let i = 0; i < h.length; i++) { let x = ShowdownGame.TVal(h[i]); if (!c.ContainsKey(x)) c[x] = 0; c[x]++; }
            let groups = c.Values.OrderByDescending(x => x).ToArray();

            let flush = false;
            for (let suit of Cards.SUITS)
                if (h.Count(x => Cards.Suit(x) == suit) >= 5) { flush = true; break; }
            let uniq = c.Keys.OrderByDescending(x => x).ToList();
            if (uniq.Contains(14)) uniq.Add(1);
            uniq = uniq.Distinct().OrderByDescending(x => x).ToList();
            let straightHigh = 0;
            for (let k = 0; k + 4 < uniq.length; k++)
                if (uniq[k] - uniq[k + 4] == 4) { straightHigh = uniq[k]; break; }
            let type = 0, tie = uniq.length > 0 ? uniq[0] : 0;
            if (straightHigh > 0 && flush) { type = 8; tie = straightHigh; }
            else if (groups.length > 0 && groups[0] == 4) { type = 7; tie = ShowdownGame.KeyOf(c, 4); }
            else if (groups.length > 1 && groups[0] == 3 && groups[1] >= 2) { type = 6; tie = ShowdownGame.KeyOf(c, 3); }
            else if (flush) { type = 5; tie = 0; }
            else if (straightHigh > 0) { type = 4; tie = straightHigh; }
            else if (groups.length > 0 && groups[0] == 3) { type = 3; tie = ShowdownGame.KeyOf(c, 3); }
            else if (groups.length > 1 && groups[0] == 2 && groups[1] == 2) { type = 2; tie = Math.max(ShowdownGame.KeyOf(c, 2), uniq.length > 1 ? uniq[1] : 0); }
            else if (groups.length > 0 && groups[0] == 2) { type = 1; tie = ShowdownGame.KeyOf(c, 2); }

            let ret = [ type, tie ];
            if (type == 5 || type == 0 || type == 8 || type == 4)
            {
                let used = new CS.Set();
                if (straightHigh > 0) for (let k = 0; k < 5; k++) used.Add(straightHigh - k == 0 ? 14 : straightHigh - k);
                let take = 0;
                for (let i = 0; i < v.length && take < 5; i++)
                {
                    if (used.Contains(v[i])) continue;
                    ret.Add(v[i]); take++;
                }
            }
            else for (let i = 0; i < v.length && i < 5; i++) ret.Add(v[i]);
            while (ret.length < 7) ret.Add(0);
            return ret.ToArray();
        }
        static KeyOf(c, n)
        {
            let best = 0;
            for (let kv of CS.entries(c)) if (kv.Value == n && kv.Key > best) best = kv.Key;
            return best;
        }
        static Zjh(h)
        {
            let v = h.Select(Cards.Val).ToList(); v.Sort(); v.Reverse();
            let flush = h.Select(Cards.Suit).Distinct().Count() == 1;
            let seq = (v[0] - v[1] == 1 && v[1] - v[2] == 1);
            let type = v[0] == v[1] && v[1] == v[2] ? 5 : flush && seq ? 4 : flush ? 3 : seq ? 2 : v[0] == v[1] || v[1] == v[2] ? 1 : 0;
            return [ type, v[0], v[1], v[2] ];
        }
        static Niu(h)
        {
            let v = h.Select(x => Math.min(10, Cards.Val(x))).ToList();
            let best = 0;
            for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) for (let k = j + 1; k < 5; k++)
                if ((v[i] + v[j] + v[k]) % 10 == 0)
                {
                    let rest = 0;
                    for (let m = 0; m < 5; m++) if (m != i && m != j && m != k) rest += v[m];
                    let niu = rest % 10 == 0 ? 10 : rest % 10;
                    if (niu > best) best = niu;
                }
            return [ best, h.Max(Cards.Val) ];
        }
        static Sangong(h)
        {
            let gong = 0;
            for (let i = 0; i < h.length; i++) if ("JQK".IndexOf(Cards.Rank(h[i])) >= 0) gong++;
            let pts = h.Sum(x => "JQK".IndexOf(Cards.Rank(x)) >= 0 ? 0 : Math.min(10, Cards.Val(x))) % 10;
            return [ gong, pts, gong == 3 ? 1 : 0 ];
        }
        static Shisan(h)
        {

            let a = h.Take(3).ToList(), b = h.Skip(3).Take(5).ToList(), c = h.Skip(8).Take(5).ToList();
            return [ ShowdownGame.TexasRank(c)[0] * 100 + ShowdownGame.TexasRank(b)[0] * 10 + ShowdownGame.TexasRank(a)[0], ShowdownGame.TexasRank(c)[1], ShowdownGame.TexasRank(b)[1] ];
        }
        Showdown(s)
        {
            let best = -1; let bestV = null;
            for (let i = 0; i < s.Seats; i++)
            {
                if (ShowdownGame.BoolAt(s, "folded", i)) continue;
                let v = this.Strength(s, i);
                if (s.V.ContainsKey("daoBad" + i) && CS.bool(s.V["daoBad" + i]))
                { v = [ -1 ]; this.Say(s, "座位 " + i + " 倒道，本局不计最高牌力"); }
                if (bestV == null || ShowdownGame.Compare(v, bestV) > 0) { best = i; bestV = v; }
            }
            if (best < 0) { for (let i = 0; i < s.Seats; i++) if (!ShowdownGame.BoolAt(s, "folded", i)) best = i; }
            this.WinPot(s, best);
        }
        static Compare(a, b)
        {
            let n = Math.max(a.length, b.length);
            for (let i = 0; i < n; i++) { let x = i < a.length ? a[i] : 0, y = i < b.length ? b[i] : 0; if (x != y) return CS.cmp(x, y); }
            return 0;
        }
        WinPot(s, winner)
        {
            let chips = s.V["chips"];
            let pot = this.IntV(s, "pot", 0);
            s.V["_pots"] = CS.newArr(0, "");
            let useSide = this.OptB(s, "sidePot", true) && s.V.ContainsKey("contrib") &&
                           s.V.ContainsKey("allin") && (s.V["allin"]).Any(x => x);
            if (!useSide)
            {
                chips[winner] += pot; s.V["chips"] = chips;
                s.V["score"] = chips.Clone();
                this.Finish(s, winner, "摊牌，座位 " + winner + " 赢得共分 " + pot);
                return;
            }
            let contrib = s.V["contrib"];
            let folded = s.V["folded"];
            let levels = contrib.Distinct().Where(x => x > 0).OrderBy(x => x).ToList();
            let desc = [];
            let prev = 0, mainWinner = -1;
            for (let L of levels)
            {
                let layer = 0;
                for (let i = 0; i < s.Seats; i++)
                    layer += Math.max(0, Math.min(contrib[i], L) - Math.min(contrib[i], prev));
                prev = L;
                if (layer <= 0) continue;
                let elig = [];
                for (let i = 0; i < s.Seats; i++) if (!folded[i] && contrib[i] >= L) elig.Add(i);
                if (elig.length == 0) continue;
                let best = elig[0]; let bv = this.Strength(s, best);
                let ties = [];
                for (let i of elig)
                {
                    let v = this.Strength(s, i); let c = ShowdownGame.Compare(v, bv);
                    if (c > 0) { best = i; bv = v; ties.Clear(); ties.Add(i); }
                    else if (c == 0) ties.Add(i);
                }
                let share = layer / Math.max(1, ties.length);
                for (let k = 0; k < ties.length; k++) chips[ties[k]] += share + (k == 0 ? layer - share * ties.length : 0);
                if (mainWinner < 0) mainWinner = best;
                desc.Add("池 " + layer + " → 座位 " + CS.join(",", ties.Select(x => CS.str(x)).ToArray()));
            }
            s.V["chips"] = chips; s.V["score"] = chips.Clone();
            s.V["_pots"] = desc.ToArray();
            if (mainWinner < 0) mainWinner = winner;
            this.Finish(s, mainWinner, "分层结算 · " + CS.join(" | ", desc.ToArray()));
        }
        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            d["boardCards"] = s.V["board"];
            d["chips"] = s.V["chips"];
            d["pot"] = this.IntV(s, "pot", 0);
            d["contrib"] = s.V.ContainsKey("contrib") ? s.V["contrib"] : CS.newArr(s.Seats, 0);
            d["allin"] = s.V.ContainsKey("allin") ? s.V["allin"] : CS.newArr(s.Seats, false);
            d["folded"] = s.V["folded"];
            d["round"] = this.IntV(s, "round", 0);
            d["stage"] = this.StrV(s, "stage", "bet");
            return d;
        }
    }


// ===== TableExtras.cs =====
    class UnoGame extends RuleBase
    {
        get Id() { return "uno"; }
        get Renderer() { return "table"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 8; }
        get Variants() { return [ "经典", "叠牌" ]; }
        static COLORS = [ "R", "Y", "G", "B" ];
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Cells = CS.newArr(0, ""); s.Width = 0; s.Height = 0;
            let deck = [];
            for (let c = 0; c < 4; c++)
            {
                for (let n = 0; n <= 9; n++) deck.Add(UnoGame.COLORS[c] + n);
                for (let k = 0; k < 2; k++) { deck.Add(UnoGame.COLORS[c] + "S"); deck.Add(UnoGame.COLORS[c] + "R"); deck.Add(UnoGame.COLORS[c] + "+2"); }
            }
            for (let i = 0; i < 4; i++) { deck.Add("W"); deck.Add("W4"); }
            this.Shuffle(s, deck);
            for (let i = 0; i < seats; i++) s.Hands[i] = [];
            for (let k = 0; k < 7; k++) for (let i = 0; i < seats; i++) { s.Hands[i].Add(deck[0]); deck.RemoveAt(0); }
            let top = deck[0]; deck.RemoveAt(0);
            while (top == "W" || top == "W4") { deck.Add(top); top = deck[0]; deck.RemoveAt(0); }
            s.V["top"] = top; s.V["color"] = CS.substr(top, 0, 1);
            s.V["rest"] = deck.ToArray();
            s.V["discard"] = CS.newArr(0, "");
            s.V["dir"] = 1; s.V["pending"] = 0;
            s.V["uno"] = CS.newArr(seats, false);
            s.V["colorBy"] = -1;
            s.V["stack"] = variant == "叠牌";
            return s;
        }
        Color(c) { return c.length > 0 ? CS.substr(c, 0, 1) : ""; }
        Face(c) { return c.length > 1 ? CS.substr(c, 1) : ""; }
        Stack(s) { return this.OptB(s, "stack", s.V.ContainsKey("stack") && CS.bool(s.V["stack"])); }
        Playable(s, c)
        {
            let top = this.StrV(s, "top", "");
            if (c == "W" || c == "W4") return true;
            return this.Color(c) == this.StrV(s, "color", "R") || this.Face(c) == this.Face(top);
        }
        IsPenaltyCard(c) { return c == "W4" || c.EndsWith("+2"); }
        AdvanceDir(s)
        {
            if (this.IntV(s, "dir", 1) < 0) { s.Turn = (s.Turn - 1 + s.Seats) % s.Seats; s.MoveNo++; }
            else this.Next(s, -1);
        }
        Recycle(s)
        {
            let rest = (s.V["rest"]).slice();
            if (rest.length > 0) return;
            let disc = (s.V.ContainsKey("discard") ? s.V["discard"] : CS.newArr(0, "")).slice();
            if (disc.length == 0) return;
            this.Shuffle(s, disc);
            rest.AddRange(disc);
            s.V["rest"] = rest.ToArray();
            s.V["discard"] = CS.newArr(0, "");
            this.Say(s, "敛牌堆洗回牌堆");
        }
        DrawCards(s, seat, n)
        {
            for (let k = 0; k < n; k++)
            {
                this.Recycle(s);
                let rest = (s.V["rest"]).slice();
                if (rest.length == 0) { this.Say(s, "牌堆与敛牌堆都空了，本局流局"); this.Finish(s, -1, "云笺牌荒流局"); return; }
                s.Hands[seat].Add(rest[0]); rest.RemoveAt(0);
                s.V["rest"] = rest.ToArray();
            }
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat || !s.Hands.ContainsKey(seat)) return r;
            if (this.StrV(s, "color", "") == "")
            {

                if (this.IntV(s, "colorBy", -1) == seat)
                    for (let k = 0; k < 4; k++) r.Add("color:" + UnoGame.COLORS[k]);
                return r;
            }
            let pending = this.IntV(s, "pending", 0);
            if (pending > 0)
            {
                if (this.Stack(s))
                    for (let i = 0; i < s.Hands[seat].length; i++)
                        if (this.IsPenaltyCard(s.Hands[seat][i])) r.Add("p:" + i);
                if (this.StrV(s, "top", "") == "W4" && this.OptB(s, "challenge", true)) r.Add("challenge");
                r.Add("draw");
                return r;
            }
            for (let i = 0; i < s.Hands[seat].length; i++) if (this.Playable(s, s.Hands[seat][i])) r.Add("p:" + i);
            r.Add("draw");
            if (s.Hands[seat].length <= 2) r.Add("uno");
            return r;
        }
        Act(s, seat, action, d)
        {
            let code = CS.str(d["code"]);
            if (action == "color")
            {
                if (this.IntV(s, "colorBy", -1) != seat) return MoveResult.Fail("等出牌的人选颜色");
                let c = Cfg.Rest(code);
                if (CS.indexOf(UnoGame.COLORS, c) < 0) return MoveResult.Fail("无效颜色");
                s.V["color"] = c; s.V["colorBy"] = -1;
                this.Say(s, "换色为 " + c);
                this.AdvanceDir(s); return MoveResult.Good();
            }
            if (action == "uno")
            {
                let u = s.V["uno"];
                if (u == null || u.length != s.Seats) { u = CS.newArr(s.Seats, false); s.V["uno"] = u; }
                u[seat] = true;
                this.Say(s, "座位 " + seat + "：呼笺!");
                return MoveResult.Good();
            }
            if (action == "challenge")
            {
                let w4By = this.IntV(s, "w4By", seat), penalty = this.IntV(s, "pending", 0);
                let prev = this.StrV(s, "w4Prev", "");
                let illegal = false;
                if (w4By >= 0 && w4By < s.Seats && prev.length > 0 && s.Hands.ContainsKey(w4By))
                    for (let i = 0; i < s.Hands[w4By].length; i++)
                        if (this.Color(s.Hands[w4By][i]) == prev) { illegal = true; break; }
                s.V["pending"] = 0;
                if (illegal) { this.DrawCards(s, w4By, 4); this.MarkFeat(s, "wild_challenge"); this.Say(s, "质疑成立：出牌者手里有 " + prev + " 色牌，自摸 4 张"); }
                else { this.DrawCards(s, seat, penalty + 2); this.Say(s, "质疑失败：挑战者摸 " + (penalty + 2) + " 张"); }
                s.V["w4By"] = -1; s.V["w4Prev"] = "";
                if (s.Ended) return MoveResult.Good();
                this.AdvanceDir(s); return MoveResult.Good();
            }
            if (action == "draw")
            {
                let penalty = this.IntV(s, "pending", 0);
                this.DrawCards(s, seat, penalty + 1);
                if (s.Ended) return MoveResult.Good();
                s.V["pending"] = 0;
                this.Say(s, "座位 " + seat + " 摸 " + (penalty + 1) + " 张");
                this.AdvanceDir(s); return MoveResult.Good();
            }
            if (action != "p") return MoveResult.Fail("未知动作");
            if (!this.Legal(s, seat).Contains(code)) return MoveResult.Fail("该牌不能出（有罚摸须先结算）");
            let idx = Cfg.I(Cfg.Rest(code));
            let card = s.Hands[seat][idx];
            let prevColor = this.StrV(s, "color", "R");

            let disc = (s.V.ContainsKey("discard") ? s.V["discard"] : CS.newArr(0, "")).slice();
            let oldTop = this.StrV(s, "top", "");
            if (oldTop.length > 0) disc.Add(oldTop);
            s.V["discard"] = disc.ToArray();
            s.Hands[seat].RemoveAt(idx);
            s.V["top"] = card;
            s.V["color"] = this.Color(card) == "W" ? "" : this.Color(card);
            s.Last = code;
            let uno = s.V["uno"];
            let shouted = uno != null && seat < uno.length && uno[seat];
            if (uno != null && seat < uno.length) uno[seat] = false;
            if (card == "W" || card == "W4") s.V["colorBy"] = seat;
            if (card.EndsWith("+2")) s.V["pending"] = this.IntV(s, "pending", 0) + 2;
            if (card == "W4")
            {
                s.V["pending"] = this.IntV(s, "pending", 0) + 4;
                s.V["w4By"] = seat; s.V["w4Prev"] = prevColor;
            }
            if (card.EndsWith("R")) { s.V["dir"] = -this.IntV(s, "dir", 1); this.Say(s, "反转方向"); }
            if (s.Hands[seat].length == 0) { this.Finish(s, seat, "出完手牌，胜"); return MoveResult.Good(); }
            if (s.Hands[seat].length == 1 && !shouted && this.OptB(s, "shoutUno", true))
            {
                this.DrawCards(s, seat, 2);
                this.Say(s, "座位 " + seat + " 剩一张没喊 云笺，罚摸 2 张");
            }
            if (s.Ended) return MoveResult.Good();
            if (this.StrV(s, "color", "") == "") { this.Say(s, "请选择颜色"); return MoveResult.Good(); }

            let steps = (card.EndsWith("S") && !card.StartsWith("W")) ? 2 : 1;
            for (let k = 0; k < steps; k++) this.AdvanceDir(s);
            return MoveResult.Good();
        }
        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            d["topCard"] = this.StrV(s, "top", "");
            d["color"] = this.StrV(s, "color", "R");
            d["dir"] = this.IntV(s, "dir", 1);
            d["pending"] = this.IntV(s, "pending", 0);
            d["restLeft"] = (s.V["rest"]).length;
            d["stack"] = this.Stack(s);
            return d;
        }
    }

    class BridgeGame extends RuleBase
    {
        get Id() { return "bridge"; }
        get Renderer() { return "table"; }
        get MinSeats() { return 4; }
        get MaxSeats() { return 4; }
        get Variants() { return [ "简版定约" ]; }
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Cells = CS.newArr(0, ""); s.Width = 0; s.Height = 0;
            let deck = Cards.Deck(1, false); this.Shuffle(s, deck);
            for (let i = 0; i < seats; i++) s.Hands[i] = [];
            for (let k = 0; k < 13; k++) for (let i = 0; i < seats; i++) { s.Hands[i].Add(deck[0]); deck.RemoveAt(0); }
            for (let i = 0; i < seats; i++) Cards.SortHand(s.Hands[i]);
            s.V["phase"] = "bid"; s.V["_phase"] = "bid"; s.V["contract"] = 0; s.V["declarer"] = -1;
            s.V["trump"] = "N"; s.V["bidTrump"] = "N"; s.V["trick"] = CS.newArr(0, ""); s.V["lead"] = "";
            s.V["tricks"] = CS.newArr(2, 0); s.V["bidTurn"] = 0;
            s.V["dbl"] = 0; s.V["passes"] = 0; s.V["bidLevel"] = 0;
            return s;
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat) return r;
            if (this.StrV(s, "phase", "play") == "bid")
            {
                r.Add("bid:0");
                for (let n = this.IntV(s, "contract", 0) + 1; n <= 7; n++) r.Add("bid:" + n);
                if (this.OptB(s, "doubling", true) && this.IntV(s, "contract", 0) > 0)
                {
                    let dec = this.IntV(s, "declarer", -1), dbl = this.IntV(s, "dbl", 0);
                    if (dbl == 0 && seat % 2 != dec % 2) r.Add("dbl");
                    if (dbl == 1 && seat % 2 == dec % 2) r.Add("rdbl");
                }
                return r;
            }
            if (this.StrV(s, "phase", "play") == "trump")
            {
                if (seat != this.IntV(s, "declarer", -1)) return r;
                let suits = [ "N", "S", "H", "C", "D" ];
                for (let i = 0; i < suits.length; i++) r.Add("trump:" + suits[i]);
                return r;
            }
            r.Add("p:*"); return r;
        }
        Act(s, seat, action, d)
        {
            let code = CS.str(d["code"]);
            if (this.StrV(s, "phase", "play") == "bid")
            {
            if (action == "dbl" || action == "rdbl")
            {
                let dbl = this.IntV(s, "dbl", 0), dec = this.IntV(s, "declarer", -1);
                if (action == "dbl" && (dbl != 0 || seat % 2 == dec % 2)) return MoveResult.Fail("现在不能加倍");
                if (action == "rdbl" && (dbl != 1 || seat % 2 != dec % 2)) return MoveResult.Fail("现在不能再加倍");
                s.V["dbl"] = action == "dbl" ? 1 : 2; s.V["passes"] = 0;
                this.Say(s, "座位 " + seat + (action == "dbl" ? " 加倍" : " 再加倍"));
                this.Next(s, -1); return MoveResult.Good();
            }
            let n = Cfg.I(Cfg.Rest(code));
            if (action != "bid" || n < 0 || n > 7) return MoveResult.Fail("叫品不合法");
            let passes = this.IntV(s, "passes", 0);
            if (n > 0) { s.V["contract"] = n; s.V["declarer"] = seat; s.V["trump"] = "N"; s.V["dbl"] = 0; passes = 0; this.Say(s, "座位 " + seat + " 叫 " + n); }
            else { passes++; this.Say(s, "座位 " + seat + " Pass"); }
            s.V["passes"] = passes;
            if (this.IntV(s, "contract", 0) == 0 && passes >= 4)
            { this.Finish(s, -1, "四家 Pass · Pass-out，本副重发"); return MoveResult.Good(); }
            let t = this.IntV(s, "bidTurn", 0) + 1; s.V["bidTurn"] = t;
                if (t >= s.Seats || n == 7)
                {
                    if (this.IntV(s, "declarer", -1) < 0) s.V["declarer"] = 0;
                    s.V["contract"] = Math.max(1, this.IntV(s, "contract", 1));
            s.V["phase"] = "trump"; s.PhaseName = "定将牌"; s.V["_phase"] = "bid";
                    s.Turn = this.IntV(s, "declarer", 0);
                    this.Say(s, "主家座位 " + s.Turn + " 请选择将牌（N 为无将）");
                    return MoveResult.Good();
                }
                this.Next(s, -1); return MoveResult.Good();
            }
            if (action == "trump")
            {
                if (this.StrV(s, "phase", "play") != "trump" || seat != this.IntV(s, "declarer", -1))
                    return MoveResult.Fail("等主家定将牌");
                let suit = Cfg.Rest(code);
                if ("NSHCD".IndexOf(suit) < 0 || suit.length != 1) return MoveResult.Fail("无效将牌");
                s.V["trump"] = suit; s.V["bidTrump"] = suit;
                s.V["phase"] = "play"; s.PhaseName = "打牌";
                s.Turn = (this.IntV(s, "declarer", 0) + 1) % s.Seats;
                this.Say(s, "定约 " + this.IntV(s, "contract", 1) + " · " + (suit == "N" ? "无将" : suit + " 为将牌"));
                return MoveResult.Good();
            }
            if (action != "p") return MoveResult.Fail("未知动作");
            let idx = this.ParseList(Cfg.Rest(code));
            if (idx.length != 1) return MoveResult.Fail("每墩出一张");
            let chosen = Cards.Take(s, s.Hands, seat, idx);
            if (chosen == null || chosen.length != 1) return MoveResult.Fail("无效手牌");
            let c = chosen[0];
            let trick = (s.V["trick"]).slice();
            if (trick.length > 0)
            {
                let lead = Cards.Suit(trick[0]);
                let hasLead = false;
                for (let i = 0; i < s.Hands[seat].length; i++) if (Cards.Suit(s.Hands[seat][i]) == lead) hasLead = true;
                if (hasLead && Cards.Suit(c) != lead) { s.Hands[seat].Add(c); return MoveResult.Fail("必须跟花色"); }
            }
            trick.Add(c); s.V["trick"] = trick.ToArray(); s.Last = code;
            if (trick.length < s.Seats) { this.Next(s, -1); return MoveResult.Good(); }
            let leadSuit = Cards.Suit(trick[0]);
            let win = 0, best = -1000;
            let trump = this.StrV(s, "trump", "N");
            for (let i = 0; i < trick.length; i++)
            {
                let isTrump = trump != "N" && (Cards.Suit(trick[i]) == trump || Cards.IsJoker(trick[i]));
                let isLead = Cards.Suit(trick[i]) == leadSuit;
                let v = isTrump ? 100 + Cards.Val(trick[i]) : isLead ? Cards.Val(trick[i]) : -1;
                if (v > best) { best = v; win = i; }
            }
            let winner = (s.Turn + 1 + win) % s.Seats;
            let tricks = s.V["tricks"]; tricks[winner % 2]++; s.V["tricks"] = tricks;
            s.V["trick"] = CS.newArr(0, "");
            s.Turn = winner;
            let total = tricks[0] + tricks[1];
            if (total >= 13)
            {
            let dec = this.IntV(s, "declarer", 0), need = 6 + this.IntV(s, "contract", 1);
            let madeTricks = tricks[dec % 2];
            let made = madeTricks >= need;
            s.V["score"] = tricks;
            let detail;
            let pts = this.ContractScore(s, madeTricks, need, undefined);
            s.V["_contractPts"] = pts;
            FinishTeam(s, made ? [ dec, (dec + 2) % 4 ] : [ (dec + 1) % 4, (dec + 3) % 4 ],
                "定约 " + (made ? "完成" : "宕掉") + " · 墩数 " + tricks[0] + " : " + tricks[1] + " · " + detail);
                return MoveResult.Good();
            }
            return MoveResult.Good("第 " + total + " 墩由座位 " + winner + " 收下");
        }

        ContractScore(s, madeTricks, need, detail)
        {
            if (this.OptS(s, "scoring", "duplicate") == "simple")
            { detail = "简式计分"; return madeTricks >= need ? 1 : -1; }
            let lvl = this.IntV(s, "contract", 1), dbl = this.IntV(s, "dbl", 0);
            let tr = this.StrV(s, "trump", "N");
            let mult = dbl == 0 ? 1 : dbl == 1 ? 2 : 4;
            let vul = this.OptS(s, "vulnerable", "none") == "both" ? 1 : 0;
            detail = "定约 " + lvl + (tr == "N" ? "NT" : tr) + (dbl == 1 ? "×" : dbl == 2 ? "××" : "") + (vul > 0 ? " 有局" : " 无局");
            if (madeTricks >= need)
            {
                let per = (tr == "C" || tr == "D") ? 20 : (tr == "H" || tr == "S") ? 30 : 0;
                let odd = per > 0 ? lvl * per * mult : (40 + 30 * (lvl - 1)) * mult;
                let over = madeTricks - need;
                let overVal = dbl == 0 ? over * (per > 0 ? per : 30)
                    : over * (vul > 0 ? 200 : 100) * (dbl == 2 ? 2 : 1);
                let bonus = odd >= 100 ? (vul > 0 ? 500 : 300) : 50;
                if (dbl == 1) bonus += 50;
                if (dbl == 2) bonus += 100;
                let slam = need == 12 ? (vul > 0 ? 750 : 500) : need == 13 ? (vul > 0 ? 1500 : 1000) : 0;
                let total = odd + overVal + bonus + slam;
                detail += " · 主家方 +" + total + " 分";
                return total;
            }
            let under = need - madeTricks;
            let pen = dbl == 0 ? under * (vul > 0 ? 100 : 50)
                : (vul > 0 ? 200 : 100) * (dbl == 2 ? 2 : 1) + (under - 1) * ((vul > 0 ? 300 : 200) * (dbl == 2 ? 2 : 1));
            detail += " · 防守方 +" + pen + " 分";
            return -pen;
        }
        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            d["trickCards"] = s.V["trick"];
            d["contract"] = this.IntV(s, "contract", 0);
            d["declarer"] = this.IntV(s, "declarer", -1);
            d["trump"] = this.StrV(s, "trump", "N");
            d["tricks"] = s.V["tricks"];
            d["bidPhase"] = this.StrV(s, "phase", "play") == "bid";
            d["trumpPhase"] = this.StrV(s, "phase", "play") == "trump";
            let dummy = (this.IntV(s, "declarer", -1) + 2) % 4;
            d["dummy"] = dummy;
            d["dummyHand"] = (this.StrV(s, "phase", "play") == "play" && s.Hands.ContainsKey(dummy))
                ? s.Hands[dummy].ToArray() : CS.newArr(0, "");
            return d;
        }
    }

    class MahjongGame extends RuleBase
    {
        get Id() { return "mahjong"; }
        get Renderer() { return "table"; }
        get MinSeats() { return 4; }
        get MaxSeats() { return 4; }
        get Variants() { return [ "国标", "川麻", "广东推倒胡" ]; }
        static TILES = MahjongGame.BuildTiles();
        static BuildTiles()
        {
            let t = [];
            let suits = [ "W", "T", "B" ];
            for (let s = 0; s < 3; s++) for (let n = 1; n <= 9; n++) for (let k = 0; k < 4; k++) t.Add(suits[s] + n);
            for (let n = 1; n <= 7; n++) for (let k = 0; k < 4; k++) t.Add("Z" + n);
            return t.ToArray();
        }
        Var(s) { return this.StrV(s, "variant", "国标"); }
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Cells = CS.newArr(0, ""); s.Width = 0; s.Height = 0;
            let wall = (MahjongGame.TILES).slice(); this.Shuffle(s, wall);
            for (let i = 0; i < seats; i++) s.Hands[i] = [];
            for (let k = 0; k < 13; k++) for (let i = 0; i < seats; i++) { s.Hands[i].Add(wall[0]); wall.RemoveAt(0); }
            if (wall.length > 0) { s.Hands[0].Add(wall[0]); wall.RemoveAt(0); }
            for (let i = 0; i < seats; i++) Cards.SortHand(s.Hands[i]);
            s.V["wall"] = wall.ToArray();
            s.V["discards"] = CS.newArr(0, "");
            s.V["meld"] = CS.newArr(seats, 0);
            s.V["variant"] = variant;
            s.V["phase"] = "discard";
            s.V["lastDiscard"] = "";
            s.V["lastBy"] = -1;
            s.V["claims"] = CS.newArr(seats, false);
            s.V["claimWanted"] = CS.newArr(seats, "");
            s.V["fan"] = 0;
            return s;
        }
        static Cnt(h)
        {
            let d = [];
            for (let i = 0; i < h.length; i++) { if (!d.ContainsKey(h[i])) d[h[i]] = 0; d[h[i]]++; }
            return d;
        }

        Fan(h, s)
        {
            let c = MahjongGame.Cnt(h);
            let fan = 0;
            if (this.Thirteen(h)) fan += 12;
            let suits = 0;
            for (let i = 0; i < 3; i++) for (let kv of CS.entries(c)) if (kv.Key[0] == "WTB"[i]) { suits++; break; }
            let hasZ = false, hasYao = false;
            for (let kv of CS.entries(c))
            {
                if (kv.Key[0] == 'Z') { hasZ = true; hasYao = true; }
                else if (kv.Key.length > 1 && (kv.Key[1] == '1' || kv.Key[1] == '9')) hasYao = true;
            }
            if (suits == 1 && !hasZ) fan += 8;
            else if (suits == 1 && hasZ) fan += 2;
            if (!hasYao) fan += 2;
            let pairs = 0; let seven = true, allSeq = true;
            for (let kv of CS.entries(c))
            {
                if (kv.Value % 2 != 0) seven = false;
                pairs += kv.Value / 2;
                if (kv.Value >= 3) allSeq = false;
            }
            if (seven && pairs == 7 && h.length == 14) { fan += 4; this.MarkFeat(s, "seven_pairs"); }
            if (this.AllTriplets(h)) fan += 2;
            if (allSeq && !seven) fan += 2;
            for (let si = 0; si < 3; si++)
            {
                let su = "WTB"[si].ToString(); let ok = true;
                for (let n = 1; n <= 9; n++) if (!c.ContainsKey(su + n)) { ok = false; break; }
                if (ok) { fan += 16; break; }
            }
            let meld = s.V.ContainsKey("meld") ? s.V["meld"] : CS.newArr(s.Seats, 0);
            let selfDraw = s.V.ContainsKey("_selfDraw") && CS.bool(s.V["_selfDraw"]);
            if (selfDraw && meld[s.Turn] == 0) fan += 1;
            let huKind = this.StrV(s, "_huKind", "");
            if (huKind == "gang" || huKind == "last" || huKind == "rob") fan += 4;
            if (fan == 0) fan = 1;
            return fan;
        }
        MinFan(s) { return this.Var(s) == "国标" ? this.OptI(s, "minFan", 8) : 1; }
        AllTriplets(h)
        {

            let c = MahjongGame.Cnt(h);
            let keys = c.Keys.ToList();
            for (let p = 0; p < keys.length; p++)
            {
                if (c[keys[p]] < 2) continue;
                c[keys[p]] -= 2;
                let ok = true;
                for (let kv of CS.entries(c)) if (kv.Value % 3 != 0) { ok = false; break; }
                c[keys[p]] += 2;
                if (ok) return true;
            }
            return false;
        }
        Thirteen(h)
        {
            if (h.length != 14) return false;
            let want = [ "W1","W9","T1","T9","B1","B9","Z1","Z2","Z3","Z4","Z5","Z6","Z7" ];
            let c = MahjongGame.Cnt(h);
            let dup = 0;
            for (let i = 0; i < want.length; i++)
            {
                let n; CS.tg(c, want[i], _v => n = _v).ok;
                if (n == 0) return false;
                if (n == 2) dup++;
                if (n > 2) return false;
            }
            return dup == 1;
        }
        CanHu(h, variant, s)
        {
            if (h.length != 14) return false;
            if (variant == "川麻" && this.OptB(s, "queMen", true))
            {
                let suits = 0;
                for (let i = 0; i < 3; i++) for (let c of h) if (c[0] == "WTB"[i]) { suits++; break; }
                if (suits != 2) return false;
            }
            let cnt = MahjongGame.Cnt(h);
            if (this.Thirteen(h)) return true;
            let pairs = 0; let seven = true;
            for (let kv of CS.entries(cnt)) { if (kv.Value % 2 != 0) seven = false; pairs += kv.Value / 2; }
            if (seven && pairs == 7) return this.Fan(h, s) >= this.MinFan(s);
            let keys = cnt.Keys.ToList();
            for (let p = 0; p < keys.length; p++)
            {
                if (cnt[keys[p]] < 2) continue;
                cnt[keys[p]] -= 2;
                if (this.Decompose(cnt, 4)) { cnt[keys[p]] += 2; return this.Fan(h, s) >= this.MinFan(s); }
                cnt[keys[p]] += 2;
            }
            return false;
        }
        Decompose(cnt, sets)
        {
            if (sets == 0)
            {
                for (let kv of CS.entries(cnt)) if (kv.Value != 0) return false;
                return true;
            }
            let first = null;
            for (let kv of CS.entries(cnt)) if (kv.Value > 0) { first = kv.Key; break; }
            if (first == null) return false;
            if (cnt[first] >= 3) { cnt[first] -= 3; let ok = this.Decompose(cnt, sets - 1); cnt[first] += 3; if (ok) return true; }
            if (first[0] != 'Z' && first.length >= 2)
            {
                let n = CS.int(CS.substr(first, 1));
                if (n <= 7)
                {
                    let a = CS.substr(first, 0, 1) + (n + 1), b = CS.substr(first, 0, 1) + (n + 2);
                    if (cnt.ContainsKey(a) && cnt[a] > 0 && cnt.ContainsKey(b) && cnt[b] > 0)
                    {
                        cnt[first]--; cnt[a]--; cnt[b]--;
                        let ok = this.Decompose(cnt, sets - 1);
                        cnt[first]++; cnt[a]++; cnt[b]++;
                        if (ok) return true;
                    }
                }
            }
            return false;
        }
        CanPeng(s, seat, tile)
        {
            let n = 0; for (let i = 0; i < s.Hands[seat].length; i++) if (s.Hands[seat][i] == tile) n++;
            return n >= 2;
        }
        CanGang(s, seat, tile)
        {
            let n = 0; for (let i = 0; i < s.Hands[seat].length; i++) if (s.Hands[seat][i] == tile) n++;
            return n >= 3;
        }
        CanChi(s, seat, tile)
        {
            if (tile.length < 2 || tile[0] == 'Z') return "";
            let n = CS.int(CS.substr(tile, 1));
            let suit = CS.substr(tile, 0, 1);
            for (let start = Math.max(1, n - 2); start <= Math.min(7, n); start++)
            {
                let ok = true;
                for (let k = start; k < start + 3; k++)
                {
                    if (k == n) continue;
                    let need = suit + k;
                    let have = false;
                    for (let i = 0; i < s.Hands[seat].length; i++) if (s.Hands[seat][i] == need) { have = true; break; }
                    if (!have) { ok = false; break; }
                }
                if (ok) return start + "," + (start + 1) + "," + (start + 2);
            }
            return "";
        }
        DrawOne(s, seat)
        {
            let wall = (s.V["wall"]).slice();
            if (wall.length == 0) { this.Finish(s, -1, "牌墙摸完，流局"); return; }
            s.Hands[seat].Add(wall[0]); wall.RemoveAt(0);
            s.V["wall"] = wall.ToArray();
            if (wall.length == 0) this.Say(s, "牌墙只剩最后一巡");
        }
        FillTo14(s, seat)
        {
            let guard = 0;
            while (!s.Ended && s.Hands[seat].length < 14 && guard++ < 6) this.DrawOne(s, seat);
        }
        NextDraw(s, seat)
        {
            this.DrawOne(s, seat);
            if (s.Ended) return;
            s.Turn = seat;
            s.V["phase"] = "discard";
            s.V["lastDiscard"] = "";
            s.V["lastBy"] = -1;
        }
        Priority(c)
        {
            if (c == "hu") return 4;
            if (c == "gang") return 3;
            if (c == "peng") return 2;
            if (c != null && c.StartsWith("chi")) return 1;
            return 0;
        }
        ResolveClaims(s)
        {
            let want = s.V["claimWanted"] || CS.newArr(s.Seats, "");
            let winner = -1; let code = "";
            for (let i = 0; i < s.Seats; i++)
                if (want[i] != null && this.Priority(want[i]) > this.Priority(code)) { winner = i; code = want[i]; }
            let tile = this.StrV(s, "lastDiscard", "");
            let disc = (s.V["discards"]).slice();
            if (winner < 0)
            {
                let next = (this.IntV(s, "lastBy", 0) + 1) % s.Seats;
                this.NextDraw(s, next);
                return;
            }

            if (disc.length > 0) disc.RemoveAt(disc.length - 1);
            s.V["discards"] = disc.ToArray();
            s.V["claims"] = CS.newArr(s.Seats, false);
            s.V["claimWanted"] = CS.newArr(s.Seats, "");
            if (code == "hu")
            {
                s.Hands[winner].Add(tile);
                let fan = this.Fan(s.Hands[winner], s);
                s.V["fan"] = fan;
                s.V["pointBy"] = this.IntV(s, "lastBy", 0);
                this.Finish(s, winner, "点炮胡 · " + this.Var(s) + " · " + fan + " 番（由座位 " + this.IntV(s, "lastBy", 0) + " 放出）");
                return;
            }
            let need = code == "gang" ? 3 : 2;
            let removed = 0;
            for (let i = s.Hands[winner].length - 1; i >= 0 && removed < need; i--)
                if (s.Hands[winner][i] == tile) { s.Hands[winner].RemoveAt(i); removed++; }
            if (code.StartsWith("chi"))
            {
                let seq = CS.substr(code, 4).Split(',');
                let n = CS.int(CS.substr(tile, 1));
                for (let k = 0; k < seq.length; k++)
                {
                    if (CS.int(seq[k]) == n) continue;
                    let t2 = CS.substr(tile, 0, 1) + seq[k];
                    for (let i = 0; i < s.Hands[winner].length; i++) if (s.Hands[winner][i] == t2) { s.Hands[winner].RemoveAt(i); break; }
                }
                s.Hands[winner].Add(tile);
                this.Say(s, "座位 " + winner + " 吃 " + tile);
            }
            else
            {
                s.Hands[winner].Add(tile);
                this.Say(s, "座位 " + winner + " " + (code == "gang" ? "杠" : "碰"));
            }
            let meld = s.V["meld"]; meld[winner]++; s.V["meld"] = meld;

            this.FillTo14(s, winner);
            if (s.Ended) return;
            s.Turn = winner;
            s.V["phase"] = "discard";
            this.Say(s, "请打出一张");
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || !s.Hands.ContainsKey(seat)) return r;
            if (this.StrV(s, "phase", "discard") == "claim")
            {
                if (seat == this.IntV(s, "lastBy", 0)) return r;
                let done = s.V["claims"];
                if (done != null && seat < done.length && done[seat]) return r;
                let tile = this.StrV(s, "lastDiscard", "");
                if (tile.length == 0) return r;
                let test = (s.Hands[seat]).slice(); test.Add(tile);
                if (this.CanHu(test, this.Var(s), s)) r.Add("hu");
                if (this.CanGang(s, seat, tile)) r.Add("gang");
                if (this.CanPeng(s, seat, tile)) r.Add("peng");
                if (this.OptB(s, "allowChi", true) && seat == (this.IntV(s, "lastBy", 0) + 1) % s.Seats)
                {
                    let chi = this.CanChi(s, seat, tile);
                    if (chi.length > 0) r.Add("chi:" + chi);
                }
                r.Add("pass");
                return r;
            }
            if (s.Turn != seat) return r;
            for (let i = 0; i < s.Hands[seat].length; i++) r.Add("p:" + i);
            if (this.CanHu(s.Hands[seat], this.Var(s), s)) r.Add("hu");
            return r;
        }
        Act(s, seat, action, d)
        {
            let code = CS.str(d["code"]);
            if (action == "hu")
            {
                let h = s.Hands[seat];
                if (this.StrV(s, "phase", "discard") == "claim")
                {
                    h = (s.Hands[seat]).slice(); h.Add(this.StrV(s, "lastDiscard", ""));
                    if (!this.CanHu(h, this.Var(s), s)) return MoveResult.Fail("这张牌不能胡");
                    s.V["pointBy"] = this.IntV(s, "lastBy", 0);
                    s.V["fan"] = this.Fan(h, s);
                    this.Finish(s, seat, "点炮胡 · " + this.Var(s) + " · " + this.IntV(s, "fan", 1) + " 番");
                    return MoveResult.Good();
                }
                if (!this.CanHu(h, this.Var(s), s)) return MoveResult.Fail("未成胡牌");
                s.V["fan"] = this.Fan(h, s);
                this.Finish(s, seat, "自摸 · " + this.Var(s) + " · " + this.IntV(s, "fan", 1) + " 番");
                return MoveResult.Good();
            }
            if (this.StrV(s, "phase", "discard") == "claim")
            {
                if (seat == this.IntV(s, "lastBy", 0)) return MoveResult.Fail("等其他人响应");
                if (!this.Legal(s, seat).Contains(code)) return MoveResult.Fail("现在不能这么应");
                let done = s.V["claims"];
                let want = s.V["claimWanted"];
                done[seat] = true;
                if (code != "pass") want[seat] = code;
                let all = true;
                for (let i = 0; i < s.Seats; i++)
                {
                    if (i == this.IntV(s, "lastBy", 0)) continue;
                    if (!done[i]) { all = false; break; }
                }
                if (all) this.ResolveClaims(s);
                else
                {

                    for (let k = 1; k <= s.Seats; k++)
                    {
                        let nx = (seat + k) % s.Seats;
                        if (nx != this.IntV(s, "lastBy", 0) && !done[nx]) { s.Turn = nx; break; }
                    }
                }
                return MoveResult.Good(code == "pass" ? "" : "已声明");
            }
            if (action != "p") return MoveResult.Fail("未知动作");
            if (!this.Legal(s, seat).Contains(code)) return MoveResult.Fail("非法打牌");
            let idx = Cfg.I(Cfg.Rest(code));
            let tile = s.Hands[seat][idx];
            s.Hands[seat].RemoveAt(idx);
            let disc = (s.V["discards"]).slice(); disc.Add(tile);
            s.V["discards"] = disc.ToArray();
            s.V["lastDiscard"] = tile; s.V["lastBy"] = seat;
            s.V["phase"] = "claim";
            s.V["_phase"] = "claim";
            s.V["claims"] = CS.newArr(s.Seats, false);
            s.V["claimWanted"] = CS.newArr(s.Seats, "");
            (s.V["claims"])[seat] = true;
            s.Last = code;

            let canAny = 0;
            for (let i = 0; i < s.Seats; i++) if (i != seat && this.Legal(s, i).length > 1) canAny++;
            if (canAny == 0) this.ResolveClaims(s);
            else
            {
                for (let k = 1; k <= s.Seats; k++)
                {
                    let nx = (seat + k) % s.Seats;
                    if (this.Legal(s, nx).length > 0) { s.Turn = nx; break; }
                }
            }
            return MoveResult.Good();
        }
        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            d["discards"] = s.V["discards"];
            d["wallLeft"] = (s.V["wall"]).length;
            d["meld"] = s.V["meld"];
            d["claimPhase"] = this.StrV(s, "phase", "discard") == "claim";
            d["lastDiscard"] = this.StrV(s, "lastDiscard", "");
            d["fan"] = this.IntV(s, "fan", 0);
            return d;
        }
    }



// ===== PartyGames.cs =====
    class FlightGame extends RuleBase
    {
        get Id() { return "feixingqi"; }
        get Renderer() { return "path"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 4; }
        get Variants() { return [ "经典", "连掷" ]; }
        static LEN = 52;
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Cells = CS.newArr(0, ""); s.Width = 0; s.Height = 0;
            let pos = CS.newArr(seats * 4, 0);
            for (let i = 0; i < pos.length; i++) pos[i] = -1;
            s.V["pos"] = pos; s.V["dice"] = 0; s.V["rolled"] = false; s.V["done"] = CS.newArr(seats, 0);
            return s;
        }
        Pos(s) { return s.V["pos"]; }
        SetPos(s, p) { s.V["pos"] = p; }
        Path(seat, step) { return (step + seat * 13) % FlightGame.LEN; }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat) return r;
            if (!this.BoolV(s, "rolled", false)) { r.Add("roll"); return r; }
            let dice = this.IntV(s, "dice", 0);
            let p = this.Pos(s);
            for (let k = 0; k < 4; k++)
            {
                let i = seat * 4 + k;
                if (p[i] >= FlightGame.LEN) continue;
                if (p[i] < 0 && dice != 6) continue;
                let np = p[i] < 0 ? 0 : p[i] + dice;
                if (np > FlightGame.LEN) continue;
                r.Add("m:" + i);
            }
            if (r.length == 0) r.Add("pass");
            return r;
        }
        Act(s, seat, action, d)
        {
            let code = CS.str(d["code"]);
            if (action == "roll")
            {
                let dice = 1 + this.NextRng(s, 6);
                s.V["dice"] = dice; s.V["rolled"] = true;
                this.Say(s, "座位 " + seat + " 掷出 " + dice);
                let l = this.Legal(s, seat);
                if (l.length == 1 && l[0] == "pass")
                {
                    s.V["rolled"] = false;
                    if (dice == 6 && s.Variant == "连掷") { this.Say(s, "掷出 6，连掷一次"); return MoveResult.Good(); }
                    this.Next(s, -1);
                }
                return MoveResult.Good();
            }
            if (action == "pass") { s.V["rolled"] = false; this.Next(s, -1); return MoveResult.Good(); }
            if (action != "m") return MoveResult.Fail("未知动作");
            let idx = Cfg.I(Cfg.Rest(code));
            if (!this.Legal(s, seat).Contains(code)) return MoveResult.Fail("该飞机不能移动");
            let dice2 = this.IntV(s, "dice", 0);
            let p = this.Pos(s);
            let np = p[idx] < 0 ? 0 : p[idx] + dice2;
            if (np >= FlightGame.LEN) { p[idx] = FlightGame.LEN; this.Say(s, "一架飞机抵达终点！"); }
            else
            {

                if (np % 13 == 0 && np + 4 <= FlightGame.LEN) { np += 4; this.Say(s, "跳格 +4"); }
                p[idx] = np;

                let cell = this.Path(seat, np);
                for (let j = 0; j < p.length; j++)
                    if (j != idx && j / 4 != seat && p[j] >= 0 && p[j] < FlightGame.LEN && this.Path(j / 4, p[j]) == cell)
                    { p[j] = -1; this.Say(s, "撞机！对方飞机回库"); }
            }
            this.SetPos(s, p);
            let done = s.V["done"];
            done[seat] = 0; for (let k = 0; k < 4; k++) if (p[seat * 4 + k] >= FlightGame.LEN) done[seat]++;
            s.V["done"] = done;
            s.Last = code;
            if (done[seat] >= 4) { this.Finish(s, seat, "四架飞机全部抵达，胜"); return MoveResult.Good(); }
            s.V["rolled"] = false;
            let again = dice2 == 6;
            if (!again) this.Next(s, -1);
            else this.Say(s, "掷出 6，再来一次");
            return MoveResult.Good();
        }
        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            d["dice"] = this.IntV(s, "dice", 0);
            d["rolled"] = this.BoolV(s, "rolled", false);
            d["pathLength"] = FlightGame.LEN;
            return d;
        }
    }

    class MonopolyGame extends RuleBase
    {
        get Id() { return "monopoly"; }
        get Renderer() { return "path"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 6; }
        get Variants() { return [ "简版" ]; }
        static N = 20;
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Cells = CS.newArr(0, ""); s.Width = 0; s.Height = 0;
            s.V["pos"] = CS.newArr(seats, 0);
            s.V["cash"] = CS.repeat(1500, seats).ToArray();
            s.V["owner"] = CS.repeat(-1, MonopolyGame.N).ToArray();
            s.V["price"] = CS.range(0, MonopolyGame.N).Select(i => 100 + (i % 5) * 60).ToArray();
            s.V["alive"] = CS.repeat(true, seats).ToArray();
            s.V["rolled"] = false; s.V["dice"] = 0; s.V["canBuy"] = false;
            return s;
        }
        Alive(s, i) { let a = s.V["alive"]; return i < a.length && a[i]; }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat || !this.Alive(s, seat)) { if (s.Turn == seat && !s.Ended) r.Add("pass"); return r; }
            if (!this.BoolV(s, "rolled", false)) { r.Add("roll"); return r; }
            if (this.BoolV(s, "canBuy", false)) { r.Add("buy"); r.Add("skip"); return r; }
            r.Add("next"); return r;
        }
        Act(s, seat, action, d)
        {
            let pos = s.V["pos"], cash = s.V["cash"], owner = s.V["owner"], price = s.V["price"];
            let alive = s.V["alive"];
            if (action == "pass" || action == "next" || action == "skip")
            {
                if (action == "skip") s.V["canBuy"] = false;
                s.V["rolled"] = false;
                let t = s.Turn;
                for (let k = 0; k < s.Seats; k++) { t = (t + 1) % s.Seats; if (this.Alive(s, t)) break; }
                s.Turn = t; s.MoveNo++;
                return MoveResult.Good();
            }
            if (action == "roll")
            {
                let dice = 1 + this.NextRng(s, 6);
                s.V["dice"] = dice; s.V["rolled"] = true;
                pos[seat] = (pos[seat] + dice) % MonopolyGame.N; s.V["pos"] = pos;
                let cell = pos[seat];
                if (cell % 5 == 0 && owner[cell] < 0) { s.V["canBuy"] = true; this.Say(s, "来到空地 " + cell + "，价 " + price[cell]); return MoveResult.Good(); }
                if (owner[cell] >= 0 && owner[cell] != seat)
                {
                    let rent = price[cell] / 5 + 20;
                    cash[seat] -= rent; cash[owner[cell]] += rent;
                    s.V["cash"] = cash; this.Say(s, "支付过路费 " + rent + " 给座位 " + owner[cell]);
                }
                else if (cell % 7 == 3) { let delta = this.NextRng(s, 2) == 0 ? 200 : -150; cash[seat] += delta; s.V["cash"] = cash; this.Say(s, "机会格 " + (delta > 0 ? "+" : "") + delta); }
                if (cash[seat] <= 0) { alive[seat] = false; s.V["alive"] = alive; this.Say(s, "座位 " + seat + " 囊空出局"); }
                return MoveResult.Good();
            }
            if (action == "buy")
            {
                let cell = pos[seat];
                if (owner[cell] >= 0 || cash[seat] < price[cell]) return MoveResult.Fail("无法购买");
                cash[seat] -= price[cell]; owner[cell] = seat;
                s.V["cash"] = cash; s.V["owner"] = owner; s.V["canBuy"] = false;
                this.Say(s, "座位 " + seat + " 买下地块 " + cell);
                return MoveResult.Good();
            }
            return MoveResult.Fail("未知动作");
        }
        View(s, seat)
        {
            let alive = s.V["alive"];
            let cnt = 0, last = 0;
            for (let i = 0; i < alive.length; i++) if (alive[i]) { cnt++; last = i; }
            if (cnt <= 1 && !s.Ended) { s.Ended = true; s.Phase = "end"; s.Winner = CS.str(last); s.Result = "其余玩家囊空，座位 " + last + " 胜"; }
            return super.View(s, seat);
        }
    }

    class WerewolfGame extends RuleBase
    {
        get Id() { return "werewolf"; }
        get Renderer() { return "party"; }
        get MinSeats() { return 6; }
        get MaxSeats() { return 12; }
        get Variants() { return [ "预女猎守", "简版" ]; }

        NightRoles(s)
        {
            if (s.Variant == "简版") return [ "狼人" ];
            return [ "狼人", "预言家", "女巫", "守卫" ];
        }
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Cells = CS.newArr(0, ""); s.Width = 0; s.Height = 0;

            s.Seats = seats;
            s.Variant = CS.empty(variant) ? "预女猎守" : variant;
            let roles = [];
            let wolves = Math.max(2, seats / 3);
            for (let i = 0; i < wolves; i++) roles.Add("狼人");
            if (variant != "简版")
            {
                roles.Add("预言家"); roles.Add("女巫"); roles.Add("猎人"); roles.Add("守卫");
            }
            while (roles.length < seats) roles.Add("村民");
            this.Shuffle(s, roles);
            let alive = CS.newArr(seats, false);
            for (let i = 0; i < seats; i++) { alive[i] = true; s.V["role" + i] = roles[i]; }
            s.V["alive"] = alive;
            s.V["phase"] = "night"; s.V["nightStep"] = 0; s.V["target"] = -1; s.V["day"] = 1;
            s.V["heal"] = true; s.V["poison"] = true; s.V["poisoned"] = -1;
            s.V["saved"] = -1; s.V["guard"] = -1;
            s.V["votes"] = CS.newArr(seats, 0); s.V["_voted"] = CS.newArr(seats, false); s.V["voted"] = 0;
            s.V["_spoken"] = CS.newArr(seats, false); s.V["speech"] = CS.newArr(seats, "");
            s.Turn = 0;
            this.SkipEmptySteps(s);
            return s;
        }
        Alive(s, i) { let a = s.V["alive"]; return i >= 0 && i < a.length && a[i]; }
        Role(s, i) { return this.StrV(s, "role" + i, "村民"); }
        CountAlive(s) { let n = 0; for (let i = 0; i < s.Seats; i++) if (this.Alive(s, i)) n++; return n; }
        FirstAlive(s) { for (let i = 0; i < s.Seats; i++) if (this.Alive(s, i)) return i; return 0; }
        CountRole(s, role)
        {
            let n = 0;
            for (let i = 0; i < s.Seats; i++) if (this.Alive(s, i) && this.Role(s, i) == role) n++;
            return n;
        }
        CountGood(s)
        {
            let n = 0;
            for (let i = 0; i < s.Seats; i++) if (this.Alive(s, i) && this.Role(s, i) != "狼人") n++;
            return n;
        }
        Team(s, wolf)
        {
            let r = [];
            for (let i = 0; i < s.Seats; i++) if ((this.Role(s, i) == "狼人") == wolf) r.Add(i);
            return r;
        }
        CheckEnd(s)
        {
            let wolves = this.CountRole(s, "狼人"), good = this.CountGood(s);
            if (wolves == 0) { this.FinishTeam(s, this.Team(s, false), "狼人全灭，好人阵营胜"); return true; }
            if (wolves >= good) { this.FinishTeam(s, this.Team(s, true), "狼人数量不低于好人，狼人阵营胜"); return true; }
            return false;
        }
        StepActive(s, role)
        {
            for (let i = 0; i < s.Seats; i++) if (this.Alive(s, i) && this.Role(s, i) == role) return true;
            return false;
        }
        SkipEmptySteps(s)
        {
            let roles = this.NightRoles(s);
            let step = this.IntV(s, "nightStep", 0);
            while (step < roles.length && !this.StepActive(s, roles[step])) step++;
            s.V["nightStep"] = step;
        }
        AfterNightAction(s)
        {
            s.V["nightStep"] = this.IntV(s, "nightStep", 0) + 1;
            this.SkipEmptySteps(s);
            if (this.IntV(s, "nightStep", 0) >= this.NightRoles(s).length) this.Day(s);
        }
        Day(s)
        {
            let t = this.IntV(s, "target", -1), guard = this.IntV(s, "guard", -1);
            let saved = this.IntV(s, "saved", -1), poisoned = this.IntV(s, "poisoned", -1);
            let killed = "平安夜";
            let a = s.V["alive"];
            if (t >= 0 && t < a.length && a[t] && t != guard && t != saved)
            { a[t] = false; killed = "座位 " + t + " 遇袭"; }
            if (poisoned >= 0 && poisoned < a.length && a[poisoned])
            { a[poisoned] = false; killed += "；座位 " + poisoned + " 被毒"; }
            s.V["alive"] = a;
            this.Say(s, "天亮了：" + killed);
            if (this.CheckEnd(s)) return;
            s.V["phase"] = "speech";
            s.V["_spoken"] = CS.newArr(s.Seats, false); s.V["speech"] = CS.newArr(s.Seats, "");
            s.V["votes"] = CS.newArr(s.Seats, 0); s.V["_voted"] = CS.newArr(s.Seats, false); s.V["voted"] = 0;
            s.V["day"] = this.IntV(s, "day", 1) + 1;
            s.Turn = this.FirstAlive(s);
        }
        ToVote(s)
        {
            s.V["phase"] = "vote";
            s.V["votes"] = CS.newArr(s.Seats, 0); s.V["_voted"] = CS.newArr(s.Seats, false); s.V["voted"] = 0;
            s.Turn = this.FirstAlive(s);
        }
        Night(s)
        {
            s.V["phase"] = "night"; s.V["nightStep"] = 0;
            s.V["target"] = -1; s.V["guard"] = -1; s.V["saved"] = -1; s.V["poisoned"] = -1;
            s.V["heal"] = true; s.V["poison"] = true;
            s.Turn = this.FirstAlive(s);
            this.SkipEmptySteps(s);
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || !this.Alive(s, seat)) return r;
            let ph = this.StrV(s, "phase", "night");
            if (ph == "night")
            {
                let roles = this.NightRoles(s);
                let step = this.IntV(s, "nightStep", 0);
                if (step >= roles.length) return r;
                let want = roles[step];
                if (this.Role(s, seat) != want) return r;
                if (want == "女巫")
                {
                    if (this.BoolV(s, "heal", false)) r.Add("save");
                    if (this.BoolV(s, "poison", false))
                        for (let i = 0; i < s.Seats; i++) if (this.Alive(s, i)) r.Add("poison:" + i);
                    r.Add("skip");
                    return r;
                }
                for (let i = 0; i < s.Seats; i++) if (this.Alive(s, i) && i != seat) r.Add("night:" + i);
                if (r.length == 0) r.Add("skip");
                return r;
            }
            if (ph == "speech")
            {
                let sp = s.V["_spoken"];
                if (seat < sp.length && sp[seat]) return r;
                if (s.Turn == seat) r.Add("say:*");
                return r;
            }
            let vv = s.V["_voted"];
            if (seat < vv.length && vv[seat]) return r;
            for (let i = 0; i < s.Seats; i++) if (this.Alive(s, i) && i != seat) r.Add("vote:" + i);
            return r;
        }
        Act(s, seat, action, d)
        {
            let code = CS.str(d["code"]);
            if (!this.Legal(s, seat).Contains(code) && code != "say:" && !code.StartsWith("say:"))
                return MoveResult.Fail("当前阶段你不能这样行动");
            let ph = this.StrV(s, "phase", "night");
            if (ph == "night")
            {
                let roles = this.NightRoles(s);
                let step = this.IntV(s, "nightStep", 0);
                let want = step < roles.length ? roles[step] : "";
                if (action == "night")
                {
                    let t = Cfg.I(Cfg.Rest(code));
                    if (want == "狼人") { s.V["target"] = t; this.Say(s, "狼人已选定目标"); }
                    else if (want == "预言家") this.Say(s, "查验结果：" + (this.Role(s, t) == "狼人" ? "狼人" : "好人"));
                    else if (want == "守卫") s.V["guard"] = t;
                }
                else if (action == "save") { s.V["heal"] = false; s.V["saved"] = this.IntV(s, "target", -1); }
                else if (action == "poison") { s.V["poison"] = false; s.V["poisoned"] = Cfg.I(Cfg.Rest(code)); }
                this.AfterNightAction(s);
                return MoveResult.Good();
            }
            if (ph == "speech")
            {
                if (action != "say") return MoveResult.Fail("现在只能发言");
                let text = Cfg.Rest(code);
                if (text.length > 120) text = CS.substr(text, 0, 120);
                let speech = s.V["speech"]; speech[seat] = text; s.V["speech"] = speech;
                let sp = s.V["_spoken"]; sp[seat] = true; s.V["_spoken"] = sp;
                this.Say(s, text.length > 0 ? "座位 " + seat + " 发言：" + text : "座位 " + seat + " 选择不发言");
                let next = -1;
                for (let k = 1; k <= s.Seats; k++)
                { let i = (seat + k) % s.Seats; if (this.Alive(s, i) && !sp[i]) { next = i; break; } }
                if (next < 0) this.ToVote(s); else s.Turn = next;
                return MoveResult.Good();
            }
            let vv2 = s.V["_voted"]; vv2[seat] = true; s.V["_voted"] = vv2;
            let t2 = action == "vote" ? Cfg.I(Cfg.Rest(code)) : -1;
            let votes = s.V["votes"];
            if (t2 >= 0 && t2 < votes.length) votes[t2]++;
            s.V["votes"] = votes;
            s.V["voted"] = this.IntV(s, "voted", 0) + 1;
            if (this.IntV(s, "voted", 0) >= this.CountAlive(s))
            {
                let mx = 0, outSeat = -1;
                for (let i = 0; i < votes.length; i++) if (votes[i] > mx) { mx = votes[i]; outSeat = i; }
                if (outSeat >= 0)
                {
                    let a = s.V["alive"]; a[outSeat] = false; s.V["alive"] = a;
                    this.Say(s, "白天放逐座位 " + outSeat + "（" + this.Role(s, outSeat) + "）");
                }
                if (this.CheckEnd(s)) return MoveResult.Good();
                this.Night(s);
            }
            return MoveResult.Good();
        }
        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            let kill = [];
            for (let k of d.Keys) if (k.StartsWith("role") || k.StartsWith("speech") || k.StartsWith("guard") || k.StartsWith("target")) kill.Add(k);
            for (let k of kill) d.Remove(k);
            let ph = this.StrV(s, "phase", "night");
            d["myRole"] = seat >= 0 ? this.Role(s, seat) : "";
            d["alive"] = s.V["alive"];
            d["phase"] = ph;
            d["day"] = this.IntV(s, "day", 1);
            d["wolves"] = this.CountRole(s, "狼人");
            d["speaker"] = ph == "speech" ? s.Turn : -1;
            d["speeches"] = (s.V["speech"]).ToArray();
            d["spoken"] = (s.V["_spoken"]).ToArray();
            d["voted"] = this.IntV(s, "voted", 0);
            d["aliveCount"] = this.CountAlive(s);
            let roles = this.NightRoles(s);
            let step = this.IntV(s, "nightStep", 0);
            let want = step < roles.length ? roles[step] : "";
            d["nightRole"] = (ph == "night" && seat >= 0 && this.Role(s, seat) == want) ? want : "";
            return d;
        }
        View(s, seat)
        {
            let v = super.View(s, seat);
            if (!s.Ended)
            {
                let ph = this.StrV(s, "phase", "night"), day = this.IntV(s, "day", 1).ToString();
                if (ph == "night") v["phaseName"] = "第 " + day + " 夜 · 角色行动";
                else if (ph == "speech") v["phaseName"] = "第 " + day + " 天 · 发言（座位 " + s.Turn + "）";
                else v["phaseName"] = "第 " + day + " 天 · 放逐投票";
            }
            return v;
        }
    }

    class UndercoverGame extends RuleBase
    {
        get Id() { return "undercover"; }
        get Renderer() { return "party"; }
        get MinSeats() { return 3; }
        get MaxSeats() { return 9; }
        get Variants() { return [ "经典", "白板" ]; }
        static PAIRS = [
            ["奶茶","咖啡"], ["空调","风扇"], ["电影院","剧场"],
            ["铅笔","钢笔"], ["西瓜","哈密瓜"], ["地铁","公交"],
            ["爬山","徒步"], ["火锅","烧烤"]
        ];
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Cells = CS.newArr(0, ""); s.Width = 0; s.Height = 0;
            s.Seats = seats;
            let pair = UndercoverGame.PAIRS[this.NextRng(s, UndercoverGame.PAIRS.length)];
            let spies = seats >= 7 ? 2 : 1;
            let order = CS.range(0, seats).OrderBy(x => this.NextRng(s, 1000)).ToList();
            let alive = CS.newArr(seats, false);
            for (let i = 0; i < seats; i++)
            {
                alive[i] = true;
                let spy = order.IndexOf(i) < spies;
                s.V["word" + i] = variant == "白板" && order.IndexOf(i) == spies ? "" : (spy ? pair[1] : pair[0]);
                s.V["spy" + i] = spy;
            }
            s.V["alive"] = alive;
            s.V["phase"] = "describe";
            s.V["votes"] = CS.newArr(seats, 0); s.V["_voted"] = CS.newArr(seats, false); s.V["voted"] = 0; s.V["round"] = 1;
            s.V["_spoken"] = CS.newArr(seats, false); s.V["speech"] = CS.newArr(seats, "");
            s.Turn = 0;
            return s;
        }
        Alive(s, i) { let a = s.V["alive"]; return i >= 0 && i < a.length && a[i]; }
        Spy(s, i) { return this.BoolV(s, "spy" + i, false); }
        CountAlive(s) { let n = 0; for (let i = 0; i < s.Seats; i++) if (this.Alive(s, i)) n++; return n; }
        FirstAlive(s) { for (let i = 0; i < s.Seats; i++) if (this.Alive(s, i)) return i; return 0; }
        Team(s, spy)
        {
            let r = [];
            for (let i = 0; i < s.Seats; i++) if (this.Spy(s, i) == spy) r.Add(i);
            return r;
        }
        ToVote(s)
        {
            s.V["phase"] = "vote";
            s.V["votes"] = CS.newArr(s.Seats, 0); s.V["_voted"] = CS.newArr(s.Seats, false); s.V["voted"] = 0;
            s.Turn = this.FirstAlive(s);
        }
        Settle(s)
        {
            let votes = s.V["votes"];
            let mx = 0, outSeat = -1;
            for (let i = 0; i < votes.length; i++) if (votes[i] > mx) { mx = votes[i]; outSeat = i; }
            if (outSeat >= 0)
            {
                let a = s.V["alive"]; a[outSeat] = false; s.V["alive"] = a;
                this.Say(s, "座位 " + outSeat + " 出局，身份：" + (this.Spy(s, outSeat) ? "卧底" : "平民"));
            }
            let spies = 0, goods = 0;
            for (let i = 0; i < s.Seats; i++) if (this.Alive(s, i)) { if (this.Spy(s, i)) spies++; else goods++; }
            if (spies == 0) { this.FinishTeam(s, this.Team(s, false), "卧底全部出局，平民胜"); return MoveResult.Good(); }
            if (spies >= goods) { this.FinishTeam(s, this.Team(s, true), "卧底人数追平平民，卧底胜"); return MoveResult.Good(); }
            s.V["phase"] = "describe";
            s.V["_spoken"] = CS.newArr(s.Seats, false); s.V["speech"] = CS.newArr(s.Seats, "");
            s.V["votes"] = CS.newArr(s.Seats, 0); s.V["_voted"] = CS.newArr(s.Seats, false); s.V["voted"] = 0;
            s.V["round"] = this.IntV(s, "round", 1) + 1;
            s.Turn = this.FirstAlive(s);
            return MoveResult.Good();
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || !this.Alive(s, seat)) return r;
            let ph = this.StrV(s, "phase", "describe");
            if (ph == "describe")
            {
                let sp = s.V["_spoken"];
                r.Add("next");
                if (s.Turn == seat && (seat >= sp.length || !sp[seat])) r.Add("say:*");
                return r;
            }
            let vv = s.V["_voted"];
            if (seat < vv.length && vv[seat]) return r;
            for (let i = 0; i < s.Seats; i++) if (this.Alive(s, i) && i != seat) r.Add("vote:" + i);
            r.Add("next");
            return r;
        }
        Act(s, seat, action, d)
        {
            let code = CS.str(d["code"]);
            if (!this.Legal(s, seat).Contains(code) && !code.StartsWith("say:"))
                return MoveResult.Fail("当前不能这样行动");
            let ph = this.StrV(s, "phase", "describe");
            if (ph == "describe")
            {
                if (action == "next") { this.ToVote(s); return MoveResult.Good(); }
                if (action != "say") return MoveResult.Fail("现在只能描述");
                let text = Cfg.Rest(code);
                if (text.length > 120) text = CS.substr(text, 0, 120);
                let speech = s.V["speech"]; speech[seat] = text; s.V["speech"] = speech;
                let sp = s.V["_spoken"]; sp[seat] = true; s.V["_spoken"] = sp;
                if (text.length > 0) this.Say(s, "座位 " + seat + " 描述：" + text);
                else this.Say(s, "座位 " + seat + " 跳过描述");
                let next = -1;
                for (let k = 1; k <= s.Seats; k++)
                { let i = (seat + k) % s.Seats; if (this.Alive(s, i) && !sp[i]) { next = i; break; } }
                if (next < 0) this.ToVote(s); else s.Turn = next;
                return MoveResult.Good();
            }
            if (action == "next")
            {
                if (this.IntV(s, "voted", 0) < this.CountAlive(s)) return MoveResult.Fail("还有人未投票");
                return this.Settle(s);
            }
            let t = Cfg.I(Cfg.Rest(code));
            let vv2 = s.V["_voted"]; vv2[seat] = true; s.V["_voted"] = vv2;
            let v = s.V["votes"]; if (t >= 0 && t < v.length) v[t]++; s.V["votes"] = v;
            s.V["voted"] = this.IntV(s, "voted", 0) + 1;
            if (this.IntV(s, "voted", 0) >= this.CountAlive(s)) return this.Settle(s);
            return MoveResult.Good();
        }
        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            let kill = [];
            for (let k of d.Keys)
                if (k.StartsWith("word") || k.StartsWith("spy") || k.StartsWith("speech") || (k.StartsWith("alive") && k.length > 5)) kill.Add(k);
            for (let k of kill) d.Remove(k);
            let ph = this.StrV(s, "phase", "describe");
            d["myWord"] = seat >= 0 ? this.StrV(s, "word" + seat, "") : "";
            d["alive"] = s.V["alive"];
            d["phase"] = ph;
            d["round"] = this.IntV(s, "round", 1);
            d["speaker"] = ph == "describe" ? s.Turn : -1;
            d["speeches"] = (s.V["speech"]).ToArray();
            d["spoken"] = (s.V["_spoken"]).ToArray();
            d["voted"] = this.IntV(s, "voted", 0);
            d["aliveCount"] = this.CountAlive(s);
            return d;
        }
        View(s, seat)
        {
            let v = super.View(s, seat);
            if (!s.Ended)
            {
                let ph = this.StrV(s, "phase", "describe"), round = this.IntV(s, "round", 1).ToString();
                v["phaseName"] = ph == "describe"
                    ? "第 " + round + " 轮 · 描述（座位 " + s.Turn + "）"
                    : "第 " + round + " 轮 · 投票";
            }
            return v;
        }
    }

    class Point24Game extends RuleBase
    {
        get Id() { return "point24"; }
        get Renderer() { return "party"; }
        get MinSeats() { return 1; }
        get MaxSeats() { return 4; }
        get Variants() { return [ "抢答" ]; }
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Cells = CS.newArr(0, ""); s.Width = 0; s.Height = 0;
            let n = CS.newArr(4, 0);
            for (let i = 0; i < 4; i++) n[i] = 1 + this.NextRng(s, 9);
            s.V["nums"] = n; s.V["round"] = 1;
            return s;
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended) return r;
            r.Add("solve:*"); r.Add("new");
            return r;
        }
        Act(s, seat, action, d)
        {
            let code = CS.str(d["code"]);
            if (action == "new")
            {
                let n = s.V["nums"];
                for (let i = 0; i < 4; i++) n[i] = 1 + this.NextRng(s, 9);
                s.V["nums"] = n; s.V["round"] = this.IntV(s, "round", 1) + 1;
                this.Say(s, "新一题：" + CS.join(" ", n.Select(x => CS.str(x)).ToArray()));
                return MoveResult.Good();
            }
            if (action != "solve") return MoveResult.Fail("未知动作");
            let expr = Cfg.Rest(code);
            let nums = s.V["nums"];
            let p = new CS.FracParser(expr);
            let val;
            let used = [];
            if (!CS.pp(p, used, _v => val = _v)) return MoveResult.Fail("表达式不合法");
            let a = (used).slice(); a.Sort();
            let b = (nums).slice(); b.Sort();
            if (a.length != 4 || !a.SequenceEqual(b)) return MoveResult.Fail("必须且只能使用给出的四个数");
            if (val.N != 24 * val.D) return MoveResult.Fail("结果不是 24（" + val + "）");
            this.Finish(s, seat, "座位 " + seat + " 抢答正确：" + expr + " = 24");
            return MoveResult.Good();
        }
        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            d["nums"] = s.V["nums"];
            d["round"] = this.IntV(s, "round", 1);
            return d;
        }
    }



    class SolitaireGame extends RuleBase
    {
        get Id() { return "solitaire"; }
        get Renderer() { return "party"; }
        get MinSeats() { return 1; }
        get MaxSeats() { return 1; }
        get Variants() { return [ "经典" ]; }
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Cells = CS.newArr(0, ""); s.Width = 0; s.Height = 0;
            let deck = Cards.Deck(1, false); this.Shuffle(s, deck);
            s.Hands[0] = [];
            for (let i = 0; i < 13 && deck.length > 0; i++) { s.Hands[0].Add(deck[0]); deck.RemoveAt(0); }
            s.V["pile"] = Cards.Val(deck[0]).ToString();
            deck.RemoveAt(0);
            s.V["rest"] = deck.ToArray(); s.V["moves"] = 0;
            return s;
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended) return r;
            let top = Cfg.I(this.StrV(s, "pile", "0"));
            for (let i = 0; i < s.Hands[0].length; i++)
                if (Math.abs(Cards.Val(s.Hands[0][i]) - top) == 1 || Cards.Val(s.Hands[0][i]) == top) r.Add("p:" + i);
            r.Add("draw");
            return r;
        }
        Act(s, seat, action, d)
        {
            let code = CS.str(d["code"]);
            if (action == "draw")
            {
                let rest = (s.V["rest"]).slice();
                if (rest.length > 0) { s.Hands[0].Add(rest[0]); rest.RemoveAt(0); }
                s.V["rest"] = rest.ToArray(); return MoveResult.Good();
            }
            if (action != "p" || !this.Legal(s, seat).Contains(code)) return MoveResult.Fail("接不上");
            let idx = Cfg.I(Cfg.Rest(code));
            let c = s.Hands[0][idx];
            s.Hands[0].RemoveAt(idx);
            s.V["pile"] = Cards.Val(c).ToString();
            s.V["moves"] = this.IntV(s, "moves", 0) + 1;
            s.Last = code;
            if (s.Hands[0].length == 0) this.Finish(s, 0, "练习完成，共 " + this.IntV(s, "moves", 0) + " 手");
            return MoveResult.Good();
        }
        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            d["pile"] = this.StrV(s, "pile", "0");
            d["restLeft"] = (s.V["rest"]).length;
            d["moves"] = this.IntV(s, "moves", 0);
            return d;
        }
    }


// ===== ExtraGames.cs =====
    class RJ
    {
        static Frame(...kv)
        {
            let d = [];
            for (let i = 0; i + 1 < kv.length; i += 2) d[CS.str(kv[i])] = kv[i + 1];
            return d;
        }
        static Str(d, k, def)
        {
            let o;
            if (d == null || !CS.tg(d, k, _v => o = _v).ok || o == null) return def;
            return o || CS.str(o);
        }
        static Int(d, k, def)
        {
            let o;
            if (d == null || !CS.tg(d, k, _v => o = _v).ok || o == null) return def;
            try { return CS.int(o); } catch (e) { return def; }
        }
        static Bool(d, k, def)
        {
            let o;
            if (d == null || !CS.tg(d, k, _v => o = _v).ok || o == null) return def;
            if (CS.isType(o)) return o;
            let t = CS.str(o).toLowerCase();
            return t == "true" || t == "1";
        }
    }


    class ExtraGame extends RuleBase
    {
        _id ;
        constructor(id) { super(); this._id = id; }
        get Id() { return this._id; }

        static GRID = [ "dots", "hex", "nim", "endgame", "junqi4" ];
        static TABLE = [ "gouji", "baohuang", "chudadi", "shuangkou", "showhand", "blackjack" ];
        static PARTY = [ "liarsdice", "avalon", "turtlesoup", "mastermind", "drawguess" ];
        static In(a, x) { for (let i = 0; i < a.length; i++) if (a[i] == x) return true; return false; }

        get Renderer() { return ExtraGame.In(ExtraGame.GRID, this._id) ? "grid" : ExtraGame.In(ExtraGame.TABLE, this._id) ? "table" : ExtraGame.In(ExtraGame.PARTY, this._id) ? "party" : "party"; }
        get MinSeats() {
                if (this._id == "gouji") return 6;
                if (this._id == "baohuang") return 5;
                if (this._id == "chudadi" || this._id == "shuangkou") return 4;
                if (this._id == "showhand") return 2;
                if (this._id == "blackjack" || this._id == "liarsdice") return 2;
                if (this._id == "avalon") return 5;
                if (this._id == "turtlesoup" || this._id == "drawguess") return 3;
                if (this._id == "junqi4") return 4;
                if (this._id == "mastermind" || this._id == "endgame") return 1;
                return 2;
            }
        get MaxSeats() {
                if (this._id == "gouji") return 6;
                if (this._id == "baohuang") return 5;
                if (this._id == "showhand" || this._id == "blackjack") return 6;
                if (this._id == "liarsdice" || this._id == "turtlesoup" || this._id == "drawguess") return 8;
                if (this._id == "avalon") return 10;
                if (this._id == "mastermind") return 2;
                if (this._id == "endgame") return 1;
                if (this._id == "junqi4" || this._id == "chudadi" || this._id == "shuangkou") return 4;
                return 2;
            }
        get Variants() {
                if (this._id == "hex") return [ "7路", "11路" ];
                if (this._id == "dots") return [ "3×3", "5×5" ];
                if (this._id == "nim") return [ "3/5/7", "1/3/5/7" ];
                if (this._id == "endgame") return [ "第一关", "第二关", "第三关" ];
                if (this._id == "junqi4") return [ "四国暗棋", "四国翻棋" ];
                if (this._id == "blackjack") return [ "经典", "双副" ];
                if (this._id == "liarsdice") return [ "经典", "大话+1" ];
                if (this._id == "avalon") return [ "标准", "快节奏" ];
                if (this._id == "turtlesoup") return [ "清汤", "重口" ];
                if (this._id == "mastermind") return [ "4位", "5位" ];
                if (this._id == "drawguess") return [ "3轮", "5轮" ];
                if (this._id == "chudadi") return [ "常式", "墨榜", "闲式" ];
                if (this._id == "shuangkou") return [ "双扣", "百搭" ];
                return [ "经典" ];
            }
        TeamMode() { return this._id == "gouji" || this._id == "shuangkou" || this._id == "junqi4"; }
        TeamOf(seat, seats)
        {
            if (this._id == "junqi4") return seat % 2;
            return seat % (seats / 2);
        }

        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Game = this._id; s.Room = room; s.Seats = seats;
            s.V["hidden"] = this._id == "junqi4" && variant != "四国翻棋";
            s.V["score"] = CS.newArr(seats, 0);
            s.V["round"] = 1;
            if (ExtraGame.In(ExtraGame.GRID, this._id)) this.BuildGrid(s, variant, seats);
            else if (ExtraGame.In(ExtraGame.TABLE, this._id)) this.BuildTable(s, variant, seats);
            else this.BuildParty(s, variant, seats);
            this.Say(s, "开局 · " + this._id);
            return s;
        }

        BuildGrid(s, variant, seats)
        {
            if (this._id == "dots")
            {
                let n = variant == "5×5" ? 5 : 3;
                this.SetGrid(s, n * 2 + 1, n * 2 + 1);
                s.V["dn"] = n;
                for (let y = 0; y < s.Height; y++)
                    for (let x = 0; x < s.Width; x++)
                        if ((x % 2 == 1) && (y % 2 == 1)) s.Cells[this.At(s, x, y)] = ".";
                        else if ((x % 2 == 0) && (y % 2 == 0)) s.Cells[this.At(s, x, y)] = "+";
                s.PhaseName = "画边占格";
            }
            else if (this._id == "hex")
            {
                let n = variant == "11路" ? 11 : 7;
                this.SetGrid(s, n, n);
                s.V["hn"] = n;
                s.PhaseName = "红连上下 · 蓝连左右";
            }
            else if (this._id == "nim")
            {
                let heaps = variant == "1/3/5/7" ? [ 1, 3, 5, 7 ] : [ 3, 5, 7 ];
                this.SetGrid(s, heaps.length, 1);
                for (let i = 0; i < heaps.length; i++) s.Cells[i] = heaps[i].ToString();
                s.V["heaps"] = heaps.Clone();
                s.PhaseName = "轮流取石子，取到最后一枚者胜";
            }
            else if (this._id == "endgame")
            {

                this.SetGrid(s, 5, 5);
                s.Cells[this.At(s, 2, 0)] = "bK"; s.Cells[this.At(s, 2, 4)] = "rK";
                s.Cells[this.At(s, 0, 2)] = "rR"; s.Cells[this.At(s, 4, 2)] = "rP";
                let lv = variant == "第二关" ? 2 : variant == "第三关" ? 3 : 1;
                s.V["level"] = lv;
                s.V["solved"] = false;
                s.PhaseName = "残局 " + lv + " · 点出制胜的一手";
                s.V["clue"] = lv == 1 ? "车平中路，逼将抬头" : lv == 2 ? "马跳卧槽，别住象眼" : "兵进九宫，车照将面";
            }
            else if (this._id == "junqi4")
            {

                this.SetGrid(s, 4, 3);
                let rank = [ "9", "8", "7", "6", "5", "4" ];
                for (let seat = 0; seat < 4; seat++)
                {
                    s.Hands[seat] = [];
                    for (let i = 0; i < 6; i++)
                        s.Hands[seat].Add((variant == "四国翻棋" ? "" : "?") + this.SideChar(seat) + rank[i]);
                }
                s.V["field"] = -1;
                s.PhaseName = "四国暗棋 · 轮流出子";
            }
        }

        BuildTable(s, variant, seats)
        {
            let decks = (this._id == "gouji" || this._id == "shuangkou" || this._id == "baohuang") ? 2 : 1;
            decks = this.O("decks", decks);
            if (this._id == "blackjack" && variant == "双副") decks = 2;
            let deck = Cards.Deck(decks, this._id != "blackjack" && this._id != "showhand");
            this.Shuffle(s, deck);
            for (let i = 0; i < seats; i++) s.Hands[i] = [];
            let per = this._id == "showhand" ? 5 : this._id == "blackjack" ? 2 : 0;
            if (per > 0)
            {
                for (let k = 0; k < per; k++)
                    for (let i = 0; i < seats; i++)
                        if (deck.length > 0) { s.Hands[i].Add(deck[0]); deck.RemoveAt(0); }
            }
            else
            {
                let j = 0;
                while (deck.length > 0) { s.Hands[j % seats].Add(deck[0]); deck.RemoveAt(0); j++; }
            }
            for (let i = 0; i < seats; i++) Cards.SortHand(s.Hands[i]);
            s.V["rest"] = deck.ToArray();
            s.V["last"] = CS.newArr(0, "");
            s.V["lastBy"] = -1;
            s.V["passes"] = 0;
            s.V["target"] = this._id == "blackjack" ? 21 : 0;
            s.V["bust"] = CS.newArr(seats, false);
            s.V["stood"] = CS.newArr(seats, false);
            s.V["dealer"] = 0;
            if (this._id == "chudadi")
            {
                s.V["tally"] = CS.newArr(seats, 0);
                s.V["round"] = 1;
                s.V["_played"] = CS.newArr(seats, false);
                s.V["leadPass"] = 0;
                let first = 0;
                for (let i = 0; i < seats; i++) if (s.Hands[i].Contains("D3")) { first = i; break; }
                s.Turn = first;
                if (variant == "墨榜")
                {
                    s.V["tallyNote"] = "剩牌记分 · 累计越 " + this.OptI(s, "scoreCap", 100) + " 判负 · 余者按积分列次";
                    s.PhaseName = "第 1 盘 · 剩牌记分";
                }
                else if (variant == "闲式") s.PhaseName = "闲式 · 随时可过手";
            }
            if (this._id == "shuangkou" && variant == "百搭")
                s.V["wild"] = Cards.RANKS[this.NextRng(s, Cards.RANKS.length)];
            s.PhaseName = this._id == "blackjack" ? "要牌 / 停牌，别爆 21" :
                this._id == "showhand" ? "五品令 · 比牌摊牌" : "轮流出牌，先出完者胜";
            if (this._id == "showhand" || this._id == "blackjack") s.V["showdown"] = false;
        }

        static WORDS = [
            "油纸伞", "旧钟", "棋盘", "茶盏", "门槛", "风筝", "砚台", "石桥", "灯笼", "竹帘", "折扇", "雨靴" ];
        static SOUPS = [
            "一个男人走进酒吧，要了一杯水，酒吧老板突然拿出一条蛇，男人道谢后告辞了。为什么？",
            "海龟汤：死者身边只有一堆锯末和一个空盒子，他笑着死去。发生了什么？",
            "女子每天买两份报纸，却从没读过。为什么？" ];
        static SOUP_ANS = [ "他在打嗝，蛇吓了一跳就好了", "他是马戏团锯箱子的人，笑着被锯成了两半，盒子空了", "报纸送给楼下看不见的邻居" ];
        static SOUP_YES = [
            [ "蛇", "嗝", "水", "吓", "惊" ],
            [ "锯", "盒子", "马戏", "空", "笑" ],
            [ "报纸", "邻居", "盲", "看不见", "送" ] ];
        static SOUP_NO = [
            [ "毒", "杀", "钱", "枪", "仇" ],
            [ "毒", "枪", "病", "自杀", "钱" ],
            [ "自己看", "收藏", "卖", "识字", "工作" ] ];
        static SOUP_TAG = [ "清汤", "重口", "清汤" ];

        BuildParty(s, variant, seats)
        {
            s.V["stage"] = 0;
            s.V["votes"] = CS.newArr(seats, 0);
            s.V["_voted"] = CS.newArr(seats, false);
            s.V["voted"] = 0;
            s.V["strokes"] = CS.newArr(0, "");
            s.V["publicText"] = CS.newArr(0, "");
            this.SetGrid(s, 0, 0);
            if (this._id == "liarsdice")
            {
                s.V["dice"] = CS.newArr(seats * 5, 0);
                for (let i = 0; i < seats * 5; i++) s.V["dice"] = this.FillDice(s, s.V["dice"]);
                s.V["call"] = "0,0";
                s.V["callBy"] = -1;
                s.PhaseName = "摇盅 · 轮流叫点或开盅";
                s.V["hint"] = "叫「N 个 X 点」，怀疑上家就点开盅";
            }
            else if (this._id == "avalon")
            {

                let bad = Math.max(1, seats / 3);
                let role = CS.newArr(seats, 0);
                for (let i = 0; i < bad; i++) role[i] = 1;
                for (let i = 0; i < seats - 1; i++) { let j = i + 1 + this.NextRng(s, seats - i - 1); let t = role[i]; role[i] = role[j]; role[j] = t; }
                s.V["_roles"] = role;
                s.V["leader"] = 0;
                s.V["team"] = CS.newArr(0, 0);
                let nMission = this.OptI(s, "missionRounds", variant == "快节奏" ? 2 : 3);
                s.V["missions"] = CS.newArr(nMission, 0);
                s.V["needWin"] = nMission;
                s.V["rejectLimit"] = Math.max(2, this.OptI(s, "missionRounds", variant == "快节奏" ? 3 : 5));
                s.V["round"] = 1;
                s.V["rejects"] = 0;
                s.PhaseName = "第 1 轮 · 队长组队";
            }
            else if (this._id == "turtlesoup")
            {
                let pool = [];
                for (let i = 0; i < ExtraGame.SOUPS.length; i++)
                    if (variant != "重口" || ExtraGame.SOUP_TAG[i] == "重口") pool.Add(i);
                let k = pool[this.NextRng(s, pool.length)];
                s.V["_soupIdx"] = k;
                s.V["_answer"] = ExtraGame.SOUP_ANS[k];
                s.V["soup"] = ExtraGame.SOUPS[k];
                s.V["host"] = 0;
                s.V["asked"] = 0;
                s.V["maxQuestions"] = this.OptI(s, "rounds", variant == "重口" ? 12 : 18);
                s.PhaseName = "海龟汤 · 只能问是非题（" + (variant == "重口" ? "重口 12 问" : "清汤 18 问") + "）";
            }
            else if (this._id == "mastermind")
            {
                let len = variant == "5位" ? 5 : 4;
                let secret = "";
                for (let i = 0; i < len; i++) secret += this.NextRng(s, 10).ToString();
                s.V["_secret"] = secret;
                s.V["tries"] = CS.newArr(seats, 0);
                s.V["maxTries"] = this.OptI(s, "rounds", 10);
                s.V["len"] = len;
                s.V["history"] = CS.newArr(0, "");
                s.PhaseName = "猜 " + len + " 位数字 · 回你几A几B";
            }
            else if (this._id == "drawguess")
            {
                let w = this.NextRng(s, ExtraGame.WORDS.length);
                s.V["_word"] = ExtraGame.WORDS[w];
                s.V["painter"] = 0;
                s.V["round"] = 1;
                s.V["rounds"] = variant == "5轮" ? 5 : 3;
                s.V["score"] = CS.newArr(seats, 0);
                s.V["strokes"] = CS.newArr(0, "");
                s.V["guessed"] = false;
                s.PhaseName = "第 1 轮 · 看图画，打字猜词";
            }
        }
        FillDice(s, a)
        {

            for (let i = 0; i < a.length; i++)
                if (a[i] == 0) { a[i] = 1 + this.NextRng(s, 6); break; }
            return a;
        }

        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Phase != "playing") return r;
            if (ExtraGame.In(ExtraGame.GRID, this._id)) return this.LegalGrid(s, seat, r);
            if (ExtraGame.In(ExtraGame.TABLE, this._id)) return this.LegalTable(s, seat, r);
            return this.LegalParty(s, seat, r);
        }

        LegalGrid(s, seat, r)
        {
            if (seat != s.Turn && this._id != "endgame" && this._id != "mastermind") return r;
            if (this._id == "dots")
            {
                for (let i = 0; i < s.Cells.length; i++)
                    if (s.Cells[i] == "") r.Add("c:" + i);
                return r;
            }
            if (this._id == "hex")
            {
                for (let i = 0; i < s.Cells.length; i++)
                    if (s.Cells[i] == "") r.Add("c:" + i);
                return r;
            }
            if (this._id == "nim")
            {
                for (let h = 0; h < s.Cells.length; h++)
                {
                    let n; if (!CS.tp(s.Cells[h], _v => n = _v) || n <= 0) continue;
                    for (let k = 1; k <= n; k++) r.Add("c:" + h + "," + k);
                }
                return r;
            }
            if (this._id == "endgame")
            {
                r.Add("c:0"); r.Add("c:1"); r.Add("c:2");
                return r;
            }
            if (this._id == "junqi4")
            {
                let h = s.Hands.ContainsKey(seat) ? s.Hands[seat] : [];
                for (let i = 0; i < h.length; i++) r.Add("c:" + i);
                return r;
            }
            return r;
        }

        LegalTable(s, seat, r)
        {
            if (seat != s.Turn) return r;
            let h = s.Hands.ContainsKey(seat) ? s.Hands[seat] : [];
            if (this._id == "blackjack")
            {
                let stood = s.V["stood"];
                if (stood != null && seat < stood.length && stood[seat]) return r;
                let dealer = this.OptI(s, "dealer", this.IntV(s, "dealer", 0));
                if (seat == dealer) { r.Add(ExtraGame.DealerHit(s, h) ? "d" : "p"); return r; }
                r.Add("d"); r.Add("p"); r.Add("q");
                return r;
            }
            if (this._id == "showhand")
            {
                r.Add("p");
                return r;
            }
            let lead = !(s.V["lastBy"] != null && CS.int(s.V["lastBy"]) >= 0 &&
                          CS.int(s.V["lastBy"]) != seat && (s.V["last"]).length > 0);
            if (this._id == "chudadi" && lead)
            {
                if (this.Relaxed(s) && this.IntV(s, "leadPass", 0) < s.Seats) r.Add("p");
                if (this.Relaxed(s))
                {
                    for (let i = 0; i < h.length; i++) r.Add("c:" + i);
                    if (h.length >= 2) r.Add("c:0,1");
                    return r;
                }
                let d3 = h.IndexOf("D3");
                if (d3 >= 0) r.Add("c:" + d3);
                if (h.length >= 2) r.Add("c:" + (d3 >= 0 ? d3 : 0) + "," + (d3 >= 0 && d3 != 0 ? 0 : 1));
                return r;
            }
            for (let i = 0; i < h.length; i++) r.Add("c:" + i);
            if (h.length >= 2) r.Add("c:" + 0 + "," + 1);
            if (!lead) r.Add("p");
            return r;
        }

        LegalParty(s, seat, r)
        {
            let stage = this.IntV(s, "stage", 0);
            if (this._id == "liarsdice")
            {
                if (seat != s.Turn) return r;
                let call = this.StrV(s, "call", "0,0");
                let c = call.Split(',');
                let cn = c.length > 0 ? ExtraGame.Safe(c[0]) : 0;
                let cv = c.length > 1 ? ExtraGame.Safe(c[1]) : 0;

                for (let num = Math.max(1, cn); num <= Math.min(cn + 3, s.Seats * 5); num++)
                    for (let v = 1; v <= 6; v++)
                        if (num > cn || v > cv)
                        {
                            r.Add("b:" + num + "," + v);
                            if (r.length >= 30) break;
                        }
                if (CS.int(s.V["callBy"]) >= 0) r.Add("k");
                return r.length > 0 ? r : [ "k" ];
            }
            if (this._id == "avalon")
            {
                let leader = this.IntV(s, "leader", 0);
                if (stage == 0 && seat == leader)
                {
                    let team0 = s.V["team"];
                    for (let i = 0; i < s.Seats; i++)
                        if (team0 == null || !team0.Contains(i)) r.Add("c:" + i);
                    return r;
                }
                if (stage == 1)
                {
                    let vd = s.V["_voted"];
                    if (vd == null || seat >= vd.length || !vd[seat]) { r.Add("v:1"); r.Add("v:0"); }
                    return r;
                }
                if (stage == 2)
                {
                    let team = s.V["team"];
                    if (team != null && team.Contains(seat)) { r.Add("v:1"); r.Add("v:0"); }
                    return r;
                }
                return r;
            }
            if (this._id == "turtlesoup")
            {
                if (seat == this.IntV(s, "host", 0)) return r;
                r.Add("say:*"); r.Add("solve:*");
                r.Add("say:是不是和动物有关");
                return r;
            }
            if (this._id == "mastermind")
            {
                r.Add("solve:*"); r.Add("n");
                return r;
            }
            if (this._id == "drawguess")
            {
                let painter = this.IntV(s, "painter", 0);
                if (seat == painter)
                {
                    r.Add("draw:*"); r.Add("n");
                }
                else { r.Add("say:*"); r.Add("say:圆圆的"); }
                return r;
            }
            return r;
        }
        static SafePublic(x) { return ExtraGame.Safe(x); }
        static Safe(x) { let n; return CS.tp(x, _v => n = _v) ? n : 0; }

        Act(s, seat, action, d)
        {
            let code = d != null && d.ContainsKey("code") ? CS.str(d["code"]) : action;
            if (s.Ended) return MoveResult.Fail("本局已结束");
            if (ExtraGame.In(ExtraGame.GRID, this._id)) return this.ActGrid(s, seat, code);
            if (ExtraGame.In(ExtraGame.TABLE, this._id)) return this.ActTable(s, seat, code);
            return this.ActParty(s, seat, code);
        }

        ActGrid(s, seat, code)
        {
            if (this._id == "endgame")
            {
                let pick = ExtraGame.Safe(CS.substr(code, code.IndexOf(':') + 1));
                let level = this.IntV(s, "level", 1);
                let right = (level * 7 + s.Seats) % 3;
                if (pick == right)
                {
                    s.V["solved"] = true; s.Last = "c:" + pick;
                    this.Finish(s, seat, "残局破解 · 第 " + level + " 关过关");
                    return MoveResult.Good("破解成功");
                }
                this.Say(s, "这手还差一点，再想想");
                return MoveResult.Fail("还差一点 · " + this.StrV(s, "clue", ""));
            }
            if (seat != s.Turn) return MoveResult.Fail("还没轮到你");
            if (this._id == "dots")
            {
                let i; if (!code.StartsWith("c:") || !CS.tp(CS.substr(code, 2), _v => i = _v) || i < 0 || i >= s.Cells.length || s.Cells[i] != "")
                    return MoveResult.Fail("这里不能画");
                s.Cells[i] = this.SideChar(seat);
                s.Last = code;
                let made = 0;

                for (let dy = -1; dy <= 1; dy += 2)
                    for (let dx = -1; dx <= 1; dx += 2)
                    {
                        let cx = this.X(s, i) + dx, cy = this.Y(s, i) + dy;
                        if (cx < 1 || cy < 1 || cx >= s.Width - 1 || cy >= s.Height - 1) continue;
                        if (cx % 2 != 1 || cy % 2 != 1) continue;
                        if (s.Cells[this.At(s, cx, cy)] != ".") continue;
                        if (s.Cells[this.At(s, cx - 1, cy)] != "" && s.Cells[this.At(s, cx + 1, cy)] != "" &&
                            s.Cells[this.At(s, cx, cy - 1)] != "" && s.Cells[this.At(s, cx, cy + 1)] != "")
                        {
                            s.Cells[this.At(s, cx, cy)] = this.SideChar(seat) + "*";
                            let sc = s.V["score"];
                            if (sc != null && seat < sc.length) sc[seat]++;
                            made++;
                        }
                    }
                let empty = 0;
                for (let k = 0; k < s.Cells.length; k++) { if (s.Cells[k] == "") empty++; }
                if (empty == 0)
                {
                    let sc = s.V["score"];
                    let best = 0; for (let k = 1; k < sc.length; k++) if (sc[k] > sc[best]) best = k;
                    this.Finish(s, best, "点格棋终局 · 占格 " + CS.join(":", sc.Select(x => CS.str(x)).ToArray()));
                }
                else if (made == 0) this.Next(s, -1);
                else this.Say(s, "围成一格，再走一手");
                return MoveResult.Good(made > 0 ? "占了一格" : "");
            }
            if (this._id == "hex")
            {
                let i; if (!code.StartsWith("c:") || !CS.tp(CS.substr(code, 2), _v => i = _v) || i < 0 || i >= s.Cells.length || s.Cells[i] != "")
                    return MoveResult.Fail("这里已有子");
                s.Cells[i] = this.SideChar(seat);
                s.Last = code;
                if (this.HexWin(s, seat)) { this.Finish(s, seat, (seat == 0 ? "红" : "蓝") + "方贯通两边"); return MoveResult.Good(); }
                let full = true; for (let k = 0; k < s.Cells.length; k++) if (s.Cells[k] == "") { full = false; break; }
                if (full)
            {

                let w = this.HexWin(s, 0) ? 0 : this.HexWin(s, 1) ? 1 : 1;
                this.Finish(s, w, "落满全盘 · " + (w == 0 ? "红" : "蓝") + "方贯通");
                return MoveResult.Good();
            }
                this.Next(s, -1);
                return MoveResult.Good();
            }
            if (this._id == "nim")
            {
                let p = CS.substr(code, 2).Split(',');
                if (p.length < 2) return MoveResult.Fail("选一堆和数量");
                let h = ExtraGame.Safe(p[0]), k = ExtraGame.Safe(p[1]);
                let cur; if (h < 0 || h >= s.Cells.length || !CS.tp(s.Cells[h], _v => cur = _v) || k <= 0 || k > cur)
                    return MoveResult.Fail("这一堆不能这么取");
                s.Cells[h] = (cur - k).ToString();
                s.Last = code;
                let left = 0; for (let j = 0; j < s.Cells.length; j++) left += ExtraGame.Safe(s.Cells[j]);
                if (left == 0)
                {
                    let misere = this.OptS(s, "mode", "classic") == "misere";
                    this.Finish(s, misere ? 1 - seat : seat,
                        misere ? "Nim 反常局 · 取到最后一枚者负" : "Nim 正常局 · 取到最后一枚者胜");
                    return MoveResult.Good();
                }
                this.Next(s, -1);
                return MoveResult.Good();
            }
            if (this._id == "junqi4")
            {
                let idx; if (!code.StartsWith("c:") || !CS.tp(CS.substr(code, 2), _v => idx = _v)) return MoveResult.Fail("选一枚暗子");
                let h = s.Hands[seat];
                if (idx < 0 || idx >= h.length) return MoveResult.Fail("没有这枚子");
                let card = h[idx]; h.RemoveAt(idx);
                let val = ExtraGame.Safe(CS.substr(card, card.length - 1));
                s.V["field"] = seat; s.V["fieldVal"] = val;
                s.V["fieldCard"] = card;
                this.Say(s, "座位 " + seat + " 出了一枚暗子");
                if (h.length == 0)
                {

                    let t = this.TeamOf(seat, s.Seats);
                    let win = [];
                    for (let i = 0; i < s.Seats; i++) if (this.TeamOf(i, s.Seats) == t) win.Add(i);
                    this.FinishTeam(s, win, "队伍 " + t + " 先出完暗子");
                }
                else this.Next(s, -1);
                return MoveResult.Good();
            }
            return MoveResult.Fail("未知动作");
        }

        HexWin(s, seat)
        {
            let n = s.Width; let p = this.SideChar(seat);
            let seen = CS.newArr(n * n, false);
            let q = new CS.Queue();
            for (let i = 0; i < n; i++)
            {
                let start = seat == 0 ? i : i * n;
                let idx = seat == 0 ? start : start;
                if (this.Cell(s, idx) == p) { seen[idx] = true; q.Enqueue(idx); }
            }
            let dirs = [ [1,0], [-1,0], [0,1], [0,-1], [1,-1], [-1,1] ];
            while (q.length > 0)
            {
                let cur = q.Dequeue(); let x = this.X(s, cur), y = this.Y(s, cur);
                if (seat == 0 ? y == n - 1 : x == n - 1) return true;
                for (let k = 0; k < dirs.length; k++)
                {
                    let nx = x + dirs[k][0], ny = y + dirs[k][1];
                    if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
                    let ni = this.At(s, nx, ny);
                    if (!seen[ni] && this.Cell(s, ni) == p) { seen[ni] = true; q.Enqueue(ni); }
                }
            }
            return false;
        }

        ActTable(s, seat, code)
        {
            if (seat != s.Turn) return MoveResult.Fail("还没轮到你");
            let h = s.Hands[seat];
            if (this._id == "blackjack")
            {
                let stood = s.V["stood"];
                let bust = s.V["bust"];
                if (code == "d")
                {
                    let rest = s.V["rest"];
                    let deck = rest == null ? [] : (rest).slice();
                    if (deck.length > 0) { h.Add(deck[0]); deck.RemoveAt(0); s.V["rest"] = deck.ToArray(); }
                    if (ExtraGame.Bj(s, h) > 21) { bust[seat] = true; stood[seat] = true; this.Say(s, "座位 " + seat + " 爆了"); }
                }
                else if (code == "p") stood[seat] = true;
                else if (code == "q")
                {
                    let qr = s.V["rest"];
                    let qd = qr == null ? [] : (qr).slice();
                    if (qd.length > 0) { h.Add(qd[0]); qd.RemoveAt(0); s.V["rest"] = qd.ToArray(); }
                    if (ExtraGame.Bj(s, h) > 21) { bust[seat] = true; this.Say(s, "座位 " + seat + " 双倍后爆了"); }
                    stood[seat] = true; s.V["double" + seat] = true;
                }
                else return MoveResult.Fail("只能要牌 / 停牌 / 双倍");
                s.Last = code;
                this.Next(s, -1);
                let all = true; for (let i = 0; i < stood.length; i++) if (!stood[i]) { all = false; break; }
                if (all) ExtraGame.FinishBj(s);
                return MoveResult.Good();
            }
            if (this._id == "showhand")
            {
                s.V["showdown"] = true;
                let best = 0; let bv = null;
                let tie = [];
                let names = [ "高牌", "一对", "两对", "三条", "顺子", "同花", "葫芦", "四条", "同花顺" ];
                for (let i = 0; i < s.Seats; i++)
                {
                    let hh = s.Hands.ContainsKey(i) ? s.Hands[i] : [];
                    let v = ExtraGame.PokerRank(hh);
                    if (bv == null || ExtraGame.CmpRank(v, bv) > 0) { bv = v; best = i; tie.Clear(); tie.Add(i); }
                    else if (ExtraGame.CmpRank(v, bv) == 0) tie.Add(i);
                }
                let typeName = bv != null ? names[Math.max(0, Math.min(names.length - 1, bv[0]))] : "";
                if (tie.length > 1) this.FinishTeam(s, tie, "摊牌 · " + typeName + " 平分共分");
                else this.Finish(s, best, "摊牌 · 座位 " + best + " " + typeName + " 最大");
                return MoveResult.Good();
            }

            if (code == "p")
            {
                let lp = s.V["last"];
                let lby = CS.int(s.V["lastBy"]);
                let isLead = !(lp != null && lp.length > 0 && lby >= 0 && lby != seat);
                if (isLead && this.Relaxed(s))
                {
                    s.V["leadPass"] = this.IntV(s, "leadPass", 0) + 1;
                    this.Next(s, -1); return MoveResult.Good("过");
                }
                let passes = this.IntV(s, "passes", 0) + 1; s.V["passes"] = passes;
                if (passes >= s.Seats - 1) { s.V["last"] = CS.newArr(0, ""); s.V["lastBy"] = -1; s.V["passes"] = 0; }
                this.Next(s, -1); return MoveResult.Good("过");
            }
            let idx = [];
            let body = code.StartsWith("c:") ? CS.substr(code, 2) : "";
            for (let x of body.Split(',')) if (x.trim().length > 0) idx.Add(ExtraGame.Safe(x.trim()));
            let play = Cards.Take(s, s.Hands, seat, idx);
            if (play == null || play.length == 0) return MoveResult.Fail("选牌无效");
            let last = s.V["last"];
            let lastBy = CS.int(s.V["lastBy"]);
            let wasLead = !(last != null && last.length > 0 && lastBy >= 0 && lastBy != seat);
            if (last != null && last.length > 0 && lastBy >= 0 && lastBy != seat)
            {
                if (play.length != last.length || ExtraGame.PlayVal(s, play[play.length - 1]) <= ExtraGame.PlayVal(s, last[last.length - 1]))
                    return MoveResult.Fail("压不过上一手");
            }
            if (this._id == "chudadi" && wasLead && !this.Relaxed(s))
            {
                let hasD3 = false; for (let i = 0; i < play.length; i++) if (play[i] == "D3") hasD3 = true;
                if (s.Variant == "常式" && !hasD3) return MoveResult.Fail("常式首出须带杏三");
            }
            Cards.SortHand(play);
            s.V["last"] = play.ToArray(); s.V["lastBy"] = seat; s.V["passes"] = 0;
            s.V["leadPass"] = 0;
            let po; let pl = CS.tg(s.V, "_played", _v => po = _v).ok ? po : null;
            if (pl != null && seat < pl.length) pl[seat] = true;
            s.Last = code;
            if (h.length == 0)
            {
                if (this._id == "chudadi" && s.Variant == "墨榜") return this.ScoreAndContinue(s, seat);
                if (this.TeamMode())
                {
                    let t = this.TeamOf(seat, s.Seats);
                    let win = [];
                    for (let i = 0; i < s.Seats; i++) if (this.TeamOf(i, s.Seats) == t) win.Add(i);
                    this.FinishTeam(s, win, "队伍 " + t + " 先出完");
                }
                else this.Finish(s, seat, "座位 " + seat + " 先出完");
                return MoveResult.Good();
            }
            this.Next(s, -1);
            return MoveResult.Good();
        }
        Relaxed(s)
        {
            return this._id == "chudadi" && (s.Variant == "闲式" || this.OptB(s, "freePass", false));
        }
        static CardPts(c)
        {
            if (c == "J1" || c == "J2") return 15;
            let r = Cards.Rank(c);
            if (r == "A") return 11;
            if (r == "2") return 12;
            if (r == "K" || r == "Q" || r == "J" || r == "10") return 10;
            let v; return CS.tp(r, _v => v = _v) ? v : 1;
        }
        RestScore(s, seat, mode, hold2, unplayed, played)
        {
            let h = s.Hands.ContainsKey(seat) ? s.Hands[seat] : [];
            let n = h.length, pts;
            if (mode == "flat") pts = n;
            else if (mode == "point") { pts = 0; for (let k = 0; k < n; k++) pts += ExtraGame.CardPts(h[k]); }
            else pts = n < 8 ? n : n < 10 ? n * 2 : n < 13 ? n * 3 : n * 4;
            if (hold2 && n >= 8)
            {
                for (let k = 0; k < n; k++) if (Cards.Rank(h[k]) == "2") { pts *= 2; break; }
            }
            if (unplayed && played != null && seat < played.length && !played[seat]) pts *= 2;
            return pts;
        }
        ScoreAndContinue(s, winnerSeat)
        {
            let cap = Math.max(20, this.OptI(s, "scoreCap", 100));
            let mode = this.OptS(s, "scoreMode", "ladder");
            let hold2 = this.OptB(s, "holdTwoDouble", false);
            let unplayed = this.OptB(s, "unplayedDouble", false);
            let po, to;
            let played = CS.tg(s.V, "_played", _v => po = _v).ok ? po : null;
            let tally = CS.tg(s.V, "tally", _v => to = _v).ok ? to : null;
            if (tally == null || tally.length != s.Seats) { tally = CS.newArr(s.Seats, 0); s.V["tally"] = tally; }
            let round = this.IntV(s, "round", 1);
            let parts = [];
            for (let i = 0; i < s.Seats; i++)
            {
                let pts = this.RestScore(s, i, mode, hold2, unplayed, played);
                tally[i] += pts;
                parts.Add("第 " + i + " 席 +" + pts);
            }
            Say(s, "第 " + round + " 盘 · " + CS.join(" / ", parts.ToArray()) +
                " · 累计 " + CS.join("/", tally.Select(x => CS.str(x)).ToArray()));
            let over = false; let hi = 0, lo = 0;
            for (let i = 0; i < s.Seats; i++)
            {
                if (tally[i] >= cap) over = true;
                if (tally[i] > tally[hi]) hi = i;
                if (tally[i] < tally[lo]) lo = i;
            }
            let order = [];
            for (let i = 0; i < s.Seats; i++) order.Add(i);
            order.Sort((a, b) => tally[a].CompareTo(tally[b]));
            let rank = [];
            for (let k = 0; k < order.length; k++)
                rank.Add("第 " + order[k] + " 席 " + tally[order[k]] + " 分");
            let line = CS.join(" < ", rank.ToArray());
            if (over)
            {
                let best = [];
                for (let i = 0; i < s.Seats; i++) if (tally[i] == tally[lo]) best.Add(i);
                let res = "第 " + round + " 盘 · 第 " + hi + " 席越 " + cap + " 分判负 · " + line + " · 分最少者胜";
                if (best.length > 1) this.FinishTeam(s, best, res); else this.Finish(s, lo, res);
                this.Say(s, res);
                return MoveResult.Good(res);
            }
            let next = round + 1;
            s.V["round"] = next;
            this.Redeal(s);
            s.PhaseName = "第 " + next + " 盘 · 越 " + cap + " 分者判负";
            s.V["tallyNote"] = "第 " + next + " 盘 · 剩牌记分 · 累计越 " + cap + " 判负 · 余者按积分列次";
            return MoveResult.Good("第 " + next + " 盘");
        }
        Redeal(s)
        {
            let decks = Math.max(1, this.OptI(s, "decks", 1));
            let deck = Cards.Deck(decks, true);
            this.Shuffle(s, deck);
            for (let i = 0; i < s.Seats; i++) s.Hands[i] = [];
            let j = 0;
            while (deck.length > 0) { s.Hands[j % s.Seats].Add(deck[0]); deck.RemoveAt(0); j++; }
            for (let i = 0; i < s.Seats; i++) Cards.SortHand(s.Hands[i]);
            s.V["rest"] = deck.ToArray();
            s.V["last"] = CS.newArr(0, "");
            s.V["lastBy"] = -1;
            s.V["passes"] = 0;
            s.V["leadPass"] = 0;
            s.V["_played"] = CS.newArr(s.Seats, false);
            s.Last = "";
            let first = 0;
            for (let i = 0; i < s.Seats; i++) if (s.Hands[i].Contains("D3")) { first = i; break; }
            s.Turn = first;
        }

        static PlayVal(s, c)
        {
            let w = this.StrV(s, "wild", "");
            return w.length > 0 && Cards.Rank(c) == w ? 20 : Cards.Val(c);
        }
        static Bj(s, h)
        {
            let t = 0, aces = 0;
            for (let i = 0; i < h.length; i++)
            {
                let r = Cards.Rank(h[i]);
                let v = r == "A" ? 11 : (r == "J" || r == "Q" || r == "K" || r == "10") ? 10 : ExtraGame.Safe(r);
                if (r == "A") aces++;
                t += v;
            }
            while (t > 21 && aces > 0) { t -= 10; aces--; }
            return t;
        }
        static IsSoft(s, h, total)
        {
            if (total != 17) return false;
            for (let i = 0; i < h.length; i++) if (Cards.Rank(h[i]) == "A") return true;
            return false;
        }
        static DealerHit(s, h)
        {
            let v = ExtraGame.Bj(s, h);
            if (v < 17) return true;
            if (v == 17 && ExtraGame.IsSoft(s, h, v) && this.OptS(s, "dealer17", "S17") == "H17") return true;
            return false;
        }
        static FinishBj(s)
        {
            let bust = s.V["bust"];
            let dealer = this.OptI(s, "dealer", this.IntV(s, "dealer", 0));
            let win = []; let score = CS.newArr(s.Seats, 0);
            let payout = this.OptS(s, "payout", "3:2");
            let dv = bust != null && dealer < bust.length && bust[dealer] ? -1 : ExtraGame.Bj(s, s.Hands[dealer]);
            let parts = [];
            for (let i = 0; i < s.Seats; i++)
            {
                if (i == dealer) continue;
                let h = s.Hands.ContainsKey(i) ? s.Hands[i] : [];
                let pv = bust != null && i < bust.length && bust[i] ? -1 : ExtraGame.Bj(s, h);
                let natural = h.length == 2 && pv == 21;
                let doubled = s.V.ContainsKey("double" + i) && CS.bool(s.V["double" + i]);
                let stake = doubled ? 2 : 1, gain = 0; let tag;
                if (pv < 0) { gain = -stake; tag = "爆牌"; }
                else if (dv < 0) { gain = stake; win.Add(i); tag = "主家爆牌"; }
                else if (pv > dv) { gain = natural ? (payout == "6:5" ? stake * 6 / 5 : stake * 3 / 2) : stake; win.Add(i); tag = natural ? "Blackjack" : "点数胜"; }
                else if (pv == dv) { gain = 0; tag = "Push"; }
                else { gain = -stake; tag = "点数负"; }
                score[i] = gain;
                parts.Add("座位" + i + " " + pv + " " + tag + (gain > 0 ? " +" + gain : gain < 0 ? " " + gain : ""));
            }
            s.V["_bjScore"] = score;
            let head = "主家 " + dealer + " 点数 " + (dv < 0 ? "爆牌" : CS.str(dv)) + " · " + this.OptS(s, "dealer17", "S17") + " · 记分比例 " + payout;
            let tail = CS.join(" / ", parts.ToArray());
            if (win.length > 0) this.FinishTeam(s, win, head + " · " + tail);
            else this.Finish(s, dealer, head + " · 主家通吃 · " + tail);
        }
        static PV(c)
        {
            let r = Cards.Rank(c);
            if (r == "A") return 14;
            if (r == "K") return 13;
            if (r == "Q") return 12;
            if (r == "J") return 11;
            let n; return CS.tp(r, _v => n = _v) ? n : (r == "2" ? 2 : 0);
        }
        static KeyOf(c, n)
        {
            let best = 0;
            for (let kv of CS.entries(c)) if (kv.Value == n && kv.Key > best) best = kv.Key;
            return best;
        }
        static PokerRank(h)
        {
            let v = h.Select(ExtraGame.PV).ToList(); v.Sort(); v.Reverse();
            let c = [];
            for (let i = 0; i < h.length; i++) { let x = ExtraGame.PV(h[i]); if (!c.ContainsKey(x)) c[x] = 0; c[x]++; }
            let flush = false;
            for (let su of Cards.SUITS) if (h.Count(x => Cards.Suit(x) == su) == 5) { flush = true; break; }
            let uq = c.Keys.OrderByDescending(x => x).ToList();
            if (uq.Contains(14)) uq.Add(1);
            uq = uq.Distinct().OrderByDescending(x => x).ToList();
            let sh = 0;
            for (let k = 0; k + 4 < uq.length; k++) if (uq[k] - uq[k + 4] == 4) { sh = uq[k]; break; }
            let g = c.Values.OrderByDescending(x => x).ToArray();
            let type = 0, tie = 0;
            if (sh > 0 && flush) { type = 8; tie = sh; }
            else if (g.length > 0 && g[0] == 4) { type = 7; tie = ExtraGame.KeyOf(c, 4); }
            else if (g.length > 1 && g[0] == 3 && g[1] >= 2) { type = 6; tie = ExtraGame.KeyOf(c, 3); }
            else if (flush) type = 5;
            else if (sh > 0) { type = 4; tie = sh; }
            else if (g.length > 0 && g[0] == 3) { type = 3; tie = ExtraGame.KeyOf(c, 3); }
            else if (g.length > 1 && g[0] == 2 && g[1] == 2) { type = 2; tie = Math.max(ExtraGame.KeyOf(c, 2), uq.length > 1 ? uq[1] : 0); }
            else if (g.length > 0 && g[0] == 2) { type = 1; tie = ExtraGame.KeyOf(c, 2); }
            let ret = [ type, tie ];
            for (let i = 0; i < v.length && ret.length < 7; i++) ret.Add(v[i]);
            while (ret.length < 7) ret.Add(0);
            return ret.ToArray();
        }
        static CmpRank(a, b)
        {
            let n = Math.max(a.length, b.length);
            for (let i = 0; i < n; i++) { let x = i < a.length ? a[i] : 0, y = i < b.length ? b[i] : 0; if (x != y) return CS.cmp(x, y); }
            return 0;
        }
        static HandVal(h)
        {
            let r = ExtraGame.PokerRank(h);
            return r[0] * 1000000 + r[1] * 10000 + r[2] * 100 + r[3];
        }

        ActParty(s, seat, code)
        {
            let stage = this.IntV(s, "stage", 0);
            if (this._id == "liarsdice")
            {
                if (seat != s.Turn) return MoveResult.Fail("还没轮到你");
                if (code == "k")
                {
                    let c = this.StrV(s, "call", "0,0").Split(',');
                    let num = c.length > 0 ? ExtraGame.Safe(c[0]) : 0, val = c.length > 1 ? ExtraGame.Safe(c[1]) : 0;
                    let dice = s.V["dice"];
                    let plusOne = s.Variant == "大话+1";
                    let real = 0;
                    for (let i = 0; i < dice.length; i++)
                        if (plusOne || val == 1) { if (dice[i] == val) real++; }
                        else if (dice[i] == val || dice[i] == 1) real++;
                    if (plusOne) real++;
                    let caller = CS.int(s.V["callBy"]);
                    let loser = real >= num ? seat : caller;
                    this.Say(s, "开盅：实际 " + real + " 个 " + val + " 点");
                    let sc = s.V["score"]; sc[loser]--;

                    let nd = CS.newArr(s.Seats * 5, 0);
                    for (let i = 0; i < nd.length; i++) nd[i] = 1 + this.NextRng(s, 6);
                    s.V["dice"] = nd; s.V["call"] = "0,0"; s.V["callBy"] = -1;
                    let round = this.IntV(s, "round", 1) + 1; s.V["round"] = round;
                if (round > this.OptI(s, "rounds", 5))
                    {
                        let best = 0; for (let i = 1; i < sc.length; i++) if (sc[i] > sc[best]) best = i;
                        this.Finish(s, best, "隐点令 5 轮终局");
                    }
                    else { s.Turn = loser; this.Say(s, "第 " + round + " 轮，由座位 " + loser + " 先叫"); }
                    return MoveResult.Good("开盅");
                }
                if (code.StartsWith("b:"))
                {
                    s.V["call"] = CS.substr(code, 2); s.V["callBy"] = seat;
                    this.Next(s, -1); return MoveResult.Good("叫 " + CS.substr(code, 2));
                }
                return MoveResult.Fail("叫点或开盅");
            }
            if (this._id == "avalon")
            {
                return this.ActAvalon(s, seat, code, stage);
            }
            if (this._id == "turtlesoup")
            {
                if (seat == this.IntV(s, "host", 0)) return MoveResult.Fail("主持人不用猜");
                s.V["asked"] = this.IntV(s, "asked", 0) + 1;
                let si = this.IntV(s, "_soupIdx", 0);
                si = Math.max(0, Math.min(ExtraGame.SOUP_ANS.length - 1, si));
                if (code.StartsWith("solve:"))
                {
                    let ans = CS.substr(code, 6);
                    let real = ExtraGame.SOUP_ANS[si];
                    let hits = 0;
                    for (let i = 0; i < ExtraGame.SOUP_YES[si].length; i++) if (ans.Contains(ExtraGame.SOUP_YES[si][i])) hits++;
                    if (ans.length > 0 && (real.Contains(ans) || ans.Contains(real) || hits >= 2))
                    { this.Finish(s, seat, "猜中汤底：" + real); return MoveResult.Good(); }
                    this.Say(s, "还不是汤底，接着问");
                    return MoveResult.Good();
                }
                let q = code.StartsWith("say:") ? CS.substr(code, 4) : "";
                let reply = "无关";
                if (q.length == 0) reply = "再问得具体些";
                else
                {
                    for (let i = 0; i < ExtraGame.SOUP_YES[si].length; i++) if (q.Contains(ExtraGame.SOUP_YES[si][i])) reply = "是";
                    for (let i = 0; i < ExtraGame.SOUP_NO[si].length; i++) if (q.Contains(ExtraGame.SOUP_NO[si][i])) reply = "否";
                }
                ExtraGame.AddPublic(s, "问：" + q + " → " + reply);
                let mx = this.IntV(s, "maxQuestions", 18);
                if (this.IntV(s, "asked", 0) >= mx)
                    this.Finish(s, -1, mx + " 问用尽 · 汤底：" + ExtraGame.SOUP_ANS[si]);
                return MoveResult.Good();
            }
            if (this._id == "mastermind")
            {
                let tr = s.V["tries"];
                if (tr == null || tr.length != s.Seats) { tr = CS.newArr(s.Seats, 0); s.V["tries"] = tr; }
                if (code == "n")
                {
                    tr[seat]++;
                    this.AddFeed(s, seat, "跳过一次"); ExtraGame.AddPublic(s, "座位 " + seat + " 跳过一次");
                    if (tr[seat] >= this.IntV(s, "maxTries", 10)) this.Finish(s, -1, "次数用尽 · 答案是 " + this.StrV(s, "_secret", ""));
                    return MoveResult.Good("跳过");
                }
                if (!code.StartsWith("solve:")) return MoveResult.Fail("直接写数字");
                let g = CS.substr(code, 6).trim();
                let sec = this.StrV(s, "_secret", "");
                if (g.length != sec.length || !g.All(CS.isDigit)) return MoveResult.Fail("要 " + sec.length + " 位数字");
                let a = 0, b = 0;
                let used = CS.newArr(sec.length, false);
                let guessed = CS.newArr(sec.length, false);
                for (let i = 0; i < sec.length; i++)
                    if (g[i] == sec[i]) { a++; used[i] = true; guessed[i] = true; }
                for (let i = 0; i < sec.length; i++)
                {
                    if (guessed[i]) continue;
                    for (let j = 0; j < sec.length; j++)
                        if (!used[j] && !guessed[j] && sec[j] == g[i]) { b++; used[j] = true; break; }
                }
                let tries = ++tr[seat];
                this.AddFeed(s, seat, g + " → " + a + "A" + b + "B");
                ExtraGame.AddPublic(s, "座位 " + seat + " 猜了一次");
                if (a == sec.length) { this.Finish(s, seat, "猜中！用了 " + tries + " 次"); return MoveResult.Good(); }
                if (tries >= this.IntV(s, "maxTries", 10))
                    this.Finish(s, -1, "10 次用尽 · 答案是 " + sec);
                return MoveResult.Good(a + "A" + b + "B");
            }
            if (this._id == "drawguess")
            {
                let painter = this.IntV(s, "painter", 0);
                let word = this.StrV(s, "_word", "");
                if (seat == painter)
                {
                    if (code.StartsWith("draw:"))
                    {
                        let st = s.V["strokes"];
                        let l = (st).slice();
                        l.Add(CS.substr(code, 5));
                        if (l.length > 120) l.RemoveAt(0);
                        s.V["strokes"] = l.ToArray();
                        return MoveResult.Good("笔迹已同步");
                    }
                    let rr = this.IntV(s, "round", 1) + 1;
                    s.V["round"] = rr;
                    if (rr > this.IntV(s, "rounds", 3))
                    {
                        let sc0 = s.V["score"];
                        let best0 = 0; for (let i = 1; i < sc0.length; i++) if (sc0[i] > sc0[best0]) best0 = i;
                        this.Finish(s, best0, "你画我猜终局 · 词是「" + word + "」");
                    }
                    else
                    {
                        let np = (painter + 1) % s.Seats;
                        s.V["painter"] = np;
                        s.V["_word"] = ExtraGame.WORDS[this.NextRng(s, ExtraGame.WORDS.length)];
                        s.V["strokes"] = CS.newArr(0, "");
                        s.PhaseName = "第 " + rr + " 轮 · 换座位 " + np + " 来画";
                        this.Say(s, "画手跳过，换人画");
                    }
                    return MoveResult.Good("跳过");
                }
                let g = code.StartsWith("say:") ? CS.substr(code, 4).trim() : "";
                ExtraGame.AddPublic(s, "座位 " + seat + "：" + g);
                if (g.length > 0 && (g.Contains(word) || word.Contains(g)))
                {
                    let sc = s.V["score"]; sc[seat] += 2; sc[painter] += 1;
                    s.V["guessed"] = true;
                    let round = this.IntV(s, "round", 1) + 1;
                    s.V["round"] = round;
                    if (round > this.IntV(s, "rounds", 3))
                    {
                        let best = 0; for (let i = 1; i < sc.length; i++) if (sc[i] > sc[best]) best = i;
                        this.Finish(s, best, "你画我猜终局 · 词是「" + word + "」");
                    }
                    else
                    {
                        let np = (painter + 1) % s.Seats;
                        s.V["painter"] = np;
                        s.V["_word"] = ExtraGame.WORDS[this.NextRng(s, ExtraGame.WORDS.length)];
                        s.V["strokes"] = CS.newArr(0, "");
                        s.V["guessed"] = false;
                        s.PhaseName = "第 " + round + " 轮 · 换座位 " + np + " 来画";
                        this.Say(s, "猜中了！换人画");
                    }
                    return MoveResult.Good("猜中");
                }
                return MoveResult.Good();
            }
            return MoveResult.Fail("未知动作");
        }

        ActAvalon(s, seat, code, stage)
        {
            let leader = this.IntV(s, "leader", 0);
            if (stage == 0)
            {
                if (seat != leader) return MoveResult.Fail("等队长组队");
                let pick; if (!code.StartsWith("c:") || !CS.tp(CS.substr(code, 2), _v => pick = _v)) return MoveResult.Fail("选队员");
                let team = s.V["team"];
                let t = (team).slice();
                if (!t.Contains(pick)) t.Add(pick);
                s.V["team"] = t.ToArray();
                s.V["_voted"] = CS.newArr(s.Seats, false); s.V["voted"] = 0;
                s.V["votes"] = CS.newArr(s.Seats, 0);
                if (t.length >= Math.max(2, s.Seats / 2))
                {
                    s.V["stage"] = 1; s.PhaseName = "第 " + this.IntV(s, "round", 1) + " 轮 · 全员投票是否放行队伍";
                    this.Say(s, "队伍成形，请投可否");
                }
                return MoveResult.Good("已选 " + t.length + " 人");
            }
            if (stage == 1 || stage == 2)
            {
                let vd = s.V["_voted"];
                if (vd[seat]) return MoveResult.Fail("已经投过");
                if (!code.StartsWith("v:")) return MoveResult.Fail("投 1 同意 / 0 反对");
                let votes = s.V["votes"];
                votes[seat] = ExtraGame.Safe(CS.substr(code, 2)); vd[seat] = true;
                let voted = this.IntV(s, "voted", 0) + 1; s.V["voted"] = voted;
                let pool = stage == 1 ? s.Seats : ((s.V["team"]) || CS.newArr(0, 0)).length;
                if (voted >= pool) this.ResolveAvalon(s, stage);
                return MoveResult.Good();
            }
            return MoveResult.Fail("阶段错误");
        }
        ResolveAvalon(s, stage)
        {
            let votes = s.V["votes"];
            let yes = 0; for (let i = 0; i < votes.length; i++) yes += votes[i];
            let round = this.IntV(s, "round", 1);
            if (stage == 1)
            {
                if (yes * 2 <= s.Seats)
                {
                    let rejects = this.IntV(s, "rejects", 0) + 1; s.V["rejects"] = rejects;
                    s.V["leader"] = (this.IntV(s, "leader", 0) + 1) % s.Seats;
                    s.V["team"] = CS.newArr(0, 0); s.V["stage"] = 0;
                    s.PhaseName = "第 " + round + " 轮 · 队伍被否，换队长";
                    this.Say(s, "投票没过，换队长组队");
                    if (rejects >= this.IntV(s, "rejectLimit", 5))
                    this.Finish(s, -1, "连续 " + this.IntV(s, "rejectLimit", 5) + " 次组队被否 · 坏人翻盘");
                }
                else { s.V["stage"] = 2; s.PhaseName = "第 " + round + " 轮 · 队员做任务"; this.Say(s, "队伍放行，执行任务"); }
                s.V["_voted"] = CS.newArr(s.Seats, false); s.V["voted"] = 0; s.V["votes"] = CS.newArr(s.Seats, 0);
            }
            else
            {
                let m = s.V["missions"];
                m[round - 1] = yes * 2 > ((s.V["team"]) || CS.newArr(0, 0)).length ? 1 : 0;
                s.V["missions"] = m;
                s.V["leader"] = (this.IntV(s, "leader", 0) + 1) % s.Seats;
                s.V["team"] = CS.newArr(0, 0); s.V["stage"] = 0;
                let good = 0, bad = 0; for (let i = 0; i < 3; i++) if (m[i] == 1) good++; else bad++;
                let need = this.IntV(s, "needWin", 3);
                if (good >= need) { this.FinishTeam(s, ExtraGame.GoodSeats(s), need + " 轮任务全成 · 好人方获胜"); return; }
                if (bad >= need) { this.FinishTeam(s, ExtraGame.BadSeats(s), need + " 轮任务全败 · 坏人方获胜"); return; }
                s.V["round"] = round + 1;
                s.PhaseName = "第 " + (round + 1) + " 轮 · 队长组队";
                s.V["_voted"] = CS.newArr(s.Seats, false); s.V["voted"] = 0; s.V["votes"] = CS.newArr(s.Seats, 0);
                this.Say(s, "任务 " + (m[round - 1] == 1 ? "成功" : "被破坏"));
            }
        }
        static *GoodSeats(s)
        {
            let roles = s.V["_roles"];
            let a = [];
            if (roles != null) for (let i = 0; i < roles.length; i++) if (roles[i] == 0) a.Add(i);
            return a;
        }
        static *BadSeats(s)
        {
            let roles = s.V["_roles"];
            let a = [];
            if (roles != null) for (let i = 0; i < roles.length; i++) if (roles[i] == 1) a.Add(i);
            return a;
        }
        AddFeed(s, seat, text)
        {
            let k = "_feed" + seat;
            let a = (s.V.ContainsKey(k) ? s.V[k] : CS.newArr(0, "")).slice();
            a.Add(text); if (a.length > 20) a.RemoveAt(0);
            s.V[k] = a.ToArray();
        }
        static AddPublic(s, text)
        {
            let a = s.V["publicText"];
            let l = (a).slice(); l.Add(text);
            if (l.length > 40) l.RemoveAt(0);
            s.V["publicText"] = l.ToArray();
            this.Say(s, text);
        }

        View(s, seat)
        {
            let v = super.View(s, seat);
            let info = v["info"];
            if (info == null) { info = []; v["info"] = info; }
            info["hint"] = s.PhaseName;
            if (s.V.ContainsKey("score")) info["score"] = s.V["score"];
            if (s.V.ContainsKey("publicText")) info["publicText"] = s.V["publicText"];
            if (s.V.ContainsKey("round")) info["round"] = s.V["round"];

            if (this._id == "liarsdice")
            {
                let dice = s.V["dice"];
                let mine = [];
                if (dice != null && seat >= 0)
                    for (let i = seat * 5; i < Math.min(seat * 5 + 5, dice.length); i++) mine.Add(dice[i]);
                info["myDice"] = mine.ToArray();
                info["call"] = this.StrV(s, "call", "0,0");
                info["callBy"] = s.V["callBy"];
            }
            if (this._id == "avalon")
            {
                let roles = s.V["_roles"];
                info["myRole"] = (roles != null && seat >= 0 && seat < roles.length && roles[seat] == 1) ? "坏人 · 破坏任务" : "好人 · 完成任务";
                info["leader"] = s.V["leader"];
                info["team"] = s.V["team"];
                info["missions"] = s.V["missions"];
                info["stage"] = s.V["stage"];
            }
            if (this._id == "turtlesoup")
            {
                info["soup"] = s.V["soup"]; info["host"] = s.V["host"]; info["asked"] = s.V["asked"];
                info["maxQuestions"] = this.IntV(s, "maxQuestions", 18);
                if (seat == this.IntV(s, "host", 0)) info["hostAnswer"] = this.StrV(s, "_answer", "");
            }
            if (this._id == "mastermind")
            {
                let tr = s.V["tries"];
                info["len"] = s.V["len"];
                info["tries"] = tr != null && seat >= 0 && seat < tr.length ? tr[seat] : 0;
                info["maxTries"] = s.V["maxTries"];
                info["myFeed"] = seat >= 0 && s.V.ContainsKey("_feed" + seat) ? s.V["_feed" + seat] : CS.newArr(0, "");
            }
            if (this._id == "drawguess")
            {
                info["painter"] = s.V["painter"];
                info["strokes"] = s.V["strokes"];
                info["isPainter"] = seat == this.IntV(s, "painter", 0);
                info["myWord"] = seat == this.IntV(s, "painter", 0) ? s.V["_word"] : "";
                info["rounds"] = s.V["rounds"];
            }
            if (this._id == "endgame") info["clue"] = s.V["clue"];
            if (this._id == "blackjack")
            {
                let pts = [];
                for (let i = 0; i < s.Seats; i++) pts.Add(ExtraGame.Bj(s, s.Hands.ContainsKey(i) ? s.Hands[i] : []));
                info["points"] = pts.ToArray();
                info["bust"] = s.V["bust"];
            }
            if (this._id == "dots" || this._id == "hex" || this._id == "junqi4") info["score"] = s.V["score"];
            v["info"] = info;
            return v;
        }
    }

    class DirectorGame extends RuleBase
    {
        get Id() { return "juben"; }
        get Renderer() { return "party"; }
        get MinSeats() { return 3; }
        get MaxSeats() { return 8; }
        get Variants() {
                let list = CS.ScriptGateway.List();
                if (list.length == 0) return [ "现场导入" ];
                let a = [];
                for (let i = 0; i < list.length; i++) a.Add(RJ.Str(list[i], "id", ""));
                a.Add("现场导入");
                return a.ToArray();
            }

        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Game = "juben"; s.Room = room; s.Seats = seats;
            let sc = CS.ScriptGateway.GetForRoom(room, variant) || CS.ScriptGateway.Get(variant);
            if (sc == null)
            {
                let list = CS.ScriptGateway.List();
                if (list.length > 0) sc = CS.ScriptGateway.Get(RJ.Str(list[0], "id", ""));
            }
            if (sc == null)
            {

                sc = DirectorGame.MinimalScript();
            }
            s.V["_script"] = sc;
            s.V["act"] = 0;
            s.V["line"] = 0;
            s.V["stage"] = "curtain";
            s.V["votes"] = CS.newArr(seats, 0);
            s.V["_voted"] = CS.newArr(seats, false);
            s.V["voted"] = 0;
            s.V["publicClues"] = CS.newArr(0, "");
            s.V["privateClues"] = CS.newArr(0, "");
            s.V["narration"] = CS.newArr(0, "");
            s.V["theme"] = RJ.Str(sc, "theme", "夜墨");
            s.V["cue"] = "curtain";
            s.V["discussLeft"] = 0;
            s.V["_said"] = CS.newArr(seats, false);
            s.V["said"] = 0;
            s.PhaseName = "第一幕 · 幕卡";
            this.Say(s, "剧本就位 · " + RJ.Str(sc, "name", "现场本"));
            return s;
        }
        static MinimalScript()
        {
            let sc = [];
            sc["id"] = "min"; sc["name"] = "现场小本"; sc["version"] = 1; sc["theme"] = "夜墨"; sc["culprit"] = "r0";
            sc["synopsis"] = "房主还没放剧本，先用一个最小本走一遍流程。往 scripts/ 丢一个 JSON 就能换。";
            let roles = [];
            for (let i = 0; i < 8; i++)
                roles.Add(RJ.Frame("id", "r" + i, "public", "角色 " + i,
                    "private", "你记得自己昨晚一直在下雨的窗边。",
                    "secret", "其实那封信是你写的。", "goal", "别在终幕前被指认出来。",
                    "botLines", [ "雨太大了。", "我先听听大家怎么说。" ]));
            sc["roles"] = roles.ToArray();
            let acts = [];
            acts.Add(RJ.Frame("no", 1, "title", "第一幕 · 门铃",
                "narration", [ "雨从傍晚就没停过。", "几个人在门厅站定，谁也没先开口。" ],
                "revealDelay", 800, "publicClues", [ "c1" ],
                "privateClues", {}, "discussMs", 180000, "cue", "doorbell"));
            acts.Add(RJ.Frame("no", 2, "title", "第二幕 · 书房",
                "narration", [ "锁是新的。", "桌上摆着多一只杯子。" ],
                "revealDelay", 800, "publicClues", [ "c2" ],
                "privateClues", {}, "discussMs", 180000, "cue", "clock"));
            acts.Add(RJ.Frame("no", 3, "title", "终幕 · 指认", "vote", true,
                "question", "那封信是谁写的？", "narration", [ "灯灭了一次。" ],
                "revealDelay", 800, "publicClues", CS.newArr(0, null),
                "privateClues", {}, "discussMs", 0, "cue", "gong"));
            sc["acts"] = acts.ToArray();
            sc["clues"] = RJ.Frame("c1", RJ.Frame("title", "门厅的伞", "text", "伞都是湿的，只有一把是干的。"),
                "c2", RJ.Frame("title", "多出的杯", "text", "杯沿有唇印，茶还是温的。"));
            sc["endings"] = [
                RJ.Frame("when", "solved", "title", "雨没停", "text", "指认落下，窗外的雨还在下。真相留在了没翻开的那一页。"),
                RJ.Frame("when", "else", "title", "散场", "text", "没人再说话，各自把伞拿了起来。") ];
            sc["ambience"] = RJ.Frame("drone", "rain", "ink", 0.7, "paper", 0.5, "cueVolume", 0.6);
            return sc;
        }

        Script(s) { return s.V["_script"]; }
        Acts(s)
        {
            let sc = this.Script(s); let a;
            CS.tg(sc, "acts", _v => a = _v).ok; return a || CS.newArr(0, null);
        }
        ActInfo(s, i)
        {
            let a = this.Acts(s); return i >= 0 && i < a.length ? a[i] : null;
        }
        Roles(s)
        {
            let sc = this.Script(s); let a;
            CS.tg(sc, "roles", _v => a = _v).ok; return a || CS.newArr(0, null);
        }
        Clues(s)
        {
            let sc = this.Script(s); let c;
            CS.tg(sc, "clues", _v => c = _v).ok; return c || {};
        }

        Dm(s) { return this.OptB(s, "dmMode", RJ.Bool(this.Script(s), "dm", false)) && s.Seats > 1; }
        IsActive(s, seat) { return !this.Dm(s) || seat > 0; }
        ActiveCount(s) { return Math.max(1, s.Seats - (this.Dm(s) ? 1 : 0)); }
        RoleIndex(s, seat)
        {
            let roles = this.Roles(s);
            if (roles.length == 0) return 0;
            return (this.Dm(s) ? seat - 1 : seat) % roles.length;
        }
        Done(s, key)
        {
            let o;
            if (!CS.tg(s.V, key, _v => o = _v).ok || !(CS.isArr(o)) || (o).length != s.Seats)
            { let a = CS.newArr(s.Seats, false); s.V[key] = a; return a; }
            return o;
        }
        *ActiveSeats(s)
        {
            for (let i = 0; i < s.Seats; i++) if (this.IsActive(s, i)) yield i;
        }
        NextSpeaker(s)
        {
            let said = this.Done(s, "_said");
            for (let k = 1; k <= s.Seats; k++)
            {
                let i = (s.Turn + k) % s.Seats;
                if (this.IsActive(s, i) && !said[i]) return i;
            }
            return -1;
        }
        MyClueIds(s, seat)
        {
            if (!this.IsActive(s, seat)) return CS.newArr(0, "");
            let pv = null;
            let o; if (CS.tg(s.V, "_private", _v => o = _v).ok) pv = o;
            if (pv == null) return CS.newArr(0, "");
            let roles = this.Roles(s);
            let ri = this.RoleIndex(s, seat);
            let rid = ri < roles.length ? RJ.Str(roles[ri], "id", "") : "";
            let ids; if (!CS.tg(pv, rid, _v => ids = _v).ok) return CS.newArr(0, "");
            let a = ids; if (a == null) return CS.newArr(0, "");
            let r = [];
            for (let i = 0; i < a.length; i++) r.Add(CS.str(a[i]));
            return r.ToArray();
        }

        Tick(s, dtMs)
        {
            if (s.Ended || this.StrV(s, "stage", "") != "discuss") return;
            let left = this.IntV(s, "discussLeft", 0) - dtMs;
            s.V["discussLeft"] = Math.max(0, left);
            s.V["tickDirty"] = true;
            if (left <= 0)
            {
                this.Say(s, "讨论时间到，转入下一幕");
                this.AdvanceAct(s);
                s.MoveNo++;
            }
        }

        BotLine(s, seat)
        {
            let roles = this.Roles(s);
            if (roles.length == 0) return "";
            let role = roles[this.RoleIndex(s, seat)];
            if (role == null) return "";
            let bl; if (!CS.tg(role, "botLines", _v => bl = _v).ok) return "";
            let lines = bl;
            if (lines == null || lines.length == 0) return "";
            let k = Math.abs(s.MoveNo * 7 + seat * 13) % lines.length;
            return CS.str(lines[k]);
        }

        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || seat < 0 || seat >= s.Seats) return r;
            let stage = this.StrV(s, "stage", "curtain");
            if (stage == "curtain" || stage == "narration") { r.Add("n"); return r; }
            if (stage == "clues")
            {

                if (!this.IsActive(s, seat)) return r;
                let done = this.Done(s, "_clueDone");
                if (done[seat]) return r;
                let mine = this.MyClueIds(s, seat);
                for (let i = 0; i < mine.length; i++)
                {
                    r.Add("reveal:" + mine[i]);
                    r.Add("hold:" + mine[i]);
                }
                r.Add("hold:all");
                if (seat == 0) r.Add("n");
                return r;
            }
            if (stage == "discuss")
            {
                if (!this.IsActive(s, seat) || seat != s.Turn) return r;
                r.Add("say:*"); r.Add("say:我先说说我的本");
                if (seat == 0) r.Add("n");
                return r;
            }
            if (stage == "vote")
            {
                if (!this.IsActive(s, seat)) return r;
                let vd = this.Done(s, "_voted");
                if (!vd[seat])
                {
                    let roles = this.Roles(s);
                    for (let i = 0; i < roles.length; i++) r.Add("v:" + i);
                }
                return r;
            }
            return r;
        }

        Act(s, seat, action, d)
        {
            let code = d != null && d.ContainsKey("code") ? CS.str(d["code"]) : action;
            let stage = this.StrV(s, "stage", "curtain");
            if (s.Ended) return MoveResult.Fail("本已散场");
            if (stage == "curtain")
            {
                s.V["stage"] = "narration"; s.V["line"] = 0;
                this.LoadNarration(s);
                s.V["cue"] = "curtain";
                s.PhaseName = this.ActInfo(s, this.IntV(s, "act", 0)) == null ? "散场" : RJ.Str(this.ActInfo(s, this.IntV(s, "act", 0)), "title", "幕");
                this.Say(s, "幕起 · " + s.PhaseName);
                return MoveResult.Good();
            }
            if (stage == "narration")
            {
                let lines = s.V["narration"];
                let line = this.IntV(s, "line", 0) + 1; s.V["line"] = line;
                if (lines == null || line >= lines.length)
                {
                    s.V["stage"] = "clues";
                    this.DeliverClues(s);
                    let a = this.ActInfo(s, this.IntV(s, "act", 0));
                    s.V["cue"] = RJ.Str(a, "cue", "paper");
                    s.PhaseName = "线索发放 · 翻牌看";
                    this.Say(s, "旁白读完，线索已发到各自手里");
                }
                return MoveResult.Good();
            }
            if (stage == "clues")
            {
                if (code == "n") { this.EnterDiscussOrVote(s); return MoveResult.Good("收起翻牌"); }
                if (!this.IsActive(s, seat)) return MoveResult.Fail("主持人不参与翻牌");
                let done = this.Done(s, "_clueDone");
                if (done[seat]) return MoveResult.Fail("这一幕你已经表态了");
                if (code.StartsWith("reveal:"))
                {
                    if (!this.OptB(s, "clueReveal", true)) return MoveResult.Fail("本房关闭了公开线索");
                    let cid = CS.substr(code, 7);
                    let mine = this.MyClueIds(s, seat);
                    if (CS.indexOf(mine, cid) < 0) return MoveResult.Fail("这条线索不在你手里");
                    let pub = (s.V["publicClues"] || CS.newArr(0, "")).slice();
                    if (!pub.Contains(cid)) pub.Add(cid);
                    s.V["publicClues"] = pub.ToArray();
                    let c = DirectorGame.ObjGet(this.Clues(s), cid);
                    this.Say(s, "座位 " + seat + " 亮出了线索「" + RJ.Str(c, "title", cid) + "」");
                }
                else if (code.StartsWith("hold:"))
                {
                    this.Say(s, "座位 " + seat + " 把线索扣在手里，没有公开");
                }
                else return MoveResult.Fail("亮出线索或扣着");
                done[seat] = true;
                let all = true;
                for (let i of this.ActiveSeats(s)) if (!done[i]) { all = false; break; }
                if (all) this.EnterDiscussOrVote(s);
                return MoveResult.Good();
            }
            if (stage == "discuss")
            {
                if (seat != s.Turn) return MoveResult.Fail("还没轮到你发言");
                if (code.StartsWith("say:"))
                {
                    let text = CS.substr(code, 4);
                    if (text.length > 120) text = CS.substr(text, 0, 120);
                    this.Say(s, "座位 " + seat + "：" + text);
                    let said = this.Done(s, "_said");
                    if (!said[seat]) { said[seat] = true; s.V["said"] = this.IntV(s, "said", 0) + 1; }
                    if (this.IntV(s, "said", 0) >= this.ActiveCount(s)) this.AdvanceAct(s);
                    else { let nx = this.NextSpeaker(s); if (nx >= 0) s.Turn = nx; }
                    return MoveResult.Good();
                }
                if (code == "n") { this.AdvanceAct(s); return MoveResult.Good("收起讨论，转入下一幕"); }
                return MoveResult.Fail("说一句，或房主点收讨论");
            }
            if (stage == "vote")
            {
                if (!this.IsActive(s, seat)) return MoveResult.Fail("主持人不参与指认");
                let vd = this.Done(s, "_voted");
                if (vd[seat]) return MoveResult.Fail("已经投过");
                if (!code.StartsWith("v:")) return MoveResult.Fail("请指认一个角色");
                let target = DirectorGame.Safe(CS.substr(code, 2));
                let roles = this.Roles(s);
                if (target < 0 || target >= roles.length) return MoveResult.Fail("没有这个角色");
                let votes = s.V["votes"];
                if (votes == null || votes.length != roles.length) { votes = CS.newArr(Math.max(1, roles.length), 0); s.V["votes"] = votes; }
                votes[target]++; vd[seat] = true;
                let voted = this.IntV(s, "voted", 0) + 1; s.V["voted"] = voted;
                if (voted >= this.ActiveCount(s)) this.Resolve(s);
                return MoveResult.Good();
            }
            return MoveResult.Fail("阶段错误");
        }

            EnterDiscussOrVote(s)
            {
                let a = this.ActInfo(s, this.IntV(s, "act", 0));
                if (a == null) { this.EnterVote(s); return; }
                if (RJ.Bool(a, "vote", false)) { this.EnterVote(s); return; }
                s.V["stage"] = "discuss";
                let secs = this.OptI(s, "ph_discuss", Math.max(10, RJ.Int(a, "discussMs", 180000) / 1000));
                s.V["discussLeft"] = Math.max(10000, secs * 1000);
                s.V["_phase"] = "discuss";
                s.V["_said"] = CS.newArr(s.Seats, false); s.V["said"] = 0;
                s.Turn = -1;
                let first = this.NextSpeaker(s);
                s.Turn = first < 0 ? 0 : first;
                s.PhaseName = "讨论 · 轮流打字";
                this.Say(s, "开议，轮者留一句（余 " + (this.IntV(s, "discussLeft", 0) / 1000) + " 秒）");
            }
            EnterVote(s)
            {
                let roles = this.Roles(s);
                s.V["stage"] = "vote"; s.PhaseName = "终幕 · 指认"; s.V["cue"] = "gong";
                s.V["_phase"] = "vote";
                let a = this.ActInfo(s, this.IntV(s, "act", 0));
                this.Say(s, a == null ? "请指认" : RJ.Str(a, "question", "请指认"));
                s.V["_voted"] = CS.newArr(s.Seats, false);
                s.V["voted"] = 0;
                s.V["votes"] = CS.newArr(Math.max(1, roles.length), 0);
                s.V["revote"] = 0;
                if (this.Dm(s)) (s.V["_voted"])[0] = true;
            }
        LoadNarration(s)
        {
            let a = this.ActInfo(s, this.IntV(s, "act", 0));
            let n; CS.tg(a, "narration", _v => n = _v).ok;
            let arr = n;
            let l = [];
            if (arr != null) for (let i = 0; i < arr.length; i++) l.Add(CS.str(arr[i]));
            s.V["narration"] = l.ToArray();
        }
        DeliverClues(s)
        {
            let a = this.ActInfo(s, this.IntV(s, "act", 0));
            let pub = (s.V["publicClues"] || CS.newArr(0, "")).slice();
            let pc; CS.tg(a, "publicClues", _v => pc = _v).ok;
            let pa = pc;
            if (pa != null) for (let i = 0; i < pa.length; i++) pub.Add(CS.str(pa[i]));
            s.V["publicClues"] = pub.ToArray();

            let pv; CS.tg(a, "privateClues", _v => pv = _v).ok;
            s.V["_private"] = pv || {};
            s.V["_clueDone"] = CS.newArr(s.Seats, false);
            if (this.Dm(s)) (s.V["_clueDone"])[0] = true;
        }

        AdvanceAct(s)
        {
            let next = this.IntV(s, "act", 0) + 1;
            if (next >= this.Acts(s).length)
            {
                this.EnterVote(s);
                this.Say(s, "讨论结束，请指认");
            }
            else
            {
                s.V["act"] = next; s.V["stage"] = "curtain";
                s.PhaseName = "第 " + (next + 1) + " 幕 · 幕卡";
                this.Say(s, "转入下一幕");
            }
        }

        Resolve(s)
        {
            let votes = s.V["votes"] || CS.newArr(1, 0);
            let top = 0; let ties = 0;
            for (let i = 1; i < votes.length; i++) if (votes[i] > votes[top]) top = i;
            for (let i = 0; i < votes.length; i++) if (votes[i] == votes[top] && votes[i] > 0) ties++;
            if (ties > 1 && this.IntV(s, "revote", 0) == 0)
            {

                s.V["revote"] = 1;
                s.V["_voted"] = CS.newArr(s.Seats, false);
                if (this.Dm(s)) (s.V["_voted"])[0] = true;
                s.V["voted"] = 0;
                s.V["votes"] = CS.newArr(votes.length, 0);
                this.Say(s, "平票了，请再指认一轮");
                return;
            }
            let sc = this.Script(s);
            let roles = this.Roles(s);
            let pickedRole = top >= 0 && top < roles.length
                ? RJ.Str(roles[top], "id", "") : "";
            let culprit = RJ.Str(sc, "culprit", "");
            let solved = ties <= 1 && culprit.length > 0 && pickedRole == culprit;
            s.V["solved"] = solved;
            let e; CS.tg(sc, "endings", _v => e = _v).ok;
            let ends = e || CS.newArr(0, null);
            let title = solved ? "真相" : "雨没停", text = solved ? "指认落定。" : "没人被说服。";
            for (let i = 0; i < ends.length; i++)
            {
                let x = ends[i];
                if (x == null) continue;
                let when = RJ.Str(x, "when", "else");
                let hit = solved
                    ? (when == "solved" || when == "right" || when == "vote" || when == "vote:" + culprit)
                    : (when == "else" || when == "miss");
                if (hit) { title = RJ.Str(x, "title", title); text = RJ.Str(x, "text", text); break; }
            }
            this.Say(s, solved ? "指认命中真相" : "指认未命中");
            let pickedName = top < roles.length
                ? RJ.Str(roles[top], "public", "角色 " + top) : "无人";
            s.V["ending"] = RJ.Frame("title", title, "text", text, "top", top, "picked", pickedName);
            s.V["stage"] = "end";
            s.V["cue"] = "end";

            if (solved) this.FinishTeam(s, this.ActiveSeats(s), title + " · 指认「" + pickedName + "」命中真相");
            else this.Finish(s, -1, title + " · 指认「" + pickedName + "」未命中");
        }

        View(s, seat)
        {
            let v = super.View(s, seat);
            let info = v["info"];
            if (info == null) { info = []; v["info"] = info; }
            let sc = this.Script(s);
            let a = this.ActInfo(s, this.IntV(s, "act", 0));
            info["scriptName"] = RJ.Str(sc, "name", "现场本");
            info["synopsis"] = RJ.Str(sc, "synopsis", "");
            info["theme"] = s.V["theme"];
            info["cue"] = s.V["cue"];
            info["stage"] = s.V["stage"];
            info["actTitle"] = RJ.Str(a, "title", "");
            info["actNo"] = this.IntV(s, "act", 0) + 1;
            info["actCount"] = this.Acts(s).length;
            let lines = s.V["narration"];
            let line = this.IntV(s, "line", 0);
            let shown = [];
            if (lines != null && this.StrV(s, "stage", "") == "narration")
                for (let i = 0; i <= Math.min(line, lines.length - 1); i++) shown.Add(lines[i]);
            info["narration"] = shown.ToArray();
            info["revealDelay"] = RJ.Int(a, "revealDelay", 800);
            info["discussLeft"] = s.V["discussLeft"];
            info["question"] = RJ.Str(a, "question", "");

            let clues = this.Clues(s);
            let pub = s.V["publicClues"] || CS.newArr(0, "");
            let pubCards = [];
            for (let i = 0; i < pub.length; i++)
            {
                let c = DirectorGame.ObjGet(clues, pub[i]);
                pubCards.Add(RJ.Frame("id", pub[i], "title", RJ.Str(c, "title", pub[i]), "text", RJ.Str(c, "text", "")));
            }
            info["publicClues"] = pubCards.ToArray();

            let roles = this.Roles(s);
            let ri = seat >= 0 ? seat % Math.max(1, roles.length) : 0;
            let role = roles.length > 0 ? roles[ri] : null;
            if (seat >= 0 && role != null)
            {
                info["myRole"] = RJ.Frame("public", RJ.Str(role, "public", "角色"),
                    "private", RJ.Str(role, "private", ""), "secret", RJ.Str(role, "secret", ""),
                    "goal", RJ.Str(role, "goal", ""));
                let mine = [];
                let pv = null;
                let pvObj; if (CS.tg(s.V, "_private", _v => pvObj = _v).ok) pv = pvObj;
                let mineIds;
                if (pv != null && CS.tg(pv, RJ.Str(role, "id", ""), _v => mineIds = _v).ok)
                {
                    let ma = mineIds;
                    if (ma != null) for (let i = 0; i < ma.length; i++)
                    {
                        let cid = CS.str(ma[i]);
                        let c = DirectorGame.ObjGet(clues, cid);
                        mine.Add(RJ.Frame("id", cid, "title", RJ.Str(c, "title", cid), "text", RJ.Str(c, "text", "")));
                    }
                }
                info["privateClues"] = mine.ToArray();
            }
            else { info["myRole"] = null; info["privateClues"] = CS.newArr(0, null); }
            info["voted"] = s.V["voted"];
            info["seatsTotal"] = this.ActiveCount(s);
            info["said"] = s.V["said"];
            info["speaker"] = s.Turn;
            info["isDm"] = this.Dm(s) && seat == 0;
            info["discussSeconds"] = this.IntV(s, "discussLeft", 0) / 1000;
            info["revote"] = this.IntV(s, "revote", 0);
            let names = [];
            for (let i = 0; i < roles.length; i++)
                names.Add(RJ.Frame("id", i, "name", RJ.Str(roles[i], "public", "角色 " + i)));
            info["roleNames"] = names.ToArray();
            if (this.Dm(s) && seat == 0)
                info["dmAnswer"] = RJ.Str(sc, "culprit", "") + " · " + RJ.Str(sc, "synopsis", "");
            if (this.StrV(s, "stage", "") == "end" && seat >= 0 && this.IsActive(s, seat))
            {
                let myRole = roles.length > 0
                    ? roles[this.RoleIndex(s, seat)] : null;
                let win = CS.bool(s.V.ContainsKey("solved") ? s.V["solved"] : false);
                info["myEnding"] = RJ.Frame("role", RJ.Str(myRole, "public", "你的角色"),
                    "goal", RJ.Str(myRole, "goal", ""),
                    "text", win ? "真相被找出来了，你的那页也翻到了最后。" : "真相还压在没翻开的那一页里，你带着自己的秘密离场。");
            }
            if (s.V.ContainsKey("ending")) info["ending"] = s.V["ending"];
            let amb; if (CS.tg(sc, "ambience", _v => amb = _v).ok) info["ambience"] = amb;
            v["info"] = info;

            v["cells"] = CS.newArr(0, ""); v["w"] = 0; v["h"] = 0;
            return v;
        }
        static ObjGet(d, k)
        {
            let o; if (d != null && CS.tg(d, k, _v => o = _v).ok) return o;
            return null;
        }
        static Safe(x) { return ExtraGame.SafePublic(x); }
    }

    class TournamentGame extends RuleBase
    {
        static BANK = [
            [ "中国象棋里「炮」吃子必须满足什么？", "隔一个棋子", "紧挨着", "只能斜走" ],
            [ "围棋终局数子时，黑棋贴目通常是多少？", "不贴", "3又3/4子", "7.5目" ],
            [ "夺帅局里「春天」指什么？", "帅方一手没出完就被反", "群客一张没出", "叫了3分" ],
            [ "五子棋 Renju 禁手针对谁？", "黑方", "白方", "双方" ],
            [ "云笺 里 +4 牌是什么颜色？", "万能变色", "红色", "黄色" ],
            [ "国际象棋王车易位时，王走几格？", "两格", "一格", "三格" ],
            [ "「打劫」是哪一个棋类的规则？", "围棋", "象棋", "军棋" ],
            [ "共牌令一轮落帖最多几次加帖？", "通常不限到封顶", "一次", "两次" ]
        ];
        get Id() { return "tournament"; }
        get Renderer() { return "party"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 12; }
        get Variants() { return [ "5轮", "8轮" ]; }

        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            s.Game = this.Id; s.Room = room; s.Seats = seats;
            s.V["score"] = CS.newArr(seats, 0);
            s.V["round"] = 1;
            s.V["rounds"] = variant == "8轮" ? 8 : 5;
            s.V["_answered"] = CS.newArr(seats, false);
            s.V["answered"] = 0;
            s.V["publicText"] = CS.newArr(0, "");
            this.SetQuestion(s, 0);
            s.PhaseName = "第 1 轮 · 抢答积分";
            this.Say(s, "累墨赛开枰 · 共 " + s.V["rounds"] + " 轮");
            return s;
        }
        SetQuestion(s, round)
        {
            let q = TournamentGame.BANK[Math.abs(round) % TournamentGame.BANK.length];
            let pos = Math.abs(round + 1) % 3;
            let opts = CS.newArr(3, "");
            opts[pos] = q[1];
            let k = 0;
            for (let j = 0; j < 3; j++) if (j != pos) opts[j] = q[2 + k++];
            s.V["question"] = q[0];
            s.V["options"] = opts;
            s.V["_answer"] = pos;
        }
        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || seat < 0) return r;
            let done = s.V["_answered"];
            if (done != null && seat < done.length && !done[seat])
            { r.Add("v:0"); r.Add("v:1"); r.Add("v:2"); }
            return r;
        }
        Act(s, seat, action, d)
        {
            let code = d != null && d.ContainsKey("code") ? CS.str(d["code"]) : action;
            let done = s.V["_answered"];
            if (done[seat]) return MoveResult.Fail("这一轮已经答过");
            if (!code.StartsWith("v:")) return MoveResult.Fail("选一个答案");
            let pick = ExtraGame.SafePublic(CS.substr(code, 2));
            if (pick < 0 || pick > 2) return MoveResult.Fail("没有这个选项");
            done[seat] = true;
            let sc = s.V["score"];
            let right = pick == CS.int(s.V["_answer"]);
            if (right) sc[seat] += 3;
            this.Say(s, "座位 " + seat + (right ? " 答对 +3" : " 答错"));
            let answered = this.IntV(s, "answered", 0) + 1; s.V["answered"] = answered;
            if (answered >= s.Seats)
            {
                let round = this.IntV(s, "round", 1) + 1;
                if (round > this.IntV(s, "rounds", 5))
                {
                    let best = 0;
                    for (let i = 1; i < sc.length; i++) if (sc[i] > sc[best]) best = i;
                    this.Finish(s, best, "锦标赛终局 · 座位 " + best + " 以 " + sc[best] + " 分夺冠");
                }
                else
                {
                    s.V["round"] = round;
                    s.V["_answered"] = CS.newArr(s.Seats, false);
                    s.V["answered"] = 0;
                    this.SetQuestion(s, round - 1);
                    s.PhaseName = "第 " + round + " 轮 · 抢答积分";
                    this.Say(s, "进入第 " + round + " 轮");
                }
            }
            return MoveResult.Good(right ? "答对 +3" : "答错");
        }
        View(s, seat)
        {
            let v = super.View(s, seat);
            let info = v["info"];
            if (info == null) { info = []; v["info"] = info; }
            info["question"] = s.V["question"];
            info["options"] = s.V["options"];
            info["round"] = s.V["round"];
            info["rounds"] = s.V["rounds"];
            info["score"] = s.V["score"];
            info["answered"] = s.V["answered"];
            let done = s.V["_answered"];
            info["answeredMine"] = seat >= 0 && done != null && seat < done.length && done[seat];
            v["info"] = info;
            v["cells"] = CS.newArr(0, ""); v["w"] = 0; v["h"] = 0;
            return v;
        }
    }


// ===== OrigSeven.cs =====
    class OrigSevenGame extends RuleBase
    {
        id ;
        static buildCounter = 0;
        constructor(id) { super(); this.id = id; }
        get Id() { return this.id; }
        get MinSeats() { return this.id == "tingyu" ? 3 : 2; }
        get MaxSeats() { return this.id == "tingyu" ? 6 : (this.id == "shiyi" ? 4 : 2); }
        get Variants() { return [ "常式", "短局", "长局" ]; }
        get Renderer() { return "grid"; }

        static NAMES = [
            "候漏", "渡舟", "灯影", "回文笺", "错金", "拾遗", "听雨" ];
        static WORDS = [ "山", "水", "云", "月", "风" ];

        NameOf(s)
        {
            let i = CS.indexOf([ "houlou", "duzhou", "dengying", "huiwen", "cuojin", "shiyi", "tingyu" ], this.id);
            return i >= 0 ? OrigSevenGame.NAMES[i] : "小戏";
        }
        Goal(s)
        {
            let baseG = this.id == "houlou" ? 8 : (this.id == "shiyi" ? 2 : 3);
            let byOpt = this.OptI(s, "goal", 0);
            if (byOpt > 0) return byOpt;
            return s.Variant == "短局" ? Math.max(2, baseG - 1) : (s.Variant == "长局" ? baseG + 2 : baseG);
        }
        static Scores(s)
        {
            let o; return CS.tg(s.V, "score", _v => o = _v).ok ? o : null;
        }
        static Cover(s)
        {
            let o;
            if (!CS.tg(s.V, "_cover", _v => o = _v).ok || !(CS.isArr(o))) { let n = CS.newArr(s.Seats, ""); s.V["_cover"] = n; return n; }
            return o;
        }
        static Round(s) { return s.V.ContainsKey("round") ? CS.int(s.V["round"]) : 0; }
        static Bump(s) { s.V["round"] = OrigSevenGame.Round(s) + 1; s.MoveNo = OrigSevenGame.Round(s); }
        static Note(s, t) { s.V["lastNote"] = t; this.Say(s, t); s.Last = t; }
        Rng(s, n)
        {
            if (n <= 0) return 0;
            let x = s.V.ContainsKey("_r2") ? CS.int(s.V["_r2"]) : 20261121 ^ s.Seats;
            x = (x * 6364136223846793005 + 1442695040888963407) & 0x7FFFFFFFFFFFFFFF;
            s.V["_r2"] = x;
            return ((x >> 17) % n);
        }

        static SeatOrder(s)
        {
            return OrigSevenGame.Round(s) % 2 == 0 ? [ 0, 1 ] : [ 1, 0 ];
        }
        static AllCovered(c)
        {
            for (let i = 0; i < c.length; i++) if (CS.empty(c[i])) return false;
            return true;
        }
        static NextWaiting(c, from)
        {
            for (let k = 1; k <= c.length; k++)
            {
                let t = (from + k) % c.length;
                if (CS.empty(c[t])) return t;
            }
            return from;
        }
        CodeCount(s)
        {
            switch (this.id)
            {
                case "houlou": return 3;
                case "duzhou": return 4;
                case "dengying": return 7;
                case "huiwen": return 4;
                case "cuojin": return 9;
                case "shiyi": { let o; let p = CS.tg(s.V, "piles", _v => o = _v).ok ? o : null; return p == null ? 21 : p.length; }
                case "tingyu": return 6;
            }
            return 3;
        }
        Labels(s)
        {
            switch (this.id)
            {
                case "houlou": return [ "一滴", "两滴", "三滴" ];
                case "duzhou": return [ "划头舟", "划中舟", "划尾舟", "缆彼最前舟" ];
                case "dengying": return [ "照一", "照二", "照三", "照四", "照五", "照六", "移影" ];
                case "huiwen": return [ "第一列", "第二列", "第三列", "第四列" ];
                case "cuojin": return [ "一段", "二段", "三段", "四段", "五段", "六段", "七段", "八段", "剪金" ];
                case "shiyi":
                {
                    let o; let p = CS.tg(s.V, "piles", _v => o = _v).ok ? o : null;
                    let a = CS.newArr(p == null ? 21 : p.length, "");
                    for (let i = 0; i < a.length; i++)
                        a[i] = p != null && p[i] > 0 ? "取 " + p[i] : "空堆";
                    return a;
                }
                case "tingyu": return [ "一雨", "二雨", "三雨", "四雨", "五雨", "六雨" ];
            }
            return [ "落" ];
        }
        Banned(s, seat, k)
        {
            if (this.id == "houlou" && s.V.ContainsKey("_ban") && CS.int(s.V["_ban"]) == k + 1) return true;
            if (this.id == "tingyu" && s.V.ContainsKey("_banNum") && CS.int(s.V["_banNum"]) == k + 1) return true;
            return false;
        }

        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            if (this.id == "huiwen") this.SetGrid(s, 4, 4);
            else if (this.id == "cuojin") this.SetGrid(s, 8, 1);
            else if (this.id == "shiyi") this.SetGrid(s, 12, 1);
            else if (this.id == "dengying") this.SetGrid(s, 6, 1);
            else this.SetGrid(s, 5, 1);
            s.Seats = seats;
            OrigSevenGame.buildCounter++;
            let seedMix = 20261121 ^ (OrigSevenGame.buildCounter * 2654435761) ^ s.Room.length * 7919;
            s.V["_r2"] = seedMix & 0x7FFFFFFFFFFFFFFF;
            s.Turn = this.id == "shiyi" ? this.Rng(s, seats) : 0;
            s.V["score"] = CS.newArr(seats, 0);
            s.V["round"] = 0;
            s.V["goal"] = this.Goal(s);
            s.V["lastNote"] = "两席各覆一手，同时启看";
            s.V["_cover"] = CS.newArr(seats, "");
            s.V["_ban"] = -1;
            s.V["_banNum"] = -1;
            s.V["_lastSame"] = 0;
            s.V["_lastPick"] = CS.newArr(seats, 0);
            s.V["_lastScorer"] = -1;
            s.V["_adv"] = CS.newArr(seats, 0);
            switch (this.id)
            {
                case "duzhou":
                    s.V["boats"] = [ 0, 0, 0, 0, 0, 0 ];
                    s.V["boatGoal"] = 3;
                    let rp = CS.newArr(seats, 0); for (let q = 0; q < seats; q++) rp[q] = 5;
                    s.V["_rope"] = rp;
                    s.V["_block"] = CS.newArr(6, 0);
                    OrigSevenGame.Note(s, "三舟待发 · 可划可缆，先全渡者执桨");
                    break;
                case "dengying":
                {
                    let lamps = CS.newArr(seats * 3, 0);
                    for (let p = 0; p < seats; p++)
                    {
                        let pool = [ 0, 1, 2, 3, 4, 5 ];
                        for (let k = pool.length - 1; k > 0; k--) { let j = this.Rng(s, k + 1); let t = pool[k]; pool[k] = pool[j]; pool[j] = t; }
                        for (let k = 0; k < 3; k++) lamps[p * 3 + k] = pool[k];
                    }
                    s.V["_lamps"] = lamps;
                    s.V["_lit"] = CS.newArr(seats, 0);
                    let mv = CS.newArr(seats, 0); let tr = CS.newArr(seats, "");
                    for (let q = 0; q < seats; q++) { mv[q] = 2; tr[q] = ""; }
                    s.V["_moves"] = mv; s.V["_tried"] = tr;
                    OrigSevenGame.Note(s, "各藏三灯于六格 · 照行照列，先照尽彼灯者胜");
                    break;
                }
                case "huiwen":
                    s.V["cols"] = [ 0, 0, 0, 0, 0, 0, 0, 0 ];
                    s.V["_lastSame"] = 0;
                    s.V["word"] = OrigSevenGame.WORDS[0];
                    OrigSevenGame.Note(s, "同字列上叠笺 · 首尾相衔成回文，先得三笺者胜");
                    break;
                case "cuojin":
                    let ct = CS.newArr(seats, 0); for (let q = 0; q < seats; q++) ct[q] = 2;
                    s.V["_cut"] = ct;
                    s.V["ring"] = CS.newArr(8, "");
                    OrigSevenGame.Note(s, "八段金丝绕环 · 三连同色得金，可剪断彼金");
                    break;
                case "shiyi":
                {
                    let piles = CS.newArr(21, 0);
                    for (let i = 0; i < 21; i++) piles[i] = 1 + this.Rng(s, 9);
                    s.V["piles"] = piles;
                    s.V["tmp"] = CS.newArr(seats, "");
                    OrigSevenGame.Note(s, "公共数堆取遗 · 暂记三数成等差即得笺");
                    break;
                }
                case "tingyu":
                    OrigSevenGame.Note(s, "各暗择雨数 · 唯一最小者听雨得分，重者两湿");
                    break;
                case "houlou":
                    OrigSevenGame.Note(s, "同刻各候、大刻先至、小刻反先 · 先入夜者胜");
                    break;
            }
            return s;
        }

        Legal(s, seat)
        {
            let a = [];
            if (s.Ended || seat < 0 || seat >= s.Seats) return a;
            if (this.id == "shiyi")
            {
                if (s.Turn != seat) return a;
                let o; let p = CS.tg(s.V, "piles", _v => o = _v).ok ? o : null;
                if (p == null) return a;
                for (let i = 0; i < p.length; i++) if (p[i] > 0) a.Add("c:" + i);
                return a;
            }
            let cv = OrigSevenGame.Cover(s);
            if (!CS.empty(cv[seat])) return a;
            let k = this.CodeCount(s);
            for (let i = 0; i < k; i++)
            {
                if (this.Banned(s, seat, i)) continue;
                if (this.id == "dengying" && i == 6 && (s.V["_moves"])[seat] <= 0) continue;
                if (this.id == "cuojin" && i == 8 && (s.V["_cut"])[seat] <= 0) continue;
                a.Add("c:" + i);
            }
            return a;
        }

        Act(s, seat, action, d)
        {
            let code = J.Str(d, "code", "");
            if (code.IndexOf(':') < 0) return MoveResult.Fail("请择一手");
            let k;
            if (!CS.tp(CS.substr(code, code.IndexOf(':') + 1), _v => k = _v)) return MoveResult.Fail("这一手不认识");
            let legal = this.Legal(s, seat);
            if (!legal.Contains(code)) return MoveResult.Fail("此刻不能这样落");

            if (this.id == "shiyi") return this.ActShiyi(s, seat, k);

            let cv = OrigSevenGame.Cover(s);
            cv[seat] = CS.str(k);
            if (!OrigSevenGame.AllCovered(cv))
            {
                s.Turn = OrigSevenGame.NextWaiting(cv, seat);
                return MoveResult.Good("已覆，候他席");
            }
            let picks = CS.newArr(cv.length, 0);
            for (let i = 0; i < cv.length; i++) picks[i] = CS.int(cv[i]);
            s.V["_lastPick"] = picks.ToArray();
            for (let i = 0; i < cv.length; i++) cv[i] = "";
            this.Reveal(s, picks);
            return MoveResult.Good("");
        }

        Reveal(s, p)
        {
            switch (this.id)
            {
                case "houlou": this.RevealHoulou(s, p); break;
                case "duzhou": this.RevealDuzhou(s, p); break;
                case "dengying": this.RevealDengying(s, p); break;
                case "huiwen": this.RevealHuiwen(s, p); break;
                case "cuojin": this.RevealCuojin(s, p); break;
                case "tingyu": this.RevealTingyu(s, p); break;
            }
            OrigSevenGame.Bump(s);
            s.Turn = 0;
            this.CheckEnd(s);
        }

        CheckEnd(s)
        {
            let sc = OrigSevenGame.Scores(s); let goal = this.Goal(s);
            let top = []; let mx = -1;
            for (let i = 0; i < sc.length; i++) if (sc[i] > mx) mx = sc[i];
            for (let i = 0; i < sc.length; i++) if (sc[i] == mx) top.Add(i);
            let reached = mx >= goal;
            let cap = OrigSevenGame.Round(s) >= 40;
            let boardFull = this.BoardFull(s);
            if (!reached && !cap && !boardFull) return;
            if (top.length == 1) this.Finish(s, top[0], this.NameOf(s) + " · 第 " + (top[0] == 0 ? "甲" : "乙") + " 席执卷（" + mx + "）");
            else
            {
                let tb = this.TieBreak(s, top);
                if (tb < 0 && s.V.ContainsKey("_lastScorer")) tb = CS.int(s.V["_lastScorer"]);
                if (tb >= 0) this.Finish(s, tb, this.NameOf(s) + " · 同分，以据盘多者执卷");
                else
                {
                    let names = CS.join("、", top.Select(x => x == 0 ? "甲" : "乙").ToArray());
                    this.Finish(s, -1, this.NameOf(s) + " · " + names + " 同分，言和");
                }
            }
        }
        TieBreak(s, top)
        {
            let own = CS.newArr(s.Seats, 0);
            if (this.id == "huiwen" || this.id == "cuojin")
            {
                for (let i = 0; i < s.Cells.length; i++)
                {
                    let c = s.Cells[i]; if (CS.empty(c)) continue;
                    if (c[0] == 'r') own[0]++; else if (c[0] == 'b') own[1]++;
                }
            }
            else if (this.id == "duzhou")
            {
                let b = s.V["boats"];
                for (let k = 0; k < 3; k++) { own[0] += b[k]; own[1] += b[3 + k]; }
            }
            else if (this.id == "dengying") { let l = s.V["_lit"]; own[0] = l[0]; own[1] = l[1]; }
            if (this.id == "duzhou")
            {
                let ad = s.V["_adv"];
                if (ad[0] != ad[1]) return ad[0] > ad[1] ? 0 : 1;
                return OrigSevenGame.Round(s) % 2 == 0 ? 1 : 0;
            }
            if (this.id != "huiwen" && this.id != "cuojin" && this.id != "dengying") return -1;
            let best = -1, bv = -1; let tie = false;
            for (let t of top) { if (own[t] > bv) { bv = own[t]; best = t; tie = false; } else if (own[t] == bv) tie = true; }
            return tie ? -1 : best;
        }
        BoardFull(s)
        {
            if (this.id == "huiwen" || this.id == "cuojin")
            {
                for (let i = 0; i < s.Cells.length; i++) if (CS.empty(s.Cells[i])) return false;
                return true;
            }
            if (this.id == "shiyi")
            {
                let o; let p = CS.tg(s.V, "piles", _v => o = _v).ok ? o : null;
                if (p == null) return true;
                for (let i = 0; i < p.length; i++) if (p[i] > 0) return false;
                return true;
            }
            if (this.id == "duzhou")
            {
                let b = s.V["boats"]; let g = CS.int(s.V["boatGoal"]);
                for (let i = 0; i < b.length; i++) if (b[i] < g) return false;
                return true;
            }
            return false;
        }

        RevealHoulou(s, p)
        {
            let a = p[0] + 1, b = p[1] + 1;
            let sc = OrigSevenGame.Scores(s);
            let t;
            if (a == b)
            {
                sc[0]++; sc[1]++;
                s.V["_lastSame"] = a == CS.int(s.V["_lastSame"]) ? 2 : 1;
                t = "同刻 " + a + " 滴 · 各候一格";
            }
            else if (Math.abs(a - b) == 1)
            {
                let w = a > b ? 0 : 1; sc[w] += 2;
                s.V["_lastSame"] = 0;
                t = "大刻先至 · " + (w == 0 ? "甲" : "乙") + " 进二格";
            }
            else
            {
                let w = a < b ? 0 : 1; sc[w] += 2;
                s.V["_lastSame"] = 0;
                t = "小刻反先 · " + (w == 0 ? "甲" : "乙") + " 进二格";
            }
            let ban = -1;
            if (a == b && CS.int(s.V["_lastSame"]) >= 2) { ban = a; s.V["_lastSame"] = 0; t += " · 下巡禁同刻"; }
            s.V["_ban"] = ban;
            OrigSevenGame.Note(s, t);
        }

        RevealDuzhou(s, p)
        {
            let b = s.V["boats"]; let g = CS.int(s.V["boatGoal"]);
            let sc = OrigSevenGame.Scores(s);
            let t = "";
            let rope = s.V["_rope"];
            let block = s.V["_block"];
            let adv = s.V["_adv"];
            adv[0] = 0; adv[1] = 0;
            let bothRope = p[0] == 3 && p[1] == 3;
            if (bothRope)
            {
                for (let seat = 0; seat < 2; seat++)
                {
                    let bi = 0, bv = 99;
                    for (let k = 0; k < 3; k++) if (b[seat * 3 + k] < bv) { bv = b[seat * 3 + k]; bi = k; }
                    if (b[seat * 3 + bi] < g) b[seat * 3 + bi]++;
                    t += (seat == 0 ? "甲" : "乙") + "缆落空，各补一舟 ";
                }
            }
            else for (let seat of OrigSevenGame.SeatOrder(s))
            {
                let k = p[seat];
                if (k < 3)
                {
                    let idx = seat * 3 + k;
                    if (block[idx] > 0) { block[idx]--; t += (seat == 0 ? "甲" : "乙") + "舟被缆住 "; }
                    else if (b[idx] < g) { b[idx]++; adv[seat]++; t += (seat == 0 ? "甲" : "乙") + "划" + (k + 1) + "舟 "; }
                }
                else
                {
                    let foe = 1 - seat, bi = foe * 3, bv = -1;
                    for (let q = 0; q < 3; q++) if (b[foe * 3 + q] > bv) { bv = b[foe * 3 + q]; bi = foe * 3 + q; }
                    if (rope[seat] > 0) { rope[seat]--; block[bi] = 1; t += (seat == 0 ? "甲" : "乙") + "缆彼最前舟一巡 "; }
                    else { if (b[seat * 3] < g) b[seat * 3]++; t += (seat == 0 ? "甲" : "乙") + "缆尽，改划 "; }
                }
            }
            s.V["_rope"] = rope; s.V["_block"] = block; s.V["_adv"] = adv;
            for (let seat = 0; seat < 2; seat++)
            {
                let all = true; for (let k = 0; k < 3; k++) if (b[seat * 3 + k] < g) all = false;
                if (all) { sc[seat] = this.Goal(s); t += (seat == 0 ? "甲" : "乙") + "三舟尽渡 "; }
            }
            OrigSevenGame.Note(s, t.trim());
        }

        RevealDengying(s, p)
        {
            let lamps = s.V["_lamps"]; let lit = s.V["_lit"];
            let moves = s.V["_moves"]; let tried = s.V["_tried"];
            let sc = OrigSevenGame.Scores(s);
            let t = "";
            for (let seat of OrigSevenGame.SeatOrder(s))
            {
                let k = p[seat];
                let foe = 1 - seat;
                if (k == 6)
                {
                    moves[seat]--;
                    let mine = []; for (let q = 0; q < 3; q++) mine.Add(lamps[seat * 3 + q]);
                    for (let q = 0; q < mine.length; q++)
                    {
                        let cur = mine[q]; let isLit = cur < 0;
                        if (isLit) continue;
                        let nv = cur + 1 <= 5 ? cur + 1 : cur - 1;
                        if (!mine.Contains(nv)) { lamps[seat * 3 + q] = nv; t += (seat == 0 ? "甲" : "乙") + "移影 "; break; }
                    }
                }
                else
                {
                    let key = CS.str(k);
                    if (!tried[seat].Contains("[" + key + "]")) tried[seat] += "[" + key + "]";
                    for (let q = 0; q < 3; q++)
                        if (lamps[foe * 3 + q] == k && lamps[foe * 3 + q] >= 0)
                        {
                            lamps[foe * 3 + q] = -1 - k; lit[seat]++; s.V["_lastScorer"] = seat;
                            t += (seat == 0 ? "甲" : "乙") + "照中彼灯 ";
                            break;
                        }
                }
                if (lit[seat] >= 3) { sc[seat] = this.Goal(s); t += (seat == 0 ? "甲" : "乙") + "照尽彼灯 "; }
            }
            s.V["_moves"] = moves; s.V["_tried"] = tried;
            OrigSevenGame.Note(s, t.trim().length > 0 ? t.trim() : "两照皆空，灯影未动");
        }

        RevealHuiwen(s, p)
        {
            let cells = s.Cells; let cols = s.V["cols"];
            let w = OrigSevenGame.WORDS[OrigSevenGame.Round(s) % OrigSevenGame.WORDS.length];
            s.V["word"] = w;
            let sc = OrigSevenGame.Scores(s);
            let t = "本巡字「" + w + "」 · ";
            if (p[0] == p[1])
            {
                let col = p[0]; let idxR = 3 * 4 + col, idxB = col;
                if (CS.empty(cells[idxR])) cells[idxR] = "x";
                if (CS.empty(cells[idxB])) cells[idxB] = "x";
                t += "两席争第 " + (col + 1) + " 列，列封";
                OrigSevenGame.Note(s, t); return;
            }
            for (let seat of OrigSevenGame.SeatOrder(s))
            {
                let col = p[seat];
                let row = seat == 0 ? 3 - cols[col] : cols[4 + col];
                let idx = row * 4 + col;
                if (row < 0 || row > 3 || !CS.empty(cells[idx])) { t += (seat == 0 ? "甲" : "乙") + "列满 "; continue; }
                cells[idx] = (seat == 0 ? "r" : "b") + w;
                if (seat == 0) cols[col]++; else cols[4 + col]++;
                if (OrigSevenGame.MakesHuiwen(cells, idx, (seat == 0 ? 'r' : 'b')))
                { sc[seat]++; s.V["_lastScorer"] = seat; t += (seat == 0 ? "甲" : "乙") + "成回文得笺 "; }
                else t += (seat == 0 ? "甲" : "乙") + "落第" + (col + 1) + "列 ";
            }
            OrigSevenGame.Note(s, t.trim());
        }
        static MakesHuiwen(c, idx, me)
        {
            let x = idx % 4, y = idx / 4;
            let dirs = [ [ 1, 0 ], [ 0, 1 ], [ 1, 1 ], [ 1, -1 ] ];
            for (let d of dirs)
                for (let st = -2; st <= 0; st++)
                {
                    let q = CS.newArr(3, 0); let ok = true;
                    for (let k = 0; k < 3; k++)
                    {
                        let xx = x + (st + k) * d[0], yy = y + (st + k) * d[1];
                        if (xx < 0 || xx > 3 || yy < 0 || yy > 3) { ok = false; break; }
                        q[k] = yy * 4 + xx;
                    }
                    if (!ok || !q.Contains(idx)) continue;
                    if (!CS.empty(c[q[0]]) && c[q[0]][0] == me &&
                        !CS.empty(c[q[2]]) && c[q[2]][0] == me &&
                        !CS.empty(c[q[1]])) return true;
                }
            return false;
        }

        RevealCuojin(s, p)
        {
            let ring = s.V["ring"]; let cut = s.V["_cut"];
            let sc = OrigSevenGame.Scores(s); let t = "";
            let cutUsed = CS.newArr(2, false);
            for (let seat = 0; seat < 2; seat++)
            {
                let k = p[seat];
                if (k == 8) { cut[seat]--; cutUsed[seat] = true; }
            }
            for (let seat = 0; seat < 2; seat++) if (cutUsed[seat])
            {
                for (let q = 7; q >= 0; q--)
                    if (ring[q] == (seat == 0 ? "b" : "r")) { ring[q] = ""; t += (seat == 0 ? "甲" : "乙") + "剪断一段 "; break; }
            }
            if (p[0] == p[1] && p[0] < 8 && !cutUsed[0] && !cutUsed[1])
            {
                if (CS.empty(ring[p[0]])) ring[p[0]] = "x";
                t += "两席争第 " + (p[0] + 1) + " 段，成错";
            }
            else
            {
                for (let seat = 0; seat < 2; seat++)
                {
                    let k = p[seat]; if (k >= 8 || cutUsed[seat]) continue;
                    if (CS.empty(ring[k])) ring[k] = seat == 0 ? "r" : "b";
                }
            }
            for (let seat of OrigSevenGame.SeatOrder(s))
            {
                let me = seat == 0 ? "r" : "b";
                for (let q = 0; q < 8; q++)
                    if (ring[q] == me && ring[(q + 1) % 8] == me && ring[(q + 2) % 8] == me)
                    { sc[seat]++; s.V["_lastScorer"] = seat; ring[q] = ""; ring[(q + 1) % 8] = ""; ring[(q + 2) % 8] = ""; t += (seat == 0 ? "甲" : "乙") + "三连得金 "; break; }
            }
            s.Cells = ring;
            s.V["_cut"] = cut;
            OrigSevenGame.Note(s, t.trim().length > 0 ? t.trim() : "金丝未连，静候下巡");
        }

        RevealTingyu(s, p)
        {
            let sc = OrigSevenGame.Scores(s); let n = s.Seats;
            let cnt = CS.newArr(7, 0);
            for (let i = 0; i < n; i++) cnt[p[i] + 1]++;
            let min = 7; for (let k = 1; k <= 6; k++) if (cnt[k] > 0 && k < min) min = k;
            let t = "揭雨 · ";
            for (let i = 0; i < n; i++) t += (i == 0 ? "甲" : (i == 1 ? "乙" : "丙")) + " " + (p[i] + 1) + " ";
            let winner = -1;
            if (min <= 6 && cnt[min] == 1)
            {
                for (let i = 0; i < n; i++) if (p[i] + 1 == min) { winner = i; sc[i]++; break; }
                t += "· 唯一最小 " + min + "，第 " + (winner + 1) + " 席听雨"; s.V["_lastScorer"] = winner;
                s.V["_banNum"] = -1;
            }
            else if (min <= 6)
            {
                t += "· " + min + " 雨重者两湿，下巡禁择";
                s.V["_banNum"] = min;
            }
            else { t += "· 满盘皆湿，本巡无分"; s.V["_banNum"] = -1; }
            OrigSevenGame.Note(s, t.trim());
        }

        ActShiyi(s, seat, k)
        {
            let piles = s.V["piles"]; let tmp = s.V["tmp"];
            let v = piles[k]; piles[k] = 0;
            let my = [];
            if (!CS.empty(tmp[seat]))
                for (let q of tmp[seat].Split(',')) { let z; if (CS.tp(q, _v => z = _v)) my.Add(z); }
            my.Add(v);
            let sc = OrigSevenGame.Scores(s); let t = "第 " + (seat + 1) + " 席取 " + v;
            let got = false;
            for (let a = 0; a < my.length && !got; a++)
                for (let b = a + 1; b < my.length && !got; b++)
                    for (let c = b + 1; c < my.length && !got; c++)
                    {
                        let tri = [ my[a], my[b], my[c] ]; CS.sort(tri);
                        if (tri[1] - tri[0] == tri[2] - tri[1])
                        {
                            sc[seat]++; s.V["_lastScorer"] = seat; got = true;
                            my.RemoveAt(c); my.RemoveAt(b); my.RemoveAt(a);
                            t += " · " + tri[0] + "," + tri[1] + "," + tri[2] + " 成等差得笺";
                        }
                    }
            if (my.length > 5) my = my.GetRange(my.length - 5, 5);
            tmp[seat] = CS.join(",", my.Select(x => CS.str(x)).ToArray());
            s.V["tmp"] = tmp;
            OrigSevenGame.Note(s, t);
            OrigSevenGame.Bump(s);
            s.Turn = (seat + 1) % s.Seats;
            this.CheckEnd(s);
            return MoveResult.Good("");
        }

        View(s, seat)
        {
            let v = super.View(s, seat);
            let info = v["info"];
            if (info == null) { info = []; v["info"] = info; }
            info["orig7"] = this.id;
            info["title"] = this.NameOf(s);
            info["labels"] = this.Labels(s);
            info["round"] = OrigSevenGame.Round(s);
            info["goal"] = this.Goal(s);
            info["score"] = OrigSevenGame.Scores(s);
            info["lastNote"] = s.V.ContainsKey("lastNote") ? s.V["lastNote"] : "";
            let cv = OrigSevenGame.Cover(s);
            let covered = CS.newArr(cv.length, 0);
            for (let i = 0; i < cv.length; i++) covered[i] = CS.empty(cv[i]) ? 0 : 1;
            info["covered"] = covered;
            info["you"] = seat;
            info["ban"] = this.id == "houlou" ? (s.V.ContainsKey("_ban") ? CS.int(s.V["_ban"]) : -1)
                : (this.id == "tingyu" && s.V.ContainsKey("_banNum") ? CS.int(s.V["_banNum"]) : -1);
            switch (this.id)
            {
                case "dengying":
                {
                    let lamps = s.V["_lamps"];
                    if (seat >= 0 && seat < lamps.length / 3)
                    {
                        let mine = CS.newArr(3, "");
                        for (let q = 0; q < 3; q++) { let z = lamps[seat * 3 + q]; mine[q] = z < 0 ? "已亮" : "第 " + (z + 1) + " 格"; }
                        info["myLamps"] = mine;
                    }
                    info["lit"] = s.V["_lit"];
                    info["moves"] = s.V["_moves"];
                    break;
                }
                case "duzhou": info["boats"] = s.V["boats"]; info["boatGoal"] = s.V["boatGoal"]; break;
                case "huiwen": info["word"] = s.V["word"]; break;
                case "cuojin": info["cut"] = s.V["_cut"]; break;
                case "shiyi": info["piles"] = s.V["piles"]; info["tmp"] = s.V["tmp"]; break;
            }
            v["legal"] = this.Legal(s, seat).ToArray();
            return v;
        }

        BotPick(s, seat, level, legal)
        {
            if (legal == null || legal.length == 0) return "";
            let lv = Math.max(0, Math.min(9, level));
            if (lv <= 1) return legal[this.Rng(s, legal.length)];
            let ks = [];
            for (let c of legal) { let z; if (CS.tp(CS.substr(c, c.IndexOf(':') + 1), _v => z = _v)) ks.Add(z); }
            if (ks.length == 0) return legal[0];
            let pick = ks[0];
            switch (this.id)
            {
                case "houlou":
                {
                    let ok = ks.Where(k => !this.Banned(s, seat, k)).ToList();
                    if (ok.length == 0) ok = ks;
                    let lp = s.V["_lastPick"];
                    let foe = lp != null && lp.length > 1 ? lp[1 - seat] + 1 : 0;
                    let counter = foe == 1 ? 1 : (foe == 2 ? 2 : (foe == 3 ? 0 : -1));
                    pick = lv >= 5 && counter >= 0 && ok.Contains(counter) && this.Rng(s, 100) < 72
                        ? counter : ok[this.Rng(s, ok.length)];
                    break;
                }
                case "duzhou":
                {
                    let b = s.V["boats"];
                    let best = 99, bi = 0;
                    for (let k = 0; k < 3; k++) if (b[seat * 3 + k] < best) { best = b[seat * 3 + k]; bi = k; }
                    pick = lv >= 5 && this.Rng(s, 100) < 78 ? bi : ks[this.Rng(s, ks.length)];
                    break;
                }
                case "dengying":
                {
                    let tried = s.V["_tried"];
                    let fresh = [];
                    for (let k = 0; k < 6; k++) if (!tried[seat].Contains("[" + k + "]")) fresh.Add(k);
                    pick = lv >= 5 && fresh.length > 0 && this.Rng(s, 100) < 78 ? fresh[this.Rng(s, fresh.length)] : ks[this.Rng(s, ks.length)];
                    break;
                }
                case "huiwen":
                {
                    let cw = s.V["cols"]; let bestC = 0, bv = -1;
                    for (let k = 0; k < 4; k++)
                    {
                        let v = cw[seat == 0 ? k : 4 + k];
                        let sealedCol = (s.Cells[12 + k] || "") == "x" || (s.Cells[k] || "") == "x";
                        if (v < 4 && !sealedCol && v > bv) { bv = v; bestC = k; }
                    }
                    let lp2 = s.V["_lastPick"];
                    let foeC = lp2 != null && lp2.length > 1 ? lp2[1 - seat] : -1;
                    if (foeC >= 0 && bestC == foeC && this.Rng(s, 100) < 50) bestC = (bestC + 1) % 4;
                    pick = lv >= 5 && bv >= 0 && this.Rng(s, 100) < 72 ? bestC : ks[this.Rng(s, ks.length)];
                    break;
                }
                case "cuojin":
                {
                    let ring = s.V["ring"];
                    let empty = [];
                    for (let k = 0; k < 8; k++) if (CS.empty(ring[k])) empty.Add(k);
                    pick = lv >= 5 && empty.length > 0 && this.Rng(s, 100) < 74 ? empty[this.Rng(s, empty.length)] : ks[this.Rng(s, ks.length)];
                    break;
                }
                case "shiyi":
                {
                    let piles = s.V["piles"]; let tmp = s.V["tmp"];
                    let my = [];
                    if (!CS.empty(tmp[seat])) for (let q of tmp[seat].Split(',')) { let z; if (CS.tp(q, _v => z = _v)) my.Add(z); }
                    let bestK = ks[0], bestGap = 99;
                    for (let k of ks)
                    {
                        let t = (my).slice(); t.Add(piles[k]); t.Sort();
                        let gap = 99;
                        for (let a = 0; a < t.length; a++) for (let b = a + 1; b < t.length; b++) for (let c = b + 1; c < t.length; c++)
                            gap = Math.min(gap, Math.abs((t[b] - t[a]) - (t[c] - t[b])));
                        if (gap < bestGap) { bestGap = gap; bestK = k; }
                    }
                    pick = lv >= 5 && this.Rng(s, 100) < 80 ? bestK : ks[this.Rng(s, ks.length)];
                    break;
                }
                case "tingyu":
                {
                    let ok = ks.Where(k => !this.Banned(s, seat, k)).ToList();
                    if (ok.length == 0) ok = ks;
                    let low = ok.Where(k => k + 1 <= 2).ToList();
                    pick = lv >= 5 && low.length > 0 && this.Rng(s, 100) < 70 ? low[this.Rng(s, low.length)] : ok[this.Rng(s, ok.length)];
                    break;
                }
            }
            let code = "c:" + pick;
            return legal.Contains(code) ? code : legal[0];
        }
    }


// ===== YiJuan.cs =====
    class YiJuanGame extends RuleBase
    {
        get Id() { return "yijuan"; }
        get Renderer() { return "scroll"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 2; }
        get Variants() { return [ "常式", "长卷", "短卷" ]; }

        static CY(c) { return c != null && c.length >= 2 ? c[1] - '0' : 0; }
        static CF(c) { return c != null && c.length >= 4 ? c[3] - '0' : 0; }
        static CM(c) { return c != null && c.length >= 6 ? c[5] - '0' : 0; }
        static Card(y, f, m)
        { return "Y" + y + "F" + f + "M" + m; }

        static OPP = [ 1, 0, 3, 2 ];
        static FORD = [ 3, 0, 2, 1 ];
        static FNAME = [ "东", "西", "南", "北" ];
        static FCYCLE = [ 0, 2, 1, 3 ];
        static ROLE_SETS = [
            [ "墨翟", "公输般", "扁鹊", "李冰", "荀况", "韩非", "司马迁", "班昭",
                "张衡", "蔡邕", "华佗", "马钧", "裴秀", "祖冲之", "郦道元", "贾思勰",
                "孙思邈", "李淳风", "一行", "沈括", "毕昇", "苏颂", "李诫", "宋慈" ],
            [ "郭守敬", "黄道婆", "朱载堉", "徐光启", "宋应星", "徐霞客", "顾炎武", "王夫之",
                "黄宗羲", "戴震", "阮元", "李时珍", "吴又可", "叶桂", "王清任", "燕肃",
                "赵友钦", "王祯", "秦九韶", "李冶", "杨辉", "朱世杰", "程大位", "贾宪" ]
        ];
        static RoleSet(s)
        {
            let o; return CS.tg(s.V, "roleSet", _v => o = _v).ok ? Math.max(0, Math.min(1, CS.int(o))) : 0;
        }
        static RoleName(c, set)
        {
            if (CS.empty(c) || c.length < 4) return "";
            let i = (YiJuanGame.CY(c) - 1) * 4 + YiJuanGame.CF(c);
            let a = YiJuanGame.ROLE_SETS[Math.max(0, Math.min(1, set))];
            return i >= 0 && i < a.length ? a[i] : "";
        }
        static CardLabel(c, set)
        {
            if (CS.empty(c) || c.length < 6) return "空简";
            let nm = YiJuanGame.RoleName(c, set);
            return (nm.length > 0 ? "「" + nm + "」 · " : "") +
                YiJuanGame.CY(c) + " 序 · " + YiJuanGame.FNAME[Math.max(0, Math.min(3, YiJuanGame.CF(c)))] + " · " + YiJuanGame.CM(c) + " 墨";
        }

        static OneDeck()
        {
            let d = [];
            for (let y = 1; y <= 6; y++)
            {
                let f1 = YiJuanGame.FCYCLE[(y - 1) % 4];
                let f2 = YiJuanGame.OPP[f1];
                let m = 4 - (y + 1) / 2;
                d.Add(YiJuanGame.Card(y, f1, m)); d.Add(YiJuanGame.Card(y, f2, m));
            }
            return d;
        }

        static Copy(a)
        {
            let r = CS.newArr(a.length, "");
            CS.copy(a, r, a.length);
            return r;
        }
        static AddCard(a, c)
        {
            let r = CS.newArr(a.length + 1, "");
            CS.copy(a, r, a.length); r[a.length] = c;
            return r;
        }
        static DropCard(a, i)
        {
            let l = (a).slice();
            if (i >= 0 && i < l.length) l.RemoveAt(i);
            return l.ToArray();
        }

        LineN(s)
        {
            let o; return CS.tg(s.V, "lineN", _v => o = _v).ok ? CS.int(o) : 9;
        }
        Mid(s) { return (this.LineN(s) - 1) / 2; }
        Line(s)
        {
            let o; return CS.tg(s.V, "line", _v => o = _v).ok ? CS.int(o) : this.Mid(s);
        }
        Ink(s)
        {
            let o; return CS.tg(s.V, "ink", _v => o = _v).ok ? o : [ 0, 0 ];
        }
        Pick(s)
        {
            let o; return CS.tg(s.V, "pick", _v => o = _v).ok ? o : [ 2, 2 ];
        }
        Cover(s)
        {
            let o; return CS.tg(s.V, "cover", _v => o = _v).ok ? o : [ "", "" ];
        }
        Discard(s, seat)
        {
            let o; let a = CS.tg(s.V, "discard" + seat, _v => o = _v).ok ? o : null;
            return a || CS.newArr(0, "");
        }
        PubDiscard(s, seat)
        {
            let o; let a = CS.tg(s.V, "discardPub" + seat, _v => o = _v).ok ? o : null;
            return a || CS.newArr(0, "");
        }

        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            let n = this.O("lineN", variant == "长卷" ? 13 : variant == "短卷" ? 7 : 9);
            if (n < 5) n = 5; if (n > 15) n = 15; if (n % 2 == 0) n++;
            let handN = this.O("handN", 12);
            if (handN < 8) handN = 8; if (handN > 16) handN = 16;
            let inkStart = this.O("inkStart", 0);
            let pickLimit = this.O("pickLimit", 2);
            if (pickLimit < 0) pickLimit = 0; if (pickLimit > 4) pickLimit = 4;
            let roleSet = this.O("roleSet", 2);
            if (roleSet == 2) roleSet = this.NextRng(s, 2);
            if (roleSet < 0 || roleSet > 1) roleSet = 0;

            s.Seats = 2; s.Turn = 0; s.Width = n; s.Height = 1;
            s.Cells = CS.newArr(n, "");
            for (let i = 0; i < n; i++) s.Cells[i] = "";

            let pool = YiJuanGame.OneDeck(); pool.AddRange(YiJuanGame.OneDeck());
            let byY = CS.newList(7);
            for (let y = 0; y <= 6; y++) byY[y] = [];
            for (let c of pool) if (YiJuanGame.CY(c) >= 1 && YiJuanGame.CY(c) <= 6) byY[YiJuanGame.CY(c)].Add(c);
            for (let l of byY) this.Shuffle(s, l);

            let k = [ 2, 2, 2, 2, 2, 2 ];
            let sum = 12, guard = 0;
            while (sum != handN && guard++ < 400)
            {
                let y = this.NextRng(s, 6);
                if (sum < handN && k[y] < 3) { k[y]++; sum++; }
                else if (sum > handN && k[y] > 1) { k[y]--; sum--; }
            }
            let a = [], b = [];
            for (let y = 1; y <= 6; y++)
            {
                let l = byY[y];
                for (let i = 0; i < l.length; i++) (i < k[y - 1] ? a : b).Add(l[i]);
            }
            this.Shuffle(s, a); this.Shuffle(s, b);
            s.Hands[0] = a; s.Hands[1] = b;

            s.V["lineN"] = n; s.V["line"] = (n - 1) / 2; s.V["mid"] = (n - 1) / 2;
            s.V["roleSet"] = roleSet;
            s.V["discard0"] = CS.newArr(0, ""); s.V["discard1"] = CS.newArr(0, "");
            s.V["discardPub0"] = CS.newArr(0, ""); s.V["discardPub1"] = CS.newArr(0, "");
            s.V["ink"] = [ inkStart, inkStart ];
            s.V["pick"] = [ pickLimit, pickLimit ];
            s.V["cover"] = [ "", "" ];
            s.V["coverFlag"] = [ 0, 0 ];
            s.V["round"] = 0;
            s.V["lastA"] = ""; s.V["lastB"] = ""; s.V["lastNote"] = "";
            s.V["stage"] = "cover";
            s.Phase = "playing";
            s.PhaseName = "候覆简 · 两席各择一简";
            this.Say(s, "双卷夹弈线 " + n + " 格，界墨居中；覆简同时启，抵对方卷端者执卷");
            return s;
        }

        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || seat < 0 || seat > 1) return r;
            let cov = this.Cover(s);
            if (cov[seat].length > 0) return r;
            let cost = this.OptI(s, "pickCost", 2);
            let ink = this.Ink(s), pick = this.Pick(s);
            let mine = this.Discard(s, seat);
            if (ink[seat] >= cost && pick[seat] > 0 && mine.length > 0)
                for (let i = 0; i < mine.length; i++) r.Add("r:" + i);
            let h = s.Hands.ContainsKey(seat) ? s.Hands[seat] : [];
            for (let i = 0; i < h.length; i++) r.Add("c:" + i);
            if (r.length == 0) r.Add("pass");
            return r;
        }

        Act(s, seat, action, d)
        {
            let code = J.Str(d, "code", "");
            if (s.Ended) return MoveResult.Fail("全局已散");
            if (seat < 0 || seat > 1) return MoveResult.Fail("旁观者不可覆简");
            let cov = this.Cover(s);
            if (cov[seat].length > 0) return MoveResult.Fail("此席已覆简，静待启简");

            if (code.StartsWith("r:"))
            {
                let idx;
                if (!CS.tp(CS.substr(code, 2), _v => idx = _v)) return MoveResult.Fail("拾简之令不识");
                let cost = this.OptI(s, "pickCost", 2);
                let ink = this.Ink(s), pick = this.Pick(s);
                let mine = this.Discard(s, seat);
                if (ink[seat] < cost || pick[seat] <= 0) return MoveResult.Fail("余墨或拾简次数不足");
                if (idx < 0 || idx >= mine.length) return MoveResult.Fail("弃简区无此简");
                let c = mine[idx];
                s.V["discard" + seat] = YiJuanGame.DropCard(mine, idx);
                s.Hands[seat].Add(c);
                ink[seat] -= cost; pick[seat] -= 1;
                s.V["ink"] = ink; s.V["pick"] = pick;
                s.MoveNo++;
                this.Say(s, "第 " + seat + " 席拾简，余墨减 " + cost);
                return MoveResult.Good();
            }
            if (code.StartsWith("c:"))
            {
                let idx;
                if (!CS.tp(CS.substr(code, 2), _v => idx = _v)) return MoveResult.Fail("覆简之令不识");
                let h = s.Hands.ContainsKey(seat) ? s.Hands[seat] : [];
                if (idx < 0 || idx >= h.length) return MoveResult.Fail("手中无此简");
                let c = h[idx]; h.RemoveAt(idx);
                let cover = this.Cover(s); cover[seat] = c; s.V["cover"] = cover;
                let flag = s.V["coverFlag"]; flag[seat] = 1; s.V["coverFlag"] = flag;
                let other = 1 - seat;
                if (cover[other].length == 0)
                {
                    s.Turn = other;
                    s.PhaseName = "一席已覆 · 待另一席启简";
                    s.MoveNo++;
                    return MoveResult.Good();
                }
                return this.Resolve(s);
            }
            if (code == "pass") return MoveResult.Good();
            return MoveResult.Fail("不识此令");
        }

        Resolve(s)
        {
            let cover = this.Cover(s);
            let a = cover[0], b = cover[1];
            let n = this.LineN(s), mid = this.Mid(s);
            let line = this.Line(s);
            let ink = this.Ink(s);

            s.V["discard0"] = YiJuanGame.AddCard(this.Discard(s, 0), a);
            s.V["discard1"] = YiJuanGame.AddCard(this.Discard(s, 1), b);
            ink[0] += YiJuanGame.CM(a); ink[1] += YiJuanGame.CM(b); s.V["ink"] = ink;

            let ca = YiJuanGame.CY(a), cb = YiJuanGame.CY(b);
            let boost = this.OptI(s, "comeback", 2);
            if (boost > 0 && (line == 1 || line == n - 2))
            {
                if (line == 1) ca += boost; else cb += boost;
            }

            let push = 0, pull = 0; let extra = false;
            let note;
            let fa = YiJuanGame.CF(a), fb = YiJuanGame.CF(b);
            if (ca == cb && fa == fb)
            {
                pull = this.OptI(s, "centerPull", 1);
                note = "同简 · 归中 " + pull + " 格";
                this.MarkFeat(s, "yijuan_same");
            }
            else if (ca == cb)
            {
                if (fb == YiJuanGame.OPP[fa])
                {
                    if (this.OptB(s, "flatClash", true))
                    {
                        push = YiJuanGame.FORD[fa] > YiJuanGame.FORD[fb] ? 1 : -1;
                        note = "平序相冲 · 游方定势推线";
                    }
                    else { extra = true; note = "平序相冲 · 各得一墨"; }
                }
                else note = "平序各异 · 两不相推";
            }
            else
            {
                let dir = ca > cb ? 1 : -1;
                if (fa == fb) { extra = true; note = "相承 · 两不推线，各得一墨"; }
                else
                {
                    push = dir;
                    let dt = this.OptI(s, "diffThresh", 3);
                    if (dt > 0 && Math.abs(ca - cb) >= dt) push += dir;
                    if (fb == YiJuanGame.OPP[fa])
                    {
                        push += dir * this.OptI(s, "clashBonus", 1);
                        note = "相冲 · 年序大者再推";
                    }
                    else note = "年序大者推线";
                }
            }

            if (pull > 0) line += line < mid ? pull : (line > mid ? -pull : 0);
            else
            {
                line += push;
                if (extra) { ink[0]++; ink[1]++; s.V["ink"] = ink; }
            }
            if (line < 0) line = 0; if (line > n - 1) line = n - 1;
            s.V["line"] = line;

            s.V["discardPub0"] = YiJuanGame.Copy(this.Discard(s, 0));
            s.V["discardPub1"] = YiJuanGame.Copy(this.Discard(s, 1));
            s.V["lastA"] = a; s.V["lastB"] = b; s.V["lastNote"] = note;
            let round = CS.int(s.V["round"]) + 1;
            s.V["round"] = round;
            s.V["cover"] = [ "", "" ];
            s.V["coverFlag"] = [ 0, 0 ];

            this.Say(s, "第 " + round + " 启简 · 甲" + YiJuanGame.CardLabel(a, YiJuanGame.RoleSet(s)) + " / 乙" + YiJuanGame.CardLabel(b, YiJuanGame.RoleSet(s)) + " · " + note);
            if (pull > 0 && Math.abs(line - mid) >= 2) this.MarkFeat(s, "yijuan_center");
            if (line == n - 1 && ca < cb) this.MarkFeat(s, "yijuan_comeback");
            if (line == 0 && ca > cb) this.MarkFeat(s, "yijuan_comeback");

            s.Turn = round % 2;
            s.MoveNo++;
            s.PhaseName = "第 " + (round + 1) + " 巡 · 候覆简 · 界墨 " + line + "/" + (n - 1);

            if (line >= n - 1) { this.Finish(s, 0, "界墨抵乙卷端 · 甲执卷"); return MoveResult.Good(); }
            if (line <= 0) { this.Finish(s, 1, "界墨抵甲卷端 · 乙执卷"); return MoveResult.Good(); }
            if (!s.Hands.ContainsKey(0) || s.Hands[0].length == 0 ||
                !s.Hands.ContainsKey(1) || s.Hands[1].length == 0)
                this.FinishByCards(s);
            return MoveResult.Good();
        }

        FinishByCards(s)
        {
            let line = this.Line(s), mid = this.Mid(s);
            let ink = this.Ink(s);
            let inkFirst = this.OptI(s, "endRule", 0) == 1;
            let w = -1; let why = "简尽";
            if (!inkFirst)
            {
                if (line > mid) { w = 0; why = "简尽 · 墨偏乙端，甲近者胜"; }
                else if (line < mid) { w = 1; why = "简尽 · 墨偏甲端，乙近者胜"; }
            }
            if (w < 0 && ink[0] != ink[1])
            { w = ink[0] > ink[1] ? 0 : 1; why = "简尽 · 余墨多者胜"; }
            if (w < 0 && line != mid)
            { w = line > mid ? 0 : 1; why = "简尽 · 墨偏定次"; }
            if (w < 0)
            {
                let ta = 0, tb = 0;
                for (let c of this.Discard(s, 0)) ta += YiJuanGame.CY(c);
                for (let c of this.Discard(s, 1)) tb += YiJuanGame.CY(c);
                if (ta != tb) { w = ta > tb ? 0 : 1; why = "简尽 · 弃简年序和定次"; }
            }
            if (w < 0) { w = this.NextRng(s, 2); why = "简尽 · 全同，种子定执卷"; }
            this.Finish(s, w, why);
        }

        Info(s, seat)
        {
            let d = [];
            d["line"] = this.Line(s); d["lineN"] = this.LineN(s); d["mid"] = this.Mid(s);
            d["round"] = s.V.ContainsKey("round") ? s.V["round"] : 0;
            let flag = s.V["coverFlag"];
            d["covered"] = flag == null ? [ 0, 0 ] : flag.Clone();
            let cov = this.Cover(s);
            d["myCover"] = (seat >= 0 && seat <= 1) ? cov[seat] : "";
            d["ink"] = this.Ink(s).Clone();
            d["pick"] = this.Pick(s).Clone();
            d["lastA"] = s.V.ContainsKey("lastA") ? s.V["lastA"] : "";
            d["lastB"] = s.V.ContainsKey("lastB") ? s.V["lastB"] : "";
            d["lastNote"] = s.V.ContainsKey("lastNote") ? s.V["lastNote"] : "";
            let pub = this.OptB(s, "discardPublic", true);
            d["discardA"] = YiJuanGame.Copy(this.PubDiscard(s, 0));
            d["discardB"] = pub ? YiJuanGame.Copy(this.PubDiscard(s, 1)) : CS.newArr(0, "");
            if (seat == 0 || seat == 1)
            {
                d["myDiscard"] = YiJuanGame.Copy(this.Discard(s, seat));
                d["oppDiscard"] = pub ? YiJuanGame.Copy(this.PubDiscard(s, 1 - seat)) : CS.newArr(0, "");
                d["mySeat"] = seat;
            }
            else
            {
                d["myDiscard"] = CS.newArr(0, "");
                d["oppDiscard"] = CS.newArr(0, "");
            }
            let rs = YiJuanGame.RoleSet(s);
            d["roleSet"] = rs;
            d["roleNames"] = YiJuanGame.ROLE_SETS[rs].Clone();
            return d;
        }

        BotPick(s, seat, level, legal)
        {
            let covers = legal.Where(c => c.StartsWith("c:")).ToList();
            let picks = legal.Where(c => c.StartsWith("r:")).ToList();
            let lv = Math.max(0, Math.min(6, level));
            let cost = this.OptI(s, "pickCost", 2);
            let ink = this.Ink(s), pick = this.Pick(s);
            let mine = this.Discard(s, seat);

            if (lv >= 4 && picks.length > 0 && ink[seat] >= cost && pick[seat] > 0 && this.Line(s) != this.Mid(s))
            {
                let best = -1;
                for (let i = 0; i < mine.length; i++) if (YiJuanGame.CY(mine[i]) >= 5) best = i;
                if (best >= 0 && this.NextRng(s, 3) == 0) return "r:" + best;
            }
            if (covers.length == 0) return "";
            if (lv <= 1) return covers[this.NextRng(s, covers.length)];

            let hand = s.Hands.ContainsKey(seat) ? s.Hands[seat] : [];
            let year = c => { let i; return CS.tp(CS.substr(c, 2), _v => i = _v) && i >= 0 && i < hand.length ? YiJuanGame.CY(hand[i]) : 0; };
            let inkOf = c => { let i; return CS.tp(CS.substr(c, 2), _v => i = _v) && i >= 0 && i < hand.length ? YiJuanGame.CM(hand[i]) : 0; };

            if (lv <= 3)
            {
                let best = covers[0];
                for (let c of covers) if (year(c) > year(best)) best = c;
                return best;
            }

            let myTotal = CS.newArr(7, 0);
            for (let c of hand) myTotal[YiJuanGame.CY(c)]++;
            for (let c of this.Discard(s, seat)) myTotal[YiJuanGame.CY(c)]++;
            let oppTotal = CS.newArr(7, 0);
            for (let y = 1; y <= 6; y++) oppTotal[y] = 4 - myTotal[y];
            let oppDisc = this.pubFor(s, seat);
            for (let c of oppDisc) if (YiJuanGame.CY(c) >= 1 && YiJuanGame.CY(c) <= 6) oppTotal[YiJuanGame.CY(c)]--;
            let rem = [];
            for (let y = 1; y <= 6; y++) for (let t = 0; t < Math.max(0, oppTotal[y]); t++) rem.Add(y);
            let est = rem.length > 0 ? rem[rem.length / 2] : 3;

            let win = covers.Where(c => year(c) > est).ToList();
            let pool2 = win.length > 0 ? win : covers;
            let pickCode = pool2[0];
            for (let c of pool2)
                if (year(c) < year(pickCode) || (year(c) == year(pickCode) && inkOf(c) > inkOf(pickCode)))
                    pickCode = c;
            return pickCode;
        }

        pubFor(s, seat)
        {
            return this.OptB(s, "discardPublic", true) ? this.PubDiscard(s, 1 - seat) : CS.newArr(0, "");
        }

        BotLine(s, seat)
        {
            let lines = [ "此简且覆，静待启卷。", "界墨已偏，须早谋。", "弃简可推余牌，莫急。", "卷端相近，且看这一手。" ];
            return lines[this.NextRng(s, lines.length)];
        }
    }


// ===== OriginalGame.cs =====
    class PeakGame extends RuleBase
    {
        get Id() { return "diefeng"; }
        get MinSeats() { return 2; }
        get MaxSeats() { return 2; }
        get Variants() { return [ "经典", "危峰", "广厦" ]; }

        static Height(c) { return c == null ? 0 : c.length; }
        static Top(c) { return c != null && c.length > 0 ? CS.substr(c, c.length - 1, 1) : ""; }
        static Root(c) { return c != null && c.length > 0 ? CS.substr(c, 0, 1) : ""; }
        static Me(seat) { return seat == 0 ? "r" : "b"; }

        PeakOf(s) { return this.OptI(s, "peak", 3); }
        TargetOf(s) { return this.OptI(s, "target", 3); }
        MoveOn(s) { return this.OptB(s, "allowMove", true); }
        LoneDouble(s) { return this.OptB(s, "loneDouble", true); }

        static Arr(s, k)
        {
            let o; return CS.tg(s.V, k, _v => o = _v).ok ? o : null;
        }
        Build(variant, seats, seed, room)
        {
            let s = new GameState();
            let n = this.O("boardN", variant == "广厦" ? 7 : 5);
            if (n < 4) n = 4; if (n > 9) n = 9;
            let peak = this.O("peak", variant == "危峰" ? 4 : 3);
            let target = this.O("target", variant == "危峰" ? 2 : variant == "广厦" ? 4 : 3);
            let stones = this.O("stones", variant == "广厦" ? 18 : 12);
            let quota = this.O("moveQuota", 4);
            this.SetGrid(s, n, n);
            s.Seats = 2; s.Turn = 0;
            s.V["peak"] = peak;
            s.V["target"] = target;
            s.V["score"] = [ 0, 0 ];
            s.V["left"] = [ stones, stones ];
            s.V["moves"] = [ quota, quota ];
            s.Phase = "playing";
            this.Phase(s);
            this.Say(s, "落石可叠任意一格；石满 " + peak + " 层的峰，按四邻石柱的根色多数定归属，未必归堆峰的人");
            return s;
        }

        CanDrop(s, i) { return PeakGame.Height(this.Cell(s, i)) < this.PeakOf(s); }
        static NB = [
            [1,0], [-1,0], [0,1], [0,-1]
        ];
        Neighbors(s, i)
        {
            let r = [];
            let x = this.X(s, i), y = this.Y(s, i);
            for (let k = 0; k < PeakGame.NB.length; k++)
                if (this.Inside(s, x + PeakGame.NB[k][0], y + PeakGame.NB[k][1])) r.Add(this.At(s, x + PeakGame.NB[k][0], y + PeakGame.NB[k][1]));
            return r;
        }
        HasMove(s, seat)
        {
            let me = PeakGame.Me(seat);
            for (let i = 0; i < s.Cells.length; i++)
            {
                if (PeakGame.Top(this.Cell(s, i)) != me) continue;
                let nb = this.Neighbors(s, i);
                for (let k = 0; k < nb.length; k++) if (this.CanDrop(s, nb[k])) return true;
            }
            return false;
        }

        Legal(s, seat)
        {
            let r = [];
            if (s.Ended || s.Turn != seat) return r;
            let left = PeakGame.Arr(s, "left") || [ 0, 0 ];
            let mv = PeakGame.Arr(s, "moves") || [ 0, 0 ];
            if (left[seat] > 0)
                for (let i = 0; i < s.Cells.length; i++) if (this.CanDrop(s, i)) r.Add("p:" + i);
            if (this.MoveOn(s) && mv[seat] > 0)
            {
                let me = PeakGame.Me(seat);
                for (let i = 0; i < s.Cells.length; i++)
                {
                    if (PeakGame.Top(this.Cell(s, i)) != me) continue;
                    let nb = this.Neighbors(s, i);
                    for (let k = 0; k < nb.length; k++)
                        if (this.CanDrop(s, nb[k])) r.Add("m:" + i + ">" + nb[k]);
                }
            }
            if (r.length == 0) r.Add("pass");
            return r;
        }

        AllSpent(s)
        {
            let left = PeakGame.Arr(s, "left") || [ 0, 0 ];
            let mv = PeakGame.Arr(s, "moves") || [ 0, 0 ];
            for (let seat = 0; seat < 2; seat++)
            {
                if (left[seat] > 0) return false;
                if (this.MoveOn(s) && mv[seat] > 0 && this.HasMove(s, seat)) return false;
            }
            return true;
        }

        Phase(s)
        {
            let sc = PeakGame.Arr(s, "score") || [ 0, 0 ];
            let left = PeakGame.Arr(s, "left") || [ 0, 0 ];
            s.PhaseName = "朱 " + sc[0] + " : " + sc[1] + " 墨 · 先得 " + this.TargetOf(s) +
                " 峰 · 余石 " + left[0] + "/" + left[1];
        }

        ResolvePeak(s, at, actor)
        {
            let sc = PeakGame.Arr(s, "score") || [ 0, 0 ];
            let nb = this.Neighbors(s, at);
            let a = 0, b = 0;
            for (let k = 0; k < nb.length; k++)
            {
                let root = PeakGame.Root(this.Cell(s, nb[k]));
                if (root == "r") a++;
                else if (root == "b") b++;
            }
            let winner = -1, gain = 0;
            if (a > b && a >= 2) { winner = 0; gain = (a >= 4 && this.LoneDouble(s)) ? 2 : 1; }
            else if (b > a && b >= 2) { winner = 1; gain = (b >= 4 && this.LoneDouble(s)) ? 2 : 1; }
            s.Cells[at] = "";
            if (winner < 0) { this.Say(s, "峰成而四邻根色均势，散石不计"); return; }
            sc[winner] += gain;
            s.V["score"] = sc;
            let nm = winner == 0 ? "朱" : "墨";
            this.Say(s, "成峰归 " + nm + " · " + (gain == 2 ? "独峰加二" : "得一"));
            if (winner != actor) this.MarkFeat(s, "borrowed_peak");
            if (gain == 2) this.MarkFeat(s, "lone_peak");
            if (sc[winner] >= this.TargetOf(s))
                this.Finish(s, winner, nm + " 先得 " + this.TargetOf(s) + " 峰 · 全局终");
        }

        Act(s, seat, action, d)
        {
            let code = J.Str(d, "code", "");
            if (code == "pass")
            {
                if (this.AllSpent(s))
                {
                    let sc = PeakGame.Arr(s, "score") || [ 0, 0 ];
                    if (sc[0] == sc[1]) this.Finish(s, -1, "石尽 · 朱墨平分秋色");
                    else this.Finish(s, sc[0] > sc[1] ? 0 : 1, "石尽 · 峰多者胜");
                }
                else this.Next(s, -1);
                this.Phase(s);
                return MoveResult.Good();
            }
            let left = PeakGame.Arr(s, "left") || [ 0, 0 ];
            let mv = PeakGame.Arr(s, "moves") || [ 0, 0 ];
            let me = PeakGame.Me(seat);
            let at = -1;
            if (code.StartsWith("p:"))
            {
                let i;
                if (!CS.tp(CS.substr(code, 2), _v => i = _v) || i < 0 || i >= s.Cells.length || !this.CanDrop(s, i))
                    return MoveResult.Fail("此处不能再叠石");
                if (left[seat] <= 0) return MoveResult.Fail("手中石已尽");
                left[seat]--; s.V["left"] = left;
                s.Cells[i] = this.Cell(s, i) + me;
                at = i;
            }
            else if (code.StartsWith("m:"))
            {
                let q = CS.substr(code, 2).Split('>');
                let i, j;
                if (q.length < 2 || !CS.tp(q[0], _v => i = _v) || !CS.tp(q[1], _v => j = _v) ||
                    i < 0 || i >= s.Cells.length || j < 0 || j >= s.Cells.length)
                    return MoveResult.Fail("移石位置不对");
                if (!this.MoveOn(s) || mv[seat] <= 0) return MoveResult.Fail("本房不许移石，或次数已尽");
                if (PeakGame.Top(this.Cell(s, i)) != me) return MoveResult.Fail("只能挪自己的顶石");
                if (!this.Neighbors(s, i).Contains(j) || !this.CanDrop(s, j)) return MoveResult.Fail("只可挪到相邻且未满的格");
                mv[seat]--; s.V["moves"] = mv;
                let col = this.Cell(s, i);
                s.Cells[i] = col.length > 1 ? CS.substr(col, 0, col.length - 1) : "";
                s.Cells[j] = this.Cell(s, j) + me;
                at = j;
            }
            else return MoveResult.Fail("未知动作");

            s.Last = code;
            if (at >= 0 && PeakGame.Height(this.Cell(s, at)) >= this.PeakOf(s)) this.ResolvePeak(s, at, seat);
            if (!s.Ended) this.Next(s, -1);
            this.Phase(s);
            return MoveResult.Good();
        }

        Info(s, seat)
        {
            let d = this.InfoBase(s, seat);
            let sc = PeakGame.Arr(s, "score") || [ 0, 0 ];
            let left = PeakGame.Arr(s, "left") || [ 0, 0 ];
            let mv = PeakGame.Arr(s, "moves") || [ 0, 0 ];
            let sd = (seat >= 0 && seat < left.length) ? seat : 0;
            d["score"] = sc;
            d["left"] = left;
            d["moves"] = mv;
            d["note"] = "石满 " + this.PeakOf(s) + " 层成峰，四邻根色多者得分；余石 " + left[sd] + " · 挪石 " + mv[sd] + " 次";
            return d;
        }
    }


/* ===== 与 server/Rules/RuleRegistry.cs 一一对应的 60 局 ===== */
const MAP = {};
const ORDER = [];
function Add(r) { MAP[r.Id] = r; ORDER.push(r.Id); }

Add(new XiangqiGame());
Add(new DarkGame('jieqi'));
Add(new DarkGame('xiangqidark'));
Add(new DarkGame('junqi'));
Add(new DarkGame('doushou'));
Add(new ChessGame('chess'));
Add(new ChessGame('chess960'));
Add(new ShogiGame());
Add(new GoGame());
Add(new LineGame('gomoku'));
Add(new LineGame('renju'));
Add(new LineGame('connect6'));
Add(new LineGame('connect4'));
Add(new LineGame('tictactoe'));
Add(new OthelloGame());
Add(new CheckersGame());
Add(new HexJumpGame());
Add(new MillsGame());
Add(new TrickGame('doudizhu'));
Add(new TrickGame('doudizhu2'));
Add(new TrickGame('laizi'));
Add(new TrickGame('guandan'));
Add(new TrickGame('shengji'));
Add(new TrickGame('paodekuai'));
Add(new TrickGame('gongzhu'));
Add(new TrickGame('hongshi'));
Add(new ShowdownGame('shisanszhang'));
Add(new UnoGame());
Add(new BridgeGame());
Add(new MahjongGame());
Add(new FlightGame());
Add(new MonopolyGame());
Add(new WerewolfGame());
Add(new UndercoverGame());
Add(new Point24Game());
Add(new SolitaireGame());
Add(new ExtraGame('dots'));
Add(new ExtraGame('hex'));
Add(new ExtraGame('nim'));
Add(new ExtraGame('endgame'));
Add(new ExtraGame('junqi4'));
Add(new ExtraGame('gouji'));
Add(new ExtraGame('baohuang'));
Add(new ExtraGame('chudadi'));
Add(new ExtraGame('shuangkou'));
Add(new ExtraGame('avalon'));
Add(new ExtraGame('turtlesoup'));
Add(new ExtraGame('mastermind'));
Add(new ExtraGame('drawguess'));
Add(new DirectorGame());
Add(new PeakGame());
Add(new TournamentGame());
Add(new YiJuanGame());
Add(new OrigSevenGame('houlou'));
Add(new OrigSevenGame('duzhou'));
Add(new OrigSevenGame('dengying'));
Add(new OrigSevenGame('huiwen'));
Add(new OrigSevenGame('cuojin'));
Add(new OrigSevenGame('shiyi'));
Add(new OrigSevenGame('tingyu'));

export const RuleRegistry = {
  Get: id => MAP[id] || null,
  get Ids() { return ORDER.slice(); },
  get Count() { return ORDER.length; },
  get Fallback() { return MAP['xiangqi']; }
};
export { MAP as RULES };
