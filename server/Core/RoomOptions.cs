using System;
using System.Collections.Generic;
using System.Linq;

namespace Qipai
{

    public sealed class OptField
    {
        public string Key = "";
        public string Label = "";
        public string Type = "number";
        public string Group = "局仪";
        public string Hint = "";
        public object Def;
        public long Min = 0, Max = 600000, Step = 1000;
        public object[] Values = new object[0];
        public Dictionary<string, object> Json()
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            d["key"] = Key; d["label"] = Label; d["type"] = Type; d["group"] = Group;
            d["def"] = Def; d["hint"] = Hint;
            if (Type == "number") { d["min"] = Min; d["max"] = Max; d["step"] = Step; }
            if (Type == "select") d["values"] = Values;
            return d;
        }
    }

    public static class OptionSchema
    {
        static OptField N(string k, string label, object def, long min, long max, long step, string group, string hint = "")
        {
            return new OptField { Key = k, Label = label, Type = "number", Def = def, Min = min, Max = max, Step = step, Group = group, Hint = hint };
        }
        static OptField S(string k, string label, string def, string group, string[] vals, string hint = "")
        {
            object[] v = new object[vals.Length];
            for (int i = 0; i < vals.Length; i++) v[i] = vals[i];
            return new OptField { Key = k, Label = label, Type = "select", Def = def, Values = v, Group = group, Hint = hint };
        }
        static OptField T(string k, string label, bool def, string group, string hint = "")
        {
            return new OptField { Key = k, Label = label, Type = "toggle", Def = def, Group = group, Hint = hint };
        }
        static OptField X(string k, string label, string def, string group, string hint = "")
        {
            return new OptField { Key = k, Label = label, Type = "text", Def = def, Group = group, Hint = hint };
        }

        public static List<OptField> Common(string cat)
        {
            string clockLabel = cat == "chess" ? "每步思考时间" : cat == "card" ? "出牌时间" : "行动时间";
            List<OptField> a = new List<OptField>();
            a.Add(N("clock", clockLabel + "（毫秒）", 60000L, 5000, 900000, 1000, "更漏", "更漏尽依缓急处置"));
            a.Add(N("firstClock", "首手加刻（毫秒）", 15000L, 0, 300000, 1000, "更漏", "开枰首手留余裕"));
            a.Add(N("bankMs", "每方总刻（毫秒，0=不限）", 0L, 0, 3600000, 10000, "更漏", "棋钟：累计尽则判负"));
            a.Add(N("incrMs", "每步回补（毫秒）", 0L, 0, 30000, 500, "更漏", "落子后回补之刻"));
            a.Add(N("botDelay", "隐士落子之隔（毫秒）", 900L, 200, 5000, 100, "更漏"));
            a.Add(S("timeout", "更漏尽时", "auto", "缓急",
                new string[] { "auto|自动托管（推荐）", "skip|跳过本手", "lose|直接判负" }));
            a.Add(N("autoStartSec", "席满自开（秒，0=待主开枰）", 0L, 0, 60, 1, "缓急"));
            a.Add(T("allowUndo", "允许乞复", true, "局仪"));
            a.Add(T("allowDraw", "允许请和", true, "局仪"));
            a.Add(T("spectatorChat", "旁观者可留语", false, "局仪"));
            a.Add(T("spectators", "开放旁观", true, "局仪"));
            a.Add(S("botLevel", "隐士棋力", "0", "局仪",
                new string[] { "0|随性 · 信手", "1|试探 · 略识", "2|进取 · 争先",
                    "3|老成 · 择要", "4|谋势 · 深算", "5|精算 · 无漏", "6|通玄 · 坐照",
                    "7|入微 · 察势", "8|忘机 · 穷变", "9|弈圣 · 无咎" }));
            a.Add(S("rankMode", "排位", "none", "局仪",
                new string[] { "none|闲局 · 不计", "hall|馆赛 · 本馆排位", "local|自修 · 本机排位" }));
            a.Add(N("rankRate", "馆赛折算（%）", 50L, 0, 100, 5, "局仪", "馆赛所得按此比例计入段位"));
            a.Add(N("maxTurns", "最大手数（0=不限，到点言和）", 0L, 0, 2000, 10, "局仪", "免长局久缠"));
            a.Add(N("seedOffset", "本局种子偏移", 0L, 0, 999999, 1, "局仪", "同种子可复现此局"));
            a.Add(X("ruleNote", "本席规制备注（开枰播报）", "", "局仪", "例如：本席依云笺古法、不叠帖"));
            return a;
        }

        static void Phases(List<OptField> a, string cat)
        {
            if (cat == "chess")
            {
                a.Add(N("ph_first", "开枰沉思（毫秒）", 30000L, 3000, 300000, 1000, "节候"));
                a.Add(N("ph_move", "寻常落子（毫秒）", 60000L, 3000, 600000, 1000, "节候"));
                a.Add(N("ph_byoyomi", "读秒（毫秒，0=不设）", 0L, 0, 60000, 1000, "节候"));
            }
            else if (cat == "card")
            {
                a.Add(N("ph_play", "落牌之刻（毫秒）", 45000L, 3000, 300000, 1000, "节候"));
                a.Add(N("ph_bid", "叫分 / 落帖之刻（毫秒）", 30000L, 3000, 180000, 1000, "节候"));
                a.Add(N("ph_claim", "吃碰杠 / 应手之刻（毫秒）", 12000L, 2000, 60000, 1000, "节候"));
            }
            else
            {
                a.Add(N("ph_speak", "发言之刻（毫秒）", 60000L, 3000, 300000, 1000, "节候"));
                a.Add(N("ph_vote", "投签之刻（毫秒）", 30000L, 3000, 180000, 1000, "节候"));
                a.Add(N("ph_discuss", "自由议论之刻（秒）", 180L, 20, 900, 10, "节候"));
                a.Add(N("ph_night", "宵行之时（毫秒）", 25000L, 3000, 120000, 1000, "节候"));
            }
        }

        static void Specific(List<OptField> a, string id)
        {

            switch (id)
            {
                case "xiangqi":
                    a.Add(T("rule60", "六十回合自然限着言和", true, "规制"));
                    a.Add(T("longCheck", "长将 / 长捉判负", true, "规制")); break;
                case "chess": case "chess960":
                    a.Add(T("promoteChoice", "升变可选后/车/马/象", true, "规制"));
                    a.Add(T("threefold", "三复局面可请和", true, "规制"));
                    a.Add(T("rule50", "五十回合可请和", true, "规制"));
                    a.Add(T("enPassant", "允许吃过路兵", true, "规制")); break;
                case "go":
                    a.Add(S("komi", "贴子之制", "3.5", "规制",
                        new string[] { "3.5|中国 2027 试行 · 有和棋", "3.75|中国旧规 · 黑185胜", "2.75|旧制贴5目半", "6.5|日韩数目 6.5 目" }));
                    a.Add(N("handicap", "让子数（0=分先）", 0L, 0, 9, 1, "规制"));
                    a.Add(T("deadConfirm", "终局须两席认死活", true, "规制"));
                    a.Add(S("scoring", "终局数法", "area", "规制", new string[] { "area|中国数子", "territory|日韩数目" })); break;
                case "gomoku": case "renju": case "connect6":
                    a.Add(T("forbidden", "黑棋禁手（连珠）", id == "renju", "规制"));
                    a.Add(T("overline", "长连判负（白长连算胜）", true, "规制")); break;
                case "connect4": case "tictactoe": case "dots": case "hex":
                    a.Add(N("boardN", "盘路之数", id == "hex" ? 7L : 3L, 3, 15, 1, "规制"));
                    a.Add(T("gravity", "坠子 / 连边占格", true, "规制")); break;
                case "checkers":
                    a.Add(S("variantRule", "规制体系", "english", "规制",
                        new string[] { "english|英式 8×8 · 升王停", "international|国际 10×10 · 飞王" }));
                    a.Add(T("maxCapture", "有吃必吃", true, "规制")); break;
                case "doushou":
                    a.Add(T("riverRule", "河道与狮虎跳河", true, "规制"));
                    a.Add(T("trapRule", "陷阱内等级归零", true, "规制"));
                    a.Add(T("mouseElephant", "鼠吃象 / 象不吃鼠", true, "规制")); break;
                case "nim":
                    a.Add(S("mode", "终局之判", "classic", "规制",
                        new string[] { "classic|正常 · 取光者胜", "misere|反常 · 取光者负" })); break;
                case "doudizhu": case "doudizhu2": case "laizi":
                    a.Add(N("baseScore", "底分", 1L, 1, 100, 1, "规制"));
                    a.Add(T("spring", "春 / 反春倍数", true, "规制")); break;
                case "guandan": case "shengji": case "paodekuai": case "gouji": case "baohuang":
                case "shuangkou": case "hongshi": case "gongzhu":
                    a.Add(N("decks", "牌副数", 2L, 1, 4, 1, "规制")); break;
                case "yijuan":
                    a.Add(S("lineN", "弈线格数", "9", "规制",
                        new string[] { "7|七格 · 短卷", "9|九格 · 常式", "11|十一格", "13|十三格 · 长卷" }));
                    a.Add(N("handN", "每席史简张数", 12L, 8, 16, 2, "规制"));
                    a.Add(S("diffThresh", "年序差加成门槛", "3", "规制",
                        new string[] { "0|不加成", "2|差二即加", "3|差三即加", "4|差四即加" }));
                    a.Add(N("clashBonus", "相冲再推格数", 1L, 1, 2, 1, "规制"));
                    a.Add(T("flatClash", "平序相冲按游方定势", true, "规制"));
                    a.Add(N("centerPull", "同简归中格数", 1L, 1, 2, 1, "规制"));
                    a.Add(N("comeback", "卷端背水年序加成", 2L, 0, 2, 1, "规制", "距败一席本巡年序暂加"));
                    a.Add(N("pickLimit", "拾简次数", 2L, 0, 4, 1, "局仪"));
                    a.Add(N("pickCost", "拾简耗墨", 2L, 1, 4, 1, "局仪"));
                    a.Add(N("inkStart", "余墨起数", 0L, 0, 4, 1, "规制"));
                    a.Add(T("discardPublic", "弃简区公开", true, "局仪"));
                    a.Add(S("endRule", "简尽判法", "0", "规制",
                        new string[] { "0|墨偏优先", "1|余墨优先" }));
                    a.Add(S("roleSet", "史简名册", "2", "规制",
                        new string[] { "0|甲册 · 廿四家", "1|乙册 · 廿四家", "2|轮用 · 随本局种子" })); break;
                case "chudadi":
                    a.Add(N("decks", "牌副数", 1L, 1, 4, 1, "规制"));
                    a.Add(S("scoreMode", "记分口径", "ladder", "规制",
                        new string[] { "ladder|阶梯 · 剩牌分段", "flat|均计 · 每张一分", "point|点值 · 按牌面" }));
                    a.Add(N("scoreCap", "越线分数", 100L, 20, 500, 5, "规制", "累计到此分判负"));
                    a.Add(T("holdTwoDouble", "留二翻倍", false, "规制"));
                    a.Add(T("unplayedDouble", "全关翻倍", false, "规制"));
                    a.Add(T("freePass", "随时可过手", false, "局仪")); break;
                case "texas": case "zhajinhua": case "niuniu": case "sangong": case "showhand":
                    a.Add(N("startChips", "起手分", 1000L, 100, 100000, 100, "规制"));
                    a.Add(N("smallBlind", "先分 / 垫分", 10L, 1, 1000, 1, "规制"));
                    a.Add(T("sidePot", "分层记分", true, "规制")); break;
                case "shisanszhang":
                    a.Add(T("daoCheck", "倒道判罚", true, "规制")); break;
                case "uno":
                    a.Add(T("stack", "允许叠加二加四帖", false, "规制"));
                    a.Add(T("challenge", "加四质疑（非法落笺者自拈四）", true, "规制"));
                    a.Add(T("shoutUno", "余一笺未呼笺，罚拈二", true, "规制")); break;
                case "bridge":
                    a.Add(T("doubling", "允许加倍 / 再加倍", true, "规制"));
                    a.Add(S("scoring", "记分之法", "duplicate", "规制", new string[] { "duplicate|复式墩分", "rubber|盘式", "simple|简式" }));
                    a.Add(S("vulnerable", "局况", "none", "规制", new string[] { "none|双方无局", "both|双方有局" })); break;
                case "mahjong":
                    a.Add(N("minFan", "起和番数（国标 8）", 8L, 1, 32, 1, "规制"));
                    a.Add(T("queMen", "川麻缺一门", true, "规制"));
                    a.Add(T("allowChi", "允许吃牌", true, "规制")); break;
                case "blackjack":
                    a.Add(S("dealer17", "主家柔十七", "S17", "规制", new string[] { "S17|柔十七停牌（利客席）", "H17|柔十七补牌" }));
                    a.Add(S("payout", "天然廿一折算", "3:2", "规制", new string[] { "3:2|常法", "6:5|薄分" }));
                    a.Add(N("decks", "牌副数", 2L, 1, 8, 1, "规制")); break;
                case "werewolf": case "avalon":
                    a.Add(N("missionRounds", "行事 / 宵行轮数", 3L, 2, 6, 1, "规制")); break;

                case "liarsdice": case "turtlesoup": case "mastermind":
                    a.Add(N("rounds", "轮数 / 题数", 5L, 1, 20, 1, "规制")); break;
                case "diefeng":
                    a.Add(N("boardN", "石盘路数", 5L, 4, 9, 1, "规制"));
                    a.Add(N("peak", "成峰层数", 3L, 2, 5, 1, "规制"));
                    a.Add(N("target", "胜出所需峰数", 3L, 1, 9, 1, "规制"));
                    a.Add(N("stones", "各方石数", 12L, 4, 40, 1, "规制"));
                    a.Add(N("moveQuota", "各方挪石次数", 4L, 0, 12, 1, "规制"));
                    a.Add(T("allowMove", "允许挪石易势", true, "规制"));
                    a.Add(T("loneDouble", "独峰（四邻同根）加二", true, "规制")); break;
                case "juben":
                    a.Add(T("dmMode", "主家位（不领私本）", true, "规制"));
                    a.Add(T("clueReveal", "线索可示全席", true, "规制")); break;
            }
        }

        public static List<OptField> For(string game, string cat)
        {
            List<OptField> a = Common(cat);
            Phases(a, cat);
            Specific(a, game);
            return a;
        }
        public static object[] JsonFor(string game, string cat)
        {
            List<OptField> a = For(game, cat);
            object[] r = new object[a.Count];
            for (int i = 0; i < a.Count; i++) r[i] = a[i].Json();
            return r;
        }
    }

    public sealed class RoomOptions
    {
        public readonly Dictionary<string, object> Raw = new Dictionary<string, object>();
        public readonly Dictionary<string, object> Defaults = new Dictionary<string, object>();
        public long ClockMs = 60000, FirstMs = 15000, BankMs = 0, IncrMs = 0, BotDelayMs = 900, AutoStartMs = 0;
        public int MaxTurns = 0, SeedOffset = 0;
        public string RuleNote = "";
        public string Timeout = "auto";
        public bool AllowUndo = true, AllowDraw = true, SpectatorChat = false, AllowSpectators = true;
        public int BotLevel = 0;
        public string RankMode = "none";
        public int RankRate = 50;
        public readonly Dictionary<string, long> Phase = new Dictionary<string, long>();
        public readonly string Game, Cat;

        public RoomOptions(string game, string cat) { Game = game; Cat = cat; }

        static long ClampLong(object o, long def, long min, long max)
        {
            long v = def;
            if (o != null) { try { v = Convert.ToInt64(o); } catch { v = def; } }
            return Math.Max(min, Math.Min(max, v));
        }
        static bool AsBool(object o, bool def)
        {
            if (o == null) return def;
            if (o is bool) return (bool)o;
            string t = Convert.ToString(o).ToLowerInvariant();
            if (t == "true" || t == "1" || t == "on" || t == "yes") return true;
            if (t == "false" || t == "0" || t == "off" || t == "no" || t == "") return false;
            return def;
        }
        static string AsStr(object o, string def, string[] allowed)
        {
            string v = o == null ? def : Convert.ToString(o);
            if (allowed != null && allowed.Length > 0 && Array.IndexOf(allowed, v) < 0) return def;
            return v;
        }

        public static RoomOptions Parse(Dictionary<string, object> m, string game, string cat)
        {
            RoomOptions o = new RoomOptions(game, cat);
            Dictionary<string, object> src = m;
            object inner;
            if (m.TryGetValue("opts", out inner) && inner is Dictionary<string, object>) src = inner as Dictionary<string, object>;

            object v;
            o.ClockMs = ClampLong(src.TryGetValue("clock", out v) ? v : (m.TryGetValue("clock", out v) ? v : null), 60000, 5000, 900000);
            o.FirstMs = ClampLong(Get(src, m, "firstClock"), 15000, 0, 300000);
            o.BankMs = ClampLong(Get(src, m, "bankMs"), 0, 0, 3600000);
            o.IncrMs = ClampLong(Get(src, m, "incrMs"), 0, 0, 30000);
            o.BotDelayMs = ClampLong(Get(src, m, "botDelay"), 900, 200, 5000);
            o.AutoStartMs = ClampLong(Get(src, m, "autoStartSec"), 0, 0, 60) * 1000;
            o.Timeout = AsStr(Get(src, m, "timeout"), "auto", new string[] { "auto", "skip", "lose" });
            o.AllowUndo = AsBool(Get(src, m, "allowUndo"), true);
            o.AllowDraw = AsBool(Get(src, m, "allowDraw"), true);
            o.SpectatorChat = AsBool(Get(src, m, "spectatorChat"), false);
            o.AllowSpectators = AsBool(Get(src, m, "spectators"), true);
            o.BotLevel = (int)ClampLong(Get(src, m, "botLevel"), 0, 0, 9);
            o.RankMode = AsStr(Get(src, m, "rankMode"), "none", new string[] { "none", "hall", "local" });
            o.RankRate = (int)ClampLong(Get(src, m, "rankRate"), 50, 0, 100);
            o.MaxTurns = (int)ClampLong(Get(src, m, "maxTurns"), 0, 0, 2000);
            o.SeedOffset = (int)ClampLong(Get(src, m, "seedOffset"), 0, 0, 999999);
            o.RuleNote = AsStr(Get(src, m, "ruleNote"), "", null);
            if (o.RuleNote.Length > 60) o.RuleNote = o.RuleNote.Substring(0, 60);

            foreach (OptField f in OptionSchema.For(game, cat))
            {
                object val = Get(src, m, f.Key), eff;
                if (f.Type == "number") eff = ClampLong(val, Convert.ToInt64(f.Def), f.Min, f.Max);
                else if (f.Type == "toggle") eff = AsBool(val, Convert.ToBoolean(f.Def));
                else if (f.Type == "select")
                {
                    string[] allowed = new string[f.Values.Length];
                    for (int i = 0; i < f.Values.Length; i++) allowed[i] = Convert.ToString(f.Values[i]).Split('|')[0];
                    eff = AsStr(val, Convert.ToString(f.Def), allowed);
                }
                else eff = val == null ? Convert.ToString(f.Def) : Convert.ToString(val);
                o.Defaults[f.Key] = eff;
                if (val != null) o.Raw[f.Key] = eff;
            }
            foreach (KeyValuePair<string, object> kv in o.Raw)
                if (kv.Key.StartsWith("ph_")) o.Phase[kv.Key.Substring(3)] = Convert.ToInt64(kv.Value);

            return o;
        }
        static object Get(Dictionary<string, object> a, Dictionary<string, object> b, string k)
        {
            object v;
            if (a.TryGetValue(k, out v)) return v;
            if (b.TryGetValue(k, out v)) return v;
            return null;
        }
        public long PhaseMs(string phase)
        {
            long v;
            if (phase.Length > 0 && Phase.TryGetValue(phase, out v) && v > 0) return v;
            return ClockMs;
        }
        public long I(string k, long def) { object v; return Raw.TryGetValue(k, out v) ? Convert.ToInt64(v) : def; }
        public bool B(string k, bool def) { object v; return Raw.TryGetValue(k, out v) ? Convert.ToBoolean(v) : def; }
        public string S(string k, string def) { object v; return Raw.TryGetValue(k, out v) ? Convert.ToString(v) : def; }

        public Dictionary<string, object> ToState()
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            foreach (KeyValuePair<string, object> kv in Raw) d[kv.Key] = kv.Value;
            d["clock"] = ClockMs; d["firstClock"] = FirstMs; d["bankMs"] = BankMs;
            d["incrMs"] = IncrMs; d["timeout"] = Timeout;
            d["allowUndo"] = AllowUndo; d["allowDraw"] = AllowDraw;
            d["botLevel"] = BotLevel;
            d["maxTurns"] = MaxTurns; d["ruleNote"] = RuleNote;
            foreach (KeyValuePair<string, long> kv in Phase) d["ph_" + kv.Key] = kv.Value;
            return d;
        }
        public Dictionary<string, object> Meta()
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            d["clock"] = ClockMs; d["timeout"] = Timeout; d["allowUndo"] = AllowUndo;
            d["allowDraw"] = AllowDraw; d["spectatorChat"] = SpectatorChat;
            d["bankMs"] = BankMs; d["incrMs"] = IncrMs; d["botLevel"] = BotLevel;
            d["maxTurns"] = MaxTurns; d["ruleNote"] = RuleNote; d["seedOffset"] = SeedOffset;
            Dictionary<string, object> ph = new Dictionary<string, object>();
            foreach (KeyValuePair<string, long> kv in Phase) ph[kv.Key] = kv.Value;
            d["phases"] = ph;
            Dictionary<string, object> ex = new Dictionary<string, object>();
            foreach (KeyValuePair<string, object> kv in Defaults) ex[kv.Key] = kv.Value;
            foreach (KeyValuePair<string, object> kv in Raw) ex[kv.Key] = kv.Value;
            d["rules"] = ex;
            Dictionary<string, object> phAll = new Dictionary<string, object>();
            foreach (KeyValuePair<string, object> kv in Defaults)
                if (kv.Key.StartsWith("ph_")) phAll[kv.Key.Substring(3)] = kv.Value;
            foreach (KeyValuePair<string, long> kv in Phase) phAll[kv.Key] = kv.Value;
            d["phases"] = phAll;
            return d;
        }
    }
}
