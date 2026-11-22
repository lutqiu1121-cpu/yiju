using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Qipai
{
    public sealed class Player
    {
        public int Id;
        public string Token = "";
        public string Name = "";
        public WebSocket Ws;
        public readonly SemaphoreSlim SendLock = new SemaphoreSlim(1, 1);
        public Room Room;
        public int Seat = -1;
        public bool Spectating = false;
        public bool Online = true;
        public long LastSeen;
        public long LastChatAt = 0;
        public long ClientSeq = 0;
        public string AccountId = "";
    }

    public sealed class Stats
    {
        public int Plays = 0, Wins = 0, Streak = 0;
        public string LastDay = "";
    }

    public sealed class Hub
    {
        private readonly object sync = new object();
        private readonly Dictionary<int, Player> players = new Dictionary<int, Player>();
        private readonly Dictionary<string, Room> rooms = new Dictionary<string, Room>();
        private readonly Dictionary<string, Player> tokenIndex = new Dictionary<string, Player>();
        private readonly Dictionary<string, Queue<Player>> matchQueue = new Dictionary<string, Queue<Player>>();
        private readonly Dictionary<string, long> matchSince = new Dictionary<string, long>();
        private readonly Dictionary<string, long> chatVer = new Dictionary<string, long>();
        private readonly Dictionary<string, Stats> stats = new Dictionary<string, Stats>();
        private const long MATCH_BOT_WAIT = 8000;
        private int nextId = 1;
        private int nextSeed = 1;

        public static long Now
        {
            get { return DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond; }
        }

        private Dictionary<string, object> Welcome(Player p, bool reconnected)
        {
            Dictionary<string, object> d = J.Frame("t", "welcome", "id", p.Id,
                "token", p.Token, "name", p.Name, "reconnected", reconnected,
                "serverTime", Now, "games", RuleRegistry.Count,
                "hall", J.Frame("fp", LocalData.HallFingerprint, "name", LocalData.HallName,
                    "directoryOn", LocalData.DirectoryOn, "directory", LocalData.DirectoryUrl,
                    "scripts", ScriptLibrary.Count, "protocol", "yiju-hall/1"),
                "account", string.IsNullOrEmpty(p.AccountId) ? null : Accounts.State(p.AccountId),
                "titleCatalog", TitleBook.Catalog(),
                "rankCatalog", TitleBook.RankCatalog(),
                "season", SeasonAuthority.Key(),
                "seasonName", SeasonCalendar.Name(SeasonAuthority.Key()),
                "seasonSpan", SeasonCalendar.Span(SeasonAuthority.Key()),
                "seasonVerified", SeasonAuthority.Verified,
                "seasonSource", SeasonAuthority.Source);
            return d;
        }

        public int OnlineCount { get { lock (sync) return players.Count; } }
        public int RoomCount { get { lock (sync) return rooms.Count; } }
        private Player FindByPid(int pid)
        {
            lock (sync) { Player p; players.TryGetValue(pid, out p); return p; }
        }

        public IEnumerable<Player> PlayersInRoom(Room r)
        {
            foreach (KeyValuePair<int, Player> kv in players)
                if (kv.Value.Room == r && kv.Value.Online) yield return kv.Value;
        }

        public async Task Accept(WebSocket ws)
        {
            Player p;
            lock (sync)
            {
                p = new Player { Id = nextId++, Ws = ws, Name = "访客", Token = NewToken(), LastSeen = Now };
                players[p.Id] = p; tokenIndex[p.Token] = p;
            }
            await Send(p, Welcome(p, false));

            byte[] buf = new byte[8192];
            try
            {
                while (ws.State == WebSocketState.Open)
                {
                    WebSocketReceiveResult res;
                    using (System.IO.MemoryStream ms = new System.IO.MemoryStream())
                    {
                        do
                        {
                            res = await ws.ReceiveAsync(new ArraySegment<byte>(buf), CancellationToken.None);
                            if (res.MessageType == WebSocketMessageType.Close) return;
                            ms.Write(buf, 0, res.Count);
                        } while (!res.EndOfMessage);
                        string text = Encoding.UTF8.GetString(ms.ToArray());
                        Dictionary<string, object> m = J.Parse(text);
                        p = await Handle(p, m);
                    }
                }
            }
            catch (Exception) {  }
            finally
            {
                lock (sync)
                {
                    if (p.Online)
                    {
                        p.Online = false; p.LastSeen = Now;
                        if (p.Room != null && p.Seat >= 0 && p.Seat < p.Room.Seats.Length && p.Room.Seats[p.Seat].Pid == p.Id)
                        {
                            p.Room.Seats[p.Seat].Online = false;
                            p.Room.PresenceVersion++;
                        }
                    }
                }
            }
        }

        private async Task<Player> Handle(Player p, Dictionary<string, object> m)
        {
            List<KeyValuePair<Player, object>> outFrames = new List<KeyValuePair<Player, object>>();
            lock (sync)
            {
                if (p.Online) p.LastSeen = Now;
                long cs = J.Int(m, "seq", 0);
                if (cs > 0) p.ClientSeq = cs;
                Process(ref p, m, outFrames);
                if (p.Room != null && p.Seat >= 0 && p.Seat < p.Room.Seats.Length && p.Room.Seats[p.Seat].Pid == p.Id)
                    p.Room.Seats[p.Seat].LastSeen = Now;
            }
            for (int i = 0; i < outFrames.Count; i++) await Send(outFrames[i].Key, outFrames[i].Value);
            return p;
        }

        private void Process(ref Player p, Dictionary<string, object> m, List<KeyValuePair<Player, object>> outFrames)
        {
            string t = J.Str(m, "t", "");
            if (t == "hello")
            {
                string token = J.Str(m, "token", "");
                string name = J.Str(m, "name", "");
                if (token.Length > 0 && tokenIndex.ContainsKey(token))
                {
                    Player old = tokenIndex[token];
                    if (old != p)
                    {
                        old.Ws = p.Ws; old.Online = true; old.LastSeen = Now;

                        if (name.Length > 0 && old.AccountId.Length == 0) old.Name = name;
                        players.Remove(p.Id);
                        tokenIndex.Remove(p.Token);
                        p = old;
                        if (p.Room != null && p.Seat >= 0 && p.Seat < p.Room.Seats.Length && p.Room.Seats[p.Seat].Pid == p.Id)
                        { p.Room.Seats[p.Seat].Online = true; p.Room.PresenceVersion++; }
                    }
                }
                else if (name.Length > 0) p.Name = name;
                outFrames.Add(new KeyValuePair<Player, object>(p, Welcome(p, p.Room != null)));
                if (p.Room != null)
                {
                    chatVer[p.Room.Id] = p.Room.ChatVersion;
                    p.Room.Collect(outFrames, new HashSet<int> { p.Id });
                }
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "rooms", "list", RoomsList())));
                return;
            }
            if (t == "wearTitle")
            {
                bool okWear = Accounts.SetWorn(p.AccountId, J.Str(m, "key", ""));
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "accountState",
                    "ok", true, "name", p.Name, "save",
                    string.IsNullOrEmpty(p.AccountId) ? null : Accounts.State(p.AccountId))));
                if (!okWear) outFrames.Add(Err(p, "此衔尚未得，或不在席上"));
                return;
            }
            if (t == "season")
            {
                string mode = J.Str(m, "mode", "local");
                long ts = J.Int(m, "ts", 0);
                object[] proof = m.ContainsKey("proof") ? m["proof"] as object[] : null;
                string note;
                bool ok = SeasonAuthority.Accept(mode, ts, proof, out note);
                string key = SeasonAuthority.Key();
                Dictionary<string, object> sf = J.Frame("t", "season", "key", key,
                    "name", SeasonCalendar.Name(key), "span", SeasonCalendar.Span(key),
                    "verified", SeasonAuthority.Verified, "source", SeasonAuthority.Source,
                    "ok", ok, "note", note);
                foreach (KeyValuePair<int, Player> kv in players)
                    outFrames.Add(new KeyValuePair<Player, object>(kv.Value, sf));
                return;
            }
            if (t == "shop" || t == "shopBuy" || t == "shopWear")
            {
                Dictionary<string, object> st;
                string e = "";
                if (t == "shop") st = Accounts.ShopState(p.AccountId);
                else if (t == "shopBuy") st = Accounts.ShopBuy(p.AccountId, J.Str(m, "key", ""), out e);
                else
                {
                    st = Accounts.ShopWear(p.AccountId, J.Str(m, "key", ""), J.Str(m, "kind", ""), out e);
                }
                if (st == null) { outFrames.Add(Err(p, e.Length > 0 ? e : "妆奁未成")); return; }
                st["t"] = "shopState";
                outFrames.Add(new KeyValuePair<Player, object>(p, st));
                return;
            }
            if (t == "ping")
            {
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "pong", "ts", J.Str(m, "ts", ""), "serverTime", Now)));
                return;
            }
            if (t == "accountRegister" || t == "accountLogin")
            {
                string name = J.Str(m, "name", ""), pass = J.Str(m, "password", "");
                string error; Dictionary<string, object> save;
                string id = t == "accountRegister"
                    ? Accounts.Register(name, pass, out error, out save)
                    : Accounts.Login(name, pass, out error, out save);
                if (id.Length == 0) { outFrames.Add(Err(p, error)); return; }
                p.AccountId = id;
                if (name.Trim().Length > 0) p.Name = name.Trim();
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "account",
                    "ok", true, "id", id, "name", name.Trim(), "save", save,
                    "note", t == "accountRegister" ? "账号已建好，加密存档也自动生成了" : "欢迎回来，存档已读取")));
                return;
            }
            if (t == "accountLogout")
            {
                p.AccountId = "";
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "account", "ok", false)));
                return;
            }
            if (t == "accountState" || t == "accountSave")
            {
                Dictionary<string, object> sv = string.IsNullOrEmpty(p.AccountId) ? null : Accounts.State(p.AccountId);
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "account",
                    "ok", !string.IsNullOrEmpty(p.AccountId), "id", p.AccountId,
                    "name", sv == null ? "" : J.Str(sv, "name", ""), "save", sv)));
                return;
            }
            if (t == "accountExport")
            {
                string error, file;
                string data = Accounts.Export(p.AccountId, J.Str(m, "password", ""), out error, out file);
                if (data.Length == 0) { outFrames.Add(Err(p, error)); return; }
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "save",
                    "data", data, "name", file)));
                return;
            }
            if (t == "accountImport")
            {
                string error; Dictionary<string, object> save;
                string id = Accounts.Import(J.Str(m, "name", ""), J.Str(m, "password", ""),
                    J.Str(m, "data", ""), out error, out save);
                if (id.Length == 0) { outFrames.Add(Err(p, error)); return; }
                p.AccountId = id;
                string nm = J.Str(m, "name", "").Trim(); if (nm.Length > 0) p.Name = nm;
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "account",
                    "ok", true, "id", id, "name", nm, "save", save,
                    "note", "口令核验通过，谱已入本馆")));
                return;
            }
            if (t == "scripts")
            {
                ScriptLibrary.Reload();
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "scripts",
                    "list", ScriptLibrary.List(), "count", ScriptLibrary.Count,
                    "stamp", ScriptLibrary.Stamp)));
                return;
            }
            if (t == "scriptImport")
            {
                Room sr = p.Room;
                if (sr == null || p.Seat != 0) { outFrames.Add(Err(p, "只有房主能现场导入剧本")); return; }
                if (sr.Started) { outFrames.Add(Err(p, "已开枰，散席后再呈本")); return; }
                string error;
                Dictionary<string, object> sc = ScriptLibrary.Import(J.Str(m, "raw", ""), out error);
                if (sc == null) { outFrames.Add(Err(p, error)); return; }
                ScriptLibrary.PutRoom(sr.Id, sc);
                sr.SaySys("房主现场导入了剧本「" + J.Str(sc, "name", "现场本") + "」（只在本房有效）");
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "note",
                    "text", "已导入「" + J.Str(sc, "name", "现场本") + "」，选「现场导入」开局即可")));
                sr.Collect(outFrames, null);
                return;
            }
            if (t == "board")
            {
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "board",
                    "rows", LocalData.Leaderboard(), "hall", LocalData.HallName)));
                return;
            }
            if (t == "halls")
            {
                object[] halls;
                LocalData.LocalHallList(out halls);
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "halls",
                    "list", halls, "age", LocalData.DirectoryAgeSec(),
                    "on", LocalData.DirectoryOn, "url", LocalData.DirectoryUrl,
                    "self", LocalData.HallFingerprint)));
                return;
            }
            if (t == "hallPull")
            {
                string note;
                LocalData.PullDirectory(J.Str(m, "url", ""), out note);
                object[] halls; LocalData.LocalHallList(out halls);
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "halls",
                    "list", halls, "age", LocalData.DirectoryAgeSec(), "on", LocalData.DirectoryOn,
                    "url", LocalData.DirectoryUrl, "self", LocalData.HallFingerprint, "note", note)));
                return;
            }
            if (t == "profile")
            {
                LocalData.SetProfile(J.Str(m, "name", ""), J.Str(m, "url", ""), J.Bool(m, "on", true));
                outFrames.Add(new KeyValuePair<Player, object>(p, Welcome(p, false)));
                return;
            }
            if (t == "rooms")
            {
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "rooms", "list", RoomsList())));
                return;
            }
            if (t == "stats")
            {
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "stats", "stats", StatsOf(p.Token))));
                return;
            }
            if (t == "create") { Create(p, m, outFrames); return; }
            if (t == "join") { Join(p, m, outFrames); return; }
            if (t == "spectate") { Spectate(p, m, outFrames); return; }
            if (t == "match") { Match(p, m, outFrames); return; }
            if (t == "leave") { Leave(p, outFrames); return; }
            if (t == "sync")
            {
                if (p.Room != null)
                {
                    chatVer[p.Room.Id] = p.Room.ChatVersion;
                    p.Room.Collect(outFrames, new HashSet<int> { p.Id });
                }
                return;
            }

            Room r = p.Room;
            if (r == null) { outFrames.Add(Err(p, "尚未入席")); return; }
            if (t == "replay")
            {
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame(
                    "t", "replay", "start", r.ReplayStart ?? new Dictionary<string, object>(),
                    "frames", r.ReplayFrames.ToArray(), "meta", r.Meta())));
                return;
            }
            if (t == "ready")
            {
                if (p.Seat < 0 || p.Seat >= r.Seats.Length) { outFrames.Add(Err(p, "旁观者无需整襟")); return; }
                r.Seats[p.Seat].Ready = J.Bool(m, "v", true);
                r.PresenceVersion++;
                r.SaySys(p.Name + (r.Seats[p.Seat].Ready ? " 已整襟" : " 收起整襟"));
                if (r.ReadyAll()) r.Start();
                r.Collect(outFrames, null);
                return;
            }
            if (t == "start")
            {
                if (p.Seat != 0) { outFrames.Add(Err(p, "唯设席者可开枰")); return; }
                if (r.SeatCount() < r.Rule.MinSeats) { outFrames.Add(Err(p, "席未足 " + r.Rule.MinSeats + " 人")); return; }
                r.Start(); r.Collect(outFrames, null);
                return;
            }
            if (t == "move")
            {
                string code = J.Str(m, "code", "");
                string err = r.DoMove(p, code);
                if (err.Length > 0) { outFrames.Add(Err(p, err)); return; }

                if (code.StartsWith("say:") && code.Length > 4)
                {
                    string text = code.Substring(4);
                    if (text.Length > 120) text = text.Substring(0, 120);
                    Dictionary<string, object> c = J.Frame("name", p.Name, "seat", p.Seat,
                        "spectator", false, "text", text, "ts", Now);
                    r.Chat.Add(c); if (r.Chat.Count > 60) r.Chat.RemoveAt(0);
                    r.ChatVersion++; chatVer[r.Id] = r.ChatVersion;
                    foreach (Player q in PlayersInRoom(r))
                        outFrames.Add(new KeyValuePair<Player, object>(q, J.Frame("t", "chat", "msg", c)));
                }
                r.Collect(outFrames, null);
                return;
            }
            if (t == "chat")
            {
                if (p.Spectating && !r.Opt.SpectatorChat)
                { outFrames.Add(Err(p, "此席旁观者缄口")); return; }
                string text = J.Str(m, "text", "").Trim();
                if (text.Length > 0)
                {
                    if (Now - p.LastChatAt < 700) { outFrames.Add(Err(p, "落语太疾，稍候")); return; }
                    p.LastChatAt = Now;
                    Dictionary<string, object> c = J.Frame(
                        "name", p.Name, "seat", p.Seat, "spectator", p.Spectating,
                        "text", text.Length > 200 ? text.Substring(0, 200) : text, "ts", Now);
                    r.Chat.Add(c); if (r.Chat.Count > 60) r.Chat.RemoveAt(0);
                    r.ChatVersion++; chatVer[r.Id] = r.ChatVersion;
                    foreach (Player q in PlayersInRoom(r))
                        outFrames.Add(new KeyValuePair<Player, object>(q, J.Frame("t", "chat", "msg", c)));
                }
                return;
            }
            if (t == "typing")
            {

                bool on = J.Bool(m, "v", true);
                foreach (Player q in PlayersInRoom(r))
                    if (q != p) outFrames.Add(new KeyValuePair<Player, object>(q, J.Frame(
                        "t", "typing", "seat", p.Seat, "name", p.Name, "v", on)));
                return;
            }
            if (t == "act") { Act(p, r, J.Str(m, "a", ""), m, outFrames); return; }
            outFrames.Add(Err(p, "不识此令"));
        }

        private void Act(Player p, Room r, string a, Dictionary<string, object> m, List<KeyValuePair<Player, object>> outFrames)
        {
            if (a == "resign")
            {
                if (p.Seat < 0) { outFrames.Add(Err(p, "旁观者不可投子")); return; }
                string w = "";
                for (int i = 0; i < r.Seats.Length; i++) if (i != p.Seat && r.Seats[i].Pid != 0) { w = i.ToString(CultureInfo.InvariantCulture); break; }
                r.SetEnd(w, p.Name + " 投子"); r.Collect(outFrames, null); return;
            }
            if (a == "draw")
            {
                if (!r.Opt.AllowDraw) { outFrames.Add(Err(p, "此席不允请和")); return; }
                r.DrawYes.Add(p.Seat);
                int need = 0; for (int i = 0; i < r.Seats.Length; i++) if (r.Seats[i].Pid != 0) need++;
                if (r.DrawYes.Count >= need) r.SetEnd("", "诸席允和");
                else { r.SaySys(p.Name + " 请求求和，等待其他人同意"); r.Collect(outFrames, null); }
                return;
            }
            if (a == "undo")
            {
                if (!r.Opt.AllowUndo) { outFrames.Add(Err(p, "此席不允乞复")); return; }
                string err = r.RequestUndo(p);
                if (err.Length > 0) { outFrames.Add(Err(p, err)); return; }
                foreach (Player q in PlayersInRoom(r))
                    if (q.Seat != p.Seat && !q.Spectating)
                        outFrames.Add(new KeyValuePair<Player, object>(q, J.Frame("t", "undoAsk", "by", p.Name, "seat", p.Seat)));
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "note", "text", "乞复之请已达")));
                return;
            }
            if (a == "undoYes" || a == "undoNo")
            {
                if (r.UndoAsker < 0) return;
                if (a == "undoNo") { r.UndoAsker = -1; r.UndoYes.Clear(); r.UndoDenied = true; r.SaySys("乞复未允"); r.Collect(outFrames, null); return; }
                r.UndoYes.Add(p.Seat);
                int need = 0; for (int i = 0; i < r.Seats.Length; i++) if (r.Seats[i].Pid != 0) need++;
                if (r.UndoYes.Count >= need) { r.ApplyUndo(); r.UndoAsker = -1; r.Collect(outFrames, null); }
                return;
            }
            if (a == "setBotLevel")
            {
                if (p.Seat != 0) { outFrames.Add(Err(p, "只有房主可以调隐士棋力")); return; }
                r.BotLevel = Math.Max(0, Math.Min(9, J.Int(m, "v", 0)));
                string[] lvName = { "随性", "试探", "进取", "老成", "谋势", "精算", "通玄", "入微", "忘机", "弈圣" };
                r.SaySys("隐士棋力调整为 " + lvName[Math.Max(0, Math.Min(9, r.BotLevel))]);
                r.Collect(outFrames, ForceAll(r));
                return;
            }
            if (a == "export")
            {
                if (r.S == null) { outFrames.Add(Err(p, "还没开局，没有棋谱")); return; }
                object[] moves = new object[r.ReplayFrames.Count];
                for (int i = 0; i < r.ReplayFrames.Count; i++) moves[i] = r.ReplayFrames[i];
                outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "record",
                    "game", r.Game, "variant", r.Variant, "room", r.Id,
                    "start", r.ReplayStart ?? new Dictionary<string, object>(), "frames", moves)));
                return;
            }
            if (a == "addBot" || a == "removeBot" || a == "fillBots")
            {
                if (p.Seat != 0) { outFrames.Add(Err(p, "只有房主可以调整隐士")); return; }
                if (r.Started) { outFrames.Add(Err(p, "已开枰，隐士不可再调")); return; }
                if (a == "addBot") r.AddBots(1);
                else if (a == "removeBot") { if (!r.RemoveBot()) { outFrames.Add(Err(p, "没有隐士可移除")); return; } }
                else r.FillBotsTo(J.Int(m, "to", r.MaxSeats));
                r.Collect(outFrames, ForceAll(r));
                return;
            }
            if (a == "kick" || a == "swap" || a == "sit")
            {
                if (p.Seat != 0 && a != "sit") { outFrames.Add(Err(p, "只有房主可以操作座位")); return; }
                int seat = J.Int(m, "seat", -1), seat2 = J.Int(m, "seat2", -1);
                if (a == "kick" && seat >= 0 && seat < r.Seats.Length && seat != 0 && r.Seats[seat].Pid != 0)
                {
                    int pid = r.Seats[seat].Pid;
                    Player target;
                    if (players.TryGetValue(pid, out target)) { target.Room = null; target.Seat = -1; }
                    r.Leave(seat); r.SaySys("座位 " + seat + " 已离席");
                }
                else if (a == "swap" && seat >= 0 && seat2 >= 0 && seat < r.Seats.Length && seat2 < r.Seats.Length)
                {
                    Seat tmp = r.Seats[seat]; r.Seats[seat] = r.Seats[seat2]; r.Seats[seat2] = tmp;
                    foreach (Player q in PlayersInRoom(r)) { if (q.Seat == seat) q.Seat = seat2; else if (q.Seat == seat2) q.Seat = seat; }
                    r.SaySys("座位 " + seat + " 与 " + seat2 + " 已互换");
                }
                else if (a == "sit" && seat >= 0 && seat < r.Seats.Length && r.Seats[seat].Pid == 0)
                {
                    if (r.Started) { outFrames.Add(Err(p, "已开枰，席已封，可旁观")); return; }
                    int got = r.AddSeat(p, seat);
                    if (got < 0) { outFrames.Add(Err(p, "该席位已封存")); return; }
                    if (p.Seat >= 0 && p.Seat < r.Seats.Length) r.Leave(p.Seat);
                    p.Seat = got;
                    p.Spectating = false;
                    r.Spectators.Remove(p.Id);
                }
                else { outFrames.Add(Err(p, "座位操作无效")); return; }
                r.PresenceVersion++;
                r.Collect(outFrames, ForceAll(r));
                return;
            }
            outFrames.Add(Err(p, "未知操作"));
        }

        private HashSet<int> ForceAll(Room r)
        {
            HashSet<int> h = new HashSet<int>();
            foreach (Player q in PlayersInRoom(r)) h.Add(q.Id);
            return h;
        }

        private static Dictionary<string, object> _cats = null;
        private Dictionary<string, object> ManifestCats()
        {
            if (_cats != null) return _cats;
            _cats = new Dictionary<string, object>();
            string[] chess = { "xiangqi","jieqi","xiangqidark","chess","chess960","go","gomoku","renju","connect6","connect4","othello","checkers","junqi","doushou","tiaogi","mills","shogi","tictactoe","dots","hex","nim","endgame","junqi4","diefeng" };
            string[] card = { "doudizhu","doudizhu2","laizi","guandan","shengji","paodekuai","gongzhu","hongshi","shisanszhang","uno","bridge","mahjong","gouji","baohuang","chudadi","shuangkou","yijuan" };
            for (int i = 0; i < chess.Length; i++) _cats[chess[i]] = "chess";
            for (int i = 0; i < card.Length; i++) _cats[card[i]] = "card";
            _cats["feixingqi"] = "party"; _cats["monopoly"] = "party"; _cats["werewolf"] = "party";
            _cats["undercover"] = "party"; _cats["point24"] = "party"; _cats["solitaire"] = "party";
            _cats["avalon"] = "party"; _cats["turtlesoup"] = "party";
            _cats["mastermind"] = "party"; _cats["drawguess"] = "party"; _cats["juben"] = "party";
            string[] orig7 = { "houlou","duzhou","dengying","huiwen","cuojin","shiyi","tingyu" };
            for (int q = 0; q < orig7.Length; q++)
                _cats[orig7[q]] = orig7[q] == "tingyu" ? "party" : (orig7[q] == "shiyi" ? "card" : "chess");
            _cats["tournament"] = "party";
            return _cats;
        }
        public static string CatOf(string game)
        {
            string[] chess = { "xiangqi","jieqi","xiangqidark","chess","chess960","go","gomoku","renju","connect6","connect4","othello","checkers","junqi","doushou","tiaogi","mills","shogi","tictactoe","dots","hex","nim","endgame","junqi4","diefeng" };
            if (Array.IndexOf(chess, game) >= 0) return "chess";
            string[] card = { "doudizhu","doudizhu2","laizi","guandan","shengji","paodekuai","gongzhu","hongshi","shisanszhang","uno","bridge","mahjong","gouji","baohuang","chudadi","shuangkou","yijuan" };
            if (Array.IndexOf(card, game) >= 0) return "card";
            if (game == "shiyi") return "card";
            if (game == "tingyu") return "party";
            if (game == "houlou" || game == "duzhou" || game == "dengying" || game == "huiwen" || game == "cuojin") return "chess";
            return "party";
        }

        private void Create(Player p, Dictionary<string, object> m, List<KeyValuePair<Player, object>> outFrames)
        {
            string game = J.Str(m, "game", "xiangqi");
            IGameRule rule = RuleRegistry.Get(game) ?? RuleRegistry.Fallback;
            string variant = J.Str(m, "variant", rule.Variants.Length > 0 ? rule.Variants[0] : "标准");

            if (rule.Variants.Length > 0 && Array.IndexOf(rule.Variants, variant) < 0)
            {
                if (game == "chudadi") variant = rule.Variants[0];
                else { outFrames.Add(Err(p, "这个玩法没有「" + variant + "」这个模式")); return; }
            }
            int seats = J.Int(m, "seats", 0);
            int max = seats > 0 ? Math.Min(rule.MaxSeats, Math.Max(rule.MinSeats, seats)) : Math.Max(rule.MinSeats, 2);

            if (game == "juben" && variant.Length > 0 && variant != "现场导入")
            {
                Dictionary<string, object> sc = ScriptLibrary.Get(variant);
                if (sc != null)
                {
                    int mn = J.Int(sc, "min", 0), mx = J.Int(sc, "max", 0);
                    if (mn > 0 && max < mn) max = Math.Min(rule.MaxSeats, mn);
                    if (mx > 0 && max > mx) max = Math.Max(rule.MinSeats, mx);
                }
            }
            string id = NewRoomId();
            string cat = "";
            foreach (KeyValuePair<string, object> cg in ManifestCats())
                if (Convert.ToString(cg.Key) == game) { cat = Convert.ToString(cg.Value); break; }
            RoomOptions opt = RoomOptions.Parse(m, game, cat);
            if (opt.RankMode == "hall" && string.IsNullOrEmpty(p.AccountId))
            { outFrames.Add(Err(p, "馆赛须先题名，方可计入本馆排位")); return; }

            long clock = opt.ClockMs;
            if (variant.IndexOf("快") >= 0) clock = Math.Max(5000, clock / 2);
            opt.ClockMs = clock;
            Room r = new Room(this, id, game, variant, max, clock, nextSeed++ + opt.SeedOffset, opt);
            string title = J.Str(m, "title", "").Trim();
            if (title.Length > 24) title = title.Substring(0, 24);
            r.Title = title;
            string pw = J.Str(m, "password", "").Trim();
            if (pw.Length > 24) pw = pw.Substring(0, 24);
            r.Password = pw;
            r.AllowSpectators = opt.AllowSpectators;
            r.BotLevel = opt.BotLevel;
            rooms[id] = r;
            Leave(p, null);
            p.Room = r; p.Spectating = false; p.Seat = r.AddSeat(p, 0);

            if (J.Bool(m, "fillBots", false)) r.FillBotsTo(max);
            else r.AddBots(J.Int(m, "bots", 0));
            r.SaySys(p.Name + " 设席" + (title.Length > 0 ? "「" + title + "」" : "") +
                (r.Password.Length > 0 ? " · 已设暗语" : "") + (r.BotCount() > 0 ? " · 隐士已补位" : ""));
            chatVer[id] = r.ChatVersion;
            outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "joined", "room", id, "seat", p.Seat, "spectating", false)));
            r.Collect(outFrames, new HashSet<int> { p.Id });
        }

        private void Join(Player p, Dictionary<string, object> m, List<KeyValuePair<Player, object>> outFrames)
        {
            string id = J.Str(m, "room", "").ToUpperInvariant();
            Room r;
            if (!rooms.TryGetValue(id, out r)) { outFrames.Add(Err(p, "此席不在：" + id)); return; }
            if (r.Password.Length > 0 && J.Str(m, "password", "") != r.Password)
            { outFrames.Add(Err(p, "暗语不合")); return; }
            if (r.Started && !r.AllowSpectators)
            { outFrames.Add(Err(p, "此席不设旁观，且已开枰")); return; }
            Leave(p, null);
            p.Room = r;
            int seat = r.AddSeat(p, J.Int(m, "seat", -1));
            bool late = r.Started && seat < 0;
            if (seat < 0)
            {
                if (!r.AllowSpectators) { outFrames.Add(Err(p, "此局不设旁观")); return; }
                p.Spectating = true; r.Spectators.Add(p.Id); p.Seat = -1;
            }
            else { p.Spectating = false; p.Seat = seat; }
            chatVer[r.Id] = r.ChatVersion;
            r.SaySys(p.Name + (p.Spectating
                ? (late ? " 入旁观（已开枰，席已封）" : " 入旁观")
                : " 入第 " + seat + " 席"));
            outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "joined", "room", id, "seat", p.Seat, "spectating", p.Spectating)));
            r.Collect(outFrames, ForceAll(r));
        }

        private void Spectate(Player p, Dictionary<string, object> m, List<KeyValuePair<Player, object>> outFrames)
        {
            Room r;
            if (!rooms.TryGetValue(J.Str(m, "room", "").ToUpperInvariant(), out r)) { outFrames.Add(Err(p, "此席不在")); return; }
            if (r.Password.Length > 0 && J.Str(m, "password", "") != r.Password)
            { outFrames.Add(Err(p, "暗语不合")); return; }
            if (!r.AllowSpectators) { outFrames.Add(Err(p, "此局不设旁观")); return; }
            Leave(p, null);
            p.Room = r; p.Spectating = true; p.Seat = -1; r.Spectators.Add(p.Id);
            chatVer[r.Id] = r.ChatVersion;
            r.PresenceVersion++;
            outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "joined", "room", r.Id, "seat", -1, "spectating", true)));
            r.Collect(outFrames, new HashSet<int> { p.Id });
        }

        private void Match(Player p, Dictionary<string, object> m, List<KeyValuePair<Player, object>> outFrames)
        {
            string game = J.Str(m, "game", "xiangqi");
            IGameRule rule = RuleRegistry.Get(game) ?? RuleRegistry.Fallback;
            string variant = J.Str(m, "variant", "");
            if (variant.Length > 0 && rule.Variants.Length > 0 && Array.IndexOf(rule.Variants, variant) < 0)
                variant = rule.Variants[0];
            string key = game + "|" + variant;
            Queue<Player> q;
            if (!matchQueue.TryGetValue(key, out q)) { q = new Queue<Player>(); matchQueue[key] = q; }

            Queue<Player> fresh = new Queue<Player>();
            foreach (Player x in q) if (x.Online && x.Room == null) fresh.Enqueue(x);
            matchQueue[key] = fresh; q = fresh;
            Leave(p, null);
            if (!q.Contains(p)) q.Enqueue(p);
            if (!matchSince.ContainsKey(key)) matchSince[key] = Now;
            if (q.Count >= rule.MinSeats) StartMatch(key, q, rule, variant, 0, outFrames);
            else outFrames.Add(new KeyValuePair<Player, object>(p, J.Frame("t", "note",
                "text", "匹配中… 还差 " + (rule.MinSeats - q.Count) + " 人；8 秒凑不齐会自动请隐士补位")));
        }

        private void StartMatch(string key, Queue<Player> q, IGameRule rule, string variant, int botFill,
            List<KeyValuePair<Player, object>> outFrames)
        {
            int human = Math.Min(q.Count, Math.Max(1, rule.MinSeats - botFill));
            List<Player> group = new List<Player>();
            for (int i = 0; i < human; i++) group.Add(q.Dequeue());
            string id = NewRoomId();
            Room r = new Room(this, id, rule.Id, variant, rule.MinSeats, 60000, nextSeed++);
            r.Title = botFill > 0 ? "寻局 · 隐士补位" : "寻局";
            rooms[id] = r;
            for (int i = 0; i < group.Count; i++)
            {
                Player g = group[i];
                g.Room = r; g.Spectating = false; g.Seat = r.AddSeat(g, i);
                outFrames.Add(new KeyValuePair<Player, object>(g, J.Frame("t", "joined",
                    "room", id, "seat", g.Seat, "spectating", false, "matched", true)));
            }
            r.AddBots(rule.MinSeats - group.Count);
            if (botFill > 0) r.SaySys("寻局候久，已邀 " + r.BotCount() + " 位隐士入席，开枰！");
            r.Start();
            chatVer[id] = r.ChatVersion;
            r.Collect(outFrames, ForceAll(r));
            matchSince.Remove(key);
        }

        private void Leave(Player p, List<KeyValuePair<Player, object>> outFrames)
        {
            Room r = p.Room;
            if (r != null)
            {
                if (p.Seat >= 0 && p.Seat < r.Seats.Length && r.Seats[p.Seat].Pid == p.Id)
                { r.Leave(p.Seat); r.SaySys(p.Name + " 离第 " + p.Seat); }
                r.Spectators.Remove(p.Id);
                r.PresenceVersion++;
                if (outFrames != null) r.Collect(outFrames, ForceAll(r));
            }
            p.Room = null; p.Seat = -1; p.Spectating = false;
        }

        private static KeyValuePair<Player, object> Err(Player p, string text)
        {
            return new KeyValuePair<Player, object>(p, J.Frame("t", "error", "text", text));
        }
        private object[] RoomsList()
        {
            List<object> list = new List<object>();
            foreach (KeyValuePair<string, Room> kv in rooms)
                list.Add(J.Frame("id", kv.Key, "game", kv.Value.Game, "variant", kv.Value.Variant,
                    "seats", kv.Value.SeatCount(), "max", kv.Value.MaxSeats, "started", kv.Value.Started,
                    "spectators", kv.Value.Spectators.Count,
                    "title", kv.Value.Title, "locked", kv.Value.Password.Length > 0,
                    "bots", kv.Value.BotCount(), "allowSpectators", kv.Value.AllowSpectators,
                    "need", Math.Max(0, kv.Value.Rule.MinSeats - kv.Value.SeatCount())));
            return list.ToArray();
        }
        private Dictionary<string, object> StatsOf(string token)
        {
            Stats s;
            if (!stats.TryGetValue(token, out s)) s = new Stats();
            return J.Frame("plays", s.Plays, "wins", s.Wins, "streak", s.Streak);
        }

        public void RecordEnd(Room r)
        {
            if (r.S == null || !r.S.Ended || r.RankRecorded) return;
            r.RankRecorded = true;
            string today = DateTime.UtcNow.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
            for (int i = 0; i < r.Seats.Length; i++)
            {
                Seat st = r.Seats[i];
                if (st.Pid == 0 || st.Token.Length == 0) continue;
                Stats s;
                if (!stats.TryGetValue(st.Token, out s)) { s = new Stats(); stats[st.Token] = s; }
                s.Plays++;
                string w = r.S.Winner ?? "";
                if (w.Length > 0 && w.Split(',').Contains(i.ToString(CultureInfo.InvariantCulture))) s.Wins++;
                if (s.LastDay != today)
                {
                    s.Streak = s.LastDay.Length == 0 ? 1 : s.Streak + 1;
                    s.LastDay = today;
                }
            }
            r.SaySys(r.S.Result);

            string winStr = r.S.Winner ?? "";
            for (int i = 0; i < r.Seats.Length; i++)
            {
                Seat st = r.Seats[i];
                if (st.Pid == 0 || st.Token.Length == 0 || st.Bot) continue;
                bool win = winStr.Length > 0 && winStr.Split(',').Contains(i.ToString(CultureInfo.InvariantCulture));
                LocalData.Record(st.Token, st.Name, r.Game, r.Variant, win);
                Player pl = FindByPid(st.Pid);
                if (pl != null && pl.AccountId.Length > 0)
                {
                    List<string> feats = new List<string>();
                    object fo;
                    if (r.S != null && r.S.V.TryGetValue("_feats", out fo))
                    {
                        string[] fa = fo as string[];
                        if (fa != null) feats.AddRange(fa);
                    }
                    Dictionary<string, object> raw = null;
                    object ro;
                    if (r.S != null && r.S.V.TryGetValue("_opt", out ro)) raw = ro as Dictionary<string, object>;
                    object stackOn; bool stacking = raw != null && raw.TryGetValue("stack", out stackOn) && Convert.ToBoolean(stackOn);
                    if (win && r.Game == "uno" && !stacking) feats.Add("no_stack");
                    if (win && r.UndoDenied) feats.Add("undo_denied_win");
                    if (win && i >= 0 && i < r.Clocks.Length && r.Clocks[i] > 0 && r.Clocks[i] < 5000)
                        feats.Add("long_think");
                    Accounts.Record(pl.AccountId, r.Game, r.Variant, win,
                        r.Game == "juben" ? r.Variant : "", feats.ToArray());
                    if (r.Opt != null && (r.Opt.RankMode == "hall" || r.Opt.RankMode == "local"))
                    {
                        bool draw = winStr.Length == 0;
                        int rate = r.Opt.RankMode == "local" ? 100 : r.Opt.RankRate;
                        Accounts.RecordRank(pl.AccountId, r.Game, win, draw, r.BotLevel, rate);
                    }
                }
            }
        }

        public void Tick(List<KeyValuePair<Player, object>> outFrames)
        {
            lock (sync)
            {
                long now = Now;
                List<string> dead = new List<string>();
                foreach (KeyValuePair<int, Player> kv in players)
                {
                    Player p = kv.Value;
                    if (p.Online && now - p.LastSeen > 35000)
                    {
                        p.Online = false;
                        if (p.Room != null && p.Seat >= 0 && p.Seat < p.Room.Seats.Length && p.Room.Seats[p.Seat].Pid == p.Id)
                        {
                            p.Room.Seats[p.Seat].Online = false;
                            p.Room.Seats[p.Seat].LastSeen = now;
                            p.Room.PresenceVersion++;
                        }
                    }
                }

                List<KeyValuePair<string, Queue<Player>>> queueUpdates = new List<KeyValuePair<string, Queue<Player>>>();
                List<string> emptyKeys = new List<string>();
                foreach (KeyValuePair<string, Queue<Player>> mq in matchQueue)
                {
                    Queue<Player> nq = new Queue<Player>();
                    foreach (Player x in mq.Value) if (x.Online && x.Room == null) nq.Enqueue(x);
                    queueUpdates.Add(new KeyValuePair<string, Queue<Player>>(mq.Key, nq));
                    if (nq.Count == 0) emptyKeys.Add(mq.Key);
                }
                for (int i = 0; i < queueUpdates.Count; i++) matchQueue[queueUpdates[i].Key] = queueUpdates[i].Value;
                for (int i = 0; i < emptyKeys.Count; i++) { matchQueue.Remove(emptyKeys[i]); matchSince.Remove(emptyKeys[i]); }

                List<string> keys = new List<string>(matchQueue.Keys);
                for (int i = 0; i < keys.Count; i++)
                {
                    string key = keys[i];
                    Queue<Player> q = matchQueue[key];
                    long since;
                    if (q.Count == 0 || !matchSince.TryGetValue(key, out since) || now - since < MATCH_BOT_WAIT) continue;
                    int bar = key.IndexOf('|');
                    string game = bar < 0 ? key : key.Substring(0, bar);
                    string variant = bar < 0 ? "" : key.Substring(bar + 1);
                    IGameRule rule = RuleRegistry.Get(game) ?? RuleRegistry.Fallback;
                    StartMatch(key, q, rule, variant, Math.Max(0, rule.MinSeats - q.Count), outFrames);
                }

                foreach (KeyValuePair<string, Room> kv in rooms)
                {
                    Room r = kv.Value;
                    for (int i = 0; i < r.Seats.Length; i++)
                    {
                        Seat s = r.Seats[i];
                        if (s.Pid != 0 && !s.Online && !s.Bot && now - s.LastSeen > 180000) r.Leave(i);
                    }

                    if (!r.Started && r.Opt.AutoStartMs > 0)
                    {
                        if (r.SeatCount() + r.BotCount() >= r.MaxSeats)
                        {
                            if (r.AutoStartAt == 0) r.AutoStartAt = now + r.Opt.AutoStartMs;
                            else if (now >= r.AutoStartAt) { r.Start(); r.Collect(outFrames, null); }
                        }
                        else r.AutoStartAt = 0;
                    }

                    bool tickMoved = r.RuleTick(1000);

                    bool botMoved = false;
                    if (r.Started && r.S != null && !r.S.Ended) botMoved = r.BotStep(now);
                    if (r.Started && r.S != null && r.S.Phase == "playing" && !r.S.Ended)
                    {
                        r.SyncPhaseClock();
                        int seat = r.S.Turn;
                        if (seat >= 0 && seat < r.Seats.Length && !r.Seats[seat].Bot)
                        {
                            bool offline = r.Seats[seat].Pid != 0 && !r.Seats[seat].Online;
                            r.Clocks[seat] -= 1000;
                            if (r.Opt.BankMs > 0) r.Banks[seat] -= 1000;
                            bool timedOut = offline || r.Clocks[seat] <= 0 ||
                                            (r.Opt.BankMs > 0 && r.Banks[seat] <= 0);
                            if (timedOut)
                            {
                                if (r.Opt.Timeout == "lose") r.Forfeit(seat, "更漏尽，判负");
                                else if (r.Opt.Timeout == "skip") r.SkipTurn(seat);
                                else r.AutoMove();
                            }
                        }
                        r.Collect(outFrames, null);
                    }
                    else if (!r.Started || botMoved || tickMoved)
                    {
                        r.Collect(outFrames, null);
                    }

                    long seen;
                    chatVer.TryGetValue(r.Id, out seen);
                    if (r.ChatVersion != seen)
                    {
                        int take = (int)Math.Min(r.ChatVersion - seen, (long)r.Chat.Count);
                        for (int i = Math.Max(0, r.Chat.Count - take); i < r.Chat.Count; i++)
                            foreach (Player q in PlayersInRoom(r))
                                outFrames.Add(new KeyValuePair<Player, object>(q,
                                    J.Frame("t", "chat", "msg", r.Chat[i])));
                        chatVer[r.Id] = r.ChatVersion;
                    }
                    if (r.SeatCount() == 0 && r.Spectators.Count == 0 && r.Started) dead.Add(kv.Key);
                }
                for (int i = 0; i < dead.Count; i++) { rooms.Remove(dead[i]); ScriptLibrary.DropRoom(dead[i]); }
            }
        }

        private string NewToken() { return Guid.NewGuid().ToString("N").Substring(0, 16); }
        private string NewRoomId() { return Guid.NewGuid().ToString("N").Substring(0, 5).ToUpperInvariant(); }

        private static async Task Send(Player p, object frame)
        {
            if (p == null || p.Ws == null || p.Ws.State != WebSocketState.Open) return;
            byte[] data = J.Bytes(frame);
            try
            {
                await p.SendLock.WaitAsync();
                await p.Ws.SendAsync(new ArraySegment<byte>(data), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch (Exception) {  }
            finally { try { p.SendLock.Release(); } catch (Exception) { } }
        }
        public async Task Flush(List<KeyValuePair<Player, object>> outFrames)
        {
            for (int i = 0; i < outFrames.Count; i++) await Send(outFrames[i].Key, outFrames[i].Value);
        }
    }
}
