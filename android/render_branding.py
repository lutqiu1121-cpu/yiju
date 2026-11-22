#!/usr/bin/env python3
"""按 android/branding.json 生成 app 名与矢量图标，并同步 APK 内页面标题。
名字与图标默认已定为「弈局 / yiju」+ 附件像素棋盘；想换只改 branding.json。"""
import html
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
RES = HERE / "app/src/main/res"
ASSETS = HERE / "app/src/main/assets/client"

cfg = json.loads((HERE / "branding.json").read_text(encoding="utf-8"))
name = str(cfg.get("appName") or "弈局").strip() or "弈局"
short = str(cfg.get("shortName") or name).strip() or name
ic = cfg.get("icon") or {}
bg = str(ic.get("bg") or "#EBECDE")
ink = str(ic.get("ink") or "#0A0A0A")
accent = str(ic.get("accent") or "#9B092D")
line = str(ic.get("line") or "#D5CEBC")
preset = str(ic.get("preset") or "yiju")

# 附件图标的 32×32 像素网格：# = 墨线，R = 朱砂一子，. = 米白纸底
ICON_GRID = """
................................
................................
..............##................
..............###...............
..............###...............
...............##...............
.........................###....
.....................#######....
....###.......#############.....
....##################..........
.....###########..##............
............##....##..RR........
.........##.##....##.RRRR.......
........###.##....##.RRRR.......
........###.##....##..RR........
........##..##...###............
............##...##.............
..........................##....
.............##...##...#####....
.............##...##.######.....
.............############.......
.......###############..........
....###########...##............
....####.....##...##............
.............##...##............
............###...##............
............##....##............
............##....##............
...........###....###...........
...........##......##...........
................................
................................
""".strip("\n").splitlines()


def esc(s):
    return html.escape(str(s), quote=True)


def shape(d, fill, stroke=None, sw=1.0):
    return {"pathData": d, "fill": fill, "stroke": stroke, "strokeWidth": sw}


def grid_rects(ch):
    out = []
    for y, row in enumerate(ICON_GRID):
        x = 0
        while x < len(row):
            if row[x] != ch:
                x += 1
                continue
            start = x
            while x < len(row) and row[x] == ch:
                x += 1
            out.append([start, y, x - start, 1])
    merged = []
    for r in out:
        hit = None
        for m in merged:
            if m[0] == r[0] and m[2] == r[2] and m[1] + m[3] == r[1]:
                hit = m
                break
        if hit:
            hit[3] += 1
        else:
            merged.append(list(r))
    return merged


def rect_path(r):
    x, y, w, h = r
    return f"M{x},{y} h{w} v{h} h-{w} Z"


def yiju_shapes():
    a = [shape("M0,0 h32 v32 h-32 Z", bg)]
    a += [shape(rect_path(r), ink) for r in grid_rects("#")]
    a += [shape(rect_path(r), accent) for r in grid_rects("R")]
    return a


BACK = shape("M0,0 L48,0 L48,48 L0,48 Z", bg)
FRAME = shape("M6,6 L42,6 L42,42 L6,42 Z", "#00000000", ink, 1.6)
GRID = shape("M18,6 L18,42 M30,6 L30,42 M6,18 L42,18 M6,30 L42,30", "#00000000", line, 1.0)
DISC = shape("M24,19 A5,5 0 1,1 23.99,19 Z", accent)
DISC_RING = shape("M24,21 A3,3 0 1,1 23.99,21 Z", "#00000000", bg, 0.9)

PRESETS = {
    "yiju": None,  # 由 yiju_shapes() 动态生成（32 视口，下面单独处理）
    "board": [BACK, FRAME, GRID, DISC, DISC_RING],
    "ink": [
        BACK,
        shape("M14,16 A9,9 0 1,1 13.99,16 Z", ink),
        shape("M32,28 A6,6 0 1,1 31.99,28 Z", accent),
        shape("M8,38 A2.4,2.4 0 1,1 7.99,38 Z", ink),
        shape("M6,10 C18,4 30,8 42,14", "#00000000", line, 1.4),
    ],
    "circle": [
        BACK,
        shape("M24,8 A16,16 0 1,1 23.99,8 Z", "#00000000", ink, 1.6),
        shape("M24,15 A9,9 0 1,1 23.99,15 Z", "#00000000", accent, 1.4),
        shape("M24,21 A3,3 0 1,1 23.99,21 Z", accent),
        shape("M6,6 L42,42", "#00000000", line, 0.8),
    ],
}

if preset == "custom":
    shapes = []
    for p in cfg.get("paths") or []:
        shapes.append(shape(
            str(p.get("pathData") or "M0,0 L48,48"),
            str(p.get("fill") or "#00000000"),
            p.get("stroke") or None,
            float(p.get("strokeWidth") or 1.0)))
    if not shapes:
        print("错误：preset=custom 但 paths 为空，请至少给一条 pathData", file=sys.stderr)
        sys.exit(2)
    viewport = 48
elif preset == "yiju":
    shapes = yiju_shapes()
    viewport = 32
elif preset in PRESETS:
    shapes = PRESETS[preset]
    viewport = 48
else:
    print(f"错误：未知 preset {preset!r}，可用 yiju / board / ink / circle / custom", file=sys.stderr)
    sys.exit(2)


def path(s):
    a = [f'        android:pathData="{esc(s["pathData"])}"',
         f'        android:fillColor="{esc(s["fill"])}"']
    if s.get("stroke"):
        a.append(f'        android:strokeColor="{esc(s["stroke"])}"')
        a.append(f'        android:strokeWidth="{s.get("strokeWidth", 1.0)}"')
    return "<path\n" + "\n".join(a) + "/>"


# 1) strings.xml
(RES / "values").mkdir(parents=True, exist_ok=True)
(RES / "values/strings.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    f'    <string name="app_name">{esc(name)}</string>\n'
    '</resources>\n', encoding="utf-8")

# 2) ic_launcher.xml（纯矢量，零位图）
(RES / "drawable").mkdir(parents=True, exist_ok=True)
body = "\n".join(path(s) for s in shapes)
(RES / "drawable/ic_launcher.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<!-- 由 render_branding.py 按 branding.json 生成，不要手改 -->\n'
    '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
    '    android:width="48dp" android:height="48dp"\n'
    f'    android:viewportWidth="{viewport}" android:viewportHeight="{viewport}">\n'
    + body + "\n</vector>\n", encoding="utf-8")

# 3) 同步 APK 内页面标题 / PWA 名 / 图标（只改 assets 副本）
if (ASSETS / "index.html").exists():
    p = ASSETS / "index.html"
    t = p.read_text(encoding="utf-8")
    t = re.sub(r"<title>.*?</title>", f"<title>{esc(name)} · YIJU // ARCHIVE</title>", t, count=1)
    t = re.sub(r'(<meta name="theme-color" content=")[^"]*(")', r"\g<1>" + bg + r"\g<2>", t, count=1)
    p.write_text(t, encoding="utf-8")
if (ASSETS / "manifest.webmanifest").exists():
    p = ASSETS / "manifest.webmanifest"
    try:
        m = json.loads(p.read_text(encoding="utf-8"))
        m["name"] = name + " · YIJU // ARCHIVE"
        m["short_name"] = short
        m["theme_color"] = bg
        m["background_color"] = bg
        p.write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception as e:
        print("警告：manifest 同步失败 " + str(e), file=sys.stderr)

print(f"品牌已应用：{name} / preset={preset} / {len(shapes)} 条矢量路径 / 视口 {viewport}")
