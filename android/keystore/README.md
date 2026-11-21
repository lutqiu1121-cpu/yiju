# 覆盖升级签名密钥（自分发用）

`yiju.jks` 是随仓库分发的**固定签名密钥**，唯一目的：让不同时间、不同机器构建出的 `yiju.apk`
使用同一签名、`applicationId` 不变，从而能 **`adb install -r` / 点 APK 直接覆盖升级**，不用卸载重装。

- alias `yiju` / storepass & keypass `yijuarchive` / JKS / RSA 2048 / 有效期 30 年
- `build.gradle` 的 `debug` 与 `release` 都显式指向它，不再依赖每台机器各自生成的 `~/.android/debug.keystore`
- 升级版本时**只改 `android/version.json` 的 `versionCode`（+1）与 `versionName`**，不要换 keystore、不要改 `applicationId`

## 安全边界（如实说明）

这是**公开仓库里的公开密钥**，只能保证「签名一致」，**不能证明 APK 来自谁**——任何拿到仓库的人都能签出同签名的包。
它适合自分发、局域网自娱、开源项目；**不要用于应用商店上架**，也不要用它保护任何私密数据。
若要上架或需要身份保证：自己生成一份私有 keystore，设环境变量 `YIJU_KEYSTORE` / `YIJU_STOREPASS` / `YIJU_KEYPASS` / `YIJU_ALIAS` 覆盖，
`build-apk.sh` 会优先用环境变量指定的文件；私有 keystore 不要提交进仓库、不要写进 Release。

存档与账号数据在**房主棋馆 `data/`**，不在 APK 里；覆盖安装不会清除客户端偏好（棋馆地址、匿名 token），
换设备或清了数据也能用账号密码重新登录取回存档。
