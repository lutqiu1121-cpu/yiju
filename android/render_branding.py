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

# ---------------------------------------------------------------------------
# v5 图标：印章版（细墨框 + 像素「弈」字 + 右下朱砂方印）
# 与早期 preset=board 的十字棋盘明显不同；同时产出自适应图标、512 位图与哈希清单，
# 让「图标是否真的进了 APK」可以用 sha256 验证，不再靠肉眼猜。
# ---------------------------------------------------------------------------
import hashlib
import struct
import zlib

ROOT = HERE.parent
GRID = ICON_GRID

def hexrgb(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

BG_C, INK_C, ACC_C = hexrgb(bg), hexrgb(ink), hexrgb(accent)
TILE_C = (0xFB, 0xF8, 0xEF)

def glyph_rects():
    """32×32 网格里的墨线 / 朱砂，返回 (x,y,w,h,color)。"""
    out = []
    for y, row in enumerate(GRID):
        x = 0
        while x < len(row):
            ch = row[x]
            if ch not in '#R':
                x += 1
                continue
            start = x
            while x < len(row) and row[x] == ch:
                x += 1
            out.append((start, y, x - start, 1, INK_C if ch == '#' else ACC_C))
    return out

def seal_rects():
    """右下朱砂方印 + 米白十字（32 视口坐标，浮点）。"""
    return [
        (25.5, 25.5, 5.0, 5.0, ACC_C),
        (27.4, 26.3, 1.2, 3.4, TILE_C),
        (26.3, 27.4, 3.4, 1.2, TILE_C),
    ]

ALL_RECTS = glyph_rects() + seal_rects()

def rect_path_scaled(r, scale, off):
    x, y, w, h = r[:4]
    return f"M{off + x * scale:g},{off + y * scale:g} h{w * scale:g} v{h * scale:g} h-{w * scale:g} Z"

def vector_xml(viewport, paths, dp=None):
    dp = dp or (108 if viewport == 108 else 48)
    body = "\n".join(path(s) for s in paths)
    return ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<!-- 由 render_branding.py 生成，不要手改 -->\n'
            '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
            f'    android:width="{dp}dp" android:height="{dp}dp"\n'
            f'    android:viewportWidth="{viewport}" android:viewportHeight="{viewport}">\n'
            + body + "\n</vector>\n")

# 1) 旧 API 兜底：drawable/ic_launcher.xml（32 视口，整图）
p32 = [shape("M0,0 h32 v32 h-32 Z", bg)]
p32.append(shape("M1,1 h30 v30 h-30 Z", "#00000000", ink, 0.7))
p32 += [shape(rect_path_scaled(r, 1, 0), '#%02X%02X%02X' % r[4]) for r in ALL_RECTS]
(RES / "drawable/ic_launcher.xml").write_text(vector_xml(32, p32), encoding="utf-8")

# 2) 自适应图标：背景 + 前景（108 视口，内容收在中心 72×72 安全区）
(RES / "drawable/ic_launcher_background.xml").write_text(
    vector_xml(108, [shape("M0,0 h108 v108 h-108 Z", bg)]), encoding="utf-8")
p108 = [shape(rect_path_scaled(r, 2.25, 18), '#%02X%02X%02X' % r[4]) for r in ALL_RECTS]
(RES / "drawable/ic_launcher_foreground.xml").write_text(vector_xml(108, p108), encoding="utf-8")

mip = RES / "mipmap-anydpi-v26"
mip.mkdir(parents=True, exist_ok=True)
adaptive = ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@drawable/ic_launcher_background" />\n'
            '    <foreground android:drawable="@drawable/ic_launcher_foreground" />\n'
            '</adaptive-icon>\n')
for fn in ("ic_launcher.xml", "ic_launcher_round.xml"):
    (mip / fn).write_text(adaptive, encoding="utf-8")

# 3) 512 位图（mipmap-xxxhdpi）：纯 Python 写 PNG，零第三方依赖
def write_png(path, size, draw):
    buf = bytearray()
    blank = bytes(BG_C)
    for _ in range(size * size):
        buf += blank
    def fill(x, y, w, h, c):
        x0, y0 = max(0, int(x)), max(0, int(y))
        x1, y1 = min(size, int(x + w)), min(size, int(y + h))
        for yy in range(y0, y1):
            off = yy * size * 3
            for xx in range(x0, x1):
                buf[off + xx * 3:off + xx * 3 + 3] = bytes(c)
    draw(fill, size)
    raw = b"".join(b"\x00" + bytes(buf[y * size * 3:(y + 1) * size * 3]) for y in range(size))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    data = (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

def draw_icon(fill, size):
    # 细墨外框
    m = 24
    fill(m, m, size - 2 * m, 2, INK_C)
    fill(m, size - m - 2, size - 2 * m, 2, INK_C)
    fill(m, m, 2, size - 2 * m, INK_C)
    fill(size - m - 2, m, 2, size - 2 * m, INK_C)
    # 弈字 + 朱砂印：32 网格 → 中心 384×384
    scale, off = 12.0, 64.0
    for x, y, w, h, c in ALL_RECTS:
        fill(off + x * scale, off + y * scale, w * scale, h * scale, c)

xxhdpi = RES / "mipmap-xxxhdpi"
for fn in ("ic_launcher.png", "ic_launcher_round.png"):
    write_png(xxhdpi / fn, 512, draw_icon)

# 4) 同步网页 / PWA 图标（仓库根 + assets 副本）
def svg_text():
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges" role="img" aria-label="弈局">',
             f'  <rect width="32" height="32" fill="{bg}"/>',
             f'  <rect x="1" y="1" width="30" height="30" fill="none" stroke="{ink}" stroke-width="0.7"/>']
    for x, y, w, h, c in ALL_RECTS:
        parts.append(f'  <rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" fill="#{c[0]:02X}{c[1]:02X}{c[2]:02X}"/>')
    parts.append('</svg>')
    return "\n".join(parts) + "\n"

svg = svg_text()
(ROOT / "client/icon.svg").write_text(svg, encoding="utf-8")
if (ASSETS / "icon.svg").parent.exists():
    (ASSETS / "icon.svg").write_text(svg, encoding="utf-8")

# 5) 生成物哈希清单：CI / build-apk.sh 用它确认「图标真的换进包了」
tracked = [
    RES / "drawable/ic_launcher.xml",
    RES / "drawable/ic_launcher_background.xml",
    RES / "drawable/ic_launcher_foreground.xml",
    mip / "ic_launcher.xml", mip / "ic_launcher_round.xml",
    xxhdpi / "ic_launcher.png", xxhdpi / "ic_launcher_round.png",
    ROOT / "client/icon.svg",
]
lines = []
for f in tracked:
    h = hashlib.sha256(f.read_bytes()).hexdigest()
    lines.append(f"{h}  {f.relative_to(ROOT).as_posix()}")
(HERE / "branding.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8")

print(f"品牌已应用：{name} / preset={preset} / 印章图标 + adaptive + 512 PNG / {len(tracked)} 个生成物已记入 branding.sha256")
