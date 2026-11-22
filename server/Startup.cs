using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;

namespace Qipai
{
    public sealed class StartupOptions
    {
        public string Host = "0.0.0.0";
        public int Port = 5080;
        public string Hall = "弈局棋馆";
        public string Root = "";
        public string UrlOverride = "";
        public string ConfigPath = "";
        public bool DirectoryOn = true;
        public bool TimeOn = true;
        public bool BoardsOn = true;
        public bool OpenBrowser = false;
        public bool Build = false;
        public bool Help = false;
        public bool Version = false;
        public bool HallSet = false;
        public bool DirectorySet = false;
        public bool RootSet = false;

        public string EffectiveUrl()
        {
            if (!string.IsNullOrEmpty(UrlOverride))
            {
                string u = UrlOverride.Trim();
                if (u.IndexOf("://") < 0) u = "http://" + u;
                return u.TrimEnd('/');
            }
            string h = string.IsNullOrEmpty(Host) ? "0.0.0.0" : Host.Trim();
            if (h.IndexOf("://") >= 0) return h.TrimEnd('/');
            return "http://" + h + ":" + Port.ToString(CultureInfo.InvariantCulture);
        }
        public string[] ToArgs()
        {
            return new string[] { "--url", EffectiveUrl(), "--hall", Hall,
                "--root", Root, "--directory", DirectoryOn ? "on" : "off",
                "--time", TimeOn ? "on" : "off", "--boards", BoardsOn ? "on" : "off" };
        }
        public string Summary()
        {
            return "监听 " + EffectiveUrl() + " · 匾额「" + Hall + "」· 名录 " + (DirectoryOn ? "开" : "关") +
                " · 校时 " + (TimeOn ? "开" : "关") + " · 榜单 " + (BoardsOn ? "开" : "关") +
                " · 项目根 " + (string.IsNullOrEmpty(Root) ? "当前目录" : Root);
        }

        public static StartupOptions Load(string[] args, string root, Func<string, string> env)
        {
            StartupOptions o = new StartupOptions();
            o.Root = string.IsNullOrEmpty(root) ? Directory.GetCurrentDirectory() : root;
            string conf = env != null ? env("YIJU_CONF") : null;
            if (string.IsNullOrEmpty(conf)) conf = Path.Combine(o.Root, Startup.CONFIG_NAME);
            o.ConfigPath = conf;
            Startup.ApplyConfig(o, Startup.ReadConfig(conf));

            string eu = env != null ? env("QIPAI_URL") : null;
            if (!string.IsNullOrEmpty(eu)) o.UrlOverride = eu;
            string ep = env != null ? env("QIPAI_PORT") : null;
            if (!string.IsNullOrEmpty(ep)) o.Port = Startup.PortOf(ep, o.Port);
            string eh = env != null ? env("QIPAI_HALL") : null;
            if (!string.IsNullOrEmpty(eh)) { o.Hall = eh; o.HallSet = true; }
            string er = env != null ? env("QIPAI_ROOT") : null;
            if (!string.IsNullOrEmpty(er)) { o.Root = er; o.RootSet = true; }

            List<string> a = new List<string>();
            if (args != null) a.AddRange(args);
            for (int i = 0; i < a.Count; i++)
            {
                string k = a[i], v = i + 1 < a.Count ? a[i + 1] : "";
                if (k == "--help" || k == "-h") { o.Help = true; continue; }
                if (k == "--version" || k == "-V") { o.Version = true; continue; }
                if (k == "--build") { o.Build = true; continue; }
                if (k == "--open") { o.OpenBrowser = true; continue; }
                if (k == "--no-directory") { o.DirectoryOn = false; o.DirectorySet = true; continue; }
                if (k == "--no-time") { o.TimeOn = false; continue; }
                if (k == "--no-boards") { o.BoardsOn = false; continue; }
                if (k.StartsWith("--url=")) { o.UrlOverride = k.Substring(6); continue; }
                if (k.StartsWith("--port=")) { o.Port = Startup.PortOf(k.Substring(7), o.Port); continue; }
                if (k.StartsWith("--hall=")) { o.Hall = k.Substring(7); o.HallSet = true; continue; }
                if (k.StartsWith("--root=")) { o.Root = k.Substring(7); o.RootSet = true; continue; }
                if (k == "--config") { o.ConfigPath = v; i++; continue; }
                if (k == "--url" || k == "-u") { o.UrlOverride = v; i++; continue; }
                if (k == "--port" || k == "-p") { o.Port = Startup.PortOf(v, o.Port); i++; continue; }
                if (k == "--host") { o.Host = v; i++; continue; }
                if (k == "--hall" || k == "--name") { o.Hall = v; o.HallSet = true; i++; continue; }
                if (k == "--root" || k == "--data") { o.Root = v; o.RootSet = true; i++; continue; }
                if (k == "--directory" || k == "--dir") { o.DirectoryOn = Startup.OnOf(v, o.DirectoryOn); o.DirectorySet = true; i++; continue; }
                if (k == "--time") { o.TimeOn = Startup.OnOf(v, o.TimeOn); i++; continue; }
                if (k == "--boards") { o.BoardsOn = Startup.OnOf(v, o.BoardsOn); i++; continue; }
            }
            if (o.Port < 1 || o.Port > 65535) o.Port = 5080;
            if (string.IsNullOrEmpty(o.Host)) o.Host = "0.0.0.0";
            return o;
        }
    }

    public static class Startup
    {
        public const string CONFIG_NAME = "yiju.conf";
        public const string VERSION = "1.0.0";
        public const string LICENSE = "PolyForm Noncommercial 1.0.0";
        private const string WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

        public static string DefaultConfigText()
        {
            StringBuilder b = new StringBuilder();
            b.AppendLine("# 弈局 · 一键配置。改完保存，直接 ./start.sh 即可；命令行参数会覆盖这里。");
            b.AppendLine("HOST=0.0.0.0");
            b.AppendLine("PORT=5080");
            b.AppendLine("HALL=弈局棋馆");
            b.AppendLine("DIRECTORY=on");
            b.AppendLine("TIME=on");
            b.AppendLine("BOARDS=on");
            b.AppendLine("ROOT=.");
            b.AppendLine("OPEN=no");
            b.AppendLine("BUILD=no");
            return b.ToString();
        }
        public static void EnsureConfig(string path)
        {
            if (string.IsNullOrEmpty(path)) return;
            if (!File.Exists(path))
            {
                string d = Path.GetDirectoryName(path);
                if (!string.IsNullOrEmpty(d) && !Directory.Exists(d)) Directory.CreateDirectory(d);
                File.WriteAllText(path, DefaultConfigText(), new UTF8Encoding(false));
            }
        }
        public static Dictionary<string, string> ReadConfig(string path)
        {
            Dictionary<string, string> r = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                if (!File.Exists(path)) return r;
                string[] lines = File.ReadAllLines(path, Encoding.UTF8);
                for (int i = 0; i < lines.Length; i++)
                {
                    string l = lines[i].Trim();
                    if (l.Length == 0 || l.StartsWith("#") || l.StartsWith(";")) continue;
                    int p = l.IndexOf('=');
                    if (p <= 0) continue;
                    string k = l.Substring(0, p).Trim(), v = l.Substring(p + 1).Trim();
                    int c = v.IndexOf('#'); if (c >= 0) v = v.Substring(0, c).Trim();
                    if ((v.StartsWith("\"") && v.EndsWith("\"")) || (v.StartsWith("'") && v.EndsWith("'")))
                        v = v.Length >= 2 ? v.Substring(1, v.Length - 2) : "";
                    r[k] = v;
                }
            }
            catch (Exception) { }
            return r;
        }
        public static void ApplyConfig(StartupOptions o, Dictionary<string, string> c)
        {
            if (o == null || c == null) return;
            string v;
            if (c.TryGetValue("HOST", out v) && v.Length > 0) o.Host = v;
            if (c.TryGetValue("PORT", out v)) o.Port = PortOf(v, o.Port);
            if (c.TryGetValue("HALL", out v) && v.Length > 0) { o.Hall = v; o.HallSet = true; }
            if (c.TryGetValue("ROOT", out v) && v.Length > 0 && v != ".") { o.Root = v; o.RootSet = true; }
            if (c.TryGetValue("URL", out v) && v.Length > 0) o.UrlOverride = v;
            if (c.TryGetValue("DIRECTORY", out v)) { o.DirectoryOn = OnOf(v, o.DirectoryOn); o.DirectorySet = true; }
            if (c.TryGetValue("TIME", out v)) o.TimeOn = OnOf(v, o.TimeOn);
            if (c.TryGetValue("BOARDS", out v)) o.BoardsOn = OnOf(v, o.BoardsOn);
            if (c.TryGetValue("OPEN", out v)) o.OpenBrowser = OnOf(v, o.OpenBrowser);
            if (c.TryGetValue("BUILD", out v)) o.Build = OnOf(v, o.Build);
        }
        public static bool OnOf(string v, bool def)
        {
            if (string.IsNullOrEmpty(v)) return def;
            string t = v.Trim().ToLowerInvariant();
            if (t == "on" || t == "yes" || t == "true" || t == "1" || t == "开" || t == "启") return true;
            if (t == "off" || t == "no" || t == "false" || t == "0" || t == "关" || t == "停") return false;
            return def;
        }
        public static int PortOf(string v, int def)
        {
            int p;
            if (int.TryParse((v ?? "").Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out p)
                && p >= 1 && p <= 65535) return p;
            return def;
        }
        public static string EnsureLayout(string root, StartupOptions o)
        {
            string r = string.IsNullOrEmpty(root) ? Directory.GetCurrentDirectory() : Path.GetFullPath(root);
            if (!o.RootSet || string.IsNullOrEmpty(o.Root)) o.Root = r;
            EnsureConfig(o.ConfigPath);
            string data = Path.Combine(r, "data");
            if (!Directory.Exists(data)) Directory.CreateDirectory(data);
            string saves = Path.Combine(data, "saves");
            if (!Directory.Exists(saves)) Directory.CreateDirectory(saves);
            string scripts = Path.Combine(r, "scripts");
            if (!Directory.Exists(scripts)) Directory.CreateDirectory(scripts);
            return r;
        }
        public static string[] LayoutProblems(string root)
        {
            List<string> bad = new List<string>();
            string[] rel = { Path.Combine("client", "index.html"), Path.Combine("rules", "manifest.json"),
                Path.Combine("server", "Qipai.Server.csproj") };
            for (int i = 0; i < rel.Length; i++)
                if (!File.Exists(Path.Combine(root, rel[i]))) bad.Add(rel[i]);
            if (!Directory.Exists(Path.Combine(root, "scripts"))) bad.Add("scripts/");
            return bad.ToArray();
        }
        public static List<string> LanAddresses(string url)
        {
            List<string> r = new List<string>();
            string port = "5080";
            int idx = (url ?? "").LastIndexOf(':');
            if (idx >= 0 && idx < url.Length - 1)
            {
                string tail = url.Substring(idx + 1).TrimEnd('/');
                int p; if (int.TryParse(tail, out p)) port = p.ToString(CultureInfo.InvariantCulture);
            }
            try
            {
                foreach (IPAddress ip in Dns.GetHostEntry(Dns.GetHostName()).AddressList)
                    if (ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip))
                        r.Add(ip.ToString() + ":" + port);
            }
            catch (Exception) { }
            r.Add("localhost:" + port);
            return r;
        }
        public static string HealthJson(int games, int accounts)
        {
            return "{\"ok\":true,\"games\":" + games + ",\"accounts\":" + accounts +
                ",\"protocol\":\"yiju-hall/1\",\"license\":\"" + LICENSE + "\",\"version\":\"" + VERSION + "\"}";
        }
        public static string InfoJson(int games, int scripts, string hall, string fp,
            List<string> addresses, bool directoryOn, bool timeOn, bool boardsOn)
        {
            StringBuilder b = new StringBuilder();
            b.Append("{\"ok\":true,\"protocol\":\"yiju-hall/1\",\"games\":").Append(games);
            b.Append(",\"scripts\":").Append(scripts);
            b.Append(",\"hall\":\"").Append(Esc(hall)).Append("\",\"fp\":\"").Append(Esc(fp)).Append("\"");
            b.Append(",\"license\":\"").Append(LICENSE).Append("\",\"version\":\"").Append(VERSION).Append("\"");
            b.Append(",\"directoryOn\":").Append(directoryOn ? "true" : "false");
            b.Append(",\"timeOn\":").Append(timeOn ? "true" : "false");
            b.Append(",\"boardsOn\":").Append(boardsOn ? "true" : "false");
            b.Append(",\"addresses\":[");
            for (int i = 0; i < addresses.Count; i++)
            { if (i > 0) b.Append(','); b.Append('"').Append(Esc(addresses[i])).Append('"'); }
            b.Append("]}");
            return b.ToString();
        }
        public static string Esc(string s)
        {
            return (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"")
                .Replace("\r", "").Replace("\n", "").Replace("\t", "");
        }
        public static string WsAccept(string key)
        {
            using (SHA1 sha = SHA1.Create())
            {
                byte[] h = sha.ComputeHash(Encoding.ASCII.GetBytes((key ?? "") + WS_GUID));
                return Convert.ToBase64String(h);
            }
        }
        public static string WsUpgradeResponse(string key)
        {
            return "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
                "Sec-WebSocket-Accept: " + WsAccept(key) + "\r\n\r\n";
        }
        public static string Hint(StartupOptions o, string root)
        {
            List<string> la = LanAddresses(o.EffectiveUrl());
            StringBuilder b = new StringBuilder();
            b.AppendLine("[弈局] 一键配置：" + o.ConfigPath);
            b.AppendLine("[弈局] " + o.Summary());
            b.AppendLine("[弈局] 手机 / APK 在「肆 · 案牍 → 联网 · 离线 → 棋馆地址」填下面任一地址（任意地址均可，端口可省）：");
            for (int i = 0; i < la.Count; i++) b.AppendLine("    " + la[i]);
            string[] bad = LayoutProblems(root);
            if (bad.Length > 0) b.AppendLine("[弈局] 缺件：" + string.Join(", ", bad));
            return b.ToString();
        }
        public static string HelpText()
        {
            StringBuilder b = new StringBuilder();
            b.AppendLine("弈局棋馆 · 启动项 " + VERSION);
            b.AppendLine("一键：./start.sh（Windows：start.bat）；改 yiju.conf 即改配置。");
            b.AppendLine("  --url / -u <地址>        完整监听地址，覆盖 HOST/PORT");
            b.AppendLine("  --port / -p <1-65535>    端口（默认 5080，可任意改）");
            b.AppendLine("  --host <地址>            监听主机（默认 0.0.0.0）");
            b.AppendLine("  --hall / --name <名>     本馆匾额");
            b.AppendLine("  --root / --data <目录>   项目根（client/rules/scripts/data 所在）");
            b.AppendLine("  --directory on|off       棋馆名录；--no-directory 直接关");
            b.AppendLine("  --time on|off            赛季校时；--no-time 直接关");
            b.AppendLine("  --boards on|off          公共榜单；--no-boards 直接关");
            b.AppendLine("  --open                   启动后打开本机谱页");
            b.AppendLine("  --build                  启动前先构建");
            b.AppendLine("  --config <文件>          指定配置文件（默认 yiju.conf）");
            b.AppendLine("  --help / --version       本说明 / 版本");
            b.AppendLine("环境变量：QIPAI_URL / QIPAI_PORT / QIPAI_HALL / QIPAI_ROOT / YIJU_CONF");
            b.AppendLine("优先级：命令行 > 环境变量 > yiju.conf > 默认值");
            return b.ToString();
        }
    }
}
