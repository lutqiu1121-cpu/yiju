using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Qipai
{

    public sealed class UnoGame : RuleBase
    {
        public override string Id { get { return "uno"; } }
        public override string Renderer { get { return "table"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return 8; } }
        public override string[] Variants { get { return new string[] { "经典", "叠牌" }; } }
        private static readonly string[] COLORS = { "R", "Y", "G", "B" };
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Cells = new string[0]; s.Width = 0; s.Height = 0;
            List<string> deck = new List<string>();
            for (int c = 0; c < 4; c++)
            {
                for (int n = 0; n <= 9; n++) deck.Add(COLORS[c] + n);
                for (int k = 0; k < 2; k++) { deck.Add(COLORS[c] + "S"); deck.Add(COLORS[c] + "R"); deck.Add(COLORS[c] + "+2"); }
            }
            for (int i = 0; i < 4; i++) { deck.Add("W"); deck.Add("W4"); }
            Shuffle(s, deck);
            for (int i = 0; i < seats; i++) s.Hands[i] = new List<string>();
            for (int k = 0; k < 7; k++) for (int i = 0; i < seats; i++) { s.Hands[i].Add(deck[0]); deck.RemoveAt(0); }
            string top = deck[0]; deck.RemoveAt(0);
            while (top == "W" || top == "W4") { deck.Add(top); top = deck[0]; deck.RemoveAt(0); }
            s.V["top"] = top; s.V["color"] = top.Substring(0, 1);
            s.V["rest"] = deck.ToArray();
            s.V["discard"] = new string[0];
            s.V["dir"] = 1; s.V["pending"] = 0;
            s.V["uno"] = new bool[seats];
            s.V["colorBy"] = -1;
            s.V["stack"] = variant == "叠牌";
            return s;
        }
        private string Color(string c) { return c.Length > 0 ? c.Substring(0, 1) : ""; }
        private string Face(string c) { return c.Length > 1 ? c.Substring(1) : ""; }
        private bool Stack(GameState s) { return OptB(s, "stack", s.V.ContainsKey("stack") && Convert.ToBoolean(s.V["stack"])); }
        private bool Playable(GameState s, string c)
        {
            string top = StrV(s, "top", "");
            if (c == "W" || c == "W4") return true;
            return Color(c) == StrV(s, "color", "R") || Face(c) == Face(top);
        }
        private bool IsPenaltyCard(string c) { return c == "W4" || c.EndsWith("+2"); }
        private void AdvanceDir(GameState s)
        {
            if (IntV(s, "dir", 1) < 0) { s.Turn = (s.Turn - 1 + s.Seats) % s.Seats; s.MoveNo++; }
            else Next(s, -1);
        }
        private void Recycle(GameState s)
        {
            List<string> rest = new List<string>((string[])s.V["rest"]);
            if (rest.Count > 0) return;
            List<string> disc = new List<string>(s.V.ContainsKey("discard") ? (string[])s.V["discard"] : new string[0]);
            if (disc.Count == 0) return;
            Shuffle(s, disc);
            rest.AddRange(disc);
            s.V["rest"] = rest.ToArray();
            s.V["discard"] = new string[0];
            Say(s, "敛牌堆洗回牌堆");
        }
        private void DrawCards(GameState s, int seat, int n)
        {
            for (int k = 0; k < n; k++)
            {
                Recycle(s);
                List<string> rest = new List<string>((string[])s.V["rest"]);
                if (rest.Count == 0) { Say(s, "牌堆与敛牌堆都空了，本局流局"); Finish(s, -1, "云笺牌荒流局"); return; }
                s.Hands[seat].Add(rest[0]); rest.RemoveAt(0);
                s.V["rest"] = rest.ToArray();
            }
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat || !s.Hands.ContainsKey(seat)) return r;
            if (StrV(s, "color", "") == "")
            {

                if (IntV(s, "colorBy", -1) == seat)
                    for (int k = 0; k < 4; k++) r.Add("color:" + COLORS[k]);
                return r;
            }
            int pending = IntV(s, "pending", 0);
            if (pending > 0)
            {
                if (Stack(s))
                    for (int i = 0; i < s.Hands[seat].Count; i++)
                        if (IsPenaltyCard(s.Hands[seat][i])) r.Add("p:" + i);
                if (StrV(s, "top", "") == "W4" && OptB(s, "challenge", true)) r.Add("challenge");
                r.Add("draw");
                return r;
            }
            for (int i = 0; i < s.Hands[seat].Count; i++) if (Playable(s, s.Hands[seat][i])) r.Add("p:" + i);
            r.Add("draw");
            if (s.Hands[seat].Count <= 2) r.Add("uno");
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = Convert.ToString(d["code"]);
            if (action == "color")
            {
                if (IntV(s, "colorBy", -1) != seat) return MoveResult.Fail("等出牌的人选颜色");
                string c = Cfg.Rest(code);
                if (Array.IndexOf(COLORS, c) < 0) return MoveResult.Fail("无效颜色");
                s.V["color"] = c; s.V["colorBy"] = -1;
                Say(s, "换色为 " + c);
                AdvanceDir(s); return MoveResult.Good();
            }
            if (action == "uno")
            {
                bool[] u = s.V["uno"] as bool[];
                if (u == null || u.Length != s.Seats) { u = new bool[s.Seats]; s.V["uno"] = u; }
                u[seat] = true;
                Say(s, "座位 " + seat + "：呼笺!");
                return MoveResult.Good();
            }
            if (action == "challenge")
            {
                int w4By = IntV(s, "w4By", seat), penalty = IntV(s, "pending", 0);
                string prev = StrV(s, "w4Prev", "");
                bool illegal = false;
                if (w4By >= 0 && w4By < s.Seats && prev.Length > 0 && s.Hands.ContainsKey(w4By))
                    for (int i = 0; i < s.Hands[w4By].Count; i++)
                        if (Color(s.Hands[w4By][i]) == prev) { illegal = true; break; }
                s.V["pending"] = 0;
                if (illegal) { DrawCards(s, w4By, 4); MarkFeat(s, "wild_challenge"); Say(s, "质疑成立：出牌者手里有 " + prev + " 色牌，自摸 4 张"); }
                else { DrawCards(s, seat, penalty + 2); Say(s, "质疑失败：挑战者摸 " + (penalty + 2) + " 张"); }
                s.V["w4By"] = -1; s.V["w4Prev"] = "";
                if (s.Ended) return MoveResult.Good();
                AdvanceDir(s); return MoveResult.Good();
            }
            if (action == "draw")
            {
                int penalty = IntV(s, "pending", 0);
                DrawCards(s, seat, penalty + 1);
                if (s.Ended) return MoveResult.Good();
                s.V["pending"] = 0;
                Say(s, "座位 " + seat + " 摸 " + (penalty + 1) + " 张");
                AdvanceDir(s); return MoveResult.Good();
            }
            if (action != "p") return MoveResult.Fail("未知动作");
            if (!Legal(s, seat).Contains(code)) return MoveResult.Fail("该牌不能出（有罚摸须先结算）");
            int idx = Cfg.I(Cfg.Rest(code));
            string card = s.Hands[seat][idx];
            string prevColor = StrV(s, "color", "R");

            List<string> disc = new List<string>(s.V.ContainsKey("discard") ? (string[])s.V["discard"] : new string[0]);
            string oldTop = StrV(s, "top", "");
            if (oldTop.Length > 0) disc.Add(oldTop);
            s.V["discard"] = disc.ToArray();
            s.Hands[seat].RemoveAt(idx);
            s.V["top"] = card;
            s.V["color"] = Color(card) == "W" ? "" : Color(card);
            s.Last = code;
            bool[] uno = s.V["uno"] as bool[];
            bool shouted = uno != null && seat < uno.Length && uno[seat];
            if (uno != null && seat < uno.Length) uno[seat] = false;
            if (card == "W" || card == "W4") s.V["colorBy"] = seat;
            if (card.EndsWith("+2")) s.V["pending"] = IntV(s, "pending", 0) + 2;
            if (card == "W4")
            {
                s.V["pending"] = IntV(s, "pending", 0) + 4;
                s.V["w4By"] = seat; s.V["w4Prev"] = prevColor;
            }
            if (card.EndsWith("R")) { s.V["dir"] = -IntV(s, "dir", 1); Say(s, "反转方向"); }
            if (s.Hands[seat].Count == 0) { Finish(s, seat, "出完手牌，胜"); return MoveResult.Good(); }
            if (s.Hands[seat].Count == 1 && !shouted && OptB(s, "shoutUno", true))
            {
                DrawCards(s, seat, 2);
                Say(s, "座位 " + seat + " 剩一张没喊 云笺，罚摸 2 张");
            }
            if (s.Ended) return MoveResult.Good();
            if (StrV(s, "color", "") == "") { Say(s, "请选择颜色"); return MoveResult.Good(); }

            int steps = (card.EndsWith("S") && !card.StartsWith("W")) ? 2 : 1;
            for (int k = 0; k < steps; k++) AdvanceDir(s);
            return MoveResult.Good();
        }
        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            d["topCard"] = StrV(s, "top", "");
            d["color"] = StrV(s, "color", "R");
            d["dir"] = IntV(s, "dir", 1);
            d["pending"] = IntV(s, "pending", 0);
            d["restLeft"] = ((string[])s.V["rest"]).Length;
            d["stack"] = Stack(s);
            return d;
        }
    }

    public sealed class BridgeGame : RuleBase
    {
        public override string Id { get { return "bridge"; } }
        public override string Renderer { get { return "table"; } }
        public override int MinSeats { get { return 4; } }
        public override int MaxSeats { get { return 4; } }
        public override string[] Variants { get { return new string[] { "简版定约" }; } }
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Cells = new string[0]; s.Width = 0; s.Height = 0;
            List<string> deck = Cards.Deck(1, false); Shuffle(s, deck);
            for (int i = 0; i < seats; i++) s.Hands[i] = new List<string>();
            for (int k = 0; k < 13; k++) for (int i = 0; i < seats; i++) { s.Hands[i].Add(deck[0]); deck.RemoveAt(0); }
            for (int i = 0; i < seats; i++) Cards.SortHand(s.Hands[i]);
            s.V["phase"] = "bid"; s.V["_phase"] = "bid"; s.V["contract"] = 0; s.V["declarer"] = -1;
            s.V["trump"] = "N"; s.V["bidTrump"] = "N"; s.V["trick"] = new string[0]; s.V["lead"] = "";
            s.V["tricks"] = new int[2]; s.V["bidTurn"] = 0;
            s.V["dbl"] = 0; s.V["passes"] = 0; s.V["bidLevel"] = 0;
            return s;
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat) return r;
            if (StrV(s, "phase", "play") == "bid")
            {
                r.Add("bid:0");
                for (int n = IntV(s, "contract", 0) + 1; n <= 7; n++) r.Add("bid:" + n);
                if (OptB(s, "doubling", true) && IntV(s, "contract", 0) > 0)
                {
                    int dec = IntV(s, "declarer", -1), dbl = IntV(s, "dbl", 0);
                    if (dbl == 0 && seat % 2 != dec % 2) r.Add("dbl");
                    if (dbl == 1 && seat % 2 == dec % 2) r.Add("rdbl");
                }
                return r;
            }
            if (StrV(s, "phase", "play") == "trump")
            {
                if (seat != IntV(s, "declarer", -1)) return r;
                string[] suits = { "N", "S", "H", "C", "D" };
                for (int i = 0; i < suits.Length; i++) r.Add("trump:" + suits[i]);
                return r;
            }
            r.Add("p:*"); return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = Convert.ToString(d["code"]);
            if (StrV(s, "phase", "play") == "bid")
            {
            if (action == "dbl" || action == "rdbl")
            {
                int dbl = IntV(s, "dbl", 0), dec = IntV(s, "declarer", -1);
                if (action == "dbl" && (dbl != 0 || seat % 2 == dec % 2)) return MoveResult.Fail("现在不能加倍");
                if (action == "rdbl" && (dbl != 1 || seat % 2 != dec % 2)) return MoveResult.Fail("现在不能再加倍");
                s.V["dbl"] = action == "dbl" ? 1 : 2; s.V["passes"] = 0;
                Say(s, "座位 " + seat + (action == "dbl" ? " 加倍" : " 再加倍"));
                Next(s, -1); return MoveResult.Good();
            }
            int n = Cfg.I(Cfg.Rest(code));
            if (action != "bid" || n < 0 || n > 7) return MoveResult.Fail("叫品不合法");
            int passes = IntV(s, "passes", 0);
            if (n > 0) { s.V["contract"] = n; s.V["declarer"] = seat; s.V["trump"] = "N"; s.V["dbl"] = 0; passes = 0; Say(s, "座位 " + seat + " 叫 " + n); }
            else { passes++; Say(s, "座位 " + seat + " Pass"); }
            s.V["passes"] = passes;
            if (IntV(s, "contract", 0) == 0 && passes >= 4)
            { Finish(s, -1, "四家 Pass · Pass-out，本副重发"); return MoveResult.Good(); }
            int t = IntV(s, "bidTurn", 0) + 1; s.V["bidTurn"] = t;
                if (t >= s.Seats || n == 7)
                {
                    if (IntV(s, "declarer", -1) < 0) s.V["declarer"] = 0;
                    s.V["contract"] = Math.Max(1, IntV(s, "contract", 1));
            s.V["phase"] = "trump"; s.PhaseName = "定将牌"; s.V["_phase"] = "bid";
                    s.Turn = IntV(s, "declarer", 0);
                    Say(s, "主家座位 " + s.Turn + " 请选择将牌（N 为无将）");
                    return MoveResult.Good();
                }
                Next(s, -1); return MoveResult.Good();
            }
            if (action == "trump")
            {
                if (StrV(s, "phase", "play") != "trump" || seat != IntV(s, "declarer", -1))
                    return MoveResult.Fail("等主家定将牌");
                string suit = Cfg.Rest(code);
                if ("NSHCD".IndexOf(suit) < 0 || suit.Length != 1) return MoveResult.Fail("无效将牌");
                s.V["trump"] = suit; s.V["bidTrump"] = suit;
                s.V["phase"] = "play"; s.PhaseName = "打牌";
                s.Turn = (IntV(s, "declarer", 0) + 1) % s.Seats;
                Say(s, "定约 " + IntV(s, "contract", 1) + " · " + (suit == "N" ? "无将" : suit + " 为将牌"));
                return MoveResult.Good();
            }
            if (action != "p") return MoveResult.Fail("未知动作");
            List<int> idx = ParseList(Cfg.Rest(code));
            if (idx.Count != 1) return MoveResult.Fail("每墩出一张");
            List<string> chosen = Cards.Take(s, s.Hands, seat, idx);
            if (chosen == null || chosen.Count != 1) return MoveResult.Fail("无效手牌");
            string c = chosen[0];
            List<string> trick = new List<string>((string[])s.V["trick"]);
            if (trick.Count > 0)
            {
                string lead = Cards.Suit(trick[0]);
                bool hasLead = false;
                for (int i = 0; i < s.Hands[seat].Count; i++) if (Cards.Suit(s.Hands[seat][i]) == lead) hasLead = true;
                if (hasLead && Cards.Suit(c) != lead) { s.Hands[seat].Add(c); return MoveResult.Fail("必须跟花色"); }
            }
            trick.Add(c); s.V["trick"] = trick.ToArray(); s.Last = code;
            if (trick.Count < s.Seats) { Next(s, -1); return MoveResult.Good(); }
            string leadSuit = Cards.Suit(trick[0]);
            int win = 0, best = -1000;
            string trump = StrV(s, "trump", "N");
            for (int i = 0; i < trick.Count; i++)
            {
                bool isTrump = trump != "N" && (Cards.Suit(trick[i]) == trump || Cards.IsJoker(trick[i]));
                bool isLead = Cards.Suit(trick[i]) == leadSuit;
                int v = isTrump ? 100 + Cards.Val(trick[i]) : isLead ? Cards.Val(trick[i]) : -1;
                if (v > best) { best = v; win = i; }
            }
            int winner = (s.Turn + 1 + win) % s.Seats;
            int[] tricks = (int[])s.V["tricks"]; tricks[winner % 2]++; s.V["tricks"] = tricks;
            s.V["trick"] = new string[0];
            s.Turn = winner;
            int total = tricks[0] + tricks[1];
            if (total >= 13)
            {
            int dec = IntV(s, "declarer", 0), need = 6 + IntV(s, "contract", 1);
            int madeTricks = tricks[dec % 2];
            bool made = madeTricks >= need;
            s.V["score"] = tricks;
            string detail;
            int pts = ContractScore(s, madeTricks, need, out detail);
            s.V["_contractPts"] = pts;
            FinishTeam(s, made ? new int[] { dec, (dec + 2) % 4 } : new int[] { (dec + 1) % 4, (dec + 3) % 4 },
                "定约 " + (made ? "完成" : "宕掉") + " · 墩数 " + tricks[0] + " : " + tricks[1] + " · " + detail);
                return MoveResult.Good();
            }
            return MoveResult.Good("第 " + total + " 墩由座位 " + winner + " 收下");
        }

        private int ContractScore(GameState s, int madeTricks, int need, out string detail)
        {
            if (OptS(s, "scoring", "duplicate") == "simple")
            { detail = "简式计分"; return madeTricks >= need ? 1 : -1; }
            int lvl = IntV(s, "contract", 1), dbl = IntV(s, "dbl", 0);
            string tr = StrV(s, "trump", "N");
            int mult = dbl == 0 ? 1 : dbl == 1 ? 2 : 4;
            int vul = OptS(s, "vulnerable", "none") == "both" ? 1 : 0;
            detail = "定约 " + lvl + (tr == "N" ? "NT" : tr) + (dbl == 1 ? "×" : dbl == 2 ? "××" : "") + (vul > 0 ? " 有局" : " 无局");
            if (madeTricks >= need)
            {
                int per = (tr == "C" || tr == "D") ? 20 : (tr == "H" || tr == "S") ? 30 : 0;
                int odd = per > 0 ? lvl * per * mult : (40 + 30 * (lvl - 1)) * mult;
                int over = madeTricks - need;
                int overVal = dbl == 0 ? over * (per > 0 ? per : 30)
                    : over * (vul > 0 ? 200 : 100) * (dbl == 2 ? 2 : 1);
                int bonus = odd >= 100 ? (vul > 0 ? 500 : 300) : 50;
                if (dbl == 1) bonus += 50;
                if (dbl == 2) bonus += 100;
                int slam = need == 12 ? (vul > 0 ? 750 : 500) : need == 13 ? (vul > 0 ? 1500 : 1000) : 0;
                int total = odd + overVal + bonus + slam;
                detail += " · 主家方 +" + total + " 分";
                return total;
            }
            int under = need - madeTricks;
            int pen = dbl == 0 ? under * (vul > 0 ? 100 : 50)
                : (vul > 0 ? 200 : 100) * (dbl == 2 ? 2 : 1) + (under - 1) * ((vul > 0 ? 300 : 200) * (dbl == 2 ? 2 : 1));
            detail += " · 防守方 +" + pen + " 分";
            return -pen;
        }
        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            d["trickCards"] = (string[])s.V["trick"];
            d["contract"] = IntV(s, "contract", 0);
            d["declarer"] = IntV(s, "declarer", -1);
            d["trump"] = StrV(s, "trump", "N");
            d["tricks"] = (int[])s.V["tricks"];
            d["bidPhase"] = StrV(s, "phase", "play") == "bid";
            d["trumpPhase"] = StrV(s, "phase", "play") == "trump";
            int dummy = (IntV(s, "declarer", -1) + 2) % 4;
            d["dummy"] = dummy;
            d["dummyHand"] = (StrV(s, "phase", "play") == "play" && s.Hands.ContainsKey(dummy))
                ? s.Hands[dummy].ToArray() : new string[0];
            return d;
        }
    }

    public sealed class MahjongGame : RuleBase
    {
        public override string Id { get { return "mahjong"; } }
        public override string Renderer { get { return "table"; } }
        public override int MinSeats { get { return 4; } }
        public override int MaxSeats { get { return 4; } }
        public override string[] Variants { get { return new string[] { "国标", "川麻", "广东推倒胡" }; } }
        private static readonly string[] TILES = BuildTiles();
        private static string[] BuildTiles()
        {
            List<string> t = new List<string>();
            string[] suits = { "W", "T", "B" };
            for (int s = 0; s < 3; s++) for (int n = 1; n <= 9; n++) for (int k = 0; k < 4; k++) t.Add(suits[s] + n);
            for (int n = 1; n <= 7; n++) for (int k = 0; k < 4; k++) t.Add("Z" + n);
            return t.ToArray();
        }
        private string Var(GameState s) { return StrV(s, "variant", "国标"); }
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Cells = new string[0]; s.Width = 0; s.Height = 0;
            List<string> wall = new List<string>(TILES); Shuffle(s, wall);
            for (int i = 0; i < seats; i++) s.Hands[i] = new List<string>();
            for (int k = 0; k < 13; k++) for (int i = 0; i < seats; i++) { s.Hands[i].Add(wall[0]); wall.RemoveAt(0); }
            if (wall.Count > 0) { s.Hands[0].Add(wall[0]); wall.RemoveAt(0); }
            for (int i = 0; i < seats; i++) Cards.SortHand(s.Hands[i]);
            s.V["wall"] = wall.ToArray();
            s.V["discards"] = new string[0];
            s.V["meld"] = new int[seats];
            s.V["variant"] = variant;
            s.V["phase"] = "discard";
            s.V["lastDiscard"] = "";
            s.V["lastBy"] = -1;
            s.V["claims"] = new bool[seats];
            s.V["claimWanted"] = new string[seats];
            s.V["fan"] = 0;
            return s;
        }
        private static Dictionary<string, int> Cnt(List<string> h)
        {
            Dictionary<string, int> d = new Dictionary<string, int>();
            for (int i = 0; i < h.Count; i++) { if (!d.ContainsKey(h[i])) d[h[i]] = 0; d[h[i]]++; }
            return d;
        }

        private int Fan(List<string> h, GameState s)
        {
            Dictionary<string, int> c = Cnt(h);
            int fan = 0;
            if (Thirteen(h)) fan += 12;
            int suits = 0;
            for (int i = 0; i < 3; i++) foreach (KeyValuePair<string, int> kv in c) if (kv.Key[0] == "WTB"[i]) { suits++; break; }
            bool hasZ = false, hasYao = false;
            foreach (KeyValuePair<string, int> kv in c)
            {
                if (kv.Key[0] == 'Z') { hasZ = true; hasYao = true; }
                else if (kv.Key.Length > 1 && (kv.Key[1] == '1' || kv.Key[1] == '9')) hasYao = true;
            }
            if (suits == 1 && !hasZ) fan += 8;
            else if (suits == 1 && hasZ) fan += 2;
            if (!hasYao) fan += 2;
            int pairs = 0; bool seven = true, allSeq = true;
            foreach (KeyValuePair<string, int> kv in c)
            {
                if (kv.Value % 2 != 0) seven = false;
                pairs += kv.Value / 2;
                if (kv.Value >= 3) allSeq = false;
            }
            if (seven && pairs == 7 && h.Count == 14) { fan += 4; MarkFeat(s, "seven_pairs"); }
            if (AllTriplets(h)) fan += 2;
            if (allSeq && !seven) fan += 2;
            for (int si = 0; si < 3; si++)
            {
                string su = "WTB"[si].ToString(); bool ok = true;
                for (int n = 1; n <= 9; n++) if (!c.ContainsKey(su + n)) { ok = false; break; }
                if (ok) { fan += 16; break; }
            }
            int[] meld = s.V.ContainsKey("meld") ? (int[])s.V["meld"] : new int[s.Seats];
            bool selfDraw = s.V.ContainsKey("_selfDraw") && Convert.ToBoolean(s.V["_selfDraw"]);
            if (selfDraw && meld[s.Turn] == 0) fan += 1;
            string huKind = StrV(s, "_huKind", "");
            if (huKind == "gang" || huKind == "last" || huKind == "rob") fan += 4;
            if (fan == 0) fan = 1;
            return fan;
        }
        private int MinFan(GameState s) { return Var(s) == "国标" ? OptI(s, "minFan", 8) : 1; }
        private bool AllTriplets(List<string> h)
        {

            Dictionary<string, int> c = Cnt(h);
            List<string> keys = c.Keys.ToList();
            for (int p = 0; p < keys.Count; p++)
            {
                if (c[keys[p]] < 2) continue;
                c[keys[p]] -= 2;
                bool ok = true;
                foreach (KeyValuePair<string, int> kv in c) if (kv.Value % 3 != 0) { ok = false; break; }
                c[keys[p]] += 2;
                if (ok) return true;
            }
            return false;
        }
        private bool Thirteen(List<string> h)
        {
            if (h.Count != 14) return false;
            string[] want = { "W1","W9","T1","T9","B1","B9","Z1","Z2","Z3","Z4","Z5","Z6","Z7" };
            Dictionary<string, int> c = Cnt(h);
            int dup = 0;
            for (int i = 0; i < want.Length; i++)
            {
                int n; c.TryGetValue(want[i], out n);
                if (n == 0) return false;
                if (n == 2) dup++;
                if (n > 2) return false;
            }
            return dup == 1;
        }
        private bool CanHu(List<string> h, string variant, GameState s)
        {
            if (h.Count != 14) return false;
            if (variant == "川麻" && OptB(s, "queMen", true))
            {
                int suits = 0;
                for (int i = 0; i < 3; i++) foreach (string c in h) if (c[0] == "WTB"[i]) { suits++; break; }
                if (suits != 2) return false;
            }
            Dictionary<string, int> cnt = Cnt(h);
            if (Thirteen(h)) return true;
            int pairs = 0; bool seven = true;
            foreach (KeyValuePair<string, int> kv in cnt) { if (kv.Value % 2 != 0) seven = false; pairs += kv.Value / 2; }
            if (seven && pairs == 7) return Fan(h, s) >= MinFan(s);
            List<string> keys = cnt.Keys.ToList();
            for (int p = 0; p < keys.Count; p++)
            {
                if (cnt[keys[p]] < 2) continue;
                cnt[keys[p]] -= 2;
                if (Decompose(cnt, 4)) { cnt[keys[p]] += 2; return Fan(h, s) >= MinFan(s); }
                cnt[keys[p]] += 2;
            }
            return false;
        }
        private bool Decompose(Dictionary<string, int> cnt, int sets)
        {
            if (sets == 0)
            {
                foreach (KeyValuePair<string, int> kv in cnt) if (kv.Value != 0) return false;
                return true;
            }
            string first = null;
            foreach (KeyValuePair<string, int> kv in cnt) if (kv.Value > 0) { first = kv.Key; break; }
            if (first == null) return false;
            if (cnt[first] >= 3) { cnt[first] -= 3; bool ok = Decompose(cnt, sets - 1); cnt[first] += 3; if (ok) return true; }
            if (first[0] != 'Z' && first.Length >= 2)
            {
                int n = int.Parse(first.Substring(1));
                if (n <= 7)
                {
                    string a = first.Substring(0, 1) + (n + 1), b = first.Substring(0, 1) + (n + 2);
                    if (cnt.ContainsKey(a) && cnt[a] > 0 && cnt.ContainsKey(b) && cnt[b] > 0)
                    {
                        cnt[first]--; cnt[a]--; cnt[b]--;
                        bool ok = Decompose(cnt, sets - 1);
                        cnt[first]++; cnt[a]++; cnt[b]++;
                        if (ok) return true;
                    }
                }
            }
            return false;
        }
        private bool CanPeng(GameState s, int seat, string tile)
        {
            int n = 0; for (int i = 0; i < s.Hands[seat].Count; i++) if (s.Hands[seat][i] == tile) n++;
            return n >= 2;
        }
        private bool CanGang(GameState s, int seat, string tile)
        {
            int n = 0; for (int i = 0; i < s.Hands[seat].Count; i++) if (s.Hands[seat][i] == tile) n++;
            return n >= 3;
        }
        private string CanChi(GameState s, int seat, string tile)
        {
            if (tile.Length < 2 || tile[0] == 'Z') return "";
            int n = int.Parse(tile.Substring(1));
            string suit = tile.Substring(0, 1);
            for (int start = Math.Max(1, n - 2); start <= Math.Min(7, n); start++)
            {
                bool ok = true;
                for (int k = start; k < start + 3; k++)
                {
                    if (k == n) continue;
                    string need = suit + k;
                    bool have = false;
                    for (int i = 0; i < s.Hands[seat].Count; i++) if (s.Hands[seat][i] == need) { have = true; break; }
                    if (!have) { ok = false; break; }
                }
                if (ok) return start + "," + (start + 1) + "," + (start + 2);
            }
            return "";
        }
        private void DrawOne(GameState s, int seat)
        {
            List<string> wall = new List<string>((string[])s.V["wall"]);
            if (wall.Count == 0) { Finish(s, -1, "牌墙摸完，流局"); return; }
            s.Hands[seat].Add(wall[0]); wall.RemoveAt(0);
            s.V["wall"] = wall.ToArray();
            if (wall.Count == 0) Say(s, "牌墙只剩最后一巡");
        }
        private void FillTo14(GameState s, int seat)
        {
            int guard = 0;
            while (!s.Ended && s.Hands[seat].Count < 14 && guard++ < 6) DrawOne(s, seat);
        }
        private void NextDraw(GameState s, int seat)
        {
            DrawOne(s, seat);
            if (s.Ended) return;
            s.Turn = seat;
            s.V["phase"] = "discard";
            s.V["lastDiscard"] = "";
            s.V["lastBy"] = -1;
        }
        private int Priority(string c)
        {
            if (c == "hu") return 4;
            if (c == "gang") return 3;
            if (c == "peng") return 2;
            if (c != null && c.StartsWith("chi")) return 1;
            return 0;
        }
        private void ResolveClaims(GameState s)
        {
            string[] want = s.V["claimWanted"] as string[] ?? new string[s.Seats];
            int winner = -1; string code = "";
            for (int i = 0; i < s.Seats; i++)
                if (want[i] != null && Priority(want[i]) > Priority(code)) { winner = i; code = want[i]; }
            string tile = StrV(s, "lastDiscard", "");
            List<string> disc = new List<string>((string[])s.V["discards"]);
            if (winner < 0)
            {
                int next = (IntV(s, "lastBy", 0) + 1) % s.Seats;
                NextDraw(s, next);
                return;
            }

            if (disc.Count > 0) disc.RemoveAt(disc.Count - 1);
            s.V["discards"] = disc.ToArray();
            s.V["claims"] = new bool[s.Seats];
            s.V["claimWanted"] = new string[s.Seats];
            if (code == "hu")
            {
                s.Hands[winner].Add(tile);
                int fan = Fan(s.Hands[winner], s);
                s.V["fan"] = fan;
                s.V["pointBy"] = IntV(s, "lastBy", 0);
                Finish(s, winner, "点炮胡 · " + Var(s) + " · " + fan + " 番（由座位 " + IntV(s, "lastBy", 0) + " 放出）");
                return;
            }
            int need = code == "gang" ? 3 : 2;
            int removed = 0;
            for (int i = s.Hands[winner].Count - 1; i >= 0 && removed < need; i--)
                if (s.Hands[winner][i] == tile) { s.Hands[winner].RemoveAt(i); removed++; }
            if (code.StartsWith("chi"))
            {
                string[] seq = code.Substring(4).Split(',');
                int n = int.Parse(tile.Substring(1));
                for (int k = 0; k < seq.Length; k++)
                {
                    if (int.Parse(seq[k]) == n) continue;
                    string t2 = tile.Substring(0, 1) + seq[k];
                    for (int i = 0; i < s.Hands[winner].Count; i++) if (s.Hands[winner][i] == t2) { s.Hands[winner].RemoveAt(i); break; }
                }
                s.Hands[winner].Add(tile);
                Say(s, "座位 " + winner + " 吃 " + tile);
            }
            else
            {
                s.Hands[winner].Add(tile);
                Say(s, "座位 " + winner + " " + (code == "gang" ? "杠" : "碰"));
            }
            int[] meld = (int[])s.V["meld"]; meld[winner]++; s.V["meld"] = meld;

            FillTo14(s, winner);
            if (s.Ended) return;
            s.Turn = winner;
            s.V["phase"] = "discard";
            Say(s, "请打出一张");
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || !s.Hands.ContainsKey(seat)) return r;
            if (StrV(s, "phase", "discard") == "claim")
            {
                if (seat == IntV(s, "lastBy", 0)) return r;
                bool[] done = s.V["claims"] as bool[];
                if (done != null && seat < done.Length && done[seat]) return r;
                string tile = StrV(s, "lastDiscard", "");
                if (tile.Length == 0) return r;
                List<string> test = new List<string>(s.Hands[seat]); test.Add(tile);
                if (CanHu(test, Var(s), s)) r.Add("hu");
                if (CanGang(s, seat, tile)) r.Add("gang");
                if (CanPeng(s, seat, tile)) r.Add("peng");
                if (OptB(s, "allowChi", true) && seat == (IntV(s, "lastBy", 0) + 1) % s.Seats)
                {
                    string chi = CanChi(s, seat, tile);
                    if (chi.Length > 0) r.Add("chi:" + chi);
                }
                r.Add("pass");
                return r;
            }
            if (s.Turn != seat) return r;
            for (int i = 0; i < s.Hands[seat].Count; i++) r.Add("p:" + i);
            if (CanHu(s.Hands[seat], Var(s), s)) r.Add("hu");
            return r;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = Convert.ToString(d["code"]);
            if (action == "hu")
            {
                List<string> h = s.Hands[seat];
                if (StrV(s, "phase", "discard") == "claim")
                {
                    h = new List<string>(s.Hands[seat]); h.Add(StrV(s, "lastDiscard", ""));
                    if (!CanHu(h, Var(s), s)) return MoveResult.Fail("这张牌不能胡");
                    s.V["pointBy"] = IntV(s, "lastBy", 0);
                    s.V["fan"] = Fan(h, s);
                    Finish(s, seat, "点炮胡 · " + Var(s) + " · " + IntV(s, "fan", 1) + " 番");
                    return MoveResult.Good();
                }
                if (!CanHu(h, Var(s), s)) return MoveResult.Fail("未成胡牌");
                s.V["fan"] = Fan(h, s);
                Finish(s, seat, "自摸 · " + Var(s) + " · " + IntV(s, "fan", 1) + " 番");
                return MoveResult.Good();
            }
            if (StrV(s, "phase", "discard") == "claim")
            {
                if (seat == IntV(s, "lastBy", 0)) return MoveResult.Fail("等其他人响应");
                if (!Legal(s, seat).Contains(code)) return MoveResult.Fail("现在不能这么应");
                bool[] done = s.V["claims"] as bool[];
                string[] want = s.V["claimWanted"] as string[];
                done[seat] = true;
                if (code != "pass") want[seat] = code;
                bool all = true;
                for (int i = 0; i < s.Seats; i++)
                {
                    if (i == IntV(s, "lastBy", 0)) continue;
                    if (!done[i]) { all = false; break; }
                }
                if (all) ResolveClaims(s);
                else
                {

                    for (int k = 1; k <= s.Seats; k++)
                    {
                        int nx = (seat + k) % s.Seats;
                        if (nx != IntV(s, "lastBy", 0) && !done[nx]) { s.Turn = nx; break; }
                    }
                }
                return MoveResult.Good(code == "pass" ? "" : "已声明");
            }
            if (action != "p") return MoveResult.Fail("未知动作");
            if (!Legal(s, seat).Contains(code)) return MoveResult.Fail("非法打牌");
            int idx = Cfg.I(Cfg.Rest(code));
            string tile = s.Hands[seat][idx];
            s.Hands[seat].RemoveAt(idx);
            List<string> disc = new List<string>((string[])s.V["discards"]); disc.Add(tile);
            s.V["discards"] = disc.ToArray();
            s.V["lastDiscard"] = tile; s.V["lastBy"] = seat;
            s.V["phase"] = "claim";
            s.V["_phase"] = "claim";
            s.V["claims"] = new bool[s.Seats];
            s.V["claimWanted"] = new string[s.Seats];
            ((bool[])s.V["claims"])[seat] = true;
            s.Last = code;

            int canAny = 0;
            for (int i = 0; i < s.Seats; i++) if (i != seat && Legal(s, i).Count > 1) canAny++;
            if (canAny == 0) ResolveClaims(s);
            else
            {
                for (int k = 1; k <= s.Seats; k++)
                {
                    int nx = (seat + k) % s.Seats;
                    if (Legal(s, nx).Count > 0) { s.Turn = nx; break; }
                }
            }
            return MoveResult.Good();
        }
        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            d["discards"] = (string[])s.V["discards"];
            d["wallLeft"] = ((string[])s.V["wall"]).Length;
            d["meld"] = (int[])s.V["meld"];
            d["claimPhase"] = StrV(s, "phase", "discard") == "claim";
            d["lastDiscard"] = StrV(s, "lastDiscard", "");
            d["fan"] = IntV(s, "fan", 0);
            return d;
        }
    }

}
