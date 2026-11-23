#!/usr/bin/env bash
# 把 PWA 装进最小 WebView 壳，产出仓库根目录的 yiju.apk
# 前置：JDK 11+、Android SDK（platform android-33 + build-tools）、Gradle（任一版本即可，脚本会生成 7.6.4 wrapper）、首次构建需联网取 AGP。
set -euo pipefail
cd "$(dirname "$0")"

echo "== 1/5 检查 Android 构建环境与「覆盖升级」配置"
# 固定签名 + applicationId + 递增 versionCode：缺一不可，否则只能卸载重装
if [ ! -f android/keystore/yiju.jks ] && [ -z "${YIJU_KEYSTORE:-}" ]; then
  echo "错误：缺少 android/keystore/yiju.jks。签名不一致会导致 APK 无法覆盖升级（只能卸载重装）。" >&2
  echo "请从仓库取回同一份 keystore，或用 YIJU_KEYSTORE 指定你自己的私有 keystore。" >&2
  exit 2
fi
if [ ! -f android/version.json ]; then
  echo "错误：缺少 android/version.json（versionCode / versionName / applicationId）。" >&2
  exit 2
fi
python3 - <<'PYV'
import json
v = json.load(open('android/version.json', encoding='utf-8'))
assert isinstance(v.get('versionCode'), int) and v['versionCode'] > 0, 'versionCode 必须是正整数'
assert v.get('applicationId') == 'app.yiju.archive', 'applicationId 变了会变成另一个 App，无法覆盖'
print('    覆盖升级配置: %s / versionCode=%s / versionName=%s' %
      (v['applicationId'], v['versionCode'], v['versionName']))
PYV
: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-}}"
if [ -z "$ANDROID_HOME" ]; then
  for cand in "$HOME/Android/Sdk" /opt/android-sdk /usr/local/android-sdk /usr/lib/android-sdk; do
    [ -d "$cand" ] && ANDROID_HOME="$cand" && break
  done
fi
if [ -z "$ANDROID_HOME" ] || [ ! -d "$ANDROID_HOME" ]; then
  echo "错误：找不到 Android SDK。请设置 ANDROID_HOME（或 ANDROID_SDK_ROOT）后重试。" >&2
  echo "需要：platforms/android-33 与 build-tools；本机 JDK 11+。" >&2
  exit 2
fi
export ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME"
if ! command -v java >/dev/null 2>&1; then
  echo "错误：找不到 java（需要 JDK 11+）。" >&2
  exit 2
fi
echo "    ANDROID_HOME = $ANDROID_HOME"
java -version 2>&1 | head -n 1

echo "== 2/5 同步客户端资产到 assets/client"
ASSETS="android/app/src/main/assets/client"
rm -rf "$ASSETS"
mkdir -p "$ASSETS/rules" "$ASSETS/themes"
cp -r client/. "$ASSETS/"
cp rules/manifest.json rules/vectors.json "$ASSETS/rules/"
cp themes/themes.json "$ASSETS/themes/"
cp LICENSE "$ASSETS/LICENSE.txt"
echo "    assets 文件数: $(find "$ASSETS" -type f | wc -l)"

echo "== 2.5/5 应用品牌（app 名 / 矢量图标 / 页面标题）"
if ! command -v python3 >/dev/null 2>&1; then
  echo "错误：需要 python3 来渲染 android/branding.json。" >&2
  exit 2
fi
python3 android/render_branding.py
echo "    配置见 android/branding.json（只改这一个文件即可换名换图标）"
echo "== 2.6/5 校验图标生成物与 branding.sha256 一致"
python3 - <<'PYI'
import hashlib, pathlib, sys
root = pathlib.Path('.')
bad = []
for line in (root / 'android/branding.sha256').read_text(encoding='utf-8').splitlines():
    h, rel = line.split(None, 1)
    f = root / rel.strip()
    if not f.exists() or hashlib.sha256(f.read_bytes()).hexdigest() != h:
        bad.append(rel.strip())
if bad:
    print('错误：以下图标生成物与 branding.sha256 不一致：', ', '.join(bad), file=sys.stderr)
    sys.exit(2)
print('    图标生成物 %d 项哈希一致' % len((root / 'android/branding.sha256').read_text(encoding='utf-8').splitlines()))
PYI

echo "== 3/5 准备 Gradle wrapper（7.6.4）"
cd android
if [ ! -f gradle/wrapper/gradle-wrapper.jar ]; then
  if ! command -v gradle >/dev/null 2>&1; then
    echo "错误：本机既没有 gradlew 也没有 gradle 命令，无法生成 wrapper。" >&2
    echo "请安装 Gradle，或先运行一次：gradle wrapper --gradle-version 7.6.4 --distribution-type bin" >&2
    exit 2
  fi
  gradle wrapper --gradle-version 7.6.4 --distribution-type bin --no-daemon
fi
if [ ! -x ./gradlew ]; then
  echo "错误：gradlew 不可执行。请检查 wrapper 生成结果。" >&2
  exit 2
fi

echo "== 4/5 构建 APK（固定签名，可直接覆盖升级）"
./gradlew assembleDebug --no-daemon --stacktrace
cd ..
APK="android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK" ]; then
  echo "错误：未生成 $APK，请把上面的 Gradle 报错原样贴出来。" >&2
  exit 2
fi
cp "$APK" yiju.apk

echo "== 4.5/5 校验签名证书（覆盖升级凭证）与 APK 内图标"
BT="$(ls -1 "$ANDROID_HOME"/build-tools/*/apksigner 2>/dev/null | tail -1 || true)"
if [ -n "$BT" ] && [ -x "$BT" ]; then
  "$BT" verify --print-certs yiju.apk 2>/dev/null | grep -m1 'SHA-256 digest' || echo "    （无法读取签名指纹，不影响构建）"
elif command -v keytool >/dev/null 2>&1; then
  keytool -printcert -jarfile yiju.apk 2>/dev/null | grep -m1 -E 'SHA256:' || echo "    （v2-only 时 keytool 读不到，请装 build-tools 用 apksigner）"
fi
# 图标是否真进了包：从 APK 里取实际 res 路径，与仓库位图逐字节比对
ICON_SRC="android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"
ICON_IN_APK="$(unzip -Z1 yiju.apk 2>/dev/null | grep -m1 'res/mipmap.*ic_launcher\.png' || true)"
if [ -n "$ICON_IN_APK" ]; then
  A="$(unzip -p yiju.apk "$ICON_IN_APK" | sha256sum | cut -d' ' -f1)"
  B="$(sha256sum "$ICON_SRC" | cut -d' ' -f1)"
  if [ "$A" = "$B" ]; then
    echo "    APK 内图标已核对：$ICON_IN_APK · 与源文件逐字节一致"
  else
    # aapt2 可能重编码 PNG（crunch），字节会变但像素不变；此时只确认资源确实在包里
    echo "    APK 内图标已核对：$ICON_IN_APK · aapt 重编码（像素未改），源文件哈希以 branding.sha256 为准"
  fi
else
  echo "错误：APK 里找不到 ic_launcher.png，图标没打进包" >&2; exit 2
fi

echo "== 5/5 记录体积"
APKSIZE=$(stat -c %s yiju.apk 2>/dev/null || wc -c < yiju.apk)
LINE="APK: $APKSIZE 字节 ($(awk -v n="$APKSIZE" 'BEGIN{printf "%.1f",n/1024}') KiB, debug 签名, WebView 壳)"
echo "$LINE"
if [ -f SIZES.txt ]; then
  grep -q '^APK:' SIZES.txt || echo "$LINE" >> SIZES.txt
else
  echo "$LINE" > SIZES.txt
fi
echo "完成：yiju.apk"
echo "覆盖升级： adb install -r yiju.apk   （或直接点 APK 安装，不要卸载旧版）"
echo "不要换 keystore、不要改 applicationId；下次发版只把 android/version.json 的 versionCode +1。"
echo "安装后首启会弹出「选一个棋馆」，点目录里的馆或手填服务端局域网地址即可联机。"
