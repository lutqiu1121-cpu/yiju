using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;

namespace Qipai
{

    public static class J
    {
        public static Dictionary<string, object> Parse(string text)
        {
            try
            {
                JsonDocument doc = JsonDocument.Parse(text);
                object o = Conv(doc.RootElement);
                return o as Dictionary<string, object> ?? new Dictionary<string, object>();
            }
            catch (Exception)
            {
                return new Dictionary<string, object>();
            }
        }
        private static object Conv(JsonElement e)
        {
            switch (e.ValueKind)
            {
                case JsonValueKind.Object:
                    Dictionary<string, object> d = new Dictionary<string, object>();
                    foreach (JsonProperty p in e.EnumerateObject()) d[p.Name] = Conv(p.Value);
                    return d;
                case JsonValueKind.Array:
                    List<object> a = new List<object>();
                    foreach (JsonElement x in e.EnumerateArray()) a.Add(Conv(x));
                    return a.ToArray();
                case JsonValueKind.String: return e.GetString();
                case JsonValueKind.Number:
                    long n;
                    if (e.TryGetInt64(out n)) return n;
                    double f; return e.TryGetDouble(out f) ? f : 0;
                case JsonValueKind.True: return true;
                case JsonValueKind.False: return false;
                default: return null;
            }
        }
        public static byte[] Bytes(object frame)
        {
            if (frame == null) return new byte[] { (byte)'{', (byte)'}' };
            return JsonSerializer.SerializeToUtf8Bytes(frame, frame.GetType());
        }
        public static string Str(Dictionary<string, object> d, string k, string def = "")
        {
            object o;
            if (d == null || !d.TryGetValue(k, out o) || o == null) return def;
            return o as string ?? Convert.ToString(o, CultureInfo.InvariantCulture);
        }
        public static int Int(Dictionary<string, object> d, string k, int def = 0)
        {
            object o;
            if (d == null || !d.TryGetValue(k, out o) || o == null) return def;
            try { return Convert.ToInt32(o, CultureInfo.InvariantCulture); } catch (Exception) { return def; }
        }
        public static bool Bool(Dictionary<string, object> d, string k, bool def = false)
        {
            object o;
            if (d == null || !d.TryGetValue(k, out o) || o == null) return def;
            if (o is bool) return (bool)o;
            return o.ToString() == "1" || o.ToString().ToLowerInvariant() == "true";
        }
        public static Dictionary<string, object> Obj(Dictionary<string, object> d, string k)
        {
            object o;
            if (d != null && d.TryGetValue(k, out o)) return o as Dictionary<string, object>;
            return null;
        }

        public static GameState CloneState(GameState s)
        {
            GameState n = new GameState();
            n.Game = s.Game; n.Variant = s.Variant; n.Renderer = s.Renderer; n.Room = s.Room;
            n.Phase = s.Phase; n.PhaseName = s.PhaseName; n.Turn = s.Turn; n.Seats = s.Seats;
            n.Width = s.Width; n.Height = s.Height;
            n.Cells = (string[])s.Cells.Clone();
            n.Hands = new Dictionary<int, List<string>>();
            foreach (KeyValuePair<int, List<string>> kv in s.Hands) n.Hands[kv.Key] = new List<string>(kv.Value);
            n.Log = new List<string>(s.Log);
            n.Last = s.Last; n.Winner = s.Winner; n.Result = s.Result; n.Ended = s.Ended; n.MoveNo = s.MoveNo;
            n.V = new Dictionary<string, object>();
            foreach (KeyValuePair<string, object> kv in s.V) n.V[kv.Key] = CloneVal(kv.Value);
            return n;
        }
        private static object CloneVal(object v)
        {
            if (v == null) return null;
            if (v is string[]) return ((string[])v).Clone();
            if (v is int[]) return ((int[])v).Clone();
            if (v is bool[]) return ((bool[])v).Clone();
            if (v is object[]) return ((object[])v).Clone();
            if (v is Dictionary<string, object>) return ((Dictionary<string, object>)v).ToDictionary(k => k.Key, k => CloneVal(k.Value));
            if (v is List<string>) return new List<string>((List<string>)v);
            if (v.GetType().IsPrimitive || v is string) return v;
            return v;
        }
        public static Dictionary<string, object> Frame(params object[] kv)
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            for (int i = 0; i + 1 < kv.Length; i += 2) d[Convert.ToString(kv[i])] = kv[i + 1];
            return d;
        }
    }
}
