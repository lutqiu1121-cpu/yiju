using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Qipai
{

    public sealed class TrickGame : RuleBase
    {
        private readonly string _id;
        public TrickGame(string id) { _id = id; }
        public override string Id { get { return _id; } }
        public override string Renderer { get { return "table"; } }
        public override int MinSeats { get { return _id == "doudizhu2" ? 2 : _id == "doudizhu" || _id == "laizi" || _id == "paodekuai" ? 3 : 4; } }
        public override int MaxSeats { get { return MinSeats; } }
        public override string[] Variants
        {
            get
            {
                if (_id == "doudizhu") return new string[] { "经典", "明牌" };
                if (_id == "doudizhu2") return new string[] { "二人" };
                if (_id == "laizi") return new string[] { "单癞", "双癞" };
                if (_id == "guandan") return new string[] { "经典" };
                if (_id == "shengji") return new string[] { "双升", "炒地皮" };
                if (_id == "paodekuai") return new string[] { "经典" };
                if (_id == "gongzhu") return new string[] { "经典" };
                return new string[] { "经典" };
            }
        }
        private bool IsLandlordGame() { return _id == "doudizhu" || _id == "doudizhu2" || _id == "laizi"; }
        private bool TeamGame() { return _id == "guandan" || _id == "shengji" || _id == "hongshi"; }
        private int Decks() { return O("decks", _id == "guandan" || _id == "shengji" ? 2 : 1); }

        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Width = 0; s.Height = 0; s.Cells = new string[0];
            List<string> deck = Cards.Deck(Decks(), _id != "paodekuai" && _id != "gongzhu" && _id != "hongshi" && _id != "shengji");
            Shuffle(s, deck);
            for (int i = 0; i < seats; i++) s.Hands[i] = new List<string>();
            s.V["last"] = new string[0];
            s.V["lastBy"] = -1;
            s.V["passes"] = 0;
            s.V["mult"] = 1;
            s.V["bids"] = new int[seats];
            s.V["bidTurn"] = 0;
            s.V["landlord"] = -1;
            s.V["bottom"] = new string[0];
            s.V["trick"] = new string[0];
            s.V["trickBy"] = -1;
            s.V["team"] = new int[seats];
            s.V["level"] = 2;
            s.V["trump"] = "H2";
            s.V["score"] = new int[seats];
            s.V["pot"] = 0;
            s.V["phase"] = IsLandlordGame() ? "bid" : "play";
            if (IsLandlordGame()) s.PhaseName = "叫抢帅方"; else s.PhaseName = "出牌";

            int per = 17, bottom = 3;
            if (_id == "doudizhu2")
            {

                deck = deck.Where(c => Cards.Rank(c) != "3" && Cards.Rank(c) != "4").ToList();
                per = 20; bottom = deck.Count - per * seats;
            }
            else if (_id == "paodekuai") { per = 17; bottom = deck.Count - per * seats; }
            else if (TeamGame() || _id == "gongzhu" || _id == "hongshi") { per = deck.Count / seats; bottom = 0; }
            for (int k = 0; k < per; k++)
                for (int i = 0; i < seats; i++)
                    if (deck.Count > 0) { s.Hands[i].Add(deck[0]); deck.RemoveAt(0); }
            for (int i = 0; i < seats; i++) Cards.SortHand(s.Hands[i]);
            List<string> bot = new List<string>();
            for (int k = 0; k < bottom && deck.Count > 0; k++) { bot.Add(deck[0]); deck.RemoveAt(0); }
            s.V["bottom"] = bot.ToArray();
            s.V["rest"] = deck.ToArray();
            if (_id == "laizi" && bot.Count > 0) s.V["wild"] = Cards.Rank(bot[0]);
            else s.V["wild"] = "";
            if (variant == "双癞" && bot.Count > 1) s.V["wild2"] = Cards.Rank(bot[1]);
            else s.V["wild2"] = "";
            if (variant == "明牌") s.V["mult"] = 2;
            if (_id == "shengji") s.V["phase"] = "bid";
            if (_id == "hongshi")
            {
                for (int i = 0; i < seats; i++)
                    if (s.Hands[i].Contains("H10") || s.Hands[i].Contains("D10"))
                        s.V["team"] = MarkTeam(s, i, seats);
            }
            if (_id == "guandan" || _id == "shengji")
            {
                int[] t = new int[seats]; t[0] = 0; t[1] = 1; t[2] = 0; t[3] = 1;
                s.V["team"] = t;
            }
            return s;
        }
        private static int[] MarkTeam(GameState s, int seat, int n)
        {
            int[] t = new int[n];
            for (int i = 0; i < t.Length; i++) t[i] = 1;
            t[seat] = 0; t[(seat + 2) % n] = 0;
            return t;
        }
        private string Wild(GameState s) { return StrV(s, "wild", ""); }
        private string[] Last(GameState s) { return s.V.ContainsKey("last") ? (string[])s.V["last"] : new string[0]; }
        private bool Bidding(GameState s) { return StrV(s, "phase", "play") == "bid"; }
        private bool IsTrump(string c, GameState s)
        {
            if (_id != "shengji") return false;
            string t = StrV(s, "trump", "H2");
            return Cards.Rank(c) == Cards.Rank(t) || Cards.Suit(c) == Cards.Suit(t) || Cards.IsJoker(c);
        }

        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat) return r;
            if (Bidding(s))
            {
                if (_id == "shengji") { r.Add("bid:0"); r.Add("bid:1"); return r; }
                int mx = MaxBid(s);
                for (int b = mx + 1; b <= 3; b++) r.Add("bid:" + b);
                r.Add("bid:0");
                return r;
            }
            r.Add("p:*");
            if (IntV(s, "lastBy", -1) != seat && Last(s).Length > 0) r.Add("pass");
            return r;
        }
        private int MaxBid(GameState s)
        {
            int[] b = s.V.ContainsKey("bids") ? (int[])s.V["bids"] : new int[0];
            int m = 0; for (int i = 0; i < b.Length; i++) if (b[i] > m) m = b[i];
            return m;
        }

        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            string code = Convert.ToString(d["code"]);
            if (Bidding(s))
            {
                int b = Cfg.I(Cfg.Rest(code));
                if (action != "bid" || b < 0 || b > 3) return MoveResult.Fail("叫分不合法");
                if (b > 0 && b <= MaxBid(s)) return MoveResult.Fail("叫分必须高于当前");
                int[] bids = (int[])s.V["bids"]; bids[seat] = b; s.V["bids"] = bids;
                Say(s, "座位 " + seat + " 叫 " + (b == 0 ? "不叫" : b + " 分"));
                if (_id == "shengji")
                {
                    if (b > 0) { s.V["trump"] = s.Hands[seat][0]; s.V["phase"] = "play"; s.PhaseName = "出牌"; s.V["mult"] = 2; }
                    Next(s, -1); return MoveResult.Good();
                }
                int bt = IntV(s, "bidTurn", 0) + 1; s.V["bidTurn"] = bt;
                if (bt >= s.Seats || b == 3)
                {
                    int lord = -1, mx = 0;
                    for (int i = 0; i < bids.Length; i++) if (bids[i] > mx) { mx = bids[i]; lord = i; }
                    if (lord < 0) lord = NextRng(s, s.Seats);
                    s.V["landlord"] = lord;
                    string[] bot = (string[])s.V["bottom"];
                    for (int i = 0; i < bot.Length; i++) s.Hands[lord].Add(bot[i]);
                    Cards.SortHand(s.Hands[lord]);
                    s.V["bottom"] = new string[0];
                    s.V["phase"] = "play"; s.PhaseName = "出牌";
                    s.Turn = lord;
                    Say(s, "座位 " + lord + " 成为帅方，底牌已收");
                    return MoveResult.Good();
                }
                Next(s, -1); return MoveResult.Good();
            }
            if (action == "pass")
            {
                if (IntV(s, "lastBy", -1) == seat || Last(s).Length == 0) return MoveResult.Fail("你先出牌，不能不出");
                s.V["passes"] = IntV(s, "passes", 0) + 1;
                if (IntV(s, "passes", 0) >= s.Seats - 1)
                {
                    int owner = IntV(s, "lastBy", 0);
                    s.V["last"] = new string[0]; s.V["lastBy"] = -1; s.V["passes"] = 0;
                    s.Turn = owner;
                    Say(s, "一轮无人应，座位 " + owner + " 重新领出");
                }
                else Next(s, -1);
                return MoveResult.Good();
            }
            if (action != "p") return MoveResult.Fail("未知动作");
            List<int> idx = ParseList(Cfg.Rest(code));
            if (idx.Count == 0) return MoveResult.Fail("请先选牌");
            List<string> chosen = Cards.Take(s, s.Hands, seat, idx);
            if (chosen == null) return MoveResult.Fail("手牌索引无效");
            string[] prev = Last(s);
            int[] t = Cards.Type(chosen, Wild(s));
            if (t[0] < 0) { PutBack(s, seat, chosen); return MoveResult.Fail("不构成合法牌型"); }
            if (prev.Length > 0 && IntV(s, "lastBy", -1) != seat)
            {
                int[] pt = Cards.Type(prev.ToList(), Wild(s));
                if (!Cards.Beats(t, pt)) { PutBack(s, seat, chosen); return MoveResult.Fail("压不过上一手"); }
                if (_id == "shengji" && IsTrump(prev[0], s) != IsTrump(chosen[0], s))
                { PutBack(s, seat, chosen); return MoveResult.Fail("须跟主 / 副牌花色"); }
            }
            if (IsLandlordGame() && seat != IntV(s, "landlord", -1))
                s.V["farmerPlayed"] = IntV(s, "farmerPlayed", 0) + 1;
            s.V["last"] = chosen.ToArray(); s.V["lastBy"] = seat;
            s.V["passes"] = 0; s.Last = code;
            if (t[0] == 10 || t[0] == 11) s.V["mult"] = IntV(s, "mult", 1) * 2;
            if (_id == "gongzhu") CollectTrick(s, seat, chosen);
            Say(s, "座位 " + seat + " 出 " + string.Join(" ", chosen.Select(Cards.Label).ToArray()));
            if (s.Hands[seat].Count == 0) { Settle(s, seat); return MoveResult.Good(); }
            Next(s, -1); return MoveResult.Good();
        }
        private static void PutBack(GameState s, int seat, List<string> cards)
        {
            for (int i = 0; i < cards.Count; i++) s.Hands[seat].Add(cards[i]);
            Cards.SortHand(s.Hands[seat]);
        }
        private void CollectTrick(GameState s, int seat, List<string> cards)
        {
            int pts = 0; bool transformer = false;
            for (int i = 0; i < cards.Count; i++)
            {
                string c = cards[i];
                if (c == "SQ") pts -= 100;
                if (c == "DJ") pts += 100;
                if (Cards.Suit(c) == "H") pts += 1;
                if (c == "C10") transformer = true;
            }
            if (transformer) pts *= 2;
            int[] sc = (int[])s.V["score"]; sc[seat] += pts; s.V["score"] = sc;
        }
        private void Settle(GameState s, int winner)
        {
            int mult = IntV(s, "mult", 1);
            if (IsLandlordGame())
            {
                int lord = IntV(s, "landlord", -1);
                bool lordWin = winner == lord;

            bool spring = lordWin && IntV(s, "farmerPlayed", 0) == 0 && OptB(s, "spring", true);
            if (spring) mult *= 2;
            int baseScore = OptI(s, "baseScore", 1);
            mult *= Math.Max(1, baseScore);
                string txt = (lordWin ? "帅方胜" : "群客胜") + " ×" + mult + (spring ? "（春天）" : "");
                int[] sc = (int[])s.V["score"];
                for (int i = 0; i < sc.Length; i++) sc[i] = (i == lord ? lordWin : !lordWin) ? 3 * mult : -3 * mult;
                s.V["score"] = sc;
                if (lordWin) Finish(s, lord, txt);
                else
                {
                    List<int> farmers = new List<int>();
                    for (int i = 0; i < s.Seats; i++) if (i != lord) farmers.Add(i);
                    FinishTeam(s, farmers, txt);
                }
                return;
            }
            if (_id == "paodekuai")
            {
                int[] sc = (int[])s.V["score"];
                for (int i = 0; i < sc.Length; i++) sc[i] = -s.Hands[i].Count;
                sc[winner] = 0; s.V["score"] = sc;
                Finish(s, winner, "先出完，胜；其余按剩牌计分"); return;
            }
            if (_id == "gongzhu")
            {

                int[] sc = (int[])s.V["score"];
                int best = 0; for (int i = 1; i < sc.Length; i++) if (sc[i] < sc[best]) best = i;
                Finish(s, best, "拱猪计分，负分最多（吃进分最少）者胜"); return;
            }
            if (TeamGame())
            {
                int[] team = (int[])s.V["team"];
                int winTeam = team[winner];
                s.V["level"] = IntV(s, "level", 2) + 1;
                List<int> mates = new List<int>();
                for (int i = 0; i < team.Length; i++) if (team[i] == winTeam) mates.Add(i);
                FinishTeam(s, mates, "队伍 " + (winTeam == 0 ? "一" : "二") + " 胜，升级到 " + IntV(s, "level", 3)); return;
            }
            Finish(s, winner, "先出完，胜");
        }

        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            d["lastCards"] = Last(s);
            d["lastBy"] = IntV(s, "lastBy", -1);
            d["landlord"] = IntV(s, "landlord", -1);
            d["mult"] = IntV(s, "mult", 1);
            d["wild"] = Wild(s);
            d["bottom"] = Bidding(s) ? new string[0] : (string[])s.V["bottom"];
            d["team"] = (int[])s.V["team"];
            d["level"] = IntV(s, "level", 2);
            d["trump"] = StrV(s, "trump", "H2");
            d["bidPhase"] = Bidding(s);
            d["suggest"] = Suggest(s, seat);
            return d;
        }

        private string Suggest(GameState s, int seat)
        {
            if (!s.Hands.ContainsKey(seat) || s.Turn != seat) return "";
            List<string> h = s.Hands[seat];
            string[] prev = Last(s);
            if (prev.Length == 0 || IntV(s, "lastBy", -1) == seat)
                return h.Count > 0 ? "p:" + (h.Count - 1) : "";
            int[] pt = Cards.Type(prev.ToList(), Wild(s));
            for (int i = h.Count - 1; i >= 0; i--)
            {
                List<int> cand = new List<int>();
                if (pt[0] == 0)
                {
                    cand.Add(i);
                    if (i > 0 && Cards.Val(h[i]) == Cards.Val(h[i - 1])) cand.Add(i - 1);
                }
                else if (pt[0] == 1 && i > 0 && Cards.Val(h[i]) == Cards.Val(h[i - 1])) { cand.Add(i); cand.Add(i - 1); }
                else if (pt[0] == 10 || pt[0] == 11)
                {
                    for (int k = 0; k < h.Count; k++) if (Cards.Val(h[k]) == Cards.Val(h[i])) cand.Add(k);
                }
                if (cand.Count == 0) continue;
                List<string> pick = new List<string>();
                for (int k = 0; k < cand.Count; k++) pick.Add(h[cand[k]]);
                int[] t = Cards.Type(pick, Wild(s));
                if (Cards.Beats(t, pt)) return "p:" + JoinInts(cand);
            }

            for (int i = 0; i < h.Count; i++)
            {
                List<int> bomb = new List<int>();
                for (int k = 0; k < h.Count; k++) if (Cards.Val(h[k]) == Cards.Val(h[i])) bomb.Add(k);
                if (bomb.Count == 4) return "p:" + JoinInts(bomb);
            }
            if (h.Count > 1 && Cards.IsJoker(h[0]) && Cards.IsJoker(h[1])) return "p:0,1";
            return "";
        }
    }

    public sealed class ShowdownGame : RuleBase
    {
        private readonly string _id;
        public ShowdownGame(string id) { _id = id; }
        public override string Id { get { return _id; } }
        public override string Renderer { get { return "table"; } }
        public override int MinSeats { get { return 2; } }
        public override int MaxSeats { get { return _id == "texas" ? 9 : _id == "shisanszhang" ? 4 : 6; } }
        public override string[] Variants
        {
            get
            {
                if (_id == "texas") return new string[] { "常规", "快桌" };
                return new string[] { "经典" };
            }
        }
        private int HoleCount() { return _id == "texas" ? 2 : _id == "zhajinhua" || _id == "sangong" ? 3 : _id == "shisanszhang" ? 13 : 5; }
        protected override GameState Build(string variant, int seats, int seed, string room)
        {
            GameState s = new GameState();
            s.Cells = new string[0]; s.Width = 0; s.Height = 0;
            List<string> deck = Cards.Deck(1, false); Shuffle(s, deck);
            for (int i = 0; i < seats; i++) s.Hands[i] = new List<string>();
            for (int k = 0; k < HoleCount(); k++)
                for (int i = 0; i < seats; i++)
                    if (deck.Count > 0) { s.Hands[i].Add(deck[0]); deck.RemoveAt(0); }
            for (int i = 0; i < seats; i++) Cards.SortHand(s.Hands[i]);
            s.V["board"] = new string[0];
            s.V["rest"] = deck.ToArray();
            s.V["chips"] = Enumerable.Repeat(O("startChips", 200), seats).ToArray();
            s.V["pot"] = _id == "texas" ? 3 : 0;
            s.V["bets"] = new int[seats];
            s.V["folded"] = new bool[seats];
            s.V["contrib"] = new int[seats];
            s.V["allin"] = new bool[seats];
            s.V["round"] = 0;
            s.V["acted"] = new bool[seats];
            s.V["stage"] = "bet";
            s.V["_phase"] = "bid";
            s.PhaseName = "落帖";
            if (_id == "texas")
            {
                int sb = Math.Max(1, O("smallBlind", 1));
                int[] chips = (int[])s.V["chips"]; chips[0] -= sb; chips[1 % seats] -= 2 * sb; s.V["chips"] = chips;
                int[] bets = (int[])s.V["bets"]; bets[0] = sb; bets[1 % seats] = 2 * sb; s.V["bets"] = bets;
                int[] ctr = (int[])s.V["contrib"]; ctr[0] = sb; ctr[1 % seats] = 2 * sb; s.V["contrib"] = ctr;
                s.V["pot"] = 3 * sb;
                s.Turn = seats > 2 ? 2 : 0;
            }
            return s;
        }
        public override List<string> Legal(GameState s, int seat)
        {
            List<string> r = new List<string>();
            if (s.Ended || s.Turn != seat || BoolAt(s, "folded", seat)) return r;
            if (StrV(s, "stage", "bet") == "bet")
            {
                r.Add("b:call"); r.Add("b:raise"); r.Add("b:fold"); r.Add("b:check");
                if (_id == "shisanszhang")
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
        private static bool BoolAt(GameState s, string k, int i)
        {
            bool[] a = s.V.ContainsKey(k) ? (bool[])s.V[k] : new bool[0];
            return i < a.Length && a[i];
        }
        private void SetActed(GameState s, int seat)
        {
            bool[] a = (bool[])s.V["acted"]; a[seat] = true; s.V["acted"] = a;
        }
        private bool AllActed(GameState s)
        {
            bool[] a = (bool[])s.V["acted"];
            for (int i = 0; i < s.Seats; i++) if (!BoolAt(s, "folded", i) && (i >= a.Length || !a[i])) return false;
            return true;
        }
        public override MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d)
        {
            if (action != "b" && action != "arrange") return MoveResult.Fail("未知动作");
            string what = Cfg.Rest(Convert.ToString(d["code"]));
            int[] chips = (int[])s.V["chips"], bets = (int[])s.V["bets"];
            bool[] folded = (bool[])s.V["folded"];
            if (action == "arrange")
            {
                string arg = Cfg.Rest(Convert.ToString(d["code"]));
                if (arg == "auto")
                {

                    List<string> sorted = new List<string>(s.Hands[seat]);
                    sorted.Sort(delegate (string a, string b) { return Cards.Val(a).CompareTo(Cards.Val(b)); });
                    s.Hands[seat] = sorted;
                    Say(s, "座位 " + seat + " 自动摆好了三道");
                    return MoveResult.Good("摆牌完成");
                }
                if (arg.StartsWith("swap:"))
                {
                    string[] ij = arg.Substring(5).Split(',');
                    int a, b;
                    if (ij.Length < 2 || !int.TryParse(ij[0], out a) || !int.TryParse(ij[1], out b) ||
                        a < 0 || b < 0 || a >= s.Hands[seat].Count || b >= s.Hands[seat].Count)
                        return MoveResult.Fail("选两张手牌来交换");
                    string t = s.Hands[seat][a]; s.Hands[seat][a] = s.Hands[seat][b]; s.Hands[seat][b] = t;
                    return MoveResult.Good("已交换");
                }
                List<int> order = ParseList(arg);
                if (order.Count != s.Hands[seat].Count) return MoveResult.Fail("要重排全部 13 张");
                bool[] used = new bool[order.Count];
                for (int i = 0; i < order.Count; i++)
                {
                    if (order[i] < 0 || order[i] >= used.Length || used[order[i]]) return MoveResult.Fail("摆牌序号重复或越界");
                    used[order[i]] = true;
                }
                List<string> nh = new List<string>();
                for (int i = 0; i < order.Count; i++) nh.Add(s.Hands[seat][order[i]]);
                s.Hands[seat] = nh;
                Say(s, "座位 " + seat + " 重新摆好了三道");
                return MoveResult.Good("摆牌完成");
            }
            if (what == "ready")
            {
                if (_id != "shisanszhang") return MoveResult.Fail("这个玩法不用确认摆牌");
                string bad = CheckDao(s, seat);
            if (bad.Length > 0 && OptB(s, "daoCheck", true))
            { Say(s, "座位 " + seat + " 倒道：" + bad + "，本局按最小牌力计"); s.V["daoBad" + seat] = true; }
                SetActed(s, seat);
                if (AllActed(s)) { EnterShow(s); return MoveResult.Good(); }
                Next(s, -1); return MoveResult.Good();
            }
            if (what == "show")
            {
                SetActed(s, seat);
                if (AllActed(s)) { Showdown(s); return MoveResult.Good(); }
                Next(s, -1); return MoveResult.Good();
            }
            if (what == "fold")
            {
                folded[seat] = true; s.V["folded"] = folded; SetActed(s, seat);
                Say(s, "座位 " + seat + " 敛牌");
                int alive = 0, last = 0;
                for (int i = 0; i < s.Seats; i++) if (!folded[i]) { alive++; last = i; }
                if (alive <= 1) { WinPot(s, last); return MoveResult.Good(); }
                Advance(s); return MoveResult.Good();
            }
            int mx = 0; for (int i = 0; i < bets.Length; i++) if (bets[i] > mx) mx = bets[i];
            int pay = 0;
            if (what == "call") pay = Math.Min(chips[seat], Math.Max(0, mx - bets[seat]));
            else if (what == "raise") pay = Math.Min(chips[seat], mx - bets[seat] + 10);
            else if (what == "check") pay = 0;
            else return MoveResult.Fail("未知落帖动作");
            if (what == "check" && mx > bets[seat]) return MoveResult.Fail("有注须跟，不能过牌");
            if (pay > chips[seat]) pay = chips[seat];
            chips[seat] -= pay; bets[seat] += pay; s.V["chips"] = chips; s.V["bets"] = bets;
            s.V["pot"] = IntV(s, "pot", 0) + pay;
            int[] ctr = s.V.ContainsKey("contrib") ? (int[])s.V["contrib"] : new int[s.Seats];
            ctr[seat] += pay; s.V["contrib"] = ctr;
            bool[] ai = s.V.ContainsKey("allin") ? (bool[])s.V["allin"] : new bool[s.Seats];
            if (chips[seat] <= 0 && !folded[seat]) { ai[seat] = true; Say(s, "座位 " + seat + " 分尽"); }
            s.V["allin"] = ai;
            SetActed(s, seat);
            Say(s, "座位 " + seat + " " + (what == "raise" ? "加帖" : what == "call" ? "随帖" : "过牌") + " " + pay);
            if (!AllActed(s)) { Next(s, -1); return MoveResult.Good(); }
            if (_id == "shisanszhang") { EnterShow(s); return MoveResult.Good(); }
            if (_id == "texas" && IntV(s, "round", 0) < 3)
            {
                int rnd = IntV(s, "round", 0) + 1; s.V["round"] = rnd;
                List<string> rest = new List<string>((string[])s.V["rest"]);
                List<string> board = new List<string>((string[])s.V["board"]);
                int n = rnd == 1 ? 3 : 1;
                for (int k = 0; k < n && rest.Count > 0; k++) { board.Add(rest[0]); rest.RemoveAt(0); }
                s.V["board"] = board.ToArray(); s.V["rest"] = rest.ToArray();
                s.V["bets"] = new int[s.Seats];
                s.V["acted"] = new bool[s.Seats];
                Say(s, rnd == 1 ? "翻牌 " + string.Join(" ", board.Select(Cards.Label).ToArray()) : "发出第 " + (rnd + 2) + " 张公共牌");
                Next(s, -1); return MoveResult.Good();
            }
            EnterShow(s); return MoveResult.Good();
        }
        private void EnterShow(GameState s)
        {
            s.V["stage"] = "show";
            s.V["acted"] = new bool[s.Seats];
            for (int i = 0; i < s.Seats; i++) if (BoolAt(s, "folded", i)) ((bool[])s.V["acted"])[i] = true;
            for (int i = 0; i < s.Seats; i++) if (!BoolAt(s, "folded", i)) { s.Turn = i; break; }
            s.PhaseName = "摊牌确认";
            Say(s, "都确认后一起亮牌");
        }
        private string CheckDao(GameState s, int seat)
        {
            List<string> h = s.Hands[seat];
            if (h.Count < 13) return "";
            int[] a = TexasRank(h.Skip(8).Take(5).ToList());
            int[] b = TexasRank(h.Skip(3).Take(5).ToList());
            int[] c = TexasRank(h.Take(3).ToList());
            if (Compare(c, b) > 0 || Compare(b, a) > 0) return "头道不能强过中道，中道不能强过尾道";
            return "";
        }
        private void Advance(GameState s)
        {
            if (AllActed(s)) { EnterShow(s); return; }
            Next(s, -1);
            int guard = 0;
            while (BoolAt(s, "folded", s.Turn) && guard++ < s.Seats) Next(s, -1);
        }

        private int[] Strength(GameState s, int seat)
        {
            List<string> h = new List<string>(s.Hands[seat]);
            string[] board = (string[])s.V["board"];
            if (_id == "texas") h.AddRange(board);
            if (_id == "zhajinhua") return Zjh(h);
            if (_id == "niuniu") return Niu(h);
            if (_id == "sangong") return Sangong(h);
            if (_id == "shisanszhang") return Shisan(h);
            return TexasRank(h);
        }
        private static Dictionary<int, int> Counts(List<string> h)
        {
            Dictionary<int, int> d = new Dictionary<int, int>();
            for (int i = 0; i < h.Count; i++) { int v = Cards.Val(h[i]); if (!d.ContainsKey(v)) d[v] = 0; d[v]++; }
            return d;
        }

        private static int TVal(string c)
        {
            string r = Cards.Rank(c);
            if (r == "A") return 14;
            if (r == "K") return 13;
            if (r == "Q") return 12;
            if (r == "J") return 11;
            if (r == "2") return 2;
            int n; return int.TryParse(r, out n) ? n : 0;
        }
        private static int[] TexasRank(List<string> h)
        {
            List<int> v = h.Select(TVal).ToList(); v.Sort(); v.Reverse();
            Dictionary<int, int> c = new Dictionary<int, int>();
            for (int i = 0; i < h.Count; i++) { int x = TVal(h[i]); if (!c.ContainsKey(x)) c[x] = 0; c[x]++; }
            int[] groups = c.Values.OrderByDescending(x => x).ToArray();

            bool flush = false;
            foreach (string suit in Cards.SUITS)
                if (h.Count(x => Cards.Suit(x) == suit) >= 5) { flush = true; break; }
            List<int> uniq = c.Keys.OrderByDescending(x => x).ToList();
            if (uniq.Contains(14)) uniq.Add(1);
            uniq = uniq.Distinct().OrderByDescending(x => x).ToList();
            int straightHigh = 0;
            for (int k = 0; k + 4 < uniq.Count; k++)
                if (uniq[k] - uniq[k + 4] == 4) { straightHigh = uniq[k]; break; }
            int type = 0, tie = uniq.Count > 0 ? uniq[0] : 0;
            if (straightHigh > 0 && flush) { type = 8; tie = straightHigh; }
            else if (groups.Length > 0 && groups[0] == 4) { type = 7; tie = KeyOf(c, 4); }
            else if (groups.Length > 1 && groups[0] == 3 && groups[1] >= 2) { type = 6; tie = KeyOf(c, 3); }
            else if (flush) { type = 5; tie = 0; }
            else if (straightHigh > 0) { type = 4; tie = straightHigh; }
            else if (groups.Length > 0 && groups[0] == 3) { type = 3; tie = KeyOf(c, 3); }
            else if (groups.Length > 1 && groups[0] == 2 && groups[1] == 2) { type = 2; tie = Math.Max(KeyOf(c, 2), uniq.Count > 1 ? uniq[1] : 0); }
            else if (groups.Length > 0 && groups[0] == 2) { type = 1; tie = KeyOf(c, 2); }

            List<int> ret = new List<int> { type, tie };
            if (type == 5 || type == 0 || type == 8 || type == 4)
            {
                HashSet<int> used = new HashSet<int>();
                if (straightHigh > 0) for (int k = 0; k < 5; k++) used.Add(straightHigh - k == 0 ? 14 : straightHigh - k);
                int take = 0;
                for (int i = 0; i < v.Count && take < 5; i++)
                {
                    if (used.Contains(v[i])) continue;
                    ret.Add(v[i]); take++;
                }
            }
            else for (int i = 0; i < v.Count && i < 5; i++) ret.Add(v[i]);
            while (ret.Count < 7) ret.Add(0);
            return ret.ToArray();
        }
        private static int KeyOf(Dictionary<int, int> c, int n)
        {
            int best = 0;
            foreach (KeyValuePair<int, int> kv in c) if (kv.Value == n && kv.Key > best) best = kv.Key;
            return best;
        }
        private static int[] Zjh(List<string> h)
        {
            List<int> v = h.Select(Cards.Val).ToList(); v.Sort(); v.Reverse();
            bool flush = h.Select(Cards.Suit).Distinct().Count() == 1;
            bool seq = (v[0] - v[1] == 1 && v[1] - v[2] == 1);
            int type = v[0] == v[1] && v[1] == v[2] ? 5 : flush && seq ? 4 : flush ? 3 : seq ? 2 : v[0] == v[1] || v[1] == v[2] ? 1 : 0;
            return new int[] { type, v[0], v[1], v[2] };
        }
        private static int[] Niu(List<string> h)
        {
            List<int> v = h.Select(x => Math.Min(10, Cards.Val(x))).ToList();
            int best = 0;
            for (int i = 0; i < 5; i++) for (int j = i + 1; j < 5; j++) for (int k = j + 1; k < 5; k++)
                if ((v[i] + v[j] + v[k]) % 10 == 0)
                {
                    int rest = 0;
                    for (int m = 0; m < 5; m++) if (m != i && m != j && m != k) rest += v[m];
                    int niu = rest % 10 == 0 ? 10 : rest % 10;
                    if (niu > best) best = niu;
                }
            return new int[] { best, h.Max(Cards.Val) };
        }
        private static int[] Sangong(List<string> h)
        {
            int gong = 0;
            for (int i = 0; i < h.Count; i++) if ("JQK".IndexOf(Cards.Rank(h[i])) >= 0) gong++;
            int pts = h.Sum(x => "JQK".IndexOf(Cards.Rank(x)) >= 0 ? 0 : Math.Min(10, Cards.Val(x))) % 10;
            return new int[] { gong, pts, gong == 3 ? 1 : 0 };
        }
        private static int[] Shisan(List<string> h)
        {

            List<string> a = h.Take(3).ToList(), b = h.Skip(3).Take(5).ToList(), c = h.Skip(8).Take(5).ToList();
            return new int[] { TexasRank(c)[0] * 100 + TexasRank(b)[0] * 10 + TexasRank(a)[0], TexasRank(c)[1], TexasRank(b)[1] };
        }
        private void Showdown(GameState s)
        {
            int best = -1; int[] bestV = null;
            for (int i = 0; i < s.Seats; i++)
            {
                if (BoolAt(s, "folded", i)) continue;
                int[] v = Strength(s, i);
                if (s.V.ContainsKey("daoBad" + i) && Convert.ToBoolean(s.V["daoBad" + i]))
                { v = new int[] { -1 }; Say(s, "座位 " + i + " 倒道，本局不计最高牌力"); }
                if (bestV == null || Compare(v, bestV) > 0) { best = i; bestV = v; }
            }
            if (best < 0) { for (int i = 0; i < s.Seats; i++) if (!BoolAt(s, "folded", i)) best = i; }
            WinPot(s, best);
        }
        private static int Compare(int[] a, int[] b)
        {
            int n = Math.Max(a.Length, b.Length);
            for (int i = 0; i < n; i++) { int x = i < a.Length ? a[i] : 0, y = i < b.Length ? b[i] : 0; if (x != y) return x.CompareTo(y); }
            return 0;
        }
        private void WinPot(GameState s, int winner)
        {
            int[] chips = (int[])s.V["chips"];
            int pot = IntV(s, "pot", 0);
            s.V["_pots"] = new string[0];
            bool useSide = OptB(s, "sidePot", true) && s.V.ContainsKey("contrib") &&
                           s.V.ContainsKey("allin") && ((bool[])s.V["allin"]).Any(x => x);
            if (!useSide)
            {
                chips[winner] += pot; s.V["chips"] = chips;
                s.V["score"] = (int[])chips.Clone();
                Finish(s, winner, "摊牌，座位 " + winner + " 赢得共分 " + pot);
                return;
            }
            int[] contrib = (int[])s.V["contrib"];
            bool[] folded = (bool[])s.V["folded"];
            List<int> levels = contrib.Distinct().Where(x => x > 0).OrderBy(x => x).ToList();
            List<string> desc = new List<string>();
            int prev = 0, mainWinner = -1;
            foreach (int L in levels)
            {
                int layer = 0;
                for (int i = 0; i < s.Seats; i++)
                    layer += Math.Max(0, Math.Min(contrib[i], L) - Math.Min(contrib[i], prev));
                prev = L;
                if (layer <= 0) continue;
                List<int> elig = new List<int>();
                for (int i = 0; i < s.Seats; i++) if (!folded[i] && contrib[i] >= L) elig.Add(i);
                if (elig.Count == 0) continue;
                int best = elig[0]; int[] bv = Strength(s, best);
                List<int> ties = new List<int>();
                foreach (int i in elig)
                {
                    int[] v = Strength(s, i); int c = Compare(v, bv);
                    if (c > 0) { best = i; bv = v; ties.Clear(); ties.Add(i); }
                    else if (c == 0) ties.Add(i);
                }
                int share = layer / Math.Max(1, ties.Count);
                for (int k = 0; k < ties.Count; k++) chips[ties[k]] += share + (k == 0 ? layer - share * ties.Count : 0);
                if (mainWinner < 0) mainWinner = best;
                desc.Add("池 " + layer + " → 座位 " + string.Join(",", ties.Select(x => x.ToString()).ToArray()));
            }
            s.V["chips"] = chips; s.V["score"] = (int[])chips.Clone();
            s.V["_pots"] = desc.ToArray();
            if (mainWinner < 0) mainWinner = winner;
            Finish(s, mainWinner, "分层结算 · " + string.Join(" | ", desc.ToArray()));
        }
        protected override Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = base.Info(s, seat);
            d["boardCards"] = (string[])s.V["board"];
            d["chips"] = (int[])s.V["chips"];
            d["pot"] = IntV(s, "pot", 0);
            d["contrib"] = s.V.ContainsKey("contrib") ? s.V["contrib"] : new int[s.Seats];
            d["allin"] = s.V.ContainsKey("allin") ? s.V["allin"] : new bool[s.Seats];
            d["folded"] = (bool[])s.V["folded"];
            d["round"] = IntV(s, "round", 0);
            d["stage"] = StrV(s, "stage", "bet");
            return d;
        }
    }
}
