using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;

namespace Qipai
{

    public static class Program
    {
        public static void Main(string[] args)
        {
            WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

            string url = Environment.GetEnvironmentVariable("QIPAI_URL");
            for (int i = 0; i < args.Length; i++)
            {
                if ((args[i] == "--url" || args[i] == "-u") && i + 1 < args.Length) { url = args[++i]; continue; }
                if (args[i].StartsWith("--url=")) url = args[i].Substring(6);
            }
            if (string.IsNullOrEmpty(url)) url = "http://0.0.0.0:5080";
            builder.WebHost.UseUrls(url);
            WebApplication app = builder.Build();
            Hub hub = new Hub();

            string contentRoot = ContentRoot(app.Environment.ContentRootPath);
            LocalData.Init(contentRoot);
            ScriptLibrary.Init(contentRoot);
            Accounts.Init(contentRoot);
            Console.WriteLine("[奕局] 棋馆：" + LocalData.HallName + " · 指纹 " + LocalData.HallFingerprint);
            Console.WriteLine("[奕局] 剧本库：" + ScriptLibrary.Count + " 个本（" + contentRoot + "/scripts）");
            Console.WriteLine("[奕局] 本机账号：" + Accounts.Count + " 个 · 加密存档在 " + contentRoot + "/data/saves/");

            app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });

            string root = app.Environment.ContentRootPath;
            string clientDir = FirstDir(
                Path.Combine(root, "..", "client"),
                Path.Combine(root, "wwwroot"),
                Path.Combine(root, "..", "..", "client"));
            if (clientDir != null)
            {
                PhysicalFileProvider fp = new PhysicalFileProvider(clientDir);
                app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = fp });
                app.UseStaticFiles(new StaticFileOptions { FileProvider = fp });
            }

            app.MapGet("/api/health", delegate ()
            {
                return Results.Text("{\"ok\":true,\"games\":" + RuleRegistry.Count + ",\"accounts\":" + Accounts.Count +
                    ",\"protocol\":\"yiju-hall/1\"}", "application/json; charset=utf-8", Encoding.UTF8);
            });
            app.MapGet("/rules/manifest.json", delegate () { return JsonFile(root, "rules", "manifest.json"); });
            app.MapGet("/rules/vectors.json", delegate () { return JsonFile(root, "rules", "vectors.json"); });
            app.MapGet("/themes/themes.json", delegate () { return JsonFile(root, "themes", "themes.json"); });
            app.MapGet("/api/client-root", delegate () { return Results.Text(clientDir ?? "", "text/plain", Encoding.UTF8); });
            app.MapGet("/api/info", delegate ()
            {
                string addrs = "";
                List<string> la = LanAddresses(url);
                for (int i = 0; i < la.Count; i++)
                {
                    if (i > 0) addrs += ",";
                    addrs += "\"" + la[i] + "\"";
                }
                return Results.Text("{\"ok\":true,\"protocol\":\"yiju-hall/1\",\"games\":" + RuleRegistry.Count +
                    ",\"scripts\":" + ScriptLibrary.Count + ",\"hall\":\"" + LocalData.HallName +
                    "\",\"fp\":\"" + LocalData.HallFingerprint + "\",\"license\":\"PolyForm-Noncommercial-1.0.0\",\"addresses\":["
                    + addrs + "]}", "application/json; charset=utf-8", Encoding.UTF8);
            });

            app.MapGet("/ws", async delegate (HttpContext ctx)
            {
                if (!ctx.WebSockets.IsWebSocketRequest)
                {
                    ctx.Response.StatusCode = 400;
                    await ctx.Response.WriteAsync("WebSocket required");
                    return;
                }
                using (WebSocket ws = await ctx.WebSockets.AcceptWebSocketAsync())
                {
                    await hub.Accept(ws);
                }
            });

            _ = Task.Run(delegate ()
            {
                if (LocalData.DirectoryOn)
                {
                    string note;
                    List<string> la = LanAddresses(url);
                    string ws = la.Count > 0 ? "ws://" + la[0] : "";
                    LocalData.SetSelf(ws, 0, 0, ScriptLibrary.Count);
                    LocalData.PullDirectory("", out note);
                    Console.WriteLine("[奕局] 棋馆目录：" + note);
                    LocalData.PushHall(out note);
                    Console.WriteLine("[奕局] 馆帖：" + note);
                }
            });

            _ = Task.Run(async delegate ()
            {
                int tick = 0;
                while (true)
                {
                    await Task.Delay(1000);
                    List<KeyValuePair<Player, object>> frames = new List<KeyValuePair<Player, object>>();
                    hub.Tick(frames);
                    await hub.Flush(frames);
                    tick++;
                    if (tick % 3600 == 0 && LocalData.DirectoryOn)
                    {
                        string note;
                        List<string> la = LanAddresses(url);
                        LocalData.SetSelf(la.Count > 0 ? "ws://" + la[0] : "",
                            hub.OnlineCount, hub.RoomCount, ScriptLibrary.Count);
                        LocalData.PullDirectory("", out note);
                        LocalData.PushHall(out note);
                        Console.WriteLine("[奕局] 目录刷新 / 馆帖：" + note);
                    }
                }
            });

            Console.WriteLine("奕局棋馆已启动：" + url + "  (谱页所在: " + (clientDir ?? "未找到") + ")");
            Console.WriteLine("手机 / APK 在「04 设置 → 棋馆地址」填下面任一地址即可：");
            List<string> lan = LanAddresses(url);
            for (int i = 0; i < lan.Count; i++) Console.WriteLine("    " + lan[i]);
            Console.WriteLine("改监听地址：dotnet run --project server -- --url http://0.0.0.0:9000");
            app.Run();
        }

        private static List<string> LanAddresses(string url)
        {
            List<string> r = new List<string>();
            string port = "5080";
            int idx = url.LastIndexOf(':');
            if (idx >= 0 && idx < url.Length - 1)
            {
                string tail = url.Substring(idx + 1).TrimEnd('/');
                int p;
                if (int.TryParse(tail, out p)) port = p.ToString();
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

        private static string ContentRoot(string root)
        {
            string[] cand = { root, Path.GetFullPath(Path.Combine(root, "..")),
                Path.GetFullPath(Path.Combine(root, "..", "..")), Environment.CurrentDirectory };
            for (int i = 0; i < cand.Length; i++)
            {
                try
                {
                    if (Directory.Exists(Path.Combine(cand[i], "scripts")) ||
                        Directory.Exists(Path.Combine(cand[i], "client"))) return cand[i];
                }
                catch (Exception) { }
            }
            return root;
        }

        private static string FirstDir(params string[] paths)
        {
            for (int i = 0; i < paths.Length; i++)
            {
                try
                {
                    string p = Path.GetFullPath(paths[i]);
                    if (Directory.Exists(p) && File.Exists(Path.Combine(p, "index.html"))) return p;
                }
                catch (Exception) { }
            }
            return null;
        }

        private static IResult JsonFile(string root, string dir, string name)
        {
            string[] candidates = new string[] {
                Path.Combine(root, "..", dir, name),
                Path.Combine(root, dir, name),
                Path.Combine(root, "..", "..", dir, name)
            };
            for (int i = 0; i < candidates.Length; i++)
            {
                try
                {
                    string p = Path.GetFullPath(candidates[i]);
                    if (File.Exists(p)) return Results.Text(File.ReadAllText(p), "application/json; charset=utf-8", Encoding.UTF8);
                }
                catch (Exception) { }
            }
            return Results.NotFound();
        }
    }
}
