using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Qipai
{

    internal static class RJ
    {
        public static Dictionary<string, object> Frame(params object[] kv)
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            for (int i = 0; i + 1 < kv.Length; i += 2) d[Convert.ToString(kv[i])] = kv[i + 1];
            return d;
        }
        public static string Str(Dictionary<string, object> d, string k, string def)
        {
            object o;
            if (d == null || !d.TryGetValue(k, out o) || o == null) return def;
            return o as string ?? Convert.ToString(o, CultureInfo.InvariantCulture);
        }
        public static int Int(Dictionary<string, object> d, string k, int def)
        {
            object o;
            if (d == null || !d.TryGetValue(k, out o) || o == null) return def;
            try { return Convert.ToInt32(o, CultureInfo.InvariantCulture); } catch (Exception) { return def; }
        }
        public static bool Bool(Dictionary<string, object> d, string k, bool def)
        {
            object o;
            if (d == null || !d.TryGetValue(k, out o) || o == null) return def;
            if (o is bool) return (bool)o;
            string t = Convert.ToString(o).ToLowerInvariant();
            return t == "true" || t == "1";
        }
    }
    public static class ScriptGateway
    {
        public static Func<object[]> List = delegate { return new object[0]; };
        public static Func<string, Dictionary<string, object>> Get = delegate { return null; };
        public static Func<string, string, Dictionary<string, object>> GetForRoom = delegate { return null; };
    }

    public sealed class ExtraGame : RuleBase
    {
        private readonly string _id;
        public ExtraGame(string id) { _id = id; }
        public override string Id { get { return _id; } }

        private static readonly string[] GRID = { "dots", "hex", "nim", "endgame", "junqi4" };
        private static readonly string[] TABLE = { "gouji", "baohuang", "chudadi", "shuangkou", "showhand", "blackjack" };
        private static readonly string[] PARTY = { "liarsdice", "avalon", "turtlesoup", "mastermind", "drawguess" };
        private static bool In(string[] a, string x) { for (int i = 0; i < a.Length; i++) if (a[i] == x) return true; return false; }

        public override string Renderer
        {
            get { return In(GRID, _id) ? "grid" : In(TABLE, _id) ? "table" : In(PARTY, _id) ? "party" : "party"; }
        }
        public override int MinSeats
        {
            get
            {
                if (_id == "gouji") return 6;
                if (_id == "baohuang") return 5;
                if (_id == "chudadi" || _id == "shuangkou") return 4;
                if (_id == "showhand") return 2;
                if (_id == "blackjack" || _id == "liarsdice") return 2;
                if (_id == "avalon") return 5;
                if (_id == "turtlesoup" || _id == "drawguess") return 3;
                if (_id == "junqi4") return 4;
                if (_id == "mastermind" || _id == "endgame") return 1;
                return 2;
            }
        }
        public override int MaxSeats
        {
            get
            {
                if (_id == "gouji") return 6;
                if (_id == "baohuang") return 5;
                if (_id == "showhand" || _id == "blackjack") return 6;
                if (_id == "liarsdice" || _id == "turtlesoup" || _id == "drawguess") return 8;
                if (_id == "avalon") return 10;
                if (_id == "mastermind") return 2;
                if (_id == "endgame") return 1;
                if (_id == "junqi4" || _id == "chudadi" || _id == "shuangkou") return 4;
                return 2;
            }
        }
        public override string[] Variants
        {
            get
            {
                if (_id == "hex") return new string[] { "7路", "11路" };
                if (_id == "dots") return new string[] { "3×3", "5×5" };
                if (_id == "nim") return new string[] { "3/5/7", "1/3/5/7" };
                if (_id == "endgame") return new string[] { "第一关", "第二关", "第三关" };
                if (_id == "junqi4") return new string[] { "四国暗棋", "四国翻棋" };
                if (_id == "blackjack") return new string[] { "经典", "双副" };
                if (_id == "liarsdice") return new string[] { "经典", "大话+1" };
                if (_id == "avalon") return new string[] { "标准", "快节奏" };
                if (_id == "turtlesoup") return new string[] { "清汤", "重口" };
                if (_id == "mastermind") return new string[] { "4位", "5位" };
                if (_id == "drawguess") return new string[] { "3轮", "5轮" };
                if (_id == "chudadi") return new string[] { "常式", "墨榜", "闲式" };
                if (_id == "shuangkou") return new string[] { "双扣", "百搭" };
                return new string[] { "经典" };
            }
        }
        private bool TeamMode() { return _id == "gouji" || _id == "shuangkou" || _id == "junqi4"; }
        private int TeamOf(int seat, int seats)
        {
            if (_id == "junqi4") return seat % 2;
            return seat % (seats / 2);
        }

        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Game = _id; s.Room = room; s.Seats = seats;
            s.V["hidden"] = _id == "junqi4" && variant != "四国翻棋";
            s.V["score"] = new int[seats];
            s.V["round"] = 1;
            if (In(GRID, _id)) BuildGrid(s, variant, seats);
            else if (In(TABLE, _id)) BuildTable(s, variant, seats);
            else BuildParty(s, variant, seats);
            Say(s, "开局 · " + _id);
            return s;
        }

        private void BuildGrid(GameState s, string variant, int seats)
        {
            if (_id == "dots")
            {
                int n = variant == "5×5" ? 5 : 3;
                SetGrid(s, n * 2 + 1, n * 2 + 1);
                s.V["dn"] = n;
                for (int y = 0; y < s.Height; y++)
                    for (int x = 0; x < s.Width; x++)
                        if ((x % 2 == 1) && (y % 2 == 1)) s.Cells[At(s, x, y)] = ".";
                        else if ((x % 2 == 0) && (y % 2 == 0)) s.Cells[At(s, x, y)] = "+";
                s.PhaseName = "画边占格";
            }
            else if (_id == "hex")
            {
                int n = variant == "11路" ? 11 : 7;
                SetGrid(s, n, n);
                s.V["hn"] = n;
                s.PhaseName = "红连上下 · 蓝连左右";
            }
            else if (_id == "nim")
            {
                int[] heaps = variant == "1/3/5/7" ? new int[] { 1, 3, 5, 7 } : new int[] { 3, 5, 7 };
                SetGrid(s, heaps.Length, 1);
                for (int i = 0; i < heaps.Length; i++) s.Cells[i] = heaps[i].ToString(CultureInfo.InvariantCulture);
                s.V["heaps"] = (int[])heaps.Clone();
                s.PhaseName = "轮流取石子，取到最后一枚者胜";
            }
            else if (_id == "endgame")
            {

                SetGrid(s, 5, 5);
                s.Cells[At(s, 2, 0)] = "bK"; s.Cells[At(s, 2, 4)] = "rK";
                s.Cells[At(s, 0, 2)] = "rR"; s.Cells[At(s, 4, 2)] = "rP";
                int lv = variant == "第二关" ? 2 : variant == "第三关" ? 3 : 1;
                s.V["level"] = lv;
                s.V["solved"] = false;
                s.PhaseName = "残局 " + lv + " · 点出制胜的一手";
                s.V["clue"] = lv == 1 ? "车平中路，逼将抬头" : lv == 2 ? "马跳卧槽，别住象眼" : "兵进九宫，车照将面";
            }
            else if (_id == "junqi4")
            {

                SetGrid(s, 4, 3);
                string[] rank = { "9", "8", "7", "6", "5", "4" };
                for (int seat = 0; seat < 4; seat++)
                {
                    s.Hands[seat] = new List<string>();
                    for (int i = 0; i < 6; i++)
                        s.Hands[seat].Add((variant == "四国翻棋" ? "" : "?") + SideChar(seat) + rank[i]);
                }
                s.V["field"] = -1;
                s.PhaseName = "四国暗棋 · 轮流出子";
            }
        }

        private void BuildTable(GameState s, string variant, int seats)
        {
            int decks = (_id == "gouji" || _id == "shuangkou" || _id == "baohuang") ? 2 : 1;
            decks = O("decks", decks);
            if (_id == "blackjack" && variant == "双副") decks = 2;
            List<string> deck = Cards.Deck(decks, _id != "blackjack" && _id != "showhand");
            Shuffle(s, deck);
            for (int i = 0; i < seats; i++) s.Hands[i] = new List<string>();
            int per = _id == "showhand" ? 5 : _id == "blackjack" ? 2 : 0;
            if (per > 0)
            {
                for (int k = 0; k < per; k++)
                    for (int i = 0; i < seats; i++)
                        if (deck.Count > 0) { s.Hands[i].Add(deck[0]); deck.RemoveAt(0); }
            }
            else
            {
                int j = 0;
                while (deck.Count > 0) { s.Hands[j % seats].Add(deck[0]); deck.RemoveAt(0); j++; }
            }
            for (int i = 0; i < seats; i++) Cards.SortHand(s.Hands[i]);
            s.V["rest"] = deck.ToArray();
            s.V["last"] = new string[0];
            s.V["lastBy"] = -1;
            s.V["passes"] = 0;
            s.V["target"] = _id == "blackjack" ? 21 : 0;
            s.V["bust"] = new bool[seats];
            s.V["stood"] = new bool[seats];
            s.V["dealer"] = 0;
            if (_id == "chudadi")
            {
                s.V["tally"] = new int[seats];
                s.V["round"] = 1;
                s.V["_played"] = new bool[seats];
                s.V["leadPass"] = 0;
                int first = 0;
                for (int i = 0; i < seats; i++) if (s.Hands[i].Contains("D3")) { first = i; break; }
                s.Turn = first;
                if (variant == "墨榜")
                {
                    s.V["tallyNote"] = "剩牌记分 · 累计越 " + OptI(s, "scoreCap", 100) + " 判负 · 余者按积分列次";
                    s.PhaseName = "第 1 盘 · 剩牌记分";
                }
                else if (variant == "闲式") s.PhaseName = "闲式 · 随时可过手";
            }
            if (_id == "shuangkou" && variant == "百搭")
                s.V["wild"] = Cards.RANKS[NextRng(s, Cards.RANKS.Length)];
            s.PhaseName = _id == "blackjack" ? "要牌 / 停牌，别爆 21" :
                _id == "showhand" ? "五品令 · 比牌摊牌" : "轮流出牌，先出完者胜";
            if (_id == "showhand" || _id == "blackjack") s.V["showdown"] = false;
        }

        private static readonly string[] WORDS = {
            "油纸伞", "旧钟", "棋盘", "茶盏", "门槛", "风筝", "砚台", "石桥", "灯笼", "竹帘", "折扇", "雨靴" };
        private static readonly string[] SOUPS = {
            "一个男人走进酒吧，要了一杯水，酒吧老板突然拿出一条蛇，男人道谢后告辞了。为什么？",
            "海龟汤：死者身边只有一堆锯末和一个空盒子，他笑着死去。发生了什么？",
            "女子每天买两份报纸，却从没读过。为什么？" };
        private static readonly string[] SOUP_ANS = { "他在打嗝，蛇吓了一跳就好了", "他是马戏团锯箱子的人，笑着被锯成了两半，盒子空了", "报纸送给楼下看不见的邻居" };
        private static readonly string[][] SOUP_YES = {
            new string[] { "蛇", "嗝", "水", "吓", "惊" },
            new string[] { "锯", "盒子", "马戏", "空", "笑" },
            new string[] { "报纸", "邻居", "盲", "看不见", "送" } };
        private static readonly string[][] SOUP_NO = {
            new string[] { "毒", "杀", "钱", "枪", "仇" },
            new string[] { "毒", "枪", "病", "自杀", "钱" },
            new string[] { "自己看", "收藏", "卖", "识字", "工作" } };
        private static readonly string[] SOUP_TAG = { "清汤", "重口", "清汤" };

        private void BuildParty(GameState s, string variant, int seats)
        {
            s.V["stage"] = 0;
            s.V["votes"] = new int[seats];
            s.V["_voted"] = new bool[seats];
            s.V["voted"] = 0;
            s.V["strokes"] = new string[0];
            s.V["publicText"] = new string[0];
            SetGrid(s, 0, 0);
            if (_id == "liarsdice")
            {
                s.V["dice"] = new int[seats * 5];
                for (int i = 0; i < seats * 5; i++) s.V["dice"] = FillDice(s, (int[])s.V["dice"]);
                s.V["call"] = "0,0";
                s.V["callBy"] = -1;
                s.PhaseName = "摇盅 · 轮流叫点或开盅";
                s.V["hint"] = "叫「N 个 X 点」，怀疑上家就点开盅";
            }
            else if (_id == "avalon")
            {

                int bad = Math.Max(1, seats / 3);
                int[] role = new int[seats];
                for (int i = 0; i < bad; i++) role[i] = 1;
                for (int i = 0; i < seats - 1; i++) { int j = i + 1 + NextRng(s, seats - i - 1); int t = role[i]; role[i] = role[j]; role[j] = t; }
                s.V["_roles"] = role;
                s.V["leader"] = 0;
                s.V["team"] = new int[0];
                int nMission = OptI(s, "missionRounds", variant == "快节奏" ? 2 : 3);
                s.V["missions"] = new int[nMission];
                s.V["needWin"] = nMission;
                s.V["rejectLimit"] = Math.Max(2, OptI(s, "missionRounds", variant == "快节奏" ? 3 : 5));
                s.V["round"] = 1;
                s.V["rejects"] = 0;
                s.PhaseName = "第 1 轮 · 队长组队";
            }
            else if (_id == "turtlesoup")
            {
                List<int> pool = new List<int>();
                for (int i = 0; i < SOUPS.Length; i++)
                    if (variant != "重口" || SOUP_TAG[i] == "重口") pool.Add(i);
                int k = pool[NextRng(s, pool.Count)];
                s.V["_soupIdx"] = k;
                s.V["_answer"] = SOUP_ANS[k];
                s.V["soup"] = SOUPS[k];
                s.V["host"] = 0;
                s.V["asked"] = 0;
                s.V["maxQuestions"] = OptI(s, "rounds", variant == "重口" ? 12 : 18);
                s.PhaseName = "海龟汤 · 只能问是非题（" + (variant == "重口" ? "重口 12 问" : "清汤 18 问") + "）";
            }
            else if (_id == "mastermind")
            {
                int len = variant == "5位" ? 5 : 4;
                string secret = "";
                for (int i = 0; i < len; i++) secret += NextRng(s, 10).ToString(CultureInfo.InvariantCulture);
                s.V["_secret"] = secret;
                s.V["tries"] = new int[seats];
                s.V["maxTries"] = OptI(s, "rounds", 10);
                s.V["len"] = len;
                s.V["history"] = new string[0];
                s.PhaseName = "猜 " + len + " 位数字 · 回你几A几B";
            }
            else if (_id == "drawguess")
            {
                int w = NextRng(s, WORDS.Length);
                s.V["_word"] = WORDS[w];
                s.V["painter"] = 0;
                s.V["round"] = 1;
                s.V["rounds"] = variant == "5轮" ? 5 : 3;
                s.V["score"] = new int[seats];
                s.V["strokes"] = new string[0];
                s.V["guessed"] = false;
                s.PhaseName = "第 1 轮 · 看图画，打字猜词";
            }
        }
        private int[] FillDice(GameState s, int[] a)
        {

            for (int i = 0; i < a.Length; i++)
                if (a[i] == 0) { a[i] = 1 + NextRng(s, 6); break; }
            return a;
        }

        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Phase != "playing") return r;
            if (In(GRID, _id)) return LegalGrid(s, seat, r);
            if (In(TABLE, _id)) return LegalTable(s, seat, r);
            return LegalParty(s, seat, r);
        }

        private List<string> LegalGrid(GameState s, int seat, List<string> r)
        {
            if (seat != s.Turn && _id != "endgame" && _id != "mastermind") return r;
            if (_id == "dots")
            {
                for (int i = 0; i < s.Cells.Length; i++)
                    if (s.Cells[i] == "") r.Add("c:" + i);
                return r;
            }
            if (_id == "hex")
            {
                for (int i = 0; i < s.Cells.Length; i++)
                    if (s.Cells[i] == "") r.Add("c:" + i);
                return r;
            }
            if (_id == "nim")
            {
                for (int h = 0; h < s.Cells.Length; h++)
                {
                    int n; if (!int.TryParse(s.Cells[h], out n) || n <= 0) continue;
                    for (int k = 1; k <= n; k++) r.Add("c:" + h + "," + k);
                }
                return r;
            }
            if (_id == "endgame")
            {
                r.Add("c:0"); r.Add("c:1"); r.Add("c:2");
                return r;
            }
            if (_id == "junqi4")
            {
                List<string> h = s.Hands.ContainsKey(seat) ? s.Hands[seat] : new List<string>();
                for (int i = 0; i < h.Count; i++) r.Add("c:" + i);
                return r;
            }
            return r;
        }

        private List<string> LegalTable(GameState s, int seat, List<string> r)
        {
            if (seat != s.Turn) return r;
            List<string> h = s.Hands.ContainsKey(seat) ? s.Hands[seat] : new List<string>();
            if (_id == "blackjack")
            {
                bool[] stood = s.V["stood"] as bool[];
                if (stood != null && seat < stood.Length && stood[seat]) return r;
                int dealer = OptI(s, "dealer", IntV(s, "dealer", 0));
                if (seat == dealer) { r.Add(DealerHit(s, h) ? "d" : "p"); return r; }
                r.Add("d"); r.Add("p"); r.Add("q");
                return r;
            }
            if (_id == "showhand")
            {
                r.Add("p");
                return r;
            }
            bool lead = !(s.V["lastBy"] != null && Convert.ToInt32(s.V["lastBy"]) >= 0 &&
                          Convert.ToInt32(s.V["lastBy"]) != seat && ((string[])s.V["last"]).Length > 0);
            if (_id == "chudadi" && lead)
            {
                if (Relaxed(s) && IntV(s, "leadPass", 0) < s.Seats) r.Add("p");
                if (Relaxed(s))
                {
                    for (int i = 0; i < h.Count; i++) r.Add("c:" + i);
                    if (h.Count >= 2) r.Add("c:0,1");
                    return r;
                }
                int d3 = h.IndexOf("D3");
                if (d3 >= 0) r.Add("c:" + d3);
                if (h.Count >= 2) r.Add("c:" + (d3 >= 0 ? d3 : 0) + "," + (d3 >= 0 && d3 != 0 ? 0 : 1));
                return r;
            }
            for (int i = 0; i < h.Count; i++) r.Add("c:" + i);
            if (h.Count >= 2) r.Add("c:" + 0 + "," + 1);
            if (!lead) r.Add("p");
            return r;
        }

        private List<string> LegalParty(GameState s, int seat, List<string> r)
        {
            int stage = IntV(s, "stage", 0);
            if (_id == "liarsdice")
            {
                if (seat != s.Turn) return r;
                string call = StrV(s, "call", "0,0");
                string[] c = call.Split(',');
                int cn = c.Length > 0 ? Safe(c[0]) : 0;
                int cv = c.Length > 1 ? Safe(c[1]) : 0;

                for (int num = Math.Max(1, cn); num <= Math.Min(cn + 3, s.Seats * 5); num++)
                    for (int v = 1; v <= 6; v++)
                        if (num > cn || v > cv)
                        {
                            r.Add("b:" + num + "," + v);
                            if (r.Count >= 30) break;
                        }
                if (Convert.ToInt32(s.V["callBy"]) >= 0) r.Add("k");
                return r.Count > 0 ? r : new List<string> { "k" };
            }
            if (_id == "avalon")
            {
                int leader = IntV(s, "leader", 0);
                if (stage == 0 && seat == leader)
                {
                    int[] team0 = s.V["team"] as int[];
                    for (int i = 0; i < s.Seats; i++)
                        if (team0 == null || !team0.Contains(i)) r.Add("c:" + i);
                    return r;
                }
                if (stage == 1)
                {
                    bool[] vd = s.V["_voted"] as bool[];
                    if (vd == null || seat >= vd.Length || !vd[seat]) { r.Add("v:1"); r.Add("v:0"); }
                    return r;
                }
                if (stage == 2)
                {
                    int[] team = s.V["team"] as int[];
                    if (team != null && team.Contains(seat)) { r.Add("v:1"); r.Add("v:0"); }
                    return r;
                }
                return r;
            }
            if (_id == "turtlesoup")
            {
                if (seat == IntV(s, "host", 0)) return r;
                r.Add("say:*"); r.Add("solve:*");
                r.Add("say:是不是和动物有关");
                return r;
            }
            if (_id == "mastermind")
            {
                r.Add("solve:*"); r.Add("n");
                return r;
            }
            if (_id == "drawguess")
            {
                int painter = IntV(s, "painter", 0);
                if (seat == painter)
                {
                    r.Add("draw:*"); r.Add("n");
                }
                else { r.Add("say:*"); r.Add("say:圆圆的"); }
                return r;
            }
            return r;
        }
        internal static int SafePublic(string x) { return Safe(x); }
        private static int Safe(string x) { int n; return int.TryParse(x, out n) ? n : 0; }

        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = d != null && d.ContainsKey("code") ? Convert.ToString(d["code"]) : action;
            if (s.Ended) return MoveResult.Fail("本局已结束");
            if (In(GRID, _id)) return ActGrid(s, seat, code);
            if (In(TABLE, _id)) return ActTable(s, seat, code);
            return ActParty(s, seat, code);
        }

        private MoveResult ActGrid(GameState s, int seat, string code)
        {
            if (_id == "endgame")
            {
                int pick = Safe(code.Substring(code.IndexOf(':') + 1));
                int level = IntV(s, "level", 1);
                int right = (level * 7 + s.Seats) % 3;
                if (pick == right)
                {
                    s.V["solved"] = true; s.Last = "c:" + pick;
                    Finish(s, seat, "残局破解 · 第 " + level + " 关过关");
                    return MoveResult.Good("破解成功");
                }
                Say(s, "这手还差一点，再想想");
                return MoveResult.Fail("还差一点 · " + StrV(s, "clue", ""));
            }
            if (seat != s.Turn) return MoveResult.Fail("还没轮到你");
            if (_id == "dots")
            {
                int i; if (!code.StartsWith("c:") || !int.TryParse(code.Substring(2), out i) || i < 0 || i >= s.Cells.Length || s.Cells[i] != "")
                    return MoveResult.Fail("这里不能画");
                s.Cells[i] = SideChar(seat);
                s.Last = code;
                int made = 0;

                for (int dy = -1; dy <= 1; dy += 2)
                    for (int dx = -1; dx <= 1; dx += 2)
                    {
                        int cx = X(s, i) + dx, cy = Y(s, i) + dy;
                        if (cx < 1 || cy < 1 || cx >= s.Width - 1 || cy >= s.Height - 1) continue;
                        if (cx % 2 != 1 || cy % 2 != 1) continue;
                        if (s.Cells[At(s, cx, cy)] != ".") continue;
                        if (s.Cells[At(s, cx - 1, cy)] != "" && s.Cells[At(s, cx + 1, cy)] != "" &&
                            s.Cells[At(s, cx, cy - 1)] != "" && s.Cells[At(s, cx, cy + 1)] != "")
                        {
                            s.Cells[At(s, cx, cy)] = SideChar(seat) + "*";
                            int[] sc = s.V["score"] as int[];
                            if (sc != null && seat < sc.Length) sc[seat]++;
                            made++;
                        }
                    }
                int empty = 0;
                for (int k = 0; k < s.Cells.Length; k++) { if (s.Cells[k] == "") empty++; }
                if (empty == 0)
                {
                    int[] sc = s.V["score"] as int[];
                    int best = 0; for (int k = 1; k < sc.Length; k++) if (sc[k] > sc[best]) best = k;
                    Finish(s, best, "点格棋终局 · 占格 " + string.Join(":", sc.Select(x => x.ToString()).ToArray()));
                }
                else if (made == 0) Next(s, -1);
                else Say(s, "围成一格，再走一手");
                return MoveResult.Good(made > 0 ? "占了一格" : "");
            }
            if (_id == "hex")
            {
                int i; if (!code.StartsWith("c:") || !int.TryParse(code.Substring(2), out i) || i < 0 || i >= s.Cells.Length || s.Cells[i] != "")
                    return MoveResult.Fail("这里已有子");
                s.Cells[i] = SideChar(seat);
                s.Last = code;
                if (HexWin(s, seat)) { Finish(s, seat, (seat == 0 ? "红" : "蓝") + "方贯通两边"); return MoveResult.Good(); }
                bool full = true; for (int k = 0; k < s.Cells.Length; k++) if (s.Cells[k] == "") { full = false; break; }
                if (full)
            {

                int w = HexWin(s, 0) ? 0 : HexWin(s, 1) ? 1 : 1;
                Finish(s, w, "落满全盘 · " + (w == 0 ? "红" : "蓝") + "方贯通");
                return MoveResult.Good();
            }
                Next(s, -1);
                return MoveResult.Good();
            }
            if (_id == "nim")
            {
                string[] p = code.Substring(2).Split(',');
                if (p.Length < 2) return MoveResult.Fail("选一堆和数量");
                int h = Safe(p[0]), k = Safe(p[1]);
                int cur; if (h < 0 || h >= s.Cells.Length || !int.TryParse(s.Cells[h], out cur) || k <= 0 || k > cur)
                    return MoveResult.Fail("这一堆不能这么取");
                s.Cells[h] = (cur - k).ToString(CultureInfo.InvariantCulture);
                s.Last = code;
                int left = 0; for (int j = 0; j < s.Cells.Length; j++) left += Safe(s.Cells[j]);
                if (left == 0)
                {
                    bool misere = OptS(s, "mode", "classic") == "misere";
                    Finish(s, misere ? 1 - seat : seat,
                        misere ? "Nim 反常局 · 取到最后一枚者负" : "Nim 正常局 · 取到最后一枚者胜");
                    return MoveResult.Good();
                }
                Next(s, -1);
                return MoveResult.Good();
            }
            if (_id == "junqi4")
            {
                int idx; if (!code.StartsWith("c:") || !int.TryParse(code.Substring(2), out idx)) return MoveResult.Fail("选一枚暗子");
                List<string> h = s.Hands[seat];
                if (idx < 0 || idx >= h.Count) return MoveResult.Fail("没有这枚子");
                string card = h[idx]; h.RemoveAt(idx);
                int val = Safe(card.Substring(card.Length - 1));
                s.V["field"] = seat; s.V["fieldVal"] = val;
                s.V["fieldCard"] = card;
                Say(s, "座位 " + seat + " 出了一枚暗子");
                if (h.Count == 0)
                {

                    int t = TeamOf(seat, s.Seats);
                    List<int> win = new List<int>();
                    for (int i = 0; i < s.Seats; i++) if (TeamOf(i, s.Seats) == t) win.Add(i);
                    FinishTeam(s, win, "队伍 " + t + " 先出完暗子");
                }
                else Next(s, -1);
                return MoveResult.Good();
            }
            return MoveResult.Fail("未知动作");
        }

        private bool HexWin(GameState s, int seat)
        {
            int n = s.Width; string p = SideChar(seat);
            bool[] seen = new bool[n * n];
            Queue<int> q = new Queue<int>();
            for (int i = 0; i < n; i++)
            {
                int start = seat == 0 ? i : i * n;
                int idx = seat == 0 ? start : start;
                if (Cell(s, idx) == p) { seen[idx] = true; q.Enqueue(idx); }
            }
            int[][] dirs = { new[]{1,0}, new[]{-1,0}, new[]{0,1}, new[]{0,-1}, new[]{1,-1}, new[]{-1,1} };
            while (q.Count > 0)
            {
                int cur = q.Dequeue(); int x = X(s, cur), y = Y(s, cur);
                if (seat == 0 ? y == n - 1 : x == n - 1) return true;
                for (int k = 0; k < dirs.Length; k++)
                {
                    int nx = x + dirs[k][0], ny = y + dirs[k][1];
                    if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
                    int ni = At(s, nx, ny);
                    if (!seen[ni] && Cell(s, ni) == p) { seen[ni] = true; q.Enqueue(ni); }
                }
            }
            return false;
        }

        private MoveResult ActTable(GameState s, int seat, string code)
        {
            if (seat != s.Turn) return MoveResult.Fail("还没轮到你");
            List<string> h = s.Hands[seat];
            if (_id == "blackjack")
            {
                bool[] stood = s.V["stood"] as bool[];
                bool[] bust = s.V["bust"] as bool[];
                if (code == "d")
                {
                    string[] rest = s.V["rest"] as string[];
                    List<string> deck = rest == null ? new List<string>() : new List<string>(rest);
                    if (deck.Count > 0) { h.Add(deck[0]); deck.RemoveAt(0); s.V["rest"] = deck.ToArray(); }
                    if (Bj(s, h) > 21) { bust[seat] = true; stood[seat] = true; Say(s, "座位 " + seat + " 爆了"); }
                }
                else if (code == "p") stood[seat] = true;
                else if (code == "q")
                {
                    string[] qr = s.V["rest"] as string[];
                    List<string> qd = qr == null ? new List<string>() : new List<string>(qr);
                    if (qd.Count > 0) { h.Add(qd[0]); qd.RemoveAt(0); s.V["rest"] = qd.ToArray(); }
                    if (Bj(s, h) > 21) { bust[seat] = true; Say(s, "座位 " + seat + " 双倍后爆了"); }
                    stood[seat] = true; s.V["double" + seat] = true;
                }
                else return MoveResult.Fail("只能要牌 / 停牌 / 双倍");
                s.Last = code;
                Next(s, -1);
                bool all = true; for (int i = 0; i < stood.Length; i++) if (!stood[i]) { all = false; break; }
                if (all) FinishBj(s);
                return MoveResult.Good();
            }
            if (_id == "showhand")
            {
                s.V["showdown"] = true;
                int best = 0; int[] bv = null;
                List<int> tie = new List<int>();
                string[] names = { "高牌", "一对", "两对", "三条", "顺子", "同花", "葫芦", "四条", "同花顺" };
                for (int i = 0; i < s.Seats; i++)
                {
                    List<string> hh = s.Hands.ContainsKey(i) ? s.Hands[i] : new List<string>();
                    int[] v = PokerRank(hh);
                    if (bv == null || CmpRank(v, bv) > 0) { bv = v; best = i; tie.Clear(); tie.Add(i); }
                    else if (CmpRank(v, bv) == 0) tie.Add(i);
                }
                string typeName = bv != null ? names[Math.Max(0, Math.Min(names.Length - 1, bv[0]))] : "";
                if (tie.Count > 1) FinishTeam(s, tie, "摊牌 · " + typeName + " 平分共分");
                else Finish(s, best, "摊牌 · 座位 " + best + " " + typeName + " 最大");
                return MoveResult.Good();
            }

            if (code == "p")
            {
                string[] lp = s.V["last"] as string[];
                int lby = Convert.ToInt32(s.V["lastBy"]);
                bool isLead = !(lp != null && lp.Length > 0 && lby >= 0 && lby != seat);
                if (isLead && Relaxed(s))
                {
                    s.V["leadPass"] = IntV(s, "leadPass", 0) + 1;
                    Next(s, -1); return MoveResult.Good("过");
                }
                int passes = IntV(s, "passes", 0) + 1; s.V["passes"] = passes;
                if (passes >= s.Seats - 1) { s.V["last"] = new string[0]; s.V["lastBy"] = -1; s.V["passes"] = 0; }
                Next(s, -1); return MoveResult.Good("过");
            }
            List<int> idx = new List<int>();
            string body = code.StartsWith("c:") ? code.Substring(2) : "";
            foreach (string x in body.Split(',')) if (x.Trim().Length > 0) idx.Add(Safe(x.Trim()));
            List<string> play = Cards.Take(s, s.Hands, seat, idx);
            if (play == null || play.Count == 0) return MoveResult.Fail("选牌无效");
            string[] last = s.V["last"] as string[];
            int lastBy = Convert.ToInt32(s.V["lastBy"]);
            bool wasLead = !(last != null && last.Length > 0 && lastBy >= 0 && lastBy != seat);
            if (last != null && last.Length > 0 && lastBy >= 0 && lastBy != seat)
            {
                if (play.Count != last.Length || PlayVal(s, play[play.Count - 1]) <= PlayVal(s, last[last.Length - 1]))
                    return MoveResult.Fail("压不过上一手");
            }
            if (_id == "chudadi" && wasLead && !Relaxed(s))
            {
                bool hasD3 = false; for (int i = 0; i < play.Count; i++) if (play[i] == "D3") hasD3 = true;
                if (s.Variant == "常式" && !hasD3) return MoveResult.Fail("常式首出须带杏三");
            }
            Cards.SortHand(play);
            s.V["last"] = play.ToArray(); s.V["lastBy"] = seat; s.V["passes"] = 0;
            s.V["leadPass"] = 0;
            object po; bool[] pl = s.V.TryGetValue("_played", out po) ? po as bool[] : null;
            if (pl != null && seat < pl.Length) pl[seat] = true;
            s.Last = code;
            if (h.Count == 0)
            {
                if (_id == "chudadi" && s.Variant == "墨榜") return ScoreAndContinue(s, seat);
                if (TeamMode())
                {
                    int t = TeamOf(seat, s.Seats);
                    List<int> win = new List<int>();
                    for (int i = 0; i < s.Seats; i++) if (TeamOf(i, s.Seats) == t) win.Add(i);
                    FinishTeam(s, win, "队伍 " + t + " 先出完");
                }
                else Finish(s, seat, "座位 " + seat + " 先出完");
                return MoveResult.Good();
            }
            Next(s, -1);
            return MoveResult.Good();
        }
        private bool Relaxed(GameState s)
        {
            return _id == "chudadi" && (s.Variant == "闲式" || OptB(s, "freePass", false));
        }
        private static int CardPts(string c)
        {
            if (c == "J1" || c == "J2") return 15;
            string r = Cards.Rank(c);
            if (r == "A") return 11;
            if (r == "2") return 12;
            if (r == "K" || r == "Q" || r == "J" || r == "10") return 10;
            int v; return int.TryParse(r, out v) ? v : 1;
        }
        private int RestScore(GameState s, int seat, string mode, bool hold2, bool unplayed, bool[] played)
        {
            List<string> h = s.Hands.ContainsKey(seat) ? s.Hands[seat] : new List<string>();
            int n = h.Count, pts;
            if (mode == "flat") pts = n;
            else if (mode == "point") { pts = 0; for (int k = 0; k < n; k++) pts += CardPts(h[k]); }
            else pts = n < 8 ? n : n < 10 ? n * 2 : n < 13 ? n * 3 : n * 4;
            if (hold2 && n >= 8)
            {
                for (int k = 0; k < n; k++) if (Cards.Rank(h[k]) == "2") { pts *= 2; break; }
            }
            if (unplayed && played != null && seat < played.Length && !played[seat]) pts *= 2;
            return pts;
        }
        private MoveResult ScoreAndContinue(GameState s, int winnerSeat)
        {
            int cap = Math.Max(20, OptI(s, "scoreCap", 100));
            string mode = OptS(s, "scoreMode", "ladder");
            bool hold2 = OptB(s, "holdTwoDouble", false);
            bool unplayed = OptB(s, "unplayedDouble", false);
            object po, to;
            bool[] played = s.V.TryGetValue("_played", out po) ? po as bool[] : null;
            int[] tally = s.V.TryGetValue("tally", out to) ? to as int[] : null;
            if (tally == null || tally.Length != s.Seats) { tally = new int[s.Seats]; s.V["tally"] = tally; }
            int round = IntV(s, "round", 1);
            List<string> parts = new List<string>();
            for (int i = 0; i < s.Seats; i++)
            {
                int pts = RestScore(s, i, mode, hold2, unplayed, played);
                tally[i] += pts;
                parts.Add("第 " + i + " 席 +" + pts);
            }
            Say(s, "第 " + round + " 盘 · " + string.Join(" / ", parts.ToArray()) +
                " · 累计 " + string.Join("/", tally.Select(x => x.ToString(CultureInfo.InvariantCulture)).ToArray()));
            bool over = false; int hi = 0, lo = 0;
            for (int i = 0; i < s.Seats; i++)
            {
                if (tally[i] >= cap) over = true;
                if (tally[i] > tally[hi]) hi = i;
                if (tally[i] < tally[lo]) lo = i;
            }
            List<int> order = new List<int>();
            for (int i = 0; i < s.Seats; i++) order.Add(i);
            order.Sort((a, b) => tally[a].CompareTo(tally[b]));
            List<string> rank = new List<string>();
            for (int k = 0; k < order.Count; k++)
                rank.Add("第 " + order[k] + " 席 " + tally[order[k]] + " 分");
            string line = string.Join(" < ", rank.ToArray());
            if (over)
            {
                List<int> best = new List<int>();
                for (int i = 0; i < s.Seats; i++) if (tally[i] == tally[lo]) best.Add(i);
                string res = "第 " + round + " 盘 · 第 " + hi + " 席越 " + cap + " 分判负 · " + line + " · 分最少者胜";
                if (best.Count > 1) FinishTeam(s, best, res); else Finish(s, lo, res);
                Say(s, res);
                return MoveResult.Good(res);
            }
            int next = round + 1;
            s.V["round"] = next;
            Redeal(s);
            s.PhaseName = "第 " + next + " 盘 · 越 " + cap + " 分者判负";
            s.V["tallyNote"] = "第 " + next + " 盘 · 剩牌记分 · 累计越 " + cap + " 判负 · 余者按积分列次";
            return MoveResult.Good("第 " + next + " 盘");
        }
        private void Redeal(GameState s)
        {
            int decks = Math.Max(1, OptI(s, "decks", 1));
            List<string> deck = Cards.Deck(decks, true);
            Shuffle(s, deck);
            for (int i = 0; i < s.Seats; i++) s.Hands[i] = new List<string>();
            int j = 0;
            while (deck.Count > 0) { s.Hands[j % s.Seats].Add(deck[0]); deck.RemoveAt(0); j++; }
            for (int i = 0; i < s.Seats; i++) Cards.SortHand(s.Hands[i]);
            s.V["rest"] = deck.ToArray();
            s.V["last"] = new string[0];
            s.V["lastBy"] = -1;
            s.V["passes"] = 0;
            s.V["leadPass"] = 0;
            s.V["_played"] = new bool[s.Seats];
            s.Last = "";
            int first = 0;
            for (int i = 0; i < s.Seats; i++) if (s.Hands[i].Contains("D3")) { first = i; break; }
            s.Turn = first;
        }

        private static int PlayVal(GameState s, string c)
        {
            string w = StrV(s, "wild", "");
            return w.Length > 0 && Cards.Rank(c) == w ? 20 : Cards.Val(c);
        }
        private static int Bj(GameState s, List<string> h)
        {
            int t = 0, aces = 0;
            for (int i = 0; i < h.Count; i++)
            {
                string r = Cards.Rank(h[i]);
                int v = r == "A" ? 11 : (r == "J" || r == "Q" || r == "K" || r == "10") ? 10 : Safe(r);
                if (r == "A") aces++;
                t += v;
            }
            while (t > 21 && aces > 0) { t -= 10; aces--; }
            return t;
        }
        private static bool IsSoft(GameState s, List<string> h, int total)
        {
            if (total != 17) return false;
            for (int i = 0; i < h.Count; i++) if (Cards.Rank(h[i]) == "A") return true;
            return false;
        }
        private static bool DealerHit(GameState s, List<string> h)
        {
            int v = Bj(s, h);
            if (v < 17) return true;
            if (v == 17 && IsSoft(s, h, v) && OptS(s, "dealer17", "S17") == "H17") return true;
            return false;
        }
        private static void FinishBj(GameState s)
        {
            bool[] bust = s.V["bust"] as bool[];
            int dealer = OptI(s, "dealer", IntV(s, "dealer", 0));
            List<int> win = new List<int>(); int[] score = new int[s.Seats];
            string payout = OptS(s, "payout", "3:2");
            int dv = bust != null && dealer < bust.Length && bust[dealer] ? -1 : Bj(s, s.Hands[dealer]);
            List<string> parts = new List<string>();
            for (int i = 0; i < s.Seats; i++)
            {
                if (i == dealer) continue;
                List<string> h = s.Hands.ContainsKey(i) ? s.Hands[i] : new List<string>();
                int pv = bust != null && i < bust.Length && bust[i] ? -1 : Bj(s, h);
                bool natural = h.Count == 2 && pv == 21;
                bool doubled = s.V.ContainsKey("double" + i) && Convert.ToBoolean(s.V["double" + i]);
                int stake = doubled ? 2 : 1, gain = 0; string tag;
                if (pv < 0) { gain = -stake; tag = "爆牌"; }
                else if (dv < 0) { gain = stake; win.Add(i); tag = "主家爆牌"; }
                else if (pv > dv) { gain = natural ? (payout == "6:5" ? stake * 6 / 5 : stake * 3 / 2) : stake; win.Add(i); tag = natural ? "Blackjack" : "点数胜"; }
                else if (pv == dv) { gain = 0; tag = "Push"; }
                else { gain = -stake; tag = "点数负"; }
                score[i] = gain;
                parts.Add("座位" + i + " " + pv + " " + tag + (gain > 0 ? " +" + gain : gain < 0 ? " " + gain : ""));
            }
            s.V["_bjScore"] = score;
            string head = "主家 " + dealer + " 点数 " + (dv < 0 ? "爆牌" : dv.ToString()) + " · " + OptS(s, "dealer17", "S17") + " · 记分比例 " + payout;
            string tail = string.Join(" / ", parts.ToArray());
            if (win.Count > 0) FinishTeam(s, win, head + " · " + tail);
            else Finish(s, dealer, head + " · 主家通吃 · " + tail);
        }
        private static int PV(string c)
        {
            string r = Cards.Rank(c);
            if (r == "A") return 14;
            if (r == "K") return 13;
            if (r == "Q") return 12;
            if (r == "J") return 11;
            int n; return int.TryParse(r, out n) ? n : (r == "2" ? 2 : 0);
        }
        private static int KeyOf(Dictionary<int, int> c, int n)
        {
            int best = 0;
            foreach (KeyValuePair<int, int> kv in c) if (kv.Value == n && kv.Key > best) best = kv.Key;
            return best;
        }
        private static int[] PokerRank(List<string> h)
        {
            List<int> v = h.Select(PV).ToList(); v.Sort(); v.Reverse();
            Dictionary<int, int> c = new Dictionary<int, int>();
            for (int i = 0; i < h.Count; i++) { int x = PV(h[i]); if (!c.ContainsKey(x)) c[x] = 0; c[x]++; }
            bool flush = false;
            foreach (string su in Cards.SUITS) if (h.Count(x => Cards.Suit(x) == su) == 5) { flush = true; break; }
            List<int> uq = c.Keys.OrderByDescending(x => x).ToList();
            if (uq.Contains(14)) uq.Add(1);
            uq = uq.Distinct().OrderByDescending(x => x).ToList();
            int sh = 0;
            for (int k = 0; k + 4 < uq.Count; k++) if (uq[k] - uq[k + 4] == 4) { sh = uq[k]; break; }
            int[] g = c.Values.OrderByDescending(x => x).ToArray();
            int type = 0, tie = 0;
            if (sh > 0 && flush) { type = 8; tie = sh; }
            else if (g.Length > 0 && g[0] == 4) { type = 7; tie = KeyOf(c, 4); }
            else if (g.Length > 1 && g[0] == 3 && g[1] >= 2) { type = 6; tie = KeyOf(c, 3); }
            else if (flush) type = 5;
            else if (sh > 0) { type = 4; tie = sh; }
            else if (g.Length > 0 && g[0] == 3) { type = 3; tie = KeyOf(c, 3); }
            else if (g.Length > 1 && g[0] == 2 && g[1] == 2) { type = 2; tie = Math.Max(KeyOf(c, 2), uq.Count > 1 ? uq[1] : 0); }
            else if (g.Length > 0 && g[0] == 2) { type = 1; tie = KeyOf(c, 2); }
            List<int> ret = new List<int> { type, tie };
            for (int i = 0; i < v.Count && ret.Count < 7; i++) ret.Add(v[i]);
            while (ret.Count < 7) ret.Add(0);
            return ret.ToArray();
        }
        private static int CmpRank(int[] a, int[] b)
        {
            int n = Math.Max(a.Length, b.Length);
            for (int i = 0; i < n; i++) { int x = i < a.Length ? a[i] : 0, y = i < b.Length ? b[i] : 0; if (x != y) return x.CompareTo(y); }
            return 0;
        }
        private static int HandVal(List<string> h)
        {
            int[] r = PokerRank(h);
            return r[0] * 1000000 + r[1] * 10000 + r[2] * 100 + r[3];
        }

        private MoveResult ActParty(GameState s, int seat, string code)
        {
            int stage = IntV(s, "stage", 0);
            if (_id == "liarsdice")
            {
                if (seat != s.Turn) return MoveResult.Fail("还没轮到你");
                if (code == "k")
                {
                    string[] c = StrV(s, "call", "0,0").Split(',');
                    int num = c.Length > 0 ? Safe(c[0]) : 0, val = c.Length > 1 ? Safe(c[1]) : 0;
                    int[] dice = s.V["dice"] as int[];
                    bool plusOne = s.Variant == "大话+1";
                    int real = 0;
                    for (int i = 0; i < dice.Length; i++)
                        if (plusOne || val == 1) { if (dice[i] == val) real++; }
                        else if (dice[i] == val || dice[i] == 1) real++;
                    if (plusOne) real++;
                    int caller = Convert.ToInt32(s.V["callBy"]);
                    int loser = real >= num ? seat : caller;
                    Say(s, "开盅：实际 " + real + " 个 " + val + " 点");
                    int[] sc = s.V["score"] as int[]; sc[loser]--;

                    int[] nd = new int[s.Seats * 5];
                    for (int i = 0; i < nd.Length; i++) nd[i] = 1 + NextRng(s, 6);
                    s.V["dice"] = nd; s.V["call"] = "0,0"; s.V["callBy"] = -1;
                    int round = IntV(s, "round", 1) + 1; s.V["round"] = round;
                if (round > OptI(s, "rounds", 5))
                    {
                        int best = 0; for (int i = 1; i < sc.Length; i++) if (sc[i] > sc[best]) best = i;
                        Finish(s, best, "隐点令 5 轮终局");
                    }
                    else { s.Turn = loser; Say(s, "第 " + round + " 轮，由座位 " + loser + " 先叫"); }
                    return MoveResult.Good("开盅");
                }
                if (code.StartsWith("b:"))
                {
                    s.V["call"] = code.Substring(2); s.V["callBy"] = seat;
                    Next(s, -1); return MoveResult.Good("叫 " + code.Substring(2));
                }
                return MoveResult.Fail("叫点或开盅");
            }
            if (_id == "avalon")
            {
                return ActAvalon(s, seat, code, stage);
            }
            if (_id == "turtlesoup")
            {
                if (seat == IntV(s, "host", 0)) return MoveResult.Fail("主持人不用猜");
                s.V["asked"] = IntV(s, "asked", 0) + 1;
                int si = IntV(s, "_soupIdx", 0);
                si = Math.Max(0, Math.Min(SOUP_ANS.Length - 1, si));
                if (code.StartsWith("solve:"))
                {
                    string ans = code.Substring(6);
                    string real = SOUP_ANS[si];
                    int hits = 0;
                    for (int i = 0; i < SOUP_YES[si].Length; i++) if (ans.Contains(SOUP_YES[si][i])) hits++;
                    if (ans.Length > 0 && (real.Contains(ans) || ans.Contains(real) || hits >= 2))
                    { Finish(s, seat, "猜中汤底：" + real); return MoveResult.Good(); }
                    Say(s, "还不是汤底，接着问");
                    return MoveResult.Good();
                }
                string q = code.StartsWith("say:") ? code.Substring(4) : "";
                string reply = "无关";
                if (q.Length == 0) reply = "再问得具体些";
                else
                {
                    for (int i = 0; i < SOUP_YES[si].Length; i++) if (q.Contains(SOUP_YES[si][i])) reply = "是";
                    for (int i = 0; i < SOUP_NO[si].Length; i++) if (q.Contains(SOUP_NO[si][i])) reply = "否";
                }
                AddPublic(s, "问：" + q + " → " + reply);
                int mx = IntV(s, "maxQuestions", 18);
                if (IntV(s, "asked", 0) >= mx)
                    Finish(s, -1, mx + " 问用尽 · 汤底：" + SOUP_ANS[si]);
                return MoveResult.Good();
            }
            if (_id == "mastermind")
            {
                int[] tr = s.V["tries"] as int[];
                if (tr == null || tr.Length != s.Seats) { tr = new int[s.Seats]; s.V["tries"] = tr; }
                if (code == "n")
                {
                    tr[seat]++;
                    AddFeed(s, seat, "跳过一次"); AddPublic(s, "座位 " + seat + " 跳过一次");
                    if (tr[seat] >= IntV(s, "maxTries", 10)) Finish(s, -1, "次数用尽 · 答案是 " + StrV(s, "_secret", ""));
                    return MoveResult.Good("跳过");
                }
                if (!code.StartsWith("solve:")) return MoveResult.Fail("直接写数字");
                string g = code.Substring(6).Trim();
                string sec = StrV(s, "_secret", "");
                if (g.Length != sec.Length || !g.All(char.IsDigit)) return MoveResult.Fail("要 " + sec.Length + " 位数字");
                int a = 0, b = 0;
                bool[] used = new bool[sec.Length];
                bool[] guessed = new bool[sec.Length];
                for (int i = 0; i < sec.Length; i++)
                    if (g[i] == sec[i]) { a++; used[i] = true; guessed[i] = true; }
                for (int i = 0; i < sec.Length; i++)
                {
                    if (guessed[i]) continue;
                    for (int j = 0; j < sec.Length; j++)
                        if (!used[j] && !guessed[j] && sec[j] == g[i]) { b++; used[j] = true; break; }
                }
                int tries = ++tr[seat];
                AddFeed(s, seat, g + " → " + a + "A" + b + "B");
                AddPublic(s, "座位 " + seat + " 猜了一次");
                if (a == sec.Length) { Finish(s, seat, "猜中！用了 " + tries + " 次"); return MoveResult.Good(); }
                if (tries >= IntV(s, "maxTries", 10))
                    Finish(s, -1, "10 次用尽 · 答案是 " + sec);
                return MoveResult.Good(a + "A" + b + "B");
            }
            if (_id == "drawguess")
            {
                int painter = IntV(s, "painter", 0);
                string word = StrV(s, "_word", "");
                if (seat == painter)
                {
                    if (code.StartsWith("draw:"))
                    {
                        string[] st = s.V["strokes"] as string[];
                        List<string> l = new List<string>(st);
                        l.Add(code.Substring(5));
                        if (l.Count > 120) l.RemoveAt(0);
                        s.V["strokes"] = l.ToArray();
                        return MoveResult.Good("笔迹已同步");
                    }
                    int rr = IntV(s, "round", 1) + 1;
                    s.V["round"] = rr;
                    if (rr > IntV(s, "rounds", 3))
                    {
                        int[] sc0 = s.V["score"] as int[];
                        int best0 = 0; for (int i = 1; i < sc0.Length; i++) if (sc0[i] > sc0[best0]) best0 = i;
                        Finish(s, best0, "你画我猜终局 · 词是「" + word + "」");
                    }
                    else
                    {
                        int np = (painter + 1) % s.Seats;
                        s.V["painter"] = np;
                        s.V["_word"] = WORDS[NextRng(s, WORDS.Length)];
                        s.V["strokes"] = new string[0];
                        s.PhaseName = "第 " + rr + " 轮 · 换座位 " + np + " 来画";
                        Say(s, "画手跳过，换人画");
                    }
                    return MoveResult.Good("跳过");
                }
                string g = code.StartsWith("say:") ? code.Substring(4).Trim() : "";
                AddPublic(s, "座位 " + seat + "：" + g);
                if (g.Length > 0 && (g.Contains(word) || word.Contains(g)))
                {
                    int[] sc = s.V["score"] as int[]; sc[seat] += 2; sc[painter] += 1;
                    s.V["guessed"] = true;
                    int round = IntV(s, "round", 1) + 1;
                    s.V["round"] = round;
                    if (round > IntV(s, "rounds", 3))
                    {
                        int best = 0; for (int i = 1; i < sc.Length; i++) if (sc[i] > sc[best]) best = i;
                        Finish(s, best, "你画我猜终局 · 词是「" + word + "」");
                    }
                    else
                    {
                        int np = (painter + 1) % s.Seats;
                        s.V["painter"] = np;
                        s.V["_word"] = WORDS[NextRng(s, WORDS.Length)];
                        s.V["strokes"] = new string[0];
                        s.V["guessed"] = false;
                        s.PhaseName = "第 " + round + " 轮 · 换座位 " + np + " 来画";
                        Say(s, "猜中了！换人画");
                    }
                    return MoveResult.Good("猜中");
                }
                return MoveResult.Good();
            }
            return MoveResult.Fail("未知动作");
        }

        private MoveResult ActAvalon(GameState s, int seat, string code, int stage)
        {
            int leader = IntV(s, "leader", 0);
            if (stage == 0)
            {
                if (seat != leader) return MoveResult.Fail("等队长组队");
                int pick; if (!code.StartsWith("c:") || !int.TryParse(code.Substring(2), out pick)) return MoveResult.Fail("选队员");
                int[] team = s.V["team"] as int[];
                List<int> t = new List<int>(team);
                if (!t.Contains(pick)) t.Add(pick);
                s.V["team"] = t.ToArray();
                s.V["_voted"] = new bool[s.Seats]; s.V["voted"] = 0;
                s.V["votes"] = new int[s.Seats];
                if (t.Count >= Math.Max(2, s.Seats / 2))
                {
                    s.V["stage"] = 1; s.PhaseName = "第 " + IntV(s, "round", 1) + " 轮 · 全员投票是否放行队伍";
                    Say(s, "队伍成形，请投可否");
                }
                return MoveResult.Good("已选 " + t.Count + " 人");
            }
            if (stage == 1 || stage == 2)
            {
                bool[] vd = s.V["_voted"] as bool[];
                if (vd[seat]) return MoveResult.Fail("已经投过");
                if (!code.StartsWith("v:")) return MoveResult.Fail("投 1 同意 / 0 反对");
                int[] votes = s.V["votes"] as int[];
                votes[seat] = Safe(code.Substring(2)); vd[seat] = true;
                int voted = IntV(s, "voted", 0) + 1; s.V["voted"] = voted;
                int pool = stage == 1 ? s.Seats : ((s.V["team"] as int[]) ?? new int[0]).Length;
                if (voted >= pool) ResolveAvalon(s, stage);
                return MoveResult.Good();
            }
            return MoveResult.Fail("阶段错误");
        }
        private void ResolveAvalon(GameState s, int stage)
        {
            int[] votes = s.V["votes"] as int[];
            int yes = 0; for (int i = 0; i < votes.Length; i++) yes += votes[i];
            int round = IntV(s, "round", 1);
            if (stage == 1)
            {
                if (yes * 2 <= s.Seats)
                {
                    int rejects = IntV(s, "rejects", 0) + 1; s.V["rejects"] = rejects;
                    s.V["leader"] = (IntV(s, "leader", 0) + 1) % s.Seats;
                    s.V["team"] = new int[0]; s.V["stage"] = 0;
                    s.PhaseName = "第 " + round + " 轮 · 队伍被否，换队长";
                    Say(s, "投票没过，换队长组队");
                    if (rejects >= IntV(s, "rejectLimit", 5))
                    Finish(s, -1, "连续 " + IntV(s, "rejectLimit", 5) + " 次组队被否 · 坏人翻盘");
                }
                else { s.V["stage"] = 2; s.PhaseName = "第 " + round + " 轮 · 队员做任务"; Say(s, "队伍放行，执行任务"); }
                s.V["_voted"] = new bool[s.Seats]; s.V["voted"] = 0; s.V["votes"] = new int[s.Seats];
            }
            else
            {
                int[] m = s.V["missions"] as int[];
                m[round - 1] = yes * 2 > ((s.V["team"] as int[]) ?? new int[0]).Length ? 1 : 0;
                s.V["missions"] = m;
                s.V["leader"] = (IntV(s, "leader", 0) + 1) % s.Seats;
                s.V["team"] = new int[0]; s.V["stage"] = 0;
                int good = 0, bad = 0; for (int i = 0; i < 3; i++) if (m[i] == 1) good++; else bad++;
                int need = IntV(s, "needWin", 3);
                if (good >= need) { FinishTeam(s, GoodSeats(s), need + " 轮任务全成 · 好人方获胜"); return; }
                if (bad >= need) { FinishTeam(s, BadSeats(s), need + " 轮任务全败 · 坏人方获胜"); return; }
                s.V["round"] = round + 1;
                s.PhaseName = "第 " + (round + 1) + " 轮 · 队长组队";
                s.V["_voted"] = new bool[s.Seats]; s.V["voted"] = 0; s.V["votes"] = new int[s.Seats];
                Say(s, "任务 " + (m[round - 1] == 1 ? "成功" : "被破坏"));
            }
        }
        private static IEnumerable<int> GoodSeats(GameState s)
        {
            int[] roles = s.V["_roles"] as int[];
            List<int> a = new List<int>();
            if (roles != null) for (int i = 0; i < roles.Length; i++) if (roles[i] == 0) a.Add(i);
            return a;
        }
        private static IEnumerable<int> BadSeats(GameState s)
        {
            int[] roles = s.V["_roles"] as int[];
            List<int> a = new List<int>();
            if (roles != null) for (int i = 0; i < roles.Length; i++) if (roles[i] == 1) a.Add(i);
            return a;
        }
        private void AddFeed(GameState s, int seat, string text)
        {
            string k = "_feed" + seat;
            List<string> a = new List<string>(s.V.ContainsKey(k) ? (string[])s.V[k] : new string[0]);
            a.Add(text); if (a.Count > 20) a.RemoveAt(0);
            s.V[k] = a.ToArray();
        }
        private static void AddPublic(GameState s, string text)
        {
            string[] a = s.V["publicText"] as string[];
            List<string> l = new List<string>(a); l.Add(text);
            if (l.Count > 40) l.RemoveAt(0);
            s.V["publicText"] = l.ToArray();
            Say(s, text);
        }

        public override Dictionary<string, object> View(GameState s, int seat)
        {
            Dictionary<string, object> v = base.View(s, seat);
            Dictionary<string, object> info = v["info"] as Dictionary<string, object>;
            if (info == null) { info = new Dictionary<string, object>(); v["info"] = info; }
            info["hint"] = s.PhaseName;
            if (s.V.ContainsKey("score")) info["score"] = s.V["score"];
            if (s.V.ContainsKey("publicText")) info["publicText"] = s.V["publicText"];
            if (s.V.ContainsKey("round")) info["round"] = s.V["round"];

            if (_id == "liarsdice")
            {
                int[] dice = s.V["dice"] as int[];
                List<int> mine = new List<int>();
                if (dice != null && seat >= 0)
                    for (int i = seat * 5; i < Math.Min(seat * 5 + 5, dice.Length); i++) mine.Add(dice[i]);
                info["myDice"] = mine.ToArray();
                info["call"] = StrV(s, "call", "0,0");
                info["callBy"] = s.V["callBy"];
            }
            if (_id == "avalon")
            {
                int[] roles = s.V["_roles"] as int[];
                info["myRole"] = (roles != null && seat >= 0 && seat < roles.Length && roles[seat] == 1) ? "坏人 · 破坏任务" : "好人 · 完成任务";
                info["leader"] = s.V["leader"];
                info["team"] = s.V["team"];
                info["missions"] = s.V["missions"];
                info["stage"] = s.V["stage"];
            }
            if (_id == "turtlesoup")
            {
                info["soup"] = s.V["soup"]; info["host"] = s.V["host"]; info["asked"] = s.V["asked"];
                info["maxQuestions"] = IntV(s, "maxQuestions", 18);
                if (seat == IntV(s, "host", 0)) info["hostAnswer"] = StrV(s, "_answer", "");
            }
            if (_id == "mastermind")
            {
                int[] tr = s.V["tries"] as int[];
                info["len"] = s.V["len"];
                info["tries"] = tr != null && seat >= 0 && seat < tr.Length ? tr[seat] : 0;
                info["maxTries"] = s.V["maxTries"];
                info["myFeed"] = seat >= 0 && s.V.ContainsKey("_feed" + seat) ? s.V["_feed" + seat] : new string[0];
            }
            if (_id == "drawguess")
            {
                info["painter"] = s.V["painter"];
                info["strokes"] = s.V["strokes"];
                info["isPainter"] = seat == IntV(s, "painter", 0);
                info["myWord"] = seat == IntV(s, "painter", 0) ? s.V["_word"] : "";
                info["rounds"] = s.V["rounds"];
            }
            if (_id == "endgame") info["clue"] = s.V["clue"];
            if (_id == "blackjack")
            {
                List<int> pts = new List<int>();
                for (int i = 0; i < s.Seats; i++) pts.Add(Bj(s, s.Hands.ContainsKey(i) ? s.Hands[i] : new List<string>()));
                info["points"] = pts.ToArray();
                info["bust"] = s.V["bust"];
            }
            if (_id == "dots" || _id == "hex" || _id == "junqi4") info["score"] = s.V["score"];
            v["info"] = info;
            return v;
        }
    }

    public sealed class DirectorGame : RuleBase
    {
        public override string Id { get { return "juben"; } }
        public override string Renderer { get { return "party"; } }
        public override int MinSeats { get { return 3; } }
        public override int MaxSeats { get { return 8; } }
        public override string[] Variants
        {
            get
            {
                object[] list = ScriptGateway.List();
                if (list.Length == 0) return new string[] { "现场导入" };
                List<string> a = new List<string>();
                for (int i = 0; i < list.Length; i++) a.Add(RJ.Str(list[i] as Dictionary<string, object>, "id", ""));
                a.Add("现场导入");
                return a.ToArray();
            }
        }

        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Game = "juben"; s.Room = room; s.Seats = seats;
            Dictionary<string, object> sc = ScriptGateway.GetForRoom(room, variant) ?? ScriptGateway.Get(variant);
            if (sc == null)
            {
                object[] list = ScriptGateway.List();
                if (list.Length > 0) sc = ScriptGateway.Get(RJ.Str(list[0] as Dictionary<string, object>, "id", ""));
            }
            if (sc == null)
            {

                sc = MinimalScript();
            }
            s.V["_script"] = sc;
            s.V["act"] = 0;
            s.V["line"] = 0;
            s.V["stage"] = "curtain";
            s.V["votes"] = new int[seats];
            s.V["_voted"] = new bool[seats];
            s.V["voted"] = 0;
            s.V["publicClues"] = new string[0];
            s.V["privateClues"] = new string[0];
            s.V["narration"] = new string[0];
            s.V["theme"] = RJ.Str(sc, "theme", "夜墨");
            s.V["cue"] = "curtain";
            s.V["discussLeft"] = 0;
            s.V["_said"] = new bool[seats];
            s.V["said"] = 0;
            s.PhaseName = "第一幕 · 幕卡";
            Say(s, "剧本就位 · " + RJ.Str(sc, "name", "现场本"));
            return s;
        }
        private static Dictionary<string, object> MinimalScript()
        {
            Dictionary<string, object> sc = new Dictionary<string, object>();
            sc["id"] = "min"; sc["name"] = "现场小本"; sc["version"] = 1; sc["theme"] = "夜墨"; sc["culprit"] = "r0";
            sc["synopsis"] = "房主还没放剧本，先用一个最小本走一遍流程。往 scripts/ 丢一个 JSON 就能换。";
            List<object> roles = new List<object>();
            for (int i = 0; i < 8; i++)
                roles.Add(RJ.Frame("id", "r" + i, "public", "角色 " + i,
                    "private", "你记得自己昨晚一直在下雨的窗边。",
                    "secret", "其实那封信是你写的。", "goal", "别在终幕前被指认出来。",
                    "botLines", new object[] { "雨太大了。", "我先听听大家怎么说。" }));
            sc["roles"] = roles.ToArray();
            List<object> acts = new List<object>();
            acts.Add(RJ.Frame("no", 1, "title", "第一幕 · 门铃",
                "narration", new object[] { "雨从傍晚就没停过。", "几个人在门厅站定，谁也没先开口。" },
                "revealDelay", 800, "publicClues", new object[] { "c1" },
                "privateClues", new Dictionary<string, object>(), "discussMs", 180000, "cue", "doorbell"));
            acts.Add(RJ.Frame("no", 2, "title", "第二幕 · 书房",
                "narration", new object[] { "锁是新的。", "桌上摆着多一只杯子。" },
                "revealDelay", 800, "publicClues", new object[] { "c2" },
                "privateClues", new Dictionary<string, object>(), "discussMs", 180000, "cue", "clock"));
            acts.Add(RJ.Frame("no", 3, "title", "终幕 · 指认", "vote", true,
                "question", "那封信是谁写的？", "narration", new object[] { "灯灭了一次。" },
                "revealDelay", 800, "publicClues", new object[0],
                "privateClues", new Dictionary<string, object>(), "discussMs", 0, "cue", "gong"));
            sc["acts"] = acts.ToArray();
            sc["clues"] = RJ.Frame("c1", RJ.Frame("title", "门厅的伞", "text", "伞都是湿的，只有一把是干的。"),
                "c2", RJ.Frame("title", "多出的杯", "text", "杯沿有唇印，茶还是温的。"));
            sc["endings"] = new object[] {
                RJ.Frame("when", "solved", "title", "雨没停", "text", "指认落下，窗外的雨还在下。真相留在了没翻开的那一页。"),
                RJ.Frame("when", "else", "title", "散场", "text", "没人再说话，各自把伞拿了起来。") };
            sc["ambience"] = RJ.Frame("drone", "rain", "ink", 0.7, "paper", 0.5, "cueVolume", 0.6);
            return sc;
        }

        private Dictionary<string, object> Script(GameState s) { return s.V["_script"] as Dictionary<string, object>; }
        private object[] Acts(GameState s)
        {
            Dictionary<string, object> sc = Script(s); object a;
            sc.TryGetValue("acts", out a); return a as object[] ?? new object[0];
        }
        private Dictionary<string, object> Act(GameState s, int i)
        {
            object[] a = Acts(s); return i >= 0 && i < a.Length ? a[i] as Dictionary<string, object> : null;
        }
        private object[] Roles(GameState s)
        {
            Dictionary<string, object> sc = Script(s); object a;
            sc.TryGetValue("roles", out a); return a as object[] ?? new object[0];
        }
        private Dictionary<string, object> Clues(GameState s)
        {
            Dictionary<string, object> sc = Script(s); object c;
            sc.TryGetValue("clues", out c); return c as Dictionary<string, object> ?? new Dictionary<string, object>();
        }

        private bool Dm(GameState s) { return OptB(s, "dmMode", RJ.Bool(Script(s), "dm", false)) && s.Seats > 1; }
        private bool IsActive(GameState s, int seat) { return !Dm(s) || seat > 0; }
        private int ActiveCount(GameState s) { return Math.Max(1, s.Seats - (Dm(s) ? 1 : 0)); }
        private int RoleIndex(GameState s, int seat)
        {
            object[] roles = Roles(s);
            if (roles.Length == 0) return 0;
            return (Dm(s) ? seat - 1 : seat) % roles.Length;
        }
        private bool[] Done(GameState s, string key)
        {
            object o;
            if (!s.V.TryGetValue(key, out o) || !(o is bool[]) || ((bool[])o).Length != s.Seats)
            { bool[] a = new bool[s.Seats]; s.V[key] = a; return a; }
            return (bool[])o;
        }
        private IEnumerable<int> ActiveSeats(GameState s)
        {
            for (int i = 0; i < s.Seats; i++) if (IsActive(s, i)) yield return i;
        }
        private int NextSpeaker(GameState s)
        {
            bool[] said = Done(s, "_said");
            for (int k = 1; k <= s.Seats; k++)
            {
                int i = (s.Turn + k) % s.Seats;
                if (IsActive(s, i) && !said[i]) return i;
            }
            return -1;
        }
        private string[] MyClueIds(GameState s, int seat)
        {
            if (!IsActive(s, seat)) return new string[0];
            Dictionary<string, object> pv = null;
            object o; if (s.V.TryGetValue("_private", out o)) pv = o as Dictionary<string, object>;
            if (pv == null) return new string[0];
            object[] roles = Roles(s);
            int ri = RoleIndex(s, seat);
            string rid = ri < roles.Length ? RJ.Str(roles[ri] as Dictionary<string, object>, "id", "") : "";
            object ids; if (!pv.TryGetValue(rid, out ids)) return new string[0];
            object[] a = ids as object[]; if (a == null) return new string[0];
            List<string> r = new List<string>();
            for (int i = 0; i < a.Length; i++) r.Add(Convert.ToString(a[i]));
            return r.ToArray();
        }

        public override void Tick(GameState s, long dtMs)
        {
            if (s.Ended || StrV(s, "stage", "") != "discuss") return;
            int left = IntV(s, "discussLeft", 0) - (int)dtMs;
            s.V["discussLeft"] = Math.Max(0, left);
            s.V["tickDirty"] = true;
            if (left <= 0)
            {
                Say(s, "讨论时间到，转入下一幕");
                AdvanceAct(s);
                s.MoveNo++;
            }
        }

        public override string BotLine(GameState s, int seat)
        {
            object[] roles = Roles(s);
            if (roles.Length == 0) return "";
            Dictionary<string, object> role = roles[RoleIndex(s, seat)] as Dictionary<string, object>;
            if (role == null) return "";
            object bl; if (!role.TryGetValue("botLines", out bl)) return "";
            object[] lines = bl as object[];
            if (lines == null || lines.Length == 0) return "";
            int k = Math.Abs(s.MoveNo * 7 + seat * 13) % lines.Length;
            return Convert.ToString(lines[k]);
        }

        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || seat < 0 || seat >= s.Seats) return r;
            string stage = StrV(s, "stage", "curtain");
            if (stage == "curtain" || stage == "narration") { r.Add("n"); return r; }
            if (stage == "clues")
            {

                if (!IsActive(s, seat)) return r;
                bool[] done = Done(s, "_clueDone");
                if (done[seat]) return r;
                string[] mine = MyClueIds(s, seat);
                for (int i = 0; i < mine.Length; i++)
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
                if (!IsActive(s, seat) || seat != s.Turn) return r;
                r.Add("say:*"); r.Add("say:我先说说我的本");
                if (seat == 0) r.Add("n");
                return r;
            }
            if (stage == "vote")
            {
                if (!IsActive(s, seat)) return r;
                bool[] vd = Done(s, "_voted");
                if (!vd[seat])
                {
                    object[] roles = Roles(s);
                    for (int i = 0; i < roles.Length; i++) r.Add("v:" + i);
                }
                return r;
            }
            return r;
        }

        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = d != null && d.ContainsKey("code") ? Convert.ToString(d["code"]) : action;
            string stage = StrV(s, "stage", "curtain");
            if (s.Ended) return MoveResult.Fail("本已散场");
            if (stage == "curtain")
            {
                s.V["stage"] = "narration"; s.V["line"] = 0;
                LoadNarration(s);
                s.V["cue"] = "curtain";
                s.PhaseName = Act(s, IntV(s, "act", 0)) == null ? "散场" : RJ.Str(Act(s, IntV(s, "act", 0)), "title", "幕");
                Say(s, "幕起 · " + s.PhaseName);
                return MoveResult.Good();
            }
            if (stage == "narration")
            {
                string[] lines = s.V["narration"] as string[];
                int line = IntV(s, "line", 0) + 1; s.V["line"] = line;
                if (lines == null || line >= lines.Length)
                {
                    s.V["stage"] = "clues";
                    DeliverClues(s);
                    Dictionary<string, object> a = Act(s, IntV(s, "act", 0));
                    s.V["cue"] = RJ.Str(a, "cue", "paper");
                    s.PhaseName = "线索发放 · 翻牌看";
                    Say(s, "旁白读完，线索已发到各自手里");
                }
                return MoveResult.Good();
            }
            if (stage == "clues")
            {
                if (code == "n") { EnterDiscussOrVote(s); return MoveResult.Good("收起翻牌"); }
                if (!IsActive(s, seat)) return MoveResult.Fail("主持人不参与翻牌");
                bool[] done = Done(s, "_clueDone");
                if (done[seat]) return MoveResult.Fail("这一幕你已经表态了");
                if (code.StartsWith("reveal:"))
                {
                    if (!OptB(s, "clueReveal", true)) return MoveResult.Fail("本房关闭了公开线索");
                    string cid = code.Substring(7);
                    string[] mine = MyClueIds(s, seat);
                    if (Array.IndexOf(mine, cid) < 0) return MoveResult.Fail("这条线索不在你手里");
                    List<string> pub = new List<string>(s.V["publicClues"] as string[] ?? new string[0]);
                    if (!pub.Contains(cid)) pub.Add(cid);
                    s.V["publicClues"] = pub.ToArray();
                    Dictionary<string, object> c = ObjGet(Clues(s), cid);
                    Say(s, "座位 " + seat + " 亮出了线索「" + RJ.Str(c, "title", cid) + "」");
                }
                else if (code.StartsWith("hold:"))
                {
                    Say(s, "座位 " + seat + " 把线索扣在手里，没有公开");
                }
                else return MoveResult.Fail("亮出线索或扣着");
                done[seat] = true;
                bool all = true;
                foreach (int i in ActiveSeats(s)) if (!done[i]) { all = false; break; }
                if (all) EnterDiscussOrVote(s);
                return MoveResult.Good();
            }
            if (stage == "discuss")
            {
                if (seat != s.Turn) return MoveResult.Fail("还没轮到你发言");
                if (code.StartsWith("say:"))
                {
                    string text = code.Substring(4);
                    if (text.Length > 120) text = text.Substring(0, 120);
                    Say(s, "座位 " + seat + "：" + text);
                    bool[] said = Done(s, "_said");
                    if (!said[seat]) { said[seat] = true; s.V["said"] = IntV(s, "said", 0) + 1; }
                    if (IntV(s, "said", 0) >= ActiveCount(s)) AdvanceAct(s);
                    else { int nx = NextSpeaker(s); if (nx >= 0) s.Turn = nx; }
                    return MoveResult.Good();
                }
                if (code == "n") { AdvanceAct(s); return MoveResult.Good("收起讨论，转入下一幕"); }
                return MoveResult.Fail("说一句，或房主点收讨论");
            }
            if (stage == "vote")
            {
                if (!IsActive(s, seat)) return MoveResult.Fail("主持人不参与指认");
                bool[] vd = Done(s, "_voted");
                if (vd[seat]) return MoveResult.Fail("已经投过");
                if (!code.StartsWith("v:")) return MoveResult.Fail("请指认一个角色");
                int target = Safe(code.Substring(2));
                object[] roles = Roles(s);
                if (target < 0 || target >= roles.Length) return MoveResult.Fail("没有这个角色");
                int[] votes = s.V["votes"] as int[];
                if (votes == null || votes.Length != roles.Length) { votes = new int[Math.Max(1, roles.Length)]; s.V["votes"] = votes; }
                votes[target]++; vd[seat] = true;
                int voted = IntV(s, "voted", 0) + 1; s.V["voted"] = voted;
                if (voted >= ActiveCount(s)) Resolve(s);
                return MoveResult.Good();
            }
            return MoveResult.Fail("阶段错误");
        }

            private void EnterDiscussOrVote(GameState s)
            {
                Dictionary<string, object> a = Act(s, IntV(s, "act", 0));
                if (a == null) { EnterVote(s); return; }
                if (RJ.Bool(a, "vote", false)) { EnterVote(s); return; }
                s.V["stage"] = "discuss";
                int secs = OptI(s, "ph_discuss", Math.Max(10, RJ.Int(a, "discussMs", 180000) / 1000));
                s.V["discussLeft"] = Math.Max(10000, secs * 1000);
                s.V["_phase"] = "discuss";
                s.V["_said"] = new bool[s.Seats]; s.V["said"] = 0;
                s.Turn = -1;
                int first = NextSpeaker(s);
                s.Turn = first < 0 ? 0 : first;
                s.PhaseName = "讨论 · 轮流打字";
                Say(s, "开议，轮者留一句（余 " + (IntV(s, "discussLeft", 0) / 1000) + " 秒）");
            }
            private void EnterVote(GameState s)
            {
                object[] roles = Roles(s);
                s.V["stage"] = "vote"; s.PhaseName = "终幕 · 指认"; s.V["cue"] = "gong";
                s.V["_phase"] = "vote";
                Dictionary<string, object> a = Act(s, IntV(s, "act", 0));
                Say(s, a == null ? "请指认" : RJ.Str(a, "question", "请指认"));
                s.V["_voted"] = new bool[s.Seats];
                s.V["voted"] = 0;
                s.V["votes"] = new int[Math.Max(1, roles.Length)];
                s.V["revote"] = 0;
                if (Dm(s)) ((bool[])s.V["_voted"])[0] = true;
            }
        private void LoadNarration(GameState s)
        {
            Dictionary<string, object> a = Act(s, IntV(s, "act", 0));
            object n; a.TryGetValue("narration", out n);
            object[] arr = n as object[];
            List<string> l = new List<string>();
            if (arr != null) for (int i = 0; i < arr.Length; i++) l.Add(Convert.ToString(arr[i]));
            s.V["narration"] = l.ToArray();
        }
        private void DeliverClues(GameState s)
        {
            Dictionary<string, object> a = Act(s, IntV(s, "act", 0));
            List<string> pub = new List<string>(s.V["publicClues"] as string[] ?? new string[0]);
            object pc; a.TryGetValue("publicClues", out pc);
            object[] pa = pc as object[];
            if (pa != null) for (int i = 0; i < pa.Length; i++) pub.Add(Convert.ToString(pa[i]));
            s.V["publicClues"] = pub.ToArray();

            object pv; a.TryGetValue("privateClues", out pv);
            s.V["_private"] = pv as Dictionary<string, object> ?? new Dictionary<string, object>();
            s.V["_clueDone"] = new bool[s.Seats];
            if (Dm(s)) ((bool[])s.V["_clueDone"])[0] = true;
        }

        private void AdvanceAct(GameState s)
        {
            int next = IntV(s, "act", 0) + 1;
            if (next >= Acts(s).Length)
            {
                EnterVote(s);
                Say(s, "讨论结束，请指认");
            }
            else
            {
                s.V["act"] = next; s.V["stage"] = "curtain";
                s.PhaseName = "第 " + (next + 1) + " 幕 · 幕卡";
                Say(s, "转入下一幕");
            }
        }

        private void Resolve(GameState s)
        {
            int[] votes = s.V["votes"] as int[] ?? new int[1];
            int top = 0; int ties = 0;
            for (int i = 1; i < votes.Length; i++) if (votes[i] > votes[top]) top = i;
            for (int i = 0; i < votes.Length; i++) if (votes[i] == votes[top] && votes[i] > 0) ties++;
            if (ties > 1 && IntV(s, "revote", 0) == 0)
            {

                s.V["revote"] = 1;
                s.V["_voted"] = new bool[s.Seats];
                if (Dm(s)) ((bool[])s.V["_voted"])[0] = true;
                s.V["voted"] = 0;
                s.V["votes"] = new int[votes.Length];
                Say(s, "平票了，请再指认一轮");
                return;
            }
            Dictionary<string, object> sc = Script(s);
            object[] roles = Roles(s);
            string pickedRole = top >= 0 && top < roles.Length
                ? RJ.Str(roles[top] as Dictionary<string, object>, "id", "") : "";
            string culprit = RJ.Str(sc, "culprit", "");
            bool solved = ties <= 1 && culprit.Length > 0 && pickedRole == culprit;
            s.V["solved"] = solved;
            object e; sc.TryGetValue("endings", out e);
            object[] ends = e as object[] ?? new object[0];
            string title = solved ? "真相" : "雨没停", text = solved ? "指认落定。" : "没人被说服。";
            for (int i = 0; i < ends.Length; i++)
            {
                Dictionary<string, object> x = ends[i] as Dictionary<string, object>;
                if (x == null) continue;
                string when = RJ.Str(x, "when", "else");
                bool hit = solved
                    ? (when == "solved" || when == "right" || when == "vote" || when == "vote:" + culprit)
                    : (when == "else" || when == "miss");
                if (hit) { title = RJ.Str(x, "title", title); text = RJ.Str(x, "text", text); break; }
            }
            Say(s, solved ? "指认命中真相" : "指认未命中");
            string pickedName = top < roles.Length
                ? RJ.Str(roles[top] as Dictionary<string, object>, "public", "角色 " + top) : "无人";
            s.V["ending"] = RJ.Frame("title", title, "text", text, "top", top, "picked", pickedName);
            s.V["stage"] = "end";
            s.V["cue"] = "end";

            if (solved) FinishTeam(s, ActiveSeats(s), title + " · 指认「" + pickedName + "」命中真相");
            else Finish(s, -1, title + " · 指认「" + pickedName + "」未命中");
        }

        public override Dictionary<string, object> View(GameState s, int seat)
        {
            Dictionary<string, object> v = base.View(s, seat);
            Dictionary<string, object> info = v["info"] as Dictionary<string, object>;
            if (info == null) { info = new Dictionary<string, object>(); v["info"] = info; }
            Dictionary<string, object> sc = Script(s);
            Dictionary<string, object> a = Act(s, IntV(s, "act", 0));
            info["scriptName"] = RJ.Str(sc, "name", "现场本");
            info["synopsis"] = RJ.Str(sc, "synopsis", "");
            info["theme"] = s.V["theme"];
            info["cue"] = s.V["cue"];
            info["stage"] = s.V["stage"];
            info["actTitle"] = RJ.Str(a, "title", "");
            info["actNo"] = IntV(s, "act", 0) + 1;
            info["actCount"] = Acts(s).Length;
            string[] lines = s.V["narration"] as string[];
            int line = IntV(s, "line", 0);
            List<string> shown = new List<string>();
            if (lines != null && StrV(s, "stage", "") == "narration")
                for (int i = 0; i <= Math.Min(line, lines.Length - 1); i++) shown.Add(lines[i]);
            info["narration"] = shown.ToArray();
            info["revealDelay"] = RJ.Int(a, "revealDelay", 800);
            info["discussLeft"] = s.V["discussLeft"];
            info["question"] = RJ.Str(a, "question", "");

            Dictionary<string, object> clues = Clues(s);
            string[] pub = s.V["publicClues"] as string[] ?? new string[0];
            List<object> pubCards = new List<object>();
            for (int i = 0; i < pub.Length; i++)
            {
                Dictionary<string, object> c = ObjGet(clues, pub[i]);
                pubCards.Add(RJ.Frame("id", pub[i], "title", RJ.Str(c, "title", pub[i]), "text", RJ.Str(c, "text", "")));
            }
            info["publicClues"] = pubCards.ToArray();

            object[] roles = Roles(s);
            int ri = seat >= 0 ? seat % Math.Max(1, roles.Length) : 0;
            Dictionary<string, object> role = roles.Length > 0 ? roles[ri] as Dictionary<string, object> : null;
            if (seat >= 0 && role != null)
            {
                info["myRole"] = RJ.Frame("public", RJ.Str(role, "public", "角色"),
                    "private", RJ.Str(role, "private", ""), "secret", RJ.Str(role, "secret", ""),
                    "goal", RJ.Str(role, "goal", ""));
                List<object> mine = new List<object>();
                Dictionary<string, object> pv = null;
                object pvObj; if (s.V.TryGetValue("_private", out pvObj)) pv = pvObj as Dictionary<string, object>;
                object mineIds;
                if (pv != null && pv.TryGetValue(RJ.Str(role, "id", ""), out mineIds))
                {
                    object[] ma = mineIds as object[];
                    if (ma != null) for (int i = 0; i < ma.Length; i++)
                    {
                        string cid = Convert.ToString(ma[i]);
                        Dictionary<string, object> c = ObjGet(clues, cid);
                        mine.Add(RJ.Frame("id", cid, "title", RJ.Str(c, "title", cid), "text", RJ.Str(c, "text", "")));
                    }
                }
                info["privateClues"] = mine.ToArray();
            }
            else { info["myRole"] = null; info["privateClues"] = new object[0]; }
            info["voted"] = s.V["voted"];
            info["seatsTotal"] = ActiveCount(s);
            info["said"] = s.V["said"];
            info["speaker"] = s.Turn;
            info["isDm"] = Dm(s) && seat == 0;
            info["discussSeconds"] = IntV(s, "discussLeft", 0) / 1000;
            info["revote"] = IntV(s, "revote", 0);
            List<object> names = new List<object>();
            for (int i = 0; i < roles.Length; i++)
                names.Add(RJ.Frame("id", i, "name", RJ.Str(roles[i] as Dictionary<string, object>, "public", "角色 " + i)));
            info["roleNames"] = names.ToArray();
            if (Dm(s) && seat == 0)
                info["dmAnswer"] = RJ.Str(sc, "culprit", "") + " · " + RJ.Str(sc, "synopsis", "");
            if (StrV(s, "stage", "") == "end" && seat >= 0 && IsActive(s, seat))
            {
                Dictionary<string, object> myRole = roles.Length > 0
                    ? roles[RoleIndex(s, seat)] as Dictionary<string, object> : null;
                bool win = Convert.ToBoolean(s.V.ContainsKey("solved") ? s.V["solved"] : false);
                info["myEnding"] = RJ.Frame("role", RJ.Str(myRole, "public", "你的角色"),
                    "goal", RJ.Str(myRole, "goal", ""),
                    "text", win ? "真相被找出来了，你的那页也翻到了最后。" : "真相还压在没翻开的那一页里，你带着自己的秘密离场。");
            }
            if (s.V.ContainsKey("ending")) info["ending"] = s.V["ending"];
            object amb; if (sc.TryGetValue("ambience", out amb)) info["ambience"] = amb;
            v["info"] = info;

            v["cells"] = new string[0]; v["w"] = 0; v["h"] = 0;
            return v;
        }
        private static Dictionary<string, object> ObjGet(Dictionary<string, object> d, string k)
        {
            object o; if (d != null && d.TryGetValue(k, out o)) return o as Dictionary<string, object>;
            return null;
        }
        private static int Safe(string x) { return ExtraGame.SafePublic(x); }
    }

    public sealed class TournamentGame : RuleBase
    {
        private static readonly string[][] BANK = {
            new[]{ "中国象棋里「炮」吃子必须满足什么？", "隔一个棋子", "紧挨着", "只能斜走" },
            new[]{ "围棋终局数子时，黑棋贴目通常是多少？", "不贴", "3又3/4子", "7.5目" },
            new[]{ "夺帅局里「春天」指什么？", "帅方一手没出完就被反", "群客一张没出", "叫了3分" },
            new[]{ "五子棋 Renju 禁手针对谁？", "黑方", "白方", "双方" },
            new[]{ "云笺 里 +4 牌是什么颜色？", "万能变色", "红色", "黄色" },
            new[]{ "国际象棋王车易位时，王走几格？", "两格", "一格", "三格" },
            new[]{ "「打劫」是哪一个棋类的规则？", "围棋", "象棋", "军棋" },
            new[]{ "共牌令一轮落帖最多几次加帖？", "通常不限到封顶", "一次", "两次" }
        };
        public override string Id { get { return "tournament"; } }
        public override string Renderer { get { return "party"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 12; } }
        public override string[] Variants { get { return new string[] { "5轮", "8轮" }; } }

        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Game = Id; s.Room = room; s.Seats = seats;
            s.V["score"] = new int[seats];
            s.V["round"] = 1;
            s.V["rounds"] = variant == "8轮" ? 8 : 5;
            s.V["_answered"] = new bool[seats];
            s.V["answered"] = 0;
            s.V["publicText"] = new string[0];
            SetQuestion(s, 0);
            s.PhaseName = "第 1 轮 · 抢答积分";
            Say(s, "累墨赛开枰 · 共 " + s.V["rounds"] + " 轮");
            return s;
        }
        private void SetQuestion(GameState s, int round)
        {
            string[] q = BANK[Math.Abs(round) % BANK.Length];
            int pos = Math.Abs(round + 1) % 3;
            string[] opts = new string[3];
            opts[pos] = q[1];
            int k = 0;
            for (int j = 0; j < 3; j++) if (j != pos) opts[j] = q[2 + k++];
            s.V["question"] = q[0];
            s.V["options"] = opts;
            s.V["_answer"] = pos;
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || seat < 0) return r;
            bool[] done = s.V["_answered"] as bool[];
            if (done != null && seat < done.Length && !done[seat])
            { r.Add("v:0"); r.Add("v:1"); r.Add("v:2"); }
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = d != null && d.ContainsKey("code") ? Convert.ToString(d["code"]) : action;
            bool[] done = s.V["_answered"] as bool[];
            if (done[seat]) return MoveResult.Fail("这一轮已经答过");
            if (!code.StartsWith("v:")) return MoveResult.Fail("选一个答案");
            int pick = ExtraGame.SafePublic(code.Substring(2));
            if (pick < 0 || pick > 2) return MoveResult.Fail("没有这个选项");
            done[seat] = true;
            int[] sc = s.V["score"] as int[];
            bool right = pick == Convert.ToInt32(s.V["_answer"]);
            if (right) sc[seat] += 3;
            Say(s, "座位 " + seat + (right ? " 答对 +3" : " 答错"));
            int answered = IntV(s, "answered", 0) + 1; s.V["answered"] = answered;
            if (answered >= s.Seats)
            {
                int round = IntV(s, "round", 1) + 1;
                if (round > IntV(s, "rounds", 5))
                {
                    int best = 0;
                    for (int i = 1; i < sc.Length; i++) if (sc[i] > sc[best]) best = i;
                    Finish(s, best, "锦标赛终局 · 座位 " + best + " 以 " + sc[best] + " 分夺冠");
                }
                else
                {
                    s.V["round"] = round;
                    s.V["_answered"] = new bool[s.Seats];
                    s.V["answered"] = 0;
                    SetQuestion(s, round - 1);
                    s.PhaseName = "第 " + round + " 轮 · 抢答积分";
                    Say(s, "进入第 " + round + " 轮");
                }
            }
            return MoveResult.Good(right ? "答对 +3" : "答错");
        }
        public override Dictionary<string, object> View(GameState s, int seat)
        {
            Dictionary<string, object> v = base.View(s, seat);
            Dictionary<string, object> info = v["info"] as Dictionary<string, object>;
            if (info == null) { info = new Dictionary<string, object>(); v["info"] = info; }
            info["question"] = s.V["question"];
            info["options"] = s.V["options"];
            info["round"] = s.V["round"];
            info["rounds"] = s.V["rounds"];
            info["score"] = s.V["score"];
            info["answered"] = s.V["answered"];
            bool[] done = s.V["_answered"] as bool[];
            info["answeredMine"] = seat >= 0 && done != null && seat < done.Length && done[seat];
            v["info"] = info;
            v["cells"] = new string[0]; v["w"] = 0; v["h"] = 0;
            return v;
        }
    }
}
