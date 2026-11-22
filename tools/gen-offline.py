#!/usr/bin/env python3
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
m = json.loads((ROOT / "rules/manifest.json").read_text(encoding="utf-8"))
t = json.loads((ROOT / "themes/themes.json").read_text(encoding="utf-8"))
games = [{k: g.get(k) for k in ("id","name","cat","min","max","tag")} for g in m["games"]]
out = {
  "games": games,
  "categories": m.get("categories", []),
  "themes": t.get("themes", []),
  "sliders": t.get("sliders", []),
  "count": len(games),
  "notice": "本项目为开源技术分享，不提供官方游戏服务，不构成面向公众的网络游戏运营。游戏核心体验可完全离线进行。任何使用者自行部署、分发或商业化所产生的合规责任（包括但不限于版号、实名制、个人信息保护），由使用者自行承担。"
}
js = "window.__YJ_OFFLINE__ = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
(ROOT / "client/offline-assets.js").write_text(js, encoding="utf-8")
print("离线资产：%d 局 · %d 纸色 · %.1f KiB" % (len(games), len(out["themes"]), len(js.encode("utf-8"))/1024))
