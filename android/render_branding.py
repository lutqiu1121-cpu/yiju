#!/usr/bin/env python3
"""按 android/branding.json 生成 app 名与图标。

图标唯一真源 = ICON_GRID：用户提供的 512×512 图按 8px 逐格还原成 64×64 网格。
**严格照抄，不额外加边框、不加印章、不改字形、不改笔画、不改朱砂位置。**
颜色也取自原图：底 #F5F1E6 / 墨 #000000 / 朱砂 #9B092D。

产出：drawable 矢量 + adaptive icon + 512 PNG + client/icon.svg + branding.sha256。
生成物不要手改；换图只改 ICON_GRID（或替换整张源图后重新逐格提取）。
"""
import hashlib
import html
import json
import pathlib
import re
import struct
import sys
import zlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
RES = HERE / "app/src/main/res"
ASSETS = HERE / "app/src/main/assets/client"

cfg = json.loads((HERE / "branding.json").read_text(encoding="utf-8"))
name = str(cfg.get("appName") or "弈局").strip() or "弈局"
short = str(cfg.get("shortName") or name).strip() or name
ic = cfg.get("icon") or {}
bg = str(ic.get("bg") or "#F5F1E6")
ink = str(ic.get("ink") or "#000000")
accent = str(ic.get("accent") or "#9B092D")
preset = str(ic.get("preset") or "yiju")

# 用户原图（512×512，每格 8px）逐格还原：# = 墨，R = 朱砂，. = 纸底
ICON_GRID = """
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
............................####................................
.............................####...............................
..............................####..............................
..............................#####.............................
..............................#####.............................
..............................####..............................
................................#.......######..................
...................................###########..................
........................#######################.................
................####################.......####.................
.................##############...###...........................
..................######...####...###...........................
...................##......####...###...........................
...........................###....###..RRR......................
.......................#...###....###...RRRRR...................
.....................###...###....###...RRRRRR..................
...................####...####....###....RRRRR..................
...................####...###.....###.....RRRRR.................
..................####....###..######......RRRR.................
...................##....###....#####.......RR..................
........................####.....####...........................
.......................####......####...........................
......................####........#.............................
.....................####.####......###.........................
....................###...####......###.........................
...................##.....####......###....##...................
..........................####......###...####..................
..........................####..################................
.............####################################...............
.............####################################...............
..............#################.....###.........................
...............######.....###.......###.........................
................##........###.......###.........................
.........................####.......###.........................
.........................###........###.........................
........................####........###.........................
........................###.........###.........................
.......................####.........###.........................
......................####..........###.........................
.....................####...........###.........................
....................####............###.........................
...................###..............###.........................
....................................###.........................
....................................##..........................
....................................##..........................
....................................#...........................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
""".strip("\n").splitlines()

assert len(ICON_GRID) == 64, "ICON_GRID 必须是 64 行"
assert all(len(r) == 64 for r in ICON_GRID), "ICON_GRID 每行必须是 64 列"

# 历史预设仅作兼容记录；本版图标固定为用户原图，忽略其它 preset。
PRESETS = {"yiju": None, "board": None, "ink": None, "circle": None, "custom": None}
if preset != "yiju":
    print("警告：本版图标固定为用户提供的 64×64 原图，忽略 preset=%r" % preset, file=sys.stderr)


def esc(s):
    return html.escape(str(s), quote=True)


def shape(d, fill, stroke=None, sw=1.0):
    return {"pathData": d, "fill": fill, "stroke": stroke, "strokeWidth": sw}


def hexrgb(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


BG_C, INK_C, ACC_C = hexrgb(bg), hexrgb(ink), hexrgb(accent)


def grid_rects(ch):
    """连续同色格先横向并段、再纵向并段，减少矢量 path 数量。"""
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


def rect_path(r, scale=1.0, off=0.0):
    x, y, w, h = r
    return f"M{off + x * scale:g},{off + y * scale:g} h{w * scale:g} v{h * scale:g} h-{w * scale:g} Z"


ALL_RECTS = ([(r, INK_C) for r in grid_rects("#")] +
             [(r, ACC_C) for r in grid_rects("R")])


def content_paths(scale, off):
    return [shape(rect_path(r, scale, off), "#%02X%02X%02X" % c)
            for r, c in ALL_RECTS]


def vector_xml(viewport, paths, dp=None):
    dp = dp or (108 if viewport == 108 else (64 if viewport == 64 else 48))
    body = "\n".join(
        "<path\n" + "\n".join([
            f'        android:pathData="{esc(s["pathData"])}"',
            f'        android:fillColor="{esc(s["fill"])}"',
        ] + ([f'        android:strokeColor="{esc(s["stroke"])}"',
              f'        android:strokeWidth="{s.get("strokeWidth", 1.0)}"']
             if s.get("stroke") else [])) + "/>"
        for s in paths)
    return ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<!-- 由 render_branding.py 按用户原图 64×64 网格生成，不要手改 -->\n'
            '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
            f'    android:width="{dp}dp" android:height="{dp}dp"\n'
            f'    android:viewportWidth="{viewport}" android:viewportHeight="{viewport}">\n'
            + body + "\n</vector>\n")


# 1) app 名
(RES / "values").mkdir(parents=True, exist_ok=True)
(RES / "values/strings.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    f'    <string name="app_name">{esc(name)}</string>\n'
    '</resources>\n', encoding="utf-8")

# 2) 旧 API 兜底矢量：64 视口，整图 = 纸底 + 原网格，无框无印
(RES / "drawable").mkdir(parents=True, exist_ok=True)
p64 = [shape("M0,0 h64 v64 h-64 Z", bg)] + content_paths(1.0, 0.0)
(RES / "drawable/ic_launcher.xml").write_text(vector_xml(64, p64), encoding="utf-8")

# 3) adaptive icon：108 视口，内容收在中心 72×72 安全区（off=18, scale=72/64=1.125）
(RES / "drawable/ic_launcher_background.xml").write_text(
    vector_xml(108, [shape("M0,0 h108 v108 h-108 Z", bg)]), encoding="utf-8")
(RES / "drawable/ic_launcher_foreground.xml").write_text(
    vector_xml(108, content_paths(1.125, 18.0)), encoding="utf-8")

mip = RES / "mipmap-anydpi-v26"
mip.mkdir(parents=True, exist_ok=True)
adaptive = ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@drawable/ic_launcher_background" />\n'
            '    <foreground android:drawable="@drawable/ic_launcher_foreground" />\n'
            '</adaptive-icon>\n')
for fn in ("ic_launcher.xml", "ic_launcher_round.xml"):
    (mip / fn).write_text(adaptive, encoding="utf-8")

# 4) 512 PNG：8px/格硬量化三色，逐像素按原网格重建，无抗锯齿噪点
def write_icon_png(path, size=512):
    cell = size // 64
    buf = bytearray(bytes(BG_C) * (size * size))
    def fill(x0, y0, w, h, c):
        for yy in range(y0, min(size, y0 + h)):
            off = yy * size * 3
            for xx in range(x0, min(size, x0 + w)):
                buf[off + xx * 3:off + xx * 3 + 3] = bytes(c)
    for r, c in ALL_RECTS:
        x, y, w, h = r
        fill(x * cell, y * cell, w * cell, h * cell, c)
    raw = b"".join(b"\x00" + bytes(buf[y * size * 3:(y + 1) * size * 3])
                   for y in range(size))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    data = (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

xxhdpi = RES / "mipmap-xxxhdpi"
for fn in ("ic_launcher.png", "ic_launcher_round.png"):
    write_icon_png(xxhdpi / fn)

# 5) 网页 / PWA 图标：64 视口，与 APK 同源
def svg_text():
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" '
             'shape-rendering="crispEdges" role="img" aria-label="弈局">',
             f'  <rect width="64" height="64" fill="{bg}"/>']
    for r, c in ALL_RECTS:
        x, y, w, h = r
        parts.append(f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" '
                     f'fill="#{c[0]:02X}{c[1]:02X}{c[2]:02X}"/>')
    parts.append('</svg>')
    return "\n".join(parts) + "\n"

svg = svg_text()
(ROOT / "client/icon.svg").write_text(svg, encoding="utf-8")
if (ASSETS / "icon.svg").parent.exists():
    (ASSETS / "icon.svg").write_text(svg, encoding="utf-8")

# 6) 同步 APK 内页面标题 / PWA 名 / 主题色
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

# 7) 生成物哈希清单：CI / build-apk.sh 核对「图标真的换进包了」
tracked = [
    RES / "drawable/ic_launcher.xml",
    RES / "drawable/ic_launcher_background.xml",
    RES / "drawable/ic_launcher_foreground.xml",
    mip / "ic_launcher.xml", mip / "ic_launcher_round.xml",
    xxhdpi / "ic_launcher.png", xxhdpi / "ic_launcher_round.png",
    ROOT / "client/icon.svg",
]
lines = [f"{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.relative_to(ROOT).as_posix()}"
         for f in tracked]
(HERE / "branding.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8")

print(f"品牌已应用：{name} / 用户原图 64×64 逐格还原 / 无额外装饰 / "
      f"{len(ALL_RECTS)} 条矩形 / {len(tracked)} 个生成物记入 branding.sha256")
