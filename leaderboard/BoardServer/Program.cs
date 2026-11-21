using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;

public static class BoardProgram
{
    private static readonly object Sync = new object();
    private static readonly Dictionary<string, Dictionary<string, object>> Halls =
        new Dictionary<string, Dictionary<string, object>>();
    private static string File = "halls.json";

    public static void Main(string[] args)
    {
        string url = null;
        for (int i = 0; i < args.Length; i++)
        {
            if ((args[i] == "--url" || args[i] == "-u") && i + 1 < args.Length) url = args[++i];
            else if (args[i].StartsWith("--url=")) url = args[i].Substring(6);
        }
        if (string.IsNullOrEmpty(url)) url = Environment.GetEnvironmentVariable("BOARD_URL") ?? "http://0.0.0.0:5090";

        Load();
        WebApplicationBuilder b = WebApplication.CreateBuilder(args);
        b.WebHost.UseUrls(url);
        WebApplication app = b.Build();

        app.MapGet("/health", () => Results.Text("{\"ok\":true,\"protocol\":\"yiju-hall/1\",\"halls\":" + Halls.Count + "}",
            "application/json; charset=utf-8", Encoding.UTF8));

        app.MapGet("/halls.json", () =>
        {
            lock (Sync)
            {
                long cutoff = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - 7 * 86400;
                object[] rows = Halls.Values
                    .Where(h => Convert.ToInt64(Get(h, "ts", 0)) >= cutoff)
                    .OrderByDescending(h => Convert.ToInt32(Get(h, "sessions7d", 0)))
                    .Take(200).Cast<object>().ToArray();
                return Results.Text(JsonSerializer.Serialize(rows), "application/json; charset=utf-8", Encoding.UTF8);
            }
        });

        app.MapPost("/post", async (HttpContext c) =>
        {
            try
            {
                using (StreamReader rd = new StreamReader(c.Request.Body, Encoding.UTF8))
                {
                    string raw = await rd.ReadToEndAsync();
                    if (raw.Length > 8192) { c.Response.StatusCode = 413; return; }
                    Dictionary<string, object> d = JsonSerializer.Deserialize<Dictionary<string, object>>(raw);
                    string fp = Get(d, "fp", "") as string ?? "";
                    if (fp.Length < 8 || fp.Length > 64) { c.Response.StatusCode = 400; await c.Response.WriteAsync("bad fp"); return; }
                    if ((Get(d, "protocol", "") as string ?? "") != "yiju-hall/1") { c.Response.StatusCode = 400; return; }
                    d["ts"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                    lock (Sync) { Halls[fp] = d; Save(); }
                    c.Response.StatusCode = 200;
                    await c.Response.WriteAsync("ok");
                }
            }
            catch (Exception) { c.Response.StatusCode = 400; await c.Response.WriteAsync("bad json"); }
        });

        Console.WriteLine("[奕局目录] " + url + " · 现有 " + Halls.Count + " 馆");
        app.Run();
    }

    private static object Get(Dictionary<string, object> d, string k, object def)
    {
        object o;
        if (d == null || !d.TryGetValue(k, out o) || o == null) return def;
        if (o is JsonElement e)
        {
            if (e.ValueKind == JsonValueKind.String) return e.GetString();
            if (e.ValueKind == JsonValueKind.Number) { long n; return e.TryGetInt64(out n) ? n : 0; }
            return def;
        }
        return o;
    }
    private static void Load()
    {
        try
        {
            if (!System.IO.File.Exists(File)) return;
            List<Dictionary<string, object>> a =
                JsonSerializer.Deserialize<List<Dictionary<string, object>>>(System.IO.File.ReadAllText(File, Encoding.UTF8));
            if (a == null) return;
            foreach (Dictionary<string, object> d in a)
            {
                string fp = Get(d, "fp", "") as string ?? "";
                if (fp.Length >= 8) Halls[fp] = d;
            }
        }
        catch (Exception) { }
    }
    private static void Save()
    {
        try { System.IO.File.WriteAllText(File, JsonSerializer.Serialize(Halls.Values.ToArray()), Encoding.UTF8); }
        catch (Exception) { }
    }
}
