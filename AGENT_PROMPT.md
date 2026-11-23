> **v6 修订（以此为准，旧口径全部让位）**
> 1. 本版是**横屏源码仓库**（不是单文件原型）。大厅 / 注册 / 登录 / 对局 / 设置全部横屏；只有「轮弦」按形态分族做成居中竖卷。原生 `screenOrientation="landscape"`，窗口纸色 + `env(safe-area-inset-*)` 由原生下发，前端不再自己算高度。
> 2. **6 局专精 + 轮弦副推**：玩法册只开 6 局；60 局规则实现保留在 `client/rules-port/` 不删除、不覆盖，只是不进玩法册。改规则仍改 C# 源后重跑 `tools/cs2js.py`。
> 3. 研究结论已落地：事件反馈谱（落子/吃子/将军/连五/终局/突破各有古器音色 + 同帧涟漪，非装饰光环）、古乐物理建模合成（Karplus-Strong 琴 / 箫 / 编钟非谐分音 / 混响 / 散板，零音频文件）、终局三钟与突破五钟余韵收短约 3 秒、终局大字自动淡出、bot 可见化、不催促型留存（连日不清零不补签、题记真内容）、导航四层（状态机 + 栈 + 互斥根 + 守卫，对局中离局要确认）、闲谈/对话从界面移除、棋盘占比按横屏放大、设置页浅底深字。
> 4. 不要重新设计、不要改玩法规则、不要把 60 局重新塞回玩法册、不要动 keystore / workflow / 图标（仍是用户原图 64×64 纯黑三色）/ 合规声明 / LICENSE。
> 5. `versionCode` 已到 **5**，固定 keystore 可覆盖安装。Release 仍发 `yiju.apk` + `yiju-release.zip` 两个资产。

# 给 agent 的最终提示词（可直接复制 · v5.2 · 现行口径）

> **v5.2 修订（权威性最高，冲突处以本段为准；v5 / v3 / v2 / 历史正文全部让位）**
> 本源码包**已完成横屏重构与全部收尾**，agent 只需「落地改动 + 推代码 + 跑 CI」，**不要重新设计、不要改玩法规则、不要改页面布局、不要另建 workflow**。
> 1. 仓库 `https://github.com/lutqiu1121-cpu/yiju`（分支 `master`）已存在且已有内容；未登录匿名视角的 `This repository is empty.` 是权限表现，不是真没代码，**不要再让用户贴 `git remote -v` 或 push 输出自证**。
> 2. **Android 强制横屏**（`screenOrientation="landscape"`）。**首次进入是本机注册页**：像游戏创建角色一样填称呼（2–12 字）+ 挑标记，不用手机号 / 密码 / 邮箱、不上传、不联网；点「创建棋客」那一刻才签发凭证（`YJ-XXXX-XXXX-XXXX`），随后才进登录页。已注册则直接进登录页。登录页默认「本地模式 · 可局域网联机」，服务器地址**可填可不填**，提示条**可关**；好友凭凭证添加，在线状态只在同棋馆 / 局域网内可见，**不连公网、不设账号服务器**。
> 3. 大厅按横屏骨架排布：顶栏 / 左好友 / 中央大「对弈」/ 右入口列 / 底部 tab。点「对弈」是**弹层**（专精 6 局 → 二级「更多对弈」52 局），**不是整页跳转**；装扮已从案牍里独立成页；设置页黑底黑字、题记空白、提示被键盘遮挡、象棋红黑难辨、寻局光效闪断，全部已修。
> 4. App 图标**就用用户给的 512×512 原图**：`render_branding.py` 的 `ICON_GRID` 已逐格还原为 64×64，米白底 `#F5F1E6` + **纯黑墨 `#000000`** 的像素「弈」字 + 朱砂 `#9B092D` 点，**不加边框、不加右下印章、不改字形与朱砂位置**。生成 adaptive icon / 512 PNG / `android/branding.sha256`，`build-apk.sh` 与 CI 逐步核对哈希与 APK 内资源，**不要手改生成物、不要换 preset、不要再自作主张加装饰**。
> 5. **Release 口径统一**：所有 tag（测试版与正式版）都上传 **两个资产 `yiju.apk` + `yiju-release.zip`**。下文 / `PUBLISH_AGENT.md` / `README.md` 里任何「正式版只上传 `yiju.apk` 一个文件」「不上传 `yiju-release.zip`」的旧句**一律作废**。
> 6. 验收已全绿：静态自检 **799/0**、JS 语法 **21/21**、60 局原规则 **60/60**、真实走法 **10/10**、断网集成 **4/4**、**横屏 HTML 真浏览器 `tools/ui-e2e.cjs` 43/43**（含 960×400 矮横屏铺满 / 不裁底；截图与报告在 `ui-shots/`）。图标产物与用户原图硬量化后 **262144 像素逐像素一致、4096 格采样 0 处偏差**；`verify.py` 已加断言拦住「压成 32×32 / 加框加印章 / 改三色」。CI 用 `apksigner` 取指纹，不再用 `keytool -printcert -jarfile`。
> 7. 固定 keystore / `applicationId` / 合规声明 / LICENSE / 规则实现存档一律不动；**不需要任何签名 Secret、PAT 或口令**。服务端能否实起仍需 .NET 8 机器上跑 `./start.sh`，CI 不替代。
> 8. **v5.2 三处修订**：① 首次进入是**注册页**（填称呼 + 挑标记）而非直接分配凭证，凭证在「创建棋客」那一刻才签发；已注册直接进登录页。② 注册 / 登录页横屏**两栏铺满**（`100dvh` + 可滚动 + 主按钮 sticky），原生层加米白 `windowBackground` / `resizeableActivity=true`、关掉 `setLoadWithOverviewMode(true)` 消除黑边；矮屏不再裁底、浮条不再遮挡表单。③ `versionCode` 已递增到 **4**（`versionName 1.2.0`），可直接覆盖已装版本；若仓库里是 3，以整包为准改成 4，不要回退、不要再 bump 第二次。

---

> **v3 修订（历史参考，与 v5 冲突处以 v5 为准）**
> 本源码包**已完成全部改版**，不需要 agent 再设计、再改代码、再补 workflow：
> 1. 仓库 `https://github.com/lutqiu1121-cpu/yiju`（分支 `master`）**已存在且已有内容**（用户已确认）。未登录的匿名视角显示 `This repository is empty.` 属权限/私有仓库的正常表现，**不是真没代码，不要再要求用户贴 `git remote -v` 或 push 输出自证**。包内已自带 `.git` 与配好的 `origin`：若远端是同源历史，`git fetch origin master` 后直接 `git push -u origin master`；若提示 non-fast-forward，**改用随附的 `yiju_v3.patch` 在现有仓库上 `git apply`**，不要 `init`、不要 `remote add`、不要 force、不要覆盖远端历史。
> 2. `.github/workflows/release.yml` **已随包提供**（零 Secret、用默认 `GITHUB_TOKEN`、首发 versionCode 放行、指纹实测、真实报错即停）。**不要再新建或覆盖它**。请在仓库 Settings → Actions → General 把 Workflow permissions 勾为 **Read and write**。
> 3. 固定 keystore `android/keystore/yiju.jks` 及公开构建口令已在仓库里（`yiju` / `yijuarchive`），**不需要任何签名 Secrets、PAT、或向用户索取口令**；已清空的 Secrets 不必补回。
> 4. 本版已落地：APK 壳改用虚拟安全源 `https://yiju.local/` 修复 ES module 被 CORS 拒载导致的「全页点不动」；**离线 60 局已全部走服务端原规则，无简式、无待搬项**：`server/Rules/*.cs` 由 `tools/cs2js.py` 一次性定向转译为 `client/rules-port/all-rules.js`，语义差异由 `cs-runtime.js` 垫片吸收，`registry.js` 全量登记；三项验收（`node --check`、`rules-vector.test.mjs` 10/10、`rules-all.test.mjs` 60/60 + 定向终局 + 断网集成 4/4）已全绿，逐局清单见 `RULES_PORT_STATUS.md`。**不要再分批搬运、不要再改规则逻辑**；改规则须改 C# 源后重跑转译与三项验收。CI 已接入双验收脚本。此外：寻局进度条完整走一拍再切棋盘，修掉光效一闪像卡顿；浅色统一 App 图标；修仙境界 + 纯本地签到；专精 6 局 + 轮弦副推；「玩法」显示文案改「对弈」；**词汇只简化真正生僻的**（妆奁→装扮、折狱录制本器→剧本工具、制本器→剧本编辑、卷面华彩→界面特效、覆简启简→覆牌比序），**弈株 / 品阶 / 套系等通俗词一律保留原文**；`RuleTests.csproj` 补 `Json.cs`；CI 工作流补齐。
> 5. **合规声明、LICENSE、60 局注册、固定签名根、applicationId 一律不得改动**。README / PUBLISH_AGENT.md 里那段技术与合规声明逐字保留。
> 6. 因此 agent 的任务只有两件：**把本版改动落到现有仓库**、**跑 CI 并如实回报 Actions 链接 / Release 链接 / `yiju.apk` + `yiju-release.zip` 直链 / 签名 SHA256**。不要重新设计、不要改玩法规则、不要伪造产物、不要模拟成功。
> 7. 服务端能否实起仍需把 `yiju-release.zip` 放上 .NET 8 机器跑 `./start.sh` 验证，CI 不替代这一步。

---

# 给 agent 的最终提示词（历史正文 · v2，仅作参考）

> 复制「提示词正文」整段发给 agent。本文件已放进仓库，推上去后新对话也可直接让 agent 读它。

## 基线事实（写死，不要重新讨论）
- GitHub 仓库**已建好且当前为空**：`https://github.com/lutqiu1121-cpu/yiju`，分支 `master`。随附的 `弈局_yiju_源码仓库.zip` **解压后已自带 `.git` 与配好的 `origin`**（指向该仓库、公开 https、无任何账号或令牌），`git status` 干净、含完整提交历史，**直接 `git push -u origin master` 即可，不需要 `git init`、不需要 `remote add`**。
- yiju **从未发布、从未安装过任何 APK**，不存在旧签名，也不存在「换密钥就覆盖不了」的问题。
- 固定签名**已经随仓库分发**：`android/keystore/yiju.jks`，别名 `yiju`、storepass/keypass `yijuarchive`（见 `android/keystore/README.md` 与 `android/app/build.gradle` 默认值）。这是公开仓库里的公开密钥，只用于保证「各版本签名一致、可覆盖升级」，不是账号凭证。
- 因此：**不需要新建/替换 keystore，不需要任何签名 Secrets，不需要向用户索取或写入任何口令**。`bash build-apk.sh` 直接就能出同签名包。已清空仓库 Actions Secrets 属正常，不必补回。

## 提示词正文

请阅读并执行本仓库根目录下的 `AGENT_PROMPT.md`（即本文件）与 `PUBLISH_AGENT.md`，一次性完成上传、构建与发布，不要询问、不要擅自改设计、不要加玩法。

**一、上传代码（仓库已存在，不要新建仓库）**
1. 解压随附的 `弈局_yiju_源码仓库.zip`，进入解压出的目录（内含 `.git/`、`AGENT_PROMPT.md`、`PUBLISH_AGENT.md`、`android/keystore/yiju.jks` 与全部源码）。先 `git status` 确认干净，**不要 `git init`、不要改 `.git/config`**（`origin` 已配好）。`PUBLISH_AGENT.md` 旧文里「没有 origin 就停下问」「不要再 git init」以本条为准。
2. 直接推送：`git push -u origin master`。**不要** force、不要改历史、不要另建仓库、不要换分支名。
   - 兜底：仅当解压确实丢了 `.git/`（少见）时，才用随附 `qipai-repo.bundle` 重建：`git init yiju && cd yiju` → `git fetch <bundle路径> HEAD:refs/heads/imported` → `git checkout imported` → `git branch -m master` → `git remote add origin https://github.com/lutqiu1121-cpu/yiju.git` → `git push -u origin master`。（`git clone <bundle> yiju` 若报 `pread` / `index-pack` 错，一律用这条 fetch 写法。）
3. 保持目录结构、文件名、`LICENSE`、合规声明不变。`LICENSE` 是 **PolyForm Noncommercial 1.0.0**（源码公开 · 禁止商用）。README 抬头、App 设置页、入门小引、页脚、`PUBLISH_AGENT.md` 里那段技术与合规声明必须逐字保留，不得删改：
   > 本项目为开源技术分享，不提供官方游戏服务，不构成面向公众的网络游戏运营。游戏核心体验可完全离线进行。任何使用者自行部署、分发或商业化所产生的合规责任（包括但不限于版号、实名制、个人信息保护），由使用者自行承担。
4. `AGENT_PROMPT.md` 与 `PUBLISH_AGENT.md` 一并随仓库上传。`scripts/` 与 `leaderboard/` 不碰不传；不新增、删除、改名任何玩法（当前专精 6 局 + 轮弦）。

**二、CI 工作流（GitHub 托管 runner）**
5. 新增 `.github/workflows/release.yml`：检出代码 → 装 .NET 8 SDK、JDK 17、Android SDK（platform android-33 + build-tools）→ 跑 `python3 tools/verify.py`、`node tools/net-url.test.mjs`、`bash -n build.sh && bash -n build-apk.sh && bash -n start.sh` → `bash build.sh` → `bash build-apk.sh`。
6. CI 使用默认 `GITHUB_TOKEN`（仓库 Settings → Actions → General → Workflow permissions 开 **Read and write** 即可），**不需要** `GH_TOKEN`、不需要任何签名 Secrets、不需要 PAT。签名参数走 `build.gradle` 里已写死的默认值，**不要**在 CI 里设置 `YIJU_KEYSTORE` / `YIJU_STOREPASS` / `YIJU_KEYPASS` / `YIJU_ALIAS`（一设签名就变，覆盖链断掉）。
7. 构建前校验，任一不过即中止、不上传：`applicationId = app.yiju.archive`；APK 签名证书 SHA256 与仓库首次记录值一致；`android/version.json` 的 `versionCode` 严格递增（首发为 1，发布后回写 +1）。覆盖升级三件套＝固定 keystore + 固定 applicationId + 递增 versionCode，**禁止卸载重装**，装新版用 `adb install -r yiju.apk` 或手机直接点 APK 覆盖。
8. 凭证边界：不读取、不打印、不写入任何**账号**口令、令牌或登录态；不执行 `gh auth login`、不做 `git config --global`、不改 `.git/config`。仓库里公开的 jks 默认口令属于构建配置、不是账号凭证，按第 6 条直接沿用即可，无需向任何人索取。

**三、发布**
9. 首发 tag `v1.0.0-test.1`，以 **Pre-release（测试版）** 发布，标题「弈局 yiju v1.0.0 测试版 · 服务端联机实测」。
10. **所有 Release**都上传两个资产：`yiju.apk` + `yiju-release.zip`（服务端包，供 .NET 8 服务器 `./start.sh` 实测）。`SIZES.txt`、源码包、bundle 仅本地留档，不进 Release。
11. Release 正文写清：6 局专精 + 轮弦副推（含七局原创）、折狱录制本、弈株装扮 49 件、隐士十阶、神的领域三尊、按最高段位定隐士的房规、分池寻局与进度条；房主一键启动 `./start.sh`（Windows `start.bat`），改 `yiju.conf` 即改端口 / 匾额 / 名录 / 校时 / 榜单，可 `--port 9000 --no-directory` 临时覆盖；棋馆地址**任意可达地址**都认（局域网 IP / 域名 / IPv6 / 带路径 / 本机回环），端口写不写都行，不写补可配置的缺省端口；服务器只是可选项——本机自弈完全不联网可用全部除多人联机外的功能，局域网联机不需外部服务，名录 / 校时 / 榜单默认开但可全关、挂了自动降级；源码公开 · 禁止商用，以及上面那段技术与合规声明全文。
12. 如实说明：本版服务端宿主未经实起验证，APK 由 GitHub CI 真实产出；不得声称「服务器已验证可用」。任一步失败即停并原样贴报错，不要绕过、不要伪造构建或发布结果。

**四、交付回报**
完成后给我：仓库地址、Actions 运行链接、Release 链接、`yiju.apk` 直链、签名证书 SHA256 指纹、`versionCode`、以及第 5–7 步的真实输出摘要。

## 不要做的事
不要新建仓库、不要改分支名、不要换许可、不要改声明、不要动 `scripts/` `leaderboard/`、不要加玩法、不要新建或替换 keystore、不要设签名环境变量、不要索要任何口令、不要卸载重装式升级、不要把正式版 Release 塞成多个文件。
