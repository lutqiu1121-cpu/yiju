#!/usr/bin/env python3
"""轻量静态自检：JSON / 玩法注册与文案 / C# 与 Java 括号 / JS 语法 /
静态资源引用 / Android 工程 / 非商用协议 / 零资源 / 体积。
不需要 .NET SDK 或 Android SDK；build.sh 里的 RuleTests 才是真正的逻辑回归。"""
import gzip
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
err = []
ok = []


def check(cond, msg):
    (ok if cond else err).append(msg)


# 1) JSON
data = {}
for rel in ["rules/manifest.json", "rules/vectors.json", "themes/themes.json",
            "client/manifest.webmanifest"]:
    p = ROOT / rel
    try:
        data[rel] = json.loads(p.read_text(encoding="utf-8"))
        check(True, "JSON 合法 " + rel)
    except Exception as e:
        check(False, "JSON 损坏 " + rel + " : " + str(e))

manifest = data.get("rules/manifest.json", {})
themes = data.get("themes/themes.json", {})
vectors = data.get("rules/vectors.json", {})
games = manifest.get("games", [])
ids = [g["id"] for g in games]
check(len(ids) == len(set(ids)), "玩法 id 无重复")
check(len(ids) == 60, "玩法数量 = 60（实际 %d）" % len(ids))
check(len(themes.get("themes", [])) == 10, "主题数量 = 10")
check(len(vectors.get("rules", [])) == 60, "回归向量覆盖 60 个玩法")

# 2) 每个 manifest id 都在规则源码里注册；元数据合法
rules_src = "\n".join(
    p.read_text(encoding="utf-8") for p in sorted((ROOT / "server" / "Rules").glob("*.cs")))
for i in ids:
    check(('"%s"' % i) in rules_src, "已注册 " + i)
for g in games:
    check(g.get("renderer") in (manifest.get("renderers") or []), "渲染器有效 " + g["id"])
    check(g.get("cat") in [c["id"] for c in manifest.get("categories", [])], "分类有效 " + g["id"])
    check(isinstance(g.get("variants"), list) and len(g["variants"]) > 0, "有变体 " + g["id"])
    check(1 <= g.get("min", 0) <= g.get("max", 0) <= 12, "人数合法 " + g["id"])

# 3) 用户可见文案：不能把开发者口吻、英文残留、协议裸码写进玩法卡片
BAD_WORDS = ["插件位", "可插", "接口", "服务端", "快照", "blocked", "TODO", "FIXME", "校验在", "由服务端保存"]
for g in games:
    text = (g.get("desc", "") + " " + g.get("tag", ""))
    hits = [w for w in BAD_WORDS if w in text]
    check(not hits, "玩家视角文案 " + g["id"] + (" → " + ",".join(hits) if hits else ""))
    check(not re.search(r"\b(the|and|with|via|null|undefined)\b", text, re.I),
          "无英文残留 " + g["id"])

# 4) C# / Java 词法级括号平衡（跳过字符串 / 字符 / 注释）
def balance(src, path):
    i, n = 0, len(src)
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    line = 1
    while i < n:
        c = src[i]
        if c == '\n':
            line += 1; i += 1; continue
        if c == '/' and i + 1 < n and src[i + 1] == '/':
            while i < n and src[i] != '\n': i += 1
            continue
        if c == '/' and i + 1 < n and src[i + 1] == '*':
            i += 2
            while i + 1 < n and not (src[i] == '*' and src[i + 1] == '/'):
                if src[i] == '\n': line += 1
                i += 1
            i += 2; continue
        if c == '@' and i + 1 < n and src[i + 1] == '"':
            i += 2
            while i < n:
                if src[i] == '"':
                    if i + 1 < n and src[i + 1] == '"': i += 2; continue
                    i += 1; break
                if src[i] == '\n': line += 1
                i += 1
            continue
        if c == '"' or c == "'":
            q = c; i += 1
            while i < n:
                if src[i] == '\\': i += 2; continue
                if src[i] == q: i += 1; break
                if src[i] == '\n': line += 1
                i += 1
            continue
        if c in '([{': stack.append((c, line))
        elif c in ')]}':
            if not stack or stack[-1][0] != pairs[c]:
                return "%s:%d 括号不匹配 %s" % (path, line, c)
            stack.pop()
        i += 1
    if stack:
        return "%s:%d 未闭合 %s" % (path, stack[-1][1], stack[-1][0])
    return None

code_files = (sorted((ROOT / "server").rglob("*.cs")) +
              sorted((ROOT / "tools").rglob("*.cs")) +
              sorted((ROOT / "android").rglob("*.java")))
for p in code_files:
    b = balance(p.read_text(encoding="utf-8"), p.relative_to(ROOT))
    check(b is None, "括号 " + str(p.relative_to(ROOT)) + ("" if b is None else " → " + b))

# 5) JS 语法（ESM 复制成 .mjs 再 check）
js_files = sorted((ROOT / "client").rglob("*.js"))
with tempfile.TemporaryDirectory() as td:
    for p in js_files:
        dst = pathlib.Path(td) / (p.relative_to(ROOT / "client").as_posix().replace("/", "_")[:-3] + ".mjs")
        shutil.copy(p, dst)
        r = subprocess.run(["node", "--check", str(dst)], capture_output=True, text=True)
        check(r.returncode == 0, "JS 语法 " + p.name +
              ("" if r.returncode == 0 else " → " + r.stderr.strip()[:200]))

# 6) HTML 静态资源必须相对路径（APK 的 file:// 下绝对路径会全挂）
html = (ROOT / "client" / "index.html").read_text(encoding="utf-8")
abs_refs = re.findall(r'(?:src|href)="(/[^"]+)"', html)
check(not abs_refs, "HTML 无绝对路径静态引用" + (" → " + ",".join(abs_refs) if abs_refs else ""))
rel_refs = re.findall(r'(?:src|href)="(\./[^"]+)"', html)
for r in rel_refs:
    check((ROOT / "client" / r[2:]).exists(), "静态引用 " + r)
check(len(rel_refs) >= 4, "相对引用齐全（css/js/icon/manifest）")
check("location.protocol !== 'file:'" in html, "file:// 下不注册 Service Worker")

net_src = (ROOT / "client" / "net.js").read_text(encoding="utf-8")
check("if (location.protocol === 'file:') return '';" in net_src,
      "APK 无地址时不误连手机自身")
check("need-url" in net_src and "need-url" in (ROOT / "client" / "app.js").read_text(encoding="utf-8"),
      "待填地址状态两端一致")
check("Net.normalize" in net_src and "defaultPort" in net_src,
      "地址解析走宽容规范化，缺省端口可配")
check("127.0.0.1" not in net_src and "192.168" not in net_src and
      not re.search(r"(只允许|限定|绑定)\s*127", net_src),
      "地址解析不写死、不绑定任何固定地址")
check(not re.search(r"localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", net_src),
      "地址解析无主机白名单与 IP 正则限制")
check("explicitPort" in net_src and ":\\d+$" in net_src,
      "端口写或不写都放行：写则尊重、不写则补缺省")
check("defaultPort" in (ROOT / "client/settings.js").read_text(encoding="utf-8") and
      "data-set-number" in (ROOT / "client/app.js").read_text(encoding="utf-8"),
      "缺省端口是设置项且真接线")
import subprocess
r = subprocess.run(["node", str(ROOT / "tools/net-url.test.mjs")],
                   capture_output=True, text=True, timeout=60)
check(r.returncode == 0, "地址解析行为测试 · " + (r.stdout.strip() or r.stderr.strip()[:120]))
app_src = (ROOT / "client" / "app.js").read_text(encoding="utf-8")
check("localStorage['getItem']" in app_src and "localStorage['getItem']" in net_src,
      "本地存储已容错")
check("openGuide()" in app_src and "askServerUrl" in app_src, "入门教程 / 地址引导已接好")

# 7) Android 工程
android = ROOT / "android"
for rel in ["settings.gradle", "build.gradle", "gradle.properties",
            "gradle/wrapper/gradle-wrapper.properties", "app/build.gradle",
            "app/src/main/AndroidManifest.xml",
            "app/src/main/java/app/yiju/archive/MainActivity.java",
            "app/src/main/res/values/strings.xml",
            "app/src/main/res/drawable/ic_launcher.xml"]:
    check((android / rel).exists(), "Android 文件 " + rel)
for p in android.rglob("*.xml"):
    try:
        ET.parse(p)
        check(True, "Android XML 合法 " + str(p.relative_to(ROOT)))
    except Exception as e:
        check(False, "Android XML 损坏 " + str(p.relative_to(ROOT)) + " : " + str(e))
mf = (android / "app/src/main/AndroidManifest.xml").read_text(encoding="utf-8")
check('usesCleartextTraffic="true"' in mf, "允许局域网 ws 明文")
check("orientation|screenSize" in mf, "横竖屏不重建 Activity")
check("INTERNET" in mf, "声明网络权限")
check("vector" in (android / "app/src/main/res/drawable/ic_launcher.xml").read_text(encoding="utf-8"),
      "启动图标为矢量")
gradle_all = "\n".join(p.read_text(encoding="utf-8") for p in android.rglob("*.gradle"))
deps = [ln.strip() for ln in gradle_all.splitlines()
        if re.match(r"\s*(implementation|api|compile|testImplementation)\b", ln)]
check(not any("androidx" in d.lower() for d in deps), "APK 不引 AndroidX")
check("assembleDebug" in (ROOT / "build-apk.sh").read_text(encoding="utf-8"), "APK 脚本调用 assembleDebug")

# 8) 非商用协议
lic = ROOT / "LICENSE"
check(lic.exists(), "LICENSE 存在")
if lic.exists():
    t = lic.read_text(encoding="utf-8")
    need = ["PolyForm Noncommercial License 1.0.0", "## Acceptance", "## Notices",
            "## Noncommercial Purposes", "## Patent Defense", "## Violations",
            "## No Liability", "## Definitions", "Required Notice:"]
    check(all(k in t for k in need), "LICENSE 为完整 PolyForm Noncommercial 1.0.0 文本")
    check("MIT License" not in t and "Permission is hereby granted" not in t, "MIT 旧文本已清除")
readme = (ROOT / "README.md").read_text(encoding="utf-8")
check("PolyForm-Noncommercial-1.0.0" in readme and "禁止商用" in readme and "入门教程" in readme,
      "README 写明非商用许可与入门教程")
check("MIT 开源" not in readme and "MIT，见" not in readme, "README 不再自称 MIT 开源")
check("不含 LICENSE" not in readme and "协议由" not in readme, "README 无过时的无协议声明")
pub = (ROOT / "PUBLISH_AGENT.md").read_text(encoding="utf-8")
check("不要创建 LICENSE" not in pub and "build-apk.sh" in pub, "发布提示词已含 APK 与非商用协议")
check("MIT 开源" not in pub, "发布提示词不再要求 MIT")
check("yiju.apk" in (ROOT / "RELEASE_LIST.md").read_text(encoding="utf-8"),
      "产物清单含 APK")

# 9) 零位图 / 零字体 / 零音频 / 零第三方前端框架
BAD_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".woff", ".woff2",
           ".ttf", ".otf", ".mp3", ".wav", ".ogg", ".m4a"}
bad = [str(p.relative_to(ROOT)) for p in (ROOT / "client").rglob("*")
       if p.suffix.lower() in BAD_EXT]
bad += [str(p.relative_to(ROOT)) for p in android.rglob("*") if p.suffix.lower() in BAD_EXT]
check(not bad, "客户端与 APK 无位图/字体/音频资源" + (" → " + ",".join(bad) if bad else ""))
check("feTurbulence" in html or "paperNoise" in html, "纸纹为实时滤镜")

# 9.5) 打字交流 / 派对发言 / 多人席位 / 品牌配置
check('id="typingLine"' in html and 'id="quickRow"' in html, "聊天区含正在输入与快捷短语容器")
for fn in ["onTyping", "sendTyping", "renderQuick", "onFrame"]:
    check(fn in app_src, "客户端接线 " + fn)
hub_src = (ROOT / "server/Core/Hub.cs").read_text(encoding="utf-8")
room_src = (ROOT / "server/Core/Room.cs").read_text(encoding="utf-8")
party_src = (ROOT / "server/Rules/PartyGames.cs").read_text(encoding="utf-8")
check('t == "typing"' in hub_src and "LastChatAt" in hub_src, "服务端正在输入广播与聊天限速")
check('code.StartsWith("say:")' in hub_src, "派对发言同步进房内聊天流")
check('if (Started) return -1;' in room_src and "Sealed" in room_src, "开局后封存空席")
check("PickAuto" in room_src and "ForceAll" in hub_src, "托管全房找可行动座位")
check('"speech"' in party_src and '"describe"' in party_src and "FinishTeam" in party_src,
      "狼人杀/卧底含轮流发言阶段与阵营胜负")
check('"守卫"' in party_src and "SkipEmptySteps" in party_src, "狼人杀守卫补齐且跳过空步骤")
check("Split(',').Contains" in hub_src, "阵营胜负多座位记入战绩")
check('J.Str(m, "title", "")' in hub_src and 'J.Str(m, "password", "")' in hub_src and
      'r.AllowSpectators = opt.AllowSpectators' in hub_src and
      'AsBool(Get(src, m, "spectators")' in (ROOT / "server/Core/RoomOptions.cs").read_text(encoding="utf-8"),
      "建房支持房间名/密码/观战开关")
check('"fillBots"' in hub_src and '"addBot"' in hub_src and '"removeBot"' in hub_src,
      "建房与房内支持电脑补位")
check('MATCH_DEFAULT_WAIT' in hub_src and 'StartMatch(key, group, fill' in hub_src and
      '候久 · 隐士补位' in hub_src, "寻局候满按池内最高段位请隐士补位开枰")
check('PoolText' in hub_src and 'PoolRange' in hub_src and 'PoolDiff' in hub_src and
      'MATCH_WIDEN_1' in hub_src and 'MATCH_WIDEN_2' in hub_src and 'MATCH_WIDEN_3' in hub_src,
      "分池随时间阶梯放宽：同段 → ±1 → ±2 → 全段")
check('MmrOf' in hub_src and 'RankOf(p, game)' in hub_src and 'Provisional' in hub_src,
      "隐藏棋力分：已题名按本局墨分，未题名按本机胜率定级")
check('cand.Sort' in hub_src and 'Math.Abs(a.Mmr - anchor.Mmr)' in hub_src and
      'group.Count >= 4' in hub_src and 'snake' in hub_src,
      "同池内取最接近者，四人以上按棋力蛇形岔席平衡两队")
check('"matchState"' in hub_src and 'EmitMatchState' in hub_src and
      '"matchCancel"' in hub_src and 'RemoveFromQueues' in hub_src,
      "寻局进度帧 / 止寻局 / 防重复入队与断线出队")
check('RankBotLevelFor' in hub_src and 'RankBotLabelFor' in (ROOT / 'server/Core/Room.cs').read_text(encoding='utf-8') and
      'ApplyRankBots' in (ROOT / 'server/Core/Room.cs').read_text(encoding='utf-8') and
      'BestBotLevel' in (ROOT / 'server/Core/Accounts.cs').read_text(encoding='utf-8') and
      'RANK_BOT' in (ROOT / 'server/Core/Accounts.cs').read_text(encoding='utf-8'),
      "自定义房间按席中最高段位自动定隐士棋力（开枰动态生效）")
check('"botByRank"' in (ROOT / 'server/Core/RoomOptions.cs').read_text(encoding='utf-8') and
      all(any(o.get('key') == 'botByRank' for o in g.get('options', [])) for g in manifest.get('games', [])),
      "60 局房规都带「隐士随本席最高段位」开关")
check('matchBar' in (ROOT / 'client/index.html').read_text(encoding='utf-8') and
      'renderMatchState' in app_src and 'startMatch' in app_src and
      'matchMaxWait' in (ROOT / 'client/settings.js').read_text(encoding='utf-8'),
      "匹配进度条 / 止寻按钮 / 寻局耐心设置真接线")
check('BotStep(now)' in hub_src and 'public bool BotStep' in room_src and
      'public int AddBots' in room_src and 'public bool RemoveBot' in room_src,
      "服务端电脑自动行动/增减/补位")
check('ChatVersion' in hub_src and 'r.ChatVersion != seen' in hub_src,
      "系统消息与电脑发言实时广播")
check('id="myRoomPanel"' in html and 'id="mkTitle"' in app_src and 'askRoomPassword' in app_src,
      "客户端自定义房间与密码房入口")
check('"title", kv.Value.Title' in hub_src and '"bots", kv.Value.BotCount()' in hub_src,
      "房间列表下发自定义字段")
check('split(\',\')' in app_src or "split(',')" in app_src, "客户端按阵营判定胜负")
# 人数上限如实登记
mm = {g["id"]: (g["min"], g["max"]) for g in games}
check(mm.get("werewolf") == (6, 12), "狼人杀 6–12 人")
check(mm.get("undercover") == (3, 9), "卧底 3–9 人")
check(mm.get("uno") == (2, 8) and mm.get("tingyu") == (3, 6) and mm.get("shiyi") == (2, 4),
      "云笺令 2–8 / 听雨 3–6 / 拾遗 2–4")

brand = ROOT / "android/branding.json"
check(brand.exists(), "APK 品牌配置 branding.json 存在")
if brand.exists():
    try:
        bc = json.loads(brand.read_text(encoding="utf-8"))
        check(bool(bc.get("appName")) and bc.get("icon", {}).get("preset") in
              {"yiju", "board", "ink", "circle", "custom"}, "品牌配置字段合法")
    except Exception as e:
        check(False, "品牌配置 JSON 损坏 : " + str(e))
rb = ROOT / "android/render_branding.py"
check(rb.exists() and "PRESETS" in rb.read_text(encoding="utf-8") and "ICON_GRID" in rb.read_text(encoding="utf-8"),
      "品牌渲染脚本内置附件像素图标")
check(json.loads((ROOT / "android/branding.json").read_text(encoding="utf-8")).get("appName") == "弈局",
      "APK 默认名为弈局")
icon_svg = (ROOT / "client/icon.svg").read_text(encoding="utf-8")
check("<svg" in icon_svg and "shape-rendering" in icon_svg and "<rect" in icon_svg,
      "PWA 图标为矢量像素图，无位图")
check('"./icon.svg"' in (ROOT / "client/manifest.webmanifest").read_text(encoding="utf-8"),
      "PWA 清单图标为相对路径")
apk_sh = (ROOT / "build-apk.sh").read_text(encoding="utf-8")
check("render_branding.py" in apk_sh, "APK 构建会应用品牌配置")
pub_src = (ROOT / "PUBLISH_AGENT.md").read_text(encoding="utf-8")
check(pub_src.count("【提示词开始】") == 1 and pub_src.count("【提示词结束】") == 1,
      "发布提示词边界唯一，无重复段落")
check("branding.json" in pub_src, "发布提示词含品牌确认步骤")

# 9.5) 剧本 / 服务器目录 / 本机榜 / 演出 / 画板 / 棋谱 / Bot 难度
extra_src = (ROOT / "server/Rules/ExtraGames.cs").read_text(encoding="utf-8")
registry = (ROOT / "server/Rules/RuleRegistry.cs").read_text(encoding="utf-8")
local = (ROOT / "server/Core/LocalData.cs").read_text(encoding="utf-8")
program = (ROOT / "server/Program.cs").read_text(encoding="utf-8")
app = (ROOT / "client/app.js").read_text(encoding="utf-8")
ren = (ROOT / "client/render.js").read_text(encoding="utf-8")
aud = (ROOT / "client/audio.js").read_text(encoding="utf-8")
css = (ROOT / "client/app.css").read_text(encoding="utf-8")
html_all = (ROOT / "client/index.html").read_text(encoding="utf-8")

NEW_IDS = ["dots","hex","nim","endgame","junqi4","gouji","baohuang","chudadi","shuangkou",
           "avalon","turtlesoup","mastermind","drawguess",
           "juben","tournament"]
check(all(x in ids for x in NEW_IDS), "15 个新玩法都在 manifest")
check(all(('"'+x+'"') in registry or "new ExtraGame(\"" + x + "\")" in registry or x == "juben" or x == "tournament"
          for x in NEW_IDS), "15 个新玩法都已注册")
check(all(x in ids for x in ["houlou","duzhou","dengying","huiwen","cuojin","shiyi","tingyu"]) and
      all(('new OrigSevenGame("'+x+'")') in registry for x in ["houlou","duzhou","dengying","huiwen","cuojin","shiyi","tingyu"]),
      "七局原创小戏入清单并注册")
check(not any(x in ids for x in ["texas","showhand","blackjack","zhajinhua","niuniu","sangong","liarsdice"]),
      "七局赌场原型已撤下，竹牌戏保留")
check("mahjong" in ids and "shisanszhang" in ids, "竹牌戏与三道笺保留")
check("yijuan" in ids and "new YiJuanGame()" in registry,
      "第 60 局弈卷已入清单并注册")
check("class DirectorGame" in extra_src and "class TournamentGame" in extra_src,
      "剧本导演与多轮积分赛规则存在")
check("ScriptGateway.GetForRoom" in extra_src and "PutRoom" in local and "ScriptGateway.List" in local, "剧本现场导入按房间挂且网关已注入")
check("_script" in extra_src and "_private" in extra_src, "剧本全文与私本用下划线键不进 Info")
check("AdvanceAct" in extra_src and "轮到你发言" in extra_src, "讨论阶段轮流发言且能自动收束")
check("HallPost" in local and "Leaderboard" in local and "PullDirectory" in local,
      "馆帖 / 本机榜 / 目录适配器齐备")
check("DEFAULT_DIRECTORY" in local and "board-cache.json" in local, "目录默认开启且失败降级缓存")
check("LocalData.Init(contentRoot)" in program and "ScriptLibrary.Init(contentRoot)" in program,
      "服务端入口初始化剧本库与本机档案")
for t in ['"scripts"', '"scriptImport"', '"board"', '"halls"', '"hallPull"', '"profile"', '"setBotLevel"', '"export"']:
    check(t in hub_src, "Hub 支持帧/动作 " + t)
check("Record(st.Token" in hub_src, "终局写入本机榜")
check("BotLevel" in room_src and "FillBotsTo" in room_src, "Bot 难度与补位在房间层")

scripts = sorted((ROOT / "scripts").glob("*.json"))
check(len(scripts) >= 3, "至少 3 个示例剧本（实际 %d）" % len(scripts))
for f in scripts:
    d = json.loads(f.read_text(encoding="utf-8"))
    check(all(k in d for k in ["id","name","version","roles","acts","clues","endings","theme","ambience"]),
          "剧本结构完整 " + f.stem)
    check(len(d["roles"]) >= 3 and len(d["acts"]) >= 3, "剧本含多角色多幕 " + f.stem)
    check(any(a.get("vote") for a in d["acts"]), "剧本含终幕指认 " + f.stem)

check((ROOT / "leaderboard/README.md").exists() and
      (ROOT / "leaderboard/halls.example.json").exists() and
      (ROOT / "leaderboard/BoardServer/Program.cs").exists(), "服务器目录适配器齐备")
check("net8.0" in (ROOT / "leaderboard/BoardServer/BoardServer.csproj").read_text(encoding="utf-8"),
      "聚合小服务为 net8.0")
try:
    halls = json.loads((ROOT / "leaderboard/halls.example.json").read_text(encoding="utf-8"))
    check(isinstance(halls, list) and all("fp" in h and "addr" in h for h in halls),
          "馆帖示例字段完整")
except Exception as e:
    check(False, "馆帖示例可解析 → " + str(e))

for fn in ["renderStage", "renderExtraActions", "renderDrawBoard", "renderBoards",
           "openHallPicker", "openScriptImport", "downloadRecord", "syncScriptTheme", "bindExtraUI"]:
    check(fn in app, "客户端函数 " + fn)
check("DEFAULT_HALL_DIR" in app and "hallPull" in app, "客户端默认开启目录且可刷新")
check("drawGridExtra" in ren and "data-sc" in app, "扩展网格绘制与演出按钮绑定")
check("cue(name)" in aud and "ambience(kind" in aud, "氛围 cue 与环境音合成")
for k in ["stageShow", "drawWrap", "extraActions", "boardLocal", "boardHalls",
          "hallName", "hallDirToggle", "recordFile", "openScriptImport"]:
    check(k in html_all, "页面元素 " + k)
for k in ["stage-show", "draw-wrap", "board-list", "clue-wall", "show-ending"]:
    check(k in css, "样式 " + k)
check("scripts" in (ROOT / "build.sh").read_text(encoding="utf-8") and
      "cp -r scripts publish/scripts" in (ROOT / "build.sh").read_text(encoding="utf-8"),
      "运行包带房主剧本库")
check("yiju.apk \\" in pub_src or "yiju.apk" in pub_src, "Release 只上传 APK")
check("只上传 1 个文件" in pub_src and "1 个文件 `yiju.apk`" in (ROOT / "RELEASE_LIST.md").read_text(encoding="utf-8"),
      "发布提示词与清单明确只发 APK")
check("60 个玩法" in (ROOT / "README.md").read_text(encoding="utf-8"), "README 玩法数已更新")
check(not re.search(r"qipai-archive|棋牌档案|WORD //", html_all + app + (ROOT / "README.md").read_text(encoding="utf-8")),
      "无旧品牌残留")

# 9.6) 本地账号 / 加密存档
acct = (ROOT / "server/Core/Accounts.cs").read_text(encoding="utf-8")
for k in ["class Accounts", "Rfc2898DeriveBytes", "AesManaged", "HMACSHA256",
          "MAGIC_LOCAL", "MAGIC_EXPORT", "Register(", "Login(", "Export(", "Import(", "Record("]:
    check(k in acct, "账号模块 " + k)
check("ITER = 240000" in acct and "ITER_LEGACY = 100000" in acct,
      "口令派生升至 24 万轮，旧账号按各自轮数兼容")
check("Pbkdf2Sha256" in acct and "HashAlgorithmName.SHA256" in acct, "PBKDF2-HMAC-SHA256 且 .NET 8 无废弃构造")
check("new Rfc2898DeriveBytes(" not in acct, "不再使用 .NET 8 已废弃的构造函数")
check("byte[] loginSalt = Random(16)" in acct, "导入账号使用独立登录盐，不复用导出包盐")
check('"created", d.ContainsKey("created")' in acct, "时间戳按 long 透传，不被 int 截断")
check('"accounts.json"' in acct and '!Txt' not in acct, "账号表只落盘盐与校验值")
check("vaultKey = null" in acct and "cache = new Dictionary" in acct, "重复初始化会重置密钥与缓存")
for t in ['"accountRegister"', '"accountLogin"', '"accountLogout"', '"accountState"',
          '"accountExport"', '"accountImport"']:
    check(t in hub_src, "Hub 账号帧 " + t)
check("Accounts.Record(pl.AccountId" in hub_src, "终局自动写账号存档")
check("Accounts.Init(contentRoot)" in program, "服务端入口初始化账号")
check("old.AccountId.Length == 0" in hub_src, "重连不覆盖账号名")
for fn in ["renderAccount(", "renderAccountCard(", "openAccount(", "downloadSave("]:
    check(fn in app, "客户端账号函数 " + fn)
for k in ["case 'account'", "case 'save'", "t: 'accountRegister'", "t: 'accountImport'"]:
    check(k in app, "客户端账号协议 " + k)
for k in ["accountCard", "accountState", "acctRegister", "acctLogin", "acctExport", "acctImport", "acctLogout", "saveFile"]:
    check(k in html_all, "账号页面元素 " + k)

# 9.7) APK 可直接覆盖升级（固定签名 + 固定包名 + 递增版本 + Manifest 不写死）
ks = ROOT / "android/keystore/yiju.jks"
check(ks.exists() and ks.stat().st_size > 1000, "固定签名 keystore 已随仓库分发")
check((ROOT / "android/keystore/README.md").exists(), "密钥用途与安全边界有说明")
ver = json.loads((ROOT / "android/version.json").read_text(encoding="utf-8"))
check(ver.get("applicationId") == "app.yiju.archive", "applicationId 固定")
check(isinstance(ver.get("versionCode"), int) and ver["versionCode"] >= 1, "versionCode 为正整数")
check(isinstance(ver.get("versionName"), str) and ver["versionName"], "versionName 存在")
gradle = (ROOT / "android/app/build.gradle").read_text(encoding="utf-8")
check("JsonSlurper" in gradle and "versionCode vj.versionCode" in gradle, "Gradle 从 version.json 读版本")
check("signingConfigs" in gradle and "keystore/yiju.jks" in gradle, "Gradle 指向固定 keystore")
check(gradle.count("signingConfig signingConfigs.yiju") == 2, "debug / release 都用固定签名")
manifest = (ROOT / "android/app/src/main/AndroidManifest.xml").read_text(encoding="utf-8")
check("android:versionCode" not in manifest and "android:versionName" not in manifest,
      "Manifest 不写死版本号（避免与 version.json 打架）")
check("android:allowBackup" in manifest, "覆盖安装保留数据")
apk_sh = (ROOT / "build-apk.sh").read_text(encoding="utf-8")
for k in ["覆盖升级", "yiju.jks", "version.json", "keytool -printcert", "adb install -r", "versionCode"]:
    check(k in apk_sh, "构建脚本含覆盖升级检查 " + k)
check("覆盖升级" in pub_src and "adb install -r" in pub_src, "发布提示词明确要求覆盖升级")
check("不要卸载" in pub_src or "不要卸载旧版" in pub_src, "发布提示词禁止卸载重装")
check("SHA256" in pub_src and "versionCode" in pub_src, "发布提示词要求比对签名指纹与版本递增")
check("覆盖升级" in (ROOT / "RELEASE_LIST.md").read_text(encoding="utf-8"), "产物清单含覆盖升级")

# 9.8) 本轮审查修复的语义问题：确认旧错误不再回来
check('Winner = "0,2,3,4,5"' not in extra_src, "阿瓦隆不再硬编码 5 个好人座位")
check("GoodSeats(s)" in extra_src, "阿瓦隆按真实角色判好人方")
check("队伍 " in extra_src and 'FinishTeam(s, win, "队伍' in extra_src, "四国军棋按对家结队判胜")
check("庄家Bot" not in extra_src and 'variant == "双副"' in extra_src, "21 点变体名副其实")
check("num > cn || v > cv" in extra_src, "大话骰列出完整递增叫点")
check("val == 1" in extra_src and "dice[i] == 1" in extra_src, "大话骰叫 1 点时 1 不再当万能")
check("opts[pos] = q[1]" in extra_src, "积分赛正确项不再永远排第一")
check("bool[] used" in extra_src, "猜数字几A几B 对重复数字算准确")
check("culprit" in extra_src and "solved" in extra_src, "剧本结局按是否指认中真凶分支")
check("clues.ContainsKey(Convert.ToString(pub[k]))" in local, "剧本校验线索引用")
check("Normalize(d, out ve)" in local and "未加载：" in local, "坏本不再静默跳过，房主日志有中文提示")
check("r[\"public\"] = " in local and "a[\"title\"] = " in local, "精简本缺字段被兜底补全（不再回归）")
check("selfPost" in local and "PushHall" in local, "自家馆帖与目录上报")
check("SetSelf(ws" in program and "tick % 3600" in program, "启动与每小时刷新馆帖")
check("Startup.HealthJson(RuleRegistry.Count, Accounts.Count)" in program and
      "yiju-hall/1" in (ROOT / "server/Startup.cs").read_text(encoding="utf-8") and
      "accounts" in (ROOT / "server/Startup.cs").read_text(encoding="utf-8"),
      "健康检查带账号数（同源启动函数）")
check("S.net.send({ t:'scripts' });" not in app.split("function renderVariants")[1].split("function renderRooms")[0],
      "剧本清单不再与 case 'scripts' 形成消息死循环")
check("g === 'juben'" in ren, "剧本杀不在派对面板重复插按钮")
for f in sorted((ROOT / "scripts").glob("*.json")):
    d = json.loads(f.read_text(encoding="utf-8"))
    check("culprit" in d, "剧本含真凶字段 " + f.stem)
    check(any(a.get("when") == "solved" for a in d.get("endings", [])), "剧本含命中结局 " + f.stem)

# 10) 脚本语法
for sh in ["build.sh", "build-apk.sh"]:
    r = subprocess.run(["bash", "-n", sh], cwd=ROOT, capture_output=True, text=True)
    check(r.returncode == 0, "脚本语法 " + sh + ("" if r.returncode == 0 else " → " + r.stderr.strip()[:160]))

# 11) 体积
client = list((ROOT / "client").rglob("*"))
raw = sum(p.stat().st_size for p in client if p.is_file())
gz = sum(len(gzip.compress(p.read_bytes(), 9)) for p in client if p.is_file())
SKIP = {".git", "publish", ".probe", "obj", "bin", "build", ".gradle", "assets"}
all_raw = sum(p.stat().st_size for p in ROOT.rglob("*")
              if p.is_file() and not (set(p.relative_to(ROOT).parts) & SKIP)
              and not p.name.startswith("yiju-") and p.suffix not in {".bundle", ".apk"})
check(raw < 360 * 1024, "客户端原始 < 360 KiB（%.1f KiB，含逐局移植的完整规则引擎 / 离线册 / 49 件妆奁）" % (raw / 1024))
check(gz < 110 * 1024, "客户端 gzip < 110 KiB（%.1f KiB）" % (gz / 1024))

print("=" * 52)
for m in ok: print("  PASS  " + m)
acc = (ROOT / "server/Core/Accounts.cs").read_text(encoding="utf-8")
hub = (ROOT / "server/Core/Hub.cs").read_text(encoding="utf-8")
igr = (ROOT / "server/Rules/IGameRule.cs").read_text(encoding="utf-8")
room = (ROOT / "server/Core/Room.cs").read_text(encoding="utf-8")
opts = (ROOT / "server/Core/RoomOptions.cs").read_text(encoding="utf-8")
html = (ROOT / "client/index.html").read_text(encoding="utf-8")
app = (ROOT / "client/app.js").read_text(encoding="utf-8")
yj = (ROOT / "server/Rules/YiJuan.cs").read_text(encoding="utf-8")
check("class SeasonCalendar" in acc and "2026, 11, 22" in acc and "2027, 1, 1" in acc,
      "赛季历起点与服务端同源")
check("Date.UTC(2026, 10, 22)" in app and "Date.UTC(2027, 0, 1)" in app and "seasonSelfCheck" in app,
      "手机端同源历法与联网自检")
check("class SeasonAuthority" in acc and "Accept(" in acc and '"season"' in hub,
      "天时凭据由棋馆校验，不采信报来的赛季号")
check('foreach (string rf in rankFields) d.Remove(rf);' in acc and '"rankBase"' in acc,
      "导入存档剔除段位字段、段位承袭落加密档")
check('"seasonVerified"' in hub and 'RankMode == "local"' in hub,
      "馆赛与自修统一由棋馆结算")
check("TIME_SOURCES" in app and "qipai.timeUrl" in app and "seasonRecheck" in html,
      "天时源可换、可关、可重校")
check("BotThink" in igr and "EvalBotMove" in igr and "rb.BotThink" in room,
      "六十局共用分级隐士策略")
check('9|弈圣 · 无咎' in opts and 'value="9"' in html and '"弈圣"' in hub,
      "隐士十阶贯通房规、界面与服务端")
check("ROLE_SETS" in yj and "roleNames" in yj and "roleSet" in opts,
      "弈卷两册共四十八家、名册可换")
check("yjCard(la, info)" in (ROOT / "client/render.js").read_text(encoding="utf-8") and "yjLabel(c, rn)" in app,
      "卷面与手牌都显示人物姓名")


acc2 = (ROOT / "server/Core/Accounts.cs").read_text(encoding="utf-8")
hub2 = (ROOT / "server/Core/Hub.cs").read_text(encoding="utf-8")
app2 = (ROOT / "client/app.js").read_text(encoding="utf-8")
html2 = (ROOT / "client/index.html").read_text(encoding="utf-8")
css2 = (ROOT / "client/app.css").read_text(encoding="utf-8")
orig = (ROOT / "server/Rules/OrigSeven.cs").read_text(encoding="utf-8")
readme2 = (ROOT / "README.md").read_text(encoding="utf-8")
check("弈局" in readme2 and ("奕" + "局") not in readme2 and
      ("奕" + "局") not in (ROOT / "android/branding.json").read_text(encoding="utf-8"),
      "App 中文名定为弈局，旧字清零")
check("class ShopBook" in acc2 and '"yizhu"' in acc2 and 't == "shopBuy"' in hub2,
      "弈株外观目录与购买配戴由棋馆校验")
check("renderShop" in app2 and "applyWorn" in app2 and "shopGrid" in html2 and
      "[data-face" in css2 and "data-desk" in css2,
      "妆奁界面与四类外观样式落地")
check("makerJson" in app2 and "openScriptMaker" in app2 and "scriptImport" in app2 and
      "mkCheck" in app2 and "制本" in html2,
      "折狱录制本器含验本 / 下载 / 呈本 / 草稿")
check("SeatOrder" in orig and "TieBreak" in orig and "_r2" in orig and
      "class OrigSevenGame" in orig,
      "七局原创小戏含轮换结算、同分决胜与独立随机流")
check("七局原创小戏" in readme2 and "候漏" in readme2 and "听雨" in readme2,
      "README 清单与教程已同步七局")


acc3 = (ROOT / "server/Core/Accounts.cs").read_text(encoding="utf-8")
hub3 = (ROOT / "server/Core/Hub.cs").read_text(encoding="utf-8")
room3 = (ROOT / "server/Core/Room.cs").read_text(encoding="utf-8")
rule3 = (ROOT / "server/Rules/IGameRule.cs").read_text(encoding="utf-8")
app3 = (ROOT / "client/app.js").read_text(encoding="utf-8")
css3 = (ROOT / "client/app.css").read_text(encoding="utf-8")
fx3 = (ROOT / "client/fx.js").read_text(encoding="utf-8")
sw3 = (ROOT / "client/sw.js").read_text(encoding="utf-8")
check("GOD_NAMES" in acc3 and "弈神" in acc3 and "玄弈神" in acc3 and "太玄弈神" in acc3,
      "神域三尊与逐字加前缀的神衔")
games3 = json.loads((ROOT / "rules/manifest.json").read_text(encoding="utf-8"))["games"]
check(sum(1 for g in games3 if any(o["key"] == "godMode" for o in g.get("options", []))) == 60,
      "60 局皆设神的领域开关")
check("idx < 6" in acc3 and "800 - pts" in acc3 and "GodGate" in hub3,
      "叩域硬前提为此局至弈圣，且由棋馆校验")
check("rb.GodPick(S, seat, GodTier, legal)" in room3 and "GodRollout" in rule3 and "GodPeek" in rule3,
      "三尊走全知深搜与终局推演")
check("Fx.observe" in app3 and "Fx" in app3 and "fx.js" in app3.lower(),
      "卷面华彩接入全部玩法的每帧渲染")
check("yj-sheen" in css3 and "fx-off" in css3 and "[data-fx" in css3,
      "华丽界面动效与一键减动效")
wear_def = (ROOT / "themes/wear.json").read_text(encoding="utf-8")
wear_js = (ROOT / "client/wear.js").read_text(encoding="utf-8")
wear_cs = (ROOT / "server/Core/WearItems.cs").read_text(encoding="utf-8")
check(wear_def.count('"key"') == 49 and wear_js.count('"desk_bamboo"') >= 1 and
      wear_cs.count('Qipai.J.Frame') == 49 and "fx_liuying" in wear_def,
      "49 件妆奁由单一真源生成，两端逐件对齐")
check("/fx.js" in sw3 and "yiju-v3" in sw3 and "/offline-assets.js" in sw3
      and "/settings.js" in sw3 and "/wear.js" in sw3, "离线缓存收录华彩 / 设置 / 妆奁 / 离线册")
check("godInfo" in app3 and "renderGodPanel" in app3 and "godPanel" in (ROOT / "client/index.html").read_text(encoding="utf-8"),
      "设席可见逐玩法叩域进度")


settings_js = (ROOT / "client/settings.js").read_text(encoding="utf-8")
notice_txt = "本项目为开源技术分享，不提供官方游戏服务，不构成面向公众的网络游戏运营。游戏核心体验可完全离线进行。任何使用者自行部署、分发或商业化所产生的合规责任（包括但不限于版号、实名制、个人信息保护），由使用者自行承担。"
for f in ["README.md", "client/app.js", "client/offline-assets.js", "PUBLISH_AGENT.md"]:
    check(notice_txt in (ROOT / f).read_text(encoding="utf-8"), "合规声明在位：" + f)
check(notice_txt in (ROOT / "client/index.html").read_text(encoding="utf-8") or
      "appFooter" in (ROOT / "client/index.html").read_text(encoding="utf-8"),
      "App 内声明挂点与页脚")
check("PolyForm Noncommercial" in (ROOT / "LICENSE").read_text(encoding="utf-8") and
      "MIT" not in (ROOT / "README.md").read_text(encoding="utf-8").split("附 · 本版补录")[0],
      "源码公开 · 禁止商用许可一致")

import re as _re
setting_keys = _re.findall(r"key:'([a-zA-Z0-9_]+)'", settings_js)
check(len(setting_keys) >= 45, "设置项数量与主流对齐（%d 项）" % len(setting_keys))
client_all = "".join(p.read_text(encoding="utf-8") for p in (ROOT / "client").iterdir()
    if p.is_file() and p.suffix in (".js", ".css", ".html") and p.name != "settings.js")
missing = [k for k in setting_keys if k not in client_all]
check(len(missing) == 0, "每项设置都在设置模型之外真接线，无假开关 · 未接：" + ",".join(missing[:8]))
check("GROUPS.forEach" in app_src and "settingsAction" in app_src and "renderSettings" in app_src,
      "设置页按八组渲染并分发隐私动作")
check("accountPassword" in (ROOT / "server/Core/Hub.cs").read_text(encoding="utf-8") and
      "accountDelete" in (ROOT / "server/Core/Hub.cs").read_text(encoding="utf-8") and
      "clearLocalStats" in (ROOT / "server/Core/Hub.cs").read_text(encoding="utf-8"),
      "换口令 / 删账号 / 清本机榜三帧由棋馆真办")
check("ChangePassword" in acc3 and "DeleteAccount" in acc3 and "ClearStats" in (ROOT / "server/Core/LocalData.cs").read_text(encoding="utf-8"),
      "账号管理与战绩清空有实现")

acct3 = (ROOT / "server/Core/Accounts.cs").read_text(encoding="utf-8")
check("MAGIC_LOCAL2" in acct3 and "MAGIC_EXPORT2" in acct3 and "SealV2" in acct3 and "OpenV2" in acct3,
      "存档 V2 封装（子密钥 + 附加认证数据）")
check("accounts.mac" in acct3 and "AtomicWriteBytes" in acct3 and "File.SetUnixFileMode" in acct3,
      "账号表完整性封印 / 原子写 / 私钥 600")
check("Convert.FromBase64String(text)" in acct3 and "Array.Clear(plain" in acct3,
      "读盘先解码、明文缓冲清零（修重启读档隐患）")
check("u.Iter" in acct3 and "ITER_LEGACY" in acct3,
      "口令按账号记录轮数验算，旧存档不丢")
check("winner" in (ROOT / "client/app.js").read_text(encoding="utf-8") and
      "offline-assets.js" in (ROOT / "client/index.html").read_text(encoding="utf-8"),
      "离线内嵌册由普通脚本加载，file:// 不被 CORS 挡")
check("window.__YJ_SEND_GATE__" in (ROOT / "client/net.js").read_text(encoding="utf-8") and
      "externalDir" in app_src and "wifiOnly" in app_src and "isCellular" in app_src,
      "外部名录 / 校时 / 榜单逐项可关，蜂窝下自动跳过")
check("requestAnimationFrame" in app_src and "S._lastSig" in app_src and "S.rafPending" in app_src,
      "每帧合帧与帧签名脏重绘")
check("showLegal" in (ROOT / "client/render.js").read_text(encoding="utf-8") and
      "--q-dpr" in css3 and "--fontScale" in css3,
      "画质档 / 字大 / 可落点开关接到渲染层")
check("shopTry" in app_src and "spBuy" in app_src and "WEAR_SETS" in app_src,
      "商店预览 / 试穿 / 定妆 / 购买确认成套")
check("YJ_NOTICE" in app_src and "renderNotice" in app_src and "openGuide" in app_src,
      "声明弹窗、页脚与六步入引同文")


for rel in ["start.sh", "start.bat", "yiju.conf", "server/Startup.cs", "AGENT_PROMPT.md"]:
    check((ROOT / rel).is_file(), "一键启动 / 最终提示词文件在位：" + rel)
import subprocess as _sp
for sh in ["start.sh", "build.sh", "build-apk.sh"]:
    r = _sp.run(["bash", "-n", str(ROOT / sh)], capture_output=True, text=True)
    check(r.returncode == 0, "脚本语法通过：" + sh + " · " + r.stderr.strip()[:120])
startup = (ROOT / "server/Startup.cs").read_text(encoding="utf-8")
check(all(k in startup for k in ["StartupOptions", "ReadConfig", "EnsureConfig", "EnsureLayout",
      "LanAddresses", "HealthJson", "InfoJson", "WsAccept", "WsUpgradeResponse", "HelpText"]),
      "同源启动模块：配置 / 启动项 / 布局 / 健康检查 / WS 升级")
prog = (ROOT / "server/Program.cs").read_text(encoding="utf-8")
check("StartupOptions.Load" in prog and "Startup.HealthJson" in prog and
      "Startup.InfoJson" in prog and '/api/startup' in prog and "Startup.Hint" in prog,
      "宿主层接入一键配置与启动项，四个端点同源")
conf = (ROOT / "yiju.conf").read_text(encoding="utf-8")
check(all(k in conf for k in ["HOST=", "PORT=", "HALL=", "DIRECTORY=", "TIME=", "BOARDS=", "ROOT=", "OPEN="]),
      "默认配置八项齐备")
help_txt = startup
check(all(f in help_txt for f in ["--url", "--port", "--host", "--hall", "--root", "--directory",
      "--no-directory", "--time", "--no-time", "--boards", "--no-boards", "--open", "--build",
      "--config", "--help", "--version", "QIPAI_URL", "YIJU_CONF"]),
      "启动项全表覆盖参数与环境变量")
agent = (ROOT / "AGENT_PROMPT.md").read_text(encoding="utf-8")
check(notice_txt in agent and "只上传 `yiju.apk` 一个文件" in agent and
      "覆盖升级" in agent and "禁止卸载重装" in agent and "报错即停" in agent.replace("任一步失败即停", "报错即停"),
      "给 agent 的最终提示词自含声明 / 单 APK / 覆盖升级 / 失败即停")
check("## 一键启动 · 启动项" in (ROOT / "README.md").read_text(encoding="utf-8") and
      "./start.sh" in (ROOT / "README.md").read_text(encoding="utf-8"),
      "README 有一键启动与启动项说明")
check("ServerBootSmoke" in (ROOT / "README.md").read_text(encoding="utf-8") or
      "真实 TCP" in (ROOT / "README.md").read_text(encoding="utf-8"),
      "README 如实写明服务器可用性验证方式")

print("静态自检： %d 通过 / %d 失败" % (len(ok), len(err)))
for m in err: print("  FAIL  " + m)
print("=" * 52)

print("体积：客户端 %.1f KiB 原始 / %.1f KiB gzip / 全仓 %.1f KiB" %
      (raw / 1024, gz / 1024, all_raw / 1024))
sys.exit(1 if err else 0)
