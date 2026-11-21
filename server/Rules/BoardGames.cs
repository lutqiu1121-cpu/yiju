using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Qipai
{
    internal static class Cfg
    {

        public static int I(string s)
        {
            if (string.IsNullOrEmpty(s)) return -1;
            int k = 0;
            while (k < s.Length && s[k] >= '0' && s[k] <= '9') k++;
            if (k == 0) return -1;
            int n;
            return int.TryParse(s.Substring(0, k), out n) ? n : -1;
        }
        public static string Rest(string code) { int i = code.IndexOf(':'); return i < 0 ? "" : code.Substring(i + 1); }
        public static string Act(string code) { int i = code.IndexOf(':'); return i < 0 ? code : code.Substring(0, i); }
    }

    public sealed class LineGame : RuleBase
    {
        private readonly string _id;
        public LineGame(string id) { _id = id; }
        public override string Id { get { return _id; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 2; } }
        public override string[] Variants
        {
            get
            {
                if (_id == "gomoku") return new string[] { "15路", "无禁手" };
                if (_id == "renju") return new string[] { "Renju 禁手" };
                if (_id == "connect6") return new string[] { "19路" };
                if (_id == "connect4") return new string[] { "7×6" };
                return new string[] { "3路", "4路" };
            }
        }
        private int Win(GameState s)
        {
            if (_id == "connect4") return 4;
            if (_id == "connect6") return 6;
            if (_id == "tictactoe") return Cfg.I(s.Variant) == 4 ? 4 : 3;
            return 5;
        }
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            int w = _id == "connect4" ? 7 : _id == "connect6" ? 19 : _id == "tictactoe" ? (Cfg.I(variant) == 4 ? 4 : 3) : 15;
            int h = _id == "connect4" ? 6 : _id == "connect6" ? 19 : _id == "tictactoe" ? w : 15;
            int bn = O("boardN", 0);
            if (bn >= 3 && bn <= 15 && _id != "connect4" && _id != "connect6") { w = bn; h = bn; }
            SetGrid(s, w, h);
            s.V["pending"] = -1;
            return s;
        }
        private bool Gravity(GameState s) { return _id == "connect4" && OptB(s, "gravity", true); }
        private bool TwoPerMove(GameState s) { return _id == "connect6"; }

        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat) return r;
            if (Gravity(s))
            {
                for (int x = 0; x < s.Width; x++)
                    for (int y = s.Height - 1; y >= 0; y--)
                    {
                        int i = At(s, x, y);
                        if (Cell(s, i) == "") { r.Add("c:" + i); break; }
                    }
                return r;
            }
            for (int i = 0; i < s.Cells.Length; i++)
                if (Cell(s, i) == "") r.Add("c:" + i);
            return r;
        }

        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            if (action != "c") return MoveResult.Fail("未知动作");
            int i = Cfg.I(Cfg.Rest(Convert.ToString(d["code"])));
            if (i < 0 || i >= s.Cells.Length || Cell(s, i) != "") return MoveResult.Fail("该位置不可落子");
            string p = SideChar(seat);
            s.Cells[i] = p;
            s.Last = "c:" + i;

            bool five = CheckWin(s, i, seat);
            if (_id == "renju" && seat == 0 && RenjuForbidden(s, i, five))
            { Finish(s, 1, "黑棋禁手（三三 / 四四 / 长连）负"); return MoveResult.Good("禁手"); }
            if (five) { Finish(s, seat, (seat == 0 ? "红" : "蓝") + "连成 " + Win(s) + " 子，胜"); return MoveResult.Good("胜"); }
            bool full = true; for (int k = 0; k < s.Cells.Length; k++) if (Cell(s, k) == "") { full = false; break; }
            if (full) { Finish(s, -1, "棋盘落满，和棋"); return MoveResult.Good("和棋"); }
            if (TwoPerMove(s))
            {
                int pend = IntV(s, "pending", -1);
                if (s.MoveNo == 0) { Next(s, -1); return MoveResult.Good("首手一子"); }
                if (pend < 0) { s.V["pending"] = i; Say(s, "六子棋：第一子已落，请落第二子"); return MoveResult.Good("待第二子"); }
                s.V["pending"] = -1;
                Say(s, "六子棋：第二子已落");
            }
            Next(s, -1);
            return MoveResult.Good();
        }

        private bool CheckWin(GameState s, int i, int seat)
        {
            string p = Cell(s, i);
            int x = X(s, i), y = Y(s, i);
            for (int k = 0; k < DIRS.Length; k++)
            {
                int n = Line(s, x, y, DIRS[k][0], DIRS[k][1], p);

                if (_id == "renju" && seat == 0) { if (n == 5) return true; }
                else if (n >= Win(s)) return true;
            }
            return false;
        }

        private string DirLine(GameState s, int i, int dx, int dy, char me)
        {
            System.Text.StringBuilder sb = new System.Text.StringBuilder();
            int x = X(s, i), y = Y(s, i);
            for (int k = -5; k <= 5; k++)
            {
                int nx = x + dx * k, ny = y + dy * k;
                if (!Inside(s, nx, ny)) { sb.Append('#'); continue; }
                string c = Cell(s, At(s, nx, ny));
                sb.Append(c.Length == 0 ? '.' : (c[0] == me ? 'x' : 'o'));
            }
            return sb.ToString();
        }
        private static int RunAt(string t, int p)
        {
            if (p < 0 || p >= t.Length || t[p] != 'x') return 0;
            int a = p, b = p;
            while (a > 0 && t[a - 1] == 'x') a--;
            while (b + 1 < t.Length && t[b + 1] == 'x') b++;
            return b - a + 1;
        }

        private static int FivePoints(string t)
        {
            int n = 0;
            for (int q = 0; q < t.Length; q++)
            {
                if (t[q] != '.') continue;
                char[] a = t.ToCharArray(); a[q] = 'x';
                if (RunAt(new string(a), q) == 5) n++;
            }
            return n;
        }

        private static bool OpenThree(string t)
        {
            for (int q = 0; q < t.Length; q++)
            {
                if (t[q] != '.') continue;
                char[] a = t.ToCharArray(); a[q] = 'x';
                string u = new string(a);
                int run = RunAt(u, q);
                if (run >= 5) continue;
                if (FivePoints(u) >= 2) return true;
            }
            return false;
        }

        private bool RenjuForbidden(GameState s, int i, bool five)
        {
            if (five) return false;
            if (!OptB(s, "forbidden", _id == "renju")) return false;
            int fours = 0, threes = 0; bool overline = false;
            for (int k = 0; k < DIRS.Length; k++)
            {
                string t = DirLine(s, i, DIRS[k][0], DIRS[k][1], 'r');
                if (RunAt(t, 5) >= 6) overline = true;
                if (FivePoints(t) >= 1) fours++;
                if (OpenThree(t)) threes++;
            }
            if (overline && OptB(s, "overline", true)) return true;
            return fours >= 2 || threes >= 2;
        }
    }

    public sealed class OthelloGame : RuleBase
    {
        public override string Id { get { return "othello"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 2; } }
        public override string[] Variants { get { return new string[] { "8路" }; } }
        private static readonly int[][] D8 = new int[][] {
            new int[]{1,0},new int[]{-1,0},new int[]{0,1},new int[]{0,-1},
            new int[]{1,1},new int[]{1,-1},new int[]{-1,1},new int[]{-1,-1}
        };
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState(); SetGrid(s, 8, 8);
            s.Cells[At(s, 3, 3)] = "b"; s.Cells[At(s, 4, 4)] = "b";
            s.Cells[At(s, 3, 4)] = "r"; s.Cells[At(s, 4, 3)] = "r";
            s.V["passes"] = 0;
            return s;
        }
        private List<int> Flips(GameState s, int i, int seat)
        {
            string me = SideChar(seat), op = SideChar(1 - seat);
            List<int> res = new List<int>();
            if (Cell(s, i) != "") return res;
            int x = X(s, i), y = Y(s, i);
            for (int k = 0; k < D8.Length; k++)
            {
                List<int> line = new List<int>();
                int cx = x + D8[k][0], cy = y + D8[k][1];
                while (Inside(s, cx, cy) && Cell(s, At(s, cx, cy)) == op) { line.Add(At(s, cx, cy)); cx += D8[k][0]; cy += D8[k][1]; }
                if (line.Count > 0 && Inside(s, cx, cy) && Cell(s, At(s, cx, cy)) == me) res.AddRange(line);
            }
            return res;
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat) return r;
            for (int i = 0; i < s.Cells.Length; i++) if (Flips(s, i, seat).Count > 0) r.Add("c:" + i);
            if (r.Count == 0) r.Add("pass");
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            if (action == "pass")
            {
                int passes = IntV(s, "passes", 0) + 1;
                s.V["passes"] = passes;
                if (passes >= 2) { Score(s); return MoveResult.Good("双方无子可下"); }
                Say(s, (seat == 0 ? "红" : "蓝") + "跳过一手");
                Next(s, -1); return MoveResult.Good();
            }
            if (action != "c") return MoveResult.Fail("未知动作");
            int i = Cfg.I(Cfg.Rest(Convert.ToString(d["code"])));
            List<int> f = Flips(s, i, seat);
            if (f.Count == 0) return MoveResult.Fail("此处不能翻子");
            s.V["passes"] = 0;
            s.Cells[i] = SideChar(seat); s.Last = "c:" + i;
            for (int k = 0; k < f.Count; k++) s.Cells[f[k]] = SideChar(seat);
            bool empty = false; for (int k = 0; k < s.Cells.Length; k++) if (Cell(s, k) == "") { empty = true; break; }
            if (!empty) { Score(s); return MoveResult.Good(); }
            Next(s, -1); return MoveResult.Good();
        }
        private void Score(GameState s)
        {
            int a = 0, b = 0;
            for (int i = 0; i < s.Cells.Length; i++) { if (Cell(s, i) == "r") a++; else if (Cell(s, i) == "b") b++; }
            Finish(s, a == b ? -1 : (a > b ? 0 : 1), "终局 " + a + " : " + b + (a == b ? "，和棋" : ""));
        }
    }

    public sealed class CheckersGame : RuleBase
    {
        public override string Id { get { return "checkers"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 2; } }
        public override string[] Variants { get { return new string[] { "8路", "10路" }; } }
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            int n = OS("variantRule", "english") == "international" ? 10 : (Cfg.I(variant) == 10 ? 10 : 8);
            SetGrid(s, n, n);
            int rows = n == 8 ? 3 : 4;
            for (int y = 0; y < rows; y++)
                for (int x = 0; x < n; x++)
                    if ((x + y) % 2 == 1) s.Cells[At(s, x, y)] = "b";
            for (int y = n - rows; y < n; y++)
                for (int x = 0; x < n; x++)
                    if ((x + y) % 2 == 1) s.Cells[At(s, x, y)] = "r";
            s.V["jump"] = -1;
            return s;
        }
        private bool King(string c) { return c.Length > 1 && c[1] == 'K'; }
        private int Dir(int seat) { return seat == 0 ? -1 : 1; }
        private List<string> MovesFrom(GameState s, int i, int seat, bool capturesOnly)
        {
            List<string> r = new List<string>();
            string c = Cell(s, i);
            if (SideOf(c) != seat) return r;
            int x = X(s, i), y = Y(s, i), dy = Dir(seat);
            int[][] ds = King(c) ? new int[][] { new int[] { 1, 1 }, new int[] { 1, -1 }, new int[] { -1, 1 }, new int[] { -1, -1 } }
                                 : new int[][] { new int[] { 1, dy }, new int[] { -1, dy } };

            for (int k = 0; k < ds.Length; k++)
            {
                int mx = x + ds[k][0], my = y + ds[k][1], tx = x + 2 * ds[k][0], ty = y + 2 * ds[k][1];
                if (!Inside(s, tx, ty)) continue;
                if (SideOf(Cell(s, At(s, mx, my))) == 1 - seat && Cell(s, At(s, tx, ty)) == "") r.Add("m:" + i + ">" + At(s, tx, ty));
            }
            if (capturesOnly || r.Count > 0) return r;
            for (int k = 0; k < ds.Length; k++)
            {
                int nx = x + ds[k][0], ny = y + ds[k][1];
                if (Inside(s, nx, ny) && Cell(s, At(s, nx, ny)) == "") r.Add("m:" + i + ">" + At(s, nx, ny));
            }
            return r;
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat) return r;
            int jump = IntV(s, "jump", -1);
            if (jump >= 0) return MovesFrom(s, jump, seat, true);
            for (int i = 0; i < s.Cells.Length; i++) r.AddRange(MovesFrom(s, i, seat, true));
            if (r.Count > 0 && OptB(s, "maxCapture", true)) return r;
            for (int i = 0; i < s.Cells.Length; i++) r.AddRange(MovesFrom(s, i, seat, false));
            if (r.Count == 0) r.Add("pass");
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            if (action == "pass") { Finish(s, 1 - seat, "无子可动，负"); return MoveResult.Good(); }
            if (action != "m") return MoveResult.Fail("未知动作");
            int[] ij = ParsePair(Cfg.Rest(Convert.ToString(d["code"])), '>');
            int from = ij[0], to = ij[1];
            List<string> legal = Legal(s, seat);
            if (!legal.Contains("m:" + from + ">" + to)) return MoveResult.Fail("非法走法");
            string piece = Cell(s, from);
            int fx = X(s, from), fy = Y(s, from), tx = X(s, to), ty = Y(s, to);
            bool cap = Math.Abs(tx - fx) == 2;
            if (cap) s.Cells[At(s, (fx + tx) / 2, (fy + ty) / 2)] = "";
            s.Cells[from] = ""; s.Cells[to] = piece; s.Last = "m:" + from + ">" + to;
            bool crowned = (seat == 0 && ty == 0) || (seat == 1 && ty == s.Height - 1);
            if (crowned) s.Cells[to] = SideChar(seat) + "K";
            int opponent = 0;
            for (int i = 0; i < s.Cells.Length; i++) if (SideOf(Cell(s, i)) == 1 - seat) opponent++;
            if (opponent == 0) { Finish(s, seat, "吃光对方，胜"); return MoveResult.Good(); }

            if (cap && !(crowned && OptS(s, "variantRule", "english") != "international"))
            {
                List<string> more = MovesFrom(s, to, seat, true);
                if (more.Count > 0) { s.V["jump"] = to; Say(s, "连跳中"); return MoveResult.Good("连跳"); }
            }
            s.V["jump"] = -1;
            Next(s, -1); return MoveResult.Good();
        }
    }

    public sealed class GoGame : RuleBase
    {
        public override string Id { get { return "go"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 2; } }
        public override string[] Variants { get { return new string[] { "9路", "13路", "19路", "让2子" }; } }
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            int n = Cfg.I(variant); if (n <= 0) n = 19;
            SetGrid(s, n, n);
            s.V["ko"] = -1; s.V["passes"] = 0; s.V["cap0"] = 0; s.V["cap1"] = 0;
            if (variant == "让2子")
            {
                int a = At(s, 3, 3), b = At(s, n - 4, n - 4);
                s.Cells[a] = "r"; s.Cells[b] = "r";
                s.V["handicap"] = 2;
            }
            return s;
        }
        private List<int> Neighbors(GameState s, int i)
        {
            List<int> r = new List<int>();
            int x = X(s, i), y = Y(s, i);
            if (x > 0) r.Add(i - 1);
            if (x + 1 < s.Width) r.Add(i + 1);
            if (y > 0) r.Add(i - s.Width);
            if (y + 1 < s.Height) r.Add(i + s.Width);
            return r;
        }
        private void Group(GameState s, int i, string color, List<int> stones, List<int> libs)
        {
            Stack<int> st = new Stack<int>(); st.Push(i);
            HashSet<int> seen = new HashSet<int>(); seen.Add(i);
            HashSet<int> lib = new HashSet<int>();
            while (st.Count > 0)
            {
                int p = st.Pop(); stones.Add(p);
                List<int> nb = Neighbors(s, p);
                for (int k = 0; k < nb.Count; k++)
                {
                    int q = nb[k]; string c = Cell(s, q);
                    if (c == "") lib.Add(q);
                    else if (c == color && !seen.Contains(q)) { seen.Add(q); st.Push(q); }
                }
            }
            libs.AddRange(lib);
        }
        private bool Suicide(GameState s, int i, int seat)
        {
            string me = SideChar(seat), op = SideChar(1 - seat);
            s.Cells[i] = me;
            bool captured = false;
            List<int> nb = Neighbors(s, i);
            for (int k = 0; k < nb.Count; k++)
            {
                if (Cell(s, nb[k]) != op) continue;
                List<int> st = new List<int>(), lb = new List<int>();
                Group(s, nb[k], op, st, lb);
                if (lb.Count == 0) { captured = true; break; }
            }
            if (!captured)
            {
                List<int> st2 = new List<int>(), lb2 = new List<int>();
                Group(s, i, me, st2, lb2);
                if (lb2.Count == 0) { s.Cells[i] = ""; return true; }
            }
            s.Cells[i] = "";
            return false;
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended) return r;
            if (StrV(s, "stage", "") == "scoring")
            {
                bool[] ok = s.V.ContainsKey("_confirm") ? s.V["_confirm"] as bool[] : new bool[2];
                if (seat >= 0 && seat < ok.Length && !ok[seat]) r.Add("score:ok");
                return r;
            }
            if (s.Turn != seat) return r;
            int ko = IntV(s, "ko", -1);
            for (int i = 0; i < s.Cells.Length; i++)
            {
                if (Cell(s, i) != "" || i == ko) continue;
                if (!Suicide(s, i, seat)) r.Add("c:" + i);
            }
            r.Add("pass");
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            if (action == "score")
            {
                bool[] ok = s.V.ContainsKey("_confirm") ? s.V["_confirm"] as bool[] : new bool[2];
                if (seat < 0 || seat >= ok.Length) return MoveResult.Fail("只有对局双方能确认死活");
                ok[seat] = true; s.V["_confirm"] = ok;
                Say(s, (seat == 0 ? "黑" : "白") + "确认死活方案");
                if (ok[0] && ok[1]) Count(s);
                return MoveResult.Good("已确认");
            }
            if (action == "pass")
            {
                int p = IntV(s, "passes", 0) + 1; s.V["passes"] = p;
                if (p >= 2)
                {
                    if (OptB(s, "deadConfirm", true))
                    {
                        s.V["stage"] = "scoring"; s.V["_confirm"] = new bool[2];
                        s.PhaseName = "死活确认 · 双方确认后数子";
                        s.V["_phase"] = "vote";
                        Say(s, "双方虚着，进入死活确认：请双方确认后再数子");
                    }
                    else Count(s);
                    return MoveResult.Good();
                }
                Say(s, (seat == 0 ? "黑" : "白") + "虚着");
                Next(s, -1); return MoveResult.Good();
            }
            if (action != "c") return MoveResult.Fail("未知动作");
            int i = Cfg.I(Cfg.Rest(Convert.ToString(d["code"])));
            if (!Legal(s, seat).Contains("c:" + i)) return MoveResult.Fail("禁着点 / 劫争 / 自杀");
            string me = SideChar(seat), op = SideChar(1 - seat);
            s.V["passes"] = 0;
            s.Cells[i] = me; s.Last = "c:" + i;
            int captured = 0, lastCap = -1;
            List<int> nb = Neighbors(s, i);
            for (int k = 0; k < nb.Count; k++)
            {
                if (Cell(s, nb[k]) != op) continue;
                List<int> st = new List<int>(), lb = new List<int>();
                Group(s, nb[k], op, st, lb);
                if (lb.Count == 0)
                {
                    for (int m = 0; m < st.Count; m++) { s.Cells[st[m]] = ""; captured++; lastCap = st[m]; }
                }
            }
            string capKey = seat == 0 ? "cap0" : "cap1";
            s.V[capKey] = IntV(s, capKey, 0) + captured;
            List<int> own = new List<int>(), ownLib = new List<int>();
            Group(s, i, me, own, ownLib);
            s.V["ko"] = (captured == 1 && own.Count == 1 && ownLib.Count == 1) ? lastCap : -1;
            Next(s, -1); return MoveResult.Good(captured > 0 ? "提 " + captured + " 子" : "");
        }

        private void Count(GameState s)
        {
            int a = 0, b = 0;
            HashSet<int> done = new HashSet<int>();
            for (int i = 0; i < s.Cells.Length; i++)
            {
                if (Cell(s, i) == "r") { a++; continue; }
                if (Cell(s, i) == "b") { b++; continue; }
                if (done.Contains(i)) continue;
                Stack<int> st = new Stack<int>(); st.Push(i); done.Add(i);
                int ra = 0, rb = 0, size = 0;
                while (st.Count > 0)
                {
                    int p = st.Pop(); size++;
                    List<int> nb = Neighbors(s, p);
                    for (int k = 0; k < nb.Count; k++)
                    {
                        int q = nb[k]; string c = Cell(s, q);
                        if (c == "r") ra++;
                        else if (c == "b") rb++;
                        else if (!done.Contains(q)) { done.Add(q); st.Push(q); }
                    }
                }
                if (ra > 0 && rb == 0) a += size;
                else if (rb > 0 && ra == 0) b += size;
            }
            int h = OptI(s, "handicap", IntV(s, "handicap", 0));
            string km = OptS(s, "komi", "3.5");
            string scoreMode = OptS(s, "scoring", "area");

            double komi;
            bool territory = scoreMode == "territory" || km == "6.5";
            if (territory) komi = 6.5;
            else if (km == "3.75") komi = 3.75;
            else if (km == "2.75") komi = 2.75;
            else komi = 3.5;
            if (h > 0) komi = 0;
            double diff = territory ? (a - b) : (a - b) / 2.0;

            bool draw = !territory && Math.Abs(diff - komi) < 0.001;
            int winner = diff > komi ? 0 : (draw ? -1 : 1);
            string rule = territory ? "日韩数目 6.5 目" : ("中国数子 贴 " + komi.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture) + " 子");
            Finish(s, winner, "终局 黑 " + a + " : 白 " + b + " · " + rule +
                (h > 0 ? " · 让 " + h + " 子" : "") + (draw ? "，和棋" : ""));
        }
    }

    public sealed class MillsGame : RuleBase
    {
        public override string Id { get { return "mills"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 2; } }
        public override string[] Variants { get { return new string[] { "成三" }; } }
        private readonly List<int[]> lines = new List<int[]>();
        private readonly List<int> points = new List<int>();
        private readonly List<int[]> adj = new List<int[]>();
        private void BuildGraph()
        {
            if (points.Count > 0) return;

            for (int r = 0; r < 3; r++)
            {
                int d = 3 - r;
                int[] xy = new int[] {
                    3-d,3-d, 3,3-d, 3+d,3-d, 3+d,3,
                    3+d,3+d, 3,3+d, 3-d,3+d, 3-d,3
                };
                for (int k = 0; k < 8; k++) points.Add(xy[k * 2 + 1] * 7 + xy[k * 2]);
                int b = r * 8;
                lines.Add(new int[] { points[b + 0], points[b + 1], points[b + 2] });
                lines.Add(new int[] { points[b + 2], points[b + 3], points[b + 4] });
                lines.Add(new int[] { points[b + 4], points[b + 5], points[b + 6] });
                lines.Add(new int[] { points[b + 6], points[b + 7], points[b + 0] });
            }
            for (int k = 1; k < 8; k += 2)
                lines.Add(new int[] { points[k], points[8 + k], points[16 + k] });
            for (int i = 0; i < points.Count; i++) adj.Add(new int[0]);
            for (int i = 0; i < lines.Count; i++)
                for (int k = 0; k < 2; k++)
                {
                    int a = points.IndexOf(lines[i][k]), b = points.IndexOf(lines[i][k + 1]);
                    List<int> la = new List<int>(adj[a]); if (!la.Contains(points[b])) la.Add(points[b]); adj[a] = la.ToArray();
                    List<int> lb = new List<int>(adj[b]); if (!lb.Contains(points[a])) lb.Add(points[a]); adj[b] = lb.ToArray();
                }
        }
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            BuildGraph();
            GameState s = new GameState(); SetGrid(s, 7, 7);
            s.V["left0"] = 9; s.V["left1"] = 9; s.V["placed0"] = 0; s.V["placed1"] = 0;
            return s;
        }
        private bool IsMill(GameState s, int i, string p)
        {
            for (int k = 0; k < lines.Count; k++)
            {
                int[] L = lines[k];
                if (L[0] != i && L[1] != i && L[2] != i) continue;
                if (Cell(s, L[0]) == p && Cell(s, L[1]) == p && Cell(s, L[2]) == p) return true;
            }
            return false;
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat) return r;
            string cap = StrV(s, "capture", "");
            if (cap == "yes")
            {
                string op = SideChar(1 - seat);
                for (int i = 0; i < points.Count; i++)
                {
                    int p = points[i];
                    if (Cell(s, p) != op) continue;
                    if (!IsMill(s, p, op) || OnlyMills(s, op)) r.Add("x:" + p);
                }
                return r;
            }
            if (IntV(s, "left" + seat, 0) > 0)
            {
                for (int i = 0; i < points.Count; i++) if (Cell(s, points[i]) == "") r.Add("c:" + points[i]);
                return r;
            }
            string me = SideChar(seat);
            int cnt = 0; for (int i = 0; i < points.Count; i++) if (Cell(s, points[i]) == me) cnt++;
            for (int i = 0; i < points.Count; i++)
            {
                if (Cell(s, points[i]) != me) continue;
                for (int k = 0; k < adj[i].Length; k++)
                    if (Cell(s, adj[i][k]) == "") r.Add("m:" + points[i] + ">" + adj[i][k]);
                if (cnt <= 3)
                    for (int j = 0; j < points.Count; j++)
                        if (Cell(s, points[j]) == "") r.Add("m:" + points[i] + ">" + points[j]);
            }
            if (r.Count == 0) r.Add("pass");
            return r;
        }
        private bool OnlyMills(GameState s, string op)
        {
            for (int i = 0; i < points.Count; i++)
                if (Cell(s, points[i]) == op && !IsMill(s, points[i], op)) return false;
            return true;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = Convert.ToString(d["code"]);
            string me = SideChar(seat), op = SideChar(1 - seat);
            if (action == "x")
            {
                int i = Cfg.I(Cfg.Rest(code));
                if (!Legal(s, seat).Contains(code)) return MoveResult.Fail("不可提该子");
                s.Cells[i] = ""; s.V["capture"] = ""; s.Last = "x:" + i;
                CheckEnd(s, seat); Next(s, -1); return MoveResult.Good();
            }
            if (action == "pass") { Finish(s, 1 - seat, "无子可动，负"); return MoveResult.Good(); }
            int target = -1, from = -1;
            if (action == "c") target = Cfg.I(Cfg.Rest(code));
            else if (action == "m") { int[] ij = ParsePair(Cfg.Rest(code), '>'); from = ij[0]; target = ij[1]; }
            else return MoveResult.Fail("未知动作");
            if (!Legal(s, seat).Contains(code)) return MoveResult.Fail("非法走法");
            if (from >= 0) s.Cells[from] = "";
            else s.V["left" + seat] = IntV(s, "left" + seat, 0) - 1;
            s.Cells[target] = me; s.Last = code;
            if (IsMill(s, target, me))
            {
                bool any = false;
                for (int i = 0; i < points.Count; i++)
                    if (Cell(s, points[i]) == op && (!IsMill(s, points[i], op) || OnlyMills(s, op))) { any = true; break; }
                if (any) { s.V["capture"] = "yes"; Say(s, "成三！请提对方一子"); return MoveResult.Good("成三"); }
            }
            CheckEnd(s, seat); Next(s, -1); return MoveResult.Good();
        }
        private void CheckEnd(GameState s, int seat)
        {
            string op = SideChar(1 - seat);
            int cnt = 0; for (int i = 0; i < points.Count; i++) if (Cell(s, points[i]) == op) cnt++;
            int keep = s.Turn; s.Turn = 1 - seat;
            List<string> reply = Legal(s, 1 - seat);
            s.Turn = keep;
            if (cnt < 3 || reply.Count == 1 && reply[0] == "pass") Finish(s, seat, "对方不足三子 / 无路可走，胜");
        }
        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            d["boardPoints"] = points.Select(x => x.ToString(CultureInfo.InvariantCulture)).ToArray();
            d["boardLines"] = lines.Select(L => string.Join(",", L.Select(x => x.ToString(CultureInfo.InvariantCulture)).ToArray())).ToArray();
            return d;
        }
    }

    public sealed class HexJumpGame : RuleBase
    {
        public override string Id { get { return "tiaogi"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 6; } }
        public override string[] Variants { get { return new string[] { "2人", "3人", "6人" }; } }
        private readonly List<int[]> axial = new List<int[]>();
        private readonly Dictionary<int, int> index = new Dictionary<int, int>();
        private static readonly int[][] HEX = new int[][] {
            new int[]{1,0},new int[]{0,1},new int[]{-1,1},new int[]{-1,0},new int[]{0,-1},new int[]{1,-1}
        };
        private void BuildBoard()
        {
            if (axial.Count > 0) return;
            int[] widths = { 1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1 };
            for (int y = 0; y < widths.Length; y++)
            {
                int w = widths[y], start = (13 - w) / 2;
                for (int x = 0; x < w; x++) index[y * 17 + start + x] = axial.Count;
            }

            axial.Clear();
            foreach (KeyValuePair<int, int> kv in index) axial.Add(new int[] { kv.Key % 17, kv.Key / 17 });
        }

        private int Neighbor(int x, int y, int k)
        {
            int dx = HEX[k][0], dy = HEX[k][1];
            if (dy == 0) return y * 17 + (x + dx);
            int nx = x + dx, ny = y + dy;
            int a = ny * 17 + nx;
            if (ny >= 0 && ny < 17 && nx >= 0 && nx < 17 && index.ContainsKey(a)) return a;
            int shift = (y % 2 == 0) ? 1 : -1;
            int b = ny * 17 + (nx + shift);
            if (ny >= 0 && ny < 17 && nx + shift >= 0 && nx + shift < 17 && index.ContainsKey(b)) return b;
            return -1;
        }
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            BuildBoard();
            GameState s = new GameState(); SetGrid(s, 17, 17);
            for (int i = 0; i < s.Cells.Length; i++) s.Cells[i] = "#";
            foreach (KeyValuePair<int, int> kv in index) s.Cells[kv.Key] = "";

            int[][] dirs = new int[][] { new int[]{0,-1},new int[]{1,-1},new int[]{1,0},new int[]{0,1},new int[]{-1,1},new int[]{-1,0} };
            for (int seat = 0; seat < 6; seat++)
            {
                Dictionary<int, int> score = new Dictionary<int, int>();
                List<int> order = new List<int>();
                foreach (KeyValuePair<int, int> kv in index)
                {
                    int x = kv.Key % 17, y = kv.Key / 17;
                    score[kv.Key] = (x - 8) * dirs[seat][0] + (y - 8) * dirs[seat][1];
                    order.Add(kv.Key);
                }
                order.Sort(delegate (int a, int b) { return score[b].CompareTo(score[a]); });
                int[] camp = new int[10];
                for (int k = 0; k < 10; k++) camp[k] = order[k];
                s.V["camp" + seat] = camp;
            }
            int[] use = seats == 2 ? new int[] { 0, 3 } : seats == 3 ? new int[] { 0, 2, 4 } : new int[] { 0, 1, 2, 3, 4, 5 };
            for (int i = 0; i < seats; i++)
            {
                int[] camp = (int[])s.V["camp" + use[i]];
                for (int k = 0; k < camp.Length; k++) s.Cells[camp[k]] = SideChar(i);
                s.V["home" + i] = camp;
                s.V["goal" + i] = (int[])s.V["camp" + use[(i + (seats == 2 ? 1 : seats / 2)) % use.Length]];
            }
            return s;
        }
        private List<int> Jumps(GameState s, int from)
        {
            List<int> res = new List<int>();
            HashSet<int> seen = new HashSet<int>(); seen.Add(from);
            Queue<int> q = new Queue<int>(); q.Enqueue(from);
            while (q.Count > 0)
            {
                int p = q.Dequeue(), x = p % 17, y = p / 17;
                for (int k = 0; k < HEX.Length; k++)
                {
                    int mid = Neighbor(x, y, k);
                    if (mid < 0 || mid >= s.Cells.Length || Cell(s, mid) == "#" || Cell(s, mid) == "") continue;
                    int mx = mid % 17, my = mid / 17;
                    int dst = Neighbor(mx, my, k);
                    if (dst < 0 || dst >= s.Cells.Length || Cell(s, dst) != "" || seen.Contains(dst)) continue;
                    seen.Add(dst); res.Add(dst); q.Enqueue(dst);
                }
            }
            return res;
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat) return r;
            for (int p = 0; p < s.Cells.Length; p++)
            {
                if (Cell(s, p) != SideChar(seat)) continue;
                int x = p % 17, y = p / 17;
                for (int k = 0; k < HEX.Length; k++)
                {
                    int n = Neighbor(x, y, k);
                    if (n >= 0 && n < s.Cells.Length && Cell(s, n) == "") r.Add("m:" + p + ">" + n);
                }
                List<int> j = Jumps(s, p);
                for (int k = 0; k < j.Count; k++) r.Add("m:" + p + ">" + j[k]);
            }
            if (r.Count == 0) r.Add("pass");
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            if (action == "pass") { Next(s, -1); return MoveResult.Good(); }
            if (action != "m") return MoveResult.Fail("未知动作");
            string code = Convert.ToString(d["code"]);
            if (!Legal(s, seat).Contains(code)) return MoveResult.Fail("非法跳跃");
            int[] ij = ParsePair(Cfg.Rest(code), '>');
            s.Cells[ij[0]] = ""; s.Cells[ij[1]] = SideChar(seat); s.Last = code;
            int[] goal = s.V.ContainsKey("goal" + seat) ? (int[])s.V["goal" + seat] : new int[0];
            bool win = goal.Length > 0;
            for (int k = 0; k < goal.Length; k++) if (Cell(s, goal[k]) != SideChar(seat)) { win = false; break; }
            if (win) { Finish(s, seat, "占满对面营，胜"); return MoveResult.Good(); }
            Next(s, -1); return MoveResult.Good();
        }
        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            List<string> pts = new List<string>();
            foreach (KeyValuePair<int, int> kv in index) pts.Add(kv.Key.ToString(CultureInfo.InvariantCulture));
            d["boardPoints"] = pts.ToArray();
            return d;
        }
    }
}
