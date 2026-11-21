using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Qipai
{

    public sealed class XiangqiGame : RuleBase
    {
        public override string Id { get { return "xiangqi"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 2; } }
        public override string[] Variants { get { return new string[] { "标准", "快棋" }; } }
        private static readonly string[] BACK = { "R", "N", "B", "A", "K", "A", "B", "N", "R" };
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState(); SetGrid(s, 9, 10);
            for (int x = 0; x < 9; x++)
            {
                s.Cells[At(s, x, 0)] = "b" + BACK[x];
                s.Cells[At(s, x, 9)] = "r" + BACK[x];
            }
            s.Cells[At(s, 1, 2)] = "bC"; s.Cells[At(s, 7, 2)] = "bC";
            s.Cells[At(s, 1, 7)] = "rC"; s.Cells[At(s, 7, 7)] = "rC";
            int[] px = { 0, 2, 4, 6, 8 };
            for (int k = 0; k < px.Length; k++)
            {
                s.Cells[At(s, px[k], 3)] = "bP";
                s.Cells[At(s, px[k], 6)] = "rP";
            }
            s.V["posLast"] = ""; s.V["posCount"] = 0; s.V["checkBy"] = -1;
            s.V["half"] = 0;
            return s;
        }
        private int Forward(int seat) { return seat == 0 ? -1 : 1; }
        private bool OwnHalf(int seat, int y) { return seat == 0 ? y >= 5 : y <= 4; }
        private bool Palace(int seat, int x, int y)
        {
            if (x < 3 || x > 5) return false;
            return seat == 0 ? (y >= 7 && y <= 9) : (y >= 0 && y <= 2);
        }
        private int KingAt(GameState s, int seat)
        {
            string k = SideChar(seat) + "K";
            for (int i = 0; i < s.Cells.Length; i++) if (Cell(s, i) == k) return i;
            return -1;
        }
        private static readonly int[][] ORTHO = new int[][] {
            new int[]{1,0},new int[]{-1,0},new int[]{0,1},new int[]{0,-1}
        };
        private static readonly int[][] DIAG = new int[][] {
            new int[]{1,1},new int[]{1,-1},new int[]{-1,1},new int[]{-1,-1}
        };
        private static readonly int[][] KNIGHT = new int[][] {
            new int[]{1,2,0,1},new int[]{-1,2,0,1},new int[]{1,-2,0,-1},new int[]{-1,-2,0,-1},
            new int[]{2,1,1,0},new int[]{2,-1,1,0},new int[]{-2,1,-1,0},new int[]{-2,-1,-1,0}
        };

        public List<int> Pseudo(GameState s, int from)
        {
            List<int> r = new List<int>();
            string c = Cell(s, from);
            if (c.Length < 2) return r;
            int seat = SideOf(c), x = X(s, from), y = Y(s, from);
            char t = c[1];
            Action<int, int> add = delegate (int nx, int ny)
            {
                if (!Inside(s, nx, ny)) return;
                int to = At(s, nx, ny);
                if (SideOf(Cell(s, to)) == seat) return;
                r.Add(to);
            };
            if (t == 'R' || t == 'C')
            {
                for (int k = 0; k < ORTHO.Length; k++)
                {
                    int nx = x + ORTHO[k][0], ny = y + ORTHO[k][1];
                    bool jumped = false;
                    while (Inside(s, nx, ny))
                    {
                        int to = At(s, nx, ny);
                        if (!jumped)
                        {
                            if (Cell(s, to) == "") r.Add(to);
                            else { if (t == 'R' && SideOf(Cell(s, to)) != seat) r.Add(to); jumped = true; }
                        }
                        else if (Cell(s, to) != "")
                        {
                            if (t == 'C' && SideOf(Cell(s, to)) != seat) r.Add(to);
                            break;
                        }
                        nx += ORTHO[k][0]; ny += ORTHO[k][1];
                    }
                }
            }
            else if (t == 'N')
            {
                for (int k = 0; k < KNIGHT.Length; k++)
                {
                    int nx = x + KNIGHT[k][0], ny = y + KNIGHT[k][1];
                    int lx = x + KNIGHT[k][2], ly = y + KNIGHT[k][3];
                    if (!Inside(s, lx, ly) || Cell(s, At(s, lx, ly)) != "") continue;
                    add(nx, ny);
                }
            }
            else if (t == 'B')
            {
                for (int k = 0; k < DIAG.Length; k++)
                {
                    int nx = x + 2 * DIAG[k][0], ny = y + 2 * DIAG[k][1];
                    int ex = x + DIAG[k][0], ey = y + DIAG[k][1];
                    if (!Inside(s, nx, ny) || !OwnHalf(seat, ny)) continue;
                    if (Cell(s, At(s, ex, ey)) != "") continue;
                    add(nx, ny);
                }
            }
            else if (t == 'A')
            {
                for (int k = 0; k < DIAG.Length; k++)
                {
                    int nx = x + DIAG[k][0], ny = y + DIAG[k][1];
                    if (!Palace(seat, nx, ny)) continue;
                    add(nx, ny);
                }
            }
            else if (t == 'K')
            {
                for (int k = 0; k < ORTHO.Length; k++)
                {
                    int nx = x + ORTHO[k][0], ny = y + ORTHO[k][1];
                    if (!Palace(seat, nx, ny)) continue;
                    add(nx, ny);
                }

                int op = KingAt(s, 1 - seat);
                if (op >= 0 && X(s, op) == x)
                {
                    bool clear = true;
                    int lo = Math.Min(y, Y(s, op)) + 1, hi = Math.Max(y, Y(s, op));
                    for (int yy = lo; yy < hi; yy++) if (Cell(s, At(s, x, yy)) != "") { clear = false; break; }
                    if (clear) r.Add(op);
                }
            }
            else if (t == 'P')
            {
                int ny = y + Forward(seat);
                add(x, ny);
                if (!OwnHalf(seat, y)) { add(x - 1, y); add(x + 1, y); }
            }
            return r;
        }
        private bool InCheck(GameState s, int seat)
        {
            int k = KingAt(s, seat);
            if (k < 0) return true;
            for (int i = 0; i < s.Cells.Length; i++)
                if (SideOf(Cell(s, i)) == 1 - seat && Pseudo(s, i).Contains(k)) return true;
            return false;
        }
        private bool Safe(GameState s, int from, int to, int seat)
        {
            string keep = Cell(s, to);
            s.Cells[to] = Cell(s, from); s.Cells[from] = "";
            bool bad = InCheck(s, seat);
            s.Cells[from] = s.Cells[to]; s.Cells[to] = keep;
            return !bad;
        }
        private List<string> Moves(GameState s, int seat)
        {
            List<string> r = new List<string>();
            for (int i = 0; i < s.Cells.Length; i++)
            {
                if (SideOf(Cell(s, i)) != seat) continue;
                List<int> ps = Pseudo(s, i);
                for (int k = 0; k < ps.Count; k++)
                    if (Safe(s, i, ps[k], seat)) r.Add("m:" + i + ">" + ps[k]);
            }
            return r;
        }
        public override List<string> Legal(GameState s, int seat)
        {
            if (s.Ended || s.Turn != seat) return new List<string>();
            return Moves(s, seat);
        }
        private string Hash(GameState s)
        {
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < s.Cells.Length; i++) b.Append(Cell(s, i)).Append('|');
            return b.ToString();
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            if (action != "m") return MoveResult.Fail("未知动作");
            string code = Convert.ToString(d["code"]);
            if (!Moves(s, seat).Contains(code)) return MoveResult.Fail("非法着法 / 送将");
            int[] ij = ParsePair(Cfg.Rest(code), '>');
            string eaten = Cell(s, ij[1]);
            Put(s, ij[0], ij[1], code);
            int op = 1 - seat;
            bool check = InCheck(s, op);
            int savedTurn = s.Turn; s.Turn = op;
            bool noReply = Moves(s, op).Count == 0;
            s.Turn = savedTurn;
            if (eaten == SideChar(op) + "K") { Finish(s, seat, "吃掉将帅，胜"); return MoveResult.Good(); }
            if (noReply) { Finish(s, seat, check ? "将死，胜" : "困毙，胜"); return MoveResult.Good(); }
            string h = Hash(s);
            if (StrV(s, "posLast", "") == h)
            {
                int c = IntV(s, "posCount", 0) + 1;
                s.V["posCount"] = c;
                if (c >= 3 && check && IntV(s, "checkBy", -1) == seat && OptB(s, "longCheck", true))
                { Finish(s, op, "长将判负"); return MoveResult.Good(); }
            }
            else { s.V["posCount"] = 1; s.V["posLast"] = h; }
            s.V["checkBy"] = check ? seat : -1;

            int half = eaten.Length > 0 ? 0 : IntV(s, "half", 0) + 1;
            s.V["half"] = half;
            if (OptB(s, "rule60", true) && half >= 120)
            { Finish(s, -1, "连续 60 回合未吃子 · 自然限着和棋"); return MoveResult.Good(); }
            Say(s, check ? "将军！" : "");
            Next(s, -1); return MoveResult.Good(check ? "将军" : "");
        }
    }

    public sealed class DarkGame : RuleBase
    {
        private readonly string _id;
        public DarkGame(string id) { _id = id; }
        public override string Id { get { return _id; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 2; } }
        public override string[] Variants
        {
            get
            {
                if (_id == "jieqi") return new string[] { "标准" };
                if (_id == "xiangqidark") return new string[] { "标准" };
                if (_id == "junqi") return new string[] { "暗棋", "翻棋" };
                return new string[] { "标准", "翻棋" };
            }
        }
        private static readonly Dictionary<char, int> XQ_RANK = new Dictionary<char, int> {
            {'K',7},{'A',6},{'B',5},{'N',4},{'R',3},{'C',2},{'P',1}
        };
        private static readonly Dictionary<char, int> JQ_RANK = new Dictionary<char, int> {
            {'9',9},{'8',8},{'7',7},{'6',6},{'5',5},{'4',4},{'3',3},{'2',2},{'1',1},{'0',0},{'F',-1},{'B',10}
        };
        private static readonly Dictionary<char, int> DS_RANK = new Dictionary<char, int> {
            {'8',8},{'7',7},{'6',6},{'5',5},{'4',4},{'3',3},{'2',2},{'1',1}
        };
        private bool IsJieqi() { return _id == "jieqi"; }
        private bool IsDoushou() { return _id == "doushou"; }
        private bool IsJunqi() { return _id == "junqi"; }

        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.V["hidden"] = true;
            s.V["flipped"] = 0;
            if (IsJieqi())
            {
                SetGrid(s, 9, 10);
                List<string> pieces = new List<string>();
                string[] types = { "R", "N", "B", "A", "K", "A", "B", "N", "R", "C", "C", "P", "P", "P", "P", "P" };
                for (int i = 0; i < types.Length; i++) { pieces.Add("r" + types[i]); pieces.Add("b" + types[i]); }
                Shuffle(s, pieces);
                List<int> slots = new List<int>();
                for (int y = 0; y < 10; y++) for (int x = 0; x < 9; x++) slots.Add(At(s, x, y));

                List<int> use = new List<int>();
                for (int y = 0; y < 4; y++) for (int x = 0; x < 9; x++) if (y < 3 || x == 1 || x == 7) use.Add(At(s, x, y));
                for (int y = 6; y < 10; y++) for (int x = 0; x < 9; x++) if (y > 6 || x == 1 || x == 7) use.Add(At(s, x, y));
                for (int i = 0; i < pieces.Count && i < use.Count; i++) s.Cells[use[i]] = "?" + pieces[i];
            }
            else if (IsDoushou() && variant != "翻棋")
            {
                SetGrid(s, 7, 9);
                string[] top = { "1", "4", "5", "6", "7", "5", "4" };
                for (int x = 0; x < 7; x++)
                {
                    s.Cells[At(s, x, 0)] = "b" + top[x];
                    s.Cells[At(s, x, 8)] = "r" + top[x];
                }
                int[] bx = { 0, 2, 4, 6 };
                for (int k = 0; k < bx.Length; k++)
                {
                    s.Cells[At(s, bx[k], 1)] = "b8"; s.Cells[At(s, bx[k], 7)] = "r8";
                }
                s.V["hidden"] = false;
                s.V["trap0"] = new int[] { At(s, 2, 8), At(s, 4, 8), At(s, 3, 7) };
                s.V["trap1"] = new int[] { At(s, 2, 0), At(s, 4, 0), At(s, 3, 1) };
                s.V["den0"] = At(s, 3, 8); s.V["den1"] = At(s, 3, 0);
                s.V["river"] = new int[] { 3, 4, 5 };
            }
            else
            {
                int w = 4, h = 8;
                SetGrid(s, w, h);
                List<string> pieces = new List<string>();
                if (IsJunqi())
                {
                    string[] t = { "9", "8", "8", "7", "7", "6", "6", "5", "5", "4", "4", "3", "3", "2", "2", "1", "1", "1", "0", "0", "0", "F", "B", "B", "9", "8", "7", "6", "5", "4", "3", "2" };
                    for (int i = 0; i < 32; i++) pieces.Add((i < 16 ? "r" : "b") + t[i]);
                }
                else
                {
                    string[] t = { "K", "A", "A", "B", "B", "N", "N", "R", "R", "C", "C", "P", "P", "P", "P", "P" };
                    for (int i = 0; i < t.Length; i++) { pieces.Add("r" + t[i]); pieces.Add("b" + t[i]); }
                }
                Shuffle(s, pieces);
                for (int i = 0; i < pieces.Count; i++) s.Cells[i] = "?" + pieces[i];
            }
            return s;
        }
        private string True(GameState s, int i)
        {
            string c = Cell(s, i);
            return c.Length > 0 && c[0] == '?' ? c.Substring(1) : c;
        }
        private bool FaceUp(GameState s, int i)
        {
            string c = Cell(s, i);
            return c.Length > 1 && c[0] != '?' && c[0] != '#';
        }
        private int Level(string c)
        {
            if (IsJieqi() || _id == "xiangqidark") { int v; return XQ_RANK.TryGetValue(c[1], out v) ? v : 0; }
            if (IsJunqi()) { int v; return JQ_RANK.TryGetValue(c[1], out v) ? v : 0; }
            int w; return DS_RANK.TryGetValue(c[1], out w) ? w : 0;
        }
        private bool CanCapture(GameState s, int from, int to, int seat)
        {
            string a = True(s, from), b = True(s, to);
            if (a.Length < 2 || b.Length < 2) return false;
            if (SideOf(b) == seat) return false;
            if (IsDoushou())
            {

                object tp; if (OptB(s, "trapRule", true) && s.V.TryGetValue("trap" + (1 - seat), out tp))
                {
                    int[] traps = tp as int[];
                    if (traps != null && Array.IndexOf(traps, to) >= 0) return true;
                }
                int[] river = s.V.ContainsKey("river") ? (int[])s.V["river"] : new int[0];
                bool inRiver = Array.IndexOf(river, Y(s, from)) >= 0 || Array.IndexOf(river, Y(s, to)) >= 0;
                if (OptB(s, "riverRule", true) && inRiver && (Level(a) == 8 || Level(b) == 8)) return false;
            }
            if (IsJieqi())
            {

                return Level(a) >= Level(b);
            }
            if (_id == "xiangqidark")
            {
                if (a[1] == 'P' && b[1] == 'K') return true;
                if (a[1] == 'K' && b[1] == 'P') return false;
                return Level(a) >= Level(b);
            }
            if (IsJunqi())
            {
                if (a[1] == 'B' || b[1] == 'B') return true;
                if (b[1] == 'F') return true;
                if (b[1] == '0') return a[1] == '1';
                return Level(a) >= Level(b);
            }

            if (OptB(s, "mouseElephant", true))
            {
                if (a[1] == '1' && b[1] == '8') return true;
                if (a[1] == '8' && b[1] == '1') return false;
            }
            int[] trap = OptB(s, "trapRule", true) && s.V.ContainsKey("trap" + (1 - seat))
                ? (int[])s.V["trap" + (1 - seat)] : new int[0];
            if (Array.IndexOf(trap, to) >= 0) return true;
            return Level(a) >= Level(b);
        }
        private List<int> Steps(GameState s, int i)
        {
            List<int> r = new List<int>();
            int x = X(s, i), y = Y(s, i);
            for (int k = 0; k < ORTHO_D.Length; k++)
            {
                int nx = x + ORTHO_D[k][0], ny = y + ORTHO_D[k][1];
                if (Inside(s, nx, ny)) r.Add(At(s, nx, ny));
            }

            if (IsDoushou() && OptB(s, "riverRule", true))
            {
                string c = True(s, i);
                if (c.Length > 1 && (Level(c) == 7 || Level(c) == 6))
                {
                    int[] river = s.V.ContainsKey("river") ? (int[])s.V["river"] : new int[0];
                    if (river.Length >= 3)
                    {
                        int toY = -1;
                        if (y == river[0] - 1) toY = river[river.Length - 1] + 1;
                        else if (y == river[river.Length - 1] + 1) toY = river[0] - 1;
                        if (toY >= 0 && toY < s.Height)
                        {
                            bool clear = true;
                            for (int k = 0; k < river.Length; k++)
                                if (Cell(s, At(s, x, river[k])) != "") { clear = false; break; }
                            if (clear)
                            {
                                int dest = At(s, x, toY);
                                int seat = SideOf(Cell(s, i));
                                if (Cell(s, dest) == "" || CanCapture(s, i, dest, seat)) r.Add(dest);
                            }
                        }
                    }
                }
            }
            return r;
        }
        private static readonly int[][] ORTHO_D = new int[][] {
            new int[]{1,0},new int[]{-1,0},new int[]{0,1},new int[]{0,-1}
        };
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat) return r;
            if (BoolV(s, "hidden", false))
            {
                for (int i = 0; i < s.Cells.Length; i++)
                {
                    string c = Cell(s, i);
                    if (c.Length > 0 && c[0] == '?') { r.Add("f:" + i); continue; }
                    if (!FaceUp(s, i) || SideOf(c) != seat) continue;
                    List<int> nb = Steps(s, i);
                    for (int k = 0; k < nb.Count; k++)
                    {
                        int t = nb[k];
                        if (Cell(s, t) == "" || CanCapture(s, i, t, seat)) r.Add("m:" + i + ">" + t);
                    }
                }
                return r;
            }

            for (int i = 0; i < s.Cells.Length; i++)
            {
                if (SideOf(Cell(s, i)) != seat) continue;
                List<int> nb = Steps(s, i);
                for (int k = 0; k < nb.Count; k++)
                {
                    int t = nb[k];
                    if (IsDoushou())
                    {
                        int den = s.V.ContainsKey("den" + seat) ? Convert.ToInt32(s.V["den" + seat]) : 0;
                        if (Y(s, t) == Y(s, den) && X(s, t) == X(s, den)) continue;
                        int[] river = s.V.ContainsKey("river") ? (int[])s.V["river"] : new int[0];
                        bool targetRiver = Array.IndexOf(river, Y(s, t)) >= 0;
                        string mover = True(s, i);
                        int lvl = mover.Length > 1 ? Level(mover) : 0;
                        if (targetRiver && lvl != 1) continue;
                        if (targetRiver && lvl == 1 && Cell(s, t) != "")
                        {
                            string target = True(s, t);
                            if (target.Length > 1 && Level(target) == 8) continue;
                        }
                    }
                    if (Cell(s, t) == "" || CanCapture(s, i, t, seat)) r.Add("m:" + i + ">" + t);
                }
            }
            if (r.Count == 0) r.Add("pass");
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = Convert.ToString(d["code"]);
            if (!Legal(s, seat).Contains(code)) return MoveResult.Fail("非法动作");
            if (action == "pass") { Finish(s, 1 - seat, "无子可动，负"); return MoveResult.Good(); }
            if (action == "f")
            {
                int i = Cfg.I(Cfg.Rest(code));
                s.Cells[i] = True(s, i); s.Last = "f:" + i;
                s.V["flipped"] = IntV(s, "flipped", 0) + 1;
                Say(s, "翻开一枚棋子");
                Next(s, -1); return MoveResult.Good();
            }
            if (action != "m") return MoveResult.Fail("未知动作");
            int[] ij = ParsePair(Cfg.Rest(code), '>');
            string eaten = True(s, ij[1]);
            bool bomb = IsJunqi() && (True(s, ij[0]).EndsWith("B") || eaten.EndsWith("B"));
            s.Cells[ij[0]] = "";
            s.Cells[ij[1]] = bomb ? "" : True(s, ij[0]);
            if (bomb && eaten.Length > 0) s.Cells[ij[1]] = "";
            s.Last = code;
            if (eaten.Length > 1 && (eaten[1] == 'K' || eaten[1] == 'F'))
            { Finish(s, seat, "吃掉主帅 / 扛旗，胜"); return MoveResult.Good(); }
            if (IsDoushou() && s.V.ContainsKey("den" + (1 - seat)) && ij[1] == Convert.ToInt32(s.V["den" + (1 - seat)]))
            { Finish(s, seat, "进入对方兽穴，胜"); return MoveResult.Good(); }
            int alive = 0;
            for (int i = 0; i < s.Cells.Length; i++) if (SideOf(True(s, i)) == 1 - seat) alive++;
            if (alive == 0) { Finish(s, seat, "对方无子，胜"); return MoveResult.Good(); }
            Next(s, -1); return MoveResult.Good();
        }
        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            d["hidden"] = BoolV(s, "hidden", false);
            return d;
        }
    }

    public sealed class ChessGame : RuleBase
    {
        private readonly string _id;
        public ChessGame(string id) { _id = id; }
        public override string Id { get { return _id; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 2; } }
        public override string[] Variants { get { return _id == "chess960" ? new string[] { "随机初始" } : new string[] { "标准", "快棋" }; } }
        private static readonly int[][] N8 = new int[][] {
            new int[]{1,2},new int[]{2,1},new int[]{2,-1},new int[]{1,-2},
            new int[]{-1,-2},new int[]{-2,-1},new int[]{-2,1},new int[]{-1,2}
        };
        private static readonly int[][] D8 = new int[][] {
            new int[]{1,1},new int[]{1,-1},new int[]{-1,1},new int[]{-1,-1}
        };
        private static readonly int[][] O4 = new int[][] {
            new int[]{1,0},new int[]{-1,0},new int[]{0,1},new int[]{0,-1}
        };
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState(); SetGrid(s, 8, 8);
            string[] back = { "R", "N", "B", "Q", "K", "B", "N", "R" };
            if (_id == "chess960")
            {
                List<string> b = new List<string>(back);
                Shuffle(s, b);

                for (int guard = 0; guard < 200; guard++)
                {
                    Shuffle(s, b);
                    int i1 = b.IndexOf("B"), i2 = b.LastIndexOf("B");
                    int k = b.IndexOf("K"), r1 = b.IndexOf("R"), r2 = b.LastIndexOf("R");
                    if (i1 % 2 != i2 % 2 && k > Math.Min(r1, r2) && k < Math.Max(r1, r2)) break;
                }
                back = b.ToArray();
            }
            for (int x = 0; x < 8; x++)
            {
                s.Cells[At(s, x, 0)] = "b" + back[x];
                s.Cells[At(s, x, 7)] = "w" + back[x];
                s.Cells[At(s, x, 1)] = "bP";
                s.Cells[At(s, x, 6)] = "wP";
            }
            s.V["castle0"] = 3; s.V["castle1"] = 3;
            s.V["ep"] = -1;
            s.V["_half"] = 0;
            s.V["_hist"] = new List<string>();
            (s.V["_hist"] as List<string>).Add(Position(s, 0));
            return s;
        }
        private string W(int seat) { return seat == 0 ? "w" : "b"; }
        private int Side(string c)
        {
            if (c.Length < 2) return -1;
            return c[0] == 'w' ? 0 : c[0] == 'b' ? 1 : -1;
        }
        private int KingAt(GameState s, int seat)
        {
            string k = W(seat) + "K";
            for (int i = 0; i < s.Cells.Length; i++) if (Cell(s, i) == k) return i;
            return -1;
        }
        private List<int> Pseudo(GameState s, int from)
        {
            List<int> r = new List<int>();
            string c = Cell(s, from);
            if (c.Length < 2) return r;
            int seat = Side(c), x = X(s, from), y = Y(s, from);
            char t = c[1];
            Action<int, int> add = delegate (int nx, int ny)
            {
                if (!Inside(s, nx, ny)) return;
                int to = At(s, nx, ny);
                if (Side(Cell(s, to)) == seat) return;
                r.Add(to);
            };
            if (t == 'P')
            {
                int f = seat == 0 ? -1 : 1, start = seat == 0 ? 6 : 1;
                if (Inside(s, x, y + f) && Cell(s, At(s, x, y + f)) == "")
                {
                    add(x, y + f);
                    if (y == start && Cell(s, At(s, x, y + 2 * f)) == "") add(x, y + 2 * f);
                }
                for (int k = -1; k <= 1; k += 2)
                {
                    int nx = x + k, ny = y + f;
                    if (!Inside(s, nx, ny)) continue;
                    int to = At(s, nx, ny);
                    if (Side(Cell(s, to)) == 1 - seat) r.Add(to);
                    else if (OptB(s, "enPassant", true) && to == IntV(s, "ep", -1)) r.Add(to);
                }
                return r;
            }
            if (t == 'N')
            {
                for (int k = 0; k < N8.Length; k++) add(x + N8[k][0], y + N8[k][1]);
                return r;
            }
            if (t == 'K')
            {
                for (int k = 0; k < D8.Length; k++) add(x + D8[k][0], y + D8[k][1]);
                for (int k = 0; k < O4.Length; k++) add(x + O4[k][0], y + O4[k][1]);
                return r;
            }
            int[][] dirs = t == 'B' ? D8 : t == 'R' ? O4 : D8.Concat(O4).ToArray();
            for (int k = 0; k < dirs.Length; k++)
            {
                int nx = x + dirs[k][0], ny = y + dirs[k][1];
                while (Inside(s, nx, ny))
                {
                    int to = At(s, nx, ny);
                    if (Cell(s, to) == "") r.Add(to);
                    else { if (Side(Cell(s, to)) != seat) r.Add(to); break; }
                    nx += dirs[k][0]; ny += dirs[k][1];
                }
            }
            return r;
        }
        private bool InCheck(GameState s, int seat)
        {
            int k = KingAt(s, seat);
            if (k < 0) return true;
            for (int i = 0; i < s.Cells.Length; i++)
                if (Side(Cell(s, i)) == 1 - seat && Pseudo(s, i).Contains(k)) return true;
            return false;
        }
        private bool Safe(GameState s, int from, int to, int seat)
        {
            string keep = Cell(s, to), pc = Cell(s, from);

            int cap = -1; string capKeep = "";
            if (pc.Length > 1 && pc[1] == 'P' && to == IntV(s, "ep", -1) &&
                X(s, from) != X(s, to) && Inside(s, X(s, to), Y(s, from)))
            {
                cap = At(s, X(s, to), Y(s, from));
                capKeep = Cell(s, cap); s.Cells[cap] = "";
            }
            s.Cells[to] = pc; s.Cells[from] = "";
            bool bad = InCheck(s, seat);
            s.Cells[from] = s.Cells[to]; s.Cells[to] = keep;
            if (cap >= 0) s.Cells[cap] = capKeep;
            return !bad;
        }
        private List<string> Moves(GameState s, int seat)
        {
            List<string> r = new List<string>();
            for (int i = 0; i < s.Cells.Length; i++)
            {
                if (Side(Cell(s, i)) != seat) continue;
                List<int> ps = Pseudo(s, i);
            for (int k = 0; k < ps.Count; k++)
            {
                if (!Safe(s, i, ps[k], seat)) continue;
                string bc = "m:" + i + ">" + ps[k];
                char type = Cell(s, i).Length > 1 ? Cell(s, i)[1] : ' ';
                if (type == 'P' && (Y(s, ps[k]) == 0 || Y(s, ps[k]) == 7) && OptB(s, "promoteChoice", true))
                {
                    char[] opts = { 'q', 'r', 'b', 'n' };
                    for (int q = 0; q < opts.Length; q++) r.Add(bc + "=" + opts[q]);
                }
                else r.Add(bc);
            }
        }
        CastleMoves(s, seat, r);
        return r;
        }
        private string Position(GameState s, int turn)
        {
            System.Text.StringBuilder sb = new System.Text.StringBuilder();
            for (int i = 0; i < s.Cells.Length; i++) sb.Append(Cell(s, i).Length == 0 ? "." : Cell(s, i));
            sb.Append('|').Append(turn).Append('|')
              .Append(IntV(s, "castle0", 0)).Append(IntV(s, "castle1", 0))
              .Append('|').Append(IntV(s, "ep", -1));
            return sb.ToString();
        }
        private void CastleMoves(GameState s, int seat, List<string> r)
        {
            int kpos = KingAt(s, seat), ci = IntV(s, "castle" + seat, 0);
            if (kpos < 0 || ci == 0 || InCheck(s, seat)) return;
            int row = seat == 0 ? 7 : 0, kx = X(s, kpos);
            for (int side = 0; side < 2; side++)
            {
                if ((ci & (side == 0 ? 1 : 2)) == 0) continue;
                int dir = side == 0 ? 1 : -1, rookX = -1;
                for (int xx = kx + dir; xx >= 0 && xx < 8; xx += dir)
                    if (Cell(s, At(s, xx, row)) == W(seat) + "R") { rookX = xx; break; }
                if (rookX < 0) continue;
                int toX = side == 0 ? 6 : 2, rookToX = side == 0 ? 5 : 3;
                int kingTo = At(s, toX, row), rookFrom = At(s, rookX, row), rookTo = At(s, rookToX, row);
                string rook = Cell(s, rookFrom), rookKeep = Cell(s, rookTo);
                s.Cells[rookFrom] = ""; s.Cells[rookTo] = rook;
                HashSet<int> self = new HashSet<int>(); self.Add(kpos); self.Add(rookTo);
                bool clear = true;
                int lo = Math.Min(Math.Min(kx, toX), Math.Min(rookX, rookToX));
                int hi = Math.Max(Math.Max(kx, toX), Math.Max(rookX, rookToX));
                for (int xx = lo; xx <= hi; xx++)
                {
                    int q = At(s, xx, row);
                    if (!self.Contains(q) && Cell(s, q) != "") { clear = false; break; }
                }
                bool safe = clear;
                if (safe)
                {
                    string kc = Cell(s, kpos); s.Cells[kpos] = "";
                    int step = toX >= kx ? 1 : -1, xx2 = kx;
                    while (true)
                    {
                        if (xx2 != kx)
                        {
                            int q = At(s, xx2, row); string keep = Cell(s, q);
                            s.Cells[q] = kc;
                            if (InCheck(s, seat)) safe = false;
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
        public override List<string> Legal(GameState s, int seat)
        {
            if (s.Ended || s.Turn != seat) return new List<string>();
            List<string> r = Moves(s, seat);
            if (OptB(s, "threefold", true))
            {
                string cur = Position(s, s.Turn);
                List<string> hist = s.V.ContainsKey("_hist") ? s.V["_hist"] as List<string> : new List<string>();
                int n = 0;
                if (hist != null) for (int i = 0; i < hist.Count; i++) if (hist[i] == cur) n++;
                if (n >= 3) r.Add("draw:threefold");
            }
            if (OptB(s, "rule50", true) && IntV(s, "_half", 0) >= 100) r.Add("draw:50");
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
        string code = Convert.ToString(d["code"]);
        if (action == "draw")
        {
            string why = code == "draw:50" ? "50 回合无吃子无兵动 · 提和成立" : "三次重复局面 · 提和成立";
            Finish(s, -1, why); return MoveResult.Good("和棋");
        }
        if (action != "m" && action != "o") return MoveResult.Fail("未知动作");
        if (!Moves(s, seat).Contains(code)) return MoveResult.Fail("非法着法 / 送王");
        string body = Cfg.Rest(code), promo = "";
        int eq = body.IndexOf('=');
        if (eq >= 0) { promo = body.Substring(eq + 1); body = body.Substring(0, eq); }
        int[] ij = ParsePair(body, '>');
            int from = ij[0], to = ij[1];
            string piece = Cell(s, from), eaten = Cell(s, to);
            int savedEp = IntV(s, "ep", -1);
            s.V["ep"] = -1;
            if (piece.Length > 1 && piece[1] == 'P' && Math.Abs(Y(s, to) - Y(s, from)) == 2)
                s.V["ep"] = At(s, X(s, from), (Y(s, from) + Y(s, to)) / 2);
            if (piece.Length > 1 && piece[1] == 'P' && to == savedEp)
            {
                int cap = At(s, X(s, to), Y(s, from));
                s.Cells[cap] = "";
            }
        s.Cells[from] = "";
        s.Cells[to] = piece;
        if (piece.Length > 1 && piece[1] == 'P' && (Y(s, to) == 0 || Y(s, to) == 7))
        {
            char up = promo.Length > 0 ? char.ToUpperInvariant(promo[0]) : 'Q';
            if ("QRBN".IndexOf(up) < 0) up = 'Q';
            s.Cells[to] = W(seat) + up;
        }
        if (action == "o")
        {
            int row = Y(s, to), kx = X(s, to);
            int rookToX = kx == 6 ? 5 : 3, dir = kx == 6 ? 1 : -1, rookX = -1;
            for (int xx = X(s, from) + dir; xx >= 0 && xx < 8; xx += dir)
                if (Cell(s, At(s, xx, row)) == W(seat) + "R") { rookX = xx; break; }
            if (rookX >= 0)
            {
                string rook = Cell(s, At(s, rookX, row));
                s.Cells[At(s, rookX, row)] = "";
                s.Cells[At(s, rookToX, row)] = rook;
            }
        }
            if (piece.Length > 1 && piece[1] == 'K') s.V["castle" + seat] = 0;
            for (int k = 0; k < 2; k++)
            {
                int rx = k == 0 ? 7 : 0, row = seat == 0 ? 7 : 0;
                if (from == At(s, rx, row) || to == At(s, rx, row))
                    s.V["castle" + seat] = IntV(s, "castle" + seat, 0) & ~(k == 0 ? 1 : 2);
            }
        s.Last = code;
        bool pawnMove = piece.Length > 1 && piece[1] == 'P';
        bool capture = eaten.Length > 0 || (pawnMove && to == savedEp);
        s.V["_half"] = (pawnMove || capture) ? 0 : IntV(s, "_half", 0) + 1;
        List<string> hist = s.V.ContainsKey("_hist") ? s.V["_hist"] as List<string> : new List<string>();
        if (hist == null) { hist = new List<string>(); s.V["_hist"] = hist; }
        hist.Add(Position(s, 1 - seat));
        if (hist.Count > 300) hist.RemoveAt(0);
        if (eaten == W(1 - seat) + "K") { Finish(s, seat, "吃掉王，胜"); return MoveResult.Good(); }
        int op = 1 - seat, savedTurn = s.Turn; s.Turn = op;
        bool noReply = Moves(s, op).Count == 0;
        s.Turn = savedTurn;
        if (noReply)
        {
            bool mate = InCheck(s, op);
            Finish(s, mate ? seat : -1, mate ? "将死，胜" : "逼和（无合法着法且未被将），和棋");
            return MoveResult.Good();
        }
        Next(s, -1); return MoveResult.Good();
        }
    }

    public sealed class ShogiGame : RuleBase
    {
        public override string Id { get { return "shogi"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 2; } }
        public override string[] Variants { get { return new string[] { "标准" }; } }
        private static readonly string[] BACK = { "L", "N", "S", "G", "K", "G", "S", "N", "L" };
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState(); SetGrid(s, 9, 9);
            for (int x = 0; x < 9; x++)
            {
                s.Cells[At(s, x, 0)] = "b" + BACK[x];
                s.Cells[At(s, x, 8)] = "r" + BACK[x];
                s.Cells[At(s, x, 2)] = "bP";
                s.Cells[At(s, x, 6)] = "rP";
            }
            s.Cells[At(s, 1, 1)] = "bB"; s.Cells[At(s, 7, 1)] = "bR";
            s.Cells[At(s, 7, 7)] = "rB"; s.Cells[At(s, 1, 7)] = "rR";
            s.Hands[0] = new List<string>(); s.Hands[1] = new List<string>();
            return s;
        }
        private int F(int seat) { return seat == 0 ? -1 : 1; }
        private bool Promotable(int seat, int y) { return seat == 0 ? y <= 2 : y >= 6; }
        private List<int> Pseudo(GameState s, int from)
        {
            List<int> r = new List<int>();
            string c = Cell(s, from);
            if (c.Length < 2) return r;
            int seat = SideOf(c), x = X(s, from), y = Y(s, from), f = F(seat);
            char t = c.Length > 2 ? c[2] : c[1];
            bool promoted = c.Length > 2 && c[1] == '+';
            Action<int, int> add = delegate (int nx, int ny)
            {
                if (!Inside(s, nx, ny)) return;
                int to = At(s, nx, ny);
                if (SideOf(Cell(s, to)) == seat) return;
                r.Add(to);
            };
            if (promoted && (t == 'P' || t == 'L' || t == 'N' || t == 'S'))
            {
                for (int k = 0; k < 3; k++) for (int m = 0; m < 3; m++)
                {
                    if (k == 1 && m == 1) continue;
                    int ny = y + (m - 1), nx = x + (k - 1);
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
                    for (int ny = y + f; Inside(s, x, ny); ny += f)
                    {
                        if (Cell(s, At(s, x, ny)) != "") { add(x, ny); break; }
                        r.Add(At(s, x, ny));
                    }
                    break;
                case 'N':
                    add(x - 1, y + 2 * f); add(x + 1, y + 2 * f); break;
                case 'S':
                    add(x, y + f); add(x - 1, y + f); add(x + 1, y + f); add(x - 1, y - f); add(x + 1, y - f); break;
                case 'G':
                    add(x, y + f); add(x - 1, y + f); add(x + 1, y + f); add(x - 1, y); add(x + 1, y); add(x, y - f); break;
                case 'K':
                    for (int k = 0; k < 3; k++) for (int m = 0; m < 3; m++) if (k != 1 || m != 1) add(x + k - 1, y + m - 1);
                    break;
                case 'R':
                case 'B':
                    int[][] dirs = t == 'R' ? ORTHO_S : DIAG_S;
                    for (int k = 0; k < dirs.Length; k++)
                    {
                        int nx = x + dirs[k][0], ny = y + dirs[k][1];
                        while (Inside(s, nx, ny))
                        {
                            int to = At(s, nx, ny);
                            if (Cell(s, to) == "") r.Add(to); else { add(nx, ny); break; }
                            nx += dirs[k][0]; ny += dirs[k][1];
                        }
                    }
                    if (promoted)
                        for (int k = 0; k < ORTHO_S.Length; k++)
                            add(x + ORTHO_S[k][0], y + ORTHO_S[k][1]);
                    break;
            }
            return r;
        }
        private static readonly int[][] ORTHO_S = new int[][] { new int[] { 1, 0 }, new int[] { -1, 0 }, new int[] { 0, 1 }, new int[] { 0, -1 } };
        private static readonly int[][] DIAG_S = new int[][] { new int[] { 1, 1 }, new int[] { 1, -1 }, new int[] { -1, 1 }, new int[] { -1, -1 } };
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat) return r;
            for (int i = 0; i < s.Cells.Length; i++)
            {
                if (SideOf(Cell(s, i)) != seat) continue;
                List<int> ps = Pseudo(s, i);
                for (int k = 0; k < ps.Count; k++) r.Add("m:" + i + ">" + ps[k]);
            }
            if (s.Hands.ContainsKey(seat))
                for (int h = 0; h < s.Hands[seat].Count; h++)
                    for (int i = 0; i < s.Cells.Length; i++)
                        if (Cell(s, i) == "") r.Add("d:" + h + ">" + i);
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = Convert.ToString(d["code"]);
            if (!Legal(s, seat).Contains(code)) return MoveResult.Fail("非法着法");
            int[] ij = ParsePair(Cfg.Rest(code), '>');
            if (action == "d")
            {
                int h = ij[0], to = ij[1];
                if (!s.Hands.ContainsKey(seat) || h >= s.Hands[seat].Count) return MoveResult.Fail("无此持驹");
                string pc = s.Hands[seat][h];
                s.Hands[seat].RemoveAt(h);
                s.Cells[to] = SideChar(seat) + pc; s.Last = code;
                Next(s, -1); return MoveResult.Good("打入");
            }
            if (action != "m") return MoveResult.Fail("未知动作");
            int from = ij[0], to2 = ij[1];
            string eaten = Cell(s, to2), piece = Cell(s, from);
            if (eaten == SideChar(1 - seat) + "K") { Finish(s, seat, "取玉，胜"); return MoveResult.Good(); }
            s.Cells[from] = "";
            string baseType = piece.Length > 2 ? piece.Substring(2, 1) : piece.Substring(1, 1);
            if (eaten.Length > 1)
            {
                string e = eaten.Length > 2 ? eaten.Substring(2, 1) : eaten.Substring(1, 1);
                if (!s.Hands.ContainsKey(seat)) s.Hands[seat] = new List<string>();
                s.Hands[seat].Add(e);
            }
            bool canPromote = "PLNSRB".IndexOf(baseType) >= 0;
            bool force = (baseType == "P" || baseType == "L") && (Y(s, to2) == (seat == 0 ? 0 : 8)) ||
                         baseType == "N" && (Y(s, to2) == (seat == 0 ? 0 : 1) || Y(s, to2) == (seat == 0 ? 7 : 8));
            if (canPromote && (force || Promotable(seat, Y(s, from)) || Promotable(seat, Y(s, to2))))
                s.Cells[to2] = SideChar(seat) + "+" + baseType;
            else s.Cells[to2] = piece;
            s.Last = code;
            Next(s, -1); return MoveResult.Good();
        }
    }
}
