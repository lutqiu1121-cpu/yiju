using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Qipai;

internal static class Program
{
    private static int pass = 0, fail = 0;

    private static void Check(bool ok, string name, string detail = "")
    {
        if (ok) { pass++; Console.WriteLine("  PASS  " + name); }
        else { fail++; Console.WriteLine("  FAIL  " + name + (detail.Length > 0 ? "  → " + detail : "")); }
    }

    private static int Main()
    {
        Console.WriteLine("弈局 · 规则引擎回归");
        Console.WriteLine("注册玩法数：" + RuleRegistry.Count);

        using (JsonDocument doc = JsonDocument.Parse(File.ReadAllText(FindVectors())))
        {
            JsonElement root = doc.RootElement;
            foreach (JsonElement idEl in root.GetProperty("rules").EnumerateArray())
            {
                string id = idEl.GetString();
                try
                {
                    IGameRule r = RuleRegistry.Get(id);
                    Check(r != null, "注册 " + id);
                    if (r == null) continue;
                    GameState s = r.New(r.Variants.Length > 0 ? r.Variants[0] : "标准",
                        Math.Max(r.MinSeats, 2), 12345 + id.Length, "TEST");
                    int n1 = r.Legal(s, 0).Count;
                    Dictionary<string, object> v0 = r.View(s, 0);
                    Dictionary<string, object> vN = r.View(s, -1);
                    Check(v0 != null && vN != null && v0.ContainsKey("cells") && vN.ContainsKey("legal"),
                        "初始化 " + id, "legal=" + n1 + " renderer=" + s.Renderer);
                }
                catch (Exception e) { Check(false, "初始化 " + id, e.GetType().Name + ": " + e.Message); }
            }

            foreach (JsonElement tc in root.GetProperty("games").EnumerateArray())
            {
                string name = tc.GetProperty("name").GetString();
                string game = tc.GetProperty("game").GetString();
                string variant = tc.GetProperty("variant").GetString();
                int seats = tc.GetProperty("seats").GetInt32();
                try
                {
                    IGameRule r = RuleRegistry.Get(game);
                    GameState s = r.New(variant, seats, 9000 + name.Length, "TEST");
                    if (tc.TryGetProperty("overrideNums", out JsonElement nums))
                        s.V["nums"] = nums.EnumerateArray().Select(x => x.GetInt32()).ToArray();

                    foreach (JsonElement mv in tc.GetProperty("moves").EnumerateArray())
                    {
                        int seat = mv.GetProperty("seat").GetInt32();
                        string code = mv.GetProperty("code").GetString();
                        s.Turn = seat;
                        List<string> legal = r.Legal(s, seat);
                        string act = code.IndexOf(':') < 0 ? code : code.Substring(0, code.IndexOf(':'));
                        bool wildcard = legal.Contains("p:*") || legal.Contains("solve:*");
                        if (!legal.Contains(code) && !(wildcard && (act == "p" || act == "solve")))
                            throw new Exception("着法不在 legal 内: " + code + " (legal=" + string.Join(",", legal.Take(6).ToArray()) + ")");
                        MoveResult res = r.Act(s, seat, act, new Dictionary<string, object> { ["code"] = code, ["seat"] = seat });
                        if (!res.Ok) throw new Exception("Act 拒绝: " + res.Error);
                    }
                    Check(true, name + " · 着法序列可执行");

                    if (tc.TryGetProperty("expectEnded", out JsonElement ee))
                        Check(s.Ended == ee.GetBoolean(), name + " · 终局", "ended=" + s.Ended);
                    if (tc.TryGetProperty("expectWinner", out JsonElement ew))
                        Check(s.Winner == ew.GetString(), name + " · 胜者", "winner=" + s.Winner);
                    if (tc.TryGetProperty("expectVar", out JsonElement ev))
                        foreach (JsonProperty kv in ev.EnumerateObject())
                            Check(s.V.ContainsKey(kv.Name) && Convert.ToInt32(s.V[kv.Name]) == kv.Value.GetInt32(),
                                name + " · " + kv.Name, s.V.ContainsKey(kv.Name) ? Convert.ToString(s.V[kv.Name]) : "缺失");
                    if (tc.TryGetProperty("expectLegalContains", out JsonElement el))
                    {
                        List<string> l = r.Legal(s, 0);
                        foreach (JsonElement c in el.EnumerateArray())
                            Check(l.Contains(c.GetString()), name + " · 含 " + c.GetString());
                    }
                    if (tc.TryGetProperty("expectLegalAny", out JsonElement ea) && ea.GetBoolean())
                        Check(r.Legal(s, s.Turn).Count > 0, name + " · 有合法着法");
                }
                catch (Exception e) { Check(false, name, e.Message); }
            }

            foreach (JsonElement c in root.GetProperty("cards").EnumerateArray())
            {
                List<string> cards = c.GetProperty("cards").EnumerateArray().Select(x => x.GetString()).ToList();
                int got = Cards.Type(cards, "")[0];
                Check(got == c.GetProperty("expectType").GetInt32(),
                    "牌型 " + string.Join(" ", cards.ToArray()), "得到 " + got);
            }

            foreach (JsonElement e in root.GetProperty("expressions").EnumerateArray())
            {
                string expr = e.GetProperty("expr").GetString();
                int[] nums = e.GetProperty("nums").EnumerateArray().Select(x => x.GetInt32()).ToArray();
                bool expect = e.GetProperty("expect").GetBoolean();
                List<int> used = new List<int>();
                Fractions.Frac val;
                bool ok = new Fractions.Parser(expr).Parse(out val, used);
                if (ok)
                {
                    List<int> a = used.OrderBy(x => x).ToList(), b = nums.OrderBy(x => x).ToList();
                    ok = a.SequenceEqual(b) && val.N == 24 * val.D;
                }
                Check(ok == expect, "24点 " + expr, "得到 " + (ok ? "24" : "非24"));
            }
        }

        GameState g = RuleRegistry.Get("gomoku").New("15路", 2, 77, "TEST");
        Dictionary<string, object> before = RuleRegistry.Get("gomoku").View(g, 0);
        g.Cells[0] = "r"; g.Last = "c:0"; g.MoveNo = 1;
        Dictionary<string, object> after = RuleRegistry.Get("gomoku").View(g, 0);
        List<object[]> ops = Diff.Make(before, after);
        Check(ops.Count > 0 && ops.Count < 20, "diff 只发增量", "ops=" + ops.Count);
        object rebuilt = Diff.Apply(before, ops);
        Dictionary<string, object> rb = (Dictionary<string, object>)rebuilt;
        string[] cells = rb["cells"] as string[];
        Check(cells != null && cells[0] == "r", "diff 还原后仍是 string[] 且内容一致");

        GameState a1 = RuleRegistry.Get("doudizhu").New("经典", 3, 101, "A");
        GameState a2 = RuleRegistry.Get("doudizhu").New("经典", 3, 202, "B");
        Check(!a1.Hands[0].SequenceEqual(a2.Hands[0]), "不同种子发牌不同");
        Check(a1.Hands[0].Count == 17 && a1.Hands[1].Count == 17 && a1.Hands[2].Count == 17,
            "夺帅局发牌 17/17/17 + 3 底");

        Console.WriteLine();
        Console.WriteLine("结果： " + pass + " 通过 / " + fail + " 失败");
        return fail == 0 ? 0 : 1;
    }

    private static string FindVectors()
    {
        string[] p = { "rules/vectors.json", "../../rules/vectors.json", "../../../rules/vectors.json" };
        for (int i = 0; i < p.Length; i++) if (File.Exists(p[i])) return p[i];
        throw new FileNotFoundException("找不到 rules/vectors.json，请在仓库根目录运行 dotnet run --project tools/RuleTests");
    }
}
