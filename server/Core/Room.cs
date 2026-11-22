using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Qipai
{
    public sealed class Seat
    {
        public int Pid = 0;
        public string Name = "";
        public string Token = "";
        public bool Ready = false;
        public bool Online = false;
        public long LastSeen = 0;
        public bool Bot = false;
        public bool Sealed = false;
    }

    public sealed class Room
    {
        public readonly string Id;
        public readonly string Game;
        public string Variant = "";
        public readonly int MaxSeats;
        public readonly long TurnLimitMs;
        public RoomOptions Opt;
        public readonly long[] Banks;
        public string ClockPhase = "";
        public long AutoStartAt = 0;
        public readonly Seat[] Seats;
        public readonly List<int> Spectators = new List<int>();
        public readonly List<Dictionary<string, object>> Chat = new List<Dictionary<string, object>>();
        public long ChatVersion = 0;

        public string Title = "";
        public string Password = "";
        public bool AllowSpectators = true;
        public int BotDelayMs = 900;
        public long BotNextAt = 0;
        public int BotLevel = 0;
        public bool BotByRank = false;
        public bool GodMode = false;
        public int GodTier = 1;
        public bool RankRecorded = false;
        public IGameRule Rule;
        public GameState S;
        public int Seq = 0;
        public bool Started = false;
        public int PresenceVersion = 1;
        public int UndoAsker = -1;
        public bool UndoDenied = false;
        public readonly HashSet<int> UndoYes = new HashSet<int>();
        public readonly HashSet<int> DrawYes = new HashSet<int>();
        public readonly long[] Clocks;
        public readonly List<GameState> Snapshots = new List<GameState>();
        public Dictionary<string, object> ReplayStart;
        public readonly List<object[]> ReplayFrames = new List<object[]>();
        private Dictionary<string, object> lastNeutral;
        private readonly Dictionary<int, Dictionary<string, object>> views = new Dictionary<int, Dictionary<string, object>>();
        private readonly Dictionary<int, int> lastPv = new Dictionary<int, int>();
        private readonly Hub hub;
        private readonly int seed;

        public Room(Hub hub, string id, string game, string variant, int maxSeats, long turnLimitMs, int seed)
            : this(hub, id, game, variant, maxSeats, turnLimitMs, seed, null) { }

        public Room(Hub hub, string id, string game, string variant, int maxSeats, long turnLimitMs, int seed, RoomOptions opt)
        {
            this.hub = hub;
            Opt = opt ?? new RoomOptions(game, "");
            BotDelayMs = (int)Opt.BotDelayMs;
            Id = id; Game = game; Variant = variant;
            MaxSeats = Math.Max(1, maxSeats);
            TurnLimitMs = turnLimitMs <= 0 ? 60000 : turnLimitMs;
            Seats = new Seat[MaxSeats];
            Clocks = new long[MaxSeats];
            Banks = new long[MaxSeats];
            for (int i = 0; i < MaxSeats; i++)
            { Seats[i] = new Seat(); Clocks[i] = TurnLimitMs; Banks[i] = Opt.BankMs; }
            Rule = RuleRegistry.Get(game) ?? RuleRegistry.Fallback;
            this.seed = seed;
        }

        public int SeatCount()
        {
            int n = 0;
            for (int i = 0; i < Seats.Length; i++) if (Seats[i].Pid != 0) n++;
            return n;
        }
        public int AddSeat(Player p, int preferred)
        {

            if (Started) return -1;
            if (preferred >= 0 && preferred < Seats.Length && Seats[preferred].Pid == 0) return Fill(preferred, p);
            for (int i = 0; i < Seats.Length; i++) if (Seats[i].Pid == 0) return Fill(i, p);

            for (int i = Seats.Length - 1; i >= 0; i--)
                if (Seats[i].Bot) { Leave(i); return Fill(i, p); }
            return -1;
        }
        public int BotCount()
        {
            int n = 0;
            for (int i = 0; i < Seats.Length; i++) if (Seats[i].Bot) n++;
            return n;
        }

        public int AddBots(int n)
        {
            if (Started || n <= 0) return 0;
            int done = 0;
            for (int i = 0; i < Seats.Length && done < n; i++)
            {
                if (Seats[i].Pid != 0) continue;
                Seats[i].Pid = -(i + 1);
                Seats[i].Name = "小奕 " + (i + 1);
                Seats[i].Token = "";
                Seats[i].Ready = true; Seats[i].Online = true; Seats[i].LastSeen = Hub.Now;
                Seats[i].Bot = true; Seats[i].Sealed = false;
                done++;
            }
            if (done > 0) { PresenceVersion++; SaySys("请了 " + done + " 位隐士陪玩"); }
            return done;
        }
        public bool RemoveBot()
        {
            if (Started) return false;
            for (int i = Seats.Length - 1; i >= 0; i--)
                if (Seats[i].Bot) { Leave(i); SaySys("一位隐士离席"); return true; }
            return false;
        }

        public int FillBotsTo(int total)
        {
            int need = Math.Min(MaxSeats, Math.Max(1, total)) - SeatCount();
            return need > 0 ? AddBots(need) : 0;
        }
        private int Fill(int i, Player p)
        {
            Seats[i].Pid = p.Id; Seats[i].Name = p.Name; Seats[i].Token = p.Token;
            Seats[i].Ready = false; Seats[i].Online = true; Seats[i].LastSeen = Hub.Now;
            PresenceVersion++;
            return i;
        }
        public void Leave(int seat)
        {
            if (seat < 0 || seat >= Seats.Length) return;
            Seats[seat].Pid = 0; Seats[seat].Name = ""; Seats[seat].Token = "";
            Seats[seat].Ready = false; Seats[seat].Online = false; Seats[seat].Bot = false;
            Seats[seat].Sealed = false;
            PresenceVersion++;
        }
        public bool ReadyAll()
        {
            for (int i = 0; i < Seats.Length; i++)
                if (Seats[i].Pid != 0 && !Seats[i].Ready) return false;
            return SeatCount() >= Math.Max(1, Rule.MinSeats);
        }
        public void ApplyRankBots()
        {
            if (!BotByRank || GodMode) return;
            int lv = hub.RankBotLevelFor(this);
            if (lv >= 0 && lv != BotLevel)
            {
                BotLevel = lv;
                SaySys("隐士依本席最高段位「" + hub.RankBotLabelFor(this) + "」调整棋力");
            }
        }
        public void Start()
        {
            ApplyRankBots();
            RankRecorded = false;
            if (Started && S != null && S.Phase != "end") return;
            Rule = RuleRegistry.Get(Game) ?? RuleRegistry.Fallback;
            RuleBase rb = Rule as RuleBase;
            if (rb != null) rb.BuildOptions = Opt.ToState();
            S = Rule.New(Variant, Math.Max(Rule.MinSeats, SeatCount()), seed, Id);
            if (rb != null) rb.BuildOptions = new Dictionary<string, object>();
            S.Seats = Math.Max(S.Seats, SeatCount());
            Started = true;
            Seq++;
            for (int i = 0; i < Seats.Length; i++) if (Seats[i].Pid == 0) Seats[i].Sealed = true;
            for (int i = 0; i < Clocks.Length; i++) { Clocks[i] = TurnLimitMs + Opt.FirstMs; Banks[i] = Opt.BankMs; }
            ClockPhase = "";
            Snapshots.Clear(); Snapshots.Add(J.CloneState(S));
            views.Clear(); ReplayFrames.Clear();
            ReplayStart = NeutralView();
            lastNeutral = ReplayStart;
            SaySys("开枰 · " + Rule.Id + (string.IsNullOrEmpty(Variant) ? "" : " / " + Variant));
            if (Opt.RuleNote.Length > 0) SaySys("本房规则：" + Opt.RuleNote);
        }
        private Dictionary<string, object> NeutralView()
        {
            Dictionary<string, object> v = S == null ? EmptyView(-1) : Rule.View(S, -1);
            v["seq"] = Seq;
            return v;
        }
        private Dictionary<string, object> EmptyView(int seat)
        {
            Dictionary<string, object> v = new Dictionary<string, object>();
            v["game"] = Game; v["variant"] = Variant; v["renderer"] = "grid";
            v["room"] = Id; v["phase"] = "wait"; v["phaseName"] = "候开枰";
            v["turn"] = 0; v["you"] = seat; v["seats"] = MaxSeats;
            v["w"] = 0; v["h"] = 0; v["cells"] = new string[0]; v["hand"] = new string[0];
            v["handSizes"] = new Dictionary<string, object>(); v["last"] = ""; v["winner"] = "";
            v["result"] = ""; v["ended"] = false; v["moveNo"] = 0; v["log"] = new string[0];
            v["legal"] = new string[0]; v["info"] = new Dictionary<string, object>();
            v["score"] = new int[0]; v["seq"] = Seq;
            return v;
        }
        public void SaySys(string text)
        {
            Chat.Add(J.Frame("name", "系统", "text", text, "ts", Hub.Now));
            if (Chat.Count > 60) Chat.RemoveAt(0);
            ChatVersion++;
        }

        public object[] Presence()
        {
            object[] a = new object[Seats.Length];
            for (int i = 0; i < Seats.Length; i++)
            {
                Seat s = Seats[i];
                a[i] = J.Frame("no", i, "name", s.Pid == 0 ? "" : s.Name, "ready", s.Ready,
                    "online", s.Online, "empty", s.Pid == 0, "bot", s.Bot, "sealed", s.Sealed);
            }
            return a;
        }
        public Dictionary<string, object> Meta()
        {
            return J.Frame("id", Id, "game", Game, "variant", Variant, "max", MaxSeats,
                "started", Started, "seq", Seq, "host", Seats.Length > 0 ? Seats[0].Name : "",
                "turnLimit", TurnLimitMs, "spectators", Spectators.Count,
                "title", Title, "locked", Password.Length > 0,
                "allowSpectators", AllowSpectators, "bots", BotCount(),
                "allowBots", !Started, "botLevel", BotLevel,
                "rankMode", Opt == null ? "none" : Opt.RankMode,
                "rankRate", Opt == null ? 50 : Opt.RankRate,
                "options", Opt.Meta(), "turnPolicy", Opt.Timeout,
                "god", GodMode, "godTier", GodTier,
                "godName", Accounts.GodName(GodTier),
                "godTitle", Accounts.GodTitle(Math.Max(0, GodTier - 1)));
        }

        public void Collect(List<KeyValuePair<Player, object>> outFrames, HashSet<int> forceFull)
        {
            int pv = PresenceVersion;
            foreach (Player p in hub.PlayersInRoom(this))
            {
                int s = p.Spectating ? -1 : p.Seat;
                int key = s < 0 ? -1000 - p.Id : s;
                Dictionary<string, object> view = (S == null ? EmptyView(s) : Rule.View(S, s));
                view["seq"] = Seq;
                int acting = S == null ? -1 : S.Turn;
                view["clock"] = (acting >= 0 && acting < Clocks.Length) ? Clocks[acting] : TurnLimitMs;
                view["clockSeat"] = acting;
                Dictionary<string, object> prev;
                bool hasPrev = views.TryGetValue(key, out prev);
                bool pvChanged = !lastPv.ContainsKey(p.Id) || lastPv[p.Id] != pv;
                if (!hasPrev || (forceFull != null && forceFull.Contains(p.Id)))
                {
                    outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame(
                        "t", "state", "view", view, "presence", Presence(), "meta", Meta(),
                        "chat", Chat.ToArray(), "you", s)));
                    views[key] = view; lastPv[p.Id] = pv;
                    continue;
                }
                List<object[]> ops = Diff.Make(prev, view);
                if (ops.Count > 0 || pvChanged)
                    outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame(
                        "t", "diff", "seq", Seq, "ops", ops.ToArray(),
                        "presence", pvChanged ? Presence() : null, "meta", pvChanged ? Meta() : null)));
                views[key] = view; lastPv[p.Id] = pv;
            }

            Dictionary<string, object> neutral = NeutralView();
            if (lastNeutral != null)
            {
                List<object[]> nops = Diff.Make(lastNeutral, neutral);
                if (nops.Count > 0)
                {
                    ReplayFrames.Add(nops.ToArray());
                    if (ReplayFrames.Count > 600) ReplayFrames.RemoveAt(0);
                }
            }
            lastNeutral = neutral;
        }

        public string DoMove(Player p, string code)
        {
            if (S == null || !Started || S.Ended) return "未开枰，或已终局";
            if (p.Spectating) return "旁观者不可落子";
            int seat = p.Seat;
            if (seat < 0 || seat >= Seats.Length || Seats[seat].Pid != p.Id) return "你不在座位上";
            List<string> legal = Rule.Legal(S, seat);
            string action = code.IndexOf(':') < 0 ? code : code.Substring(0, code.IndexOf(':'));
            bool wild = legal.Contains("p:*") || legal.Contains("solve:*") || legal.Contains("say:*") || legal.Contains("arrange:swap:*");
            if (!legal.Contains(code) && !(wild && (action == "p" || action == "solve" || action == "say" || action == "arrange")))
                return "该操作不在合法着法内";
            Snapshots.Add(J.CloneState(S));
            if (Snapshots.Count > 40) Snapshots.RemoveAt(0);
            Dictionary<string, object> d = J.Frame("code", code, "seat", seat);
            MoveResult r = Rule.Act(S, seat, action, d);
            if (!r.Ok)
            {
                Snapshots.RemoveAt(Snapshots.Count - 1);
                return r.Error;
            }
            Seq++;
            Clocks[seat] = PhaseLimit() + Opt.IncrMs;
            if (r.Note.Length > 0) SaySys(r.Note);
            if (Opt.MaxTurns > 0 && !S.Ended && S.MoveNo >= Opt.MaxTurns)
            {
                SetEnd("", "达到本房最大手数 " + Opt.MaxTurns + "，判和");
                SaySys("达到本房最大手数 " + Opt.MaxTurns + "，判和");
            }
            if (S.Ended) hub.RecordEnd(this);
            return "";
        }

        public string AutoMove()
        {
            if (S == null || !Started || S.Ended) return "";

            int seat = -1;
            string code = "";
            int n = Math.Max(S.Seats, Seats.Length);
            for (int k = 0; k < n; k++)
            {
                int i = (Math.Max(0, S.Turn) + k) % n;
                if (i >= Seats.Length || Seats[i].Bot) continue;
                List<string> l = Rule.Legal(S, i);
                string pick = PickAuto(l, i);
                if (pick.Length > 0) { seat = i; code = pick; break; }
            }
            if (seat < 0) return "";
            return DoMove(null, code, seat, "超时托管");
        }

        public string CurrentPhase()
        {
            object o;
            if (S != null && S.V.TryGetValue("_phase", out o)) return Convert.ToString(o);
            if (S == null || S.MoveNo == 0) return "first";
            string cat = "";
            if (Game == "juben" || Game == "werewolf" || Game == "avalon" || Game == "turtlesoup") cat = "party";
            else if (Game == "uno" || Game == "mahjong" || Game == "bridge") cat = "card";
            return cat == "card" ? "play" : cat == "party" ? "speak" : "move";
        }
        public long PhaseLimit()
        {
            string ph = CurrentPhase();
            long v = Opt.PhaseMs(ph);
            if (ph == "first") v += Opt.FirstMs;
            return v;
        }
        public void SyncPhaseClock()
        {
            string ph = CurrentPhase();
            if (ph == ClockPhase) return;
            ClockPhase = ph;
            long lim = PhaseLimit();
            for (int i = 0; i < Clocks.Length; i++) Clocks[i] = lim;
        }

        public void SkipTurn(int seat)
        {
            if (S == null || !Started || S.Ended) return;
            S.Turn = (S.Turn + 1) % Math.Max(1, S.Seats);
            Clocks[S.Turn] = PhaseLimit();
            ClockPhase = CurrentPhase();
            Seq++; SaySys("座位 " + seat + " 超时，跳过本手");
        }
        public void Forfeit(int seat, string why)
        {
            if (S == null || S.Ended) return;
            int w = -1;
            for (int i = 0; i < S.Seats; i++) if (i != seat) { w = i; break; }
            S.Ended = true; S.Phase = "end";
            S.Winner = w >= 0 ? w.ToString(System.Globalization.CultureInfo.InvariantCulture) : "";
            S.Result = "座位 " + seat + " " + why;
            S.PhaseName = "超时判负";
            Seq++; SaySys(S.Result); hub.RecordEnd(this);
        }

        public bool RuleTick(long dtMs)
        {
            if (S == null || !Started || S.Ended) return false;
            RuleBase rb = Rule as RuleBase;
            if (rb == null) return false;
            int before = S.MoveNo;
            string stage = S.V.ContainsKey("stage") ? Convert.ToString(S.V["stage"]) : "";
            rb.Tick(S, dtMs);
            bool changed = S.MoveNo != before ||
                stage != (S.V.ContainsKey("stage") ? Convert.ToString(S.V["stage"]) : "") ||
                (S.V.ContainsKey("tickDirty") && Convert.ToBoolean(S.V["tickDirty"]));
            if (S.V.ContainsKey("tickDirty")) S.V.Remove("tickDirty");
            if (changed) { Seq++; if (S.Ended) hub.RecordEnd(this); }
            return changed;
        }

        public bool BotStep(long now)
        {
            if (S == null || !Started || S.Ended || now < BotNextAt) return false;
            for (int i = 0; i < Seats.Length; i++)
            {
                if (!Seats[i].Bot) continue;
                List<string> legal = Rule.Legal(S, i);
                if (legal.Count == 0) continue;
                string code = PickBot(legal, i);
                if (code.Length == 0) continue;
                string err = DoMove(null, code, i, Seats[i].Name);
                if (err.Length == 0) { BotNextAt = now + BotDelayMs; return true; }
            }
            return false;
        }
        private string PickBot(List<string> legal, int seat)
        {
            RuleBase rb = Rule as RuleBase;
            if (rb != null && S != null)
            {
                if (GodMode)
                {
                    string divine = rb.GodPick(S, seat, GodTier, legal);
                    if (divine.Length > 0) return divine;
                }
                string custom = rb.BotPick(S, seat, BotLevel, legal);
                if (custom.Length > 0) return custom;
                string think = rb.BotThink(S, seat, BotLevel, legal);
                if (think.Length > 0) return think;
            }
            if (legal.Contains("say:*")) return "say:" + BotSay();
            List<string> plain = new List<string>();
            foreach (string c in legal)
                if (!c.EndsWith("*") && c != "solve" && c != "say" && !c.StartsWith("solve:")) plain.Add(c);
            List<string> skip = new List<string>();
            foreach (string c in plain)
                if (c == "pass" || c == "skip" || c == "next" || c == "save") skip.Add(c);
            List<string> main = new List<string>();
            foreach (string c in plain) if (!skip.Contains(c)) main.Add(c);
            List<string> pool = main.Count > 0 ? main : (skip.Count > 0 ? skip : plain);

            int lv = Math.Max(0, Math.Min(9, BotLevel));
            if (lv >= 1 && main.Count > 0) pool = main;
            if (pool.Count == 0) return "";
            long x = seed + S.MoveNo * 2654435761L + S.Seats * 97L;
            x = (x * 6364136223846793005L + 1442695040888963407L) & 0x7FFFFFFFFFFFFFFFL;
            int span = lv == 0 ? pool.Count : Math.Max(1, 4 - (lv + 1) / 2);
            if (span > pool.Count) span = pool.Count;
            int idx = (int)(x % (long)span);
            return pool[idx];
        }
        private string BotSay()
        {

            RuleBase rb = Rule as RuleBase;
            if (rb != null && S != null)
            {
                string line = rb.BotLine(S, Math.Max(0, S.Turn));
                if (!string.IsNullOrEmpty(line)) return line;
            }
            string[] lines = new string[] { "这个嘛…我再想想", "听起来挺圆的", "我投我觉得最像的那个", "先不说了", "有点像平时喝的东西", "这轮我跟着大家" };
            long x = (seed + S.MoveNo * 31L) & 0x7FFFFFFFFFFFFFFFL;
            return lines[(int)(x % (long)lines.Length)];
        }
        private string PickAuto(List<string> legal, int seat)
        {

            if (legal.Contains("say:*")) return "say:";

            foreach (string c in legal)
                if (!c.EndsWith("*") && c != "solve" && c != "say") return c;
            if (legal.Contains("skip")) return "skip";
            if (legal.Contains("pass")) return "pass";
            if (legal.Contains("next")) return "next";
            if (legal.Contains("say:*")) return "say:";
            if (legal.Count > 0 && !legal[0].EndsWith("*")) return legal[0];
            return "";
        }
        private string DoMove(Player ignored, string code, int seat, string by)
        {
            if (S == null || S.Ended) return "ended";
            string action = code.IndexOf(':') < 0 ? code : code.Substring(0, code.IndexOf(':'));
            MoveResult r = Rule.Act(S, seat, action, J.Frame("code", code, "seat", seat));
            if (!r.Ok) return r.Error;
            Seq++;
            Clocks[seat] = TurnLimitMs;
            if (action == "say" && code.Length > 4)
                SaySys(by + "：" + code.Substring(4));
            else if (by == "超时托管")
                SaySys("超时托管：座位 " + seat + " 自动 " + (action == "pass" ? "跳过" : "应招"));
            if (S.Ended) hub.RecordEnd(this);
            return "";
        }

        public string RequestUndo(Player p)
        {
            if (S == null || Snapshots.Count < 2) return "没有可悔的棋";
            UndoAsker = p.Seat; UndoYes.Clear(); UndoYes.Add(p.Seat);
            return "";
        }
        public void ApplyUndo()
        {
            if (Snapshots.Count < 2) return;
            S = J.CloneState(Snapshots[Snapshots.Count - 2]);
            Snapshots.RemoveAt(Snapshots.Count - 1);
            Seq++; views.Clear();
            SaySys("诸席允，复一着");
        }
        public void SetEnd(string winner, string result)
        {
            if (S == null) return;
            S.Ended = true; S.Phase = "end"; S.PhaseName = "终局";
            S.Winner = winner; S.Result = result;
            S.Log.Add(result);
            Seq++; views.Clear();
            hub.RecordEnd(this);
        }
    }
}
