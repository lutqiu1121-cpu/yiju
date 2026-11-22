# 给 agent 的最终提示词（可直接复制 · v2）

> 复制「提示词正文」整段发给 agent。本文件已放进仓库，推上去后新对话也可直接让 agent 读它。

## 基线事实（写死，不要重新讨论）
- GitHub 仓库**已建好且当前为空**：`https://github.com/lutqiu1121-cpu/yiju`，分支 `master`（bundle 的 HEAD 是 `ef5fe4d`）。
- yiju **从未发布、从未安装过任何 APK**，不存在旧签名，也不存在「换密钥就覆盖不了」的问题。
- 固定签名**已经随仓库分发**：`android/keystore/yiju.jks`，别名 `yiju`、storepass/keypass `yijuarchive`（见 `android/keystore/README.md` 与 `android/app/build.gradle` 默认值）。这是公开仓库里的公开密钥，只用于保证「各版本签名一致、可覆盖升级」，不是账号凭证。
- 因此：**不需要新建/替换 keystore，不需要任何签名 Secrets，不需要向用户索取或写入任何口令**。`bash build-apk.sh` 直接就能出同签名包。已清空仓库 Actions Secrets 属正常，不必补回。

## 提示词正文

请阅读并执行本仓库根目录下的 `AGENT_PROMPT.md`（即本文件）与 `PUBLISH_AGENT.md`，一次性完成上传、构建与发布，不要询问、不要擅自改设计、不要加玩法。

**一、上传代码（仓库已存在，不要新建仓库）**
1. 用随附的 `弈局_yiju_源码仓库.zip` 解压，或 `git clone qipai-repo.bundle yiju` 取得源码（bundle 离线可 clone，含完整提交历史）。
2. 目标远程固定为 `https://github.com/lutqiu1121-cpu/yiju`（若未配 remote 则 `git remote add origin <地址>`），推送分支 `master`：`git push -u origin master`。**不要** force、不要改历史、不要另建仓库。
3. 保持目录结构、文件名、`LICENSE`、合规声明不变。`LICENSE` 是 **PolyForm Noncommercial 1.0.0**（源码公开 · 禁止商用）。README 抬头、App 设置页、入门小引、页脚、`PUBLISH_AGENT.md` 里那段技术与合规声明必须逐字保留，不得删改：
   > 本项目为开源技术分享，不提供官方游戏服务，不构成面向公众的网络游戏运营。游戏核心体验可完全离线进行。任何使用者自行部署、分发或商业化所产生的合规责任（包括但不限于版号、实名制、个人信息保护），由使用者自行承担。
4. `AGENT_PROMPT.md` 与 `PUBLISH_AGENT.md` 一并随仓库上传。`scripts/` 与 `leaderboard/` 不碰不传；不新增、删除、改名任何玩法（当前 60 局）。

**二、CI 工作流（GitHub 托管 runner）**
5. 新增 `.github/workflows/release.yml`：检出代码 → 装 .NET 8 SDK、JDK 17、Android SDK（platform android-33 + build-tools）→ 跑 `python3 tools/verify.py`、`node tools/net-url.test.mjs`、`bash -n build.sh && bash -n build-apk.sh && bash -n start.sh` → `bash build.sh` → `bash build-apk.sh`。
6. CI 使用默认 `GITHUB_TOKEN`（仓库 Settings → Actions → General → Workflow permissions 开 **Read and write** 即可），**不需要** `GH_TOKEN`、不需要任何签名 Secrets、不需要 PAT。签名参数走 `build.gradle` 里已写死的默认值，**不要**在 CI 里设置 `YIJU_KEYSTORE` / `YIJU_STOREPASS` / `YIJU_KEYPASS` / `YIJU_ALIAS`（一设签名就变，覆盖链断掉）。
7. 构建前校验，任一不过即中止、不上传：`applicationId = app.yiju.archive`；APK 签名证书 SHA256 与仓库首次记录值一致；`android/version.json` 的 `versionCode` 严格递增（首发为 1，发布后回写 +1）。覆盖升级三件套＝固定 keystore + 固定 applicationId + 递增 versionCode，**禁止卸载重装**，装新版用 `adb install -r yiju.apk` 或手机直接点 APK 覆盖。
8. 凭证边界：不读取、不打印、不写入任何**账号**口令、令牌或登录态；不执行 `gh auth login`、不做 `git config --global`、不改 `.git/config`。仓库里公开的 jks 默认口令属于构建配置、不是账号凭证，按第 6 条直接沿用即可，无需向任何人索取。

**三、发布**
9. 首发 tag `v1.0.0-test.1`，以 **Pre-release（测试版）** 发布，标题「弈局 yiju v1.0.0 测试版 · 服务端联机实测」。
10. **测试版**允许上传两个资产：`yiju.apk` + `yiju-release.zip`（服务端包，供 .NET 8 服务器 `./start.sh` 实测）。正式版恢复「只上传 `yiju.apk` 一个文件」。`SIZES.txt`、源码包、bundle 仅本地留档，不进 Release。
11. Release 正文写清：60 个玩法（含七局原创）、折狱录制本、弈株妆奁 49 件、隐士十阶、神的领域三尊、按最高段位定隐士的房规、分池寻局与进度条；房主一键启动 `./start.sh`（Windows `start.bat`），改 `yiju.conf` 即改端口 / 匾额 / 名录 / 校时 / 榜单，可 `--port 9000 --no-directory` 临时覆盖；棋馆地址**任意可达地址**都认（局域网 IP / 域名 / IPv6 / 带路径 / 本机回环），端口写不写都行，不写补可配置的缺省端口；服务器只是可选项——本机自弈完全不联网可用全部除多人联机外的功能，局域网联机不需外部服务，名录 / 校时 / 榜单默认开但可全关、挂了自动降级；源码公开 · 禁止商用，以及上面那段技术与合规声明全文。
12. 如实说明：本版服务端宿主未经实起验证，APK 由 GitHub CI 真实产出；不得声称「服务器已验证可用」。任一步失败即停并原样贴报错，不要绕过、不要伪造构建或发布结果。

**四、交付回报**
完成后给我：仓库地址、Actions 运行链接、Release 链接、`yiju.apk` 直链、签名证书 SHA256 指纹、`versionCode`、以及第 5–7 步的真实输出摘要。

## 不要做的事
不要新建仓库、不要改分支名、不要换许可、不要改声明、不要动 `scripts/` `leaderboard/`、不要加玩法、不要新建或替换 keystore、不要设签名环境变量、不要索要任何口令、不要卸载重装式升级、不要把正式版 Release 塞成多个文件。
