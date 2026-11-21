using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Qipai
{
    public sealed class PeakGame : RuleBase
    {
        public override string Id { get { return "diefeng"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 2; } }
        public override string[] Variants { get { return new string[] { "经典", "危峰", "广厦" }; } }

        private static int Height(string c) { return c == null ? 0 : c.Length; }
        private static string Top(string c) { return c != null && c.Length > 0 ? c.Substring(c.Length - 1, 1) : ""; }
        private static string Root(string c) { return c != null && c.Length > 0 ? c.Substring(0, 1) : ""; }
        private static string Me(int seat) { return seat == 0 ? "r" : "b"; }

        private int PeakOf(GameState s) { return OptI(s, "peak", 3); }
        private int TargetOf(GameState s) { return OptI(s, "target", 3); }
        private bool MoveOn(GameState s) { return OptB(s, "allowMove", true); }
        private bool LoneDouble(GameState s) { return OptB(s, "loneDouble", true); }

        private static int[] Arr(GameState s, string k)
        {
            object o; return s.V.TryGetValue(k, out o) ? o as int[] : null;
        }
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            int n = O("boardN", variant == "广厦" ? 7 : 5);
            if (n < 4) n = 4; if (n > 9) n = 9;
            int peak = O("peak", variant == "危峰" ? 4 : 3);
            int target = O("target", variant == "危峰" ? 2 : variant == "广厦" ? 4 : 3);
            int stones = O("stones", variant == "广厦" ? 18 : 12);
            int quota = O("moveQuota", 4);
            SetGrid(s, n, n);
            s.Seats = 2; s.Turn = 0;
            s.V["peak"] = peak;
            s.V["target"] = target;
            s.V["score"] = new int[] { 0, 0 };
            s.V["left"] = new int[] { stones, stones };
            s.V["moves"] = new int[] { quota, quota };
            s.Phase = "playing";
            Phase(s);
            Say(s, "落石可叠任意一格；石满 " + peak + " 层的峰，按四邻石柱的根色多数定归属，未必归堆峰的人");
            return s;
        }

        private bool CanDrop(GameState s, int i) { return Height(Cell(s, i)) < PeakOf(s); }
        private static readonly int[][] NB = new int[][] {
            new int[]{1,0}, new int[]{-1,0}, new int[]{0,1}, new int[]{0,-1}
        };
        private List<int> Neighbors(GameState s, int i)
        {
            List<int> r = new List<int>();
            int x = X(s, i), y = Y(s, i);
            for (int k = 0; k < NB.Length; k++)
                if (Inside(s, x + NB[k][0], y + NB[k][1])) r.Add(At(s, x + NB[k][0], y + NB[k][1]));
            return r;
        }
        private bool HasMove(GameState s, int seat)
        {
            string me = Me(seat);
            for (int i = 0; i < s.Cells.Length; i++)
            {
                if (Top(Cell(s, i)) != me) continue;
                List<int> nb = Neighbors(s, i);
                for (int k = 0; k < nb.Count; k++) if (CanDrop(s, nb[k])) return true;
            }
            return false;
        }

        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat) return r;
            int[] left = Arr(s, "left") ?? new int[] { 0, 0 };
            int[] mv = Arr(s, "moves") ?? new int[] { 0, 0 };
            if (left[seat] > 0)
                for (int i = 0; i < s.Cells.Length; i++) if (CanDrop(s, i)) r.Add("p:" + i);
            if (MoveOn(s) && mv[seat] > 0)
            {
                string me = Me(seat);
                for (int i = 0; i < s.Cells.Length; i++)
                {
                    if (Top(Cell(s, i)) != me) continue;
                    List<int> nb = Neighbors(s, i);
                    for (int k = 0; k < nb.Count; k++)
                        if (CanDrop(s, nb[k])) r.Add("m:" + i + ">" + nb[k]);
                }
            }
            if (r.Count == 0) r.Add("pass");
            return r;
        }

        private bool AllSpent(GameState s)
        {
            int[] left = Arr(s, "left") ?? new int[] { 0, 0 };
            int[] mv = Arr(s, "moves") ?? new int[] { 0, 0 };
            for (int seat = 0; seat < 2; seat++)
            {
                if (left[seat] > 0) return false;
                if (MoveOn(s) && mv[seat] > 0 && HasMove(s, seat)) return false;
            }
            return true;
        }

        private void Phase(GameState s)
        {
            int[] sc = Arr(s, "score") ?? new int[] { 0, 0 };
            int[] left = Arr(s, "left") ?? new int[] { 0, 0 };
            s.PhaseName = "朱 " + sc[0] + " : " + sc[1] + " 墨 · 先得 " + TargetOf(s) +
                " 峰 · 余石 " + left[0] + "/" + left[1];
        }

        private void ResolvePeak(GameState s, int at, int actor)
        {
            int[] sc = Arr(s, "score") ?? new int[] { 0, 0 };
            List<int> nb = Neighbors(s, at);
            int a = 0, b = 0;
            for (int k = 0; k < nb.Count; k++)
            {
                string root = Root(Cell(s, nb[k]));
                if (root == "r") a++;
                else if (root == "b") b++;
            }
            int winner = -1, gain = 0;
            if (a > b && a >= 2) { winner = 0; gain = (a >= 4 && LoneDouble(s)) ? 2 : 1; }
            else if (b > a && b >= 2) { winner = 1; gain = (b >= 4 && LoneDouble(s)) ? 2 : 1; }
            s.Cells[at] = "";
            if (winner < 0) { Say(s, "峰成而四邻根色均势，散石不计"); return; }
            sc[winner] += gain;
            s.V["score"] = sc;
            string nm = winner == 0 ? "朱" : "墨";
            Say(s, "成峰归 " + nm + " · " + (gain == 2 ? "独峰加二" : "得一"));
            if (winner != actor) MarkFeat(s, "borrowed_peak");
            if (gain == 2) MarkFeat(s, "lone_peak");
            if (sc[winner] >= TargetOf(s))
                Finish(s, winner, nm + " 先得 " + TargetOf(s) + " 峰 · 全局终");
        }

        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = J.Str(d, "code", "");
            if (code == "pass")
            {
                if (AllSpent(s))
                {
                    int[] sc = Arr(s, "score") ?? new int[] { 0, 0 };
                    if (sc[0] == sc[1]) Finish(s, -1, "石尽 · 朱墨平分秋色");
                    else Finish(s, sc[0] > sc[1] ? 0 : 1, "石尽 · 峰多者胜");
                }
                else Next(s, -1);
                Phase(s);
                return MoveResult.Good();
            }
            int[] left = Arr(s, "left") ?? new int[] { 0, 0 };
            int[] mv = Arr(s, "moves") ?? new int[] { 0, 0 };
            string me = Me(seat);
            int at = -1;
            if (code.StartsWith("p:"))
            {
                int i;
                if (!int.TryParse(code.Substring(2), out i) || i < 0 || i >= s.Cells.Length || !CanDrop(s, i))
                    return MoveResult.Fail("此处不能再叠石");
                if (left[seat] <= 0) return MoveResult.Fail("手中石已尽");
                left[seat]--; s.V["left"] = left;
                s.Cells[i] = Cell(s, i) + me;
                at = i;
            }
            else if (code.StartsWith("m:"))
            {
                string[] q = code.Substring(2).Split('>');
                int i, j;
                if (q.Length < 2 || !int.TryParse(q[0], out i) || !int.TryParse(q[1], out j) ||
                    i < 0 || i >= s.Cells.Length || j < 0 || j >= s.Cells.Length)
                    return MoveResult.Fail("移石位置不对");
                if (!MoveOn(s) || mv[seat] <= 0) return MoveResult.Fail("本房不许移石，或次数已尽");
                if (Top(Cell(s, i)) != me) return MoveResult.Fail("只能挪自己的顶石");
                if (!Neighbors(s, i).Contains(j) || !CanDrop(s, j)) return MoveResult.Fail("只可挪到相邻且未满的格");
                mv[seat]--; s.V["moves"] = mv;
                string col = Cell(s, i);
                s.Cells[i] = col.Length > 1 ? col.Substring(0, col.Length - 1) : "";
                s.Cells[j] = Cell(s, j) + me;
                at = j;
            }
            else return MoveResult.Fail("未知动作");

            s.Last = code;
            if (at >= 0 && Height(Cell(s, at)) >= PeakOf(s)) ResolvePeak(s, at, seat);
            if (!s.Ended) Next(s, -1);
            Phase(s);
            return MoveResult.Good();
        }

        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            int[] sc = Arr(s, "score") ?? new int[] { 0, 0 };
            int[] left = Arr(s, "left") ?? new int[] { 0, 0 };
            int[] mv = Arr(s, "moves") ?? new int[] { 0, 0 };
            int sd = (seat >= 0 && seat < left.Length) ? seat : 0;
            d["score"] = sc;
            d["left"] = left;
            d["moves"] = mv;
            d["note"] = "石满 " + PeakOf(s) + " 层成峰，四邻根色多者得分；余石 " + left[sd] + " · 挪石 " + mv[sd] + " 次";
            return d;
        }
    }
}
