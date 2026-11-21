using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Qipai
{

    public sealed class GameState
    {
        public string Game = "";
        public string Variant = "";
        public string Renderer = "";
        public string Room = "";
        public string Phase = "wait";
        public string PhaseName = "候开枰";
        public int Turn = 0;
        public int Seats = 2;
        public int Width = 0;
        public int Height = 0;
        public string[] Cells = new string[0];
        public Dictionary<int, List<string>> Hands = new Dictionary<int, List<string>>();
        public Dictionary<string, object> V = new Dictionary<string, object>();
        public List<string> Log = new List<string>();
        public string Last = "";
        public string Winner = "";
        public string Result = "";
        public bool Ended = false;
        public int MoveNo = 0;
    }

    public sealed class MoveResult
    {
        public bool Ok;
        public string Error = "";
        public string Note = "";
        public bool Advance = true;
        public static MoveResult Fail(string e) { return new MoveResult { Ok = false, Error = e }; }
        public static MoveResult Good(string n = "") { return new MoveResult { Ok = true, Note = n }; }
    }

    public interface IGameRule
    {
        string Id { get; }
        string Renderer { get; }
        int MinSeats { get; }
        int MaxSeats { get; }
        string[] Variants { get; }
        GameState New(string variant, int seats, int seed, string room);
        List<string> Legal(GameState s, int seat);
        MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d);
        Dictionary<string, object> View(GameState s, int seat);
    }

    public abstract class RuleBase : IGameRule
    {
        public abstract string Id { get; }
        public virtual string Renderer { get { return "grid"; } }
        public abstract int MinSeats { get; }
        public abstract int MaxSeats { get; }
        public abstract string[] Variants { get; }
        protected abstract GameState Build(string variant, int seats, int seed, string room);
        public abstract List<string> Legal(GameState s, int seat);
        public abstract MoveResult Act(GameState s, int seat, string action, Dictionary<string, object> d);

        public Dictionary<string, object> BuildOptions = new Dictionary<string, object>();
        protected int O(string k, int def) { object v; return BuildOptions.TryGetValue(k, out v) ? Convert.ToInt32(v) : def; }
        protected long OL(string k, long def) { object v; return BuildOptions.TryGetValue(k, out v) ? Convert.ToInt64(v) : def; }
        protected bool OB(string k, bool def) { object v; return BuildOptions.TryGetValue(k, out v) ? Convert.ToBoolean(v) : def; }
        protected string OS(string k, string def) { object v; return BuildOptions.TryGetValue(k, out v) ? Convert.ToString(v) : def; }
        protected static Dictionary<string, object> Opt(GameState s)
        {
            object o;
            if (s.V.TryGetValue("_opt", out o)) return o as Dictionary<string, object>;
            return _buildingOpt;
        }
        protected static int OptI(GameState s, string k, int def)
        { Dictionary<string, object> d = Opt(s); object v; return d != null && d.TryGetValue(k, out v) ? Convert.ToInt32(v) : def; }
        protected static long OptL(GameState s, string k, long def)
        { Dictionary<string, object> d = Opt(s); object v; return d != null && d.TryGetValue(k, out v) ? Convert.ToInt64(v) : def; }
        protected static bool OptB(GameState s, string k, bool def)
        { Dictionary<string, object> d = Opt(s); object v; return d != null && d.TryGetValue(k, out v) ? Convert.ToBoolean(v) : def; }
        protected static string OptS(GameState s, string k, string def)
        { Dictionary<string, object> d = Opt(s); object v; return d != null && d.TryGetValue(k, out v) ? Convert.ToString(v) : def; }

        private long _buildSeed = 0;

        [ThreadStatic] private static Dictionary<string, object> _buildingOpt;

        public virtual void Tick(GameState s, long dtMs) { }

        public virtual string BotLine(GameState s, int seat) { return ""; }

        public virtual string BotPick(GameState s, int seat, int level, List<string> legal) { return ""; }

        public virtual double BotScore(GameState s, int seat, string code) { return 0; }

        public virtual string BotThink(GameState s, int seat, int level, List<string> legal)
        {
            if (legal == null || legal.Count == 0) return "";
            int lv = Math.Max(0, Math.Min(9, level));
            List<string> plain = new List<string>();
            foreach (string c in legal)
                if (!c.EndsWith("*") && c != "solve" && c != "say" && !c.StartsWith("solve:")) plain.Add(c);
            if (plain.Count == 0) plain.AddRange(legal);
            if (lv == 0) return plain[NextRng(s, plain.Count)];
            List<string> main = new List<string>();
            foreach (string c in plain)
                if (c != "pass" && c != "skip" && c != "next" && c != "save") main.Add(c);
            List<string> pool = main.Count > 0 ? main : plain;
            int budget = lv >= 8 ? 12 : (lv >= 5 ? 20 : (lv >= 3 ? 26 : 0));
            if (budget == 0)
            {
                int span = lv == 1 ? pool.Count : Math.Max(2, 5 - lv / 2);
                if (span > pool.Count) span = pool.Count;
                return pool[NextRng(s, span)];
            }
            if (budget > pool.Count) budget = pool.Count;
            string best = pool[0]; double bestSc = -1e18;
            long noise = NextRng(s, 1000);
            for (int i = 0; i < budget; i++)
            {
                string code = pool[i];
                double sc = EvalBotMove(s, seat, code, lv);
                sc += ((noise + i * 37) % 17) * (lv <= 4 ? 0.12 : 0.0);
                if (sc > bestSc) { bestSc = sc; best = code; }
            }
            return best;
        }

        private double EvalBotMove(GameState s, int seat, string code, int lv)
        {
            GameState c;
            try { c = J.CloneState(s); } catch (Exception) { return 0; }
            string action = code.IndexOf(':') < 0 ? code : code.Substring(0, code.IndexOf(':'));
            MoveResult r;
            try { r = Act(c, seat, action, J.Frame("code", code, "seat", seat)); }
            catch (Exception) { return -1e9; }
            if (!r.Ok) return -1e9;
            if (c.Ended)
            {
                string w = c.Winner ?? "";
                bool win = w.Length > 0 && w.Split(',').Contains(seat.ToString(CultureInfo.InvariantCulture));
                return win ? 1e6 : -1e6;
            }
            double sc = BotScore(c, seat, code);
            int mine = 0, opp = 0;
            for (int i = 0; i < c.Cells.Length; i++)
            {
                int sd = SideOf(Cell(c, i));
                if (sd == seat) mine++; else if (sd >= 0) opp++;
            }
            sc += (mine - opp) * 10;
            if (c.Hands.ContainsKey(seat)) sc -= c.Hands[seat].Count * 0.4;
            foreach (KeyValuePair<int, List<string>> kv in c.Hands)
                if (kv.Key != seat) sc += kv.Value.Count * 0.25;
            int mx = c.Width > 0 ? c.Width / 2 : 0, my = c.Height > 0 ? c.Height / 2 : 0;
            for (int i = 0; i < c.Cells.Length; i++)
            {
                if (SideOf(Cell(c, i)) != seat) continue;
                int dx = Math.Abs(X(c, i) - mx), dy = Math.Abs(Y(c, i) - my);
                sc += Math.Max(0, 6 - dx - dy) * 0.5;
            }
            if (lv >= 8 && c.Seats >= 2)
            {
                int other = (seat + 1) % c.Seats;
                List<string> ol;
                try { ol = Legal(c, other); } catch (Exception) { ol = new List<string>(); }
                double worst = 1e18;
                int ob = Math.Min(8, ol.Count);
                for (int k = 0; k < ob; k++)
                {
                    GameState c2;
                    try { c2 = J.CloneState(c); } catch (Exception) { break; }
                    string oa = ol[k].IndexOf(':') < 0 ? ol[k] : ol[k].Substring(0, ol[k].IndexOf(':'));
                    MoveResult or;
                    try { or = Act(c2, other, oa, J.Frame("code", ol[k], "seat", other)); }
                    catch (Exception) { continue; }
                    if (!or.Ok) continue;
                    if (c2.Ended)
                    {
                        string w2 = c2.Winner ?? "";
                        bool lose = w2.Length > 0 && !w2.Split(',').Contains(seat.ToString(CultureInfo.InvariantCulture));
                        if (lose) { worst = -1e6; break; }
                        continue;
                    }
                    int m2 = 0, o2 = 0;
                    for (int i = 0; i < c2.Cells.Length; i++)
                    { int sd = SideOf(Cell(c2, i)); if (sd == seat) m2++; else if (sd >= 0) o2++; }
                    double v = (m2 - o2) * 10;
                    if (v < worst) worst = v;
                }
                if (worst < 1e17) sc = sc * 0.35 + worst * 0.65;
            }
            return sc;
        }

        public GameState New(string variant, int seats, int seed, string room)
        {
            _buildSeed = seed == 0 ? 20261121L : (long)seed * 2654435761L;
            Dictionary<string, object> snap = new Dictionary<string, object>(BuildOptions);
            _buildingOpt = snap;
            GameState s;
            try { s = Build(variant, seats, seed, room); }
            finally { _buildingOpt = null; }
            s.V["_opt"] = snap;
            s.Game = Id;
            s.Variant = string.IsNullOrEmpty(variant) ? (Variants.Length > 0 ? Variants[0] : "标准") : variant;
            s.Renderer = Renderer;
            s.Room = room;
            s.Seats = seats;
            s.Phase = "playing";
            s.PhaseName = "对局中";
            if (!s.V.ContainsKey("rng")) s.V["rng"] = _buildSeed;
            if (!s.V.ContainsKey("hidden")) s.V["hidden"] = false;
            s.V["game"] = Id;
            s.V["variant"] = s.Variant;
            return s;
        }

        protected int NextRng(GameState s, int n)
        {
            if (!s.V.ContainsKey("rng")) s.V["rng"] = _buildSeed == 0 ? 20261121L : _buildSeed;
            long x = Convert.ToInt64(s.V["rng"]);
            x = (x * 6364136223846793005L + 1442695040888963407L) & 0x7FFFFFFFFFFFFFFFL;
            s.V["rng"] = x;
            return n <= 0 ? 0 : (int)(x % (long)n);
        }

        protected void Shuffle(GameState s, List<string> a)
        {
            for (int i = a.Count - 1; i > 0; i--)
            {
                int j = NextRng(s, i + 1);
                string t = a[i]; a[i] = a[j]; a[j] = t;
            }
        }

        protected static void Say(GameState s, string text)
        {
            s.Log.Add(text);
            if (s.Log.Count > 40) s.Log.RemoveAt(0);
        }
        protected static void MarkFeat(GameState s, string f)
        {
            object o;
            string[] a = s.V.TryGetValue("_feats", out o) ? o as string[] : null;
            List<string> l = a == null ? new List<string>() : new List<string>(a);
            l.Add(f);
            s.V["_feats"] = l.ToArray();
        }

        protected static void Next(GameState s, int skip)
        {
            if (s.Ended) return;
            int n = Math.Max(1, s.Seats);
            int t = (s.Turn + 1) % n;
            for (int k = 0; k < n - 1 && skip == t; k++) t = (t + 1) % n;
            s.Turn = t;
            s.MoveNo++;
        }

        protected static void Finish(GameState s, int winner, string result)
        {
            s.Ended = true;
            s.Phase = "end";
            s.PhaseName = "终局";
            s.Winner = winner < 0 ? "" : winner.ToString(CultureInfo.InvariantCulture);
            s.Result = result;
            Say(s, result);
        }

        protected static void FinishTeam(GameState s, IEnumerable<int> seats, string result)
        {
            s.Ended = true;
            s.Phase = "end";
            s.PhaseName = "终局";
            s.Winner = string.Join(",", seats.Select(x => x.ToString(CultureInfo.InvariantCulture)).ToArray());
            s.Result = result;
            Say(s, result);
        }

        public static string Cell(GameState s, int i)
        {
            return (s.Cells != null && i >= 0 && i < s.Cells.Length) ? (s.Cells[i] ?? "") : "";
        }
        public static int At(GameState s, int x, int y) { return y * s.Width + x; }
        public static int X(GameState s, int i) { return s.Width > 0 ? i % s.Width : 0; }
        public static int Y(GameState s, int i) { return s.Width > 0 ? i / s.Width : 0; }
        public static bool Inside(GameState s, int x, int y)
        {
            return x >= 0 && y >= 0 && x < s.Width && y < s.Height;
        }
        public static int CountLine(GameState s, int x, int y, int dx, int dy, string p)
        {
            int n = 0, cx = x + dx, cy = y + dy;
            while (Inside(s, cx, cy) && Cell(s, At(s, cx, cy)) == p) { n++; cx += dx; cy += dy; }
            return n;
        }
        public static int Line(GameState s, int x, int y, int dx, int dy, string p)
        {
            return 1 + CountLine(s, x, y, dx, dy, p) + CountLine(s, x, y, -dx, -dy, p);
        }
        public static readonly int[][] DIRS = new int[][] {
            new int[]{1,0}, new int[]{0,1}, new int[]{1,1}, new int[]{1,-1}
        };

        public virtual Dictionary<string, object> View(GameState s, int seat)
        {
            bool hidden = s.V.ContainsKey("hidden") && Convert.ToBoolean(s.V["hidden"]);
            string[] cells = new string[s.Cells.Length];
            for (int i = 0; i < s.Cells.Length; i++)
            {
                string c = s.Cells[i] ?? "";

                if (hidden && c.Length > 0 && c[0] == '?' && !BelongsTo(c, seat)) cells[i] = "?";
                else cells[i] = c;
            }
            Dictionary<string, object> v = new Dictionary<string, object>();
            v["game"] = s.Game;
            v["variant"] = s.Variant;
            v["renderer"] = s.Renderer;
            v["room"] = s.Room;
            v["phase"] = s.Phase;
            v["phaseName"] = s.PhaseName;
            v["turn"] = s.Turn;
            v["you"] = seat;
            v["seats"] = s.Seats;
            v["w"] = s.Width;
            v["h"] = s.Height;
            v["cells"] = cells;
            v["hand"] = s.Hands.ContainsKey(seat) ? s.Hands[seat].ToArray() : new string[0];
            v["handSizes"] = HandSizes(s);
            v["last"] = s.Last;
            v["winner"] = s.Winner;
            v["result"] = s.Result;
            v["ended"] = s.Ended;
            v["moveNo"] = s.MoveNo;
            v["log"] = s.Log.ToArray();
            v["legal"] = (s.Phase == "playing" && seat >= 0 && !s.Ended)
                ? Legal(s, seat).ToArray() : new string[0];
            v["info"] = Info(s, seat);
            v["score"] = s.V.ContainsKey("score") ? s.V["score"] : new int[0];
            return v;
        }

        protected static Dictionary<string, object> HandSizes(GameState s)
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            foreach (KeyValuePair<int, List<string>> kv in s.Hands) d[kv.Key.ToString(CultureInfo.InvariantCulture)] = kv.Value.Count;
            return d;
        }

        protected virtual Dictionary<string, object> Info(GameState s, int seat)
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            foreach (KeyValuePair<string, object> kv in s.V)
            {
                if (kv.Key.Length > 0 && kv.Key[0] == '_') continue;
                if (kv.Key == "rng" || kv.Key == "hidden" || kv.Key == "game" || kv.Key == "variant") continue;
                string lk = kv.Key.ToLowerInvariant();
                if (lk.Contains("rest") || lk == "wall" || lk == "deck" || lk == "poslast" || lk == "checkby") continue;
                object val = kv.Value;
                if (val is string[]) d[kv.Key] = val;
                else if (val is int[]) d[kv.Key] = val;
                else if (val is Dictionary<string, object>) d[kv.Key] = val;
                else if (val != null && (val.GetType().IsPrimitive || val is string || val is bool)) d[kv.Key] = val;
            }
            return d;
        }

        protected static bool BelongsTo(string c, int seat)
        {
            if (c.Length < 2) return false;
            char side = c[0] == '?' ? c[1] : c[0];
            return side == (seat == 0 ? 'r' : (seat == 1 ? 'b' : (char)('c' + seat - 2)));
        }

        protected static int SideOf(string c)
        {
            if (string.IsNullOrEmpty(c) || c.Length < 2) return -1;
            char ch = c[0] == '?' ? c[1] : c[0];
            if (ch == 'r') return 0;
            if (ch == 'b') return 1;
            if (ch >= 'c' && ch <= 'k') return 2 + (ch - 'c');
            return -1;
        }
        protected static string SideChar(int seat)
        {
            return seat == 0 ? "r" : seat == 1 ? "b" : ((char)('c' + seat - 2)).ToString();
        }
        protected static bool Mine(GameState s, int i, int seat)
        {
            return SideOf(Cell(s, i)) == seat;
        }
        protected static void Put(GameState s, int from, int to, string note)
        {
            s.Cells[to] = s.Cells[from];
            s.Cells[from] = "";
            s.Last = note;
        }
        protected static void SetGrid(GameState s, int w, int h)
        {
            s.Width = w; s.Height = h; s.Cells = new string[w * h];
            for (int i = 0; i < s.Cells.Length; i++) s.Cells[i] = "";
        }
        protected static int[] ParsePair(string code, char sep)
        {
            string[] p = code.Split(sep);
            int a, b;
            if (p.Length < 2 || !int.TryParse(p[0], out a) || !int.TryParse(p[1], out b)) return new int[] { -1, -1 };
            return new int[] { a, b };
        }
        protected static List<int> ParseList(string code)
        {
            List<int> r = new List<int>();
            string[] p = code.Split(',');
            for (int i = 0; i < p.Length; i++)
            {
                int n; if (int.TryParse(p[i].Trim(), out n)) r.Add(n);
            }
            return r;
        }
        protected static string JoinInts(IEnumerable<int> a)
        {
            return string.Join(",", a.Select(x => x.ToString(CultureInfo.InvariantCulture)).ToArray());
        }
        protected static int IntV(GameState s, string k, int def)
        {
            return s.V.ContainsKey(k) ? Convert.ToInt32(s.V[k]) : def;
        }
        protected static string StrV(GameState s, string k, string def)
        {
            return s.V.ContainsKey(k) ? Convert.ToString(s.V[k]) : def;
        }
        protected static bool BoolV(GameState s, string k, bool def)
        {
            return s.V.ContainsKey(k) ? Convert.ToBoolean(s.V[k]) : def;
        }
    }

    public static class Cards
    {
        public static readonly string[] SUITS = { "S", "H", "C", "D" };
        public static readonly string[] RANKS = { "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2" };

        public static List<string> Deck(int decks, bool jokers)
        {
            List<string> d = new List<string>();
            for (int k = 0; k < decks; k++)
                for (int i = 0; i < SUITS.Length; i++)
                    for (int j = 0; j < RANKS.Length; j++) d.Add(SUITS[i] + RANKS[j]);
            if (jokers) { d.Add("J1"); d.Add("J2"); }
            return d;
        }
        public static int Val(string c)
        {
            if (c == "J1") return 16;
            if (c == "J2") return 17;
            string r = Rank(c);
            for (int i = 0; i < RANKS.Length; i++) if (RANKS[i] == r) return i + 3;
            return 0;
        }
        public static string Rank(string c)
        {
            if (c.Length < 2) return c;
            if (c[0] == 'J') return c;
            return c.Substring(1);
        }
        public static string Suit(string c) { return c.Length > 1 ? c.Substring(0, 1) : ""; }
        public static bool IsJoker(string c) { return c == "J1" || c == "J2"; }
        public static string Label(string c)
        {
            if (c == "J1") return "小王";
            if (c == "J2") return "大王";
            string r = Rank(c);
            string s = Suit(c);
            string sym = s == "S" ? "♠" : s == "H" ? "♥" : s == "C" ? "♣" : s == "D" ? "♦" : "";
            return sym + r;
        }
        public static void SortHand(List<string> h)
        {
            h.Sort(delegate (string a, string b) { return Val(b).CompareTo(Val(a)); });
        }
        public static List<string> Take(GameState s, Dictionary<int, List<string>> hands, int seat, List<int> idx)
        {
            List<string> r = new List<string>();
            if (!hands.ContainsKey(seat)) return r;
            List<string> h = hands[seat];
            List<int> sorted = new List<int>(idx);
            sorted.Sort(); sorted.Reverse();
            for (int i = 0; i < sorted.Count; i++)
            {
                int k = sorted[i];
                if (k < 0 || k >= h.Count) return null;
                r.Add(h[k]); h.RemoveAt(k);
            }
            r.Reverse();
            return r;
        }

        public static int[] Type(List<string> cards, string wild)
        {
            int[] bad = new int[] { -1, 0, 0 };
            if (cards == null || cards.Count == 0) return bad;
            List<int> v = new List<int>();
            int wilds = 0;
            for (int i = 0; i < cards.Count; i++)
            {
                if (!string.IsNullOrEmpty(wild) && Rank(cards[i]) == wild) wilds++;
                else v.Add(Val(cards[i]));
            }
            v.Sort();
            int n = cards.Count;
            if (wilds == n && n > 0) return new int[] { 10, 20, n };
            if (n == 1) return new int[] { 0, v.Count > 0 ? v[0] : 17, 1 };
            if (n == 2)
            {
                if (v.Count == 2 && v[0] == 16 && v[1] == 17) return new int[] { 11, 100, 2 };
                if ((v.Count == 2 && v[0] == v[1]) || (v.Count == 1 && wilds == 1) || wilds == 2) return new int[] { 1, v.Count > 0 ? v[0] : 17, 2 };
                return bad;
            }
            Dictionary<int, int> cnt = new Dictionary<int, int>();
            for (int i = 0; i < v.Count; i++) { if (!cnt.ContainsKey(v[i])) cnt[v[i]] = 0; cnt[v[i]]++; }

            if (wilds > 0)
            {
                int best = 0;
                foreach (KeyValuePair<int, int> kv in cnt) if (kv.Value > best) { best = kv.Value; }
                if (v.Count > 0)
                {
                    int key = 0, mx = 0;
                    foreach (KeyValuePair<int, int> kv in cnt) if (kv.Value >= mx) { mx = kv.Value; key = kv.Key; }
                    cnt[key] = mx + wilds;
                }
            }
            List<int> keys = cnt.Keys.ToList(); keys.Sort();
            List<int> groups = cnt.Values.ToList();
            if (n == 4 && keys.Count == 1 && groups[0] == 4) return new int[] { 10, keys[0], 4 };
            if (n == 3 && keys.Count == 1 && groups[0] == 3) return new int[] { 2, keys[0], 3 };
            if (n == 4 && keys.Count == 2 && groups.Contains(3)) return new int[] { 3, KeyOf(cnt, 3), 4 };
            if (n == 5 && keys.Count == 2 && groups.Contains(3) && groups.Contains(2)) return new int[] { 4, KeyOf(cnt, 3), 5 };
            if (n == 6 && keys.Count == 2 && groups.Contains(4)) return new int[] { 9, KeyOf(cnt, 4), 6 };
            if (n == 8 && keys.Count == 3 && groups.Contains(4)) return new int[] { 9, KeyOf(cnt, 4), 8 };

            bool straight = keys.Count == n && keys[keys.Count - 1] <= 14 && Sequence(keys);
            if (straight && n >= 5) return new int[] { 5, keys[keys.Count - 1], n };
            bool pairs = keys.Count * 2 == n && keys[keys.Count - 1] <= 14 && Sequence(keys) && All(cnt, 2);
            if (pairs && n >= 6) return new int[] { 6, keys[keys.Count - 1], n };
            bool plane = keys.Count >= 2 && keys[keys.Count - 1] <= 14 && Sequence(keys) && All(cnt, 3);
            if (plane && n == keys.Count * 3) return new int[] { 7, keys[keys.Count - 1], n };
            if (plane && n == keys.Count * 4) return new int[] { 8, keys[keys.Count - 1], n };
            return bad;
        }
        private static int KeyOf(Dictionary<int, int> c, int n)
        {
            foreach (KeyValuePair<int, int> kv in c) if (kv.Value == n) return kv.Key;
            return 0;
        }
        private static bool All(Dictionary<int, int> c, int n)
        {
            foreach (KeyValuePair<int, int> kv in c) if (kv.Value != n) return false;
            return true;
        }
        private static bool Sequence(List<int> k)
        {
            for (int i = 1; i < k.Count; i++) if (k[i] != k[i - 1] + 1) return false;
            return true;
        }
        public static bool Beats(int[] a, int[] b)
        {
            if (a == null || a[0] < 0) return false;
            if (b == null || b[0] < 0) return true;
            if (a[0] == 11) return true;
            if (b[0] == 11) return false;
            if (a[0] == 10 && b[0] != 10) return true;
            if (b[0] == 10 && a[0] != 10) return false;
            return a[0] == b[0] && a[2] == b[2] && a[1] > b[1];
        }
    }

    public static class Diff
    {
        public static List<object[]> Make(object oldV, object newV)
        {
            List<object[]> ops = new List<object[]>();
            Walk(oldV, newV, "", ops);
            return ops;
        }
        private static void Walk(object a, object b, string path, List<object[]> ops)
        {
            if (a is Dictionary<string, object> && b is Dictionary<string, object>)
            {
                Dictionary<string, object> da = (Dictionary<string, object>)a;
                Dictionary<string, object> db = (Dictionary<string, object>)b;
                foreach (KeyValuePair<string, object> kv in da)
                    if (!db.ContainsKey(kv.Key)) ops.Add(new object[] { "del", Key(path, kv.Key) });
                foreach (KeyValuePair<string, object> kv in db)
                {
                    string p = Key(path, kv.Key);
                    if (!da.ContainsKey(kv.Key)) ops.Add(new object[] { "set", p, kv.Value });
                    else Walk(da[kv.Key], kv.Value, p, ops);
                }
                return;
            }

            if (a is string[] && b is string[])
            {
                string[] aa = (string[])a; string[] bb = (string[])b;
                if (aa.Length == bb.Length)
                {

                    for (int i = 0; i < aa.Length; i++)
                        if (aa[i] != bb[i]) ops.Add(new object[] { "set", Key(path, i.ToString(CultureInfo.InvariantCulture)), bb[i] });
                }
                else ops.Add(new object[] { "set", path, bb });
                return;
            }

            if (a is Array && b is Array)
            {
                string ja = string.Join(",", ((Array)a).Cast<object>().Select(x => x == null ? "" : Convert.ToString(x, CultureInfo.InvariantCulture)).ToArray());
                string jb = string.Join(",", ((Array)b).Cast<object>().Select(x => x == null ? "" : Convert.ToString(x, CultureInfo.InvariantCulture)).ToArray());
                if (ja != jb) ops.Add(new object[] { "set", path, b });
                return;
            }
            string sa = a == null ? "\u0000" : Convert.ToString(a, CultureInfo.InvariantCulture);
            string sb = b == null ? "\u0000" : Convert.ToString(b, CultureInfo.InvariantCulture);
            if (sa != sb) ops.Add(new object[] { "set", path, b });
        }
        private static bool Same(string[] a, string[] b)
        {
            if (a.Length != b.Length) return false;
            for (int i = 0; i < a.Length; i++) if (a[i] != b[i]) return false;
            return true;
        }
        private static bool Same(int[] a, int[] b)
        {
            if (a.Length != b.Length) return false;
            for (int i = 0; i < a.Length; i++) if (a[i] != b[i]) return false;
            return true;
        }
        private static bool Same(int[] a, object b)
        {
            return b is int[] && Same(a, (int[])b);
        }
        private static string Key(string path, string k)
        {
            return path.Length == 0 ? k : path + "." + k;
        }
        public static object Apply(object root, List<object[]> ops)
        {
            Dictionary<string, object> r = Clone(root as Dictionary<string, object>);
            for (int i = 0; i < ops.Count; i++)
            {
                object[] op = ops[i];
                string kind = Convert.ToString(op[0]);
                string path = Convert.ToString(op[1]);
                if (kind == "set") Set(r, path, op.Length > 2 ? op[2] : null);
                else if (kind == "del") Del(r, path);
            }
            return r;
        }
        private static Dictionary<string, object> Clone(Dictionary<string, object> src)
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            if (src == null) return d;
            foreach (KeyValuePair<string, object> kv in src)
            {
                if (kv.Value is Array) d[kv.Key] = ((Array)kv.Value).Clone();
                else if (kv.Value is Dictionary<string, object>) d[kv.Key] = Clone((Dictionary<string, object>)kv.Value);
                else d[kv.Key] = kv.Value;
            }
            return d;
        }
        private static void Set(Dictionary<string, object> root, string path, object val)
        {
            if (path.Length == 0) return;
            string[] p = path.Split('.');
            object cur = root;
            for (int i = 0; i < p.Length - 1; i++)
            {
                if (cur is Dictionary<string, object>)
                {
                    Dictionary<string, object> d = (Dictionary<string, object>)cur;
                    if (!d.ContainsKey(p[i]) || d[p[i]] == null) d[p[i]] = new Dictionary<string, object>();
                    cur = d[p[i]];
                }
                else if (cur is Array)
                {
                    int idx;
                    if (!int.TryParse(p[i], out idx)) return;
                    cur = ((Array)cur).GetValue(idx);
                }
                else return;
            }
            string last = p[p.Length - 1];
            if (cur is Dictionary<string, object>) ((Dictionary<string, object>)cur)[last] = val;
            else if (cur is Array)
            {
                int k;
                if (int.TryParse(last, out k)) ((Array)cur).SetValue(val, k);
            }
        }
        private static void Del(Dictionary<string, object> root, string path)
        {
            string[] p = path.Split('.');
            Dictionary<string, object> cur = root;
            for (int i = 0; i < p.Length - 1; i++)
            {
                if (!cur.ContainsKey(p[i]) || !(cur[p[i]] is Dictionary<string, object>)) return;
                cur = (Dictionary<string, object>)cur[p[i]];
            }
            cur.Remove(p[p.Length - 1]);
        }
    }
}
