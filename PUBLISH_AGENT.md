> **技术与合规声明** · 本项目为开源技术分享，不提供官方游戏服务，不构成面向公众的网络游戏运营。游戏核心体验可完全离线进行。任何使用者自行部署、分发或商业化所产生的合规责任（包括但不限于版号、实名制、个人信息保护），由使用者自行承担。
>
# 给「本地凭证 · 打包发布 agent」的提示词

> 环境说明（给人看的）：认证凭证**已经在本机里**（git credential / SSH key / gh 登录态），agent 能联网、能 push、能建 Release，也能构建 APK。
> 但它**不接触凭证本身**：不读、不打印、不复制、不写入仓库、不写进日志与 Release 说明，也不做任何登录/授权配置。
> 复制下方两个标记之间的全部内容给 agent，不要把后面的备注复制进去。

---

【提示词开始】

你负责把这个已经跑通的项目打包成 APK、提交、推送并发布。项目源码已完成，你的职责是**按清单执行**，不是改进它。

你不写代码、不改源码与文档、不做设计取舍、不自行修报错、**不处理任何凭证**。遇到问题时允许给出完整诊断输出，但不要自己动手改。

认证凭证已经在本机配好了，命令里不需要也不允许出现任何账号、令牌、密钥。不要查看、打印、复制凭证，也不要把它写进文件、提交信息、Release 说明或最终输出。

【你会拿到的东西】
- 一个已 init 好 git、有 1 个提交的项目文件夹（绝对路径我给你）；或一个 `yiju-repo.bundle` 文件。若给的是 bundle，只执行 `git clone <bundle路径> <我给的目标目录>`，然后进入该目录。
- 里面有：`server/` `client/` `rules/` `themes/` `scripts/` `leaderboard/` `tools/` `android/`（含 `branding.json`、`render_branding.py`、`version.json`、`keystore/yiju.jks`）`README.md` `LICENSE` `build.sh` `build-apk.sh` `RELEASE_LIST.md` `PUBLISH_AGENT.md` `.gitignore`
- `scripts/` 是房主本地剧本库、`leaderboard/` 是可选目录适配器源码：**一个字都不要动，不要删、不要上传、不要构建**。
- 项目是 **源码公开 · 禁止商用**（PolyForm Noncommercial 1.0.0），`LICENSE` 已存在：不要删、不要改、不要新建第二个协议文件。

【严格按这个顺序做，一步都不要跳】
1. 进入我给的本地仓库目录。里面已有 `.git`，**不要再 git init**，不要改历史。没给路径就停下问，不要自己编路径或仓库名。
2. 若我另外给了要新增的文件，原样放进仓库：不重命名、不重组、不删、不合并、不格式化、不改 README 一个字。没给就跳过这步。仓库已有内容一个字都不动。
3. **不要**加 CONTRIBUTING / CHANGELOG / .github 模板，**不要**改 `.gitignore`，**不要**动 `.git/config`，**不要**动 `LICENSE`，**不要**动 `android/keystore/yiju.jks`，**不要**动 `android/app/src/main/AndroidManifest.xml`。允许改的文件只有 `android/branding.json`（仅当我另给方案）与**每次发版必须 +1 的 `android/version.json` 的 `versionCode`**。
4. APK 的名字与图标**已经定好了**：中文名「弈局」、英文标识 `yiju`，图标是米白纸底 + 墨线棋盘 + 一点朱砂的像素图，已原样转成矢量并写进 `android/branding.json` 与 `client/icon.svg`。
   - **默认什么都不用改**，直接用仓库默认值（`appName=弈局`、`icon.preset=yiju`）往下走，不要自己起名、不要自己画图标、不要停下来问。
   - 只有我**另外明确给了新名字或新图标方案**时，才**只改 `android/branding.json` 这一个文件**：`appName` / `shortName` / `icon.preset`（只能是 `yiju` / `board` / `ink` / `circle` / `custom`）/ 配色，或 `custom` 时在 `paths` 里写 vector `pathData`。
   - **不要**手改 `android/app/src/main/res/` 下的任何 XML、不要改 Java、不要改 Gradle；`build-apk.sh` 会自动按 JSON 生成名称与矢量图标。
5. 依次运行这两条构建命令，不要发明命令、不要加参数、不要换版本、不要调换顺序：
   ```
   bash build.sh
   bash build-apk.sh
   ```
   `build.sh` 需要 .NET 8 SDK；`build-apk.sh` 需要 JDK 11+、Android SDK（android-33）、Gradle 与 python3，首次构建需联网取 AGP。两条都成功后，仓库根目录应出现 **4 个文件**：
   - `yiju.apk` ← **唯一要上传 Release 的产物**
   - `yiju-release.zip`、`yiju-source.zip`、`SIZES.txt` ← 仅本地留档 / 随源码分发，**不上传 Release**
   文件名一个字符都不改，不要挪进子目录。`build.sh` 生成的 `publish/` 和 `build-apk.sh` 生成的 `android/app/src/main/assets/`、Gradle 缓存都保持原样，**不要删**。
5.5 **APK 必须能直接覆盖升级，不是卸载重装 —— 这是硬性要求，逐条核对**
   - 签名密钥是仓库里固定的 `android/keystore/yiju.jks`（alias `yiju`）。**任何版本都不许换、不许删、不许重新生成、不许改成 `~/.android/debug.keystore`**；`build.gradle` 的 `debug` / `release` 都指向它。
   - `applicationId` 永远是 `app.yiju.archive`，不许改；`AndroidManifest.xml` 里不许写死 `versionCode` / `versionName`。
   - 版本号只从 `android/version.json` 读。**本次首发 `versionCode=1`；以后每次发版必须把它 +1、`versionName` 同步递增**，绝不回退、绝不复用旧号。
   - 构建脚本会打印 `覆盖升级配置: app.yiju.archive / versionCode=N / versionName=...` 和一行 APK 签名 `SHA256:` 指纹。**把这次指纹记进最后输出**；若与上一版不一致，立刻停下并原样贴出，不要继续发布。
   - 装新版用 `adb install -r yiju.apk`（或直接在手机上点 APK 覆盖），**不要卸载旧版**。覆盖安装不清数据：棋馆地址、匿名 token、账号登录状态与房主棋馆 `data/` 里的加密存档都保留。
   - 若我给的是更新版（不是首发），只把 `android/version.json` 的 `versionCode` +1、`versionName` 改掉，其余文件一个字不动；仓库已有的 `yiju.apk` 会被新构建覆盖，属正常。
   - 私有部署可用环境变量 `YIJU_KEYSTORE` / `YIJU_STOREPASS` / `YIJU_KEYPASS` / `YIJU_ALIAS` 指定自己的 keystore，但**本次发布不要设这些变量**，否则签名会变、没法覆盖。

6. 提交与打 tag（信息全部写死，不要自己编）：
   ```
   git add -A
   git -c user.name=release-bot -c user.email=release-bot@local commit --allow-empty -m "release: yiju v1.0.0"
   git -c user.name=release-bot -c user.email=release-bot@local tag -a v1.0.0 -m "弈局 yiju v1.0.0"
   ```
   `--allow-empty` 是故意带的：交付仓库已经是干净提交，只改了品牌 JSON 或完全没改都属正常。tag 名和提交信息就用上面这两个，一个字都不改；若我另外给了 tag 名，只把 `v1.0.0` 替换成我给的值，其余不动。
   **不要**执行 `git config --global`，**不要**改任何已有 git 配置。
7. 只读检查一次远程：`git remote -v`。只认名字 **`origin`**：
   - 有 `origin` → 继续第 8 步。
   - 没有 `origin` → 立刻停下，原样贴出 `git remote -v` 的输出，等我给下一步指令。**不要自己 `git remote add`，不要自己起远程地址。**
8. 推送（凭证由本机自动提供，命令里不带任何账号、令牌、密钥）：
   ```
   git push origin HEAD
   git push origin v1.0.0
   ```
   不要加 `--force`，不要改分支名，不要 push 别的 ref。
9. 建 Release 并**只上传 1 个文件 `yiju.apk`**（凭证由本机 `gh` 登录态自动提供）：
   ```
   gh release create v1.0.0 \
     yiju.apk \
     --title "弈局 yiju v1.0.0" \
     --notes "同源联机的简约手绘棋牌馆 · 60 个玩法（含七局纯原创小戏）+ 折狱录制本器 + 弈株妆奁 + 卷面华彩 + 隐士十阶 + 神的领域三尊。房主运行源码包里的 server：dotnet publish/server/qipai-server.dll → http://localhost:5080（需 .NET 8 Runtime）；APK 首启选一个棋馆或填主机局域网地址即可联机。源码公开 · 禁止商用，源码包与 LICENSE 随仓库提供。"
   ```
   只传 `yiju.apk` 一个文件，**不要**把 `yiju-release.zip` / `yiju-source.zip` / `SIZES.txt` 传上去。源码、剧本库、目录适配器都由仓库本身分发。
   `--title` 和 `--notes` 逐字照抄，不要改写、不要翻译、不要自己总结项目内容。
   若 `gh` 不存在或这条命令报错 → 立刻停下，原样贴出报错，**不要**改用 curl 拼 API、不要自己找凭证、不要重试。
10. 逐项核对 `RELEASE_LIST.md` 里的检查清单，只打勾或写「缺失」，不要修。
11. 最后只输出七行：
    ```
    本地仓库绝对路径：
    commit hash：
    tag：
    仓库地址 / Release 地址：
    Release 文件：yiju.apk + 体积；本地留档 3 个文件路径：
    本次 versionCode / versionName / APK 签名 SHA256 指纹：
    检查清单结果：
    ```

【检查清单】
- [ ] `server/` `client/` `rules/` `themes/` `scripts/` `leaderboard/` `tools/` `android/` 都在
- [ ] `README.md`、`LICENSE` 和原文件完全一致，`LICENSE` 为 PolyForm Noncommercial 1.0.0（非商用）
- [ ] 品牌保持默认「弈局 / yiju / 附件像素图标」，或只改了 `branding.json`；没有手改 `res/` 下的 XML、Java、Gradle
- [ ] 构建命令是 `bash build.sh` 然后 `bash build-apk.sh`，顺序与参数都没变
- [ ] 仓库根目录产物 = 4 个文件，文件名逐字一致
- [ ] `SIZES.txt` 已填客户端 gzip、棋馆与 APK 实测体积
- [ ] `android/keystore/yiju.jks` 存在且未被改动 / 未被重新生成
- [ ] `android/version.json` 的 `applicationId` 仍是 `app.yiju.archive`，`versionCode` 严格大于上一版
- [ ] `AndroidManifest.xml` 里没有写死 `versionCode` / `versionName`
- [ ] 构建日志打印了 APK 签名 `SHA256:` 指纹，且与上一版一致
- [ ] 覆盖升级方式已确认：`adb install -r yiju.apk`，**没有卸载重装**
- [ ] 没有多出除两条构建脚本产物以外的文件（`publish/` 不要删）
- [ ] 没有再执行一次 `git init`，没有改 `.git/config`
- [ ] Release 里**只有 1 个文件 `yiju.apk`**，没有上传 zip / SIZES.txt
- [ ] 全程没有打印、复制、写入任何凭证，没有执行 `gh auth login` 或 `git config --global`

【绝对禁止】
- 改任何源码、配置、README、主题文件、规则清单、剧本、目录适配器、`LICENSE`、`.gitignore`、签名密钥、Manifest（例外只有 `android/branding.json` 与发版时 `version.json` 的 `versionCode`/`versionName`）
- 看到报错就自己改代码「修一下」，或替脚本补依赖、升级版本、换构建方式
- 自己给 APK 改名、自己换图标、手改 `strings.xml` / `ic_launcher.xml`（名字图标已定，默认一个字都别动）
- 换 / 删 / 重新生成签名密钥、改 `applicationId`、让 `versionCode` 不递增、卸载旧版再装
- 删掉「看起来没用」的文件（包括 `publish/`、Gradle 缓存、`assets/`）
- 翻译、润色、重写、总结项目内容、提交历史或 Release 说明
- 自己起仓库名 / 路径 / 远程地址 / tag 名 / commit message
- **读取、打印、导出、复制任何凭证；把凭证拼进 URL 或命令；用 curl 直接调需要认证的 API**
- 猜测任何我没写清楚的东西

【遇到任何一步报错、文件对不上、清单看不懂、远程不叫 origin、gh 不可用】
立刻停下，不要尝试修复、不要猜。原样贴出报错或不一致之处；可以附上 `java -version`、`echo $ANDROID_HOME`、`python3 --version`、`gh --version` 这类只读诊断输出，然后等我给下一步指令。

【提示词结束】

---

## 给人类维护者的备注（不在复制范围内）

- 项目交付时已 `git init` 并有 1 个干净提交，含 `LICENSE`（PolyForm Noncommercial 1.0.0，非商用）与 `.gitignore`；agent 直接进目录即可。
- 只收单文件时用 `yiju-repo.bundle`：`git clone yiju-repo.bundle yiju`，全离线，不需要任何远程。
- **凭证路径**：本机 `git credential` / SSH key / `gh auth status` 已就绪即可；提示词里零凭证、零账号、零令牌。若远程名不是 `origin`，先在本机把 remote 配好再交给 agent。
- **APK 品牌**：已定「弈局 / yiju / 附件像素图标」，`branding.json` 默认 `preset=yiju`，agent 不需要确认、不需要改。真要换名换图，只改这一个 JSON（preset 可选 yiju / board / ink / circle / custom），`build-apk.sh` 会调 `render_branding.py` 重新生成矢量图标。
- **APK 前置**：`ANDROID_HOME`（含 `platforms/android-33`、`build-tools`）、JDK 11+、Gradle、python3、首次构建联网。`build-apk.sh` 会自动生成 7.6.4 wrapper，不需要预置 wrapper jar。缺任何一项脚本会以明确错误退出，agent 会停下贴报错。
- APK 是 debug 签名、纯平台 WebView 壳，静态页装在 `assets/client/`；首启弹「填棋馆地址」，不做 TWA（TWA 要求公网 HTTPS，与局域网填 IP 冲突）。要上架商店需换成自己的 release 签名。
- 若环境没有 `gh` CLI：agent 会完成到 `git push` 然后停下，网页 Release 由你手动只传 `yiju.apk`，或单独给一条完整命令。
- **覆盖升级**：固定 keystore + 固定 applicationId + 递增 versionCode 三者缺一不可。密钥随仓库公开分发只为「签名一致」，不上商店；详见 `android/keystore/README.md`。
- **发布形态**：Release 只发 `yiju.apk` 一个文件；`yiju-source.zip` 里带完整棋馆、`scripts/` 示例剧本、`leaderboard/` 目录适配器与非商用协议，房主拿它起自己的棋馆。剧本更新 = 房主往 `scripts/` 丢新 JSON，不发版。
- `build.sh` 需要 .NET 8 SDK；只有 Runtime 时改用已构建好的 `publish/` 目录打包，不要改 `build.sh`。


## 本版追加核对项

- 只上传 `yiju.apk` 一个文件；`yiju-release.zip` / `yiju-source.zip` / `SIZES.txt` 仅本地留档。
- 覆盖升级：固定 `android/keystore/yiju.jks` + 固定 `app.yiju.archive` + `versionCode` 每次 +1，禁止卸载重装。
- 构建前 `build.sh` 会重生成 `client/offline-assets.js` 与 `client/wear.js`；不要手改这两个生成物，改 `themes/wear.json` 或 `rules/manifest.json`。
- 全量验证：`python3 tools/verify.py` 静态自检 + 各 C# 专项实编译实跑；沙盒若缺 .NET 8 / Android SDK，宿主层与 APK 由本环境实构建。
- 声明文案必须同时出现在 README、App 设置页、入门小引、页脚与离线资产里，不得删改。
- 凭证零接触、报错即停；`scripts/` 与 `leaderboard/` 不碰不传。


## 本版新增核对（寻局 / 启动 / 地址）

- 60 局房规都带「隐士随本席最高段位」；寻局按段位分池、随时间放宽、蛇形平衡、进度条与止寻局，候满按最高段位补隐士。
- 一键启动：`./start.sh` / `start.bat` / `yiju.conf` / `server/Startup.cs` 必须在包里；`--help` 能打印全部启动项；`/api/health` `/api/info` `/api/startup` `/ws` 四个端点在位。
- 棋馆地址不绑定固定地址、端口可省可填、缺省端口可在设置里改；不要在任何提示里写「只能填 192.168.x.x:5080」。
- 给 agent 的最终提示词单独在 `AGENT_PROMPT.md`，直接用那一份，不必再拼。

## v2 修订（签名凭证与 GitHub CI，优先于上文冲突条款）

- **基线**：yiju 从未发布、从未安装过任何 APK，不存在需要保覆盖的旧签名；仓库 `https://github.com/lutqiu1121-cpu/yiju` 已建好且为空，分支 `master`，推送即可，不再新建仓库。
- **签名凭证已内置**：固定密钥 `android/keystore/yiju.jks` 随仓库分发，别名 `yiju`、storepass/keypass `yijuarchive`，见 `android/keystore/README.md` 与 `android/app/build.gradle` 默认值。`bash build-apk.sh` 直接沿用即可出同签名包。
- **不需要任何签名 Secrets**：`KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD` / `GH_TOKEN` 均无需配置；CI 用默认 `GITHUB_TOKEN`（Workflow permissions 开 Read and write）。不要新建或替换 keystore、不要设 `YIJU_KEYSTORE` 等环境变量——换了签名根会破坏后续覆盖升级。
- 「凭证零接触」仅指**账号口令 / 令牌 / 登录态**：不读取、不打印、不写入、不索取。仓库里公开的 jks 默认口令属于构建配置，不属此列，按默认值沿用即可，不构成违规。
- **覆盖升级三件套**：固定 `android/keystore/yiju.jks` + 固定 `app.yiju.archive` + `versionCode` 严格递增，三者缺一不可；装新版用 `adb install -r yiju.apk` 或手机直接点 APK 覆盖，禁止卸载重装。
- **测试版例外**：tag `v1.0.0-test.1` 的 Pre-release 允许附 `yiju.apk` + `yiju-release.zip`（服务端包，供 .NET 8 服务器实测）；正式版仍只上传 `yiju.apk` 一个文件。
- `AGENT_PROMPT.md` v2 为最终执行口径，与上文冲突处以 `AGENT_PROMPT.md` 为准。

