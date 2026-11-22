# 给 agent 的最终提示词（可直接复制）

> 这是**首次**把项目交给 agent。复制下面「提示词正文」整段即可，文件清单在后面。

## 提示词正文

请新建并上传「弈局 / yiju」项目到 GitHub，按下面的要求一次性完成，不要询问、不要擅自改设计、不要加玩法。

**一、来源与建库**
1. 用随附的 `弈局_yiju_源码仓库.zip` 解压，或 `git clone qipai-repo.bundle yiju` 取得源码（bundle 离线可 clone，HEAD 应为一个干净提交）。
2. 新建仓库，把源码根目录的全部文件作为初始提交上传；保持目录结构、文件名、LICENSE 与 `AGENT_PROMPT.md` 不变。
3. `LICENSE` 是 **PolyForm Noncommercial 1.0.0**（源码公开 · 禁止商用）。README 抬头、App 设置页、入门小引、页脚、`PUBLISH_AGENT.md` 里那段技术与合规声明必须逐字保留，不得删改：
   > 本项目为开源技术分享，不提供官方游戏服务，不构成面向公众的网络游戏运营。游戏核心体验可完全离线进行。任何使用者自行部署、分发或商业化所产生的合规责任（包括但不限于版号、实名制、个人信息保护），由使用者自行承担。

**二、构建与发布**
4. 构建顺序固定：`bash build.sh` → `bash build-apk.sh`。`build.sh` 会先重生成 `client/offline-assets.js` 与 `client/wear.js`（生成物不要手改，改 `themes/wear.json` 或 `rules/manifest.json`）。
5. **Release 只上传 `yiju.apk` 一个文件**。`yiju-release.zip`、`yiju-source.zip`、`SIZES.txt`、源码包、bundle 仅本地留档，不进 Release。
6. 覆盖升级硬要求：固定 `android/keystore/yiju.jks`、固定包名 `app.yiju.archive`、`versionCode` 每次 +1；提示用户用 `adb install -r yiju.apk` 或手机直接点 APK 覆盖，**禁止卸载重装**。构建脚本要打印签名 `SHA256:` 供逐版比对。
7. 凭证零接触：不索要、不读取、不写入任何账号口令、令牌或签名口令；任一步失败即停并原样报告，不要自行绕过。
8. `scripts/` 与 `leaderboard/` 不碰不传；不新增、删除、改名任何玩法（当前 60 局）。

**三、交付前自检（在构建环境里真跑）**
9. `python3 tools/verify.py` 静态自检必须 0 失败；`node tools/net-url.test.mjs` 地址解析测试全过；`bash -n build.sh && bash -n build-apk.sh && bash -n start.sh`。
10. 服务端启动项：`dotnet run --project server -- --help` 能打印全部启动项；`./start.sh --help` 同样可用。一键配置 `yiju.conf`、`start.sh`、`start.bat`、`server/Startup.cs` 必须随仓库上传。
11. 若环境有 .NET 8：用 `./start.sh` 实起棋馆，`curl http://localhost:5080/api/health` 应返回 `ok:true` 与 `games:60`；`/api/info`、`/api/startup` 可读，`/ws` 可完成 WebSocket 升级。起完后关掉进程。
12. 如实说明：若环境没有 .NET 8 / Android SDK，宿主层与 APK 未能实构建，必须在结果里写明，不要声称已起过服务或已出包。

**四、Release 说明里要写清**
- 60 个玩法、折狱录制本、弈株妆奁 49 件、隐士十阶、神的领域三尊、按最高段位定隐士的房规、分池寻局与进度条。
- 房主一键启动：`./start.sh`（Windows `start.bat`），改 `yiju.conf` 即改端口 / 匾额 / 名录 / 校时 / 榜单；`./start.sh --port 9000 --no-directory` 可临时覆盖。
- 棋馆地址**任意可达地址**都认（局域网 IP / 域名 / IPv6 / 带路径 / 本机回环），端口写不写都行，不写补可配置的「缺省端口」；不要写成「只能填某个 IP:5080」。
- 服务器只是可选项：本机自弈完全不联网可用全部除多人联机外的功能；局域网联机不需外部服务；名录 / 校时 / 榜单默认开但可全关、挂了自动降级。
- 源码公开 · 禁止商用；那段技术与合规声明全文。

**五、不要做的事**
- 不要改名 App（弈局 / yiju）、不要换许可、不要改声明、不要动 `scripts/` `leaderboard/`、不要加玩法、不要把 Release 塞成多个文件、不要卸载重装式升级、不要向用户索取任何凭证。

完成后给我：仓库地址、Release 链接、`yiju.apk` 直链、签名 SHA256、`versionCode`、以及第 9–11 步的真实输出摘要。

## 随附文件（首次交付，三件）

| 文件 | 用途 |
|---|---|
| `AGENT_PROMPT.md` | 本文件，给 agent 的提示词 |
| `弈局_yiju_源码仓库.zip` | 源码根目录，直接解压上传 |
| `qipai-repo.bundle` | 离线 git bundle，`git clone` 即可拿到完整单提交历史 |

另附 `PUBLISH_AGENT.md`（仓库内）为构建与发布的完整核对清单，`终版加固与合规改版说明.md` 为本版改动说明，二者供你留档，不必再发给 agent。
