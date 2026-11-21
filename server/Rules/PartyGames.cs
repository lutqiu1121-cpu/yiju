using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Qipai
{

    public sealed class FlightGame : RuleBase
    {
        public override string Id { get { return "feixingqi"; } }
        public override string Renderer { get { return "path"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 4; } }
        public override string[] Variants { get { return new string[] { "经典", "连掷" }; } }
        private const int LEN = 52;
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Cells = new string[0]; s.Width = 0; s.Height = 0;
            int[] pos = new int[seats * 4];
            for (int i = 0; i < pos.Length; i++) pos[i] = -1;
            s.V["pos"] = pos; s.V["dice"] = 0; s.V["rolled"] = false; s.V["done"] = new int[seats];
            return s;
        }
        private int[] Pos(GameState s) { return (int[])s.V["pos"]; }
        private void SetPos(GameState s, int[] p) { s.V["pos"] = p; }
        private int Path(int seat, int step) { return (step + seat * 13) % LEN; }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat) return r;
            if (!BoolV(s, "rolled", false)) { r.Add("roll"); return r; }
            int dice = IntV(s, "dice", 0);
            int[] p = Pos(s);
            for (int k = 0; k < 4; k++)
            {
                int i = seat * 4 + k;
                if (p[i] >= LEN) continue;
                if (p[i] < 0 && dice != 6) continue;
                int np = p[i] < 0 ? 0 : p[i] + dice;
                if (np > LEN) continue;
                r.Add("m:" + i);
            }
            if (r.Count == 0) r.Add("pass");
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = Convert.ToString(d["code"]);
            if (action == "roll")
            {
                int dice = 1 + NextRng(s, 6);
                s.V["dice"] = dice; s.V["rolled"] = true;
                Say(s, "座位 " + seat + " 掷出 " + dice);
                List<string> l = Legal(s, seat);
                if (l.Count == 1 && l[0] == "pass")
                {
                    s.V["rolled"] = false;
                    if (dice == 6 && s.Variant == "连掷") { Say(s, "掷出 6，连掷一次"); return MoveResult.Good(); }
                    Next(s, -1);
                }
                return MoveResult.Good();
            }
            if (action == "pass") { s.V["rolled"] = false; Next(s, -1); return MoveResult.Good(); }
            if (action != "m") return MoveResult.Fail("未知动作");
            int idx = Cfg.I(Cfg.Rest(code));
            if (!Legal(s, seat).Contains(code)) return MoveResult.Fail("该飞机不能移动");
            int dice2 = IntV(s, "dice", 0);
            int[] p = Pos(s);
            int np = p[idx] < 0 ? 0 : p[idx] + dice2;
            if (np >= LEN) { p[idx] = LEN; Say(s, "一架飞机抵达终点！"); }
            else
            {

                if (np % 13 == 0 && np + 4 <= LEN) { np += 4; Say(s, "跳格 +4"); }
                p[idx] = np;

                int cell = Path(seat, np);
                for (int j = 0; j < p.Length; j++)
                    if (j != idx && j / 4 != seat && p[j] >= 0 && p[j] < LEN && Path(j / 4, p[j]) == cell)
                    { p[j] = -1; Say(s, "撞机！对方飞机回库"); }
            }
            SetPos(s, p);
            int[] done = (int[])s.V["done"];
            done[seat] = 0; for (int k = 0; k < 4; k++) if (p[seat * 4 + k] >= LEN) done[seat]++;
            s.V["done"] = done;
            s.Last = code;
            if (done[seat] >= 4) { Finish(s, seat, "四架飞机全部抵达，胜"); return MoveResult.Good(); }
            s.V["rolled"] = false;
            bool again = dice2 == 6;
            if (!again) Next(s, -1);
            else Say(s, "掷出 6，再来一次");
            return MoveResult.Good();
        }
        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            d["dice"] = IntV(s, "dice", 0);
            d["rolled"] = BoolV(s, "rolled", false);
            d["pathLength"] = LEN;
            return d;
        }
    }

    public sealed class MonopolyGame : RuleBase
    {
        public override string Id { get { return "monopoly"; } }
        public override string Renderer { get { return "path"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 6; } }
        public override string[] Variants { get { return new string[] { "简版" }; } }
        private const int N = 20;
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Cells = new string[0]; s.Width = 0; s.Height = 0;
            s.V["pos"] = new int[seats];
            s.V["cash"] = Enumerable.Repeat(1500, seats).ToArray();
            s.V["owner"] = Enumerable.Repeat(-1, N).ToArray();
            s.V["price"] = Enumerable.Range(0, N).Select(i => 100 + (i % 5) * 60).ToArray();
            s.V["alive"] = Enumerable.Repeat(true, seats).ToArray();
            s.V["rolled"] = false; s.V["dice"] = 0; s.V["canBuy"] = false;
            return s;
        }
        private bool Alive(GameState s, int i) { bool[] a = (bool[])s.V["alive"]; return i < a.Length && a[i]; }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat || !Alive(s, seat)) { if (s.Turn == seat && !s.Ended) r.Add("pass"); return r; }
            if (!BoolV(s, "rolled", false)) { r.Add("roll"); return r; }
            if (BoolV(s, "canBuy", false)) { r.Add("buy"); r.Add("skip"); return r; }
            r.Add("next"); return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            int[] pos = (int[])s.V["pos"], cash = (int[])s.V["cash"], owner = (int[])s.V["owner"], price = (int[])s.V["price"];
            bool[] alive = (bool[])s.V["alive"];
            if (action == "pass" || action == "next" || action == "skip")
            {
                if (action == "skip") s.V["canBuy"] = false;
                s.V["rolled"] = false;
                int t = s.Turn;
                for (int k = 0; k < s.Seats; k++) { t = (t + 1) % s.Seats; if (Alive(s, t)) break; }
                s.Turn = t; s.MoveNo++;
                return MoveResult.Good();
            }
            if (action == "roll")
            {
                int dice = 1 + NextRng(s, 6);
                s.V["dice"] = dice; s.V["rolled"] = true;
                pos[seat] = (pos[seat] + dice) % N; s.V["pos"] = pos;
                int cell = pos[seat];
                if (cell % 5 == 0 && owner[cell] < 0) { s.V["canBuy"] = true; Say(s, "来到空地 " + cell + "，价 " + price[cell]); return MoveResult.Good(); }
                if (owner[cell] >= 0 && owner[cell] != seat)
                {
                    int rent = price[cell] / 5 + 20;
                    cash[seat] -= rent; cash[owner[cell]] += rent;
                    s.V["cash"] = cash; Say(s, "支付过路费 " + rent + " 给座位 " + owner[cell]);
                }
                else if (cell % 7 == 3) { int delta = NextRng(s, 2) == 0 ? 200 : -150; cash[seat] += delta; s.V["cash"] = cash; Say(s, "机会格 " + (delta > 0 ? "+" : "") + delta); }
                if (cash[seat] <= 0) { alive[seat] = false; s.V["alive"] = alive; Say(s, "座位 " + seat + " 囊空出局"); }
                return MoveResult.Good();
            }
            if (action == "buy")
            {
                int cell = pos[seat];
                if (owner[cell] >= 0 || cash[seat] < price[cell]) return MoveResult.Fail("无法购买");
                cash[seat] -= price[cell]; owner[cell] = seat;
                s.V["cash"] = cash; s.V["owner"] = owner; s.V["canBuy"] = false;
                Say(s, "座位 " + seat + " 买下地块 " + cell);
                return MoveResult.Good();
            }
            return MoveResult.Fail("未知动作");
        }
        public override Dictionary<string, object> View(GameState s, int seat)
        {
            bool[] alive = (bool[])s.V["alive"];
            int cnt = 0, last = 0;
            for (int i = 0; i < alive.Length; i++) if (alive[i]) { cnt++; last = i; }
            if (cnt <= 1 && !s.Ended) { s.Ended = true; s.Phase = "end"; s.Winner = last.ToString(CultureInfo.InvariantCulture); s.Result = "其余玩家囊空，座位 " + last + " 胜"; }
            return base.View(s, seat);
        }
    }

    public sealed class WerewolfGame : RuleBase
    {
        public override string Id { get { return "werewolf"; } }
        public override string Renderer { get { return "party"; } }
        public override int MinSeats { get { return 6; } }
        public override int MaxSeats { get { return 12; } }
        public override string[] Variants { get { return new string[] { "预女猎守", "简版" }; } }

        private string[] NightRoles(GameState s)
        {
            if (s.Variant == "简版") return new string[] { "狼人" };
            return new string[] { "狼人", "预言家", "女巫", "守卫" };
        }
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Cells = new string[0]; s.Width = 0; s.Height = 0;

            s.Seats = seats;
            s.Variant = string.IsNullOrEmpty(variant) ? "预女猎守" : variant;
            List<string> roles = new List<string>();
            int wolves = Math.Max(2, seats / 3);
            for (int i = 0; i < wolves; i++) roles.Add("狼人");
            if (variant != "简版")
            {
                roles.Add("预言家"); roles.Add("女巫"); roles.Add("猎人"); roles.Add("守卫");
            }
            while (roles.Count < seats) roles.Add("村民");
            Shuffle(s, roles);
            bool[] alive = new bool[seats];
            for (int i = 0; i < seats; i++) { alive[i] = true; s.V["role" + i] = roles[i]; }
            s.V["alive"] = alive;
            s.V["phase"] = "night"; s.V["nightStep"] = 0; s.V["target"] = -1; s.V["day"] = 1;
            s.V["heal"] = true; s.V["poison"] = true; s.V["poisoned"] = -1;
            s.V["saved"] = -1; s.V["guard"] = -1;
            s.V["votes"] = new int[seats]; s.V["_voted"] = new bool[seats]; s.V["voted"] = 0;
            s.V["_spoken"] = new bool[seats]; s.V["speech"] = new string[seats];
            s.Turn = 0;
            SkipEmptySteps(s);
            return s;
        }
        private bool Alive(GameState s, int i) { bool[] a = (bool[])s.V["alive"]; return i >= 0 && i < a.Length && a[i]; }
        private string Role(GameState s, int i) { return StrV(s, "role" + i, "村民"); }
        private int CountAlive(GameState s) { int n = 0; for (int i = 0; i < s.Seats; i++) if (Alive(s, i)) n++; return n; }
        private int FirstAlive(GameState s) { for (int i = 0; i < s.Seats; i++) if (Alive(s, i)) return i; return 0; }
        private int CountRole(GameState s, string role)
        {
            int n = 0;
            for (int i = 0; i < s.Seats; i++) if (Alive(s, i) && Role(s, i) == role) n++;
            return n;
        }
        private int CountGood(GameState s)
        {
            int n = 0;
            for (int i = 0; i < s.Seats; i++) if (Alive(s, i) && Role(s, i) != "狼人") n++;
            return n;
        }
        private List<int> Team(GameState s, bool wolf)
        {
            List<int> r = new List<int>();
            for (int i = 0; i < s.Seats; i++) if ((Role(s, i) == "狼人") == wolf) r.Add(i);
            return r;
        }
        private bool CheckEnd(GameState s)
        {
            int wolves = CountRole(s, "狼人"), good = CountGood(s);
            if (wolves == 0) { FinishTeam(s, Team(s, false), "狼人全灭，好人阵营胜"); return true; }
            if (wolves >= good) { FinishTeam(s, Team(s, true), "狼人数量不低于好人，狼人阵营胜"); return true; }
            return false;
        }
        private bool StepActive(GameState s, string role)
        {
            for (int i = 0; i < s.Seats; i++) if (Alive(s, i) && Role(s, i) == role) return true;
            return false;
        }
        private void SkipEmptySteps(GameState s)
        {
            string[] roles = NightRoles(s);
            int step = IntV(s, "nightStep", 0);
            while (step < roles.Length && !StepActive(s, roles[step])) step++;
            s.V["nightStep"] = step;
        }
        private void AfterNightAction(GameState s)
        {
            s.V["nightStep"] = IntV(s, "nightStep", 0) + 1;
            SkipEmptySteps(s);
            if (IntV(s, "nightStep", 0) >= NightRoles(s).Length) Day(s);
        }
        private void Day(GameState s)
        {
            int t = IntV(s, "target", -1), guard = IntV(s, "guard", -1);
            int saved = IntV(s, "saved", -1), poisoned = IntV(s, "poisoned", -1);
            string killed = "平安夜";
            bool[] a = (bool[])s.V["alive"];
            if (t >= 0 && t < a.Length && a[t] && t != guard && t != saved)
            { a[t] = false; killed = "座位 " + t + " 遇袭"; }
            if (poisoned >= 0 && poisoned < a.Length && a[poisoned])
            { a[poisoned] = false; killed += "；座位 " + poisoned + " 被毒"; }
            s.V["alive"] = a;
            Say(s, "天亮了：" + killed);
            if (CheckEnd(s)) return;
            s.V["phase"] = "speech";
            s.V["_spoken"] = new bool[s.Seats]; s.V["speech"] = new string[s.Seats];
            s.V["votes"] = new int[s.Seats]; s.V["_voted"] = new bool[s.Seats]; s.V["voted"] = 0;
            s.V["day"] = IntV(s, "day", 1) + 1;
            s.Turn = FirstAlive(s);
        }
        private void ToVote(GameState s)
        {
            s.V["phase"] = "vote";
            s.V["votes"] = new int[s.Seats]; s.V["_voted"] = new bool[s.Seats]; s.V["voted"] = 0;
            s.Turn = FirstAlive(s);
        }
        private void Night(GameState s)
        {
            s.V["phase"] = "night"; s.V["nightStep"] = 0;
            s.V["target"] = -1; s.V["guard"] = -1; s.V["saved"] = -1; s.V["poisoned"] = -1;
            s.V["heal"] = true; s.V["poison"] = true;
            s.Turn = FirstAlive(s);
            SkipEmptySteps(s);
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || !Alive(s, seat)) return r;
            string ph = StrV(s, "phase", "night");
            if (ph == "night")
            {
                string[] roles = NightRoles(s);
                int step = IntV(s, "nightStep", 0);
                if (step >= roles.Length) return r;
                string want = roles[step];
                if (Role(s, seat) != want) return r;
                if (want == "女巫")
                {
                    if (BoolV(s, "heal", false)) r.Add("save");
                    if (BoolV(s, "poison", false))
                        for (int i = 0; i < s.Seats; i++) if (Alive(s, i)) r.Add("poison:" + i);
                    r.Add("skip");
                    return r;
                }
                for (int i = 0; i < s.Seats; i++) if (Alive(s, i) && i != seat) r.Add("night:" + i);
                if (r.Count == 0) r.Add("skip");
                return r;
            }
            if (ph == "speech")
            {
                bool[] sp = (bool[])s.V["_spoken"];
                if (seat < sp.Length && sp[seat]) return r;
                if (s.Turn == seat) r.Add("say:*");
                return r;
            }
            bool[] vv = (bool[])s.V["_voted"];
            if (seat < vv.Length && vv[seat]) return r;
            for (int i = 0; i < s.Seats; i++) if (Alive(s, i) && i != seat) r.Add("vote:" + i);
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = Convert.ToString(d["code"]);
            if (!Legal(s, seat).Contains(code) && code != "say:" && !code.StartsWith("say:"))
                return MoveResult.Fail("当前阶段你不能这样行动");
            string ph = StrV(s, "phase", "night");
            if (ph == "night")
            {
                string[] roles = NightRoles(s);
                int step = IntV(s, "nightStep", 0);
                string want = step < roles.Length ? roles[step] : "";
                if (action == "night")
                {
                    int t = Cfg.I(Cfg.Rest(code));
                    if (want == "狼人") { s.V["target"] = t; Say(s, "狼人已选定目标"); }
                    else if (want == "预言家") Say(s, "查验结果：" + (Role(s, t) == "狼人" ? "狼人" : "好人"));
                    else if (want == "守卫") s.V["guard"] = t;
                }
                else if (action == "save") { s.V["heal"] = false; s.V["saved"] = IntV(s, "target", -1); }
                else if (action == "poison") { s.V["poison"] = false; s.V["poisoned"] = Cfg.I(Cfg.Rest(code)); }
                AfterNightAction(s);
                return MoveResult.Good();
            }
            if (ph == "speech")
            {
                if (action != "say") return MoveResult.Fail("现在只能发言");
                string text = Cfg.Rest(code);
                if (text.Length > 120) text = text.Substring(0, 120);
                string[] speech = (string[])s.V["speech"]; speech[seat] = text; s.V["speech"] = speech;
                bool[] sp = (bool[])s.V["_spoken"]; sp[seat] = true; s.V["_spoken"] = sp;
                Say(s, text.Length > 0 ? "座位 " + seat + " 发言：" + text : "座位 " + seat + " 选择不发言");
                int next = -1;
                for (int k = 1; k <= s.Seats; k++)
                { int i = (seat + k) % s.Seats; if (Alive(s, i) && !sp[i]) { next = i; break; } }
                if (next < 0) ToVote(s); else s.Turn = next;
                return MoveResult.Good();
            }
            bool[] vv2 = (bool[])s.V["_voted"]; vv2[seat] = true; s.V["_voted"] = vv2;
            int t2 = action == "vote" ? Cfg.I(Cfg.Rest(code)) : -1;
            int[] votes = (int[])s.V["votes"];
            if (t2 >= 0 && t2 < votes.Length) votes[t2]++;
            s.V["votes"] = votes;
            s.V["voted"] = IntV(s, "voted", 0) + 1;
            if (IntV(s, "voted", 0) >= CountAlive(s))
            {
                int mx = 0, outSeat = -1;
                for (int i = 0; i < votes.Length; i++) if (votes[i] > mx) { mx = votes[i]; outSeat = i; }
                if (outSeat >= 0)
                {
                    bool[] a = (bool[])s.V["alive"]; a[outSeat] = false; s.V["alive"] = a;
                    Say(s, "白天放逐座位 " + outSeat + "（" + Role(s, outSeat) + "）");
                }
                if (CheckEnd(s)) return MoveResult.Good();
                Night(s);
            }
            return MoveResult.Good();
        }
        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            List<string> kill = new List<string>();
            foreach (string k in d.Keys) if (k.StartsWith("role") || k.StartsWith("speech") || k.StartsWith("guard") || k.StartsWith("target")) kill.Add(k);
            foreach (string k in kill) d.Remove(k);
            string ph = StrV(s, "phase", "night");
            d["myRole"] = seat >= 0 ? Role(s, seat) : "";
            d["alive"] = (bool[])s.V["alive"];
            d["phase"] = ph;
            d["day"] = IntV(s, "day", 1);
            d["wolves"] = CountRole(s, "狼人");
            d["speaker"] = ph == "speech" ? s.Turn : -1;
            d["speeches"] = ((string[])s.V["speech"]).ToArray();
            d["spoken"] = ((bool[])s.V["_spoken"]).ToArray();
            d["voted"] = IntV(s, "voted", 0);
            d["aliveCount"] = CountAlive(s);
            string[] roles = NightRoles(s);
            int step = IntV(s, "nightStep", 0);
            string want = step < roles.Length ? roles[step] : "";
            d["nightRole"] = (ph == "night" && seat >= 0 && Role(s, seat) == want) ? want : "";
            return d;
        }
        public override Dictionary<string, object> View(GameState s, int seat)
        {
            Dictionary<string, object> v = base.View(s, seat);
            if (!s.Ended)
            {
                string ph = StrV(s, "phase", "night"), day = IntV(s, "day", 1).ToString(CultureInfo.InvariantCulture);
                if (ph == "night") v["phaseName"] = "第 " + day + " 夜 · 角色行动";
                else if (ph == "speech") v["phaseName"] = "第 " + day + " 天 · 发言（座位 " + s.Turn + "）";
                else v["phaseName"] = "第 " + day + " 天 · 放逐投票";
            }
            return v;
        }
    }

    public sealed class UndercoverGame : RuleBase
    {
        public override string Id { get { return "undercover"; } }
        public override string Renderer { get { return "party"; } }
        public override int MinSeats { get { return 3; } }
        public override int MaxSeats { get { return 9; } }
        public override string[] Variants { get { return new string[] { "经典", "白板" }; } }
        private static readonly string[][] PAIRS = new string[][] {
            new string[]{"奶茶","咖啡"}, new string[]{"空调","风扇"}, new string[]{"电影院","剧场"},
            new string[]{"铅笔","钢笔"}, new string[]{"西瓜","哈密瓜"}, new string[]{"地铁","公交"},
            new string[]{"爬山","徒步"}, new string[]{"火锅","烧烤"}
        };
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Cells = new string[0]; s.Width = 0; s.Height = 0;
            s.Seats = seats;
            string[] pair = PAIRS[NextRng(s, PAIRS.Length)];
            int spies = seats >= 7 ? 2 : 1;
            List<int> order = Enumerable.Range(0, seats).OrderBy(x => NextRng(s, 1000)).ToList();
            bool[] alive = new bool[seats];
            for (int i = 0; i < seats; i++)
            {
                alive[i] = true;
                bool spy = order.IndexOf(i) < spies;
                s.V["word" + i] = variant == "白板" && order.IndexOf(i) == spies ? "" : (spy ? pair[1] : pair[0]);
                s.V["spy" + i] = spy;
            }
            s.V["alive"] = alive;
            s.V["phase"] = "describe";
            s.V["votes"] = new int[seats]; s.V["_voted"] = new bool[seats]; s.V["voted"] = 0; s.V["round"] = 1;
            s.V["_spoken"] = new bool[seats]; s.V["speech"] = new string[seats];
            s.Turn = 0;
            return s;
        }
        private bool Alive(GameState s, int i) { bool[] a = (bool[])s.V["alive"]; return i >= 0 && i < a.Length && a[i]; }
        private bool Spy(GameState s, int i) { return BoolV(s, "spy" + i, false); }
        private int CountAlive(GameState s) { int n = 0; for (int i = 0; i < s.Seats; i++) if (Alive(s, i)) n++; return n; }
        private int FirstAlive(GameState s) { for (int i = 0; i < s.Seats; i++) if (Alive(s, i)) return i; return 0; }
        private List<int> Team(GameState s, bool spy)
        {
            List<int> r = new List<int>();
            for (int i = 0; i < s.Seats; i++) if (Spy(s, i) == spy) r.Add(i);
            return r;
        }
        private void ToVote(GameState s)
        {
            s.V["phase"] = "vote";
            s.V["votes"] = new int[s.Seats]; s.V["_voted"] = new bool[s.Seats]; s.V["voted"] = 0;
            s.Turn = FirstAlive(s);
        }
        private MoveResult Settle(GameState s)
        {
            int[] votes = (int[])s.V["votes"];
            int mx = 0, outSeat = -1;
            for (int i = 0; i < votes.Length; i++) if (votes[i] > mx) { mx = votes[i]; outSeat = i; }
            if (outSeat >= 0)
            {
                bool[] a = (bool[])s.V["alive"]; a[outSeat] = false; s.V["alive"] = a;
                Say(s, "座位 " + outSeat + " 出局，身份：" + (Spy(s, outSeat) ? "卧底" : "平民"));
            }
            int spies = 0, goods = 0;
            for (int i = 0; i < s.Seats; i++) if (Alive(s, i)) { if (Spy(s, i)) spies++; else goods++; }
            if (spies == 0) { FinishTeam(s, Team(s, false), "卧底全部出局，平民胜"); return MoveResult.Good(); }
            if (spies >= goods) { FinishTeam(s, Team(s, true), "卧底人数追平平民，卧底胜"); return MoveResult.Good(); }
            s.V["phase"] = "describe";
            s.V["_spoken"] = new bool[s.Seats]; s.V["speech"] = new string[s.Seats];
            s.V["votes"] = new int[s.Seats]; s.V["_voted"] = new bool[s.Seats]; s.V["voted"] = 0;
            s.V["round"] = IntV(s, "round", 1) + 1;
            s.Turn = FirstAlive(s);
            return MoveResult.Good();
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || !Alive(s, seat)) return r;
            string ph = StrV(s, "phase", "describe");
            if (ph == "describe")
            {
                bool[] sp = (bool[])s.V["_spoken"];
                r.Add("next");
                if (s.Turn == seat && (seat >= sp.Length || !sp[seat])) r.Add("say:*");
                return r;
            }
            bool[] vv = (bool[])s.V["_voted"];
            if (seat < vv.Length && vv[seat]) return r;
            for (int i = 0; i < s.Seats; i++) if (Alive(s, i) && i != seat) r.Add("vote:" + i);
            r.Add("next");
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = Convert.ToString(d["code"]);
            if (!Legal(s, seat).Contains(code) && !code.StartsWith("say:"))
                return MoveResult.Fail("当前不能这样行动");
            string ph = StrV(s, "phase", "describe");
            if (ph == "describe")
            {
                if (action == "next") { ToVote(s); return MoveResult.Good(); }
                if (action != "say") return MoveResult.Fail("现在只能描述");
                string text = Cfg.Rest(code);
                if (text.Length > 120) text = text.Substring(0, 120);
                string[] speech = (string[])s.V["speech"]; speech[seat] = text; s.V["speech"] = speech;
                bool[] sp = (bool[])s.V["_spoken"]; sp[seat] = true; s.V["_spoken"] = sp;
                if (text.Length > 0) Say(s, "座位 " + seat + " 描述：" + text);
                else Say(s, "座位 " + seat + " 跳过描述");
                int next = -1;
                for (int k = 1; k <= s.Seats; k++)
                { int i = (seat + k) % s.Seats; if (Alive(s, i) && !sp[i]) { next = i; break; } }
                if (next < 0) ToVote(s); else s.Turn = next;
                return MoveResult.Good();
            }
            if (action == "next")
            {
                if (IntV(s, "voted", 0) < CountAlive(s)) return MoveResult.Fail("还有人未投票");
                return Settle(s);
            }
            int t = Cfg.I(Cfg.Rest(code));
            bool[] vv2 = (bool[])s.V["_voted"]; vv2[seat] = true; s.V["_voted"] = vv2;
            int[] v = (int[])s.V["votes"]; if (t >= 0 && t < v.Length) v[t]++; s.V["votes"] = v;
            s.V["voted"] = IntV(s, "voted", 0) + 1;
            if (IntV(s, "voted", 0) >= CountAlive(s)) return Settle(s);
            return MoveResult.Good();
        }
        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            List<string> kill = new List<string>();
            foreach (string k in d.Keys)
                if (k.StartsWith("word") || k.StartsWith("spy") || k.StartsWith("speech") || (k.StartsWith("alive") && k.Length > 5)) kill.Add(k);
            foreach (string k in kill) d.Remove(k);
            string ph = StrV(s, "phase", "describe");
            d["myWord"] = seat >= 0 ? StrV(s, "word" + seat, "") : "";
            d["alive"] = (bool[])s.V["alive"];
            d["phase"] = ph;
            d["round"] = IntV(s, "round", 1);
            d["speaker"] = ph == "describe" ? s.Turn : -1;
            d["speeches"] = ((string[])s.V["speech"]).ToArray();
            d["spoken"] = ((bool[])s.V["_spoken"]).ToArray();
            d["voted"] = IntV(s, "voted", 0);
            d["aliveCount"] = CountAlive(s);
            return d;
        }
        public override Dictionary<string, object> View(GameState s, int seat)
        {
            Dictionary<string, object> v = base.View(s, seat);
            if (!s.Ended)
            {
                string ph = StrV(s, "phase", "describe"), round = IntV(s, "round", 1).ToString(CultureInfo.InvariantCulture);
                v["phaseName"] = ph == "describe"
                    ? "第 " + round + " 轮 · 描述（座位 " + s.Turn + "）"
                    : "第 " + round + " 轮 · 投票";
            }
            return v;
        }
    }

    public sealed class Point24Game : RuleBase
    {
        public override string Id { get { return "point24"; } }
        public override string Renderer { get { return "party"; } }
        public override int MinSeats { get { return 1; } }
        public override int MaxSeats { get { return 4; } }
        public override string[] Variants { get { return new string[] { "抢答" }; } }
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Cells = new string[0]; s.Width = 0; s.Height = 0;
            int[] n = new int[4];
            for (int i = 0; i < 4; i++) n[i] = 1 + NextRng(s, 9);
            s.V["nums"] = n; s.V["round"] = 1;
            return s;
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended) return r;
            r.Add("solve:*"); r.Add("new");
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = Convert.ToString(d["code"]);
            if (action == "new")
            {
                int[] n = (int[])s.V["nums"];
                for (int i = 0; i < 4; i++) n[i] = 1 + NextRng(s, 9);
                s.V["nums"] = n; s.V["round"] = IntV(s, "round", 1) + 1;
                Say(s, "新一题：" + string.Join(" ", n.Select(x => x.ToString()).ToArray()));
                return MoveResult.Good();
            }
            if (action != "solve") return MoveResult.Fail("未知动作");
            string expr = Cfg.Rest(code);
            int[] nums = (int[])s.V["nums"];
            Fractions.Parser p = new Fractions.Parser(expr);
            Fractions.Frac val;
            List<int> used = new List<int>();
            if (!p.Parse(out val, used)) return MoveResult.Fail("表达式不合法");
            List<int> a = new List<int>(used); a.Sort();
            List<int> b = new List<int>(nums); b.Sort();
            if (a.Count != 4 || !a.SequenceEqual(b)) return MoveResult.Fail("必须且只能使用给出的四个数");
            if (val.N != 24 * val.D) return MoveResult.Fail("结果不是 24（" + val + "）");
            Finish(s, seat, "座位 " + seat + " 抢答正确：" + expr + " = 24");
            return MoveResult.Good();
        }
        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            d["nums"] = (int[])s.V["nums"];
            d["round"] = IntV(s, "round", 1);
            return d;
        }
    }

    public static class Fractions
    {
        public struct Frac
        {
            public long N, D;
            public Frac(long n, long d)
            {
                if (d == 0) throw new DivideByZeroException();
                if (d < 0) { n = -n; d = -d; }
                long g = Gcd(Math.Abs(n), d); N = n / g; D = d / g;
            }
            public static Frac operator +(Frac a, Frac b) { return new Frac(a.N * b.D + b.N * a.D, a.D * b.D); }
            public static Frac operator -(Frac a, Frac b) { return new Frac(a.N * b.D - b.N * a.D, a.D * b.D); }
            public static Frac operator *(Frac a, Frac b) { return new Frac(a.N * b.N, a.D * b.D); }
            public static Frac operator /(Frac a, Frac b) { return new Frac(a.N * b.D, a.D * b.N); }
            public override string ToString() { return D == 1 ? N.ToString() : N + "/" + D; }
        }
        private static long Gcd(long a, long b) { while (b != 0) { long t = a % b; a = b; b = t; } return a == 0 ? 1 : a; }
        public sealed class Parser
        {
            private readonly string _s; private int _i; private readonly List<int> _used = new List<int>();
            public Parser(string s) { _s = s ?? ""; }
            public bool Parse(out Frac val, List<int> used)
            {
                val = new Frac(0, 1);
                try
                {
                    val = Expr();
                    Skip();
                    if (_i != _s.Length) return false;
                    if (_used.Count > 4) return false;
                    used.AddRange(_used);
                    return true;
                }
                catch (Exception) { return false; }
            }
            private void Skip() { while (_i < _s.Length && char.IsWhiteSpace(_s[_i])) _i++; }
            private Frac Expr()
            {
                Frac a = Term();
                while (true)
                {
                    Skip();
                    if (_i >= _s.Length || (_s[_i] != '+' && _s[_i] != '-')) break;
                    char op = _s[_i++]; Frac b = Term();
                    a = op == '+' ? a + b : a - b;
                }
                return a;
            }
            private Frac Term()
            {
                Frac a = Factor();
                while (true)
                {
                    Skip();
                    if (_i >= _s.Length || (_s[_i] != '*' && _s[_i] != '/' && _s[_i] != '×' && _s[_i] != '÷')) break;
                    char op = _s[_i++]; Frac b = Factor();
                    a = (op == '*' || op == '×') ? a * b : a / b;
                }
                return a;
            }
            private Frac Factor()
            {
                Skip();
                if (_i >= _s.Length) throw new FormatException();
                if (_s[_i] == '(')
                {
                    _i++; Frac v = Expr(); Skip();
                    if (_i >= _s.Length || _s[_i] != ')') throw new FormatException();
                    _i++; return v;
                }
                if (_s[_i] == '-') { _i++; Frac v = Factor(); return new Frac(-v.N, v.D); }
                int start = _i;
                while (_i < _s.Length && char.IsDigit(_s[_i])) _i++;
                if (start == _i) throw new FormatException();
                int n = int.Parse(_s.Substring(start, _i - start));
                _used.Add(n);
                return new Frac(n, 1);
            }
        }
    }

    public sealed class SolitaireGame : RuleBase
    {
        public override string Id { get { return "solitaire"; } }
        public override string Renderer { get { return "party"; } }
        public override int MinSeats { get { return 1; } }
        public override int MaxSeats { get { return 1; } }
        public override string[] Variants { get { return new string[] { "经典" }; } }
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Cells = new string[0]; s.Width = 0; s.Height = 0;
            List<string> deck = Cards.Deck(1, false); Shuffle(s, deck);
            s.Hands[0] = new List<string>();
            for (int i = 0; i < 13 && deck.Count > 0; i++) { s.Hands[0].Add(deck[0]); deck.RemoveAt(0); }
            s.V["pile"] = Cards.Val(deck[0]).ToString();
            deck.RemoveAt(0);
            s.V["rest"] = deck.ToArray(); s.V["moves"] = 0;
            return s;
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended) return r;
            int top = Cfg.I(StrV(s, "pile", "0"));
            for (int i = 0; i < s.Hands[0].Count; i++)
                if (Math.Abs(Cards.Val(s.Hands[0][i]) - top) == 1 || Cards.Val(s.Hands[0][i]) == top) r.Add("p:" + i);
            r.Add("draw");
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = Convert.ToString(d["code"]);
            if (action == "draw")
            {
                List<string> rest = new List<string>((string[])s.V["rest"]);
                if (rest.Count > 0) { s.Hands[0].Add(rest[0]); rest.RemoveAt(0); }
                s.V["rest"] = rest.ToArray(); return MoveResult.Good();
            }
            if (action != "p" || !Legal(s, seat).Contains(code)) return MoveResult.Fail("接不上");
            int idx = Cfg.I(Cfg.Rest(code));
            string c = s.Hands[0][idx];
            s.Hands[0].RemoveAt(idx);
            s.V["pile"] = Cards.Val(c).ToString();
            s.V["moves"] = IntV(s, "moves", 0) + 1;
            s.Last = code;
            if (s.Hands[0].Count == 0) Finish(s, 0, "练习完成，共 " + IntV(s, "moves", 0) + " 手");
            return MoveResult.Good();
        }
        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            d["pile"] = StrV(s, "pile", "0");
            d["restLeft"] = ((string[])s.V["rest"]).Length;
            d["moves"] = IntV(s, "moves", 0);
            return d;
        }
    }
}
