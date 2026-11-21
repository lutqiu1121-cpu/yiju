using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace Qipai
{

    public static class Accounts
    {
        private const int ITER = 100000;
        private const string MAGIC_LOCAL = "YJUV";
        private const string MAGIC_EXPORT = "YJUS";
        private static readonly object sync = new object();
        private static string dir = "data";
        private static byte[] vaultKey = null;
        private static byte[] vaultMac = null;
        private static Dictionary<string, User> users = new Dictionary<string, User>();
        private static Dictionary<string, Dictionary<string, object>> cache =
            new Dictionary<string, Dictionary<string, object>>();

        private sealed class User
        {
            public string Id = "", Name = "", Salt = "", Hash = "", File = "";
            public long Created = 0;
        }

        public static int Count { get { lock (sync) return users.Count; } }

        public static void Init(string contentRoot)
        {
            lock (sync)
            {

                vaultKey = null; vaultMac = null;
                users = new Dictionary<string, User>();
                cache = new Dictionary<string, Dictionary<string, object>>();
                dir = Path.Combine(contentRoot, "data");
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                string sd = Path.Combine(dir, "saves");
                if (!Directory.Exists(sd)) Directory.CreateDirectory(sd);
                string kf = Path.Combine(dir, "vault.key");
                if (File.Exists(kf))
                {
                    try { vaultKey = Convert.FromBase64String(File.ReadAllText(kf, Encoding.UTF8).Trim()); }
                    catch (Exception) { vaultKey = null; }
                }
                if (vaultKey == null || vaultKey.Length != 32)
                {
                    vaultKey = Random(32);
                    File.WriteAllText(kf, Convert.ToBase64String(vaultKey), Encoding.UTF8);
                }
                vaultMac = SHA(vaultKey, Encoding.UTF8.GetBytes("yiju-vault-mac"));
                LoadUsers();
            }
        }

        private static void LoadUsers()
        {
            users = new Dictionary<string, User>();
            try
            {
                string f = Path.Combine(dir, "accounts.json");
                if (!File.Exists(f)) return;
                Dictionary<string, object> d = J.Parse(File.ReadAllText(f, Encoding.UTF8));
                object arr; if (!d.TryGetValue("users", out arr)) return;
                object[] a = arr as object[];
                if (a == null) return;
                for (int i = 0; i < a.Length; i++)
                {
                    Dictionary<string, object> u = a[i] as Dictionary<string, object>;
                    if (u == null) continue;
                    string name = J.Str(u, "name", "");
                    if (name.Length == 0) continue;
                    users[name.ToLowerInvariant()] = new User
                    {
                        Id = J.Str(u, "id", ""), Name = name,
                        Salt = J.Str(u, "salt", ""), Hash = J.Str(u, "hash", ""),
                        File = J.Str(u, "file", ""), Created = J.Int(u, "created", 0)
                    };
                }
            }
            catch (Exception) { }
        }
        private static void SaveUsers()
        {
            try
            {
                List<object> a = new List<object>();
                foreach (KeyValuePair<string, User> kv in users)
                    a.Add(J.Frame("id", kv.Value.Id, "name", kv.Value.Name, "salt", kv.Value.Salt,
                        "hash", kv.Value.Hash, "file", kv.Value.File, "created", kv.Value.Created));
                File.WriteAllText(Path.Combine(dir, "accounts.json"),
                    Dump(J.Frame("v", 1, "users", a.ToArray())), Encoding.UTF8);
            }
            catch (Exception) { }
        }

        private static byte[] Random(int n)
        {
            byte[] b = new byte[n];
            using (RandomNumberGenerator g = RandomNumberGenerator.Create()) g.GetBytes(b);
            return b;
        }
        private static byte[] SHA(byte[] a, byte[] b)
        {
            byte[] c = new byte[a.Length + b.Length];
            Buffer.BlockCopy(a, 0, c, 0, a.Length);
            Buffer.BlockCopy(b, 0, c, a.Length, b.Length);
            using (SHA256 h = SHA256.Create()) return h.ComputeHash(c);
        }

        private static byte[] Derive(string password, byte[] salt, int len)
        {
            byte[] pw = Encoding.UTF8.GetBytes(password ?? "");
#if NET8_0_OR_GREATER
            return Rfc2898DeriveBytes.Pbkdf2(pw, salt, ITER, HashAlgorithmName.SHA256, len);
#else
            return Pbkdf2Sha256(pw, salt, ITER, len);
#endif
        }
        private static byte[] Pbkdf2Sha256(byte[] pw, byte[] salt, int iter, int len)
        {
            byte[] dk = new byte[len];
            byte[] block = new byte[salt.Length + 4];
            System.Buffer.BlockCopy(salt, 0, block, 0, salt.Length);
            int blocks = (len + 31) / 32;
            for (int b = 1; b <= blocks; b++)
            {
                block[salt.Length] = (byte)(b >> 24);
                block[salt.Length + 1] = (byte)(b >> 16);
                block[salt.Length + 2] = (byte)(b >> 8);
                block[salt.Length + 3] = (byte)b;
                byte[] u, t;
                using (HMACSHA256 h = new HMACSHA256(pw))
                {
                    u = h.ComputeHash(block);
                    t = (byte[])u.Clone();
                    for (int i = 1; i < iter; i++)
                    {
                        u = h.ComputeHash(u);
                        for (int k = 0; k < 32; k++) t[k] ^= u[k];
                    }
                }
                int off = (b - 1) * 32, n = Math.Min(32, len - off);
                System.Buffer.BlockCopy(t, 0, dk, off, n);
            }
            return dk;
        }
        private static bool Eq(byte[] a, byte[] b)
        {
            if (a == null || b == null || a.Length != b.Length) return false;
            int d = 0; for (int i = 0; i < a.Length; i++) d |= a[i] ^ b[i];
            return d == 0;
        }
        private static byte[] AesCrypt(byte[] data, byte[] key, byte[] iv, bool enc)
        {
            using (AesManaged aes = new AesManaged())
            {
                aes.Key = key; aes.IV = iv; aes.Mode = CipherMode.CBC; aes.Padding = PaddingMode.PKCS7;
                using (ICryptoTransform t = enc ? aes.CreateEncryptor() : aes.CreateDecryptor())
                    return t.TransformFinalBlock(data, 0, data.Length);
            }
        }
        private static byte[] Hmac(byte[] key, byte[] data)
        {
            using (HMACSHA256 h = new HMACSHA256(key)) return h.ComputeHash(data);
        }

        private static byte[] Seal(string json, string magic, byte[] aesKey, byte[] macKey, byte[] salt)
        {
            byte[] iv = Random(16);
            byte[] ct = AesCrypt(Encoding.UTF8.GetBytes(json), aesKey, iv, true);
            int n = 4 + (salt == null ? 0 : 16) + 16 + ct.Length;
            byte[] head = new byte[n];
            byte[] m = Encoding.ASCII.GetBytes(magic);
            Buffer.BlockCopy(m, 0, head, 0, 4);
            int p = 4;
            if (salt != null) { Buffer.BlockCopy(salt, 0, head, p, 16); p += 16; }
            Buffer.BlockCopy(iv, 0, head, p, 16); p += 16;
            Buffer.BlockCopy(ct, 0, head, p, ct.Length);
            byte[] mac = Hmac(macKey, head);
            byte[] outp = new byte[head.Length + 32];
            Buffer.BlockCopy(head, 0, outp, 0, head.Length);
            Buffer.BlockCopy(mac, 0, outp, head.Length, 32);
            return outp;
        }
        private static bool Open(byte[] blob, string magic, byte[] aesKey, byte[] macKey,
            bool withSalt, out string json, out byte[] salt)
        {
            json = ""; salt = null;
            int min = 4 + (withSalt ? 16 : 0) + 16 + 16 + 32;
            if (blob == null || blob.Length < min) return false;
            byte[] m = Encoding.ASCII.GetBytes(magic);
            for (int i = 0; i < 4; i++) if (blob[i] != m[i]) return false;
            int headLen = blob.Length - 32;
            byte[] head = new byte[headLen];
            Buffer.BlockCopy(blob, 0, head, 0, headLen);
            byte[] mac = new byte[32];
            Buffer.BlockCopy(blob, headLen, mac, 0, 32);
            if (!Eq(Hmac(macKey, head), mac)) return false;
            int p = 4;
            if (withSalt) { salt = new byte[16]; Buffer.BlockCopy(head, p, salt, 0, 16); p += 16; }
            byte[] iv = new byte[16]; Buffer.BlockCopy(head, p, iv, 0, 16); p += 16;
            byte[] ct = new byte[headLen - p]; Buffer.BlockCopy(head, p, ct, 0, ct.Length);
            try { json = Encoding.UTF8.GetString(AesCrypt(ct, aesKey, iv, false)); return true; }
            catch (Exception) { return false; }
        }

        private static byte[] SealLocal(string json)
        {
            lock (sync) return Seal(json, MAGIC_LOCAL, vaultKey, vaultMac, null);
        }
        private static Dictionary<string, object> OpenLocal(byte[] blob)
        {
            string json; byte[] salt;
            lock (sync)
            {
                if (!Open(blob, MAGIC_LOCAL, vaultKey, vaultMac, false, out json, out salt)) return null;
            }
            try { return J.Parse(json); } catch (Exception) { return null; }
        }
        private static Dictionary<string, object> LoadSave(User u)
        {
            lock (sync)
            {
                Dictionary<string, object> c;
                if (cache.TryGetValue(u.Id, out c)) return c;
            }
            try
            {
                byte[] b = File.ReadAllBytes(Path.Combine(dir, "saves", u.File));
                Dictionary<string, object> d = OpenLocal(b);
                if (d != null) lock (sync) { cache[u.Id] = d; return d; }
            }
            catch (Exception) { }
            return NewSave(u.Id, u.Name);
        }
        private static void WriteSave(User u, Dictionary<string, object> d)
        {
            d["updated"] = UnixNow();
            byte[] blob = SealLocal(Dump(d));
            string f = string.IsNullOrEmpty(u.File) ? u.Id + ".bin" : u.File;
            File.WriteAllText(Path.Combine(dir, "saves", f), Convert.ToBase64String(blob), Encoding.UTF8);
            u.File = f;
            lock (sync) cache[u.Id] = d;
        }
        private static Dictionary<string, object> NewSave(string id, string name)
        {
            return J.Frame("v", 1, "id", id, "name", name, "fp", LocalData.Fingerprint(id).Substring(0, 16),
                "plays", 0, "wins", 0, "streak", 0, "lastDay", "",
                "games", new Dictionary<string, object>(), "scripts", new string[0],
                "titleKeys", new string[0], "worn", "", "featCount", new Dictionary<string, object>(),
                "season", TitleBook.SeasonKey(DateTime.UtcNow),
                "rankPts", new Dictionary<string, object>(), "lastSeason", "", "lastRank", "初执",
                "created", UnixNow(), "updated", UnixNow());
        }
        private static long UnixNow()
        {
            return (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
        }
        private static string Day()
        {
            return DateTime.UtcNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }
        private static string Yesterday()
        {
            return DateTime.UtcNow.AddDays(-1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        private static string Dump(object o)
        {
            if (o == null) return "null";
            if (o is string) return Q((string)o);
            if (o is bool) return ((bool)o) ? "true" : "false";
            if (o is int || o is long || o is double || o is float)
                return Convert.ToString(o, CultureInfo.InvariantCulture);
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

        private static string NormalizeName(string n)
        {
            return (n ?? "").Trim();
        }
        public static string Register(string name, string password, out string error, out Dictionary<string, object> save)
        {
            error = ""; save = null;
            name = NormalizeName(name);
            if (name.Length < 2 || name.Length > 16) { error = "名字要 2–16 个字"; return ""; }
            if (string.IsNullOrEmpty(password) || password.Length < 6 || password.Length > 64)
            { error = "口令要 6–64 字"; return ""; }
            lock (sync)
            {
                string key = name.ToLowerInvariant();
                if (users.ContainsKey(key)) { error = "此名已题于本馆"; return ""; }
                byte[] salt = Random(16);
                string id = "u_" + BitConverter.ToString(Random(8)).Replace("-", "").ToLowerInvariant();
                User u = new User
                {
                    Id = id, Name = name, Salt = Convert.ToBase64String(salt),
                    Hash = Convert.ToBase64String(Derive(password, salt, 32)),
                    File = id + ".bin", Created = UnixNow()
                };
                users[key] = u;
                try
                {
                    Dictionary<string, object> d = NewSave(id, name);
                    WriteSave(u, d);
                    save = Public(d);
                    SaveUsers();
                    return id;
                }
                catch (Exception e)
                {
                    users.Remove(key); error = "存档创建失败：" + e.Message; return "";
                }
            }
        }
        public static string Login(string name, string password, out string error, out Dictionary<string, object> save)
        {
            error = ""; save = null;
            name = NormalizeName(name);
            lock (sync)
            {
                User u;
                if (!users.TryGetValue(name.ToLowerInvariant(), out u)) { error = "没有这个账号"; return ""; }
                byte[] salt;
                try { salt = Convert.FromBase64String(u.Salt); } catch (Exception) { error = "账号数据损坏"; return ""; }
                string got = Convert.ToBase64String(Derive(password ?? "", salt, 32));
                if (!Eq(Encoding.UTF8.GetBytes(got), Encoding.UTF8.GetBytes(u.Hash)))
                { error = "口令不合"; return ""; }
                Dictionary<string, object> d = LoadSave(u);
                if (d == null) { error = "存档读不出来（保险箱密钥可能被换过）"; return ""; }
                d["name"] = u.Name;
                save = Public(d);
                return u.Id;
            }
        }
        public static Dictionary<string, object> State(string accountId)
        {
            lock (sync)
            {
                foreach (KeyValuePair<string, User> kv in users)
                    if (kv.Value.Id == accountId)
                    {
                        Dictionary<string, object> d = LoadSave(kv.Value);
                        return d == null ? null : Public(d);
                    }
            }
            return null;
        }

        public static void Record(string accountId, string game, string variant, bool win, string scriptId)
        {
            Record(accountId, game, variant, win, scriptId, new string[0]);
        }
        public static void Record(string accountId, string game, string variant, bool win, string scriptId, string[] feats)
        {
            if (string.IsNullOrEmpty(accountId)) return;
            lock (sync)
            {
                User target = null;
                foreach (KeyValuePair<string, User> kv in users) if (kv.Value.Id == accountId) { target = kv.Value; break; }
                if (target == null) return;
                Dictionary<string, object> d = LoadSave(target);
                if (d == null) d = NewSave(target.Id, target.Name);
                d["plays"] = J.Int(d, "plays", 0) + 1;
                if (win) { d["wins"] = J.Int(d, "wins", 0) + 1; d["streak"] = J.Int(d, "streak", 0) + 1; }
                else d["streak"] = 0;
                string today = Day();
                if (J.Str(d, "lastDay", "") != today)
                    d["lastDay"] = today;
                Dictionary<string, object> g = d["games"] as Dictionary<string, object>;
                if (g == null) { g = new Dictionary<string, object>(); d["games"] = g; }
                string gk = game + "/" + (variant ?? "");
                int cur = 0; if (g.ContainsKey(gk)) { try { cur = Convert.ToInt32(g[gk]); } catch (Exception) { } }
                g[gk] = cur + 1;
                List<string> tk = new List<string>();
                string[] oldTk = d["titleKeys"] as string[];
                if (oldTk != null) tk.AddRange(oldTk);
                if (win)
                {
                    string gt = TitleBook.GameKey(game);
                    if (gt.Length > 0 && !tk.Contains(gt)) tk.Add(gt);
                }
                if (feats != null)
                {
                    for (int i = 0; i < feats.Length; i++)
                    {
                        string fk = TitleBook.FeatKey(feats[i]);
                        if (fk.Length > 0 && !tk.Contains(fk)) tk.Add(fk);
                        Dictionary<string, object> fc = d["featCount"] as Dictionary<string, object>;
                        if (fc == null) { fc = new Dictionary<string, object>(); d["featCount"] = fc; }
                        fc[feats[i]] = (fc.ContainsKey(feats[i]) ? Convert.ToInt32(fc[feats[i]]) : 0) + 1;
                    }
                }
                d["titleKeys"] = tk.ToArray();
                if (!string.IsNullOrEmpty(scriptId))
                {
                    string[] old = d["scripts"] as string[];
                    List<string> l = old == null ? new List<string>() : new List<string>(old);
                    if (!l.Contains(scriptId)) l.Add(scriptId);
                    d["scripts"] = l.ToArray();
                }
                try { WriteSave(target, d); } catch (Exception) { }
            }
        }
        private static int TopPts(Dictionary<string, object> d)
        {
            Dictionary<string, object> rp = d.ContainsKey("rankPts") ? d["rankPts"] as Dictionary<string, object> : null;
            int top = 0;
            if (rp != null)
                foreach (KeyValuePair<string, object> kv in rp)
                { int v; try { v = Convert.ToInt32(kv.Value); } catch (Exception) { v = 0; } if (v > top) top = v; }
            return top;
        }
        public static void RollSeason(Dictionary<string, object> d, string key)
        {
            if (J.Str(d, "season", "") == key) return;
            d["lastSeason"] = J.Str(d, "season", "");
            d["lastRank"] = TitleBook.RankName(TopPts(d));
            d["season"] = key;
            d["rankPts"] = new Dictionary<string, object>();
        }
        public static Dictionary<string, object> RecordRank(string accountId, string game, bool win, bool draw,
            int botLevel, int ratePercent, string seasonOverride = null)
        {
            if (string.IsNullOrEmpty(accountId)) return null;
            lock (sync)
            {
                User target = null;
                foreach (KeyValuePair<string, User> kv in users) if (kv.Value.Id == accountId) { target = kv.Value; break; }
                if (target == null) return null;
                Dictionary<string, object> d = LoadSave(target);
                if (d == null) d = NewSave(target.Id, target.Name);
                string season = string.IsNullOrEmpty(seasonOverride)
                    ? TitleBook.SeasonKey(DateTime.UtcNow) : seasonOverride;
                RollSeason(d, season);
                int lv = Math.Max(0, Math.Min(6, botLevel));
                int raw = draw ? 6 : win ? 30 + 4 * lv : -12;
                int rate = Math.Max(0, Math.Min(100, ratePercent));
                int pts = (int)Math.Round(raw * rate / 100.0, MidpointRounding.AwayFromZero);
                Dictionary<string, object> rp = d["rankPts"] as Dictionary<string, object>;
                if (rp == null) { rp = new Dictionary<string, object>(); d["rankPts"] = rp; }
                int cur = 0; if (rp.ContainsKey(game)) { try { cur = Convert.ToInt32(rp[game]); } catch (Exception) { } }
                rp[game] = Math.Max(0, cur + pts);
                d["updated"] = UnixNow();
                try { WriteSave(target, d); } catch (Exception) { }
                return Public(d);
            }
        }
        private static Dictionary<string, object> Public(Dictionary<string, object> d)
        {
            return J.Frame("id", J.Str(d, "id", ""), "name", J.Str(d, "name", ""),
                "plays", J.Int(d, "plays", 0), "wins", J.Int(d, "wins", 0),
                "streak", J.Int(d, "streak", 0), "lastDay", J.Str(d, "lastDay", ""),
                "games", d.ContainsKey("games") ? d["games"] : new Dictionary<string, object>(),
                "scripts", d.ContainsKey("scripts") ? d["scripts"] : new string[0],
                "rank", TitleBook.RankName(TopPts(d)),
                "rankPts", d.ContainsKey("rankPts") ? d["rankPts"] : new Dictionary<string, object>(),
                "rankNames", TitleBook.RankMap(d["rankPts"] as Dictionary<string, object>),
                "rankIdx", TitleBook.RankIndex(TopPts(d)),
                "rankNext", TitleBook.RankNext(TopPts(d)),
                "rankSum", TitleBook.SumPts(d["rankPts"] as Dictionary<string, object>),
                "season", J.Str(d, "season", ""), "seasonName", TitleBook.SeasonName(J.Str(d, "season", "")),
                "lastSeason", J.Str(d, "lastSeason", ""), "lastRank", J.Str(d, "lastRank", "初执"),
                "titles", TitleBook.Names(d["titleKeys"] as string[]),
                "titleKeys", d.ContainsKey("titleKeys") ? d["titleKeys"] : new string[0],
                "worn", TitleBook.NameOf(J.Str(d, "worn", "")),
                "wornKey", J.Str(d, "worn", ""),
                "featCount", d.ContainsKey("featCount") ? d["featCount"] : new Dictionary<string, object>(),
                "created", d.ContainsKey("created") ? d["created"] : (long)0,
                "updated", d.ContainsKey("updated") ? d["updated"] : (long)0);
        }

        public static string Export(string accountId, string password, out string error, out string fileName)
        {
            error = ""; fileName = "yiju-存档.yijusave";
            if (string.IsNullOrEmpty(password)) { error = "先输口令方可携谱"; return ""; }
            lock (sync)
            {
                User u = null;
                foreach (KeyValuePair<string, User> kv in users) if (kv.Value.Id == accountId) { u = kv.Value; break; }
                if (u == null) { error = "尚未入席题名"; return ""; }

                byte[] salt0;
                try { salt0 = Convert.FromBase64String(u.Salt); } catch (Exception) { error = "账号数据损坏"; return ""; }
                if (!Eq(Encoding.UTF8.GetBytes(Convert.ToBase64String(Derive(password, salt0, 32))),
                        Encoding.UTF8.GetBytes(u.Hash))) { error = "口令不合，携谱被拒"; return ""; }
                Dictionary<string, object> d = LoadSave(u);
                if (d == null) { error = "存档读不出来"; return ""; }
                byte[] salt = Random(16);
                byte[] key = Derive(password, salt, 64);
                byte[] aesKey = new byte[32], macKey = new byte[32];
                Buffer.BlockCopy(key, 0, aesKey, 0, 32);
                Buffer.BlockCopy(key, 32, macKey, 0, 32);
                byte[] blob = Seal(Dump(d), MAGIC_EXPORT, aesKey, macKey, salt);
                fileName = "yiju-" + u.Name + ".yijusave";
                return Convert.ToBase64String(blob);
            }
        }

        public static Dictionary<string, object> PublicFor(string accountId)
        {
            lock (sync)
            {
                foreach (KeyValuePair<string, User> kv in users)
                    if (kv.Value.Id == accountId)
                    {
                        Dictionary<string, object> d = LoadSave(kv.Value);
                        return d == null ? null : Public(d);
                    }
            }
            return null;
        }
        public static bool SetWorn(string accountId, string key)
        {
            if (string.IsNullOrEmpty(accountId)) return false;
            lock (sync)
            {
                foreach (KeyValuePair<string, User> kv in users)
                {
                    if (kv.Value.Id != accountId) continue;
                    Dictionary<string, object> d = LoadSave(kv.Value);
                    if (d == null) return false;
                    string[] keys = d["titleKeys"] as string[] ?? new string[0];
                    if (key.Length > 0 && Array.IndexOf(keys, key) < 0) return false;
                    d["worn"] = key;
                    try { WriteSave(kv.Value, d); } catch (Exception) { return false; }
                    return true;
                }
            }
            return false;
        }

        public static string Import(string name, string password, string data, out string error,
            out Dictionary<string, object> save)
        {
            error = ""; save = null;
            name = NormalizeName(name);
            if (name.Length < 2 || name.Length > 16) { error = "名字要 2–16 个字"; return ""; }
            if (string.IsNullOrEmpty(data)) { error = "没有存档内容"; return ""; }

            data = (data ?? "").Replace("\r", "").Replace("\n", "").Replace("\t", "").Replace(" ", "");
            byte[] blob;
            try { blob = Convert.FromBase64String(data.Trim()); }
            catch (Exception) { error = "存档格式不对（应选 .yijusave 文本）"; return ""; }
            if (blob.Length < 4 + 16 + 16 + 16 + 32 || Encoding.ASCII.GetString(blob, 0, 4) != MAGIC_EXPORT)
            { error = "这不是奕局存档，或已损坏"; return ""; }
            byte[] salt = new byte[16];
            Buffer.BlockCopy(blob, 4, salt, 0, 16);
            byte[] key = Derive(password ?? "", salt, 64);
            byte[] aesKey = new byte[32], macKey = new byte[32];
            Buffer.BlockCopy(key, 0, aesKey, 0, 32);
            Buffer.BlockCopy(key, 32, macKey, 0, 32);
            string json; byte[] gotSalt;
            if (!Open(blob, MAGIC_EXPORT, aesKey, macKey, true, out json, out gotSalt))
            { error = "口令不合，或谱被改过 · 还谱被拒"; return ""; }
            Dictionary<string, object> d;
            try { d = J.Parse(json); } catch (Exception) { error = "存档内容坏了"; return ""; }
            if (d == null || J.Str(d, "id", "").Length == 0 || J.Int(d, "v", 0) != 1)
            { error = "存档版本不认识"; return ""; }
            lock (sync)
            {
                string lk = name.ToLowerInvariant();
                if (users.ContainsKey(lk)) { error = "此名已题，换一名或先入原席"; return ""; }
                string id = J.Str(d, "id", "");
                foreach (KeyValuePair<string, User> kv in users)
                    if (kv.Value.Id == id) { id = "u_" + BitConverter.ToString(Random(8)).Replace("-", "").ToLowerInvariant(); break; }
                d["id"] = id; d["name"] = name; d["updated"] = UnixNow();

                byte[] loginSalt = Random(16);
                User u = new User
                {
                    Id = id, Name = name, Salt = Convert.ToBase64String(loginSalt),
                    Hash = Convert.ToBase64String(Derive(password, loginSalt, 32)),
                    File = id + ".bin", Created = UnixNow()
                };
                users[lk] = u;
                try
                {

                    WriteSave(u, d);
                    save = Public(d);
                    SaveUsers();
                    return id;
                }
                catch (Exception e)
                {
                    users.Remove(lk); error = "存档写入失败：" + e.Message; return "";
                }
            }
        }
    }

    public static class TitleBook
    {
        private sealed class T { public string Key = "", Name = "", Note = ""; }
        private static readonly string[] RANKS = {
            "初执|初执|初入此道，先执一子",
            "登堂|登堂|四十墨分后，略登堂庑",
            "入室|入室|百墨分之后，入室窥奥",
            "知味|知味|二百墨分后，渐知局味",
            "妙手|妙手|三百五十墨分，偶出妙手",
            "国手|国手|五百六十墨分，一方称手",
            "弈圣|弈圣|八百墨分后，坐隐忘机" };
        private static readonly int[] GATES = { 0, 40, 100, 200, 350, 560, 800 };
        private static readonly string[] MONTHS = {
            "正月", "杏月", "桃月", "槐月", "榴月", "荷月",
            "兰月", "桂月", "菊月", "阳月", "葭月", "腊月" };

        private static readonly string[,] GAME = {
            {"xiangqi","橘中客","楚汉棋首胜"},{"jieqi","掀帘人","覆局棋首胜"},
            {"xiangqidark","揭云手","翻将棋首胜"},{"chess","番谱生","番象棋首胜"},
            {"chess960","布星者","列星局首胜"},{"go","坐隐","手谈首胜"},
            {"gomoku","连珠客","五连局首胜"},{"renju","守禁人","禁手连珠首胜"},
            {"connect6","双落生","双落六连首胜"},{"connect4","坠珠客","坠珠局首胜"},
            {"othello","翻云手","翻云局首胜"},{"checkers","斜行客","斜跳棋首胜"},
            {"junqi","帷中人","暗阵棋首胜"},{"doushou","驯兽生","兽阶图首胜"},
            {"tiaogi","跃营客","跃营棋首胜"},{"mills","成三手","成三局首胜"},
            {"shogi","持驹客","持驹棋首胜"},{"tictactoe","井畔人","井字局首胜"},
            {"dots","围格生","围格帖首胜"},{"hex","通津客","通津局首胜"},
            {"nim","拾芥生","拾芥令首胜"},{"endgame","解杀客","残局谱首胜"},
            {"junqi4","四镇使","四国暗阵首胜"},{"diefeng","借势生","叠峰局首胜"},
            {"doudizhu","夺帅客","夺帅局首胜"},{"doudizhu2","对席客","双人夺帅首胜"},
            {"laizi","借符生","借符夺帅首胜"},{"guandan","进贡使","贡级帖首胜"},
            {"shengji","升阶客","升阶帖首胜"},{"paodekuai","疾出手","疾出令首胜"},
            {"gongzhu","逐豕客","逐豕令首胜"},{"hongshi","赤十友","赤十局首胜"},
            {"texas","共席客","共牌令首胜"},{"zhajinhua","品笺人","花笺令首胜"},
            {"niuniu","凑十生","凑十令首胜"},{"sangong","品公客","品公令首胜"},
            {"shisanszhang","分道客","三道笺首胜"},{"uno","呼笺客","云笺令首胜"},
            {"bridge","定约生","定约帖首胜"},{"mahjong","竹间友","竹牌戏首胜"},
            {"gouji","六席客","六席联牌首胜"},{"baohuang","护驾人","护驾局首胜"},
            {"chudadi","压牌客","压牌帖首胜"},{"shuangkou","联扣友","联扣局首胜"},
            {"showhand","品五客","五品令首胜"},{"blackjack","探梅客","探梅令首胜"},
            {"feixingqi","云程客","云程局首胜"},{"monopoly","坊市行","坊市图首胜"},
            {"werewolf","辨影人","宵影局首胜"},{"undercover","辨词客","辨词令首胜"},
            {"point24","九章生","九章令首胜"},{"solitaire","独理人","独理牌首胜"},
            {"liarsdice","验点客","隐点令首胜"},{"avalon","遣使臣","遣使局首胜"},
            {"turtlesoup","问底人","问底令首胜"},{"mastermind","隐数客","隐数局首胜"},
            {"drawguess","丹青手","丹青令首胜"},{"juben","折狱生","折狱录首胜"},
            {"tournament","累墨客","累墨赛首胜"} };

        private static readonly string[,] FEAT = {
            {"seven_pairs","七对","竹牌戏 · 国标七对成和"},
            {"wild_challenge","不解笺","云笺令 · 加四质疑成立"},
            {"borrowed_peak","借势","叠峰局 · 借对手根色成峰"},
            {"lone_peak","一峰独秀","叠峰局 · 四邻同根，独峰加二"},
            {"no_stack","不叠","云笺令 · 不叠帖仍取胜"},
            {"undo_denied_win","让先","乞复被拒后仍胜"},
            {"long_think","长考","读秒将尽时落子取胜"} };

        private static T Parse(string row)
        {
            string[] a = row.Split('|');
            return new T { Key = a[0], Name = a.Length > 1 ? a[1] : a[0], Note = a.Length > 2 ? a[2] : "" };
        }
        public static string RankName(int pts)
        {
            return Parse(RANKS[RankIndex(pts)]).Name;
        }
        public static int RankIndex(int pts)
        {
            int idx = 0;
            for (int i = 0; i < GATES.Length; i++) if (pts >= GATES[i]) idx = i;
            return idx;
        }
        public static int RankNext(int pts)
        {
            int i = RankIndex(pts);
            return i + 1 < GATES.Length ? Math.Max(0, GATES[i + 1] - pts) : 0;
        }
        public static int[] Gates { get { return GATES; } }
        public static object[] RankCatalog()
        {
            List<object> r = new List<object>();
            for (int i = 0; i < RANKS.Length; i++)
            {
                T t = Parse(RANKS[i]);
                r.Add(J.Frame("key", t.Key, "name", t.Name, "note", t.Note, "gate", GATES[i]));
            }
            return r.ToArray();
        }
        public static string SeasonKey(DateTime utcNow)
        {
            return utcNow.AddHours(8).ToString("yyyy-MM", CultureInfo.InvariantCulture);
        }
        public static string SeasonName(string key)
        {
            if (string.IsNullOrEmpty(key) || key.Length < 7) return "本月";
            int m;
            if (!int.TryParse(key.Substring(5, 2), out m) || m < 1 || m > 12) return "本月";
            return MONTHS[m - 1] + " · " + key.Substring(0, 4) + " 年" + m + " 月";
        }
        public static int SumPts(Dictionary<string, object> rp)
        {
            int sum = 0;
            if (rp == null) return 0;
            foreach (KeyValuePair<string, object> kv in rp)
            { int v; try { v = Convert.ToInt32(kv.Value); } catch (Exception) { v = 0; } sum += v; }
            return sum;
        }
        public static Dictionary<string, object> RankMap(Dictionary<string, object> rp)
        {
            Dictionary<string, object> r = new Dictionary<string, object>();
            if (rp == null) return r;
            foreach (KeyValuePair<string, object> kv in rp)
            {
                int v; try { v = Convert.ToInt32(kv.Value); } catch (Exception) { v = 0; }
                r[kv.Key] = J.Frame("name", RankName(v), "pts", v, "idx", RankIndex(v), "next", RankNext(v));
            }
            return r;
        }
        private static string GameName(string game)
        {
            for (int i = 0; i < GAME.GetLength(0); i++)
                if (GAME[i, 0] == game) return GAME[i, 1];
            return "";
        }
        private static string FeatName(string f)
        {
            for (int i = 0; i < FEAT.GetLength(0); i++)
                if (FEAT[i, 0] == f) return FEAT[i, 1];
            return "";
        }
        public static string GameKey(string game)
        {
            string n = GameName(game);
            return n.Length > 0 ? "g:" + game : "";
        }
        public static string FeatKey(string f)
        {
            string n = FeatName(f);
            return n.Length > 0 ? "f:" + f : "";
        }
        public static string NameOf(string key)
        {
            if (key.Length == 0) return "";
            if (key.StartsWith("g:")) return GameName(key.Substring(2));
            if (key.StartsWith("f:")) return FeatName(key.Substring(2));
            return "";
        }
        public static string[] Names(string[] keys)
        {
            List<string> r = new List<string>();
            if (keys == null) return r.ToArray();
            for (int i = 0; i < keys.Length; i++)
            {
                string n = NameOf(keys[i]);
                if (n.Length > 0) r.Add(n);
            }
            return r.ToArray();
        }
        public static object[] Catalog()
        {
            List<object> r = new List<object>();
            for (int i = 0; i < RANKS.Length; i++)
            {
                T t = Parse(RANKS[i]);
                r.Add(J.Frame("kind", "rank", "key", t.Key, "name", t.Name, "note", t.Note,
                    "gate", GATES[i], "idx", i));
            }
            for (int i = 0; i < GAME.GetLength(0); i++)
                r.Add(J.Frame("kind", "game", "key", "g:" + GAME[i, 0], "name", GAME[i, 1], "note", GAME[i, 2]));
            for (int i = 0; i < FEAT.GetLength(0); i++)
                r.Add(J.Frame("kind", "feat", "key", "f:" + FEAT[i, 0], "name", FEAT[i, 1], "note", FEAT[i, 2]));
            return r.ToArray();
        }
    }
}
