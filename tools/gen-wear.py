#!/usr/bin/env python3
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
src = json.loads((ROOT / "themes/wear.json").read_text(encoding="utf-8"))
items = src["items"]

def js(v):
    return json.dumps(v, ensure_ascii=False)

lines = ["export const WEAR_KINDS = " + js(src["kinds"]) + ";",
         "export const WEAR_SETS = " + js(src["sets"]) + ";",
         "export const WEAR_RARITY = " + js(src["rarity"]) + ";",
         "export const WEAR = {"]
for it in items:
    lines.append("  " + json.dumps(it["key"], ensure_ascii=False) + ": " + js(it["params"]) + ",")
lines.append("};")
lines.append("export const WEAR_LIST = " + js([{k: it[k] for k in ("key","kind","name","cost","note","rarity","set")} for it in items]) + ";")
lines.append("""
export function wearParams(worn) {
  const out = {};
  for (const k of Object.keys(worn || {})) {
    const key = worn[k];
    if (key && WEAR[key]) out[k] = { key, p: WEAR[key] };
  }
  return out;
}
const DESK_PAT = {
  bamboo: 'repeating-linear-gradient(90deg,rgba(120,140,95,.14) 0 2px,transparent 2px 12px)',
  cloud: 'radial-gradient(circle at 30% 30%,rgba(90,110,130,.18),transparent 60%),radial-gradient(circle at 72% 68%,rgba(90,110,130,.12),transparent 55%)',
  gold: 'repeating-linear-gradient(45deg,rgba(190,150,60,.12) 0 3px,transparent 3px 9px)',
  celadon: 'radial-gradient(circle at 50% 18%,rgba(255,255,255,.40),transparent 62%)',
  kesi: 'repeating-linear-gradient(0deg,rgba(160,120,70,.10) 0 1px,transparent 1px 8px),repeating-linear-gradient(90deg,rgba(160,120,70,.10) 0 1px,transparent 1px 8px)',
  star: 'radial-gradient(circle at 20% 28%,rgba(255,255,255,.28) 0 1px,transparent 2px),radial-gradient(circle at 68% 72%,rgba(255,255,255,.22) 0 1px,transparent 2px)'
};
let lastWearVars = [];
export function applyWear(worn) {
  const r = document.documentElement.style, body = document.body;
  lastWearVars.forEach(k => r.removeProperty(k)); lastWearVars = [];
  const active = wearParams(worn);
  for (const k of Object.keys(WEAR_KINDS)) {
    const a = active[k];
    body.dataset[k] = a ? a.key : '';
    if (!a) continue;
    for (const pk of Object.keys(a.p)) {
      const n = '--wear-' + k + '-' + pk;
      r.setProperty(n, String(a.p[pk])); lastWearVars.push(n);
    }
  }
  const d = active.desk;
  if (d) {
    r.setProperty('--desk-img', 'linear-gradient(135deg,' + d.p.a + ',' + d.p.b + '), ' + (DESK_PAT[d.p.pat] || 'none'));
    lastWearVars.push('--desk-img');
  }
  window.__YJ_WEAR__ = active;
  if (window.Sound && window.Sound.profile && window.__YJ_SETTINGS__) window.Sound.profile(window.__YJ_SETTINGS__);
  return active;
}
""")

(ROOT / "client/wear.js").write_text("\n".join(lines), encoding="utf-8")

cs = ["using System;", "using System.Collections.Generic;", "namespace Qipai {",
      "public static class WearItems {", "  public static object[] All() {", "    return new object[] {"]
for it in items:
    cs.append("      Qipai.J.Frame(\"key\", %s, \"kind\", %s, \"name\", %s, \"cost\", %d, \"note\", %s, \"rarity\", %s, \"set\", %s),"
              % (js(it["key"]), js(it["kind"]), js(it["name"]), it["cost"], js(it["note"]), js(it["rarity"]), js(it["set"])))
cs += ["    };", "  }", "}", "}"]
(ROOT / "server/Core/WearItems.cs").write_text("\n".join(cs) + "\n", encoding="utf-8")
print("生成 %d 件外观 → client/wear.js + server/Core/WearItems.cs" % len(items))
