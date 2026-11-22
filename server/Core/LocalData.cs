using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;

namespace Qipai
{

    public static class LocalData
    {
        private static readonly object sync = new object();
        private static string dir = "data";
        private static string hallFp = "";
        private static string hallName = "弈局棋馆";
        private static long hallVersion = 1;
        private static long hallStarted = 0;
        private static string directoryUrl = "";
        private static bool directoryOn = true;
        private static string directoryCache = "[]";
        private static long directoryAt = 0;
        private static int sessions7d = 0;
        private static Dictionary<string, object> selfPost = null;

        public const string DEFAULT_DIRECTORY =
            "https://gist.githubusercontent.com/yiju-archive/board/raw/halls.json";

        public static void Init(string root)
        {
            lock (sync)
            {
                dir = Path.Combine(root, "data");
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                hallStarted = Hub.Now;

                string kf = Path.Combine(dir, "hall.key");
                string key;
                if (File.Exists(kf)) key = File.ReadAllText(kf, Encoding.UTF8).Trim();
                else
                {
                    key = Fingerprint(Guid.NewGuid().ToString("N") + Environment.MachineName + hallStarted);
                    File.WriteAllText(kf, key, Encoding.UTF8);
                }
                hallFp = key.Length >= 16 ? key.Substring(0, 16) : Pad(key, 16);
                string nf = Path.Combine(dir, "hall.json");
                if (File.Exists(nf))
                {
                    try
                    {
                        Dictionary<string, object> d = J.Parse(File.ReadAllText(nf, Encoding.UTF8));
                        hallName = J.Str(d, "name", hallName);
                        hallVersion = J.Int(d, "version", 1);
                        directoryUrl = J.Str(d, "directory", DEFAULT_DIRECTORY);
                        directoryOn = J.Bool(d, "directoryOn", true);
                        sessions7d = J.Int(d, "sessions7d", 0);
                    }
                    catch (Exception) { }
                }
                else directoryUrl = DEFAULT_DIRECTORY;
                string cf = Path.Combine(dir, "board-cache.json");
                if (File.Exists(cf)) { try { directoryCache = File.ReadAllText(cf, Encoding.UTF8); } catch (Exception) { } }
                LoadLeaderboard();
                SaveHall();
            }
        }

        private static string Dump(object o)
        {
            if (o == null) return "null";
            if (o is string) return Q((string)o);
            if (o is bool) return ((bool)o) ? "true" : "false";
            if (o is int || o is long || o is double || o is float) return Convert.ToString(o, CultureInfo.InvariantCulture);
            Dictionary<string, object> d = o as Dictionary<string, object>;
            if (d != null)
            {
                List<string> kv = new List<string>();
                foreach (KeyValuePair<string, object> e in d) kv.Add(Q(e.Key) + ":" + Dump(e.Value));
                return "{" + string.Join(",", kv.ToArray()) + "}";
            }
            Array a = o as Array;
            if (a != null)
            {
                List<string> it = new List<string>();
                foreach (object x in a) it.Add(Dump(x));
                return "[" + string.Join(",", it.ToArray()) + "]";
            }
            return Q(Convert.ToString(o, CultureInfo.InvariantCulture));
        }
        private static string Q(string s)
        {
            if (s == null) s = "";
            StringBuilder b = new StringBuilder("\"");
            for (int i = 0; i < s.Length; i++)
            {
                char c = s[i];
                if (c == '"' || c == '\\') b.Append('\\').Append(c);
                else if (c == '\n') b.Append("\\n");
                else if (c == '\r') b.Append("\\r");
                else if (c == '\t') b.Append("\\t");
                else if (c < 32) b.Append(" ");
                else b.Append(c);
            }
            return b.Append('"').ToString();
        }
        private static long UnixNow()
        {
            return (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
        }

        private static string Pad(string s, int n)
        {
            while (s.Length < n) s += "0"; return s.Substring(0, n);
        }

        public static string Fingerprint(string raw)
        {
            long h1 = 0x811c9dc5L, h2 = 0x1000193L;
            byte[] b = Encoding.UTF8.GetBytes(raw ?? "");
            for (int i = 0; i < b.Length; i++)
            {
                h1 = (h1 ^ b[i]) * 0x100000001b3L;
                h2 = unchecked((h2 + b[i] * (i + 7)) * 0x5851f42d4c957f2dL);
            }
            return Math.Abs(h1).ToString("x") + Math.Abs(h2).ToString("x");
        }

        public static string HallFingerprint { get { lock (sync) return hallFp; } }
        public static string HallName { get { lock (sync) return hallName; } }
        public static string DirectoryUrl { get { lock (sync) return directoryUrl; } }
        public static bool DirectoryOn { get { lock (sync) return directoryOn; } }

        public static void SetProfile(string name, string url, bool on)
        {
            lock (sync)
            {
                if (!string.IsNullOrEmpty(name)) hallName = name.Trim().Length > 24 ? name.Trim().Substring(0, 24) : name.Trim();
                if (!string.IsNullOrEmpty(url)) directoryUrl = url.Trim();
                directoryOn = on; hallVersion++;
                SaveHall();
            }
        }

        private static void SaveHall()
        {
            try
            {
                Dictionary<string, object> d = J.Frame("name", hallName, "fp", hallFp,
                    "version", hallVersion, "directory", directoryUrl, "directoryOn", directoryOn,
                    "sessions7d", sessions7d, "started", hallStarted, "protocol", "yiju-hall/1");
                File.WriteAllText(Path.Combine(dir, "hall.json"),
                    Dump(d), Encoding.UTF8);
            }
            catch (Exception) { }
        }

        private static Dictionary<string, Dictionary<string, object>> board =
            new Dictionary<string, Dictionary<string, object>>();

        private static void LoadLeaderboard()
        {
            try
            {
                string f = Path.Combine(dir, "leaderboard.json");
                if (!File.Exists(f)) return;
                Dictionary<string, object> d = J.Parse(File.ReadAllText(f, Encoding.UTF8));
                object arr;
                if (d.TryGetValue("rows", out arr) && arr is object[])
                    foreach (object o in (object[])arr)
                    {
                        Dictionary<string, object> r = o as Dictionary<string, object>;
                        if (r == null) continue;
                        string k = J.Str(r, "fp", ""); if (k.Length == 0) continue;
                        board[k] = r;
                    }
            }
            catch (Exception) { }
        }
        private static void SaveLeaderboard()
        {
            try
            {
                List<object> rows = new List<object>();
                foreach (KeyValuePair<string, Dictionary<string, object>> kv in board) rows.Add(kv.Value);
                File.WriteAllText(Path.Combine(dir, "leaderboard.json"),
                    Dump(J.Frame("rows", rows.ToArray())), Encoding.UTF8);
            }
            catch (Exception) { }
        }

        public static void Record(string token, string name, string game, string variant, bool win)
        {
            lock (sync)
            {
                string fp = string.IsNullOrEmpty(token) ? "local" : Fingerprint(token).Substring(0, 16);
                Dictionary<string, object> r;
                if (!board.TryGetValue(fp, out r))
                {
                    r = J.Frame("fp", fp, "name", name ?? "访客", "plays", 0, "wins", 0,
                        "streak", 0, "last", "", "games", new Dictionary<string, object>());
                    board[fp] = r;
                }
                r["name"] = name ?? J.Str(r, "name", "访客");
                r["plays"] = J.Int(r, "plays", 0) + 1;
                if (win) { r["wins"] = J.Int(r, "wins", 0) + 1; r["streak"] = J.Int(r, "streak", 0) + 1; }
                else r["streak"] = 0;
                string today = DateTime.UtcNow.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
                r["last"] = today;
                Dictionary<string, object> g = r["games"] as Dictionary<string, object>;
                if (g == null) { g = new Dictionary<string, object>(); r["games"] = g; }
                string gk = game + "/" + (variant ?? "");
                int cur = 0; if (g.ContainsKey(gk)) { try { cur = Convert.ToInt32(g[gk]); } catch (Exception) { } }
                g[gk] = cur + 1;
                sessions7d++;
                SaveLeaderboard(); SaveHall();
            }
        }
        public static object[] Leaderboard()
        {
            lock (sync)
            {
                List<Dictionary<string, object>> rows = new List<Dictionary<string, object>>();
                foreach (KeyValuePair<string, Dictionary<string, object>> kv in board) rows.Add(kv.Value);
                rows.Sort(delegate (Dictionary<string, object> a, Dictionary<string, object> b)
                {
                    int w = J.Int(b, "wins", 0).CompareTo(J.Int(a, "wins", 0));
                    return w != 0 ? w : J.Int(b, "plays", 0).CompareTo(J.Int(a, "plays", 0));
                });
                if (rows.Count > 50) rows.RemoveRange(50, rows.Count - 50);
                List<object> outp = new List<object>();
                for (int i = 0; i < rows.Count; i++)
                    outp.Add(J.Frame("rank", i + 1, "fp", J.Str(rows[i], "fp", ""),
                        "name", J.Str(rows[i], "name", ""), "plays", J.Int(rows[i], "plays", 0),
                        "wins", J.Int(rows[i], "wins", 0), "streak", J.Int(rows[i], "streak", 0)));
                return outp.ToArray();
            }
        }

        public static void SetSelf(string addr, int online, int rooms, int scripts)
        {
            lock (sync) selfPost = HallPost(online, rooms, scripts, addr);
        }
        public static bool PushHall(out string note)
        {
            note = "";
            string url, postUrl;
            Dictionary<string, object> post;
            lock (sync)
            {
                if (!directoryOn || selfPost == null) { note = "目录关闭或馆帖未生成"; return false; }
                url = directoryUrl; post = selfPost;
            }
            if (string.IsNullOrEmpty(url)) { note = "未配置目录地址"; return false; }

            int cut = url.LastIndexOf("/halls.json", StringComparison.OrdinalIgnoreCase);
            if (cut < 0) { note = "公共只读目录无需推送（本机馆帖已在本地缓存）"; return false; }
            postUrl = url.Substring(0, cut) + "/post";
            try
            {
                ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
                using (WebClient wc = new WebClient())
                {
                    wc.Encoding = Encoding.UTF8;
                    wc.Headers["Content-Type"] = "application/json";
                    wc.Headers["User-Agent"] = "yiju-hall/1";
                    wc.UploadString(postUrl, "POST", Dump(post));
                }
                note = "馆帖已上报"; return true;
            }
            catch (Exception e) { note = "馆帖上报失败（不影响游玩）：" + e.Message; return false; }
        }

        public static Dictionary<string, object> HallPost(int online, int rooms, int scripts, string addr)
        {
            lock (sync)
                return J.Frame("v", 1, "fp", hallFp, "name", hallName, "addr", addr ?? "",
                    "version", hallVersion, "ts", UnixNow(),
                    "online", online, "rooms", rooms, "scripts", scripts,
                    "sessions7d", sessions7d, "protocol", "yiju-hall/1");
        }

        public static string DirectoryJson()
        {
            lock (sync) return directoryCache;
        }
        public static long DirectoryAgeSec()
        {
            lock (sync) return directoryAt == 0 ? -1 : (Hub.Now - directoryAt) / 1000;
        }
        public static bool PullDirectory(string url, out string note)
        {
            note = "";
            string target;
            lock (sync) target = string.IsNullOrEmpty(url) ? directoryUrl : url;
            if (string.IsNullOrEmpty(target)) { note = "未配置目录地址"; return false; }
            try
            {
                ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
                using (WebClient wc = new WebClient())
                {
                    wc.Encoding = Encoding.UTF8;
                    wc.Headers["User-Agent"] = "yiju-hall/1";
                    string raw = wc.DownloadString(target);
                    if (raw.Length > 512000) raw = raw.Substring(0, 512000);

                    object probe = J.Parse(raw);
                    if (probe == null) { note = "目录内容不是合法 JSON"; return false; }
                    lock (sync)
                    {
                        directoryCache = raw;
                        directoryAt = Hub.Now;
                        try { File.WriteAllText(Path.Combine(dir, "board-cache.json"), raw, Encoding.UTF8); } catch (Exception) { }
                    }
                    note = "已更新"; return true;
                }
            }
            catch (Exception e) { note = "目录暂不可用，已用本地缓存：" + e.Message; return false; }
        }
        public static void LocalHallList(out object[] halls)
        {

            lock (sync)
            {
                List<object> a = new List<object>();
                try
                {
                    object parsed = J.Parse(directoryCache);
                    object[] arr = parsed as object[];
                    Dictionary<string, object> obj = parsed as Dictionary<string, object>;
                    if (obj != null && obj.ContainsKey("halls")) arr = obj["halls"] as object[];
                    if (arr != null) foreach (object o in arr) if (o is Dictionary<string, object>) a.Add(o);
                }
                catch (Exception) { }
                List<object> merged = new List<object>();
                bool hasSelf = false;
                foreach (object o in a)
                {
                    Dictionary<string, object> row = o as Dictionary<string, object>;
                    if (row == null) continue;
                    if (J.Str(row, "fp", "") == hallFp)
                    {
                        hasSelf = true;
                        merged.Add(selfPost ?? row);
                    }
                    else merged.Add(row);
                }
                if (!hasSelf) merged.Insert(0, selfPost ?? HallPost(0, 0, 0, ""));
                halls = merged.ToArray();
            }
        }
    }

    public static class ScriptLibrary
    {
        private static readonly object sync = new object();
        private static string dir = "scripts";
        private static Dictionary<string, Dictionary<string, object>> scripts =
            new Dictionary<string, Dictionary<string, object>>();
        private static long stamp = 0;

        private static Dictionary<string, Dictionary<string, object>> roomScripts =
            new Dictionary<string, Dictionary<string, object>>();

        public static void Init(string root)
        {
            lock (sync)
            {
                dir = Path.Combine(root, "scripts");
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                Reload();

                ScriptGateway.List = delegate { return List(); };
                ScriptGateway.Get = delegate(string id) { return Get(id); };
                ScriptGateway.GetForRoom = delegate(string rid, string id) { return GetForRoom(rid, id); };
            }
        }
        public static void Reload()
        {
            lock (sync)
            {
                Dictionary<string, Dictionary<string, object>> next = new Dictionary<string, Dictionary<string, object>>();
                try
                {
                    string[] files = Directory.GetFiles(dir, "*.json");
                    Array.Sort(files);
                    for (int i = 0; i < files.Length; i++)
                    {
                        try
                        {
                            Dictionary<string, object> d = J.Parse(File.ReadAllText(files[i], Encoding.UTF8));
                            string id = J.Str(d, "id", "");
                            if (id.Length == 0) continue;

                            object roles; if (!d.TryGetValue("roles", out roles) || !(roles is object[])) continue;
                            object acts; if (!d.TryGetValue("acts", out acts) || !(acts is object[])) continue;
                            string ve;
                            if (Normalize(d, out ve)) next[id] = d;
                            else Console.WriteLine("[弈局] 剧本 " + id + " 未加载：" + ve);
                        }
                        catch (Exception) { }
                    }
                }
                catch (Exception) { }
                scripts = next;
                stamp = Hub.Now;
            }
        }

        private static bool Normalize(Dictionary<string, object> d, out string error)
        {
            error = "";
            object[] roles = d["roles"] as object[];
            object[] acts = d["acts"] as object[];
            if (roles == null || acts == null || roles.Length == 0 || acts.Length == 0)
            { error = "需要至少一个角色和至少一幕"; return false; }
            if (J.Str(d, "name", "").Length == 0) d["name"] = J.Str(d, "id", "未命名剧本");
            Dictionary<string, object> clues = null;
            object co; if (d.TryGetValue("clues", out co)) clues = co as Dictionary<string, object>;
            if (clues == null) { clues = new Dictionary<string, object>(); d["clues"] = clues; }
            for (int i = 0; i < roles.Length; i++)
            {
                Dictionary<string, object> r = roles[i] as Dictionary<string, object>;
                if (r == null) { error = "第 " + (i + 1) + " 个角色格式不对"; return false; }
                if (J.Str(r, "id", "").Length == 0) r["id"] = "role" + (i + 1);
                if (J.Str(r, "public", "").Length == 0) r["public"] = "角色 " + (i + 1);
                if (J.Str(r, "private", "").Length == 0) r["private"] = "";
                if (J.Str(r, "secret", "").Length == 0) r["secret"] = "";
                if (J.Str(r, "goal", "").Length == 0) r["goal"] = "";
                object bl; if (!r.TryGetValue("botLines", out bl) || !(bl is object[])) r["botLines"] = new object[0];
            }
            for (int i = 0; i < acts.Length; i++)
            {
                Dictionary<string, object> a = acts[i] as Dictionary<string, object>;
                if (a == null) { error = "第 " + (i + 1) + " 幕格式不对"; return false; }
                if (J.Str(a, "title", "").Length == 0) a["title"] = "第 " + (i + 1) + " 幕";
                object nr; if (!a.TryGetValue("narration", out nr) || !(nr is object[])) a["narration"] = new object[0];
                if (J.Int(a, "discussMs", 0) <= 0) a["discussMs"] = 240000;
                object pc; a.TryGetValue("publicClues", out pc);
                object[] pub = pc as object[];
                if (pub != null) for (int k = 0; k < pub.Length; k++)
                    if (!clues.ContainsKey(Convert.ToString(pub[k])))
                    { error = "第 " + (i + 1) + " 幕引用了不存在的线索「" + Convert.ToString(pub[k]) + "」"; return false; }
                object pv; a.TryGetValue("privateClues", out pv);
                Dictionary<string, object> priv = pv as Dictionary<string, object>;
                if (priv != null) foreach (KeyValuePair<string, object> kv in priv)
                {
                    object[] ids = kv.Value as object[];
                    if (ids == null) { error = "第 " + (i + 1) + " 幕的私秘线索格式不对"; return false; }
                    for (int k = 0; k < ids.Length; k++)
                        if (!clues.ContainsKey(Convert.ToString(ids[k])))
                        { error = "第 " + (i + 1) + " 幕引用了不存在的线索「" + Convert.ToString(ids[k]) + "」"; return false; }
                }
            }
            return true;
        }
        public static int Count { get { lock (sync) return scripts.Count; } }
        public static long Stamp { get { lock (sync) return stamp; } }

        public static object[] List()
        {
            lock (sync)
            {
                List<object> a = new List<object>();
                foreach (KeyValuePair<string, Dictionary<string, object>> kv in scripts)
                {
                    Dictionary<string, object> d = kv.Value;
                    object[] roles = d["roles"] as object[];
                    object[] tags = d.ContainsKey("tags") ? d["tags"] as object[] : null;
                    a.Add(J.Frame("id", kv.Key, "name", J.Str(d, "name", kv.Key),
                        "version", J.Int(d, "version", 1), "min", J.Int(d, "min", roles.Length),
                        "max", J.Int(d, "max", roles.Length), "minutes", J.Int(d, "minutes", 40),
                        "tags", tags ?? new object[0], "theme", J.Str(d, "theme", "夜墨"),
                        "synopsis", J.Str(d, "synopsis", ""), "roles", roles.Length));
                }
                return a.ToArray();
            }
        }
        public static Dictionary<string, object> Get(string id)
        {
            lock (sync)
            {
                Dictionary<string, object> d;
                return scripts.TryGetValue(id ?? "", out d) ? d : null;
            }
        }
        public static void PutRoom(string roomId, Dictionary<string, object> d)
        {
            lock (sync) { if (!string.IsNullOrEmpty(roomId) && d != null) roomScripts[roomId] = d; }
        }
        public static void DropRoom(string roomId)
        {
            lock (sync) { if (!string.IsNullOrEmpty(roomId)) roomScripts.Remove(roomId); }
        }

        public static Dictionary<string, object> GetForRoom(string roomId, string id)
        {
            lock (sync)
            {
                Dictionary<string, object> d;
                if (!string.IsNullOrEmpty(roomId) && roomScripts.TryGetValue(roomId, out d))
                    return d;
                return Get(id);
            }
        }

        public static Dictionary<string, object> Import(string raw, out string error)
        {
            error = "";
            try
            {
                Dictionary<string, object> d = J.Parse(raw ?? "");
                string id = J.Str(d, "id", "");
                if (id.Length == 0) { error = "剧本缺少 id"; return null; }
                string ve;
                if (!Normalize(d, out ve)) { error = ve; return null; }
                return d;
            }
            catch (Exception e) { error = "剧本 JSON 解析失败：" + e.Message; return null; }
        }
    }
}
