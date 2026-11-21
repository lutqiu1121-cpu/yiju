using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Qipai
{
    public sealed class YiJuanGame : RuleBase
    {
        public override string Id { get { return "yijuan"; } }
        public override string Renderer { get { return "scroll"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 2; } }
        public override string[] Variants { get { return new string[] { "常式", "长卷", "短卷" }; } }

        private static int CY(string c) { return c != null && c.Length >= 2 ? c[1] - '0' : 0; }
        private static int CF(string c) { return c != null && c.Length >= 4 ? c[3] - '0' : 0; }
        private static int CM(string c) { return c != null && c.Length >= 6 ? c[5] - '0' : 0; }
        private static string Card(int y, int f, int m)
        { return "Y" + y + "F" + f + "M" + m; }

        private static readonly int[] OPP = { 1, 0, 3, 2 };
        private static readonly int[] FORD = { 3, 0, 2, 1 };
        private static readonly string[] FNAME = { "东", "西", "南", "北" };
        private static readonly int[] FCYCLE = { 0, 2, 1, 3 };
        private static readonly string[][] ROLE_SETS = new string[][] {
            new string[] { "墨翟", "公输般", "扁鹊", "李冰", "荀况", "韩非", "司马迁", "班昭",
                "张衡", "蔡邕", "华佗", "马钧", "裴秀", "祖冲之", "郦道元", "贾思勰",
                "孙思邈", "李淳风", "一行", "沈括", "毕昇", "苏颂", "李诫", "宋慈" },
            new string[] { "郭守敬", "黄道婆", "朱载堉", "徐光启", "宋应星", "徐霞客", "顾炎武", "王夫之",
                "黄宗羲", "戴震", "阮元", "李时珍", "吴又可", "叶桂", "王清任", "燕肃",
                "赵友钦", "王祯", "秦九韶", "李冶", "杨辉", "朱世杰", "程大位", "贾宪" }
        };
        private static int RoleSet(GameState s)
        {
            object o; return s.V.TryGetValue("roleSet", out o) ? Math.Max(0, Math.Min(1, Convert.ToInt32(o))) : 0;
        }
        private static string RoleName(string c, int set)
        {
            if (string.IsNullOrEmpty(c) || c.Length < 4) return "";
            int i = (CY(c) - 1) * 4 + CF(c);
            string[] a = ROLE_SETS[Math.Max(0, Math.Min(1, set))];
            return i >= 0 && i < a.Length ? a[i] : "";
        }
        public static string CardLabel(string c, int set)
        {
            if (string.IsNullOrEmpty(c) || c.Length < 6) return "空简";
            string nm = RoleName(c, set);
            return (nm.Length > 0 ? "「" + nm + "」 · " : "") +
                CY(c) + " 序 · " + FNAME[Math.Max(0, Math.Min(3, CF(c)))] + " · " + CM(c) + " 墨";
        }

        private static List<string> OneDeck()
        {
            List<string> d = new List<string>();
            for (int y = 1; y <= 6; y++)
            {
                int f1 = FCYCLE[(y - 1) % 4];
                int f2 = OPP[f1];
                int m = 4 - (y + 1) / 2;
                d.Add(Card(y, f1, m)); d.Add(Card(y, f2, m));
            }
            return d;
        }

        private static string[] Copy(string[] a)
        {
            string[] r = new string[a.Length];
            Array.Copy(a, r, a.Length);
            return r;
        }
        private static string[] AddCard(string[] a, string c)
        {
            string[] r = new string[a.Length + 1];
            Array.Copy(a, r, a.Length); r[a.Length] = c;
            return r;
        }
        private static string[] DropCard(string[] a, int i)
        {
            List<string> l = new List<string>(a);
            if (i >= 0 && i < l.Count) l.RemoveAt(i);
            return l.ToArray();
        }

        private int LineN(GameState s)
        {
            object o; return s.V.TryGetValue("lineN", out o) ? Convert.ToInt32(o) : 9;
        }
        private int Mid(GameState s) { return (LineN(s) - 1) / 2; }
        private int Line(GameState s)
        {
            object o; return s.V.TryGetValue("line", out o) ? Convert.ToInt32(o) : Mid(s);
        }
        private int[] Ink(GameState s)
        {
            object o; return s.V.TryGetValue("ink", out o) ? o as int[] : new int[] { 0, 0 };
        }
        private int[] Pick(GameState s)
        {
            object o; return s.V.TryGetValue("pick", out o) ? o as int[] : new int[] { 2, 2 };
        }
        private string[] Cover(GameState s)
        {
            object o; return s.V.TryGetValue("cover", out o) ? o as string[] : new string[] { "", "" };
        }
        private string[] Discard(GameState s, int seat)
        {
            object o; string[] a = s.V.TryGetValue("discard" + seat, out o) ? o as string[] : null;
            return a ?? new string[0];
        }
        private string[] PubDiscard(GameState s, int seat)
        {
            object o; string[] a = s.V.TryGetValue("discardPub" + seat, out o) ? o as string[] : null;
            return a ?? new string[0];
        }

        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            int n = O("lineN", variant == "长卷" ? 13 : variant == "短卷" ? 7 : 9);
            if (n < 5) n = 5; if (n > 15) n = 15; if (n % 2 == 0) n++;
            int handN = O("handN", 12);
            if (handN < 8) handN = 8; if (handN > 16) handN = 16;
            int inkStart = O("inkStart", 0);
            int pickLimit = O("pickLimit", 2);
            if (pickLimit < 0) pickLimit = 0; if (pickLimit > 4) pickLimit = 4;
            int roleSet = O("roleSet", 2);
            if (roleSet == 2) roleSet = NextRng(s, 2);
            if (roleSet < 0 || roleSet > 1) roleSet = 0;

            s.Seats = 2; s.Turn = 0; s.Width = n; s.Height = 1;
            s.Cells = new string[n];
            for (int i = 0; i < n; i++) s.Cells[i] = "";

            List<string> pool = OneDeck(); pool.AddRange(OneDeck());
            List<string>[] byY = new List<string>[7];
            for (int y = 0; y <= 6; y++) byY[y] = new List<string>();
            foreach (string c in pool) if (CY(c) >= 1 && CY(c) <= 6) byY[CY(c)].Add(c);
            foreach (List<string> l in byY) Shuffle(s, l);

            int[] k = { 2, 2, 2, 2, 2, 2 };
            int sum = 12, guard = 0;
            while (sum != handN && guard++ < 400)
            {
                int y = NextRng(s, 6);
                if (sum < handN && k[y] < 3) { k[y]++; sum++; }
                else if (sum > handN && k[y] > 1) { k[y]--; sum--; }
            }
            List<string> a = new List<string>(), b = new List<string>();
            for (int y = 1; y <= 6; y++)
            {
                List<string> l = byY[y];
                for (int i = 0; i < l.Count; i++) (i < k[y - 1] ? a : b).Add(l[i]);
            }
            Shuffle(s, a); Shuffle(s, b);
            s.Hands[0] = a; s.Hands[1] = b;

            s.V["lineN"] = n; s.V["line"] = (n - 1) / 2; s.V["mid"] = (n - 1) / 2;
            s.V["roleSet"] = roleSet;
            s.V["discard0"] = new string[0]; s.V["discard1"] = new string[0];
            s.V["discardPub0"] = new string[0]; s.V["discardPub1"] = new string[0];
            s.V["ink"] = new int[] { inkStart, inkStart };
            s.V["pick"] = new int[] { pickLimit, pickLimit };
            s.V["cover"] = new string[] { "", "" };
            s.V["coverFlag"] = new int[] { 0, 0 };
            s.V["round"] = 0;
            s.V["lastA"] = ""; s.V["lastB"] = ""; s.V["lastNote"] = "";
            s.V["stage"] = "cover";
            s.Phase = "playing";
            s.PhaseName = "候覆简 · 两席各择一简";
            Say(s, "双卷夹弈线 " + n + " 格，界墨居中；覆简同时启，抵对方卷端者执卷");
            return s;
        }

        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || seat < 0 || seat > 1) return r;
            string[] cov = Cover(s);
            if (cov[seat].Length > 0) return r;
            int cost = OptI(s, "pickCost", 2);
            int[] ink = Ink(s), pick = Pick(s);
            string[] mine = Discard(s, seat);
            if (ink[seat] >= cost && pick[seat] > 0 && mine.Length > 0)
                for (int i = 0; i < mine.Length; i++) r.Add("r:" + i);
            List<string> h = s.Hands.ContainsKey(seat) ? s.Hands[seat] : new List<string>();
            for (int i = 0; i < h.Count; i++) r.Add("c:" + i);
            if (r.Count == 0) r.Add("pass");
            return r;
        }

        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = J.Str(d, "code", "");
            if (s.Ended) return MoveResult.Fail("全局已散");
            if (seat < 0 || seat > 1) return MoveResult.Fail("旁观者不可覆简");
            string[] cov = Cover(s);
            if (cov[seat].Length > 0) return MoveResult.Fail("此席已覆简，静待启简");

            if (code.StartsWith("r:"))
            {
                int idx;
                if (!int.TryParse(code.Substring(2), out idx)) return MoveResult.Fail("拾简之令不识");
                int cost = OptI(s, "pickCost", 2);
                int[] ink = Ink(s), pick = Pick(s);
                string[] mine = Discard(s, seat);
                if (ink[seat] < cost || pick[seat] <= 0) return MoveResult.Fail("余墨或拾简次数不足");
                if (idx < 0 || idx >= mine.Length) return MoveResult.Fail("弃简区无此简");
                string c = mine[idx];
                s.V["discard" + seat] = DropCard(mine, idx);
                s.Hands[seat].Add(c);
                ink[seat] -= cost; pick[seat] -= 1;
                s.V["ink"] = ink; s.V["pick"] = pick;
                s.MoveNo++;
                Say(s, "第 " + seat + " 席拾简，余墨减 " + cost);
                return MoveResult.Good();
            }
            if (code.StartsWith("c:"))
            {
                int idx;
                if (!int.TryParse(code.Substring(2), out idx)) return MoveResult.Fail("覆简之令不识");
                List<string> h = s.Hands.ContainsKey(seat) ? s.Hands[seat] : new List<string>();
                if (idx < 0 || idx >= h.Count) return MoveResult.Fail("手中无此简");
                string c = h[idx]; h.RemoveAt(idx);
                string[] cover = Cover(s); cover[seat] = c; s.V["cover"] = cover;
                int[] flag = s.V["coverFlag"] as int[]; flag[seat] = 1; s.V["coverFlag"] = flag;
                int other = 1 - seat;
                if (cover[other].Length == 0)
                {
                    s.Turn = other;
                    s.PhaseName = "一席已覆 · 待另一席启简";
                    s.MoveNo++;
                    return MoveResult.Good();
                }
                return Resolve(s);
            }
            if (code == "pass") return MoveResult.Good();
            return MoveResult.Fail("不识此令");
        }

        private MoveResult Resolve(GameState s)
        {
            string[] cover = Cover(s);
            string a = cover[0], b = cover[1];
            int n = LineN(s), mid = Mid(s);
            int line = Line(s);
            int[] ink = Ink(s);

            s.V["discard0"] = AddCard(Discard(s, 0), a);
            s.V["discard1"] = AddCard(Discard(s, 1), b);
            ink[0] += CM(a); ink[1] += CM(b); s.V["ink"] = ink;

            int ca = CY(a), cb = CY(b);
            int boost = OptI(s, "comeback", 2);
            if (boost > 0 && (line == 1 || line == n - 2))
            {
                if (line == 1) ca += boost; else cb += boost;
            }

            int push = 0, pull = 0; bool extra = false;
            string note;
            int fa = CF(a), fb = CF(b);
            if (ca == cb && fa == fb)
            {
                pull = OptI(s, "centerPull", 1);
                note = "同简 · 归中 " + pull + " 格";
                MarkFeat(s, "yijuan_same");
            }
            else if (ca == cb)
            {
                if (fb == OPP[fa])
                {
                    if (OptB(s, "flatClash", true))
                    {
                        push = FORD[fa] > FORD[fb] ? 1 : -1;
                        note = "平序相冲 · 游方定势推线";
                    }
                    else { extra = true; note = "平序相冲 · 各得一墨"; }
                }
                else note = "平序各异 · 两不相推";
            }
            else
            {
                int dir = ca > cb ? 1 : -1;
                if (fa == fb) { extra = true; note = "相承 · 两不推线，各得一墨"; }
                else
                {
                    push = dir;
                    int dt = OptI(s, "diffThresh", 3);
                    if (dt > 0 && Math.Abs(ca - cb) >= dt) push += dir;
                    if (fb == OPP[fa])
                    {
                        push += dir * OptI(s, "clashBonus", 1);
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

            s.V["discardPub0"] = Copy(Discard(s, 0));
            s.V["discardPub1"] = Copy(Discard(s, 1));
            s.V["lastA"] = a; s.V["lastB"] = b; s.V["lastNote"] = note;
            int round = Convert.ToInt32(s.V["round"]) + 1;
            s.V["round"] = round;
            s.V["cover"] = new string[] { "", "" };
            s.V["coverFlag"] = new int[] { 0, 0 };

            Say(s, "第 " + round + " 启简 · 甲" + CardLabel(a, RoleSet(s)) + " / 乙" + CardLabel(b, RoleSet(s)) + " · " + note);
            if (pull > 0 && Math.Abs(line - mid) >= 2) MarkFeat(s, "yijuan_center");
            if (line == n - 1 && ca < cb) MarkFeat(s, "yijuan_comeback");
            if (line == 0 && ca > cb) MarkFeat(s, "yijuan_comeback");

            s.Turn = round % 2;
            s.MoveNo++;
            s.PhaseName = "第 " + (round + 1) + " 巡 · 候覆简 · 界墨 " + line + "/" + (n - 1);

            if (line >= n - 1) { Finish(s, 0, "界墨抵乙卷端 · 甲执卷"); return MoveResult.Good(); }
            if (line <= 0) { Finish(s, 1, "界墨抵甲卷端 · 乙执卷"); return MoveResult.Good(); }
            if (!s.Hands.ContainsKey(0) || s.Hands[0].Count == 0 ||
                !s.Hands.ContainsKey(1) || s.Hands[1].Count == 0)
                FinishByCards(s);
            return MoveResult.Good();
        }

        private void FinishByCards(GameState s)
        {
            int line = Line(s), mid = Mid(s);
            int[] ink = Ink(s);
            bool inkFirst = OptI(s, "endRule", 0) == 1;
            int w = -1; string why = "简尽";
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
                int ta = 0, tb = 0;
                foreach (string c in Discard(s, 0)) ta += CY(c);
                foreach (string c in Discard(s, 1)) tb += CY(c);
                if (ta != tb) { w = ta > tb ? 0 : 1; why = "简尽 · 弃简年序和定次"; }
            }
            if (w < 0) { w = NextRng(s, 2); why = "简尽 · 全同，种子定执卷"; }
            Finish(s, w, why);
        }

        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            d["line"] = Line(s); d["lineN"] = LineN(s); d["mid"] = Mid(s);
            d["round"] = s.V.ContainsKey("round") ? s.V["round"] : 0;
            int[] flag = s.V["coverFlag"] as int[];
            d["covered"] = flag == null ? new int[] { 0, 0 } : (int[])flag.Clone();
            string[] cov = Cover(s);
            d["myCover"] = (seat >= 0 && seat <= 1) ? cov[seat] : "";
            d["ink"] = (int[])Ink(s).Clone();
            d["pick"] = (int[])Pick(s).Clone();
            d["lastA"] = s.V.ContainsKey("lastA") ? s.V["lastA"] : "";
            d["lastB"] = s.V.ContainsKey("lastB") ? s.V["lastB"] : "";
            d["lastNote"] = s.V.ContainsKey("lastNote") ? s.V["lastNote"] : "";
            bool pub = OptB(s, "discardPublic", true);
            d["discardA"] = Copy(PubDiscard(s, 0));
            d["discardB"] = pub ? Copy(PubDiscard(s, 1)) : new string[0];
            if (seat == 0 || seat == 1)
            {
                d["myDiscard"] = Copy(Discard(s, seat));
                d["oppDiscard"] = pub ? Copy(PubDiscard(s, 1 - seat)) : new string[0];
                d["mySeat"] = seat;
            }
            else
            {
                d["myDiscard"] = new string[0];
                d["oppDiscard"] = new string[0];
            }
            int rs = RoleSet(s);
            d["roleSet"] = rs;
            d["roleNames"] = (string[])ROLE_SETS[rs].Clone();
            return d;
        }

        public override string BotPick(GameState s, int seat, int level, List<string> legal)
        {
            List<string> covers = legal.Where(c => c.StartsWith("c:")).ToList();
            List<string> picks = legal.Where(c => c.StartsWith("r:")).ToList();
            int lv = Math.Max(0, Math.Min(6, level));
            int cost = OptI(s, "pickCost", 2);
            int[] ink = Ink(s), pick = Pick(s);
            string[] mine = Discard(s, seat);

            if (lv >= 4 && picks.Count > 0 && ink[seat] >= cost && pick[seat] > 0 && Line(s) != Mid(s))
            {
                int best = -1;
                for (int i = 0; i < mine.Length; i++) if (CY(mine[i]) >= 5) best = i;
                if (best >= 0 && NextRng(s, 3) == 0) return "r:" + best;
            }
            if (covers.Count == 0) return "";
            if (lv <= 1) return covers[NextRng(s, covers.Count)];

            List<string> hand = s.Hands.ContainsKey(seat) ? s.Hands[seat] : new List<string>();
            Func<string, int> year = c => { int i; return int.TryParse(c.Substring(2), out i) && i >= 0 && i < hand.Count ? CY(hand[i]) : 0; };
            Func<string, int> inkOf = c => { int i; return int.TryParse(c.Substring(2), out i) && i >= 0 && i < hand.Count ? CM(hand[i]) : 0; };

            if (lv <= 3)
            {
                string best = covers[0];
                foreach (string c in covers) if (year(c) > year(best)) best = c;
                return best;
            }

            int[] myTotal = new int[7];
            foreach (string c in hand) myTotal[CY(c)]++;
            foreach (string c in Discard(s, seat)) myTotal[CY(c)]++;
            int[] oppTotal = new int[7];
            for (int y = 1; y <= 6; y++) oppTotal[y] = 4 - myTotal[y];
            string[] oppDisc = pubFor(s, seat);
            foreach (string c in oppDisc) if (CY(c) >= 1 && CY(c) <= 6) oppTotal[CY(c)]--;
            List<int> rem = new List<int>();
            for (int y = 1; y <= 6; y++) for (int t = 0; t < Math.Max(0, oppTotal[y]); t++) rem.Add(y);
            int est = rem.Count > 0 ? rem[rem.Count / 2] : 3;

            List<string> win = covers.Where(c => year(c) > est).ToList();
            List<string> pool2 = win.Count > 0 ? win : covers;
            string pickCode = pool2[0];
            foreach (string c in pool2)
                if (year(c) < year(pickCode) || (year(c) == year(pickCode) && inkOf(c) > inkOf(pickCode)))
                    pickCode = c;
            return pickCode;
        }

        private string[] pubFor(GameState s, int seat)
        {
            return OptB(s, "discardPublic", true) ? PubDiscard(s, 1 - seat) : new string[0];
        }

        public override string BotLine(GameState s, int seat)
        {
            string[] lines = { "此简且覆，静待启卷。", "界墨已偏，须早谋。", "弃简可推余牌，莫急。", "卷端相近，且看这一手。" };
            return lines[NextRng(s, lines.Length)];
        }
    }
}
