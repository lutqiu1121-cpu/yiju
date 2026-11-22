using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Qipai
{
    public sealed class OrigSevenGame : RuleBase
    {
        private readonly string id;
        private static long buildCounter = 0;
        public OrigSevenGame(string id) { this.id = id; }
        public override string Id { get { return id; } }
        public override int MinSeats { get { return id == "tingyu" ? 3 : 2; } }
        public override int MaxSeats { get { return id == "tingyu" ? 6 : (id == "shiyi" ? 4 : 2); } }
        public override string[] Variants { get { return new string[] { "常式", "短局", "长局" }; } }
        public override string Renderer { get { return "grid"; } }

        private static readonly string[] NAMES = {
            "候漏", "渡舟", "灯影", "回文笺", "错金", "拾遗", "听雨" };
        private static readonly string[] WORDS = { "山", "水", "云", "月", "风" };

        private string NameOf(GameState s)
        {
            int i = Array.IndexOf(new string[] { "houlou", "duzhou", "dengying", "huiwen", "cuojin", "shiyi", "tingyu" }, id);
            return i >= 0 ? NAMES[i] : "小戏";
        }
        private int Goal(GameState s)
        {
            int baseG = id == "houlou" ? 8 : (id == "shiyi" ? 2 : 3);
            int byOpt = OptI(s, "goal", 0);
            if (byOpt > 0) return byOpt;
            return s.Variant == "短局" ? Math.Max(2, baseG - 1) : (s.Variant == "长局" ? baseG + 2 : baseG);
        }
        private static int[] Scores(GameState s)
        {
            object o; return s.V.TryGetValue("score", out o) ? o as int[] : null;
        }
        private static string[] Cover(GameState s)
        {
            object o;
            if (!s.V.TryGetValue("_cover", out o) || !(o is string[])) { string[] n = new string[s.Seats]; s.V["_cover"] = n; return n; }
            return o as string[];
        }
        private static int Round(GameState s) { return s.V.ContainsKey("round") ? Convert.ToInt32(s.V["round"]) : 0; }
        private static void Bump(GameState s) { s.V["round"] = Round(s) + 1; s.MoveNo = Round(s); }
        private static void Note(GameState s, string t) { s.V["lastNote"] = t; Say(s, t); s.Last = t; }
        private int Rng(GameState s, int n)
        {
            if (n <= 0) return 0;
            long x = s.V.ContainsKey("_r2") ? Convert.ToInt64(s.V["_r2"]) : 20261121L ^ (long)s.Seats;
            x = (x * 6364136223846793005L + 1442695040888963407L) & 0x7FFFFFFFFFFFFFFFL;
            s.V["_r2"] = x;
            return (int)((x >> 17) % (long)n);
        }

        private static int[] SeatOrder(GameState s)
        {
            return Round(s) % 2 == 0 ? new int[] { 0, 1 } : new int[] { 1, 0 };
        }
        private static bool AllCovered(string[] c)
        {
            for (int i = 0; i < c.Length; i++) if (string.IsNullOrEmpty(c[i])) return false;
            return true;
        }
        private static int NextWaiting(string[] c, int from)
        {
            for (int k = 1; k <= c.Length; k++)
            {
                int t = (from + k) % c.Length;
                if (string.IsNullOrEmpty(c[t])) return t;
            }
            return from;
        }
        private int CodeCount(GameState s)
        {
            switch (id)
            {
                case "houlou": return 3;
                case "duzhou": return 4;
                case "dengying": return 7;
                case "huiwen": return 4;
                case "cuojin": return 9;
                case "shiyi": { object o; int[] p = s.V.TryGetValue("piles", out o) ? o as int[] : null; return p == null ? 21 : p.Length; }
                case "tingyu": return 6;
            }
            return 3;
        }
        private string[] Labels(GameState s)
        {
            switch (id)
            {
                case "houlou": return new string[] { "一滴", "两滴", "三滴" };
                case "duzhou": return new string[] { "划头舟", "划中舟", "划尾舟", "缆彼最前舟" };
                case "dengying": return new string[] { "照一", "照二", "照三", "照四", "照五", "照六", "移影" };
                case "huiwen": return new string[] { "第一列", "第二列", "第三列", "第四列" };
                case "cuojin": return new string[] { "一段", "二段", "三段", "四段", "五段", "六段", "七段", "八段", "剪金" };
                case "shiyi":
                {
                    object o; int[] p = s.V.TryGetValue("piles", out o) ? o as int[] : null;
                    string[] a = new string[p == null ? 21 : p.Length];
                    for (int i = 0; i < a.Length; i++)
                        a[i] = p != null && p[i] > 0 ? "取 " + p[i] : "空堆";
                    return a;
                }
                case "tingyu": return new string[] { "一雨", "二雨", "三雨", "四雨", "五雨", "六雨" };
            }
            return new string[] { "落" };
        }
        private bool Banned(GameState s, int seat, int k)
        {
            if (id == "houlou" && s.V.ContainsKey("_ban") && Convert.ToInt32(s.V["_ban"]) == k + 1) return true;
            if (id == "tingyu" && s.V.ContainsKey("_banNum") && Convert.ToInt32(s.V["_banNum"]) == k + 1) return true;
            return false;
        }

        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            if (id == "huiwen") SetGrid(s, 4, 4);
            else if (id == "cuojin") SetGrid(s, 8, 1);
            else if (id == "shiyi") SetGrid(s, 12, 1);
            else if (id == "dengying") SetGrid(s, 6, 1);
            else SetGrid(s, 5, 1);
            s.Seats = seats;
            buildCounter++;
            long seedMix = 20261121L ^ (buildCounter * 2654435761L) ^ (long)s.Room.Length * 7919L;
            s.V["_r2"] = seedMix & 0x7FFFFFFFFFFFFFFFL;
            s.Turn = id == "shiyi" ? Rng(s, seats) : 0;
            s.V["score"] = new int[seats];
            s.V["round"] = 0;
            s.V["goal"] = Goal(s);
            s.V["lastNote"] = "两席各覆一手，同时启看";
            s.V["_cover"] = new string[seats];
            s.V["_ban"] = -1;
            s.V["_banNum"] = -1;
            s.V["_lastSame"] = 0;
            s.V["_lastPick"] = new int[seats];
            s.V["_lastScorer"] = -1;
            s.V["_adv"] = new int[seats];
            switch (id)
            {
                case "duzhou":
                    s.V["boats"] = new int[] { 0, 0, 0, 0, 0, 0 };
                    s.V["boatGoal"] = 3;
                    int[] rp = new int[seats]; for (int q = 0; q < seats; q++) rp[q] = 5;
                    s.V["_rope"] = rp;
                    s.V["_block"] = new int[6];
                    Note(s, "三舟待发 · 可划可缆，先全渡者执桨");
                    break;
                case "dengying":
                {
                    int[] lamps = new int[seats * 3];
                    for (int p = 0; p < seats; p++)
                    {
                        List<int> pool = new List<int> { 0, 1, 2, 3, 4, 5 };
                        for (int k = pool.Count - 1; k > 0; k--) { int j = Rng(s, k + 1); int t = pool[k]; pool[k] = pool[j]; pool[j] = t; }
                        for (int k = 0; k < 3; k++) lamps[p * 3 + k] = pool[k];
                    }
                    s.V["_lamps"] = lamps;
                    s.V["_lit"] = new int[seats];
                    int[] mv = new int[seats]; string[] tr = new string[seats];
                    for (int q = 0; q < seats; q++) { mv[q] = 2; tr[q] = ""; }
                    s.V["_moves"] = mv; s.V["_tried"] = tr;
                    Note(s, "各藏三灯于六格 · 照行照列，先照尽彼灯者胜");
                    break;
                }
                case "huiwen":
                    s.V["cols"] = new int[] { 0, 0, 0, 0, 0, 0, 0, 0 };
                    s.V["_lastSame"] = 0;
                    s.V["word"] = WORDS[0];
                    Note(s, "同字列上叠笺 · 首尾相衔成回文，先得三笺者胜");
                    break;
                case "cuojin":
                    int[] ct = new int[seats]; for (int q = 0; q < seats; q++) ct[q] = 2;
                    s.V["_cut"] = ct;
                    s.V["ring"] = new string[8];
                    Note(s, "八段金丝绕环 · 三连同色得金，可剪断彼金");
                    break;
                case "shiyi":
                {
                    int[] piles = new int[21];
                    for (int i = 0; i < 21; i++) piles[i] = 1 + Rng(s, 9);
                    s.V["piles"] = piles;
                    s.V["tmp"] = new string[seats];
                    Note(s, "公共数堆取遗 · 暂记三数成等差即得笺");
                    break;
                }
                case "tingyu":
                    Note(s, "各暗择雨数 · 唯一最小者听雨得分，重者两湿");
                    break;
                case "houlou":
                    Note(s, "同刻各候、大刻先至、小刻反先 · 先入夜者胜");
                    break;
            }
            return s;
        }

        public override List<string> Legal(GameState s, int seat)
        {
            List<string> a = new List<string>();
            if (s.Ended || seat < 0 || seat >= s.Seats) return a;
            if (id == "shiyi")
            {
                if (s.Turn != seat) return a;
                object o; int[] p = s.V.TryGetValue("piles", out o) ? o as int[] : null;
                if (p == null) return a;
                for (int i = 0; i < p.Length; i++) if (p[i] > 0) a.Add("c:" + i);
                return a;
            }
            string[] cv = Cover(s);
            if (!string.IsNullOrEmpty(cv[seat])) return a;
            int k = CodeCount(s);
            for (int i = 0; i < k; i++)
            {
                if (Banned(s, seat, i)) continue;
                if (id == "dengying" && i == 6 && (s.V["_moves"] as int[])[seat] <= 0) continue;
                if (id == "cuojin" && i == 8 && (s.V["_cut"] as int[])[seat] <= 0) continue;
                a.Add("c:" + i);
            }
            return a;
        }

        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = J.Str(d, "code", "");
            if (code.IndexOf(':') < 0) return MoveResult.Fail("请择一手");
            int k;
            if (!int.TryParse(code.Substring(code.IndexOf(':') + 1), out k)) return MoveResult.Fail("这一手不认识");
            List<string> legal = Legal(s, seat);
            if (!legal.Contains(code)) return MoveResult.Fail("此刻不能这样落");

            if (id == "shiyi") return ActShiyi(s, seat, k);

            string[] cv = Cover(s);
            cv[seat] = k.ToString(CultureInfo.InvariantCulture);
            if (!AllCovered(cv))
            {
                s.Turn = NextWaiting(cv, seat);
                return MoveResult.Good("已覆，候他席");
            }
            int[] picks = new int[cv.Length];
            for (int i = 0; i < cv.Length; i++) picks[i] = int.Parse(cv[i], CultureInfo.InvariantCulture);
            s.V["_lastPick"] = picks.ToArray();
            for (int i = 0; i < cv.Length; i++) cv[i] = "";
            Reveal(s, picks);
            return MoveResult.Good("");
        }

        private void Reveal(GameState s, int[] p)
        {
            switch (id)
            {
                case "houlou": RevealHoulou(s, p); break;
                case "duzhou": RevealDuzhou(s, p); break;
                case "dengying": RevealDengying(s, p); break;
                case "huiwen": RevealHuiwen(s, p); break;
                case "cuojin": RevealCuojin(s, p); break;
                case "tingyu": RevealTingyu(s, p); break;
            }
            Bump(s);
            s.Turn = 0;
            CheckEnd(s);
        }

        private void CheckEnd(GameState s)
        {
            int[] sc = Scores(s); int goal = Goal(s);
            List<int> top = new List<int>(); int mx = -1;
            for (int i = 0; i < sc.Length; i++) if (sc[i] > mx) mx = sc[i];
            for (int i = 0; i < sc.Length; i++) if (sc[i] == mx) top.Add(i);
            bool reached = mx >= goal;
            bool cap = Round(s) >= 40;
            bool boardFull = BoardFull(s);
            if (!reached && !cap && !boardFull) return;
            if (top.Count == 1) Finish(s, top[0], NameOf(s) + " · 第 " + (top[0] == 0 ? "甲" : "乙") + " 席执卷（" + mx + "）");
            else
            {
                int tb = TieBreak(s, top);
                if (tb < 0 && s.V.ContainsKey("_lastScorer")) tb = Convert.ToInt32(s.V["_lastScorer"]);
                if (tb >= 0) Finish(s, tb, NameOf(s) + " · 同分，以据盘多者执卷");
                else
                {
                    string names = string.Join("、", top.Select(x => x == 0 ? "甲" : "乙").ToArray());
                    Finish(s, -1, NameOf(s) + " · " + names + " 同分，言和");
                }
            }
        }
        private int TieBreak(GameState s, List<int> top)
        {
            int[] own = new int[s.Seats];
            if (id == "huiwen" || id == "cuojin")
            {
                for (int i = 0; i < s.Cells.Length; i++)
                {
                    string c = s.Cells[i]; if (string.IsNullOrEmpty(c)) continue;
                    if (c[0] == 'r') own[0]++; else if (c[0] == 'b') own[1]++;
                }
            }
            else if (id == "duzhou")
            {
                int[] b = s.V["boats"] as int[];
                for (int k = 0; k < 3; k++) { own[0] += b[k]; own[1] += b[3 + k]; }
            }
            else if (id == "dengying") { int[] l = s.V["_lit"] as int[]; own[0] = l[0]; own[1] = l[1]; }
            if (id == "duzhou")
            {
                int[] ad = s.V["_adv"] as int[];
                if (ad[0] != ad[1]) return ad[0] > ad[1] ? 0 : 1;
                return Round(s) % 2 == 0 ? 1 : 0;
            }
            if (id != "huiwen" && id != "cuojin" && id != "dengying") return -1;
            int best = -1, bv = -1; bool tie = false;
            foreach (int t in top) { if (own[t] > bv) { bv = own[t]; best = t; tie = false; } else if (own[t] == bv) tie = true; }
            return tie ? -1 : best;
        }
        private bool BoardFull(GameState s)
        {
            if (id == "huiwen" || id == "cuojin")
            {
                for (int i = 0; i < s.Cells.Length; i++) if (string.IsNullOrEmpty(s.Cells[i])) return false;
                return true;
            }
            if (id == "shiyi")
            {
                object o; int[] p = s.V.TryGetValue("piles", out o) ? o as int[] : null;
                if (p == null) return true;
                for (int i = 0; i < p.Length; i++) if (p[i] > 0) return false;
                return true;
            }
            if (id == "duzhou")
            {
                int[] b = s.V["boats"] as int[]; int g = Convert.ToInt32(s.V["boatGoal"]);
                for (int i = 0; i < b.Length; i++) if (b[i] < g) return false;
                return true;
            }
            return false;
        }

        private void RevealHoulou(GameState s, int[] p)
        {
            int a = p[0] + 1, b = p[1] + 1;
            int[] sc = Scores(s);
            string t;
            if (a == b)
            {
                sc[0]++; sc[1]++;
                s.V["_lastSame"] = a == Convert.ToInt32(s.V["_lastSame"]) ? 2 : 1;
                t = "同刻 " + a + " 滴 · 各候一格";
            }
            else if (Math.Abs(a - b) == 1)
            {
                int w = a > b ? 0 : 1; sc[w] += 2;
                s.V["_lastSame"] = 0;
                t = "大刻先至 · " + (w == 0 ? "甲" : "乙") + " 进二格";
            }
            else
            {
                int w = a < b ? 0 : 1; sc[w] += 2;
                s.V["_lastSame"] = 0;
                t = "小刻反先 · " + (w == 0 ? "甲" : "乙") + " 进二格";
            }
            int ban = -1;
            if (a == b && Convert.ToInt32(s.V["_lastSame"]) >= 2) { ban = a; s.V["_lastSame"] = 0; t += " · 下巡禁同刻"; }
            s.V["_ban"] = ban;
            Note(s, t);
        }

        private void RevealDuzhou(GameState s, int[] p)
        {
            int[] b = s.V["boats"] as int[]; int g = Convert.ToInt32(s.V["boatGoal"]);
            int[] sc = Scores(s);
            string t = "";
            int[] rope = s.V["_rope"] as int[];
            int[] block = s.V["_block"] as int[];
            int[] adv = s.V["_adv"] as int[];
            adv[0] = 0; adv[1] = 0;
            bool bothRope = p[0] == 3 && p[1] == 3;
            if (bothRope)
            {
                for (int seat = 0; seat < 2; seat++)
                {
                    int bi = 0, bv = 99;
                    for (int k = 0; k < 3; k++) if (b[seat * 3 + k] < bv) { bv = b[seat * 3 + k]; bi = k; }
                    if (b[seat * 3 + bi] < g) b[seat * 3 + bi]++;
                    t += (seat == 0 ? "甲" : "乙") + "缆落空，各补一舟 ";
                }
            }
            else foreach (int seat in SeatOrder(s))
            {
                int k = p[seat];
                if (k < 3)
                {
                    int idx = seat * 3 + k;
                    if (block[idx] > 0) { block[idx]--; t += (seat == 0 ? "甲" : "乙") + "舟被缆住 "; }
                    else if (b[idx] < g) { b[idx]++; adv[seat]++; t += (seat == 0 ? "甲" : "乙") + "划" + (k + 1) + "舟 "; }
                }
                else
                {
                    int foe = 1 - seat, bi = foe * 3, bv = -1;
                    for (int q = 0; q < 3; q++) if (b[foe * 3 + q] > bv) { bv = b[foe * 3 + q]; bi = foe * 3 + q; }
                    if (rope[seat] > 0) { rope[seat]--; block[bi] = 1; t += (seat == 0 ? "甲" : "乙") + "缆彼最前舟一巡 "; }
                    else { if (b[seat * 3] < g) b[seat * 3]++; t += (seat == 0 ? "甲" : "乙") + "缆尽，改划 "; }
                }
            }
            s.V["_rope"] = rope; s.V["_block"] = block; s.V["_adv"] = adv;
            for (int seat = 0; seat < 2; seat++)
            {
                bool all = true; for (int k = 0; k < 3; k++) if (b[seat * 3 + k] < g) all = false;
                if (all) { sc[seat] = Goal(s); t += (seat == 0 ? "甲" : "乙") + "三舟尽渡 "; }
            }
            Note(s, t.Trim());
        }

        private void RevealDengying(GameState s, int[] p)
        {
            int[] lamps = s.V["_lamps"] as int[]; int[] lit = s.V["_lit"] as int[];
            int[] moves = s.V["_moves"] as int[]; string[] tried = s.V["_tried"] as string[];
            int[] sc = Scores(s);
            string t = "";
            foreach (int seat in SeatOrder(s))
            {
                int k = p[seat];
                int foe = 1 - seat;
                if (k == 6)
                {
                    moves[seat]--;
                    List<int> mine = new List<int>(); for (int q = 0; q < 3; q++) mine.Add(lamps[seat * 3 + q]);
                    for (int q = 0; q < mine.Count; q++)
                    {
                        int cur = mine[q]; bool isLit = cur < 0;
                        if (isLit) continue;
                        int nv = cur + 1 <= 5 ? cur + 1 : cur - 1;
                        if (!mine.Contains(nv)) { lamps[seat * 3 + q] = nv; t += (seat == 0 ? "甲" : "乙") + "移影 "; break; }
                    }
                }
                else
                {
                    string key = k.ToString(CultureInfo.InvariantCulture);
                    if (!tried[seat].Contains("[" + key + "]")) tried[seat] += "[" + key + "]";
                    for (int q = 0; q < 3; q++)
                        if (lamps[foe * 3 + q] == k && lamps[foe * 3 + q] >= 0)
                        {
                            lamps[foe * 3 + q] = -1 - k; lit[seat]++; s.V["_lastScorer"] = seat;
                            t += (seat == 0 ? "甲" : "乙") + "照中彼灯 ";
                            break;
                        }
                }
                if (lit[seat] >= 3) { sc[seat] = Goal(s); t += (seat == 0 ? "甲" : "乙") + "照尽彼灯 "; }
            }
            s.V["_moves"] = moves; s.V["_tried"] = tried;
            Note(s, t.Trim().Length > 0 ? t.Trim() : "两照皆空，灯影未动");
        }

        private void RevealHuiwen(GameState s, int[] p)
        {
            string[] cells = s.Cells; int[] cols = s.V["cols"] as int[];
            string w = WORDS[Round(s) % WORDS.Length];
            s.V["word"] = w;
            int[] sc = Scores(s);
            string t = "本巡字「" + w + "」 · ";
            if (p[0] == p[1])
            {
                int col = p[0]; int idxR = 3 * 4 + col, idxB = col;
                if (string.IsNullOrEmpty(cells[idxR])) cells[idxR] = "x";
                if (string.IsNullOrEmpty(cells[idxB])) cells[idxB] = "x";
                t += "两席争第 " + (col + 1) + " 列，列封";
                Note(s, t); return;
            }
            foreach (int seat in SeatOrder(s))
            {
                int col = p[seat];
                int row = seat == 0 ? 3 - cols[col] : cols[4 + col];
                int idx = row * 4 + col;
                if (row < 0 || row > 3 || !string.IsNullOrEmpty(cells[idx])) { t += (seat == 0 ? "甲" : "乙") + "列满 "; continue; }
                cells[idx] = (seat == 0 ? "r" : "b") + w;
                if (seat == 0) cols[col]++; else cols[4 + col]++;
                if (MakesHuiwen(cells, idx, (seat == 0 ? 'r' : 'b')))
                { sc[seat]++; s.V["_lastScorer"] = seat; t += (seat == 0 ? "甲" : "乙") + "成回文得笺 "; }
                else t += (seat == 0 ? "甲" : "乙") + "落第" + (col + 1) + "列 ";
            }
            Note(s, t.Trim());
        }
        private static bool MakesHuiwen(string[] c, int idx, char me)
        {
            int x = idx % 4, y = idx / 4;
            int[][] dirs = { new int[] { 1, 0 }, new int[] { 0, 1 }, new int[] { 1, 1 }, new int[] { 1, -1 } };
            foreach (int[] d in dirs)
                for (int st = -2; st <= 0; st++)
                {
                    int[] q = new int[3]; bool ok = true;
                    for (int k = 0; k < 3; k++)
                    {
                        int xx = x + (st + k) * d[0], yy = y + (st + k) * d[1];
                        if (xx < 0 || xx > 3 || yy < 0 || yy > 3) { ok = false; break; }
                        q[k] = yy * 4 + xx;
                    }
                    if (!ok || !q.Contains(idx)) continue;
                    if (!string.IsNullOrEmpty(c[q[0]]) && c[q[0]][0] == me &&
                        !string.IsNullOrEmpty(c[q[2]]) && c[q[2]][0] == me &&
                        !string.IsNullOrEmpty(c[q[1]])) return true;
                }
            return false;
        }

        private void RevealCuojin(GameState s, int[] p)
        {
            string[] ring = s.V["ring"] as string[]; int[] cut = s.V["_cut"] as int[];
            int[] sc = Scores(s); string t = "";
            bool[] cutUsed = new bool[2];
            for (int seat = 0; seat < 2; seat++)
            {
                int k = p[seat];
                if (k == 8) { cut[seat]--; cutUsed[seat] = true; }
            }
            for (int seat = 0; seat < 2; seat++) if (cutUsed[seat])
            {
                for (int q = 7; q >= 0; q--)
                    if (ring[q] == (seat == 0 ? "b" : "r")) { ring[q] = ""; t += (seat == 0 ? "甲" : "乙") + "剪断一段 "; break; }
            }
            if (p[0] == p[1] && p[0] < 8 && !cutUsed[0] && !cutUsed[1])
            {
                if (string.IsNullOrEmpty(ring[p[0]])) ring[p[0]] = "x";
                t += "两席争第 " + (p[0] + 1) + " 段，成错";
            }
            else
            {
                for (int seat = 0; seat < 2; seat++)
                {
                    int k = p[seat]; if (k >= 8 || cutUsed[seat]) continue;
                    if (string.IsNullOrEmpty(ring[k])) ring[k] = seat == 0 ? "r" : "b";
                }
            }
            foreach (int seat in SeatOrder(s))
            {
                string me = seat == 0 ? "r" : "b";
                for (int q = 0; q < 8; q++)
                    if (ring[q] == me && ring[(q + 1) % 8] == me && ring[(q + 2) % 8] == me)
                    { sc[seat]++; s.V["_lastScorer"] = seat; ring[q] = ""; ring[(q + 1) % 8] = ""; ring[(q + 2) % 8] = ""; t += (seat == 0 ? "甲" : "乙") + "三连得金 "; break; }
            }
            s.Cells = ring;
            s.V["_cut"] = cut;
            Note(s, t.Trim().Length > 0 ? t.Trim() : "金丝未连，静候下巡");
        }

        private void RevealTingyu(GameState s, int[] p)
        {
            int[] sc = Scores(s); int n = s.Seats;
            int[] cnt = new int[7];
            for (int i = 0; i < n; i++) cnt[p[i] + 1]++;
            int min = 7; for (int k = 1; k <= 6; k++) if (cnt[k] > 0 && k < min) min = k;
            string t = "揭雨 · ";
            for (int i = 0; i < n; i++) t += (i == 0 ? "甲" : (i == 1 ? "乙" : "丙")) + " " + (p[i] + 1) + " ";
            int winner = -1;
            if (min <= 6 && cnt[min] == 1)
            {
                for (int i = 0; i < n; i++) if (p[i] + 1 == min) { winner = i; sc[i]++; break; }
                t += "· 唯一最小 " + min + "，第 " + (winner + 1) + " 席听雨"; s.V["_lastScorer"] = winner;
                s.V["_banNum"] = -1;
            }
            else if (min <= 6)
            {
                t += "· " + min + " 雨重者两湿，下巡禁择";
                s.V["_banNum"] = min;
            }
            else { t += "· 满盘皆湿，本巡无分"; s.V["_banNum"] = -1; }
            Note(s, t.Trim());
        }

        private MoveResult ActShiyi(GameState s, int seat, int k)
        {
            int[] piles = s.V["piles"] as int[]; string[] tmp = s.V["tmp"] as string[];
            int v = piles[k]; piles[k] = 0;
            List<int> my = new List<int>();
            if (!string.IsNullOrEmpty(tmp[seat]))
                foreach (string q in tmp[seat].Split(',')) { int z; if (int.TryParse(q, out z)) my.Add(z); }
            my.Add(v);
            int[] sc = Scores(s); string t = "第 " + (seat + 1) + " 席取 " + v;
            bool got = false;
            for (int a = 0; a < my.Count && !got; a++)
                for (int b = a + 1; b < my.Count && !got; b++)
                    for (int c = b + 1; c < my.Count && !got; c++)
                    {
                        int[] tri = { my[a], my[b], my[c] }; Array.Sort(tri);
                        if (tri[1] - tri[0] == tri[2] - tri[1])
                        {
                            sc[seat]++; s.V["_lastScorer"] = seat; got = true;
                            my.RemoveAt(c); my.RemoveAt(b); my.RemoveAt(a);
                            t += " · " + tri[0] + "," + tri[1] + "," + tri[2] + " 成等差得笺";
                        }
                    }
            if (my.Count > 5) my = my.GetRange(my.Count - 5, 5);
            tmp[seat] = string.Join(",", my.Select(x => x.ToString(CultureInfo.InvariantCulture)).ToArray());
            s.V["tmp"] = tmp;
            Note(s, t);
            Bump(s);
            s.Turn = (seat + 1) % s.Seats;
            CheckEnd(s);
            return MoveResult.Good("");
        }

        public override Dictionary<string, object> View(GameState s, int seat)
        {
            Dictionary<string, object> v = base.View(s, seat);
            Dictionary<string, object> info = v["info"] as Dictionary<string, object>;
            if (info == null) { info = new Dictionary<string, object>(); v["info"] = info; }
            info["orig7"] = id;
            info["title"] = NameOf(s);
            info["labels"] = Labels(s);
            info["round"] = Round(s);
            info["goal"] = Goal(s);
            info["score"] = Scores(s);
            info["lastNote"] = s.V.ContainsKey("lastNote") ? s.V["lastNote"] : "";
            string[] cv = Cover(s);
            int[] covered = new int[cv.Length];
            for (int i = 0; i < cv.Length; i++) covered[i] = string.IsNullOrEmpty(cv[i]) ? 0 : 1;
            info["covered"] = covered;
            info["you"] = seat;
            info["ban"] = id == "houlou" ? (s.V.ContainsKey("_ban") ? Convert.ToInt32(s.V["_ban"]) : -1)
                : (id == "tingyu" && s.V.ContainsKey("_banNum") ? Convert.ToInt32(s.V["_banNum"]) : -1);
            switch (id)
            {
                case "dengying":
                {
                    int[] lamps = s.V["_lamps"] as int[];
                    if (seat >= 0 && seat < lamps.Length / 3)
                    {
                        string[] mine = new string[3];
                        for (int q = 0; q < 3; q++) { int z = lamps[seat * 3 + q]; mine[q] = z < 0 ? "已亮" : "第 " + (z + 1) + " 格"; }
                        info["myLamps"] = mine;
                    }
                    info["lit"] = s.V["_lit"] as int[];
                    info["moves"] = s.V["_moves"] as int[];
                    break;
                }
                case "duzhou": info["boats"] = s.V["boats"] as int[]; info["boatGoal"] = s.V["boatGoal"]; break;
                case "huiwen": info["word"] = s.V["word"]; break;
                case "cuojin": info["cut"] = s.V["_cut"] as int[]; break;
                case "shiyi": info["piles"] = s.V["piles"] as int[]; info["tmp"] = s.V["tmp"] as string[]; break;
            }
            v["legal"] = Legal(s, seat).ToArray();
            return v;
        }

        public override string BotPick(GameState s, int seat, int level, List<string> legal)
        {
            if (legal == null || legal.Count == 0) return "";
            int lv = Math.Max(0, Math.Min(9, level));
            if (lv <= 1) return legal[Rng(s, legal.Count)];
            List<int> ks = new List<int>();
            foreach (string c in legal) { int z; if (int.TryParse(c.Substring(c.IndexOf(':') + 1), out z)) ks.Add(z); }
            if (ks.Count == 0) return legal[0];
            int pick = ks[0];
            switch (id)
            {
                case "houlou":
                {
                    List<int> ok = ks.Where(k => !Banned(s, seat, k)).ToList();
                    if (ok.Count == 0) ok = ks;
                    int[] lp = s.V["_lastPick"] as int[];
                    int foe = lp != null && lp.Length > 1 ? lp[1 - seat] + 1 : 0;
                    int counter = foe == 1 ? 1 : (foe == 2 ? 2 : (foe == 3 ? 0 : -1));
                    pick = lv >= 5 && counter >= 0 && ok.Contains(counter) && Rng(s, 100) < 72
                        ? counter : ok[Rng(s, ok.Count)];
                    break;
                }
                case "duzhou":
                {
                    int[] b = s.V["boats"] as int[];
                    int best = 99, bi = 0;
                    for (int k = 0; k < 3; k++) if (b[seat * 3 + k] < best) { best = b[seat * 3 + k]; bi = k; }
                    pick = lv >= 5 && Rng(s, 100) < 78 ? bi : ks[Rng(s, ks.Count)];
                    break;
                }
                case "dengying":
                {
                    string[] tried = s.V["_tried"] as string[];
                    List<int> fresh = new List<int>();
                    for (int k = 0; k < 6; k++) if (!tried[seat].Contains("[" + k + "]")) fresh.Add(k);
                    pick = lv >= 5 && fresh.Count > 0 && Rng(s, 100) < 78 ? fresh[Rng(s, fresh.Count)] : ks[Rng(s, ks.Count)];
                    break;
                }
                case "huiwen":
                {
                    int[] cw = s.V["cols"] as int[]; int bestC = 0, bv = -1;
                    for (int k = 0; k < 4; k++)
                    {
                        int v = cw[seat == 0 ? k : 4 + k];
                        bool sealedCol = (s.Cells[12 + k] ?? "") == "x" || (s.Cells[k] ?? "") == "x";
                        if (v < 4 && !sealedCol && v > bv) { bv = v; bestC = k; }
                    }
                    int[] lp2 = s.V["_lastPick"] as int[];
                    int foeC = lp2 != null && lp2.Length > 1 ? lp2[1 - seat] : -1;
                    if (foeC >= 0 && bestC == foeC && Rng(s, 100) < 50) bestC = (bestC + 1) % 4;
                    pick = lv >= 5 && bv >= 0 && Rng(s, 100) < 72 ? bestC : ks[Rng(s, ks.Count)];
                    break;
                }
                case "cuojin":
                {
                    string[] ring = s.V["ring"] as string[];
                    List<int> empty = new List<int>();
                    for (int k = 0; k < 8; k++) if (string.IsNullOrEmpty(ring[k])) empty.Add(k);
                    pick = lv >= 5 && empty.Count > 0 && Rng(s, 100) < 74 ? empty[Rng(s, empty.Count)] : ks[Rng(s, ks.Count)];
                    break;
                }
                case "shiyi":
                {
                    int[] piles = s.V["piles"] as int[]; string[] tmp = s.V["tmp"] as string[];
                    List<int> my = new List<int>();
                    if (!string.IsNullOrEmpty(tmp[seat])) foreach (string q in tmp[seat].Split(',')) { int z; if (int.TryParse(q, out z)) my.Add(z); }
                    int bestK = ks[0], bestGap = 99;
                    foreach (int k in ks)
                    {
                        List<int> t = new List<int>(my); t.Add(piles[k]); t.Sort();
                        int gap = 99;
                        for (int a = 0; a < t.Count; a++) for (int b = a + 1; b < t.Count; b++) for (int c = b + 1; c < t.Count; c++)
                            gap = Math.Min(gap, Math.Abs((t[b] - t[a]) - (t[c] - t[b])));
                        if (gap < bestGap) { bestGap = gap; bestK = k; }
                    }
                    pick = lv >= 5 && Rng(s, 100) < 80 ? bestK : ks[Rng(s, ks.Count)];
                    break;
                }
                case "tingyu":
                {
                    List<int> ok = ks.Where(k => !Banned(s, seat, k)).ToList();
                    if (ok.Count == 0) ok = ks;
                    List<int> low = ok.Where(k => k + 1 <= 2).ToList();
                    pick = lv >= 5 && low.Count > 0 && Rng(s, 100) < 70 ? low[Rng(s, low.Count)] : ok[Rng(s, ok.Count)];
                    break;
                }
            }
            string code = "c:" + pick;
            return legal.Contains(code) ? code : legal[0];
        }
    }
}
