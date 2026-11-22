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
using System.Diagnostics;

namespace Qipai
{

    public static class Program
    {
        public static void Main(string[] args)
        {
            WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

            StartupOptions opt = StartupOptions.Load(args, Directory.GetCurrentDirectory(),
                Environment.GetEnvironmentVariable);
            if (opt.Help) { Console.WriteLine(Startup.HelpText()); return; }
            if (opt.Version) { Console.WriteLine("弈局棋馆 " + Startup.VERSION + " · " + Startup.LICENSE); return; }
            string root = Startup.EnsureLayout(opt.Root, opt);
            opt.Root = root;
            string url = opt.EffectiveUrl();
            builder.WebHost.UseUrls(url);
            WebApplication app = builder.Build();

            Hub hub = new Hub();

            string contentRoot = root;
            LocalData.Init(contentRoot);
            if (opt.HallSet || opt.DirectorySet)
                LocalData.SetProfile(opt.HallSet ? opt.Hall : LocalData.HallName,
                    LocalData.DirectoryUrl, opt.DirectoryOn && LocalData.DirectoryOn);
            ScriptLibrary.Init(contentRoot);
            Accounts.Init(contentRoot);
            Console.WriteLine("[弈局] 棋馆：" + LocalData.HallName + " · 指纹 " + LocalData.HallFingerprint);
            Console.WriteLine("[弈局] 剧本库：" + ScriptLibrary.Count + " 个本（" + contentRoot + "/scripts）");
            Console.WriteLine("[弈局] 本机账号：" + Accounts.Count + " 个 · 加密存档在 " + contentRoot + "/data/saves/");
            Console.WriteLine("[弈局] 布局自检：" + (Startup.LayoutProblems(root).Length == 0 ? "齐备" : string.Join(",", Startup.LayoutProblems(root))));

            app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });

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
                return Results.Text(Startup.HealthJson(RuleRegistry.Count, Accounts.Count),
                    "application/json; charset=utf-8", Encoding.UTF8);
            });
            app.MapGet("/rules/manifest.json", delegate () { return JsonFile(root, "rules", "manifest.json"); });
            app.MapGet("/rules/vectors.json", delegate () { return JsonFile(root, "rules", "vectors.json"); });
            app.MapGet("/themes/themes.json", delegate () { return JsonFile(root, "themes", "themes.json"); });
            app.MapGet("/api/client-root", delegate () { return Results.Text(clientDir ?? "", "text/plain", Encoding.UTF8); });
            app.MapGet("/api/info", delegate ()
            {
                return Results.Text(Startup.InfoJson(RuleRegistry.Count, ScriptLibrary.Count,
                    LocalData.HallName, LocalData.HallFingerprint, LanAddresses(url),
                    LocalData.DirectoryOn, opt.TimeOn, opt.BoardsOn),
                    "application/json; charset=utf-8", Encoding.UTF8);
            });
            app.MapGet("/api/startup", delegate ()
            {
                return Results.Text("{\"ok\":true,\"version\":\"" + Startup.VERSION +
                    "\",\"license\":\"" + Startup.LICENSE + "\",\"config\":\"" +
                    Startup.Esc(opt.ConfigPath) + "\",\"url\":\"" + Startup.Esc(url) +
                    "\",\"summary\":\"" + Startup.Esc(opt.Summary()) + "\"}",
                    "application/json; charset=utf-8", Encoding.UTF8);
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
                    Console.WriteLine("[弈局] 棋馆目录：" + note);
                    LocalData.PushHall(out note);
                    Console.WriteLine("[弈局] 馆帖：" + note);
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
                        Console.WriteLine("[弈局] 目录刷新 / 馆帖：" + note);
                    }
                }
            });

            Console.WriteLine("弈局棋馆已启动：" + url + "  (谱页所在: " + (clientDir ?? "未找到") + ")");
            Console.Write(Startup.Hint(opt, root));
            Console.WriteLine("改配置：编辑 yiju.conf 后重跑，或 ./start.sh --port 9000 --no-directory");
            if (opt.OpenBrowser)
            {
                try { Process.Start(new ProcessStartInfo("http://localhost:" + opt.Port) { UseShellExecute = true }); }
                catch (Exception) { }
            }
            app.Run();
        }

        private static List<string> LanAddresses(string url)
        { return Startup.LanAddresses(url); }

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
