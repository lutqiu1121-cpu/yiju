# 产物清单 · 弈局 yiju v1.0.0

## Release 上传 2 个文件

| # | 文件 | 说明 | 实测体积 |
| --- | --- | --- | --- |
| 1 | `yiju.apk` | 安卓客户端（纯平台 WebView 壳 + 内置静态页，debug 签名；用户原图像素图标，纯黑墨） | 由 `build-apk.sh` 填 |
| 2 | `yiju-release.zip` | 服务端运行包，供 .NET 8 机器跑 `./start.sh` 实测 | 由 `build.sh` 填 |

> **`yiju-source.zip` / `SIZES.txt` 不上传 Release。**
> 源码、剧本库、目录适配器与非商用协议都随仓库本身分发；房主可直接用 `yiju-release.zip` 起馆，或从 `yiju-source.zip` / 仓库取棋馆 `dotnet run --project server`。
> Release 上两个资产：玩家装 APK，房主用 zip 起自己的棋馆。

## 本地留档（4 个文件，构建后都在仓库根目录）

```
yiju.apk            ← 上传 Release（两个资产之一）
yiju-release.zip    ← 上传 Release（两个资产之一）：server / client / rules / scripts / themes / tools / README / LICENSE / SIZES
yiju-source.zip     ← 仅本地留档：完整源码，再多 android/ leaderboard/ scripts/ 与 .git 以外的全部文件
SIZES.txt           ← 仅本地留档：客户端 gzip、棋馆发布、APK 实测体积
```

`build.sh` 生成后 3 个，`build-apk.sh` 生成 `yiju.apk`。`publish/` 与 Gradle/assets 缓存保持原样，不删。

## 检查清单（agent 只打勾或写「缺失」，不要修）

- [ ] `server/` `client/` `rules/` `themes/` `scripts/` `leaderboard/` `tools/` `android/` 都在
- [ ] `README.md`、`LICENSE` 和原文件完全一致，`LICENSE` 为 PolyForm Noncommercial 1.0.0（非商用）
- [ ] `scripts/` 里至少 3 个示例剧本，`leaderboard/` 未被改动
- [ ] 品牌保持默认「弈局 / yiju / 用户原图逐格还原图标（米白底 + 纯黑墨 + 朱砂点，无框无印）」；没有手改 `res/` 下的 XML / Java / Gradle；`android/branding.sha256` 与生成物一致
- [ ] 构建命令是 `bash build.sh` 然后 `bash build-apk.sh`，顺序与参数都没变
- [ ] 仓库根目录产物 = 4 个文件，文件名逐字一致
- [ ] `SIZES.txt` 已填客户端 gzip、棋馆与 APK 实测体积
- [ ] `yiju.apk` 由 `bash build-apk.sh` 生成，能读到体积
- [ ] 没有多出除两条构建脚本产物以外的文件（`publish/` 不要删）
- [ ] 没有再执行一次 `git init`，没有改 `.git/config`
- [ ] **Release 里正好 2 个文件 `yiju.apk` + `yiju-release.zip`**，没有上传 `yiju-source.zip` / SIZES.txt
- [ ] 全程没有打印、复制、写入任何凭证，没有执行 `gh auth login` 或 `git config --global`
- [ ] `android/keystore/yiju.jks` 在，未被换过；`android/version.json` 的 `versionCode` 严格递增
- [ ] Manifest 不写死版本号；构建日志有 `SHA256:` 签名指纹且与上一版一致
- [ ] 覆盖升级验证方式：`adb install -r yiju.apk` 成功，**没有卸载重装**（数据保留）

## 房主怎么起棋馆（解压 Release 里的 `yiju-release.zip`）

```bash
dotnet run --project server          # 或 dotnet publish/server/qipai-server.dll
```

启动日志会打印可直接照抄的局域网地址与「棋馆名 / 剧本数」。
剧本更新 = 往 `scripts/` 丢新 JSON 或把 `version` +1，开新房时棋馆重读，不用重启、不用发版。
棋馆目录默认开启、随棋馆走；挂了自动降级到本地缓存，玩家仍可手动填地址。

## 覆盖升级（硬性）

`yiju.apk` 必须能**直接覆盖安装**，不能要求玩家卸载重装。三件事锁死：

1. **签名固定**：`android/keystore/yiju.jks`（alias `yiju`），`build.gradle` 的 debug/release 都用它；不换、不删、不重新生成。
2. **包名固定**：`app.yiju.archive`，写在 `android/version.json`，Manifest 不写死版本号。
3. **版本递增**：每次发版只把 `android/version.json` 的 `versionCode` +1、`versionName` 同步改。

构建脚本会打印 `覆盖升级配置` 和 APK 签名 `SHA256:` 指纹，逐版比对必须一致。
验证：`adb install -r yiju.apk`（或手机直接点 APK 覆盖）。覆盖安装不清客户端偏好与匿名 token；
账号与加密存档本来就在房主棋馆 `data/`，更不会受影响。
密钥是公开自分发用的，只保证签名一致，不上商店；详见 `android/keystore/README.md`。
